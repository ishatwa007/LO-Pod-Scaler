import { NextRequest } from 'next/server';
import { fetchTab } from '@/lib/sheets';
import { LO_SHEET_IDS, LO_TABS } from '@/lib/sheets-config';
import { parseDate } from '@/lib/metrics';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type R = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normalise program name for comparison (case-insensitive, ignore spaces)
function normProg(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

// Get a value from a row trying multiple key variants (case-insensitive)
function getCol(r: R, ...keys: string[]): string {
  for (const k of keys) {
    if (r[k] !== undefined) return String(r[k]);
    // Try lowercase variant
    const kl = k.toLowerCase();
    if (r[kl] !== undefined) return String(r[kl]);
    // Try finding a case-insensitive match
    const match = Object.keys(r).find(rk => rk.toLowerCase() === kl);
    if (match) return String(r[match]);
  }
  return '';
}

// Normalise date from any format to YYYY-MM-DD
function normDate(raw: string): string {
  if (!raw || raw === 'nan') return '';
  const s = String(raw).trim();
  // ISO already
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Slash MM/DD/YYYY or DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2,'0')}-${slash[2].padStart(2,'0')}`;
  // Try parseDate helper
  return parseDate(raw).slice(0, 10);
}

// Match a row's program to the requested program (case-insensitive)
function matchProgram(r: R, program: string): boolean {
  const p = normProg(getCol(r, 'program', 'Program'));
  const target = normProg(program);
  // DevOps also stored as "devops", "Devops", "DevOps"
  return p === target;
}

// Get the date field from a row (tries all common column names)
function getRowDate(r: R): string {
  return normDate(
    getCol(r, 'class_date', 'Class Date', 'created_at', 'live_attendance_date',
              'contest_start_time', 'date', 'Date')
  );
}

// ── Display columns ───────────────────────────────────────────────────────────
// Each entry lists preferred column names; getCol tries them all case-insensitively

const DISPLAY_DEFS: Record<string, { label: string; keys: string[] }[]> = {
  'Completed Classes': [
    { label: 'Date',       keys: ['class_date','Class Date'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Module',     keys: ['module_name','Module Name'] },
    { label: 'Topic',      keys: ['class_topic','Class Topic'] },
    { label: 'Instructor', keys: ['instructor_name','Instructor Name'] },
    { label: 'Batches',    keys: ['sb_names','Sb Names'] },
    { label: 'Rating',     keys: ['class_rating','Class Rating'] },
    { label: 'CC Rated',   keys: ['cue_card_rated','Cue Card Rated'] },
  ],
  'Upcoming Classes': [
    { label: 'Date',       keys: ['class_date','Class Date'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Module',     keys: ['module_name','Module Name'] },
    { label: 'Topic',      keys: ['class_topic','Class Topic'] },
    { label: 'Instructor', keys: ['instructor_name','Instructor Name'] },
    { label: 'Batches',    keys: ['sb_names','Sb Names'] },
  ],
  'Upcoming Contests': [
    { label: 'Start',      keys: ['contest_start_time'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Module',     keys: ['module_name','Module Name'] },
    { label: 'Contest',    keys: ['contest_name','Contest Name'] },
    { label: 'Seq',        keys: ['seq_num'] },
    { label: 'Cutoff',     keys: ['contest_cutoff'] },
    { label: 'Batches',    keys: ['sb_names','Sb Names'] },
  ],
  'Attendance Drop': [
    { label: 'Date',       keys: ['class_date','Class Date'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Module',     keys: ['module_name','Module Name'] },
    { label: 'Topic',      keys: ['class_topic','Class Topic'] },
    { label: 'Batches',    keys: ['batches','Batches'] },
    { label: 'Live%',      keys: ['live_pct','Live Pct'] },
    { label: 'Drop%',      keys: ['live_attendance_drop','Live Attendance Drop'] },
  ],
  'Live Attended Less than 20 Dump': [
    { label: 'Date',       keys: ['live_attendance_date'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Module',     keys: ['module_name','Module Name'] },
    { label: 'Topic',      keys: ['class_topic','Class Topic'] },
    { label: 'Batches',    keys: ['batches','Batches'] },
    { label: 'Eligible',   keys: ['eligible_learners'] },
    { label: 'Attended',   keys: ['live_attended_learners'] },
  ],
  'PSP Dump': [
    { label: 'Date',       keys: ['class_date','Class Date'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Module',     keys: ['module_name','Module Name'] },
    { label: 'Topic',      keys: ['class_topic','Class Topic'] },
    { label: 'Batches',    keys: ['sb_names','Sb Names'] },
    { label: 'Solved',     keys: ['solved_problems_within_7'] },
    { label: 'Total',      keys: ['total_assignment_problems'] },
    { label: 'PSP%',       keys: ['psp','Psp'] },
  ],
  'Support Tickets': [
    { label: 'Created',    keys: ['created_at','Created At'] },
    { label: 'Program',    keys: ['program','Program'] },
    { label: 'Status',     keys: ['ticket_status','Ticket Status'] },
    { label: 'Sub-Status', keys: ['ticket_sub_status','Ticket Sub Status'] },
    { label: 'Resolved',   keys: ['resolved_at','Resolved At'] },
  ],
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program  = searchParams.get('program')  || 'Academy';
    const drillTab = searchParams.get('tab')       || '';
    const date     = searchParams.get('date')      || '';
    const month    = searchParams.get('month')     || '';

    if (!drillTab) return Response.json({ error: 'tab is required' }, { status: 400 });

    // ── Cue Card Instructor drill ─────────────────────────────────────────────
    if (drillTab === 'Cue Card Instructors') {
      const rows: R[] = await fetchTab(LO_SHEET_IDS.RED_FLAGS, LO_TABS.RF_RAW);

      let filtered = rows.filter(r => matchProgram(r, program));
      if (date)  filtered = filtered.filter(r => normDate(getCol(r, 'Class Date','class_date')) === date);
      else if (month) filtered = filtered.filter(r => normDate(getCol(r, 'Class Date','class_date')).slice(0, 7) === month);

      const instMap = new Map<string, { name: string; email: string; played: number; total: number; classes: number }>();
      filtered.forEach(r => {
        const name  = getCol(r, 'Instructor Name', 'instructor_name').trim();
        const email = getCol(r, 'Instructor Email', 'instructor_email').trim();
        if (!name) return;
        const played = parseFloat(getCol(r, 'Played Cue Card', 'played_cue_card') || '0');
        const total  = parseFloat(getCol(r, 'Total Cue Card',  'total_cue_card')  || '0');
        if (isNaN(played) || isNaN(total)) return;
        const key = email || name;
        const ex = instMap.get(key);
        if (ex) { ex.played += played; ex.total += total; ex.classes++; }
        else instMap.set(key, { name, email, played, total, classes: 1 });
      });

      const instructors = Array.from(instMap.values()).map(i => ({
        name:      i.name,
        email:     i.email,
        classes:   i.classes,
        played:    i.played,
        total:     i.total,
        adherence: i.total > 0 ? Math.round(i.played / i.total * 1000) / 10 : 0,
      })).sort((a, b) => b.adherence - a.adherence);

      return Response.json({
        rows: instructors,
        total: instructors.length,
        columns: ['name','email','classes','played','total','adherence'],
        tab: 'Cue Card Instructors',
      });
    }

    // ── Standard drill ────────────────────────────────────────────────────────
    let sheetId = LO_SHEET_IDS.DUMP_NO_STATIC;
    let tab     = drillTab;
    if (drillTab === 'Red Flags Raw') {
      sheetId = LO_SHEET_IDS.RED_FLAGS;
      tab = LO_TABS.RF_RAW;
    }

    const rows: R[] = await fetchTab(sheetId, tab);

    // Filter by program (case-insensitive)
    let filtered = rows.filter(r => matchProgram(r, program));

    // Filter by date (try all common date columns)
    if (date) {
      filtered = filtered.filter(r => getRowDate(r) === date);
    } else if (month) {
      filtered = filtered.filter(r => getRowDate(r).slice(0, 7) === month);
    }

    // Build display using DISPLAY_DEFS with case-insensitive column lookup
    const defs = DISPLAY_DEFS[drillTab];
    let display: Record<string, string>[];
    let columns: string[];

    if (defs) {
      columns = defs.map(d => d.label);
      display = filtered.slice(0, 300).map(r =>
        Object.fromEntries(defs.map(d => [d.label, getCol(r, ...d.keys)]))
      );
    } else {
      // Fallback: first 8 columns of whatever the sheet has
      const keys = Object.keys(filtered[0] ?? {}).slice(0, 8);
      columns = keys;
      display = filtered.slice(0, 300).map(r =>
        Object.fromEntries(keys.map(k => [k, String(r[k] ?? '')]))
      );
    }

    // Debug info when empty
    const debugInfo = filtered.length === 0 && rows.length > 0 ? {
      totalSheetRows: rows.length,
      samplePrograms: rows.slice(0,5).map((r: R) => getCol(r,'program','Program')),
      requestedProgram: program,
      sampleDates: rows.slice(0,5).map((r: R) => getRowDate(r)).filter(Boolean),
      requestedDate: date || month,
    } : undefined;

    return Response.json({ rows: display, total: filtered.length, columns, tab: drillTab, debugInfo });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
