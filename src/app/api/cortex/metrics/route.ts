import { NextRequest } from 'next/server';
import { fetchTab, readAllRows } from '@/lib/sheets';
import { CORTEX_SHEET_ID, CORTEX_TABS, CORTEX_PROGRAMS } from '@/lib/sheets-config';
import { parseFunnelTable, buildCortexMetrics } from '@/lib/cortex';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program = searchParams.get('program') || 'Academy';

    if (!CORTEX_SHEET_ID) {
      return Response.json({ error: 'CORTEX_SHEET_ID not configured' }, { status: 500 });
    }

    const courses = CORTEX_PROGRAMS[program] ?? [];

    const [funnelRaw, dodVisits, wowVisits, dodCompletion, wowCompletion] = await Promise.all([
      readAllRows(CORTEX_SHEET_ID, CORTEX_TABS.PCT_FUNNEL),
      fetchTab(CORTEX_SHEET_ID, CORTEX_TABS.DOD_VISITS),
      fetchTab(CORTEX_SHEET_ID, CORTEX_TABS.WOW_VISITS),
      fetchTab(CORTEX_SHEET_ID, CORTEX_TABS.DOD_COMPLETION),
      fetchTab(CORTEX_SHEET_ID, CORTEX_TABS.WOW_COMPLETION),
    ]);

    // Parse funnel table — filter to relevant program courses
    const { funnelRows: allFunnelRows, buckets } = parseFunnelTable(funnelRaw);
    const funnelRows = allFunnelRows.filter(r => courses.includes(r.course));

    // Build DoD/WoW metrics
    const { visits, completions, days, weeks } = buildCortexMetrics(
      dodVisits, wowVisits, dodCompletion, wowCompletion, courses
    );

    return Response.json({ funnelRows, funnelBuckets: buckets, visits, completions, days, weeks, program });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
