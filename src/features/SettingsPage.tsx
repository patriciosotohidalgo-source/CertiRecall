import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALES } from '../data/content';
import { syncAvailable, useProgress } from '../state/progress';
import { useUi } from '../state/ui';

const NOMBRES_IDIOMA: Record<string, string> = { es: 'Español', en: 'English' };

export default function SettingsPage() {
  const { t } = useTranslation();
  const progreso = useProgress();
  const { profile, user, syncStatus } = progreso;
  const { toast, confirm } = useUi();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviarEnlace = async (evento: FormEvent) => {
    evento.preventDefault();
    try {
      await progreso.signInWithEmail(email);
      setEnviado(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const importar = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      await progreso.importProgress(archivo);
      toast(t('settings.imported'));
    } catch {
      toast(t('settings.importError'), 'error');
    }
  };

  return (
    <>
      <section className="settings-intro">
        <span className="eyebrow">{t('settings.eyebrow')}</span>
        <h2>{t('settings.title')}</h2>
        <p>{!syncAvailable ? t('settings.introNoSync') : user ? t('settings.introSynced') : t('settings.introLocal')}</p>
      </section>

      <section className="panel account-card">
        <div>
          <span className="settings-icon">☁</span>
          <h3>{t('account.title')}</h3>
          {!syncAvailable && <p>{t('account.notConfigured')}</p>}
          {syncAvailable && user && (
            <>
              <p>{t('account.signedInAs', { email: user.email })} · <b>{t(`sync.${syncStatus}`)}</b></p>
              <div className="date-actions">
                <button className="button button-secondary" onClick={() => void progreso.syncNow()}>{t('account.syncNow')}</button>
                <button className="text-button" onClick={() => void progreso.signOut()}>{t('account.signOut')}</button>
              </div>
            </>
          )}
          {syncAvailable && !user && (
            <>
              <p>{t('account.why')}</p>
              {enviado ? <p className="account-sent">{t('account.checkEmail', { email })}</p> : (
                <form className="account-form" onSubmit={enviarEnlace}>
                  <label htmlFor="account-email">{t('account.email')}</label>
                  <input id="account-email" type="email" required value={email} autoComplete="email"
                    placeholder={t('account.placeholder')} onChange={evento => setEmail(evento.target.value)} />
                  <button className="button button-dark" type="submit">{t('account.sendLink')}</button>
                </form>
              )}
              <button className="button button-secondary" onClick={() => progreso.signInWithGoogle().catch(e => toast(String(e), 'error'))}>
                {t('account.google')}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="settings-grid">
        <article className="panel settings-card">
          <span className="settings-icon">文</span>
          <h3>{t('settings.language')}</h3>
          <p>{t('settings.languageHelp')}</p>
          <label htmlFor="locale">{t('settings.language')}</label>
          <select id="locale" value={profile.locale} onChange={evento => progreso.setLocale(evento.target.value)}>
            {LOCALES.map(locale => <option key={locale} value={locale}>{NOMBRES_IDIOMA[locale]}</option>)}
          </select>
        </article>
        <article className="panel settings-card">
          <span className="settings-icon">✳</span>
          <h3>{t('settings.newPerDay')}</h3>
          <p>{t('settings.newPerDayHelp')}</p>
          <label htmlFor="new-per-day">{t('settings.dailyQuestions')}</label>
          <select id="new-per-day" value={profile.newPerDay} onChange={evento => {
            progreso.updateProfile({ newPerDay: Number(evento.target.value) });
            toast(t('settings.saved'));
          }}>
            {[4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{t('settings.nQuestions', { count: n })}</option>)}
          </select>
        </article>
        <article className="panel settings-card">
          <span className="settings-icon">⇧</span>
          <h3>{t('settings.export')}</h3>
          <p>{t('settings.exportHelp')}</p>
          <button className="button button-secondary" onClick={progreso.exportProgress}>{t('settings.exportButton')}</button>
        </article>
        <article className="panel settings-card">
          <span className="settings-icon">⇩</span>
          <h3>{t('settings.import')}</h3>
          <p>{t('settings.importHelp')}</p>
          <label className="button button-secondary file-button">{t('settings.importButton')}
            <input id="import-file" type="file" accept="application/json,.json" hidden
              onChange={evento => { void importar(evento.target.files?.[0]); evento.target.value = ''; }} />
          </label>
        </article>
        <article className="panel settings-card danger-card">
          <span className="settings-icon">↺</span>
          <h3>{t('settings.reset')}</h3>
          <p>{user ? t('settings.resetHelpSynced') : t('settings.resetHelp')}</p>
          <button className="button button-danger" onClick={() => confirm(t('settings.resetConfirmTitle'), t('settings.resetConfirmText'), () => {
            void progreso.resetProgress().then(() => toast(t('settings.resetDone')));
          })}>{t('settings.reset')}</button>
        </article>
      </section>

      <section className="panel date-settings">
        <div>
          <span className="eyebrow">{t('settings.demoMode')}</span>
          <h3>{t('settings.simulatedDate')}</h3>
          <p>{t('settings.simulatedDateHelp')}</p>
        </div>
        <div className="date-actions">
          <button className="button button-secondary" onClick={progreso.advanceDay}>{t('date.advanceButton')}</button>
          <button className="text-button" onClick={() => { progreso.resetDate(); toast(t('settings.backToToday')); }}>{t('settings.resetDate')}</button>
        </div>
      </section>
    </>
  );
}
