'use client';

import { useEffect, useRef } from 'react';

/** Returns a function that calls `fn` once `ms` after the last call (for autosave while typing). */
export function useDebounced<A extends unknown[]>(fn: (...args: A) => void, ms = 600) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (...args: A) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), ms);
  };
}
