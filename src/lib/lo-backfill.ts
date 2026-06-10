import { fetchTab, getWriteClient, readAllRows } from './sheets';
import { LO_SHEET_IDS, LO_TABS, LO_BACKFILL_SHEET_ID, KRS_COLS, INTERVIEW_SHEET_ID, INTERVIEW_TABS } from './sheets-config';
import { parseDate } from './metrics';

type R = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function colLetter(n: number): string {
  let s = ''; let i = n + 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
  return s;
}

function normDate(raw: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2,'0')}-${slash[2].padStart(2,'0')}`;
  return parseDate(raw).slice(0, 10);
}

// ── NPS LOCF ──────────────────────────────────────────────────────────────────

const NPS_KEYS = new Set([KRS_COLS.NPS_RUNNING, KRS_COLS.NPS_CONCERN_PCT, KRS_COLS.NPS_FILLED]);

function applyLOCF(rows: R[]): R[] {
  const sorted = [...rows].sort((a, b) =>
    normDate(a[KRS_COLS.DATE]).localeCompare(normDate(b[KRS_COLS.DATE]))
  );
  const last: Record<string, string> = {};
  return sorted.map(r => {
    const out = { ...r };
    NPS_KEYS.forEach(k => {
      if (!r[k] || r[k] === 'nan') { out[k] = last[k] ?? ''; }
      else last[k] = r[k];
    });
    return out;
  });
}

// ── I2R rolling 60-day for a specific date ────────────────────────────────────

function computeI2R(
  interviewRows: R[],
  modules:       string[],
  statusCol:     string,
  rejectedVal:   string,
  refDate:       string   // YYYY-MM-DD
): string | number {
  const end   = refDate;
  const start = new Date(new Date(refDate + 'T12:00:00').getTime() - 60 * 86400 * 1000)
                  .toISOString().slice(0, 10);

  const inWindow = interviewRows.filter(r => {
    const d   = normDate(r['Date of Call']);
    const mod = String(r['Related Module'] ?? '').trim();
    return d >= start && d <= end && modules.includes(mod);
  });

  if (!inWindow.length) return '';
  const rejected = inWindow.filter(r => String(r[statusCol] ?? '').trim() === rejectedVal).length;
  return Math.round(rejected / inWindow.length * 1000) / 10; // one decimal %
}

// ── Metric definitions ────────────────────────────────────────────────────────
// krsKey = null              → blank (KRS source not available)
// krsKey = 'R1+R2+R3'       → sum of three contest columns
// krsKey = {i2r spec}        → computed from Interview Experience sheet

interface I2RSpec {
  type:        'i2r';
  program:     string;
  modules:     string[];
  statusCol:   string;
  rejectedVal: string;
}

type MetricKey = string | null | I2RSpec;
interface MetricDef { label: string; krsKey: MetricKey }

// Academy
const ACADEMY_METRICS: MetricDef[] = [
  { label: 'Program NPS',                                              krsKey: KRS_COLS.NPS_RUNNING     },
  { label: 'Curriculum issues % MTD',                                  krsKey: KRS_COLS.NPS_CONCERN_PCT  },
  { label: 'Rolling I2H (60 days) for Full Time Certified Roles',      krsKey: null                      },
  { label: 'Rolling I2R (60 days) - SQL',                              krsKey: { type:'i2r', program:'Academy', modules:['Databases & SQL'], statusCol:'Status', rejectedVal:'Rejected' } },
  { label: 'Rolling I2R (60 days) - DSA',                              krsKey: { type:'i2r', program:'Academy', modules:['DSA'], statusCol:'Status', rejectedVal:'Rejected' } },
  { label: 'Total No. of lectures ( In T+7 )',                         krsKey: KRS_COLS.LECTURES_T7     },
  { label: '# lectures without scripts (T+7 days)',                    krsKey: null                      }, // no KRS equivalent
  { label: '# lectures without assignments (T+7 days)',                krsKey: KRS_COLS.NO_ASSIGN_T7    },
  { label: 'Total No. of lectures (T-1)',                              krsKey: KRS_COLS.LECTURES_T1     },
  { label: '# lectures without cue cards (T+7 days)',                  krsKey: KRS_COLS.NO_CUE_T7       },
  { label: '# lectures without pre-reads (T+7 days)',                  krsKey: KRS_COLS.NO_PRE_T7       },
  { label: '# lectures without post-reads (T+7 days)',                 krsKey: KRS_COLS.NO_POST_T7      },
  { label: '# Live contests (T+7 days)',                               krsKey: KRS_COLS.CONTESTS_T7     },
  { label: '# Contest Reattampts (T+7 days)',                          krsKey: 'R1+R2+R3'               },
  { label: '# of lectures with live attendance < 20 (D-1)',            krsKey: KRS_COLS.ATT_LT20        },
  { label: '# of lectures with live attendance drop > 5% (D-1)',       krsKey: KRS_COLS.ATT_DROP        },
  { label: 'Cue card Adherence',                                       krsKey: null                     },
  { label: '# rated cue cards (D-1)',                                  krsKey: KRS_COLS.CUE_RATED       },
  { label: '# cue cards rated < 5 (D-1)',                              krsKey: KRS_COLS.CUE_RATED_LT5   },
  { label: '# lectures rated < 4.6 (D-1)',                             krsKey: KRS_COLS.RATED_LT46      },
  { label: 'PSP% (T-7)',                                               krsKey: KRS_COLS.PSP_T7          },
  { label: 'No. of curriculum support tickets raised MTD',             krsKey: KRS_COLS.TICKETS_R       },
  { label: 'No. of curriculum support tickets raised (D-1)',           krsKey: KRS_COLS.TICKETS_D       },
  { label: 'No. of curriculum support tickets Unresolved',             krsKey: KRS_COLS.TICKETS_UNRES_R },
  { label: 'No. of curriculum support tickets > 24 hours (resolved mtd)', krsKey: KRS_COLS.TICKETS_GT24_R },
  { label: 'No. of certifications started',                            krsKey: null },
  { label: 'No. of certifications cleared',                            krsKey: null },
  { label: 'No of New Certified MTD',                                  krsKey: null },
  { label: 'No of SQL Contest Started',                                krsKey: null },
  { label: 'No of SQL Contest Cleared',                                krsKey: null },
  { label: 'No of SQL AI Mock Started',                                krsKey: null },
  { label: 'No of SQL AI Mock Cleared',                                krsKey: null },
  { label: 'No of DSA Contest Started',                                krsKey: null },
  { label: 'No of DSA Contest Cleared',                                krsKey: null },
  { label: 'No of DSA AI Mock Started',                                krsKey: null },
  { label: 'No of DSA AI Mock Cleared',                                krsKey: null },
];

// DSML
const DSML_METRICS: MetricDef[] = [
  { label: 'Program NPS',                                              krsKey: KRS_COLS.NPS_RUNNING     },
  { label: 'Curriculum issues % MTD',                                  krsKey: KRS_COLS.NPS_CONCERN_PCT },
  { label: 'Rolling I2H (60 days) for Full Time Certified Roles',      krsKey: null                    },
  { label: 'Rolling I2R (60 days) - SQL',                              krsKey: { type:'i2r', program:'DSML', modules:['SQL'], statusCol:'Final Status', rejectedVal:'Rejected' } },
  { label: 'Rolling I2R (60 days) - EDA',                              krsKey: { type:'i2r', program:'DSML', modules:['Data Analytics and Visualisation - Fundamentals','Data Analytics and Visualisation - Python Libraries','Tableau/ Power BI and Excel'], statusCol:'Final Status', rejectedVal:'Rejected' } },
  { label: 'Total No. of lectures ( In T+7 )',                         krsKey: KRS_COLS.LECTURES_T7    },
  { label: 'Total No. of lectures (T-1)',                              krsKey: KRS_COLS.LECTURES_T1    },
  { label: '# lectures without scripts (T+7 days)',                    krsKey: null                    },
  { label: '# lectures without assignments (T+7 days)',                krsKey: KRS_COLS.NO_ASSIGN_T7   },
  { label: '# lectures without cue cards (T+7 days)',                  krsKey: KRS_COLS.NO_CUE_T7      },
  { label: '# Live contests (T+7 days)',                               krsKey: KRS_COLS.CONTESTS_T7    },
  { label: '# Contest Reattampts (T+7 days)',                          krsKey: 'R1+R2+R3'              },
  { label: '# lectures without pre-reads (T+7 days)',                  krsKey: KRS_COLS.NO_PRE_T7      },
  { label: '# lectures without post-reads (T+7 days)',                 krsKey: KRS_COLS.NO_POST_T7     },
  { label: '# of lectures with live attendance < 20 (D-1)',            krsKey: KRS_COLS.ATT_LT20       },
  { label: '# of lectures with live attendance drop > 5% (D-1)',       krsKey: KRS_COLS.ATT_DROP       },
  { label: 'Cue Card Adherence',                                       krsKey: null                    },
  { label: '# rated cue cards (D-1)',                                  krsKey: KRS_COLS.CUE_RATED      },
  { label: '# cue cards rated < 5 (D-1)',                              krsKey: KRS_COLS.CUE_RATED_LT5  },
  { label: '# lectures rated < 4.6 (D-1)',                             krsKey: KRS_COLS.RATED_LT46     },
  { label: 'PSP% (T-7)',                                               krsKey: KRS_COLS.PSP_T7         },
  { label: 'No. of curriculum support tickets raised MTD',             krsKey: KRS_COLS.TICKETS_R      },
  { label: 'No. of curriculum support tickets raised (D-1)',           krsKey: KRS_COLS.TICKETS_D      },
  { label: 'No. of curriculum support tickets Unresolved',             krsKey: KRS_COLS.TICKETS_UNRES_R},
  { label: 'No. of curriculum support tickets > 24 hours (resolved mtd)', krsKey: KRS_COLS.TICKETS_GT24_R },
];

// DevOps
const DEVOPS_METRICS: MetricDef[] = [
  { label: 'Program NPS',                                              krsKey: KRS_COLS.NPS_RUNNING     },
  { label: 'Curriculum issues % MTD',                                  krsKey: KRS_COLS.NPS_CONCERN_PCT },
  { label: 'Rolling I2H (60 days) for Full Time Roles',                krsKey: null                    },
  { label: 'Rolling I2R (60 days) - Linux 2',                          krsKey: { type:'i2r', program:'DevOps', modules:['Linux'], statusCol:'Status', rejectedVal:'Rejected' } },
  { label: 'Rolling I2R (60 days) - DevOps Tools 2',                   krsKey: { type:'i2r', program:'DevOps', modules:['DevOps Tools'], statusCol:'Status', rejectedVal:'Rejected' } },
  { label: 'Rolling I2R (60 days) - AWS 2',                            krsKey: { type:'i2r', program:'DevOps', modules:['AWS'], statusCol:'Status', rejectedVal:'Rejected' } },
  { label: 'Total No. of lectures (T-1)',                              krsKey: KRS_COLS.LECTURES_T1    },
  { label: '# lectures rated < 4.6 (T-1)',                             krsKey: KRS_COLS.RATED_LT46     },
  { label: '# rated cue cards (T-1)',                                  krsKey: KRS_COLS.CUE_RATED      },
  { label: '# cue cards rated < 5 (T-1)',                              krsKey: KRS_COLS.CUE_RATED_LT5  },
  { label: '# of lectures with live attendance < 20',                  krsKey: KRS_COLS.ATT_LT20       },
  { label: '# of lectures with live attendance drop > 5%',             krsKey: KRS_COLS.ATT_DROP       },
  { label: '# lectures (T+7 days)',                                    krsKey: KRS_COLS.LECTURES_T7    },
  { label: '# lectures without scripts (T+7 days)',                    krsKey: null                    },
  { label: '# lectures without assignments (T+7 days)',                krsKey: KRS_COLS.NO_ASSIGN_T7   },
  { label: '# lectures without cue cards (T+7 days)',                  krsKey: KRS_COLS.NO_CUE_T7      },
  { label: '#Upcoming Live Contests (T+7 days)',                       krsKey: KRS_COLS.CONTESTS_T7    },
  { label: '# Upcoming R1(T+7 days)',                                  krsKey: KRS_COLS.R1_T7          },
  { label: '# Upcoming R2 (T+7 days)',                                 krsKey: KRS_COLS.R2_T7          },
  { label: '# Upcoming R3 (T+7 days)',                                 krsKey: KRS_COLS.R3_T7          },
  { label: '# lectures without pre-reads (T+7 days)',                  krsKey: KRS_COLS.NO_PRE_T7      },
  { label: '# lectures without post-reads (T+7 days)',                 krsKey: KRS_COLS.NO_POST_T7     },
  { label: 'PSP% (T-7)',                                               krsKey: KRS_COLS.PSP_T7         },
  { label: 'Rolling T-8 PSP %',                                        krsKey: KRS_COLS.PSP_ROLLING    },
  { label: 'No. of curriculum support tickets raised (MTD)',           krsKey: KRS_COLS.TICKETS_R      },
  { label: 'No. of curriculum support tickets > 24 hours (MTD)',       krsKey: KRS_COLS.TICKETS_GT24_R },
  { label: 'No. of curriculum support tickets unresolved (MTD)',       krsKey: KRS_COLS.TICKETS_UNRES_R},
  { label: 'No. of curriculum support tickets raised (DoD)',           krsKey: KRS_COLS.TICKETS_D      },
  { label: 'No. of curriculum support tickets > 24 hours (DoD)',       krsKey: KRS_COLS.TICKETS_GT24_D },
  { label: 'No. of curriculum support tickets unresolved > 24 hours (DoD)', krsKey: KRS_COLS.TICKETS_UNRES_D },
  { label: 'No. of eligible learners for Certification - Linux 2',    krsKey: null },
  { label: 'No. of eligible learners for Certification - DevOps Tools 2', krsKey: null },
  { label: 'No. of eligible learners for Certification - AWS 2',      krsKey: null },
  { label: 'No. of Learners cleared - Linux 2',                        krsKey: null },
  { label: 'No. of Learners cleared - DevOps Tools 2',                 krsKey: null },
  { label: 'No. of Learners cleared - AWS 2',                          krsKey: null },
  { label: 'No. of Learners cleared - Linux 2 + DT 2',                krsKey: null },
  { label: 'No. of Learners cleared - AWS 2 + DT 2',                   krsKey: null },
  { label: 'No. of Learners cleared - AWS 2 + Linux 2',                krsKey: null },
  { label: 'No. of Learners cleared - AWS 2 + Linux 2 + DT 2',         krsKey: null },
];

// AIML
const AIML_METRICS: MetricDef[] = [
  { label: 'Program NPS',                                              krsKey: KRS_COLS.NPS_RUNNING     },
  { label: 'Curriculum issues % MTD',                                  krsKey: KRS_COLS.NPS_CONCERN_PCT },
  { label: 'Total No. of lectures (T-1)',                              krsKey: KRS_COLS.LECTURES_T1    },
  { label: '# of lectures with live attendance < 20 (D-1)',            krsKey: KRS_COLS.ATT_LT20       },
  { label: '# of lectures with live attendance drop > 5% (D-1)',       krsKey: KRS_COLS.ATT_DROP       },
  { label: '# rated cue cards (D-1)',                                  krsKey: KRS_COLS.CUE_RATED      },
  { label: '# cue cards rated < 5 (D-1)',                              krsKey: KRS_COLS.CUE_RATED_LT5  },
  { label: '# lectures rated < 4.6 (D-1)',                             krsKey: KRS_COLS.RATED_LT46     },
  { label: 'Total No. of lectures ( In T+7 )',                         krsKey: KRS_COLS.LECTURES_T7    },
  { label: '# lectures without scripts (T+7 days)',                    krsKey: null                    },
  { label: '# lectures without assignments (T+7 days)',                krsKey: KRS_COLS.NO_ASSIGN_T7   },
  { label: '# lectures without cue cards (T+7 days)',                  krsKey: KRS_COLS.NO_CUE_T7      },
  { label: '# lectures without pre-reads (T+7 days)',                  krsKey: KRS_COLS.NO_PRE_T7      },
  { label: '# lectures without post-reads (T+7 days)',                 krsKey: KRS_COLS.NO_POST_T7     },
  { label: '# Live contests (T+7 days)',                               krsKey: KRS_COLS.CONTESTS_T7    },
  { label: '# Contest Reattampts (T+7 days)',                          krsKey: 'R1+R2+R3'              },
  { label: 'PSP% (T-7)',                                               krsKey: KRS_COLS.PSP_T7         },
  { label: 'No. of curriculum support tickets raised MTD',             krsKey: KRS_COLS.TICKETS_R      },
  { label: 'No. of curriculum support tickets raised (D-1)',           krsKey: KRS_COLS.TICKETS_D      },
  { label: 'No. of curriculum support tickets Unresolved',             krsKey: KRS_COLS.TICKETS_UNRES_R},
  { label: 'No. of curriculum support tickets > 24 hours',            krsKey: KRS_COLS.TICKETS_GT24_R },
];

const PROGRAM_METRICS: Record<string, MetricDef[]> = {
  Academy: ACADEMY_METRICS,
  DSML:    DSML_METRICS,
  DevOps:  DEVOPS_METRICS,
  AIML:    AIML_METRICS,
};

// ── Interview tabs per program ────────────────────────────────────────────────
const INTERVIEW_TAB_MAP: Record<string, string> = {
  Academy: INTERVIEW_TABS.ACADEMY,
  DSML:    INTERVIEW_TABS.DSML,
  DevOps:  INTERVIEW_TABS.DEVOPS,
};

// ── Get metric value from KRS or I2R ─────────────────────────────────────────
function getValue(
  krsRow:        R | undefined,
  krsKey:        MetricKey,
  interviewRows: R[],
  date:          string
): string | number {
  if (!krsKey) return '';
  if (typeof krsKey === 'object' && krsKey.type === 'i2r') {
    return computeI2R(interviewRows, krsKey.modules, krsKey.statusCol, krsKey.rejectedVal, date);
  }
  if (!krsRow) return '';
  if (krsKey === 'R1+R2+R3') {
    const r1 = parseFloat(krsRow[KRS_COLS.R1_T7] ?? '') || 0;
    const r2 = parseFloat(krsRow[KRS_COLS.R2_T7] ?? '') || 0;
    const r3 = parseFloat(krsRow[KRS_COLS.R3_T7] ?? '') || 0;
    return r1 + r2 + r3 || '';
  }
  const v = krsRow[krsKey as string];
  if (!v || v === 'nan') return '';
  const n = parseFloat(v);
  return isNaN(n) ? '' : n;
}

// ── Ensure tab exists ────────────────────────────────────────────────────────
async function ensureTabExists(spreadsheetId: string, tabName: string): Promise<void> {
  const sheets = getWriteClient();
  const meta   = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  if ((meta.data.sheets ?? []).some(s => s.properties?.title === tabName)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
  });
}

// ── Write a block of columns in ONE API call ──────────────────────────────────
// matrix[rowIdx][colIdx] = value (row-major: first dim = rows, second = new-date-columns)
async function writeColumnBlock(
  spreadsheetId: string,
  tabName:       string,
  startColIdx:   number,
  matrix:        (string | number)[][]  // matrix[row][newDateCol]
): Promise<void> {
  if (!matrix.length || !matrix[0].length) return;
  const sheets   = getWriteClient();
  const numRows  = matrix.length;
  const numCols  = matrix[0].length;
  const endCol   = startColIdx + numCols - 1;
  const range    = `${tabName}!${colLetter(startColIdx)}1:${colLetter(endCol)}${numRows}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: matrix.map(row => row.map(v => v === '' ? '' : v)) },
  });
}

