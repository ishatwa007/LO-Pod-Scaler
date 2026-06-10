import { parseDate, getLast7Days, getLast12Months, getDateRange } from './metrics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface I2RDayPoint   { date: string;  value: number | null; rejected: number; total: number }
export interface I2RMonthPoint { month: string; value: number | null; rejected: number; total: number }

export interface I2RMetricRow {
  id:       string;
  label:    string;
  modules:  string[];       // Related Module values to include
  days:     I2RDayPoint[];
  months:   I2RMonthPoint[];
  days30:   I2RDayPoint[];
  latest:   number | null;
  drillable: boolean;
}

export interface I2RResult {
  rows:    I2RMetricRow[];
  days:    string[];
  months:  string[];
}

type R = Record<string, string>;

// ── Module config per program ─────────────────────────────────────────────────

interface ModuleDef { id: string; label: string; modules: string[]; statusCol: string; rejectedVal: string }

const PROGRAM_MODULES: Record<string, ModuleDef[]> = {
  Academy: [
    { id: 'i2r_dsa',  label: 'I2R — DSA',  modules: ['DSA'],             statusCol: 'Status', rejectedVal: 'Rejected' },
    { id: 'i2r_sql',  label: 'I2R — SQL',  modules: ['Databases & SQL'], statusCol: 'Status', rejectedVal: 'Rejected' },
    { id: 'i2r_java', label: 'I2R — Java', modules: ['Java'],             statusCol: 'Status', rejectedVal: 'Rejected' },
  ],
  DSML: [
    { id: 'i2r_sql',  label: 'I2R — SQL',      modules: ['SQL'],
      statusCol: 'Final Status', rejectedVal: 'Rejected' },
    { id: 'i2r_dataviz', label: 'I2R — EDA / Data Viz', modules: [
        'Data Analytics and Visualisation - Fundamentals',
        'Data Analytics and Visualisation - Python Libraries',
        'Tableau/ Power BI and Excel',
      ], statusCol: 'Final Status', rejectedVal: 'Rejected' },
  ],
  DevOps: [
    { id: 'i2r_linux',  label: 'I2R — Linux',        modules: ['Linux'],        statusCol: 'Status', rejectedVal: 'Rejected' },
    { id: 'i2r_tools',  label: 'I2R — DevOps Tools', modules: ['DevOps Tools'], statusCol: 'Status', rejectedVal: 'Rejected' },
    { id: 'i2r_aws',    label: 'I2R — AWS',           modules: ['AWS'],          statusCol: 'Status', rejectedVal: 'Rejected' },
  ],
  AIML: [],
};

// ── Rolling 60-day calculation ────────────────────────────────────────────────

function rolling60(
  rows: R[],
  moduleDef: ModuleDef,
  refDate: string     // YYYY-MM-DD
): { value: number | null; rejected: number; total: number } {
  const end = new Date(refDate + 'T23:59:59');
  const start = new Date(refDate + 'T00:00:00');
  start.setDate(start.getDate() - 60);
  const startStr = start.toISOString().slice(0, 10);

  const { modules, statusCol, rejectedVal } = moduleDef;

  const inWindow = rows.filter(r => {
    const d = parseDate(r['Date of Call']).slice(0, 10);
    if (!d || d < startStr || d > refDate) return false;
    const mod = String(r['Related Module'] ?? '').trim();
    return modules.includes(mod);
  });

  if (!inWindow.length) return { value: null, rejected: 0, total: 0 };

  const total    = inWindow.length;
  const rejected = inWindow.filter(r => String(r[statusCol] ?? '').trim() === rejectedVal).length;
  const value    = Math.round((rejected / total) * 1000) / 10; // one decimal %

  return { value, rejected, total };
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeI2R(
  rows: R[],
  program: string,
  fromDate = '',
  toDate   = ''
): I2RResult {
  const days   = (fromDate && toDate) ? getDateRange(fromDate, toDate) : getLast7Days();
  const months = getLast12Months();
  const days30 = getDateRange(
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    new Date().toISOString().slice(0, 10)
  );

  const defs = PROGRAM_MODULES[program] ?? [];

  const metricRows: I2RMetricRow[] = defs.map(def => ({
    id:       def.id,
    label:    def.label,
    modules:  def.modules,
    days:     days.map(d => ({ date: d, ...rolling60(rows, def, d) })),
    days30:   days30.map(d => ({ date: d, ...rolling60(rows, def, d) })),
    months:   months.map(m => {
      // Last day of month
      const [y, mo] = m.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).toISOString().slice(0, 10);
      return { month: m, ...rolling60(rows, def, lastDay) };
    }),
    latest:   rolling60(rows, def, new Date().toISOString().slice(0, 10)).value,
    drillable: true,
  }));

  return { rows: metricRows, days, months };
}

// ── Drill-down ────────────────────────────────────────────────────────────────

export function drillI2R(
  rows: R[],
  program: string,
  metricId: string,
  refDate: string,   // for a day cell: use that date; for month: use last day of month
  isMonth = false
): R[] {
  const defs = PROGRAM_MODULES[program] ?? [];
  const def  = defs.find(d => d.id === metricId);
  if (!def) return [];

  const end = isMonth
    ? new Date(refDate + 'T23:59:59')
    : new Date(refDate + 'T23:59:59');
  const start = new Date((isMonth ? refDate : refDate) + 'T00:00:00');
  start.setDate(start.getDate() - 60);
  const startStr = start.toISOString().slice(0, 10);

  return rows.filter(r => {
    const d = parseDate(r['Date of Call']).slice(0, 10);
    if (!d || d < startStr || d > refDate) return false;
    const mod = String(r['Related Module'] ?? '').trim();
    return def.modules.includes(mod);
  });
}
