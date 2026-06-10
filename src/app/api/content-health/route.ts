import { NextRequest } from 'next/server';
import { fetchTab } from '@/lib/sheets';
import { LO_CONTENT_ISSUES_SHEET_ID, LO_CONTENT_ISSUES_TAB } from '@/lib/sheets-config';
import { computeContentHealth } from '@/lib/content-health';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program = searchParams.get('program') || 'Academy';

    if (!LO_CONTENT_ISSUES_SHEET_ID) {
      return Response.json({ error: 'LO_CONTENT_ISSUES_SHEET_ID not configured' }, { status: 500 });
    }

    const rawRows = await fetchTab(LO_CONTENT_ISSUES_SHEET_ID, LO_CONTENT_ISSUES_TAB);
    const result  = computeContentHealth(rawRows, program);
    return Response.json(result);
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
