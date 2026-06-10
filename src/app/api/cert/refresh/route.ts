import { clearPrefix } from '@/lib/cache';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  await clearPrefix('v2:');
  return Response.json({ ok: true });
}
