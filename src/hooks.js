import { useState, useEffect, useCallback, useRef } from 'react';

// ── useInterval ───────────────────────────────────
export function useInterval(callback, delay) {
  const savedCallback = useRef();

  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ── useClock ──────────────────────────────────────
export function useClock() {
  const [time, setTime] = useState(new Date());
  useInterval(() => setTime(new Date()), 1000);
  return time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── useTheme ──────────────────────────────────────
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('attendance-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('attendance-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle };
}

// ── useToast ──────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, type = 'inf') => {
    const id = Date.now() + Math.random();
    setToasts(t => [{ id, msg, type }, ...t]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 3800);
  }, []);

  return { toasts, addToast };
}
