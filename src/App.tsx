import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ExamPage from './features/ExamPage';
import GlossaryPage from './features/GlossaryPage';
import HomePage from './features/HomePage';
import LessonPage from './features/LessonPage';
import QuizPage from './features/QuizPage';
import ReportPage from './features/ReportPage';
import SettingsPage from './features/SettingsPage';
import { ProgressProvider } from './state/progress';
import { UiProvider } from './state/ui';

export default function App() {
  const { t } = useTranslation();
  const [error, setError] = useState<Error | null>(null);
  const alFallar = useCallback((e: Error) => setError(e), []);

  if (error) {
    return (
      <section className="error-state">
        <span>!</span>
        <h2>{t('errors.loadTitle')}</h2>
        <p>{error.message}</p>
      </section>
    );
  }

  return (
    <UiProvider>
      <ProgressProvider onError={alFallar}>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="estudiar" element={<LessonPage />} />
              <Route path="quiz" element={<QuizPage />} />
              <Route path="reporte" element={<ReportPage />} />
              <Route path="glosario" element={<GlossaryPage />} />
              <Route path="simulacro" element={<ExamPage />} />
              <Route path="ajustes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ProgressProvider>
    </UiProvider>
  );
}
