import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gpk-retro';

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Retro (1985 scan) colour grade toggle for Series 1 & 2 artwork. */
export function useRetroMode() {
  const [retro, setRetroState] = useState<boolean>(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, retro ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [retro]);

  const setRetro = useCallback((v: boolean) => setRetroState(v), []);
  const toggleRetro = useCallback(() => setRetroState((p) => !p), []);

  return { retro, setRetro, toggleRetro };
}
