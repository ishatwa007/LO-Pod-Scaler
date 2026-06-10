'use client';
import { useState } from 'react';

interface Props { onLogin: (username: string, role: string, displayName: string) => void }

export function AuthModal({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      onLogin(data.username, data.role, data.displayName);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="border p-8 w-full max-w-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text)' }} />
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted)', letterSpacing: '0.12em' }}>LO Pod Dashboard</span>
          </div>
          <h2 className="text-xl font-medium" style={{ color: 'var(--text)' }}>Sign in</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Username</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              className="w-full border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              placeholder="e.g. academy_lo" autoComplete="username" autoFocus
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-xs py-2 px-3 border" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 text-sm font-medium transition-opacity"
            style={{ background: 'var(--text)', color: 'var(--bg)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
