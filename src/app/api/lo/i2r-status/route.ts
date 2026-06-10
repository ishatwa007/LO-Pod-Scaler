import { fetchTab } from '@/lib/sheets';
import { INTERVIEW_SHEET_ID, INTERVIEW_TABS } from '@/lib/sheets-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!INTERVIEW_SHEET_ID) {
    return Response.json({
      ok: false,
      issue: 'INTERVIEW_SHEET_ID not set',
      fix: 'Add INTERVIEW_SHEET_ID to Vercel environment variables, then redeploy.',
    }, { status: 400 });
  }

  const results: Record<string, unknown> = { sheetId: INTERVIEW_SHEET_ID, tabs: {} };

  for (const [prog, tab] of Object.entries({
    Academy: INTERVIEW_TABS.ACADEMY,
    DSML:    INTERVIEW_TABS.DSML,
    DevOps:  INTERVIEW_TABS.DEVOPS,
  })) {
    try {
      const rows = await fetchTab(INTERVIEW_SHEET_ID, tab);
      const sample = rows[0] ? Object.keys(rows[0]) : [];
      (results.tabs as Record<string, unknown>)[prog] = {
        ok: true, rowCount: rows.length, columns: sample.slice(0, 6),
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      (results.tabs as Record<string, unknown>)[prog] = {
        ok: false, error: msg,
        fix: msg.includes('403') || msg.includes('permission')
          ? 'Share this sheet with scaler-reader@scaler-dashboard.iam.gserviceaccount.com as Viewer'
          : msg,
      };
    }
  }

  const allOk = Object.values(results.tabs as Record<string, {ok:boolean}>).every(t => t.ok);
  return Response.json({ ...results, overall: allOk ? 'OK' : 'ERRORS' }, { status: allOk ? 200 : 500 });
}
