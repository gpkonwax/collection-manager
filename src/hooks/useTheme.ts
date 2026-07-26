import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'bright';

const STORAGE_KEY = 'gpk-theme';

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'bright' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark', 'bright');
  root.classList.add(theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = readInitial();
    applyTheme(t);
    return t;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'bright' : 'dark')),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
