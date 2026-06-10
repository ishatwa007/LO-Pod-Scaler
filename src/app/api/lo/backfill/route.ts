import { NextRequest } from 'next/server';
import { runBackfill } from '@/lib/lo-backfill';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const data = await runBackfill();
    return Response.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = msg.includes('permission') || msg.includes('403')
      ? ' — Share the sheet with the service account as Editor.'
      : '';
    return Response.json({ error: msg + hint }, { status: 500 });
  }
}
