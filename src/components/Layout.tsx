import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { formatDate } from '../domain/dates';
import { syncAvailable, useProgress } from '../state/progress';
import { useUi } from '../state/ui';

const VISTAS = [
  { ruta: '/', clave: 'home', icono: '⌂' },
  { ruta: '/estudiar', clave: 'study', icono: '▤' },
  { ruta: '/quiz', clave: 'quiz', icono: '✳' },
  { ruta: '/reporte', clave: 'report', icono: '▥' },
  { ruta: '/glosario', clave: 'glossary', icono: '⌕' },
  { ruta: '/simulacro', clave: 'exam', icono: '◷' },
  { ruta: '/ajustes', clave: 'settings', icono: '⚙' }
] as const;

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { profile, advanceDay, syncStatus } = useProgress();
  const { toast } = useUi();
  const { pathname } = useLocation();
  const actual = VISTAS.find(vista => vista.ruta === pathname) ?? VISTAS[0];

  const avanzar = () => {
    advanceDay();
    toast(t('toasts.simulatedDate', { date: formatDate(profile.simulatedDate, i18n.language) }));
  };

  // El aviso lateral indica dónde vive el progreso.
  const estado = syncAvailable ? t(`sync.${syncStatus}`) : t('sync.localOnly');

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={t('nav.main')}>
        <NavLink className="brand" to="/">
          <span className="brand-mark">C</span>
          <span>CertiRecall<small>{t('brand.tagline')}</small></span>
        </NavLink>
        <nav className="nav-links">
          {VISTAS.map(vista => (
            <NavLink key={vista.ruta} to={vista.ruta} end={vista.ruta === '/'}>
              <span>{vista.icono}</span> {t(`nav.${vista.clave}`)}
            </NavLink>
          ))}
        </nav>
        <div className={`sidebar-note sync-${syncStatus}`}><span className="dot"></span> {estado}</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t('brand.eyebrow')}</span>
            <h1 id="page-title">{t(`titles.${actual.clave}`)}</h1>
          </div>
          <button id="date-control" className="date-chip" type="button" title={t('date.advance')} onClick={avanzar}>
            ◷ <span id="date-label">{formatDate(profile.simulatedDate, i18n.language)}</span> <span className="date-arrow">＋</span>
          </button>
        </header>
        <div id="app" aria-live="polite"><Outlet /></div>
        <footer className="footer-note">{t('footer.sample')} <span>·</span> {t('footer.motto')}</footer>
      </main>

      <nav className="mobile-nav" aria-label={t('nav.mobile')}>
        {VISTAS.map(vista => (
          <NavLink key={vista.ruta} to={vista.ruta} end={vista.ruta === '/'}>
            <span>{vista.icono}</span>{t(`navShort.${vista.clave}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
