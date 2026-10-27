// Estado global del progreso: lo lee de IndexedDB, aplica las acciones del usuario
// y dispara la sincronización con Supabase cuando hay una cuenta conectada.
import type { User } from '@supabase/supabase-js';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode
} from 'react';
import { useTranslation } from 'react-i18next';
import { loadDemoLogs, loadSyllabus } from '../data/content';
import { convertLegacy, readLegacy } from '../data/legacy';
import {
  clearAll, getValue, importLocal, loadSnapshot, saveProfile, saveReview, setValue
} from '../data/localDb';
import { createSupabaseAdapter, supabase, syncAvailable } from '../data/remote';
import { claimLocalData, syncOnce } from '../data/sync';
import { addDays, daysBetween, today } from '../domain/dates';
import { rateCard } from '../domain/scheduler';
import type { CardState, Profile, Rating, ReviewLog, SessionQuestion, Syllabus } from '../domain/types';

export type SyncStatus = 'guest' | 'syncing' | 'synced' | 'offline' | 'error';

interface ProgressContextValue {
  syllabus: Syllabus;
  demoLogs: ReviewLog[];
  profile: Profile;
  cards: Record<string, CardState>;
  logs: ReviewLog[];
  currentDay: number;
  user: User | null;
  syncStatus: SyncStatus;
  rate: (pregunta: SessionQuestion, rating: Rating, correct: boolean, seconds: number) => CardState;
  updateProfile: (cambios: Partial<Profile>) => void;
  toggleStar: (id: string) => void;
  completeLesson: (dia: number) => void;
  advanceDay: () => void;
  resetDate: () => void;
  setLocale: (locale: string) => void;
  resetProgress: () => Promise<void>;
  exportProgress: () => void;
  importProgress: (archivo: File) => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function defaultProfile(locale: string): Profile {
  const hoy = today();
  return {
    locale, newPerDay: 12, simulatedDate: hoy, planStart: hoy, currentDay: 1,
    completedLessons: [], starred: [], updatedAt: new Date().toISOString()
  };
}

/** Día del plan: avanza con la fecha simulada y nunca retrocede. */
export function computeCurrentDay(profile: Profile, totalDias: number): number {
  const calculado = Math.max(1, daysBetween(profile.planStart, profile.simulatedDate) + 1);
  return Math.min(totalDias, Math.max(calculado, profile.currentDay));
}

/** Primer arranque: si hay progreso de la v1 en localStorage, se importa una sola vez. */
async function migrateLegacyIfNeeded(locale: string): Promise<boolean> {
  if (await getValue<boolean>('legacyMigrated')) return false;
  await setValue('legacyMigrated', true);
  const convertido = convertLegacy(readLegacy(), locale);
  if (!convertido) return false;
  await importLocal(convertido.cards, convertido.logs, convertido.profile);
  return true;
}

export function ProgressProvider({ children, onError }: { children: ReactNode; onError: (e: Error) => void }) {
  const { i18n } = useTranslation();
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [demoLogs, setDemoLogs] = useState<ReviewLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('guest');
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sincronizando = useRef(false);
  const userRef = useRef<User | null>(null);

  const recargarDesdeDb = useCallback(async () => {
    const snapshot = await loadSnapshot();
    if (snapshot.profile) setProfile(snapshot.profile);
    setCards(snapshot.cards);
    setLogs(snapshot.logs);
    return snapshot;
  }, []);

  // ---- Sincronización ----
  const syncNow = useCallback(async () => {
    if (!supabase || !userRef.current || sincronizando.current) return;
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    sincronizando.current = true;
    setSyncStatus('syncing');
    try {
      const resultado = await syncOnce(createSupabaseAdapter(supabase));
      if (resultado.recibidos) await recargarDesdeDb();
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error de sincronización:', error);
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      sincronizando.current = false;
    }
  }, [recargarDesdeDb]);

  const programarSync = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => { void syncNow(); }, 1500);
  }, [syncNow]);

  // ---- Carga inicial ----
  useEffect(() => {
    (async () => {
      const idiomaInicial = i18n.resolvedLanguage ?? 'es';
      await migrateLegacyIfNeeded(idiomaInicial);
      const snapshot = await recargarDesdeDb();
      const perfil = snapshot.profile ?? defaultProfile(idiomaInicial);
      if (!snapshot.profile) await saveProfile(perfil);
      setProfile(perfil);
      if (perfil.locale !== i18n.resolvedLanguage) await i18n.changeLanguage(perfil.locale);
      const [temario, demo] = await Promise.all([loadSyllabus(perfil.locale), loadDemoLogs()]);
      setSyllabus(temario);
      setDemoLogs(demo);
    })().catch(error => onError(error instanceof Error ? error : new Error(String(error))));
  }, [i18n, onError, recargarDesdeDb]);

  // ---- Cuenta (solo si Supabase está configurado) ----
  useEffect(() => {
    if (!supabase) return;
    const alCambiarSesion = async (nuevo: User | null) => {
      const anterior = userRef.current;
      userRef.current = nuevo;
      setUser(nuevo);
      if (!nuevo) { setSyncStatus('guest'); return; }
      if (anterior?.id !== nuevo.id) {
        const resultado = await claimLocalData(nuevo.id);
        if (resultado === 'reemplazados') await recargarDesdeDb();
        await syncNow();
      }
    };
    void supabase.auth.getSession().then(({ data }) => alCambiarSesion(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      // Se difiere para no llamar a Supabase dentro de su propio callback.
      setTimeout(() => { void alCambiarSesion(sesion?.user ?? null); }, 0);
    });
    // Tras volver del enlace mágico u OAuth, se limpia ?code= de la URL.
    if (new URLSearchParams(location.search).has('code')) {
      history.replaceState(null, '', location.pathname + location.hash);
    }
    return () => data.subscription.unsubscribe();
  }, [recargarDesdeDb, syncNow]);

  useEffect(() => {
    const alConectar = () => { void syncNow(); };
    const alVolver = () => { if (document.visibilityState === 'visible') void syncNow(); };
    const alDesconectar = () => { if (userRef.current) setSyncStatus('offline'); };
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [syncNow]);

  // ---- Acciones ----
  const updateProfile = useCallback((cambios: Partial<Profile>) => {
    setProfile(actual => {
      if (!actual) return actual;
      const nuevo = { ...actual, ...cambios, updatedAt: new Date().toISOString() };
      void saveProfile(nuevo).then(programarSync);
      return nuevo;
    });
  }, [programarSync]);

  const value = useMemo<ProgressContextValue | null>(() => {
    if (!syllabus || !profile) return null;
    const totalDias = syllabus.dias.length;
    const currentDay = computeCurrentDay(profile, totalDias);

    return {
      syllabus, demoLogs, profile, cards, logs, currentDay, user, syncStatus,

      rate(pregunta, rating, correct, seconds) {
        const card = rateCard(cards[pregunta.id], pregunta.id, rating, profile.simulatedDate);
        const log: ReviewLog = {
          id: crypto.randomUUID(), questionId: pregunta.id, topicId: pregunta.tema.id,
          rating, correct, seconds, studyDate: profile.simulatedDate
        };
        setCards(actuales => ({ ...actuales, [card.questionId]: card }));
        setLogs(actuales => [...actuales, log]);
        void saveReview(card, log).then(programarSync);
        return card;
      },

      updateProfile,

      toggleStar(id) {
        updateProfile({
          starred: profile.starred.includes(id)
            ? profile.starred.filter(item => item !== id)
            : [...profile.starred, id]
        });
      },

      completeLesson(dia) {
        if (!profile.completedLessons.includes(dia)) {
          updateProfile({ completedLessons: [...profile.completedLessons, dia] });
        }
      },

      advanceDay() {
        const siguiente = { ...profile, simulatedDate: addDays(profile.simulatedDate, 1) };
        updateProfile({
          simulatedDate: siguiente.simulatedDate,
          currentDay: computeCurrentDay(siguiente, totalDias)
        });
      },

      resetDate() {
        updateProfile({ simulatedDate: today(), currentDay });
      },

      setLocale(locale) {
        updateProfile({ locale });
        void i18n.changeLanguage(locale);
        void loadSyllabus(locale).then(setSyllabus);
      },

      async resetProgress() {
        const usuario = userRef.current;
        if (supabase && usuario) {
          await Promise.all([
            supabase.from('review_logs').delete().eq('user_id', usuario.id),
            supabase.from('card_states').delete().eq('user_id', usuario.id)
          ]);
        }
        await clearAll();
        if (usuario) await setValue('ownerId', usuario.id);
        await setValue('legacyMigrated', true);
        const nuevo = { ...defaultProfile(profile.locale), updatedAt: new Date().toISOString() };
        await saveProfile(nuevo);
        setProfile(nuevo);
        setCards({});
        setLogs([]);
        programarSync();
      },

      exportProgress() {
        const datos = { app: 'certirecall', version: 2, profile, cards: Object.values(cards), logs };
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.download = 'certirecall-progreso.json';
        enlace.click();
        URL.revokeObjectURL(enlace.href);
      },

      async importProgress(archivo) {
        const datos = JSON.parse(await archivo.text());
        // Acepta el formato de la v2 y también respaldos exportados desde la v1.
        const convertido = datos?.version === 2 && datos.app === 'certirecall'
          ? { profile: datos.profile as Profile, cards: datos.cards as CardState[], logs: datos.logs as ReviewLog[] }
          : convertLegacy(datos, profile.locale);
        if (!convertido) throw new Error('invalid');
        const ahora = new Date().toISOString();
        await importLocal(
          convertido.cards.map(card => ({ ...card, updatedAt: ahora })),
          convertido.logs,
          { ...convertido.profile, updatedAt: ahora }
        );
        await recargarDesdeDb();
        programarSync();
      },

      async signInWithEmail(email) {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOtp({
          email, options: { emailRedirectTo: location.origin + location.pathname }
        });
        if (error) throw error;
      },

      async signInWithGoogle() {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google', options: { redirectTo: location.origin + location.pathname }
        });
        if (error) throw error;
      },

      async signOut() {
        if (!supabase) return;
        await syncNow();
        await supabase.auth.signOut();
      },

      syncNow
    };
  }, [syllabus, demoLogs, profile, cards, logs, user, syncStatus, updateProfile, programarSync, i18n, recargarDesdeDb, syncNow]);

  if (!value) return <div className="loading-card">…</div>;
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const valor = useContext(ProgressContext);
  if (!valor) throw new Error('useProgress debe usarse dentro de ProgressProvider');
  return valor;
}

export { syncAvailable };
