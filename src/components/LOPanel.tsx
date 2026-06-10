'use client';
import { useState, useCallback, useEffect } from 'react';
import type { LOMetricRow, LODayCount, LOMonthCount } from '@/lib/lo-metrics';
import type { I2RMetricRow, I2RDayPoint, I2RMonthPoint } from '@/lib/lo-i2r';
import { LODrawer } from './LODrawer';
import { NoteStar, NotesModal } from './NotesModal';
import { LineGraphModal } from './LineGraphModal';
import type { NoteRecord } from '@/types';

interface Props {
  program:     string;
  rows:        LOMetricRow[];
  days:        string[];
  months:      string[];
  view:        '7d' | 'mom';
  groupFilter: string;
  search:      string;
  author:      string;
  readOnly:    boolean;
  notes:       Record<string, NoteRecord>;
  onNotesSaved:(key: string, record: NoteRecord) => void;
  dateFrom?:   string;
  dateTo?:     string;
}

interface DrawerState { row: LOMetricRow; date?: string; month?: string }

const GROUP_LABELS: Record<string, string> = {
  nps:        'NPS & Curriculum',
  hiring:     'I2H & I2R',
  content_t7: 'Content Health (T+7)',
  lecture_d1: 'Lecture Performance (D-1)',
  cue_card:   'Cue Cards',
  psp:        'PSP',
  tickets:    'Support Tickets',
};
const GROUP_ORDER = ['nps','hiring','content_t7','lecture_d1','cue_card','psp','tickets'];

