// Avisos (toasts) y diálogo de confirmación compartidos por toda la app.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Toast { id: number; texto: string; tipo: '' | 'error' }
interface Confirmacion { titulo: string; texto: string; alConfirmar: () => void }

interface UiContextValue {
  toast: (texto: string, tipo?: Toast['tipo']) => void;
  confirm: (titulo: string, texto: string, alConfirmar: () => void) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  const toast = useCallback((texto: string, tipo: Toast['tipo'] = '') => {
    const id = Date.now() + Math.random();
    setToasts(lista => [...lista, { id, texto, tipo }]);
    setTimeout(() => setToasts(lista => lista.filter(item => item.id !== id)), 3400);
  }, []);

  const confirm = useCallback((titulo: string, texto: string, alConfirmar: () => void) => {
    setConfirmacion({ titulo, texto, alConfirmar });
    requestAnimationFrame(() => dialogo.current?.showModal());
  }, []);

  const cerrar = () => dialogo.current?.close();

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <dialog
        ref={dialogo}
        className="dialog"
        onClose={() => setConfirmacion(null)}
        onClick={evento => { if (evento.target === dialogo.current) cerrar(); }}
      >
        {confirmacion && (
          <div>
            <button className="dialog-close" aria-label={t('common.close')} onClick={cerrar}>×</button>
            <span className="eyebrow">{t('common.confirmAction')}</span>
            <h2>{confirmacion.titulo}</h2>
            <p>{confirmacion.texto}</p>
            <div className="dialog-actions">
              <button className="button button-secondary" onClick={cerrar}>{t('common.cancel')}</button>
              <button
                className="button button-danger"
                onClick={() => { cerrar(); confirmacion.alConfirmar(); }}
              >{t('common.confirm')}</button>
            </div>
          </div>
        )}
      </dialog>
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map(item => <div key={item.id} className={`toast ${item.tipo}`}>{item.texto}</div>)}
      </div>
    </UiContext.Provider>
  );
}

export function useUi(): UiContextValue {
  const valor = useContext(UiContext);
  if (!valor) throw new Error('useUi debe usarse dentro de UiProvider');
  return valor;
}
