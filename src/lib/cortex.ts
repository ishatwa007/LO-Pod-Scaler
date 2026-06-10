import { parseDate } from './metrics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FunnelRow {
  course:  string;
  buckets: Record<string, number>; // '0','1-10','11-25','26-50','51-75','76-99','100','Total'
}

export interface CortexDayPoint   { date:  string; value: number | null }
export interface CortexWeekPoint  { week:  string; weekStart: string; weekEnd: string; value: number | null }

export interface CortexCourseRow {
  course:   string;
  days:     CortexDayPoint[];
  weeks:    CortexWeekPoint[];
  days30:   CortexDayPoint[];
  latestDay:  number | null;
  latestWeek: number | null;
}

export interface CortexMetrics {
  funnelRows:   FunnelRow[];
  funnelBuckets: string[];
  visits:       CortexCourseRow[];
  completions:  CortexCourseRow[];
  days:         string[];
  weeks:        { week: string; weekStart: string; weekEnd: string }[];
}

type R = Record<string, string>;

// ── Date helpers ──────────────────────────────────────────────────────────────

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

function getLast8Weeks(): { week: string; weekStart: string; weekEnd: string }[] {
  const result: { week: string; weekStart: string; weekEnd: string }[] = [];
  const now = new Date();
  // Go to most recent Monday
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  for (let i = 7; i >= 0; i--) {
    const ws = new Date(monday);
    ws.setDate(monday.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const wsStr = ws.toISOString().slice(0, 10);
    const weStr = we.toISOString().slice(0, 10);
    // Week label: W{n} YYYY
    const weekNum = (() => {
      const d = new Date(ws);
      d.setHours(12); // avoid DST issues
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
      const year = d.getFullYear();
      const firstThurs = new Date(year, 0, 4);
      firstThurs.setDate(firstThurs.getDate() - ((firstThurs.getDay() + 6) % 7) + 3);
      const week = Math.round((d.getTime() - firstThurs.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
      return `W${week} ${year}`;
    })();
    result.push({ week: weekNum, weekStart: wsStr, weekEnd: weStr });
  }
  return result;
}

// ── Funnel table parser ───────────────────────────────────────────────────────
// Handles the "% Course Completed Funnel" sheet which has a complex layout.
// We look for the "Overall" section header and extract rows below it.

const BUCKET_LABELS = ['0', '1-10', '11-25', '26-50', '51-75', '76-99', '100', 'Total Learners'];

function normBucket(raw: string): string {
  if (!raw) return raw;
  const s = raw.trim();
  // "1-10" comes through as a date in Excel; detect and fix
  const asDate = s.match(/^(\d{4})-0?1-(\d{2})/); // 2026-01-10 → "1-10"
  if (asDate) return `1-${asDate[2]}`;
  const asDate2 = s.match(/^(\d{4})-11-(\d{2})/); // 2026-11-25 → "11-25"
  if (asDate2) return `11-${asDate2[2]}`;
  return s;
}

export function parseFunnelTable(rows: string[][]): { funnelRows: FunnelRow[]; buckets: string[] } {
  // Find the "Overall" header row
  let headerRow = -1;
  let dataStart = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hasOverall  = row.some(v => String(v).trim() === 'Overall');
    const hasCourseTit = row.some(v => String(v).trim() === 'Course Title');
    if (hasOverall && headerRow < 0) { headerRow = i; }
    if (hasCourseTit && headerRow >= 0 && dataStart < 0) { dataStart = i; }
    if (dataStart >= 0) break;
  }

  if (dataStart < 0) {
    // Fallback: try rows 2-8 as per known structure from xlsx analysis
    headerRow = 1; dataStart = 2;
  }

  // Find the bucket header row (one before data start or same as headerRow+1)
  // Buckets are in the row between "Overall" header and data rows
  const bucketRow   = rows[dataStart] ?? [];
  // Col index where course title is
  const titleColIdx = bucketRow.findIndex(v => String(v).trim() === 'Course Title');
  const courseTitleCol = titleColIdx >= 0 ? titleColIdx : 3;
  // Bucket values start one column after course title
  const bucketStartCol = courseTitleCol + 1;

  // The actual bucket labels from the header row before data
  const headerForBuckets = rows[headerRow + 1] ?? [];
  const resolvedBuckets: string[] = BUCKET_LABELS; // use known labels

  // Parse data rows (skip "Course Title" label row itself)
  const funnelRows: FunnelRow[] = [];
  const nextSectionKeywords = ['Contest + Text', 'Video', '% Course Completed % Learners'];

  for (let i = dataStart + 1; i < rows.length; i++) {
    const row = rows[i];
    const courseVal = String(row[courseTitleCol + 1] ?? '').trim(); // course name is one after "Course Title" label
    if (!courseVal || nextSectionKeywords.some(k => String(row[bucketStartCol] ?? '').includes(k))) break;
    if (courseVal === '!!!!!' || courseVal.startsWith('!!!')) continue;

    const buckets: Record<string, number> = {};
    BUCKET_LABELS.forEach((label, idx) => {
      const raw = String(row[bucketStartCol + idx] ?? '').trim();
      buckets[label] = parseFloat(raw) || 0;
    });
    funnelRows.push({ course: courseVal, buckets });
  }

  return { funnelRows, buckets: resolvedBuckets };
}

// ── DoD / WoW builders ────────────────────────────────────────────────────────

export function buildCortexMetrics(
  dodVisits:     R[],
  wowVisits:     R[],
  dodCompletion: R[],
  wowCompletion: R[],
  courses:       string[]
): Pick<CortexMetrics, 'visits' | 'completions' | 'days' | 'weeks'> {
  const days  = getLast7Days();
  const days30= getLast30Days();
  const weeks = getLast8Weeks();

  function buildRows(dodRows: R[], wowRows: R[]): CortexCourseRow[] {
    return courses.map(course => {
      // DoD
      const dodByCourse = dodRows.filter(r => String(r['course_title'] ?? '').trim() === course);
      const dodByDate   = new Map<string, number>();
      dodByCourse.forEach(r => {
        const d = parseDate(r['date']).slice(0, 10);
        if (d) dodByDate.set(d, (dodByDate.get(d) || 0) + (parseFloat(r['unique_users'] ?? '0') || 0));
      });

      // WoW
      const wowByCourse = wowRows.filter(r => String(r['course_title'] ?? '').trim() === course);
      const wowByWeek   = new Map<string, number>();
      wowByCourse.forEach(r => {
        const ws = parseDate(r['week_start']).slice(0, 10);
        if (ws) wowByWeek.set(ws, (wowByWeek.get(ws) || 0) + (parseFloat(r['unique_users'] ?? '0') || 0));
      });

      const latest7 = Array.from(dodByDate.entries())
        .filter(([d]) => days.includes(d))
        .sort((a, b) => b[0].localeCompare(a[0]));
      const latestWeekEntry = weeks.length ? wowByWeek.get(weeks[weeks.length - 1].weekStart) ?? null : null;

      return {
        course,
        days:     days.map(d  => ({ date: d,  value: dodByDate.get(d) ?? null })),
        days30:   days30.map(d => ({ date: d,  value: dodByDate.get(d) ?? null })),
        weeks:    weeks.map(w  => ({ week: w.week, weekStart: w.weekStart, weekEnd: w.weekEnd,
                              value: wowByWeek.get(w.weekStart) ?? null })),
        latestDay:  latest7.length ? latest7[0][1] : null,
        latestWeek: latestWeekEntry,
      };
    });
  }

  return {
    visits:      buildRows(dodVisits,     wowVisits),
    completions: buildRows(dodCompletion, wowCompletion),
    days,
    weeks,
  };
}
