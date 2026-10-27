-- CertiRecall v2: progreso sincronizado entre dispositivos.
-- Ejecutar en Supabase → SQL Editor (o con `supabase db push`).
-- El contenido (lecciones y preguntas) NO vive aquí: son JSON estáticos por idioma.

-- ============ Tablas ============

create table public.profiles (
  user_id           uuid primary key default auth.uid() references auth.users on delete cascade,
  locale            text not null default 'es',
  new_per_day       int  not null default 12 check (new_per_day between 1 and 60),
  simulated_date    date not null,
  plan_start        date not null,
  current_day       int  not null default 1,
  completed_lessons int[] not null default '{}',
  starred           text[] not null default '{}',
  updated_at        timestamptz not null,               -- reloj del dispositivo: decide el conflicto
  server_updated_at timestamptz not null default now()  -- reloj del servidor: cursor de descarga
);

create table public.card_states (
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  question_id       text not null,
  interval_days     int  not null,
  ease              real not null,
  repetitions       int  not null,
  due_date          date not null,
  first_seen        date not null,
  updated_at        timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- Solo se agregan filas; el id lo genera el dispositivo, así reenviar es idempotente.
create table public.review_logs (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  question_id text not null,
  topic_id    text not null,
  rating      text not null check (rating in ('otra_vez', 'dificil', 'bien', 'facil')),
  correct     boolean not null,
  seconds     int not null check (seconds >= 0),
  study_date  date not null,
  synced_at   timestamptz not null default now()
);

create index review_logs_user_date on public.review_logs (user_id, study_date);
create index review_logs_user_synced on public.review_logs (user_id, synced_at);
create index card_states_user_due on public.card_states (user_id, due_date);
create index card_states_user_server on public.card_states (user_id, server_updated_at);

-- server_updated_at se renueva en cada cambio, para que otros dispositivos lo descarguen.
create function public.touch_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_server_updated_at();
create trigger card_states_touch before insert or update on public.card_states
  for each row execute function public.touch_server_updated_at();

-- ============ Seguridad: cada usuario solo ve y modifica lo suyo ============
-- La clave "anon" del frontend es pública por diseño; estas políticas son la protección real.

alter table public.profiles    enable row level security;
alter table public.card_states enable row level security;
alter table public.review_logs enable row level security;

create policy "perfil propio" on public.profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tarjetas propias" on public.card_states
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "leer repasos propios" on public.review_logs
  for select to authenticated using (user_id = auth.uid());
create policy "agregar repasos propios" on public.review_logs
  for insert to authenticated with check (user_id = auth.uid());
create policy "borrar repasos propios" on public.review_logs
  for delete to authenticated using (user_id = auth.uid());
-- Sin política de update: un repaso registrado no se modifica (solo se borra al reiniciar el progreso).

-- ============ "Gana la última escritura", resuelto en el servidor ============
-- security invoker: se ejecutan con los permisos del usuario, así que RLS sigue aplicando.

create function public.upsert_card_states(cards jsonb) returns void
language sql security invoker as $$
  insert into public.card_states
    (user_id, question_id, interval_days, ease, repetitions, due_date, first_seen, updated_at)
  select auth.uid(), c.question_id, c.interval_days, c.ease, c.repetitions, c.due_date, c.first_seen, c.updated_at
  from jsonb_to_recordset(cards) as c(
    question_id text, interval_days int, ease real, repetitions int,
    due_date date, first_seen date, updated_at timestamptz)
  on conflict (user_id, question_id) do update set
    interval_days = excluded.interval_days,
    ease        = excluded.ease,
    repetitions = excluded.repetitions,
    due_date    = excluded.due_date,
    first_seen  = least(card_states.first_seen, excluded.first_seen),
    updated_at  = excluded.updated_at
  where card_states.updated_at < excluded.updated_at;
$$;

create function public.upsert_profile(profile jsonb) returns void
language sql security invoker as $$
  insert into public.profiles
    (user_id, locale, new_per_day, simulated_date, plan_start, current_day, completed_lessons, starred, updated_at)
  select auth.uid(), p.locale, p.new_per_day, p.simulated_date, p.plan_start, p.current_day,
         p.completed_lessons, p.starred, p.updated_at
  from jsonb_to_record(profile) as p(
    locale text, new_per_day int, simulated_date date, plan_start date, current_day int,
    completed_lessons int[], starred text[], updated_at timestamptz)
  on conflict (user_id) do update set
    locale            = excluded.locale,
    new_per_day       = excluded.new_per_day,
    simulated_date    = excluded.simulated_date,
    plan_start        = excluded.plan_start,
    current_day       = excluded.current_day,
    completed_lessons = excluded.completed_lessons,
    starred           = excluded.starred,
    updated_at        = excluded.updated_at
  where profiles.updated_at < excluded.updated_at;
$$;

-- ============ Permisos de la API ============
-- Explícitos para no depender de "Exponer automáticamente nuevas tablas" (recomendado desactivarla).
-- Solo usuarios con sesión; el rol anon no recibe nada. RLS sigue filtrando las filas.

grant select, insert, update         on public.profiles    to authenticated;
grant select, insert, update, delete on public.card_states to authenticated;
grant select, insert, delete         on public.review_logs to authenticated;

-- Las funciones nacen ejecutables por PUBLIC: se limitan a usuarios con sesión.
revoke execute on function public.upsert_card_states(jsonb), public.upsert_profile(jsonb) from public, anon;
grant execute on function public.upsert_card_states(jsonb) to authenticated;
grant execute on function public.upsert_profile(jsonb) to authenticated;
