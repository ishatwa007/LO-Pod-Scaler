'use client';
import { useEffect, useState } from 'react';

interface Props {
  children:       React.ReactNode;
  lastRefreshed?: Date | null;
  onRefresh?:     () => void;
  onLogout?:      () => void;
  user?:          string;
}

export function Shell({ children, lastRefreshed, onRefresh, onLogout, user }: Props) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    try { const s = localStorage.getItem('lo_theme'); if (s === 'light') { setDark(false); document.documentElement.setAttribute('data-theme','light'); } }
    catch { /* ignore */ }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try { localStorage.setItem('lo_theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top bar */}
      <header className="border-b flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', height: 52 }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text)' }} />
          <span className="text-sm font-medium tracking-tight" style={{ color: 'var(--text)' }}>LO Pod Dashboard</span>
          {lastRefreshed && (
            <span className="text-xs" style={{ color: 'var(--muted2)' }}>
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-xs" style={{ color: 'var(--muted)' }}>{user}</span>}
          {onRefresh && (
            <button onClick={onRefresh}
              className="text-xs px-3 py-1.5 border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none' }}>
              Refresh
            </button>
          )}
          <button onClick={toggleDark}
            className="text-xs px-3 py-1.5 border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none' }}>
            {dark ? '☀ Light' : '☾ Dark'}
          </button>
          {onLogout && (
            <button onClick={onLogout}
              className="text-xs px-3 py-1.5 border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none' }}>
              Sign out
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
