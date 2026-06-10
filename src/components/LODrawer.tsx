'use client';
import { useState, useEffect, useCallback } from 'react';
import type { LOMetricRow } from '@/lib/lo-metrics';

interface Props {
  program:  string;
  row:      LOMetricRow;
  date?:    string;
  month?:   string;
  onClose:  () => void;
}

const COL_LABELS: Record<string, string> = {
  class_date: 'Date', Class_Date: 'Date', created_at: 'Created', live_attendance_date: 'Date',
  contest_start_time: 'Start', program: 'Program', Program: 'Program',
  module_name: 'Module', Module_Name: 'Module', class_topic: 'Topic', Class_Topic: 'Topic',
  instructor_name: 'Instructor', Instructor_Name: 'Instructor', name: 'Instructor',
  sb_names: 'Batches', Sb_Names: 'Batches', batches: 'Batches', email: 'Email',
  class_rating: 'Rating', Class_Rating: 'Rating', cue_card_rated: 'CC Rated',
  cue_card_rated_less_than_5: 'CC <5', live_pct: 'Live%',
  prev_class_live_attendance: 'Prev%', live_attendance_drop: 'Drop%',
  eligible_learners: 'Eligible', live_attended_learners: 'Attended',
  psp: 'PSP%', solved_problems_within_7: 'Solved', total_assignment_problems: 'Total',
  ticket_sub_status: 'Status Detail', ticket_status: 'Status', resolved_at: 'Resolved',
  resolved: 'Done', contest_name: 'Contest', contest_cutoff: 'Cutoff', seq_num: 'Seq',
  Total_Cue_Card: 'Total CC', Played_Cue_Card: 'Played', Played_Cue_Card_Pct: 'Adherence%',
  adherence: 'Adherence%', classes: 'Classes', played: 'Played CC', total: 'Total CC',
};

function colLabel(col: string) { return COL_LABELS[col] || col.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }

function csv(cols: string[], rows: Record<string,string | number>[], title: string) {
  const content = [cols.map(colLabel), ...rows.map(r => cols.map(c => `"${String(r[c]||'').replace(/"/g,'""')}"`))].map(r => r.join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content],{type:'text/csv'})); a.download=`${title.replace(/\s+/g,'-')}.csv`; a.click();
}

export function LODrawer({ program, row, date, month, onClose }: Props) {
  const [data,    setData]    = useState<{ rows: Record<string, string | number>[]; total: number; columns: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ program, tab: row.drillTab! });
      if (date)  qs.set('date',  date);
      if (month) qs.set('month', month);
      const res = await fetch(`/api/lo/drill?${qs}`);
      const d   = await res.json();
      if (!res.ok) { setError(d.error || 'Error'); return; }
      setData(d);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [program, row.drillTab, date, month]);

  useEffect(() => { load(); }, [load]);

  const title  = `${program} — ${row.label}${date ? ` — ${date}` : month ? ` — ${month}` : ''}`;
  const cols   = data?.columns ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full flex flex-col border-l" style={{ width: 'min(700px,100vw)', background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{program}{date ? ` · ${date}` : month ? ` · ${month}` : ''}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text)' }}>{row.label}</p>
          </div>
          <div className="flex items-center gap-2">
            {data && data.rows.length > 0 && (
              <button onClick={() => csv(cols, data.rows, title)} className="text-xs px-3 py-1.5 border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none' }}>↓ CSV</button>
            )}
            <button onClick={onClose} className="text-base" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-1.5 h-6 animate-bounce" style={{background:'rgba(255,255,255,0.2)',animationDelay:`${i*0.15}s`}}/>)}</div>
            </div>
          )}
          {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
          {data && !loading && (
            <>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                {data.total} record{data.total !== 1 ? 's' : ''}{data.rows.length < data.total ? ` (showing ${data.rows.length})` : ''}
              </p>
              {data.rows.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No data for this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {cols.map(c => <th key={c} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{colLabel(c)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border2)' }}>
                          {cols.map(c => <td key={c} style={{ padding: '5px 8px', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r[c] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
