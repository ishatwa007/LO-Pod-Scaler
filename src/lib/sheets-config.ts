// All sheet IDs are read from environment variables — never hardcoded.
// Set these in Vercel dashboard → Settings → Environment Variables
// or in .env.local for local development.

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback ?? '';
  if (!val) console.warn(`[sheets-config] Missing env var: ${key}`);
  return val;
}

export const SHEET_IDS = {
  MAIN:     env('CERT_MAIN_SHEET_ID'),
  SHEET2:   env('CERT_SHEET2_ID'),
  SHEET3:   env('CERT_SHEET3_ID'),
  SHEET4:   env('CERT_SHEET4_ID'),
  AI_MOCK:  env('AI_MOCK_SHEET_ID'),
} as const;

export const TABS = {
  DOD:      'DOD',
  MOM:      'MOM',
  OVERALL:  'Overall Certifications',
  LC:       'Live Contests',
  S4:       'Main',
  AI_MOCK:  'All Attempts',
} as const;

export const DOD = {
  ACADEMY_BASIC:    'Academy 1. Basic Certification',
  ACADEMY_DSA:      'Academy 2. DSA',
  ACADEMY_SQL:      'Academy 3. Academy SQL',
  ACADEMY_DSA_SQL:  'Academy 4. DSA, SQL',
  ACADEMY_LANG:     'Academy 5. Language',
  ACADEMY_FULL:     'Academy 6. DSA, SQL, Language',
  DSML_BASIC:       'DSML 1. Basic Certification',
  DSML_SQL:         'DSML 2. DSML SQL',
  DSML_EDA:         'DSML 3. EDA',
  DSML_SQL_EDA:     'DSML 4. DSML SQL, EDA',
  DSML_PYLIB:       'DSML 5. Python Libraries',
  DSML_FULL:        'DSML 6. SQL, EDA, Python L',
  DEVOPS_LINUX:     'DevOps 2. Linux',
  DEVOPS_TOOLS:     'DevOps 3. DevOps Tools',
  DEVOPS_AWS:       'DevOps 4. AWS',
  DEVOPS_LT:        'DevOps 5. Linux, Tools',
  DEVOPS_FULL:      'DevOps 6. Tools, AWS',
} as const;

export const SKILL_FILTERS = {
  academy_dsa:  (m: string) => /dsa|data structure|algorithm|problem solving/i.test(m),
  academy_sql:  (m: string) => /sql|database/i.test(m),
  dsml_sql:     (m: string) => /sql|database/i.test(m),
  dsml_eda:     (m: string) => /eda|data analytics|ml|python|tableau|analytics|stats|product/i.test(m),
  devops_linux: (m: string) => /linux/i.test(m),
  devops_tools: (m: string) => /devops|tools|backend lld|lld/i.test(m),
  devops_aws:   (m: string) => /aws/i.test(m),
} as const;

export const PROGRAM_BATCH_PREFIX = {
  Academy: 'Academy',
  DSML:    'DSML',
  DevOps:  'DevOps',
} as const;

// Notes: Timestamp|Program|MetricId|NoteDate|Author|Note
export const NOTES_SHEET_ID = env('NOTES_SHEET_ID');
export const NOTES_RANGE    = 'Notes!A:F';

// ── LO Ops Sheet IDs ───────────────────────────────────────────────────────
export const LO_BACKFILL_SHEET_ID = env('LO_BACKFILL_SHEET_ID');

export const LO_CONTENT_ISSUES_SHEET_ID = env('LO_CONTENT_ISSUES_SHEET_ID');
export const LO_CONTENT_ISSUES_TAB = 'Sheet1';

export const CORTEX_SHEET_ID = env('CORTEX_SHEET_ID');
export const CORTEX_TABS = {
  PCT_FUNNEL:     '% Course Completed Funnel',
  DOD_VISITS:     'DOD Page Visits',
  WOW_VISITS:     'WOW Page Visits',
  DOD_COMPLETION: 'DOD Completion',
  WOW_COMPLETION: 'WOW Completion',
} as const;
export const CORTEX_PROGRAMS: Record<string, string[]> = {
  Academy: ['Data Structures and Algorithms Mastery', 'Full Stack Interview Mastery', 'DSA 7 days Crash Course'],
  DSML:    ['Data Analytics'],
  DevOps:  ['DevOps Engineer Interview', 'DevOps Fundamentals - Career Launch'],
};

