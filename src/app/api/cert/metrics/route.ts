import { fetchTab } from '@/lib/sheets';
import { getCached, setCached } from '@/lib/cache';
import { computeMetrics } from '@/lib/metrics';
import { SHEET_IDS, TABS } from '@/lib/sheets-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('from') || '';  // YYYY-MM-DD
    const toDate   = searchParams.get('to')   || '';  // YYYY-MM-DD

    // Only cache the default view (no date params)
    const isDefault = !fromDate && !toDate;
    const KEY = 'v4:metrics';

    if (isDefault) {
      const cached = await getCached(KEY);
      if (cached) return Response.json(cached);
    }

    let aiMockRows: Record<string, string>[] = [];
    try {
      aiMockRows = await fetchTab(SHEET_IDS.AI_MOCK, TABS.AI_MOCK);
    } catch (aiErr) {
      console.error('[cert/metrics] AI Mock fetch failed:', aiErr);
    }

    const [ocRows, dodRows, momRows, lcRows, s4Rows] = await Promise.all([
      fetchTab(SHEET_IDS.MAIN,   TABS.OVERALL),
      fetchTab(SHEET_IDS.MAIN,   TABS.DOD),
      fetchTab(SHEET_IDS.MAIN,   TABS.MOM),
      fetchTab(SHEET_IDS.MAIN,   TABS.LC),
      fetchTab(SHEET_IDS.SHEET4, TABS.S4),
    ]);

    const result = computeMetrics(ocRows, dodRows, momRows, lcRows, s4Rows, aiMockRows, fromDate, toDate);
    const withMeta = { ...result, aiMockAvailable: aiMockRows.length > 0 };

    if (isDefault) await setCached(KEY, withMeta);
    return Response.json(withMeta);
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
