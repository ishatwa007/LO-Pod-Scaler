'use client';
import { useState, useCallback, useEffect } from 'react';
import type { MetricRow, DayCount, MonthCount } from '@/types';
import { UserDrawer } from './UserDrawer';
import { NoteStar, NotesModal } from './NotesModal';
import { LineGraphModal } from './LineGraphModal';
import type { NoteRecord } from '@/types';

interface Props {
  program:       string;
  rows:          MetricRow[];
  days:          string[];
  months:        string[];
  view:          '7d' | 'mom';
  learners:      number;
  moduleFilter:  string;
  search:        string;
  author:        string;
  readOnly:      boolean;
  notes:         Record<string, NoteRecord>;
  onNotesSaved:  (key: string, record: NoteRecord) => void;
}

interface DrawerState { row: MetricRow; date?: string; batchFilter?: string }
interface AIMockDrawer { row: MetricRow; date?: string; month?: string }

const GROUP_LABELS: Record<string, string> = {
  cert: 'Certification', dsa: 'DSA', sql: 'SQL',
  dsml_sql: 'DSML SQL', eda: 'EDA',
  linux: 'Linux', tools: 'DevOps Tools', aws: 'AWS',
};

function fmtDay(d: string)   { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtMonth(m: string) { const [y,mo]=m.split('-'); return new Date(+y,+mo-1).toLocaleDateString('en-US',{month:'short',year:'2-digit'}); }
function fmtCount(v: number): string { return v === 0 ? '—' : v.toLocaleString(); }

// Inline AI Mock Drawer
function AIMockDrawerPanel({ row, program, date, month, onClose }: { row: MetricRow; program: string; date?: string; month?: string; onClose: () => void }) {
  const [data, setData]       = useState<{ rows: Record<string,string>[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ program, metric: row.id });
      if (date)  qs.set('date',  date);
      if (month) qs.set('month', month);
      const res = await fetch(`/api/cert/ai-mock-drill?${qs}`);
      const d   = await res.json();
      if (!res.ok) { setError(d.error || 'Error'); return; }
      setData(d);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [program, row.id, date, month]);

  useEffect(() => { load(); }, [load]);

  const cols = ['name','email','batch','test_name','rating','result','date_time'];

  function csv() {
    if (!data) return;
    const content = [cols, ...data.rows.map(r => cols.map(c => `"${String(r[c]||'').replace(/"/g,'""')}"`))].map(r=>r.join(',')).join('\n');
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:'text/csv'})); a.download=`ai-mock-${program}-${date||month||'all'}.csv`; a.click();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full flex flex-col border-l" style={{ width: 'min(680px,100vw)', background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{program}{date?` · ${date}`:month?` · ${month}`:''}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text)' }}>{row.label}</p>
          </div>
          <div className="flex items-center gap-2">
            {data && data.rows.length > 0 && <button onClick={csv} className="text-xs px-3 py-1.5 border" style={{ borderColor:'var(--border)', color:'var(--muted)', background:'none' }}>↓ CSV</button>}
            <button onClick={onClose} style={{ color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading && <div className="flex justify-center py-16"><div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-1.5 h-6 animate-bounce" style={{background:'rgba(255,255,255,0.2)',animationDelay:`${i*0.15}s`}}/>)}</div></div>}
          {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
          {data && !loading && (
            <>
              <p className="text-xs mb-3" style={{ color:'var(--muted)' }}>{data.total} record{data.total!==1?'s':''}{data.rows.length<data.total?` (showing ${data.rows.length})`:''}</p>
              {data.rows.length === 0
                ? <p className="text-sm" style={{ color:'var(--muted)' }}>No data.</p>
                : <div className="overflow-x-auto">
                    <table style={{ fontSize:11, width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          {['Name','Email','Batch','Test','Rating','Result','Date/Time'].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left', fontWeight:500, color:'var(--muted)', whiteSpace:'nowrap' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((r,i)=>(
                          <tr key={i} style={{ borderBottom:'1px solid var(--border2)' }}>
                            {cols.map(c=><td key={c} style={{ padding:'5px 8px', color:'var(--text)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r[c]||''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProgramPanel({ program, rows, days, months, view, learners, moduleFilter, search, author, readOnly, notes, onNotesSaved }: Props) {
  const [drawer,     setDrawer]     = useState<DrawerState | null>(null);
  const [aiDrawer,   setAiDrawer]   = useState<AIMockDrawer | null>(null);
  const [noteState,  setNoteState]  = useState<{ row: MetricRow; col: string } | null>(null);
  const [graphState, setGraphState] = useState<MetricRow | null>(null);

  const cols = view === '7d' ? days : months;

  const visible = rows.filter(row => {
    if (moduleFilter && moduleFilter !== 'All' && row.group) {
      const g = row.group.toLowerCase();
      const f = moduleFilter.toLowerCase().replace(/\s+/g, '_').replace(/devops\s+/,'');
      if (!g.includes(f) && !f.includes(g)) return false;
    }
    if (search) return row.label.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  let lastGroup = '';
  const colSpan = cols.length + 4;

  return (
    <>
      <div className="flex items-center gap-4 px-1 pb-3 pt-1">
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Enrolled</span>
        <span className="font-display text-2xl font-medium" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>{learners.toLocaleString()}</span>
      </div>

      <div className="border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="overflow-x-auto">
          <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', minWidth: 240, fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>Metric</th>
                <th style={{ padding: '8px 8px', minWidth: 72, fontWeight: 500, color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>Total</th>
                {cols.map(c => (
                  <th key={c} style={{ padding: '8px 8px', minWidth: 64, fontWeight: 500, color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>
                    {view === '7d' ? fmtDay(c) : fmtMonth(c)}
                  </th>
                ))}
                <th style={{ width: 24 }} />
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>No metrics match filter.</td></tr>
              )}
              {visible.map(row => {
                const grpLabel = GROUP_LABELS[row.group ?? ''] ?? row.group ?? '';
                const showGrp  = grpLabel && grpLabel !== lastGroup;
                if (showGrp) lastGroup = grpLabel;

                const dayMap: Record<string, number> = {};
                if (view === '7d') (row.days as DayCount[]).forEach(d => { dayMap[d.date] = d.count; });
                else               (row.months as MonthCount[]).forEach(m => { dayMap[m.month] = m.count; });

                const canDrill  = !row.isStatic && !row.noDaily;
                const isAIMock  = row.id.includes('_mock_');

                return (
                  <>
                    {showGrp && (
                      <tr key={`grp-${grpLabel}`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                        <td colSpan={colSpan} style={{ padding: '6px 12px', fontSize: 10, fontWeight: 600, color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', borderTop: '1px solid var(--border)' }}>
                          {grpLabel}
                        </td>
                      </tr>
                    )}
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ padding: '7px 12px', color: 'var(--text)' }}>{row.label}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {canDrill && row.total > 0
                          ? <button onClick={() => isAIMock ? setAiDrawer({ row }) : setDrawer({ row })}
                              style={{ color: 'var(--text)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                              {row.total.toLocaleString()}
                            </button>
                          : <span style={{ color: row.total ? 'var(--text)' : 'var(--muted2)', fontVariantNumeric: 'tabular-nums' }}>{row.total.toLocaleString()}</span>
                        }
                      </td>
                      {cols.map(col => {
                        const v = dayMap[col] ?? 0;
                        const noteKey = `${program}:${row.id}:${col}`;
                        const hasNote = !!notes[noteKey];
                        return (
                          <td key={col} style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div className="flex items-center justify-end gap-1">
                              {canDrill && v > 0
                                ? <button
                                    onClick={() => isAIMock
                                      ? setAiDrawer({ row, ...(view === '7d' ? { date: col } : { month: col }) })
                                      : setDrawer({ row, date: view === '7d' ? col : undefined })}
                                    style={{ color: 'var(--text)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                                    {fmtCount(v)}
                                  </button>
                                : <span style={{ color: v > 0 ? 'var(--text)' : 'var(--muted2)' }}>{fmtCount(v)}</span>
                              }
                              <NoteStar hasNote={hasNote} onClick={e => { e.stopPropagation(); setNoteState({ row, col }); }} />
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding: '4px 4px' }}>
                        {!row.isStatic && (
                          <button title="Show graph" onClick={() => setGraphState(row)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--muted2)', fontSize: 11, opacity: 0.6 }}>
                            ↗
                          </button>
                        )}
                      </td>
                      <td />
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && (
        <UserDrawer open onClose={() => setDrawer(null)}
          program={program} metricId={drawer.row.id}
          label={drawer.row.label} total={drawer.row.total}
          days={days} initialDate={drawer.date} batchFilter={drawer.batchFilter} />
      )}

      {aiDrawer && (
        <AIMockDrawerPanel row={aiDrawer.row} program={program}
          date={aiDrawer.date} month={aiDrawer.month}
          onClose={() => setAiDrawer(null)} />
      )}

      {noteState && (
        <NotesModal
          program={program}
          metricId={noteState.row.id}
          metricLabel={noteState.row.label}
          noteDate={noteState.col}
          author={author}
          readOnly={readOnly}
          existing={notes[`${program}:${noteState.row.id}:${noteState.col}`] ?? null}
          onClose={() => setNoteState(null)}
          onSaved={(key, rec) => { onNotesSaved(key, rec); setNoteState(null); }}
        />
      )}

      {graphState && (
        <LineGraphModal
          label={`${program} — ${graphState.label}`}
          days30={(graphState.days as DayCount[]).map(d => ({ date: d.date, value: d.count }))}
          months={(graphState.months as MonthCount[]).map(m => ({ month: m.month, value: m.count }))}
          isRate={false}
          onClose={() => setGraphState(null)}
        />
      )}
    </>
  );
}
