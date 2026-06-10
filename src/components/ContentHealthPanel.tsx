'use client';
import { useState, useEffect } from 'react';
import type { ContentHealthResult, DaySummary, ClassRow } from '@/lib/content-health';

const PROGRAMS = ['Academy', 'DSML', 'DevOps', 'AIML'] as const;
type Program = typeof PROGRAMS[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Class detail card (expandable per class row) ──────────────────────────────

function ClassCard({ row }: { row: ClassRow }) {
  const [open, setOpen] = useState(false);
  const cat = row.totalIssues === 0 ? 'clean' : row.notFound ? 'not_found' : 'content';

  return (
    <div className="border-b last:border-0" style={{ borderColor: 'var(--border2)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-white/5 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="mt-0.5 text-xs flex-shrink-0" style={{
          color: cat === 'clean' ? 'var(--good)' : cat === 'not_found' ? '#fb923c' : '#f87171',
        }}>
          {cat === 'clean' ? '✓' : cat === 'not_found' ? '⚬' : '✕'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{row.classTitle}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>·</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{row.classTime}</span>
            {row.totalIssues > 0 && (
              <span className="text-xs px-1.5 py-0.5 border" style={{
                borderColor: cat === 'not_found' ? 'rgba(251,146,60,0.4)' : 'rgba(248,113,113,0.4)',
                color:       cat === 'not_found' ? '#fb923c' : '#f87171',
                background:  cat === 'not_found' ? 'rgba(251,146,60,0.05)' : 'rgba(248,113,113,0.05)',
              }}>
                {row.totalIssues} issue{row.totalIssues > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: 'var(--muted2)' }}>{row.module}</span>
          </div>
          {!open && row.batches && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted2)', maxWidth: 480 }}>
              {row.batches}
            </p>
          )}
        </div>
        <span style={{ color: 'var(--muted2)', fontSize: 10, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-10 pb-3 space-y-2">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            <span className="font-medium">Batches:</span> {row.batches || '—'}
          </p>
          {row.notFound && (
            <IssueBlock label="Not Found" text="Class not found in Go Live Tracker" color="#fb923c" />
          )}
          {row.missingLV && (
            <IssueBlock label="Missing in LV Sheet" text={row.missingLV} color="#f87171" />
          )}
          {row.readMismatch && (
            <IssueBlock label="Pre/Post-read Mismatch" text={row.readMismatch} color="#f87171" />
          )}
          {row.assignMismatch && (
            <IssueBlock label="Assignment ID Mismatch" text={row.assignMismatch} color="#f87171" />
          )}
          {row.hwMismatch && (
            <IssueBlock label="Homework ID Mismatch" text={row.hwMismatch} color="#f87171" />
          )}
          {row.totalIssues === 0 && (
            <p className="text-xs" style={{ color: 'var(--good)' }}>✓ No issues</p>
          )}
        </div>
      )}
    </div>
  );
}

function IssueBlock({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div className="text-xs border-l-2 pl-2 space-y-0.5" style={{ borderColor: color }}>
      <p className="font-medium" style={{ color }}>{label}</p>
      <p style={{ color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  );
}

// ── Day accordion row ─────────────────────────────────────────────────────────

function DayRow({ day }: { day: DaySummary }) {
  const [open,     setOpen]     = useState(false);
  const [filter,   setFilter]   = useState<'all' | 'content' | 'not_found' | 'clean'>('content');

  const contentRows  = day.rows.filter(r => !r.notFound && r.totalIssues > 0);
  const notFoundRows = day.rows.filter(r => r.notFound);
  const cleanRows    = day.rows.filter(r => r.totalIssues === 0);

  const displayRows = filter === 'all' ? day.rows
    : filter === 'content'  ? contentRows
    : filter === 'not_found' ? notFoundRows
    : cleanRows;

  const hasIssues = day.contentIssues > 0 || day.notFound > 0;

  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      {/* Day header row */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="text-sm font-medium w-28 shrink-0" style={{ color: 'var(--text)' }}>
          {day.dayLabel}
        </span>
        <span className="text-xs w-16 shrink-0 text-right" style={{ color: 'var(--muted)' }}>
          {day.total} classes
        </span>
        <div className="flex items-center gap-3 flex-1">
          {/* MECE pill breakdown */}
          {day.clean > 0 && (
            <span className="text-xs px-2 py-0.5 border" style={{ borderColor: 'rgba(74,222,128,0.3)', color: 'var(--good)', background: 'rgba(74,222,128,0.05)' }}>
              ✓ {day.clean} clean
            </span>
          )}
          {day.notFound > 0 && (
            <span className="text-xs px-2 py-0.5 border" style={{ borderColor: 'rgba(251,146,60,0.4)', color: '#fb923c', background: 'rgba(251,146,60,0.05)' }}>
              ⚬ {day.notFound} not in GLT
            </span>
          )}
          {day.contentIssues > 0 && (
            <span className="text-xs px-2 py-0.5 border" style={{ borderColor: 'rgba(248,113,113,0.4)', color: '#f87171', background: 'rgba(248,113,113,0.05)' }}>
              ✕ {day.contentIssues} content issues
            </span>
          )}
        </div>
        <span style={{ color: 'var(--muted2)', fontSize: 11, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ background: 'rgba(0,0,0,0.15)' }}>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            {([
              ['content',  `Content Issues (${day.contentIssues})`,  '#f87171'],
              ['not_found',`Not in GLT (${day.notFound})`,           '#fb923c'],
              ['clean',    `Clean (${day.clean})`,                   'var(--good)'],
              ['all',      `All (${day.total})`,                     'var(--muted)'],
            ] as const).map(([f, label, col]) => (
              <button key={f} onClick={() => setFilter(f as typeof filter)}
                className="text-xs px-3 py-1 border transition-colors"
                style={{
                  borderColor: filter === f ? col : 'var(--border)',
                  color:       filter === f ? col : 'var(--muted2)',
                  background:  filter === f ? `${col}10` : 'transparent',
                  cursor: 'pointer',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Classes */}
          <div>
            {displayRows.length === 0 ? (
              <p className="px-10 py-3 text-xs" style={{ color: 'var(--muted)' }}>No classes in this filter.</p>
            ) : (
              displayRows.map((row, i) => <ClassCard key={i} row={row} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ContentHealthPanel() {
  const [program, setProgram]   = useState<Program>('Academy');
  const [data,    setData]      = useState<ContentHealthResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');

  useEffect(() => {
    setLoading(true); setError(''); setData(null);
    fetch(`/api/content-health?program=${encodeURIComponent(program)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [program]);

  return (
    <div>
      {/* Program tabs */}
      <div className="flex items-center gap-2 mb-4">
        {PROGRAMS.map(p => (
          <button key={p} onClick={() => setProgram(p)}
            className="text-xs px-3 py-1.5 border transition-colors"
            style={{
              borderColor: program === p ? 'var(--text)' : 'var(--border)',
              background:  program === p ? 'var(--text)' : 'transparent',
              color:       program === p ? 'var(--bg)'   : 'var(--muted)',
            }}>
            {p === 'DevOps' ? 'DevOps' : p}
          </button>
        ))}
        {data?.runDate && (
          <span className="ml-auto text-xs" style={{ color: 'var(--muted2)' }}>
            Last run: {data.runDate}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex gap-1.5">{[0,1,2].map(i => (
            <div key={i} className="w-2 h-8 animate-bounce"
              style={{ background:'rgba(255,255,255,0.2)', animationDelay:`${i*0.15}s` }} />
          ))}</div>
        </div>
      )}

      {error && (
        <div className="border p-4" style={{ borderColor:'rgba(248,113,113,0.3)', background:'rgba(248,113,113,0.05)' }}>
          <p className="text-sm" style={{ color:'#f87171' }}>{error}</p>
          <p className="text-xs mt-1" style={{ color:'var(--muted)' }}>
            Ensure LO_CONTENT_ISSUES_SHEET_ID is set in environment variables.
          </p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {([
              ['Total Classes',   data.summary.total,         'var(--text)',  ''],
              ['Clean',           data.summary.clean,         'var(--good)',  '✓'],
              ['Not in GLT',      data.summary.notFound,      '#fb923c',      '⚬'],
              ['Content Issues',  data.summary.contentIssues, '#f87171',      '✕'],
            ] as const).map(([label, val, color, icon]) => (
              <div key={label} className="border p-3" style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
                <p className="text-xs mb-1" style={{ color:'var(--muted)' }}>{icon && <span className="mr-1">{icon}</span>}{label}</p>
                <p className="text-2xl font-medium" style={{ color, letterSpacing:'-0.03em' }}>{val}</p>
              </div>
            ))}
          </div>

          {/* MECE legend */}
          <div className="flex items-center gap-4 mb-3 px-1">
            <span className="text-xs" style={{ color:'var(--muted2)' }}>
              <span style={{ color:'var(--good)' }}>✓ Clean</span> = No issues
            </span>
            <span className="text-xs" style={{ color:'var(--muted2)' }}>
              <span style={{ color:'#fb923c' }}>⚬ Not in GLT</span> = Class missing from Go Live Tracker
            </span>
            <span className="text-xs" style={{ color:'var(--muted2)' }}>
              <span style={{ color:'#f87171' }}>✕ Content Issues</span> = Found in GLT but has content problems
            </span>
          </div>

          {/* Day-by-day accordion */}
          <div className="border" style={{ borderColor:'var(--border)', background:'var(--surface)' }}>
            {data.days.length === 0 ? (
              <p className="p-8 text-sm text-center" style={{ color:'var(--muted)' }}>No data for {program}.</p>
            ) : (
              data.days.map(day => <DayRow key={day.date} day={day} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
