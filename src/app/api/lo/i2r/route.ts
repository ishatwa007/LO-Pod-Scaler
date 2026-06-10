import { NextRequest } from 'next/server';
import { fetchTab } from '@/lib/sheets';
import { INTERVIEW_SHEET_ID, INTERVIEW_TABS } from '@/lib/sheets-config';
import { computeI2R, drillI2R } from '@/lib/lo-i2r';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const TAB_MAP: Record<string, string> = {
  Academy: INTERVIEW_TABS.ACADEMY,
  DSML:    INTERVIEW_TABS.DSML,
  DevOps:  INTERVIEW_TABS.DEVOPS,
  AIML:    '',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program  = searchParams.get('program') || 'Academy';
    const drill    = searchParams.get('drill')   || '';   // metricId if drill-down
    const date     = searchParams.get('date')    || '';   // for drill
    const month    = searchParams.get('month')   || '';   // for drill
    const fromDate = searchParams.get('from')    || '';
    const toDate   = searchParams.get('to')      || '';

    const tab = TAB_MAP[program];
    if (!tab) return Response.json({ rows: [], days: [], months: [] });
    if (!INTERVIEW_SHEET_ID) {
      return Response.json({ error: 'INTERVIEW_SHEET_ID not configured' }, { status: 500 });
    }

    const rawRows = await fetchTab(INTERVIEW_SHEET_ID, tab);

    // Drill-down request
    if (drill && (date || month)) {
      const refDate = date || (() => {
        const [y, m] = month.split('-').map(Number);
        return new Date(y, m, 0).toISOString().slice(0, 10);
      })();
      const drillRows = drillI2R(rawRows, program, drill, refDate, !!month);
      const display = drillRows.slice(0, 300).map(r => ({
        name:    r['Name']        || '',
        email:   r['Email']       || '',
        company: r['Company']     || '',
        role:    r['Role']        || '',
        module:  r['Related Module'] || '',
        status:  r['Status'] || r['Final Status'] || '',
        round:   r['Round'] || r['# Round - Name'] || '',
        date:    r['Date of Call'] || '',
      }));
      return Response.json({ rows: display, total: drillRows.length });
    }

    // Metrics computation
    const result = computeI2R(rawRows, program, fromDate, toDate);
    return Response.json(result);

  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