// ── Write a single label column (Metric names / Source Link) ─────────────────
async function writeColumn(
  spreadsheetId: string,
  tabName:       string,
  colIdx:        number,
  values:        (string | number)[]
): Promise<void> {
  await writeColumnBlock(spreadsheetId, tabName, colIdx, values.map(v => [v]));
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface BackfillResult { program: string; newDates: number; totalDates: number }

export async function runBackfill(): Promise<{ results: BackfillResult[]; sheetUrl: string }> {
  if (!LO_BACKFILL_SHEET_ID) throw new Error('LO_BACKFILL_SHEET_ID not configured.');

  const PROGRAMS = [
    { name: 'Academy', krsTab: LO_TABS.KRS_ACADEMY },
    { name: 'DSML',    krsTab: LO_TABS.KRS_DSML    },
    { name: 'DevOps',  krsTab: LO_TABS.KRS_DEVOPS  },
    { name: 'AIML',    krsTab: LO_TABS.KRS_AIML    },
  ];

  const results: BackfillResult[] = [];

  for (const prog of PROGRAMS) {
    const metrics = PROGRAM_METRICS[prog.name];
    if (!metrics) continue;

    // Fetch interview rows for I2R (if available)
    let interviewRows: R[] = [];
    const interviewTab = INTERVIEW_TAB_MAP[prog.name];
    if (INTERVIEW_SHEET_ID && interviewTab) {
      try { interviewRows = await fetchTab(INTERVIEW_SHEET_ID, interviewTab); }
      catch { /* I2R stays blank if unavailable */ }
    }

    await ensureTabExists(LO_BACKFILL_SHEET_ID, prog.name);

    // Read current sheet header to find existing dates
    const existing    = await readAllRows(LO_BACKFILL_SHEET_ID, prog.name);
    const headerRow   = existing[0] ?? [];
    const DATA_START  = 2; // col A = Metric, col B = Source Link, col C+ = dates
    const existingDates = new Set(headerRow.slice(DATA_START).map(d => normDate(String(d))));

    // Read + LOCF KRS data
    const krsRows  = await fetchTab(LO_SHEET_IDS.KRS, prog.krsTab);
    const krsLoced = applyLOCF(krsRows);
    const krsByDate = new Map<string, R>();
    krsLoced.forEach(r => { const d = normDate(r[KRS_COLS.DATE]); if (d) krsByDate.set(d, r); });

    const allDates = Array.from(krsByDate.keys()).sort();
    const newDates = allDates.filter(d => !existingDates.has(d));

    // First run: initialise metric label columns
    const isFirstRun = headerRow.length < DATA_START + 1;
    if (isFirstRun) {
      await writeColumn(LO_BACKFILL_SHEET_ID, prog.name, 0, ['Metric',       ...metrics.map(m => m.label)]);
      await writeColumn(LO_BACKFILL_SHEET_ID, prog.name, 1, ['Source Link',  ...metrics.map(() => '')]);
    }

    // Append new date columns — built as a row-major matrix, written in ONE API call
    // matrix[row][newDateColIndex]: row 0 = date headers, rows 1..N = metric values
    if (newDates.length > 0) {
      const numMetrics = metrics.length;
      const matrix: (string | number)[][] = Array.from({ length: numMetrics + 1 }, () => []);

      newDates.forEach(date => {
        const krsRow = krsByDate.get(date);
        matrix[0].push(date); // header row: date string
        metrics.forEach((m, mIdx) => {
          matrix[mIdx + 1].push(getValue(krsRow, m.krsKey, interviewRows, date));
        });
      });

      const startColIdx = isFirstRun ? DATA_START : headerRow.length;
      await writeColumnBlock(LO_BACKFILL_SHEET_ID!, prog.name, startColIdx, matrix);
    }

    results.push({ program: prog.name, newDates: newDates.length, totalDates: existingDates.size + newDates.length });
  }

  return { results, sheetUrl: `https://docs.google.com/spreadsheets/d/${LO_BACKFILL_SHEET_ID}/edit` };
}
