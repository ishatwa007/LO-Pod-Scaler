import { fetchTab } from '@/lib/sheets';
import { getCached, setCached } from '@/lib/cache';
import { computeLOMetrics } from '@/lib/lo-metrics';
import { LO_SHEET_IDS, LO_TABS } from '@/lib/sheets-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const KEY = 'v4:lo:metrics';

async function fetchWS(tab: string): Promise<string[][]> {
  try {
    const rows = await fetchTab(LO_SHEET_IDS.WEEKLY_SYNC, tab);
    // fetchTab returns Record<string,string>[] (keyed by header row)
    // For Weekly Sync the header IS row 0, so we need raw rows
    // Re-fetch as raw array
    const { google } = await import('googleapis');
    const { getReadClient } = await import('@/lib/sheets');
    const sheets = getReadClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: LO_SHEET_IDS.WEEKLY_SYNC,
      range: tab,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return (res.data.values as string[][]) || [];
  } catch { return []; }
}

export async function GET() {
  try {
    const cached = await getCached(KEY);
    if (cached) return Response.json(cached);

    const [krsA, krsD, krsV, krsAI, wsA, wsD, wsV, wsAI, rfRaw] = await Promise.all([
      fetchTab(LO_SHEET_IDS.KRS, LO_TABS.KRS_ACADEMY),
      fetchTab(LO_SHEET_IDS.KRS, LO_TABS.KRS_DSML),
      fetchTab(LO_SHEET_IDS.KRS, LO_TABS.KRS_DEVOPS),
      fetchTab(LO_SHEET_IDS.KRS, LO_TABS.KRS_AIML),
      fetchWS(LO_TABS.WS_ACADEMY),
      fetchWS(LO_TABS.WS_DSML),
      fetchWS(LO_TABS.WS_DEVOPS),
      fetchWS(LO_TABS.WS_AIML),
      fetchTab(LO_SHEET_IDS.RED_FLAGS, LO_TABS.RF_RAW),
    ]);

    const result = computeLOMetrics(krsA, krsD, krsV, krsAI, wsA, wsD, wsV, wsAI, rfRaw);
    await setCached(KEY, result);
    return Response.json(result);
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
