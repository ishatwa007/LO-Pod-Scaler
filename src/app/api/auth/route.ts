import { NextRequest } from 'next/server';
import { verifyCredentials } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const result = verifyCredentials(String(username || ''), String(password || ''));
    if (!result.ok) return Response.json({ error: result.error }, { status: 401 });
    return Response.json({ ok: true, username: result.username, role: result.role, displayName: result.displayName });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
