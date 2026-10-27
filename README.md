# CertiRecall v2

Aplicación de estudio tipo Anki para la certificación de Claude: **recuerdo activo** + **repetición espaciada** (SM-2 simplificado), con un reporte que muestra qué temas cuestan más.

Novedades de la v2 respecto de la v1 (rama `main`):

- **Estudia desde cualquier dispositivo**: con una cuenta (enlace por correo o Google), el progreso se sincroniza entre celular, laptop y tablet.
- **Funciona sin conexión**: es una PWA instalable; se estudia offline y se sincroniza al volver la conexión.
- **Multidioma**: interfaz y temario en español e inglés. El progreso es el mismo en ambos idiomas.
- **Sin pérdida de datos**: el progreso guardado por la v1 en el navegador se migra automáticamente.

## Arquitectura

| Capa | Tecnología | Rol |
|---|---|---|
| Frontend | Vite + React + TypeScript | Interfaz; se publica como sitio estático en GitHub Pages |
| Datos locales | IndexedDB (Dexie) | Fuente de verdad en el dispositivo; permite estudiar offline |
| Nube | Supabase (PostgreSQL + Auth + RLS) | Cuentas y sincronización entre dispositivos |
| Idiomas | i18next | Textos de la interfaz; el temario va en un JSON por idioma |
| Offline | vite-plugin-pwa (Workbox) | Guarda en caché la app y el temario |
| Pruebas | Vitest + PGlite | Lógica, sincronización y el SQL real de Supabase |

```text
src/
├── domain/        # lógica pura y probada: scheduler (SM-2), colas, reporte, fechas
├── data/          # content (temario por idioma), localDb (Dexie), sync, remote (Supabase), legacy (migración v1)
├── state/         # progress.tsx (estado global y acciones), ui.tsx (avisos y confirmaciones)
├── features/      # páginas: inicio, lección, cuestionario, reporte, glosario, simulacro, ajustes
├── components/    # layout y gráficos
└── i18n/          # configuración y textos (es.json, en.json)
public/content/
├── es/temario.json, en/temario.json   # mismo contenido, mismos IDs de pregunta
└── historial-demo.json                # datos simulados para el reporte de demostración
supabase/migrations/001_init.sql       # tablas, seguridad por fila y funciones de sincronización
```

### Decisiones clave

- **El contenido no está en la base de datos.** Las lecciones y preguntas son JSON estáticos por idioma, versionados en el repositorio. La base solo guarda el progreso.
- **Los IDs de pregunta son iguales en todos los idiomas** (`tool-use-mc3`). Por eso el progreso no depende del idioma. `npm run check:content` y las pruebas lo verifican.
- **Local-first.** Cada calificación se guarda primero en IndexedDB y queda pendiente de subir. La sincronización:
  - **Repasos** (`review_logs`): solo se agregan, con un UUID generado en el dispositivo. Reenviarlos no los duplica.
  - **Tarjetas y perfil**: gana la última escritura (`updated_at`). Lo resuelve el propio servidor con `upsert_card_states` / `upsert_profile`.
  - **Descarga**: trae lo que cambió desde la última vez, según el reloj del servidor (`server_updated_at`).
- **Seguridad.** La clave `anon` de Supabase es pública por diseño. La protección real son las políticas RLS: cada usuario solo puede leer y escribir sus propias filas.
- **Modo invitado.** Sin cuenta, o sin Supabase configurado, la app funciona igual con datos locales. Al iniciar sesión, lo estudiado como invitado se sube a la cuenta.

## Ejecutar en local

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # pruebas (dominio, sincronización, migración, SQL con PGlite)
npm run check:content
npm run build && npm run preview
```

## Activar la sincronización (Supabase)

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta `supabase/migrations/001_init.sql`.
3. En **Authentication → URL Configuration**, agrega como *Redirect URL* la dirección de la app (p. ej. `http://localhost:5173/` y `https://<usuario>.github.io/CertiRecall/`).
4. Opcional: en **Authentication → Providers**, activa Google para el botón "Continuar con Google".
5. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (**Project Settings → API**).

Sin el paso 5 la app funciona en modo invitado.

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy.yml` valida el contenido, ejecuta las pruebas, compila y publica en cada push a `main`.

1. **Settings → Pages → Source: GitHub Actions.** Esto reemplaza la publicación de la v1 "desde la rama"; hazlo solo cuando quieras pasar a la v2.
2. **Settings → Secrets and variables → Actions:** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Agregar un idioma

1. Copia `src/i18n/locales/en.json` a `<idioma>.json`, tradúcelo y regístralo en `src/i18n/index.ts`.
2. Crea `public/content/<idioma>/temario.json` con **los mismos IDs**. Lo que falte se muestra en español, marcado como "Sin traducir".
3. Agrega el código del idioma a `LOCALES` en `src/data/content.ts`.
4. Ejecuta `npm run check:content`.

## Limitaciones conocidas

- Reiniciar el progreso borra los datos en la cuenta y en el dispositivo actual. Otro dispositivo que ya los había descargado los conserva hasta que reinicie también.
- Si el mismo tema se estudia a la vez en dos dispositivos sin conexión, la tarjeta queda con la última calificación. Los repasos de ambos dispositivos se conservan en el reporte.
- El temario es de ejemplo, no oficial. La traducción al inglés debe revisarla una persona.
