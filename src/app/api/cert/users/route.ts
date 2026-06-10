import { NextRequest } from 'next/server';
import { fetchTab } from '@/lib/sheets';
import { SHEET_IDS, TABS, SKILL_FILTERS } from '@/lib/sheets-config';
import { parseDate } from '@/lib/metrics';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type R = Record<string, string>;

// metricId → Sheet 4 date column that defines "started" or "cleared"
const METRIC_TO_S4_COL: Record<string, string> = {
  dsa_contest_started:       'DSA MBE',
  dsa_contest_cleared:       'DSA Contest',
  sql_contest_started:       'Academy SQL MBE',
  sql_contest_cleared:       'Academy SQL Contest',
  dsml_sql_contest_started:  'DSML SQL MBE',
  dsml_sql_contest_cleared:  'DSML SQL Contest',
  eda_contest_started:       'EDA MBE',
  eda_contest_cleared:       'EDA Contest',
  linux_contest_started:     'Linux MBE',
  linux_contest_cleared:     'Linux Contest',
  tools_contest_started:     'DevOps Tools MBE',
  tools_contest_cleared:     'DevOps Tools Contest',
  aws_contest_started:       'AWS MBE',
  aws_contest_cleared:       'AWS Contest',
};

// Program filter for AI Mock sheet
function matchesProgram(r: R, program: string): boolean {
  const p = String(r['Program'] ?? '').toLowerCase().trim();
  const batch = String(r['Batch'] ?? '');
  if (program === 'Academy') return p === 'academy' || p === 'us_academy';
  if (program === 'DSML')    return p === 'dsml';
  if (program === 'DevOps')  return p === 'devops';
  if (program === 'AIML')    return (p === '' || p === 'nan') && batch.startsWith('AIML');
  return false;
}

// Test-name regex per metric id segment
function testRegex(metricId: string, program: string): RegExp | null {
  if (metricId.includes('dsa'))                               return /^dsa$/i;
  if (metricId.includes('sql') && program === 'DSML')        return /dsml sql/i;
  if (metricId.includes('sql'))                               return /academy sql/i;
  if (metricId.includes('eda'))                               return /^eda$/i;
  if (metricId.includes('linux'))                             return /linux/i;
  if (metricId.includes('tools'))                             return /devops tools|devops dsa/i;
  if (metricId.includes('aws'))                               return /aws/i;
  return null; // no test filter → all tests for program
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program     = searchParams.get('program')  || 'Academy';
    const metricId    = searchParams.get('metricId') || '';
    const dateFilter  = searchParams.get('date')     || '';
    const batchFilter = searchParams.get('batch')    || '';

    const isMock  = metricId.includes('mock');
    const s4Col   = METRIC_TO_S4_COL[metricId];

    // ── AI Mock → actual attempt data from AI Mock Google Sheet ──────────────
    if (isMock) {
      const rows: R[] = await fetchTab(SHEET_IDS.AI_MOCK, TABS.AI_MOCK);

      const isCleared  = metricId.includes('cleared');
      const testFilter = testRegex(metricId, program);

      let filtered = rows.filter(r => matchesProgram(r, program));

      // Apply test-name filter if present
      if (testFilter) {
        filtered = filtered.filter(r => testFilter.test(String(r['test name'] ?? '')));
      }

      // Attempted: status = completed | Cleared: rating 7 or 9
      if (isCleared) {
        filtered = filtered.filter(r => {
          const rt = parseFloat(String(r['rating'] ?? ''));
          return rt === 7 || rt === 9;
        });
      } else {
        filtered = filtered.filter(r => String(r['status'] ?? '') === 'completed');
      }

      if (batchFilter) filtered = filtered.filter(r => r['Batch'] === batchFilter);
      if (dateFilter)  {
        filtered = filtered.filter(r => {
          const raw = String(r['date time'] ?? '');
          // Handle various date formats robustly
          const d = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
            ? raw.slice(0, 10)
            : raw.replace(/[/\\]/g, '-').slice(0, 10);
          return d === dateFilter;
        });
      }

      const ratingLabel: Record<number, string> = {
        9: 'Strong Hire', 7: 'Weak Hire',
        4: 'Weak Reject', 2: 'Strong Reject',
        0: 'Incomplete', [-1]: 'Disqualified',
      };

      const users = filtered.slice(0, 500).map(r => {
        const rt = parseFloat(String(r['rating'] ?? ''));
        return {
          userId:      String(r['User ID']       ?? ''),
          name:        String(r['Name']          ?? ''),
          email:       String(r['email']         ?? ''),
          batch:       String(r['Batch']         ?? ''),
          contestName: String(r['test name']     ?? ''),
          status:      String(r['status']        ?? ''),
          passed:      isCleared ? 'Yes' : '',
          miScore:     isNaN(rt) ? '' : String(rt),
          miStatus:    isNaN(rt) ? '' : (ratingLabel[rt] ?? String(rt)),
          startDate:   String(r['date time'] ?? '').slice(0, 10),
          certDate:    '',
        };
      });

      return Response.json({ users, total: filtered.length, source: 'ai_mock' });
    }

    // ── Contest / cert rows → Sheet 4 ─────────────────────────────────────────
    if (!s4Col) return Response.json({ users: [], total: 0, source: 'none' });

    const s4Rows: R[] = await fetchTab(SHEET_IDS.SHEET4, TABS.S4);
    const normProg = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    let rows = s4Rows.filter(r => normProg(String(r['Program'] ?? '')) === normProg(program));

    if (batchFilter) rows = rows.filter(r => r['Batch'] === batchFilter || r['Batch Name'] === batchFilter);
    if (dateFilter)  rows = rows.filter(r => parseDate(r[s4Col]).slice(0, 10) === dateFilter);
    else             rows = rows.filter(r => r[s4Col]?.trim());

    const users = rows.slice(0, 500).map(r => ({
      userId:      r['User ID']    || '',
      name:        r['Name']       || '',
      email:       r['Email']      || '',
      batch:       r['Batch']      || r['Batch Name'] || '',
      contestName: s4Col,
      status:      '',
      passed:      '',
      miScore:     '',
      miStatus:    '',
      startDate:   '',
      certDate:    parseDate(r[s4Col]).slice(0, 10),
      dsa:         parseDate(r['DSA MBE']          ?? '').slice(0, 10),
      sql:         parseDate(r['Academy SQL MBE']  ?? '').slice(0, 10),
    }));

    const debugInfo = rows.length === 0 && s4Rows.length > 0 ? {
      totalSheetRows: s4Rows.length,
      samplePrograms: s4Rows.slice(0,5).map((r: Record<string,string>) => String(r['Program'] ?? '')),
      requestedProgram: program,
      s4Col,
      requestedDate: dateFilter,
    } : undefined;

    return Response.json({ users, total: rows.length, source: 'sheet4', debugInfo });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
