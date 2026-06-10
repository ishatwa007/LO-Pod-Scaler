import { fetchTab } from '@/lib/sheets';
import { setCached } from '@/lib/cache';
import { computeMetrics } from '@/lib/metrics';
import { SHEET_IDS, TABS } from '@/lib/sheets-config';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const [oc, dod, mom, lc, s4] = await Promise.all([
    fetchTab(SHEET_IDS.MAIN, TABS.OVERALL), fetchTab(SHEET_IDS.MAIN, TABS.DOD),
    fetchTab(SHEET_IDS.MAIN, TABS.MOM),    fetchTab(SHEET_IDS.MAIN, TABS.LC),
    fetchTab(SHEET_IDS.SHEET4, TABS.S4),
  ]);
  await setCached('v2:metrics', computeMetrics(oc, dod, mom, lc, s4));
  return Response.json({ ok: true });
}
