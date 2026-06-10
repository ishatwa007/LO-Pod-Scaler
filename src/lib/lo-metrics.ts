import { parseDate, getLast7Days, getLast12Months } from './metrics';
import { KRS_COLS, WS_METRICS } from './sheets-config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LODayCount   { date: string;  value: number | null }
export interface LOMonthCount { month: string; value: number | null }

export interface LOMetricRow {
  id:         string;
  label:      string;
  group:      string;
  days:       LODayCount[];
  months:     LOMonthCount[];
  days30:     LODayCount[];   // 30-day history for line graphs
  latest:     number | null;
  isRate:     boolean;
  drillable:  boolean;
  drillTab?:  string;
}

export interface LOProgramMetrics { rows: LOMetricRow[] }

export interface LOAllMetrics {
  academy: LOProgramMetrics;
  dsml:    LOProgramMetrics;
  devops:  LOProgramMetrics;
  aiml:    LOProgramMetrics;
  days:    string[];
  months:  string[];
}

type R = Record<string, string>;

function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseHeaderDate(raw: string): string {
  if (!raw || raw.trim() === '' || raw === 'nan') return '';
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2,'0')}-${slash[2].padStart(2,'0')}`;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 100000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return '';
}

// ── LOCF (Last Observation Carried Forward) ───────────────────────────────────

function applyLOCF(series: LODayCount[]): LODayCount[] {
  let last: number | null = null;
  return series.map(pt => {
    if (pt.value !== null) { last = pt.value; return pt; }
    return { ...pt, value: last };
  });
}

function applyLOCFMonths(series: LOMonthCount[]): LOMonthCount[] {
  let last: number | null = null;
  return series.map(pt => {
    if (pt.value !== null) { last = pt.value; return pt; }
    return { ...pt, value: last };
  });
}


// ── Global LOCF (uses full dataset history, not just window) ──────────────────

function krsDaysGlobalLOCF(rows: R[], col: string, days: string[]): LODayCount[] {
  // Build sorted history of all non-null values
  const history: { date: string; val: number }[] = [];
  rows.forEach(r => {
    const d = parseDate(r[KRS_COLS.DATE]).slice(0, 10);
    const v = krsVal(r, col);
    if (d.length === 10 && v !== null) history.push({ date: d, val: v });
  });
  history.sort((a, b) => a.date.localeCompare(b.date));

  return days.map(d => {
    let lastVal: number | null = null;
    for (const x of history) {
      if (x.date > d) break;
      lastVal = x.val;
    }
    return { date: d, value: lastVal };
  });
}

function krsMonthsGlobalLOCF(rows: R[], col: string, months: string[]): LOMonthCount[] {
  const history: { date: string; month: string; val: number }[] = [];
  rows.forEach(r => {
    const d = parseDate(r[KRS_COLS.DATE]).slice(0, 10);
    const v = krsVal(r, col);
    if (d.length === 10 && v !== null) history.push({ date: d, month: d.slice(0, 7), val: v });
  });
  history.sort((a, b) => a.date.localeCompare(b.date));

  return months.map(m => {
    // Last known value at or before end of this month
    let lastVal: number | null = null;
    const endOfMonth = m + '-31'; // generous upper bound
    for (const x of history) {
      if (x.date > endOfMonth) break;
      lastVal = x.val;
    }
    return { month: m, value: lastVal };
  });
}

function krsDays30GlobalLOCF(rows: R[], col: string, days30: string[]): LODayCount[] {
  return krsDaysGlobalLOCF(rows, col, days30);
}

// ── KRS helpers ───────────────────────────────────────────────────────────────

function krsVal(row: R, col: string): number | null {
  const v = parseFloat(row[col] ?? '');
  return isNaN(v) ? null : v;
}

function krsMapByDate(rows: R[], col: string, col2 = '', col3 = ''): Map<string, number | null> {
  const map = new Map<string, number | null>();
  rows.forEach(r => {
    const d = parseDate(r[KRS_COLS.DATE]).slice(0, 10);
    if (!d) return;
    let v = krsVal(r, col);
    if (col2) { const v2 = krsVal(r, col2); if (v !== null && v2 !== null) v = (v ?? 0) + v2; }
    if (col3) { const v3 = krsVal(r, col3); if (v !== null && v3 !== null) v = (v ?? 0) + v3; }
    map.set(d, v);
  });
  return map;
}

function krsDays(rows: R[], col: string, days: string[], col2 = '', col3 = ''): LODayCount[] {
  const map = krsMapByDate(rows, col, col2, col3);
  return days.map(d => ({ date: d, value: map.get(d) ?? null }));
}

function krsMonths(rows: R[], col: string, months: string[], col2 = '', col3 = ''): LOMonthCount[] {
  const map = new Map<string, { v: number | null; d: string }>();
  rows.forEach(r => {
    const d = parseDate(r[KRS_COLS.DATE]).slice(0, 10);
    if (!d) return;
    const m = d.slice(0, 7);
    let v = krsVal(r, col);
    if (col2) { const v2 = krsVal(r, col2); if (v !== null && v2 !== null) v = (v ?? 0) + v2; }
    if (col3) { const v3 = krsVal(r, col3); if (v !== null && v3 !== null) v = (v ?? 0) + v3; }
    const ex = map.get(m);
    if (!ex || d > ex.d) map.set(m, { v, d });
  });
  return months.map(m => ({ month: m, value: map.get(m)?.v ?? null }));
}

function krsLatest(rows: R[], col: string, col2 = '', col3 = ''): number | null {
  const sorted = [...rows]
    .filter(r => parseDate(r[KRS_COLS.DATE]).length === 10)
    .sort((a, b) => parseDate(b[KRS_COLS.DATE]).localeCompare(parseDate(a[KRS_COLS.DATE])));
  if (!sorted.length) return null;
  const r = sorted[0];
  let v = krsVal(r, col);
  if (col2) { const v2 = krsVal(r, col2); if (v !== null && v2 !== null) v = (v ?? 0) + v2; }
  if (col3) { const v3 = krsVal(r, col3); if (v !== null && v3 !== null) v = (v ?? 0) + v3; }
  return v;
}

// ── Weekly Sync helpers ───────────────────────────────────────────────────────

function wsExtract(wsRaw: string[][], metricLabel: string, days: string[]): LODayCount[] {
  if (!wsRaw.length) return days.map(d => ({ date: d, value: null }));
  const headers = wsRaw[0];
  const metricRow = wsRaw.find(r => String(r[0] ?? '').trim() === metricLabel);
  if (!metricRow) return days.map(d => ({ date: d, value: null }));
  const map = new Map<string, number | null>();
  headers.forEach((h, i) => {
    if (i < 2) return;
    const d = parseHeaderDate(String(h ?? ''));
    if (!d) return;
    const raw = String(metricRow[i] ?? '').trim();
    const v = raw === '-' || raw === '' ? null : parseFloat(raw);
    map.set(d, isNaN(v as number) ? null : v);
  });
  return days.map(d => ({ date: d, value: map.get(d) ?? null }));
}

function wsExtractMonths(wsRaw: string[][], metricLabel: string, months: string[]): LOMonthCount[] {
  if (!wsRaw.length) return months.map(m => ({ month: m, value: null }));
  const headers = wsRaw[0];
  const metricRow = wsRaw.find(r => String(r[0] ?? '').trim() === metricLabel);
  if (!metricRow) return months.map(m => ({ month: m, value: null }));
  const map = new Map<string, { v: number | null; d: string }>();
  headers.forEach((h, i) => {
    if (i < 2) return;
    const d = parseHeaderDate(String(h ?? ''));
    if (!d) return;
    const m = d.slice(0, 7);
    const raw = String(metricRow[i] ?? '').trim();
    const v = raw === '-' || raw === '' ? null : parseFloat(raw);
    const val = isNaN(v as number) ? null : v;
    const ex = map.get(m);
    if (!ex || d > ex.d) map.set(m, { v: val, d });
  });
  return months.map(m => ({ month: m, value: map.get(m)?.v ?? null }));
}

function wsLatest(wsRaw: string[][], metricLabel: string): number | null {
  if (!wsRaw.length) return null;
  const headers = wsRaw[0];
  const metricRow = wsRaw.find(r => String(r[0] ?? '').trim() === metricLabel);
  if (!metricRow) return null;
  let latest: number | null = null;
  let latestDate = '';
  headers.forEach((h, i) => {
    if (i < 2) return;
    const d = parseHeaderDate(String(h ?? ''));
    if (!d || d <= latestDate) return;
    const raw = String(metricRow[i] ?? '').trim();
    if (raw === '-' || raw === '') return;
    const v = parseFloat(raw);
    if (!isNaN(v)) { latest = v; latestDate = d; }
  });
  return latest;
}

// ── Cue Card Adherence (weighted, per-instructor) ─────────────────────────────

interface InstructorAdh { name: string; email: string; program: string; played: number; total: number }

function buildInstructorMap(rfRows: R[], program: string): Map<string, InstructorAdh> {
  const rfProg = rfRows.filter(r => {
    const p = String(r['Program'] ?? '');
    return p === program || (program === 'DevOps' && p === 'Devops');
  });
  const map = new Map<string, InstructorAdh>();
  rfProg.forEach(r => {
    const name  = String(r['Instructor Name'] ?? '').trim();
    const email = String(r['Instructor Email'] ?? '').trim();
    if (!name) return;
    const played = parseFloat(r['Played Cue Card'] ?? '');
    const total  = parseFloat(r['Total Cue Card'] ?? '');
    if (isNaN(played) || isNaN(total)) return;
    const key = email || name;
    const ex = map.get(key);
    if (ex) { ex.played += played; ex.total += total; }
    else map.set(key, { name, email, program, played, total });
  });
  return map;
}

function rfCueCounts(rfRows: R[], program: string, days: string[], months: string[], days30: string[]) {
  const rfProg = rfRows.filter(r => {
    const p = String(r['Program'] ?? '');
    return p === program || (program === 'DevOps' && p === 'Devops');
  });

  // Build per-day instructor weighted adherence
  const dayMap = new Map<string, Map<string, InstructorAdh>>();
  rfProg.forEach(r => {
    const d = parseDate(r['Class Date']).slice(0, 10);
    if (!d) return;
    const name  = String(r['Instructor Name'] ?? '').trim();
    const email = String(r['Instructor Email'] ?? '').trim();
    if (!name) return;
    const played = parseFloat(r['Played Cue Card'] ?? '');
    const total  = parseFloat(r['Total Cue Card'] ?? '');
    if (isNaN(played) || isNaN(total)) return;
    if (!dayMap.has(d)) dayMap.set(d, new Map());
    const instMap = dayMap.get(d)!;
    const key = email || name;
    const ex = instMap.get(key);
    if (ex) { ex.played += played; ex.total += total; }
    else instMap.set(key, { name, email, program, played, total });
  });

  // Count instructors per threshold per day
  function countForDays(ds: string[]) {
    return {
      gt70: ds.map(d => {
        const instMap = dayMap.get(d);
        if (!instMap) return { date: d, value: null };
        let count = 0;
        instMap.forEach(i => { if (i.total > 0 && (i.played / i.total * 100) > 70) count++; });
        return { date: d, value: count };
      }),
      lt75: ds.map(d => {
        const instMap = dayMap.get(d);
        if (!instMap) return { date: d, value: null };
        let count = 0;
        instMap.forEach(i => { if (i.total > 0 && (i.played / i.total * 100) < 75) count++; });
        return { date: d, value: count };
      }),
    };
  }

  // Per month
  const monthMap = new Map<string, Map<string, InstructorAdh>>();
  rfProg.forEach(r => {
    const d = parseDate(r['Class Date']).slice(0, 10);
    if (!d) return;
    const m = d.slice(0, 7);
    const name  = String(r['Instructor Name'] ?? '').trim();
    const email = String(r['Instructor Email'] ?? '').trim();
    if (!name) return;
    const played = parseFloat(r['Played Cue Card'] ?? '');
    const total  = parseFloat(r['Total Cue Card'] ?? '');
    if (isNaN(played) || isNaN(total)) return;
    if (!monthMap.has(m)) monthMap.set(m, new Map());
    const instMap = monthMap.get(m)!;
    const key = email || name;
    const ex = instMap.get(key);
    if (ex) { ex.played += played; ex.total += total; }
    else instMap.set(key, { name, email, program, played, total });
  });

  const gt70Months = months.map(m => {
    const instMap = monthMap.get(m);
    if (!instMap) return { month: m, value: null };
    let count = 0;
    instMap.forEach(i => { if (i.total > 0 && (i.played / i.total * 100) > 70) count++; });
    return { month: m, value: count };
  });
  const lt75Months = months.map(m => {
    const instMap = monthMap.get(m);
    if (!instMap) return { month: m, value: null };
    let count = 0;
    instMap.forEach(i => { if (i.total > 0 && (i.played / i.total * 100) < 75) count++; });
    return { month: m, value: count };
  });

  const d7  = countForDays(days);
  const d30 = countForDays(days30);

  // Latest: overall instructor counts
  const overall = buildInstructorMap(rfRows, program);
  let gt70Latest = 0; let lt75Latest = 0;
  overall.forEach(i => {
    if (i.total > 0) {
      const pct = i.played / i.total * 100;
      if (pct > 70) gt70Latest++;
      if (pct < 75) lt75Latest++;
    }
  });

  return { d7, d30, gt70Months, lt75Months, gt70Latest, lt75Latest };
}

// ── Row builders ──────────────────────────────────────────────────────────────

function makeKrsRow(
  id: string, label: string, group: string,
  rows: R[], days: string[], months: string[], days30: string[],
  col: string, col2 = '', col3 = '',
  opts: { isRate?: boolean; drillable?: boolean; drillTab?: string; locf?: boolean } = {}
): LOMetricRow {
  let d7  = krsDays(rows, col, days, col2, col3);
  let d30 = krsDays(rows, col, days30, col2, col3);
  let mon = krsMonths(rows, col, months, col2, col3);
  if (opts.locf) { d7 = applyLOCF(d7); d30 = applyLOCF(d30); mon = applyLOCFMonths(mon); }
  return {
    id, label, group,
    days:   d7,
    days30: d30,
    months: mon,
    latest: krsLatest(rows, col, col2, col3),
    isRate:    opts.isRate    ?? false,
    drillable: opts.drillable ?? true,
    drillTab:  opts.drillTab,
  };
}

function makeWsRow(
  id: string, label: string, group: string,
  wsRaw: string[][], metric: string,
  days: string[], months: string[], days30: string[],
  opts: { isRate?: boolean; drillable?: boolean } = {}
): LOMetricRow {
  return {
    id, label, group,
    days:   wsExtract(wsRaw, metric, days),
    days30: wsExtract(wsRaw, metric, days30),
    months: wsExtractMonths(wsRaw, metric, months),
    latest: wsLatest(wsRaw, metric),
    isRate:    opts.isRate    ?? false,
    drillable: opts.drillable ?? false,
  };
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeLOMetrics(
  krsAcademy: R[], krsDSML: R[], krsDevops: R[], krsAIML: R[],
  wsAcademy:  string[][], wsDSML: string[][], wsDevops: string[][], wsAIML: string[][],
  rfRows: R[]
): LOAllMetrics {
  const days   = getLast7Days();
  const months = getLast12Months();
  const days30 = getLast30Days();

  function buildRows(krs: R[], ws: string[][], prog: string): LOMetricRow[] {
    const cueData = rfCueCounts(rfRows, prog === 'DevOps' ? 'Devops' : prog, days, months, days30);

    return [
      // NPS & Curriculum — global LOCF (data only updated periodically)
      { id: 'nps_filled',  label: 'Running Filled NPS',               group: 'nps', isRate: false, drillable: false, latest: krsLatest(krs, KRS_COLS.NPS_FILLED),      days: krsDaysGlobalLOCF(krs, KRS_COLS.NPS_FILLED,      days),   days30: krsDays30GlobalLOCF(krs, KRS_COLS.NPS_FILLED,      days30),   months: krsMonthsGlobalLOCF(krs, KRS_COLS.NPS_FILLED,      months)   },
      { id: 'nps_running', label: 'Running NPS Score',                group: 'nps', isRate: true,  drillable: false, latest: krsLatest(krs, KRS_COLS.NPS_RUNNING),     days: krsDaysGlobalLOCF(krs, KRS_COLS.NPS_RUNNING,     days),   days30: krsDays30GlobalLOCF(krs, KRS_COLS.NPS_RUNNING,     days30),   months: krsMonthsGlobalLOCF(krs, KRS_COLS.NPS_RUNNING,     months)   },
      { id: 'nps_concern', label: 'Running % Curriculum Concern NPS', group: 'nps', isRate: true,  drillable: false, latest: krsLatest(krs, KRS_COLS.NPS_CONCERN_PCT), days: krsDaysGlobalLOCF(krs, KRS_COLS.NPS_CONCERN_PCT, days),   days30: krsDays30GlobalLOCF(krs, KRS_COLS.NPS_CONCERN_PCT, days30),   months: krsMonthsGlobalLOCF(krs, KRS_COLS.NPS_CONCERN_PCT, months)   },
      // Hiring
      makeWsRow('i2h', 'Rolling I2H (60d) — Full Time', 'hiring', ws, WS_METRICS.I2H, days, months, days30, { isRate: true }),
      // Content T+7
      makeKrsRow('lectures_t7',   'Total Lectures (T+7)',         'content_t7', krs, days, months, days30, KRS_COLS.LECTURES_T7,  '', '', { drillTab: 'Upcoming Classes' }),
      makeKrsRow('no_cue_t7',     '# Without Cue Cards (T+7)',    'content_t7', krs, days, months, days30, KRS_COLS.NO_CUE_T7,   '', '', { drillTab: 'Upcoming Classes' }),
      makeKrsRow('no_assign_t7',  '# Without Assignments (T+7)',  'content_t7', krs, days, months, days30, KRS_COLS.NO_ASSIGN_T7,'', '', { drillTab: 'Upcoming Classes' }),
      makeKrsRow('no_pre_t7',     '# Without Pre-reads (T+7)',    'content_t7', krs, days, months, days30, KRS_COLS.NO_PRE_T7,  '', '', { drillTab: 'Upcoming Classes' }),
      makeKrsRow('no_post_t7',    '# Without Post-reads (T+7)',   'content_t7', krs, days, months, days30, KRS_COLS.NO_POST_T7, '', '', { drillTab: 'Upcoming Classes' }),
      makeKrsRow('contests_t7',   '# Live Contests (T+7)',        'content_t7', krs, days, months, days30, KRS_COLS.CONTESTS_T7,'', '', { drillTab: 'Upcoming Contests' }),
      makeKrsRow('reattempts_t7', '# Contest Reattempts (T+7)',   'content_t7', krs, days, months, days30, KRS_COLS.R1_T7, KRS_COLS.R2_T7, KRS_COLS.R3_T7, { drillTab: 'Upcoming Contests' }),
      // Lecture D-1
      makeKrsRow('lectures_t1',   'Total Lectures (T-1)',         'lecture_d1', krs, days, months, days30, KRS_COLS.LECTURES_T1,'', '', { drillTab: 'Completed Classes' }),
      makeKrsRow('att_lt20',      '# Attendance < 20 (D-1)',      'lecture_d1', krs, days, months, days30, KRS_COLS.ATT_LT20,  '', '', { drillTab: 'Live Attended Less than 20 Dump' }),
      makeKrsRow('att_drop',      '# Attendance Drop > 5% (D-1)', 'lecture_d1', krs, days, months, days30, KRS_COLS.ATT_DROP,  '', '', { drillTab: 'Attendance Drop' }),
      makeKrsRow('rated_lt46',    '# Lectures Rated < 4.6 (D-1)', 'lecture_d1', krs, days, months, days30, KRS_COLS.RATED_LT46,'', '', { drillTab: 'Completed Classes' }),
      // Cue Cards — weighted instructor counts
      {
        id: 'cue_gt70', label: '# Instructors Adherence > 70%', group: 'cue_card',
        days:   cueData.d7.gt70,
        days30: cueData.d30.gt70,
        months: cueData.gt70Months,
        latest: cueData.gt70Latest,
        isRate: false, drillable: true, drillTab: 'Cue Card Instructors',
      },
      {
        id: 'cue_lt75', label: '# Instructors Adherence < 75%', group: 'cue_card',
        days:   cueData.d7.lt75,
        days30: cueData.d30.lt75,
        months: cueData.lt75Months,
        latest: cueData.lt75Latest,
        isRate: false, drillable: true, drillTab: 'Cue Card Instructors',
      },
      makeKrsRow('cue_rated',     '# Cue Cards Rated (D-1)',       'cue_card', krs, days, months, days30, KRS_COLS.CUE_RATED,    '', '', { drillTab: 'Completed Classes' }),
      makeKrsRow('cue_rated_lt5', '# Cue Cards Rated < 5 (D-1)',   'cue_card', krs, days, months, days30, KRS_COLS.CUE_RATED_LT5,'', '', { drillTab: 'Completed Classes' }),
      // PSP — rolling 8-day
      makeKrsRow('psp_rolling', 'PSP (Rolling 8-day)', 'psp', krs, days, months, days30, KRS_COLS.PSP_ROLLING, '', '', { isRate: true, drillTab: 'PSP Dump' }),
      // Tickets — both daily and running (6 rows)
      makeKrsRow('tix_d',        '# Tickets (Daily)',              'tickets', krs, days, months, days30, KRS_COLS.TICKETS_D,       '', '', { drillTab: 'Support Tickets' }),
      makeKrsRow('tix_gt24_d',   '# Resolved > 24h (Daily)',       'tickets', krs, days, months, days30, KRS_COLS.TICKETS_GT24_D, '', '', { drillTab: 'Support Tickets' }),
      makeKrsRow('tix_unres_d',  '# Unresolved (Daily)',           'tickets', krs, days, months, days30, KRS_COLS.TICKETS_UNRES_D,'', '', { drillTab: 'Support Tickets' }),
      makeKrsRow('tix_r',        '# Tickets (Running)',            'tickets', krs, days, months, days30, KRS_COLS.TICKETS_R,       '', '', { drillTab: 'Support Tickets' }),
      makeKrsRow('tix_gt24_r',   '# Resolved > 24h (Running)',     'tickets', krs, days, months, days30, KRS_COLS.TICKETS_GT24_R, '', '', { drillTab: 'Support Tickets' }),
      makeKrsRow('tix_unres_r',  '# Unresolved (Running)',         'tickets', krs, days, months, days30, KRS_COLS.TICKETS_UNRES_R,'', '', { drillTab: 'Support Tickets' }),
    ];
  }

  return {
    academy: { rows: buildRows(krsAcademy, wsAcademy, 'Academy') },
    dsml:    { rows: buildRows(krsDSML,    wsDSML,    'DSML') },
    devops:  { rows: buildRows(krsDevops,  wsDevops,  'DevOps') },
    aiml:    { rows: buildRows(krsAIML,    wsAIML,    'AIML') },
    days,
    months,
  };
}
