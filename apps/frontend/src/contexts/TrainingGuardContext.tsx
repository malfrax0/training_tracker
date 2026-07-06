import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/Common/ConfirmDialog';

interface TrainingGuardContextValue {
  isActive: boolean;
  setActive: (active: boolean) => void;
  /** Runs `action` immediately if no workout is active, otherwise asks for confirmation first. */
  guardedAction: (action: () => void) => void;
}

const TrainingGuardContext = createContext<TrainingGuardContextValue | null>(null);

export function TrainingGuardProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const navigate = useNavigate();

  const setActive = useCallback((active: boolean) => {
    setIsActive(active);
  }, []);

  const guardedAction = useCallback((action: () => void) => {
    if (!isActiveRef.current) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setConfirmOpen(true);
  }, []);

  const handleConfirm = () => {
    setConfirmOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsActive(false);
    action?.();
  };

  const handleCancel = () => {
    setConfirmOpen(false);
    pendingActionRef.current = null;
  };

  // Intercept the hardware/browser back button while a workout is active.
  useEffect(() => {
    if (!isActive) return;
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      if (!isActiveRef.current) return;
      window.history.pushState(null, '', window.location.href);
      pendingActionRef.current = () => navigate('/');
      setConfirmOpen(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isActive, navigate]);

  // Warn on refresh / tab close while a workout is active.
  useEffect(() => {
    if (!isActive) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isActive]);

  return (
    <TrainingGuardContext.Provider value={{ isActive, setActive, guardedAction }}>
      {children}
      <ConfirmDialog
        open={confirmOpen}
        title="Leave training?"
        message="Your workout is still in progress. If you leave now, your session won't be marked complete."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </TrainingGuardContext.Provider>
  );
}

export function useTrainingGuard() {
  const ctx = useContext(TrainingGuardContext);
  if (!ctx) throw new Error('useTrainingGuard must be used within a TrainingGuardProvider');
  return ctx;
}
