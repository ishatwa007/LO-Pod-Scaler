import { DOD, SKILL_FILTERS } from './sheets-config';

// ── Date helpers ─────────────────────────────────────────────────────────────

export function parseDate(raw: string | number | undefined | null): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';

  // ISO: "2026-05-28" or "2026-05-28 0:00:00" or "2026-05-28T00:00:00" — primary format from FORMATTED_VALUE
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Serial number fallback (UNFORMATTED_VALUE)
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 100000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, a, b, yr] = slashMatch;
    const ai = parseInt(a), bi = parseInt(b);
    if (ai > 12) return `${yr}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
    if (bi > 12) return `${yr}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`;
    return `${yr}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
  }

  return '';
}

export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function getLast12Months(): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

// Returns every calendar date from fromDate to toDate inclusive
export function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to   + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates.slice(-90); // cap at 90 days to keep response size reasonable
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DayCount   { date: string;  count: number }
export interface MonthCount { month: string; count: number }
export interface BatchCount { batch: string; count: number }

export interface MetricRow {
  id:         string;
  label:      string;
  total:      number;
  days:       DayCount[];
  months:     MonthCount[];
  batches?:   BatchCount[];
  noDaily?:   boolean;
  isStatic?:  boolean;
  group?:     string;
  drillable?: boolean;
}

export interface ProgramMetrics { rows: MetricRow[]; learners: number }

export interface AllMetrics {
  academy: ProgramMetrics;
  dsml:    ProgramMetrics;
  devops:  ProgramMetrics;
  days:    string[];
  months:  string[];
}

// ── Sheet 4 helpers ───────────────────────────────────────────────────────────
// Daily CUMULATIVE: "as of day X, how many total have this date <= X"
function s4CumulByDay(
  rows:    Record<string, string>[],
  program: string,
  dateCol: string,
  days:    string[]
): DayCount[] {
  const dates = rows
    .filter(r => r['Program'] === program && r[dateCol] && String(r[dateCol]).trim())
    .map(r => parseDate(r[dateCol]).slice(0, 10))
    .filter(d => d.length === 10);

  return days.map(day => ({
    date:  day,
    count: dates.filter(d => d <= day).length,
  }));
}


// Daily DELTA: "how many new on exactly this day"
function s4DeltaByDay(
  rows:    Record<string, string>[],
  program: string,
  dateCol: string,
  days:    string[]
): DayCount[] {
  const map = new Map<string, number>();
  rows
    .filter(r => r['Program'] === program && r[dateCol] && String(r[dateCol]).trim())
    .forEach(r => {
      const d = parseDate(r[dateCol]).slice(0, 10);
      if (d.length === 10) map.set(d, (map.get(d) || 0) + 1);
    });
  return days.map(d => ({ date: d, count: map.get(d) || 0 }));
}

// Daily DELTA for cert started (using first MBE date per user)
function s4CertStartedDeltaByDay(
  rows:    Record<string, string>[],
  program: string,
  mbeCols: string[],
  days:    string[]
): DayCount[] {
  const map = new Map<string, number>();
  rows
    .filter(r => r['Program'] === program)
    .forEach(r => {
      const dates = mbeCols
        .map(c => parseDate(r[c]).slice(0, 10))
        .filter(d => d.length === 10);
      if (!dates.length) return;
      const first = dates.sort()[0];
      map.set(first, (map.get(first) || 0) + 1);
    });
  return days.map(d => ({ date: d, count: map.get(d) || 0 }));
}

// Monthly DELTA: "how many NEW in this month"
function s4MonthlyDelta(
  rows:    Record<string, string>[],
  program: string,
  dateCol: string,
  months:  string[]
): MonthCount[] {
  const map = new Map<string, number>();
  rows
    .filter(r => r['Program'] === program && r[dateCol] && String(r[dateCol]).trim())
    .forEach(r => {
      const m = parseDate(r[dateCol]).slice(0, 7);
      if (m) map.set(m, (map.get(m) || 0) + 1);
    });
  return months.map(m => ({ month: m, count: map.get(m) || 0 }));
}

// Count total rows in Sheet 4 for a program + col condition
function s4Count(
  rows:    Record<string, string>[],
  program: string,
  col:     string
): number {
  return rows.filter(r => r['Program'] === program && r[col] && String(r[col]).trim()).length;
}

