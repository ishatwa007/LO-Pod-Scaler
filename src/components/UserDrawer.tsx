'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DrillResponse, DrillUser } from '@/types';

interface Props {
  open:         boolean;
  onClose:      () => void;
  program:      string;
  metricId:     string;
  label:        string;
  total:        number;
  days:         string[];
  batchFilter?: string;
  initialDate?: string;  // pre-filter to this day when opened from a day cell
}

function csv(users: DrillUser[], label: string, batch?: string) {
  const name = [label, batch].filter(Boolean).join('-').replace(/\s+/g, '-');
  const hdr  = ['Email', 'Name', 'Batch', 'Contest', 'Status', 'MI Status', 'Date'];
  const rows = users.map(u => [
    u.email, u.name || '', u.batch,
    u.contestName || '', u.status || u.passed || '',
    u.miStatus || '', u.startDate || u.certDate || '',
  ]);
  const content = [hdr, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  a.download = `${name}.csv`;
  a.click();
}

export function UserDrawer({ open, onClose, program, metricId, label, total, days, batchFilter, initialDate }: Props) {
  const [users,      setUsers]      = useState<DrillUser[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [dateFilter, setDateFilter] = useState(initialDate || '');
  const [search,     setSearch]     = useState('');

  const isContest = metricId.includes('contest') || metricId.includes('mock');

  const load = useCallback(async (date = '') => {
    setLoading(true); setError(''); setUsers([]);
    try {
      const p = new URLSearchParams({ program, metricId });
      if (date)        p.set('date',  date);
      if (batchFilter) p.set('batch', batchFilter);
      const res  = await fetch(`/api/cert/users?${p}`);
      const data = await res.json() as DrillResponse & { error?: string };
      if ((data as {error?: string}).error) throw new Error((data as {error?: string}).error);
      setUsers(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally { setLoading(false); }
  }, [program, metricId, batchFilter]);

  useEffect(() => {
    if (open) { setDateFilter(initialDate || ''); setSearch(''); load(initialDate || ''); }
  }, [open, load, initialDate]);

  if (!open) return null;

  const shown = search
    ? users.filter(u =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        u.batch.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" style={{ background: 'rgba(0,0,0,0.5)' }} />
      <div className="w-[700px] h-full flex flex-col border-l"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0 flex-1 pr-4">
            <p className="font-display font-medium text-sm" style={{ color: 'var(--text)' }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {program}{batchFilter ? ` · ${batchFilter}` : ''} · {total.toLocaleString()} total
            </p>
            {batchFilter && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 border text-xs"
                style={{ borderColor: 'var(--border)', color: 'var(--warn)', background: 'rgba(252,211,77,0.06)' }}>
                <span>Batch: {batchFilter}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {shown.length > 0 && (
              <button onClick={() => csv(shown, label, batchFilter)}
                className="text-xs px-3 py-1.5 border"
                style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text)' }}>
                ↓ CSV ({shown.length})
              </button>
            )}
            <button onClick={onClose}
              style={{ color: 'var(--muted)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2.5 border-b flex flex-wrap gap-2 items-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>

          {/* Search box */}
          <div className="flex items-center gap-2 border px-2.5 py-1.5 flex-1 min-w-[180px]"
            style={{ borderColor: 'var(--border)', background: 'var(--input-bg)' }}>
            <span style={{ color: 'var(--muted2)', fontSize: 12 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter by email, name, batch…"
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--text)' }} />
            {search && <button onClick={() => setSearch('')}
              style={{ color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>}
          </div>

          {/* Day filter for contest rows */}
          {isContest && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Day:</span>
              <button onClick={() => { setDateFilter(''); load(''); }}
                className="text-xs px-2 py-1 border"
                style={{ borderColor: 'var(--border)', background: !dateFilter ? 'var(--text)' : 'transparent', color: !dateFilter ? 'var(--bg)' : 'var(--muted)' }}>
                All
              </button>
              {days.map(d => (
                <button key={d} onClick={() => { setDateFilter(d); load(d); }}
                  className="text-xs px-2 py-1 border"
                  style={{ borderColor: 'var(--border)', background: dateFilter === d ? 'var(--text)' : 'transparent', color: dateFilter === d ? 'var(--bg)' : 'var(--muted)' }}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-5 animate-bounce"
                    style={{ background: 'rgba(255,255,255,0.3)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-5">
              <p className="text-sm" style={{ color: 'var(--bad)' }}>Error: {error}</p>
              <button onClick={() => load(dateFilter)} className="mt-2 text-xs px-3 py-1 border"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Retry</button>
            </div>
          )}

          {!loading && !error && shown.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Email</th>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Batch</th>
                  {isContest && <th style={{ textAlign: 'left', maxWidth: 140 }}>Contest</th>}
                  {isContest && <th>Status</th>}
                  {isContest && <th>MI</th>}
                  <th>{isContest ? 'Start' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((u, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left', fontSize: 11, fontFamily: 'monospace' }}>{u.email}</td>
                    <td style={{ textAlign: 'left', fontSize: 11 }}>{u.name || '—'}</td>
                    <td style={{ textAlign: 'left', fontSize: 10, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.batch}</td>
                    {isContest && (
                      <td style={{ textAlign: 'left', fontSize: 10, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.contestName || '—'}</td>
                    )}
                    {isContest && (
                      <td style={{ fontSize: 10, color: u.passed === 'Yes' || u.status === 'Good' ? 'var(--good)' : u.status === 'Needs Improvement' ? 'var(--bad)' : 'var(--muted)' }}>
                        {u.status || (u.passed === 'Yes' ? '✓' : '—')}
                      </td>
                    )}
                    {isContest && (
                      <td style={{ fontSize: 10, color: ['Strong Hire','Weak Hire'].includes(u.miStatus || '') ? 'var(--good)' : u.miStatus ? 'var(--bad)' : 'var(--muted)' }}>
                        {u.miStatus || '—'}
                      </td>
                    )}
                    <td className="num" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {isContest ? u.startDate : u.certDate || u.dsa || u.sql || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !error && shown.length === 0 && !loading && (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {users.length === 0 ? 'No records found.' : `No results matching "${search}"`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t flex items-center justify-between text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <span>{search ? `${shown.length} of ` : ''}{users.length.toLocaleString()} records{batchFilter ? ` · ${batchFilter}` : ''}{dateFilter ? ` · ${dateFilter}` : ''}</span>
          {shown.length > 500 && <span style={{ color: 'var(--warn)' }}>Showing first 500 — download CSV for full list</span>}
        </div>
      </div>
    </div>
  );
}
