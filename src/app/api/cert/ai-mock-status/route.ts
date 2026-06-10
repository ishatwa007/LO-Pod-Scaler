import { fetchTab } from '@/lib/sheets';
import { SHEET_IDS, TABS } from '@/lib/sheets-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await fetchTab(SHEET_IDS.AI_MOCK, TABS.AI_MOCK);
    const sample = rows.slice(0, 2);
    return Response.json({
      ok: true,
      rowCount: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      sample,
      sheetId: SHEET_IDS.AI_MOCK,
    });
  } catch (e: unknown) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      sheetId: SHEET_IDS.AI_MOCK,
      fix: 'Share the AI Mock sheet with the service account: scaler-reader@scaler-dashboard.iam.gserviceaccount.com',
    }, { status: 500 });
  }
}