// First cert start per user (min of MBE dates) → when they "started"
function s4CertStarted(
  rows:    Record<string, string>[],
  program: string,
  mbeCols: string[]
): number {
  return rows
    .filter(r => r['Program'] === program)
    .filter(r => mbeCols.some(c => r[c] && String(r[c]).trim()))
    .length;
}

function s4CertStartedCumulByDay(
  rows:    Record<string, string>[],
  program: string,
  mbeCols: string[],
  days:    string[]
): DayCount[] {
  const firstDates = rows
    .filter(r => r['Program'] === program)
    .map(r => {
      const dates = mbeCols
        .map(c => parseDate(r[c]).slice(0, 10))
        .filter(d => d.length === 10);
      return dates.length ? dates.sort()[0] : null;
    })
    .filter((d): d is string => d !== null);

  return days.map(day => ({
    date:  day,
    count: firstDates.filter(d => d <= day).length,
  }));
}

function s4CertStartedMonthlyDelta(
  rows:    Record<string, string>[],
  program: string,
  mbeCols: string[],
  months:  string[]
): MonthCount[] {
  const firstDates = rows
    .filter(r => r['Program'] === program)
    .map(r => {
      const dates = mbeCols
        .map(c => parseDate(r[c]).slice(0, 10))
        .filter(d => d.length === 10);
      return dates.length ? dates.sort()[0] : null;
    })
    .filter((d): d is string => d !== null);

  const map = new Map<string, number>();
  firstDates.forEach(d => {
    const m = d.slice(0, 7);
    map.set(m, (map.get(m) || 0) + 1);
  });
  return months.map(m => ({ month: m, count: map.get(m) || 0 }));
}

// ── DOD helpers ───────────────────────────────────────────────────────────────
// Cumulative running total as of each day (like reference screenshot)
function dodCumulByDay(
  dodRows: Record<string, string>[],
  col:     string,
  days:    string[]
): DayCount[] {
  return days.map(day => {
    let sum = 0;
    dodRows.forEach(r => {
      const d = parseDate(r['Date']).slice(0, 10);
      if (d && d <= day) sum += parseFloat(r[col]) || 0;
    });
    return { date: day, count: Math.round(sum) };
  });
}

// Monthly delta from MOM tab
function momDelta(
  momRows: Record<string, string>[],
  col:     string,
  months:  string[]
): MonthCount[] {
  const map = new Map<string, number>();
  momRows.forEach(r => {
    const m = parseDate(r['Date']).slice(0, 7);
    if (m) map.set(m, parseFloat(r[col]) || 0);
  });
  return months.map(m => ({ month: m, count: map.get(m) || 0 }));
}

// Current month total from MOM
function currentMonthMOM(momRows: Record<string, string>[], col: string): number {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const r = momRows.find(r => parseDate(r['Date']).startsWith(thisMonth));
  return parseFloat(r?.[col] ?? '0') || 0;
}

// DOD delta per day (daily new, not cumulative)
function dodDeltaByDay(
  dodRows: Record<string, string>[],
  col:     string,
  days:    string[]
): DayCount[] {
  const map = new Map<string, number>();
  dodRows.forEach(r => {
    const d = parseDate(r['Date']).slice(0, 10);
    if (d) map.set(d, parseFloat(r[col]) || 0);
  });
  return days.map(d => ({ date: d, count: map.get(d) || 0 }));
}

// ── Live Contests helpers ────────────────────────────────────────────────────

type LCRow = Record<string, string>;

function lcSkillRows(
  lcRows:       LCRow[],
  programPfx:   string,
  moduleFn:     (m: string) => boolean
): LCRow[] {
  return lcRows.filter(r =>
    String(r['Batch'] ?? '').startsWith(programPfx) &&
    moduleFn(String(r['Contest Module'] ?? ''))
  );
}


// Daily count by Contest Start Date (when batch was assigned the contest/mock window)
function lcDaysByStartDate(rows: LCRow[], days: string[]): DayCount[] {
  const map = new Map<string, number>();
  rows.forEach(r => {
    const d = parseDate(r['Contest Start Date']).slice(0, 10);
    if (d) map.set(d, (map.get(d) || 0) + 1);
  });
  return days.map(d => ({ date: d, count: map.get(d) || 0 }));
}

