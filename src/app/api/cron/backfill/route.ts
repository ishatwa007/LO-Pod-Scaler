import { NextRequest } from 'next/server';
import { runBackfill } from '@/lib/lo-backfill';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify cron secret so only Vercel can call this
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await runBackfill();
    const total = data.results.reduce((s, r) => s + r.newDates, 0);
    console.log(`[cron/backfill] Wrote ${total} rows to ${data.sheetUrl}`);
    return Response.json({ ok: true, ...data, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[cron/backfill] Error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
