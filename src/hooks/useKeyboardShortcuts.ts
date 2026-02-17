import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface KeyboardShortcutsConfig {
  // Repertoire page
  onFlipBoard?: () => void;
  onResetBoard?: () => void;
  onNavigateForward?: () => void;
  onNavigateBack?: () => void;
  onDeleteNode?: () => void;
  // Drill page
  onHint?: () => void;
  onSkip?: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Global navigation (Ctrl/Cmd + number)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigate('/');
            return;
          case '2':
            e.preventDefault();
            navigate('/repertoire');
            return;
          case '3':
            e.preventDefault();
            navigate('/drill');
            return;
          case '4':
            e.preventDefault();
            navigate('/stats');
            return;
          case '5':
            e.preventDefault();
            navigate('/settings');
            return;
        }
      }

      // Page-specific shortcuts
      if (location.pathname === '/repertoire') {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            config.onFlipBoard?.();
            return;
          case 'ArrowRight':
            e.preventDefault();
            config.onNavigateForward?.();
            return;
          case 'ArrowLeft':
            e.preventDefault();
            config.onNavigateBack?.();
            return;
          case 'Home':
            e.preventDefault();
            config.onResetBoard?.();
            return;
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            config.onDeleteNode?.();
            return;
        }
      }

      if (location.pathname === '/drill') {
        switch (e.key) {
          case 'h':
            e.preventDefault();
            config.onHint?.();
            return;
          case 's':
            e.preventDefault();
            config.onSkip?.();
            return;
        }
      }
    },
    [location.pathname, navigate, config],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