// Monthly count by Contest Start Date
function lcMonthlyByStartDate(rows: LCRow[], months: string[]): MonthCount[] {
  const map = new Map<string, number>();
  rows.forEach(r => {
    const m = parseDate(r['Contest Start Date']).slice(0, 7);
    if (m) map.set(m, (map.get(m) || 0) + 1);
  });
  return months.map(m => ({ month: m, count: map.get(m) || 0 }));
}

function lcBatches(rows: LCRow[]): BatchCount[] {
  const map = new Map<string, number>();
  rows.forEach(r => {
    const b = String(r['Batch'] ?? '');
    if (b) map.set(b, (map.get(b) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([batch, count]) => ({ batch, count }));
}

// ── OC lookup ────────────────────────────────────────────────────────────────

function ocVal(
  ocRows:  Record<string, string>[],
  program: string,
  prefix:  string
): number {
  const r = ocRows.find(r => r['Program'] === program && String(r['Skills']).startsWith(prefix));
  return parseInt(String(r?.['Learners'] ?? '0')) || 0;
}


// ── AI Mock helpers (Google Sheet source) ─────────────────────────────────────
type AIMockRow = Record<string, string>;

function amFilter(aiRows: AIMockRow[], prog: string, testRe?: RegExp): AIMockRow[] {
  const byProg = aiRows.filter(r => {
    const p = String(r['Program'] ?? '').toLowerCase().trim();
    if (prog === 'academy') return p === 'academy';
    if (prog === 'dsml')    return p === 'dsml';
    if (prog === 'devops')  return p === 'devops';
    if (prog === 'aiml')    return !p && String(r['Batch'] ?? '').startsWith('AIML');
    return false;
  });
  if (!testRe) return byProg;
  return byProg.filter(r => testRe.test(String(r['test name'] ?? '')));
}

function amAttempted(rows: AIMockRow[]): AIMockRow[] {
  return rows.filter(r => String(r['status'] ?? '') === 'completed');
}

function amCleared(rows: AIMockRow[]): AIMockRow[] {
  return rows.filter(r => {
    const rt = parseFloat(String(r['rating'] ?? ''));
    return rt === 7 || rt === 9;
  });
}

function amDaysDelta(rows: AIMockRow[], days: string[]): DayCount[] {
  const map = new Map<string, number>();
  rows.forEach(r => {
    const raw = String(r['date time'] ?? '');
    const d = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) map.set(d, (map.get(d) || 0) + 1);
  });
  return days.map(d => ({ date: d, count: map.get(d) || 0 }));
}

function amMonthsDelta(rows: AIMockRow[], months: string[]): MonthCount[] {
  const map = new Map<string, number>();
  rows.forEach(r => {
    const raw = String(r['date time'] ?? '');
    const m = raw.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) map.set(m, (map.get(m) || 0) + 1);
  });
  return months.map(m => ({ month: m, count: map.get(m) || 0 }));
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeMetrics(
  ocRows:     Record<string, string>[],
  dodRows:    Record<string, string>[],
  momRows:    Record<string, string>[],
  lcRows:     Record<string, string>[],
  s4Rows:     Record<string, string>[],
  aiMockRows: AIMockRow[] = [],
  fromDate    = '',
  toDate      = ''
): AllMetrics {
  const days   = (fromDate && toDate) ? getDateRange(fromDate, toDate) : getLast7Days();
  const months = getLast12Months();

  // ── ACADEMY ────────────────────────────────────────────────────────────────

  const ACAD_MBE_COLS = ['DSA MBE','Academy SQL MBE','JAVA MBE','Javascript MBE','Python MBE'];

  // Live Contests: DSA and SQL rows for Academy
  const lcAcadDSA = lcSkillRows(lcRows, 'Academy', SKILL_FILTERS.academy_dsa);
  const lcAcadSQL = lcSkillRows(lcRows, 'Academy', SKILL_FILTERS.academy_sql);

  const academyRows: MetricRow[] = [

    {
      id: 'cert_started', label: 'Cert Started', group: 'cert',
      total:  s4CertStarted(s4Rows, 'Academy', ACAD_MBE_COLS),
      days:   s4CertStartedDeltaByDay(s4Rows, 'Academy', ACAD_MBE_COLS, days),
      months: s4CertStartedMonthlyDelta(s4Rows, 'Academy', ACAD_MBE_COLS, months),
    },
    {
      id: 'cert_cleared',      label: 'Cleared (DSA + SQL)',            group: 'cert',
      total:  ocVal(ocRows, 'Academy', '4.'),
      days:   dodDeltaByDay(dodRows, DOD.ACADEMY_DSA_SQL, days),
      months: momDelta(momRows, DOD.ACADEMY_DSA_SQL, months),
    },
    {
      id: 'cert_cleared_full', label: 'Cleared Full (DSA + SQL + Lang)', group: 'cert',
      total:  ocVal(ocRows, 'Academy', '6.'),
      days:   dodDeltaByDay(dodRows, DOD.ACADEMY_FULL, days),
      months: momDelta(momRows, DOD.ACADEMY_FULL, months),
    },
    // DSA
    {
      id: 'dsa_contest_started', label: 'DSA Contest Started', group: 'dsa',
      total:   s4Count(s4Rows, 'Academy', 'DSA MBE'),
      days:    s4DeltaByDay(s4Rows, 'Academy', 'DSA MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'Academy', 'DSA MBE', months),
      batches: lcBatches(lcAcadDSA.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'dsa_contest_cleared', label: 'DSA Contest Cleared', group: 'dsa',
      total:   s4Count(s4Rows, 'Academy', 'DSA Contest'),
      days:    s4DeltaByDay(s4Rows, 'Academy', 'DSA Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'Academy', 'DSA Contest', months),
      batches: lcBatches(lcAcadDSA.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'dsa_mock_started', label: 'DSA AI Mock Attempted', group: 'dsa',
      total:   amAttempted(amFilter(aiMockRows, 'academy', /^dsa$/i)).length,
      days:    amDaysDelta(amAttempted(amFilter(aiMockRows, 'academy', /^dsa$/i)), days),
      months:  amMonthsDelta(amAttempted(amFilter(aiMockRows, 'academy', /^dsa$/i)), months),
      drillable: true,
    },
    {
      id: 'dsa_mock_cleared', label: 'DSA AI Mock Cleared', group: 'dsa',
      total:   amCleared(amFilter(aiMockRows, 'academy', /^dsa$/i)).length,
      days:    amDaysDelta(amCleared(amFilter(aiMockRows, 'academy', /^dsa$/i)), days),
      months:  amMonthsDelta(amCleared(amFilter(aiMockRows, 'academy', /^dsa$/i)), months),
      drillable: true,
    },
    // SQL
    {
      id: 'sql_contest_started', label: 'SQL Contest Started', group: 'sql',
      total:   s4Count(s4Rows, 'Academy', 'Academy SQL MBE'),
      days:    s4DeltaByDay(s4Rows, 'Academy', 'Academy SQL MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'Academy', 'Academy SQL MBE', months),
      batches: lcBatches(lcAcadSQL.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'sql_contest_cleared', label: 'SQL Contest Cleared', group: 'sql',
      total:   s4Count(s4Rows, 'Academy', 'Academy SQL Contest'),
      days:    s4DeltaByDay(s4Rows, 'Academy', 'Academy SQL Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'Academy', 'Academy SQL Contest', months),
      batches: lcBatches(lcAcadSQL.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'sql_mock_started', label: 'SQL AI Mock Attempted', group: 'sql',
      total:   amAttempted(amFilter(aiMockRows, 'academy', /academy sql/i)).length,
      days:    amDaysDelta(amAttempted(amFilter(aiMockRows, 'academy', /academy sql/i)), days),
      months:  amMonthsDelta(amAttempted(amFilter(aiMockRows, 'academy', /academy sql/i)), months),
      drillable: true,
    },
    {
      id: 'sql_mock_cleared', label: 'SQL AI Mock Cleared', group: 'sql',
      total:   amCleared(amFilter(aiMockRows, 'academy', /academy sql/i)).length,
      days:    amDaysDelta(amCleared(amFilter(aiMockRows, 'academy', /academy sql/i)), days),
      months:  amMonthsDelta(amCleared(amFilter(aiMockRows, 'academy', /academy sql/i)), months),
      drillable: true,
    },
    {
      id: 'new_certs_mtd', label: 'New Certified MTD', group: 'cert',
      total:  currentMonthMOM(momRows, DOD.ACADEMY_FULL),
      days:   dodDeltaByDay(dodRows, DOD.ACADEMY_FULL, days),
      months: momDelta(momRows, DOD.ACADEMY_FULL, months),
    },
  ];

  // ── DSML ─────────────────────────────────────────────────────────────────

  const DSML_MBE_COLS = ['DSML SQL MBE','EDA MBE','Python Libraries Contest'];

  const lcDSMLSQL = lcSkillRows(lcRows, 'DSML', SKILL_FILTERS.dsml_sql);
  const lcDSMLEDA = lcSkillRows(lcRows, 'DSML', SKILL_FILTERS.dsml_eda);

  const dsmlRows: MetricRow[] = [

    {
      id: 'cert_started', label: 'Cert Started', group: 'cert',
      total:  s4CertStarted(s4Rows, 'DSML', DSML_MBE_COLS),
      days:   s4CertStartedDeltaByDay(s4Rows, 'DSML', DSML_MBE_COLS, days),
      months: s4CertStartedMonthlyDelta(s4Rows, 'DSML', DSML_MBE_COLS, months),
    },
    {
      id: 'cert_cleared',      label: 'Cleared (SQL + EDA)',              group: 'cert',
      total:  ocVal(ocRows, 'DSML', '4.'),
      days:   dodDeltaByDay(dodRows, DOD.DSML_SQL_EDA, days),
      months: momDelta(momRows, DOD.DSML_SQL_EDA, months),
    },
    {
      id: 'cert_cleared_full', label: 'Cleared Full (SQL + EDA + Python)', group: 'cert',
      total:  ocVal(ocRows, 'DSML', '6.'),
      days:   dodDeltaByDay(dodRows, DOD.DSML_FULL, days),
      months: momDelta(momRows, DOD.DSML_FULL, months),
    },
    // DSML SQL
    {
      id: 'dsml_sql_contest_started', label: 'DSML SQL Contest Started', group: 'dsml_sql',
      total:   s4Count(s4Rows, 'DSML', 'DSML SQL MBE'),
      days:    s4DeltaByDay(s4Rows, 'DSML', 'DSML SQL MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'DSML', 'DSML SQL MBE', months),
      batches: lcBatches(lcDSMLSQL.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'dsml_sql_contest_cleared', label: 'DSML SQL Contest Cleared', group: 'dsml_sql',
      total:   s4Count(s4Rows, 'DSML', 'DSML SQL Contest'),
      days:    s4DeltaByDay(s4Rows, 'DSML', 'DSML SQL Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'DSML', 'DSML SQL Contest', months),
      batches: lcBatches(lcDSMLSQL.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'dsml_sql_mock_started', label: 'DSML SQL AI Mock Attempted', group: 'dsml_sql',
      total:   amAttempted(amFilter(aiMockRows, 'dsml', /dsml sql/i)).length,
      days:    amDaysDelta(amAttempted(amFilter(aiMockRows, 'dsml', /dsml sql/i)), days),
      months:  amMonthsDelta(amAttempted(amFilter(aiMockRows, 'dsml', /dsml sql/i)), months),
      drillable: true,
    },
    {
      id: 'dsml_sql_mock_cleared', label: 'DSML SQL AI Mock Cleared', group: 'dsml_sql',
      total:   amCleared(amFilter(aiMockRows, 'dsml', /dsml sql/i)).length,
      days:    amDaysDelta(amCleared(amFilter(aiMockRows, 'dsml', /dsml sql/i)), days),
      months:  amMonthsDelta(amCleared(amFilter(aiMockRows, 'dsml', /dsml sql/i)), months),
      drillable: true,
    },
    // EDA
    {
      id: 'eda_contest_started', label: 'EDA Contest Started', group: 'eda',
      total:   s4Count(s4Rows, 'DSML', 'EDA MBE'),
      days:    s4DeltaByDay(s4Rows, 'DSML', 'EDA MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'DSML', 'EDA MBE', months),
      batches: lcBatches(lcDSMLEDA.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'eda_contest_cleared', label: 'EDA Contest Cleared', group: 'eda',
      total:   s4Count(s4Rows, 'DSML', 'EDA Contest'),
      days:    s4DeltaByDay(s4Rows, 'DSML', 'EDA Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'DSML', 'EDA Contest', months),
      batches: lcBatches(lcDSMLEDA.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'eda_mock_started', label: 'EDA AI Mock Attempted', group: 'eda',
      total:   amAttempted(amFilter(aiMockRows, 'dsml', /^eda$/i)).length,
      days:    amDaysDelta(amAttempted(amFilter(aiMockRows, 'dsml', /^eda$/i)), days),
      months:  amMonthsDelta(amAttempted(amFilter(aiMockRows, 'dsml', /^eda$/i)), months),
      drillable: true,
    },
    {
      id: 'eda_mock_cleared', label: 'EDA AI Mock Cleared', group: 'eda',
      total:   amCleared(amFilter(aiMockRows, 'dsml', /^eda$/i)).length,
      days:    amDaysDelta(amCleared(amFilter(aiMockRows, 'dsml', /^eda$/i)), days),
      months:  amMonthsDelta(amCleared(amFilter(aiMockRows, 'dsml', /^eda$/i)), months),
      drillable: true,
    },
    {
      id: 'new_certs_mtd', label: 'New Certified MTD', group: 'cert',
      total:  currentMonthMOM(momRows, DOD.DSML_FULL),
      days:   dodDeltaByDay(dodRows, DOD.DSML_FULL, days),
      months: momDelta(momRows, DOD.DSML_FULL, months),
    },
  ];

  // ── DEVOPS ────────────────────────────────────────────────────────────────

  const DEVOPS_MBE_COLS = ['Linux MBE','DevOps Tools MBE','AWS MBE'];

  const enrolled = ocVal(ocRows, 'DevOps', '1.');

  const lcDevLinux = lcSkillRows(lcRows, 'DevOps', SKILL_FILTERS.devops_linux);
  const lcDevTools = lcSkillRows(lcRows, 'DevOps', SKILL_FILTERS.devops_tools);
  const lcDevAWS   = lcSkillRows(lcRows, 'DevOps', SKILL_FILTERS.devops_aws);

  const linuxCleared = s4Count(s4Rows, 'DevOps', 'Linux');
  const toolsCleared = s4Count(s4Rows, 'DevOps', 'DevOps Tools');
  const awsCleared   = s4Count(s4Rows, 'DevOps', 'AWS');

  const s4d = s4Rows.filter(r => r['Program'] === 'DevOps');
  const ltCleared  = s4d.filter(r => r['Linux']?.trim() && r['DevOps Tools']?.trim()).length;
  const atCleared  = s4d.filter(r => r['AWS']?.trim() && r['DevOps Tools']?.trim()).length;
  const alCleared  = s4d.filter(r => r['AWS']?.trim() && r['Linux']?.trim()).length;
  const fullCleared = s4d.filter(r => r['Linux']?.trim() && r['DevOps Tools']?.trim() && r['AWS']?.trim()).length;

  const devopsRows: MetricRow[] = [
    
    {
      id: 'cert_started',   label: 'Cert Started',                 group: 'cert',
      total:  s4CertStarted(s4Rows, 'DevOps', DEVOPS_MBE_COLS),
      days:   s4CertStartedDeltaByDay(s4Rows, 'DevOps', DEVOPS_MBE_COLS, days),
      months: s4CertStartedMonthlyDelta(s4Rows, 'DevOps', DEVOPS_MBE_COLS, months),
    },
    { id: 'eligible_linux', label: 'Eligible — Linux',             group: 'linux', isStatic: true, total: enrolled - linuxCleared, days: [], months: [] },
    { id: 'eligible_tools', label: 'Eligible — DevOps Tools',      group: 'tools', isStatic: true, total: enrolled - toolsCleared, days: [], months: [] },
    { id: 'eligible_aws',   label: 'Eligible — AWS',               group: 'aws',   isStatic: true, total: enrolled - awsCleared,   days: [], months: [] },
    {
      id: 'cleared_linux',  label: 'Cleared Linux',                group: 'linux',
      total: linuxCleared,
      days:   s4DeltaByDay(s4Rows, 'DevOps', 'Linux', days),
      months: s4MonthlyDelta(s4Rows, 'DevOps', 'Linux', months),
    },
    {
      id: 'cleared_tools',  label: 'Cleared DevOps Tools',         group: 'tools',
      total: toolsCleared,
      days:   s4DeltaByDay(s4Rows, 'DevOps', 'DevOps Tools', days),
      months: s4MonthlyDelta(s4Rows, 'DevOps', 'DevOps Tools', months),
    },
    {
      id: 'cleared_aws',    label: 'Cleared AWS',                  group: 'aws',
      total: awsCleared,
      days:   s4DeltaByDay(s4Rows, 'DevOps', 'AWS', days),
      months: s4MonthlyDelta(s4Rows, 'DevOps', 'AWS', months),
    },
    { id: 'cleared_lt',   label: 'Cleared Linux + DevOps Tools', group: 'tools', isStatic: true, total: ltCleared,   days: [], months: [] },
    { id: 'cleared_at',   label: 'Cleared AWS + DevOps Tools',   group: 'aws',   isStatic: true, total: atCleared,   days: [], months: [] },
    { id: 'cleared_al',   label: 'Cleared AWS + Linux',          group: 'aws',   isStatic: true, total: alCleared,   days: [], months: [] },
    {
      id: 'cleared_full',   label: 'Cleared All 3 (Full)',         group: 'cert',
      total: fullCleared,
      days:   s4DeltaByDay(s4Rows, 'DevOps', 'Linux', days), // proxy — no DevOps full date col
      months: s4MonthlyDelta(s4Rows, 'DevOps', 'Linux', months),
    },
    // Linux contests
    {
      id: 'linux_contest_started', label: 'Linux Contest Started', group: 'linux',
      total:   s4Count(s4Rows, 'DevOps', 'Linux MBE'),
      days:    s4DeltaByDay(s4Rows, 'DevOps', 'Linux MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'DevOps', 'Linux MBE', months),
      batches: lcBatches(lcDevLinux.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'linux_contest_cleared', label: 'Linux Contest Cleared', group: 'linux',
      total:   s4Count(s4Rows, 'DevOps', 'Linux Contest'),
      days:    s4DeltaByDay(s4Rows, 'DevOps', 'Linux Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'DevOps', 'Linux Contest', months),
      batches: lcBatches(lcDevLinux.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'tools_contest_started', label: 'Tools Contest Started', group: 'tools',
      total:   s4Count(s4Rows, 'DevOps', 'DevOps Tools MBE'),
      days:    s4DeltaByDay(s4Rows, 'DevOps', 'DevOps Tools MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'DevOps', 'DevOps Tools MBE', months),
      batches: lcBatches(lcDevTools.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'tools_contest_cleared', label: 'Tools Contest Cleared', group: 'tools',
      total:   s4Count(s4Rows, 'DevOps', 'DevOps Tools Contest'),
      days:    s4DeltaByDay(s4Rows, 'DevOps', 'DevOps Tools Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'DevOps', 'DevOps Tools Contest', months),
      batches: lcBatches(lcDevTools.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'aws_contest_started', label: 'AWS Contest Started', group: 'aws',
      total:   s4Count(s4Rows, 'DevOps', 'AWS MBE'),
      days:    s4DeltaByDay(s4Rows, 'DevOps', 'AWS MBE', days),
      months:  s4MonthlyDelta(s4Rows, 'DevOps', 'AWS MBE', months),
      batches: lcBatches(lcDevAWS.filter(r => r['Contest Attempted'] === 'Yes')),
    },
    {
      id: 'aws_contest_cleared', label: 'AWS Contest Cleared', group: 'aws',
      total:   s4Count(s4Rows, 'DevOps', 'AWS Contest'),
      days:    s4DeltaByDay(s4Rows, 'DevOps', 'AWS Contest', days),
      months:  s4MonthlyDelta(s4Rows, 'DevOps', 'AWS Contest', months),
      batches: lcBatches(lcDevAWS.filter(r => r['Contest Passed'] === 'Yes')),
    },
    {
      id: 'new_certs_mtd', label: 'New Certified MTD', group: 'cert',
      total:  currentMonthMOM(momRows, DOD.DEVOPS_FULL),
      days:   dodDeltaByDay(dodRows, DOD.DEVOPS_FULL, days),
      months: momDelta(momRows, DOD.DEVOPS_FULL, months),
    },
  ];

  return {
    academy: { rows: academyRows, learners: ocVal(ocRows, 'Academy', '1.') },
    dsml:    { rows: dsmlRows,    learners: ocVal(ocRows, 'DSML', '1.')    },
    devops:  { rows: devopsRows,  learners: ocVal(ocRows, 'DevOps', '1.')  },
    days,
    months,
  };
}