function fmtDay(d: string)   { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtMonth(m: string) { const [y,mo] = m.split('-'); return new Date(+y,+mo-1).toLocaleDateString('en-US',{ month:'short', year:'2-digit' }); }
function fmtVal(v: number | null, isRate: boolean): string {
  if (v === null || isNaN(v)) return '—';
  if (isRate) return v % 1 === 0 ? `${v}` : v.toFixed(2);
  return v.toLocaleString();
}

// ── I2R Drill-down Drawer ─────────────────────────────────────────────────────
function I2RDrawer({ program, row, col, view, onClose }: {
  program: string; row: I2RMetricRow; col: string; view: '7d'|'mom'; onClose: () => void;
}) {
  const [data,    setData]    = useState<{ rows: Record<string,string>[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams({ program, drill: row.id });
    if (view === '7d') qs.set('date', col); else qs.set('month', col);
    fetch(`/api/lo/i2r?${qs}`).then(r=>r.json()).then(d=>setData(d)).catch(()=>{}).finally(()=>setLoading(false));
  }, [program, row.id, col, view]);

  const cols = ['name','company','role','module','status','round','date'];
  const hdrs = ['Name','Company','Role','Module','Status','Round','Date of Call'];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background:'rgba(0,0,0,0.45)' }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="h-full flex flex-col border-l" style={{ width:'min(680px,100vw)', background:'var(--surface)', borderColor:'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor:'var(--border)' }}>
          <div>
            <p className="text-xs" style={{ color:'var(--muted)' }}>{program} · {col} · 60-day window</p>
            <p className="text-sm font-medium mt-0.5" style={{ color:'var(--text)' }}>{row.label}</p>
          </div>
          <button onClick={onClose} style={{ color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading && <div style={{ color:'var(--muted)', fontSize:12 }}>Loading…</div>}
          {data && !loading && (
            <>
              <p className="text-xs mb-3" style={{ color:'var(--muted)' }}>{data.total} interview records in 60-day window</p>
              <div className="overflow-x-auto">
                <table style={{ fontSize:11, width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      {hdrs.map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left', fontWeight:500, color:'var(--muted)', whiteSpace:'nowrap' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid var(--border2)' }}>
                        {cols.map(col=><td key={col} style={{ padding:'5px 8px', color: col==='status' && r[col]==='Rejected' ? '#f87171' : 'var(--text)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r[col]||''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function LOPanel({ program, rows, days, months, view, groupFilter, search, author, readOnly, notes, onNotesSaved, dateFrom, dateTo }: Props) {
  const [drawer,     setDrawer]     = useState<DrawerState | null>(null);
  const [i2rRows,    setI2rRows]    = useState<I2RMetricRow[]>([]);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState('');
  const [i2rLoading, setI2rLoading] = useState(false);
  const [i2rError,   setI2rError]   = useState('');
  const [i2rDrill,   setI2rDrill]   = useState<{ row: I2RMetricRow; col: string } | null>(null);
  const [noteState,  setNoteState]  = useState<{ row: LOMetricRow; col: string } | null>(null);
  const [graphState, setGraphState] = useState<LOMetricRow | null>(null);

  const cols = view === '7d' ? days : months;

  // ── CSV download ────────────────────────────────────────────────────────────
  function downloadCSV() {
    const colHeaders = cols.map(c => view === '7d' ? fmtDay(c) : fmtMonth(c));
    const header = ['Group', 'Metric', 'Latest', ...colHeaders].join(',');

    const dataRows = sorted.map(row => {
      const valMap: Record<string, number | null> = {};
      if (view === '7d') row.days.forEach((d: LODayCount) => { valMap[d.date] = d.value; });
      else               row.months.forEach((m: LOMonthCount) => { valMap[m.month] = m.value; });

      const latest = fmtVal(row.latest, row.isRate);
      const vals   = cols.map(col => {
        const v = valMap[col];
        return v === null ? '' : String(v);
      });
      const grpLabel = GROUP_LABELS[row.group] ?? row.group;
      const safeLabel = `"${row.label.replace(/"/g, '""')}"`;
      const safeGroup = `"${grpLabel.replace(/"/g, '""')}"`;
      return [safeGroup, safeLabel, latest, ...vals].join(',');
    });

    // Add I2R rows if loaded
    const i2rCsvRows = i2rRows.map((row: I2RMetricRow) => {
      const valMap: Record<string, number | null> = {};
      if (view === '7d') row.days.forEach(d => { valMap[d.date] = d.value; });
      else               row.months.forEach(m => { valMap[m.month] = m.value; });
      const latest = row.latest !== null ? `${row.latest}%` : '';
      const vals   = cols.map(col => { const v = valMap[col]; return v === null ? '' : `${v}%`; });
      return ['"I2R by Module"', `"${row.label}"`, latest, ...vals].join(',');
    });

    const csv = [header, ...dataRows, ...i2rCsvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `LO_Ops_${program}_${view === '7d' ? 'DoD' : 'MoM'}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Backfill to Google Sheet ─────────────────────────────────────────────
  async function runBackfill() {
    setBackfilling(true); setBackfillMsg('');
    try {
      const res = await fetch('/api/lo/backfill', { method: 'POST' });
      const d   = await res.json();
      if (!res.ok) { setBackfillMsg('Error: ' + (d.error || 'Unknown error')); return; }
      const totalDates = d.results.reduce((sum: number, r: { newDates: number }) => sum + r.newDates, 0);
      setBackfillMsg(`✓ Added ${totalDates} new date column(s) across ${d.results.length} tabs → `
        + `<a href="${d.sheetUrl}" target="_blank" style="color:var(--good);text-decoration:underline">Open Sheet ↗</a>`);
    } catch (e) { setBackfillMsg('Error: ' + String(e)); }
    finally { setBackfilling(false); }
  }

  // Fetch I2R data when I2R group is visible
  useEffect(() => {
    if (groupFilter !== 'i2r_module' && groupFilter !== 'All') return;
    setI2rLoading(true);
    const qs = new URLSearchParams({ program });
    if (dateFrom && dateTo) { qs.set('from', dateFrom); qs.set('to', dateTo); }
    fetch(`/api/lo/i2r?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setI2rError(d.error); setI2rRows([]); }
        else if (d.rows) { setI2rRows(d.rows); setI2rError(''); }
        else { setI2rError('Unexpected API response'); }
      })
      .catch(e => setI2rError(String(e)))
      .finally(() => setI2rLoading(false));
  }, [program, groupFilter, dateFrom, dateTo]);

  const visible = rows.filter(row => {
    if (groupFilter !== 'All' && row.group !== groupFilter) return false;
    if (search) return row.label.toLowerCase().includes(search.toLowerCase());
    return true;
  });
  const sorted = [...visible].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));

  const openDrawer = useCallback((row: LOMetricRow, col: string) => {
    if (!row.drillable || !row.drillTab) return;
    if (view === '7d') setDrawer({ row, date: col });
    else setDrawer({ row, month: col });
  }, [view]);

  let lastGroup = '';
  const colSpan = cols.length + 4;

  return (
    <>
      <div className="border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {/* Download button */}
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          {/* Backfill status */}
          <div className="text-xs" style={{ color: backfillMsg.includes('Error') ? '#f87171' : 'var(--good)' }}
            dangerouslySetInnerHTML={{ __html: backfillMsg }} />
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button onClick={runBackfill} disabled={backfilling}
                className="text-xs px-3 py-1.5 border flex items-center gap-1.5 transition-opacity hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none', cursor: backfilling ? 'wait' : 'pointer', opacity: backfilling ? 0.5 : 1 }}>
                {backfilling ? '⟳ Writing…' : '↑ Backfill to Sheet'}
              </button>
            )}
            <button onClick={downloadCSV}
              className="text-xs px-3 py-1.5 border flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'none', cursor: 'pointer' }}>
              ↓ Download CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', minWidth: 240, fontWeight: 500, color: 'var(--muted)', fontSize: 11 }}>Metric</th>
                <th style={{ padding: '8px 8px', minWidth: 70, fontWeight: 500, color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>Latest</th>
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
              {sorted.length === 0 && (
                <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>No metrics match filter.</td></tr>
              )}
              {sorted.map(row => {
                const grpLabel = GROUP_LABELS[row.group] ?? row.group;
                const showGrp  = grpLabel !== lastGroup;
                if (showGrp) lastGroup = grpLabel;

                const valMap: Record<string, number | null> = {};
                if (view === '7d') row.days.forEach((d: LODayCount) => { valMap[d.date] = d.value; });
                else               row.months.forEach((m: LOMonthCount) => { valMap[m.month] = m.value; });

                const canDrill = row.drillable && !!row.drillTab;

                return (
                  <>
                    {showGrp && (
                      <tr key={`grp-${row.group}`} style={{ background: 'rgba(255,255,255,0.015)' }}>
                        <td colSpan={colSpan} style={{ padding: '6px 12px', fontSize: 10, fontWeight: 600, color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', borderTop: '1px solid var(--border)' }}>
                          {grpLabel}
                        </td>
                      </tr>
                    )}
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border2)' }}
                      className={canDrill ? 'hover:bg-white/5 cursor-pointer' : undefined}>
                      <td style={{ padding: '7px 12px', color: 'var(--text)' }}>{row.label}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtVal(row.latest, row.isRate)}
                      </td>
                      {cols.map(col => {
                        const v = valMap[col];
                        const noteKey = `${program}:${row.id}:${col}`;
                        const hasNote = !!notes[noteKey];
                        return (
                          <td key={col} style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div className="flex items-center justify-end gap-1">
                              <span
                                style={{ color: v === null ? 'var(--muted2)' : 'var(--text)', cursor: canDrill ? 'pointer' : 'default' }}
                                onClick={canDrill ? () => openDrawer(row, col) : undefined}>
                                {fmtVal(v, row.isRate)}
                              </span>
                              <NoteStar hasNote={hasNote} onClick={e => { e.stopPropagation(); setNoteState({ row, col }); }} />
                            </div>
                          </td>
                        );
                      })}
                      {/* Graph button */}
                      <td style={{ padding: '4px 4px' }}>
                        <button title="Show graph"
                          onClick={() => setGraphState(row)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--muted2)', fontSize: 11, opacity: 0.6 }}
                          className="hover:opacity-100">
                          ↗
                        </button>
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

      {/* I2R by Module section */}
      {(groupFilter === 'i2r_module' || groupFilter === 'All') && (
        <div className="border mt-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="overflow-x-auto">
            <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign:'left', padding:'8px 12px', minWidth:240, fontWeight:500, color:'var(--muted)', fontSize:11 }}>Metric</th>
                  <th style={{ padding:'8px 8px', minWidth:70, fontWeight:500, color:'var(--muted)', fontSize:11, textAlign:'right' }}>Latest</th>
                  {cols.map(c => (
                    <th key={c} style={{ padding:'8px 8px', minWidth:64, fontWeight:500, color:'var(--muted)', fontSize:11, textAlign:'right' }}>
                      {view === '7d' ? fmtDay(c) : fmtMonth(c)}
                    </th>
                  ))}
                  <th style={{ width:24 }} />
                </tr>
              </thead>
              <tbody>
                <tr style={{ background:'rgba(255,255,255,0.015)' }}>
                  <td colSpan={cols.length + 3} style={{ padding:'6px 12px', fontSize:10, fontWeight:600, color:'var(--muted2)', letterSpacing:'0.08em', textTransform:'uppercase', borderTop:'1px solid var(--border)' }}>
                    I2R by Module (60-day rolling %)
                  </td>
                </tr>
                {i2rLoading && (
                  <tr><td colSpan={cols.length + 3} style={{ padding:'16px 12px', color:'var(--muted)', fontSize:11 }}>Loading I2R data…</td></tr>
                )}
                {!i2rLoading && i2rError && (
                  <tr><td colSpan={cols.length + 3} style={{ padding:'10px 16px', fontSize:11 }}>
                    <span style={{ color:'#f87171' }}>⚠ {i2rError}</span>
                    {i2rError.includes('not configured') && <span style={{ color:'var(--muted)', marginLeft:8 }}>→ Add <strong>INTERVIEW_SHEET_ID</strong> to Vercel env vars, then redeploy</span>}
                    {(i2rError.includes('403') || i2rError.includes('permission') || i2rError.includes('access')) && <span style={{ color:'var(--muted)', marginLeft:8 }}>→ Share the Interview Experience sheet with <strong>scaler-reader@scaler-dashboard.iam.gserviceaccount.com</strong> as Viewer</span>}
                  </td></tr>
                )}
                {!i2rLoading && !i2rError && i2rRows.length === 0 && (
                  <tr><td colSpan={cols.length + 3} style={{ padding:'16px 12px', color:'var(--muted)', fontSize:11 }}>
                    No I2R data returned. Check INTERVIEW_SHEET_ID env var and sheet sharing.
                  </td></tr>
                )}
                {!i2rLoading && i2rRows.map((row: I2RMetricRow) => {
                  const valMap: Record<string, { v: number | null; rejected: number; total: number }> = {};
                  if (view === '7d') (row.days as I2RDayPoint[]).forEach(d => { valMap[d.date] = { v: d.value, rejected: d.rejected, total: d.total }; });
                  else (row.months as I2RMonthPoint[]).forEach(m => { valMap[m.month] = { v: m.value, rejected: m.rejected, total: m.total }; });
                  return (
                    <tr key={row.id} style={{ borderBottom:'1px solid var(--border2)' }}>
                      <td style={{ padding:'7px 12px', color:'var(--text)' }}>{row.label}</td>
                      <td style={{ padding:'7px 8px', textAlign:'right', color:'var(--muted)' }}>
                        {row.latest !== null ? `${row.latest}%` : '—'}
                      </td>
                      {cols.map(col => {
                        const pt = valMap[col];
                        const v  = pt?.v ?? null;
                        const noteKey = `${program}:${row.id}:${col}`;
                        const hasNote = !!notes[noteKey];
                        return (
                          <td key={col} style={{ padding:'7px 8px', textAlign:'right' }}>
                            <div className="flex items-center justify-end gap-1">
                              <span
                                style={{ color: v === null ? 'var(--muted2)' : v > 70 ? '#f87171' : v > 50 ? '#fb923c' : 'var(--text)', cursor: row.drillable ? 'pointer' : 'default', fontVariantNumeric:'tabular-nums' }}
                                title={pt ? `${pt.rejected} rejected / ${pt.total} interviewed` : ''}
                                onClick={() => row.drillable ? setI2rDrill({ row, col }) : undefined}>
                                {v === null ? '—' : `${v}%`}
                              </span>
                              <NoteStar hasNote={hasNote} onClick={e => { e.stopPropagation(); setNoteState({ row: row as unknown as LOMetricRow, col }); }} />
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ padding:'4px 4px' }}>
                        <button title="Show graph" onClick={() => setGraphState(row as unknown as LOMetricRow)}
                          style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px', color:'var(--muted2)', fontSize:11, opacity:0.6 }}>↗</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* I2R Drill-down */}
      {i2rDrill && (
        <I2RDrawer program={program} row={i2rDrill.row} col={i2rDrill.col} view={view} onClose={() => setI2rDrill(null)} />
      )}

      {drawer && (
        <LODrawer
          program={program} row={drawer.row}
          date={drawer.date} month={drawer.month}
          onClose={() => setDrawer(null)}
        />
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
          days30={graphState.days30}
          months={graphState.months.map(m => ({ month: m.month, value: m.value }))}
          isRate={graphState.isRate}
          onClose={() => setGraphState(null)}
        />
      )}
    </>
  );
}
