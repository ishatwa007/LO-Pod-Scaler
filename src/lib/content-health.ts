// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassRow {
  program:         string;
  module:          string;
  classTitle:      string;
  classDate:       string;   // YYYY-MM-DD
  classTime:       string;   // HH:MM
  batches:         string;
  totalIssues:     number;
  notFound:        boolean;
  missingLV:       string;
  readMismatch:    string;
  assignMismatch:  string;
  hwMismatch:      string;
}

export type IssueCategory = 'clean' | 'not_found' | 'content';

export interface DaySummary {
  date:         string;      // YYYY-MM-DD
  dayLabel:     string;      // "Jun 10 (Tue)"
  total:        number;
  clean:        number;
  notFound:     number;
  contentIssues:number;
  rows:         ClassRow[];  // all rows for this day (for expansion)
}

export interface ContentHealthResult {
  days:    DaySummary[];
  summary: { total: number; clean: number; notFound: number; contentIssues: number };
  runDate: string;
}

type R = Record<string, string>;

// ── Date parser: "10 Jun 2026, 21:00" ─────────────────────────────────────────

const MONTHS: Record<string, string> = {
  Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
  Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
};

function parseClassDate(raw: string): { date: string; time: string } {
  const m = String(raw ?? '').match(/(\d+)\s+(\w{3})\s+(\d{4}),?\s*(\d{2}:\d{2})?/);
  if (!m) return { date: '', time: '' };
  const mo = MONTHS[m[2]] || '01';
  return {
    date: `${m[3]}-${mo}-${m[1].padStart(2,'0')}`,
    time: m[4] || '',
  };
}

function dayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

function classCategory(r: ClassRow): IssueCategory {
  if (r.totalIssues === 0) return 'clean';
  if (r.notFound)          return 'not_found';
  return 'content';
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeContentHealth(
  rawRows: R[],
  program: string
): ContentHealthResult {
  // Normalize program name for comparison
  const normProg = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const targetProg = normProg(program);

  // Find latest Run Date
  const runDates = rawRows
    .map(r => String(r['Run Date'] ?? ''))
    .filter(Boolean);
  const runDate = runDates.length ? runDates[0] : '';

  // Parse all rows for this program
  const rows: ClassRow[] = rawRows
    .filter(r => normProg(String(r['Program'] ?? '')) === targetProg)
    .map(r => {
      const { date, time } = parseClassDate(String(r['Class Date'] ?? ''));
      const ti = parseFloat(String(r['Total Issues'] ?? '0')) || 0;
      const nf = String(r['Not Found'] ?? '').toLowerCase().includes('not found');
      return {
        program:        String(r['Program']               ?? ''),
        module:         String(r['Module']                ?? ''),
        classTitle:     String(r['Class Title']           ?? ''),
        classDate:      date,
        classTime:      time,
        batches:        String(r['Scaler Batch Names']    ?? ''),
        totalIssues:    ti,
        notFound:       nf,
        missingLV:      String(r['Missing in LV Sheet']   ?? '').trim(),
        readMismatch:   String(r['Pre/Post-read Mismatch'] ?? '').trim(),
        assignMismatch: String(r['Assignment ID Mismatch'] ?? '').trim(),
        hwMismatch:     String(r['Homework ID Mismatch']   ?? '').trim(),
      };
    })
    .filter(r => r.classDate);

  // Group by date
  const byDate = new Map<string, ClassRow[]>();
  rows.forEach(r => {
    if (!byDate.has(r.classDate)) byDate.set(r.classDate, []);
    byDate.get(r.classDate)!.push(r);
  });

  const days: DaySummary[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateRows]) => {
      const clean   = dateRows.filter(r => classCategory(r) === 'clean').length;
      const notFnd  = dateRows.filter(r => classCategory(r) === 'not_found').length;
      const content = dateRows.filter(r => classCategory(r) === 'content').length;
      return {
        date,
        dayLabel: dayLabel(date),
        total:        dateRows.length,
        clean,
        notFound:     notFnd,
        contentIssues:content,
        rows:         dateRows.sort((a, b) => b.totalIssues - a.totalIssues),
      };
    });

  const summary = {
    total:         rows.length,
    clean:         rows.filter(r => classCategory(r) === 'clean').length,
    notFound:      rows.filter(r => classCategory(r) === 'not_found').length,
    contentIssues: rows.filter(r => classCategory(r) === 'content').length,
  };

  return { days, summary, runDate };
}
