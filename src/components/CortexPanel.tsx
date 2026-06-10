'use client';
import { useState, useEffect } from 'react';
import type { NoteRecord } from '@/types';
import { NoteStar, NotesModal } from './NotesModal';
import type { CortexMetrics, CortexCourseRow, CortexDayPoint, CortexWeekPoint } from '@/lib/cortex';
import { LineGraphModal } from './LineGraphModal';

type CortexView = 'dod' | 'wow';

interface Props {
  program:     string;
  author:      string;
  readOnly:    boolean;
  notes:       Record<string, NoteRecord>;
  onNotesSaved:(key: string, record: NoteRecord) => void;
}

const COURSE_LABEL: Record<string, string> = {
  'Data Structures and Algorithms Mastery': 'DSA Mastery',
  'Full Stack Interview Mastery':           'Full Stack',
  'DSA 7 days Crash Course':               'DSA 7-day',
  'Data Analytics':                        'Data Analytics',
  'DevOps Engineer Interview':             'DevOps Interview',
  'DevOps Fundamentals - Career Launch':   'DevOps Fundamentals',
};
function short(c: string) { return COURSE_LABEL[c] || c; }

function fmtDay(d: string)  { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtWeek(w: string) { return w; } // "W23 2026"

function fmtNum(v: number | null): string { return v === null || isNaN(v as number) ? '—' : v.toLocaleString(); }

export function CortexPanel({ program, author, readOnly, notes, onNotesSaved }: Props) {
  const [data,    setData]    = useState<CortexMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [view,    setView]    = useState<CortexView>('dod');
  const [graph,   setGraph]   = useState<{ label: string; row: CortexCourseRow } | null>(null);
  const [noteState, setNoteState] = useState<{ metricId: string; label: string; col: string } | null>(null);

  useEffect(() => {
    setLoading(true); setError(''); setData(null);
    fetch(`/api/cortex/metrics?program=${encodeURIComponent(program)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [program]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex gap-1.5">{[0,1,2].map(i => (
        <div key={i} className="w-2 h-8 animate-bounce"
          style={{ background:'rgba(255,255,255,0.2)', animationDelay:`${i*0.15}s` }} />
      ))}</div>
    </div>
  );

  if (error) return (
    <div className="border p-4" style={{ borderColor:'rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.05)' }}>
      <p className="text-sm" style={{ color:'#f87171' }}>{error}</p>
      <p className="text-xs mt-1" style={{ color:'var(--muted)' }}>Ensure CORTEX_SHEET_ID is set and the sheet is shared with the service account.</p>
    </div>
  );

  if (!data) return null;

  const cols     = view === 'dod' ? data.days : data.weeks.map(w => w.weekStart);
  const colLabel = (c: string) => view === 'dod' ? fmtDay(c) : fmtWeek(data.weeks.find(w => w.weekStart === c)?.week || c);

  function MetricTable({ rows, title, type }: { rows: CortexCourseRow[]; title: string; type: 'visits' | 'completions' }) {
    const metricPrefix = type;
    return (
      <div className="border" style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
        <div className="overflow-x-auto">
          <table style={{ fontSize:12, width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                <th colSpan={cols.length + 3}
                  style={{ padding:'6px 12px', textAlign:'left', fontSize:10, fontWeight:600, color:'var(--muted2)', letterSpacing:'0.08em', textTransform:'uppercase', background:'rgba(255,255,255,0.015)' }}>
                  {title}
                </th>
              </tr>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                <th style={{ textAlign:'left', padding:'8px 12px', minWidth:180, fontWeight:500, color:'var(--muted)', fontSize:11 }}>Course</th>
                <th style={{ padding:'8px 8px', minWidth:64, fontWeight:500, color:'var(--muted)', fontSize:11, textAlign:'right' }}>
                  {view === 'dod' ? 'Latest' : 'Latest Wk'}
                </th>
                {cols.map(c => (
                  <th key={c} style={{ padding:'8px 8px', minWidth:72, fontWeight:500, color:'var(--muted)', fontSize:11, textAlign:'right' }}>
                    {colLabel(c)}
                  </th>
                ))}
                <th style={{ width:24 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const valMap: Record<string, number | null> = {};
                if (view === 'dod') (row.days as CortexDayPoint[]).forEach(d => { valMap[d.date] = d.value; });
                else                (row.weeks as CortexWeekPoint[]).forEach(w => { valMap[w.weekStart] = w.value; });
                const latest = view === 'dod' ? row.latestDay : row.latestWeek;

                return (
                  <tr key={row.course} style={{ borderBottom:'1px solid var(--border2)' }}>
                    <td style={{ padding:'7px 12px', color:'var(--text)' }}>{short(row.course)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'var(--muted)', fontVariantNumeric:'tabular-nums' }}>
                      {fmtNum(latest)}
                    </td>
                    {cols.map(c => (
                      <td key={c} style={{ padding:'7px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                        <div className="flex items-center justify-end gap-1">
                          <span style={{ color: valMap[c] ? 'var(--text)' : 'var(--muted2)' }}>
                            {fmtNum(valMap[c] ?? null)}
                          </span>
                          <NoteStar
                            hasNote={!!notes[`Cortex:${program}:${metricPrefix}_${row.course.replace(/\s+/g,'_')}:${c}`]}
                            onClick={e => { e.stopPropagation(); setNoteState({ metricId: `${metricPrefix}_${row.course.replace(/\s+/g,'_')}`, label: `${title} — ${short(row.course)}`, col: c }); }}
                          />
                        </div>
                      </td>
                    ))}
                    <td style={{ padding:'4px 4px' }}>
                      <button title="Show graph" onClick={() => setGraph({ label: `${short(row.course)} — ${title}`, row })}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px', color:'var(--muted2)', fontSize:11, opacity:0.6 }}>
                        ↗
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        {(['dod','wow'] as CortexView[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="text-xs px-3 py-1.5 border"
            style={{ borderColor: view===v ? 'var(--text)' : 'var(--border)', background: view===v ? 'var(--text)' : 'transparent', color: view===v ? 'var(--bg)' : 'var(--muted)' }}>
            {v === 'dod' ? 'Day on Day' : 'Week on Week'}
          </button>
        ))}
        <span className="text-xs ml-2" style={{ color:'var(--muted)' }}>
          {view === 'dod' ? 'Last 7 days' : 'Last 8 weeks'}
        </span>
      </div>

      {/* % Course Completion table */}
      {data.funnelRows.length > 0 && (
        <div className="border" style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
          <div className="overflow-x-auto">
            <table style={{ fontSize:12, width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  <th colSpan={data.funnelBuckets.length + 1}
                    style={{ padding:'6px 12px', textAlign:'left', fontSize:10, fontWeight:600, color:'var(--muted2)', letterSpacing:'0.08em', textTransform:'uppercase', background:'rgba(255,255,255,0.015)' }}>
                    % Course Completion — Overall
                  </th>
                </tr>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  <th style={{ textAlign:'left', padding:'8px 12px', minWidth:200, fontWeight:500, color:'var(--muted)', fontSize:11 }}>Course</th>
                  {data.funnelBuckets.map(b => (
                    <th key={b} style={{ padding:'8px 8px', minWidth:60, fontWeight:500, color: b==='100' ? 'var(--good)' : b==='Total Learners' ? 'var(--text)' : 'var(--muted)', fontSize:11, textAlign:'right' }}>
                      {b === 'Total Learners' ? 'Total' : b + '%'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.funnelRows.map(row => (
                  <tr key={row.course} style={{ borderBottom:'1px solid var(--border2)' }}>
                    <td style={{ padding:'7px 12px', color:'var(--text)', fontWeight: program === 'Academy' && row.course === 'Data Structures and Algorithms Mastery' ? 600 : 400 }}>
                      {short(row.course)}
                    </td>
                    {data.funnelBuckets.map(b => (
                      <td key={b} style={{ padding:'7px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums',
                        color: b==='100' ? 'var(--good)' : b==='Total Learners' ? 'var(--text)' : 'var(--muted)',
                        fontWeight: b==='100' || b==='Total Learners' ? 600 : 400 }}>
                        {fmtNum(row.buckets[b] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visits & Completions tables */}
      <MetricTable rows={data.visits}      title="Page Visits"     type="visits" />
      <MetricTable rows={data.completions} title="Module Completions" type="completions" />

      {/* Notes modal */}
      {noteState && (
        <NotesModal
          program={`Cortex:${program}`}
          metricId={noteState.metricId}
          metricLabel={noteState.label}
          noteDate={noteState.col}
          author={author}
          readOnly={readOnly}
          existing={notes[`Cortex:${program}:${noteState.metricId}:${noteState.col}`] ?? null}
          onClose={() => setNoteState(null)}
          onSaved={(key, rec) => { onNotesSaved(key, rec); setNoteState(null); }}
        />
      )}

      {/* Line graph modal */}
      {graph && (
        <LineGraphModal
          label={graph.label}
          days30={graph.row.days30.map(d => ({ date: d.date, value: d.value }))}
          months={graph.row.weeks.map(w => ({ month: w.weekStart, value: w.value }))}
          isRate={false}
          onClose={() => setGraph(null)}
        />
      )}
    </div>
  );
}
