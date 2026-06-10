import { NextRequest } from 'next/server';
import { fetchTab } from '@/lib/sheets';
import { SHEET_IDS, TABS } from '@/lib/sheets-config';
import { parseDate } from '@/lib/metrics';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type R = Record<string, string>;

const PROGRAM_MAP: Record<string, string> = {
  academy: 'academy', Academy: 'academy',
  dsml:    'dsml',    DSML: 'dsml',
  devops:  'devops',  DevOps: 'devops',
  aiml:    '',        AIML: '',
};

const TEST_FILTER: Record<string, RegExp | null> = {
  dsa_mock_started:      /^dsa$/i,
  dsa_mock_cleared:      /^dsa$/i,
  sql_mock_started:      /academy sql/i,
  sql_mock_cleared:      /academy sql/i,
  dsml_sql_mock_started: /dsml sql/i,
  dsml_sql_mock_cleared: /dsml sql/i,
  eda_mock_started:      /^eda$/i,
  eda_mock_cleared:      /^eda$/i,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program  = searchParams.get('program')  || 'Academy';
    const metricId = searchParams.get('metric')   || '';
    const date     = searchParams.get('date')     || '';
    const month    = searchParams.get('month')    || '';

    const allRows: R[] = await fetchTab(SHEET_IDS.AI_MOCK, TABS.AI_MOCK);

    const progKey = PROGRAM_MAP[program] || program.toLowerCase();
    const testRe  = TEST_FILTER[metricId] ?? null;

    // Filter by program
    let rows = allRows.filter(r => {
      const p = String(r['Program'] ?? '').toLowerCase().trim();
      if (progKey === '') {
        // AIML: null program + batch starts with AIML
        return !r['Program'] && String(r['Batch'] ?? '').toUpperCase().startsWith('AIML');
      }
      return p === progKey;
    });

    // Filter by test name if applicable
    if (testRe) rows = rows.filter(r => testRe.test(String(r['test name'] ?? '')));

    // For "cleared" metrics only show rating 7 or 9
    const isCleared = metricId.endsWith('_cleared');
    if (isCleared) {
      rows = rows.filter(r => {
        const rating = parseFloat(r['rating'] ?? '');
        return rating === 7 || rating === 9;
      });
    } else {
      // "attempted" = completed status
      rows = rows.filter(r => String(r['status'] ?? '') === 'completed');
    }

    // Date filter
    if (date) {
      rows = rows.filter(r => parseDate(r['date time']).slice(0, 10) === date);
    } else if (month) {
      rows = rows.filter(r => parseDate(r['date time']).slice(0, 7) === month);
    }

    const display = rows.slice(0, 500).map(r => ({
      name:      r['Name']     || '',
      email:     r['email']    || '',
      batch:     r['Batch']    || '',
      test_name: r['test name'] || '',
      rating:    r['rating']   || '',
      date_time: r['date time'] || '',
      result:    r['result']   || '',
    }));

    return Response.json({ rows: display, total: rows.length });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