export const INTERVIEW_SHEET_ID     = env('INTERVIEW_SHEET_ID');
export const INTERVIEW_TABS = {
  ACADEMY: 'Questions | Academy',
  DSML:    'Questions | DSML',
  DEVOPS:  'Questions | DevOps',
} as const;

export const LO_SHEET_IDS = {
  KRS:            env('LO_KRS_SHEET_ID'),
  WEEKLY_SYNC:    env('LO_WEEKLY_SYNC_SHEET_ID'),
  DUMP_NO_STATIC: env('LO_DUMP_NO_STATIC_SHEET_ID'),
  RED_FLAGS:      env('LO_RED_FLAGS_SHEET_ID'),
  KRS_DUMP:       env('LO_KRS_DUMP_SHEET_ID'),
} as const;

export const LO_TABS = {
  KRS_ACADEMY:    'Academy',
  KRS_DSML:       'DSML',
  KRS_DEVOPS:     'Devops',
  KRS_AIML:       'AIML',
  WS_ACADEMY:     'Academy',
  WS_DSML:        'DSML',
  WS_DEVOPS:      'DevOps',
  WS_AIML:        'AIML ',
  RF_RAW:         'Raw',
  RF_MTD:         'MTD Report',
  DUMP_COMPLETED: 'Completed Classes',
  DUMP_UPCOMING:  'Upcoming Classes',
  DUMP_CONTESTS:  'Upcoming Contests',
  DUMP_ATT_DROP:  'Attendance Drop',
  DUMP_ATT_LT20:  'Live Attended Less than 20 Dump',
  DUMP_PSP:       'PSP Dump',
  DUMP_TICKETS:   'Support Tickets',
  DUMP_CUE_ADH:   'Cue Card Adherence',
} as const;

export const KRS_COLS = {
  DATE:            'Date',
  LECTURES_T1:     'T Minus 1 Classes',
  LECTURES_T7:     'Upcoming T Plus 7 Classes',
  RATED_LT46:      'Rating < 4.6 Classes',
  CUE_RATED:       'Cue Cards Rated',
  CUE_RATED_LT5:   'Cue Card Rated < 5',
  CONTESTS_T7:     'Upcoming Live Contests',
  R1_T7:           'Upcoming R1 Contests',
  R2_T7:           'Upcoming R2 Contests',
  R3_T7:           'Upcoming R3 Contests',
  NO_CUE_T7:       'No Cuecard Next Seven Days',
  NO_ASSIGN_T7:    'No Assignment Next Seven Days',
  NO_PRE_T7:       'No Pre Lecture Content Seven Days',
  NO_POST_T7:      'No Post Lecture Content Next Seven Days',
  ATT_DROP:        'Live Attendance Dropped Classes',
  PSP_T7:          'Psp Within 7',
  PSP_ROLLING:     'Rolling T Minus 8 Psp Within 7',
  ATT_LT20:        'Live Attendance < 20 Classes',
  TICKETS_D:       'Curriculum Support Tickets',
  TICKETS_GT24_D:  'Curriculum Support Tickets Resolved After 24 Hours',
  TICKETS_UNRES_D: 'Curriculum Support Tickets Unresolved',
  TICKETS_R:       'Running Curriculum Support Tickets',
  TICKETS_GT24_R:  'Running Curriculum Support Tickets Resolved After 24 Hours',
  TICKETS_UNRES_R: 'Running Curriculum Support Tickets Unresolved',
  NPS_FILLED:      'Running Filled Nps',
  NPS_RUNNING:     'Running Nps',
  NPS_CONCERN_PCT: 'Running % Learners Curriculum Concerns Nps',
} as const;

export const WS_METRICS = {
  NPS:        'Program NPS',
  CURRIC_PCT: 'Curriculum issues % MTD',
  I2H:        'Rolling I2H (60 days) for Full Time Certified Roles',
  I2R_SQL:    'Rolling I2R (60 days) - SQL',
  I2R_EDA:    'Rolling I2R (60 days) - EDA',
  I2R_DSA:    'Rolling I2R (60 days) - DSA',
} as const;
