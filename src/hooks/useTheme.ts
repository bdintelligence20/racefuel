import { useState, useEffect, useCallback } from 'react';
import { getPreference, setPreference } from '../persistence/db';

export type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');
  const [loaded, setLoaded] = useState(false);

  // Load saved preference
  useEffect(() => {
    getPreference('theme').then((saved) => {
      const t = (saved as Theme) || 'light';
      setThemeState(t);
      applyTheme(t);
      setLoaded(true);
    });
  }, []);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    setPreference('theme', newTheme);
  }, []);

  return { theme, setTheme, loaded };
}
