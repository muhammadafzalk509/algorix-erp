'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'algorix-theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Sync initial state from the class set by the no-flash script in layout.
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
