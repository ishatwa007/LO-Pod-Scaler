import type { NoteRecord } from '@/types';
import { NextRequest } from 'next/server';
import { appendRows, readAllRows } from '@/lib/sheets';
import { NOTES_SHEET_ID, NOTES_RANGE } from '@/lib/sheets-config';

export const dynamic = 'force-dynamic';

export type { NoteRecord } from '@/types';

// GET /api/notes — returns latest note per (program, metricId, noteDate)
export async function GET() {
  if (!NOTES_SHEET_ID) return Response.json({ notes: {}, configured: false });
  try {
    const rows = await readAllRows(NOTES_SHEET_ID, NOTES_RANGE);
    const dataRows = rows.filter(r => r[0] !== 'Timestamp' && r.length >= 4);

    const map = new Map<string, NoteRecord>();
    for (const row of dataRows) {
      const [timestamp, program, metricId, noteDate, author, note] = row;
      if (!program || !metricId) continue;
      const key = `${program}:${metricId}:${noteDate || ''}`;
      const existing = map.get(key);
      if (!existing || timestamp > existing.timestamp) {
        map.set(key, { timestamp, program, metricId, noteDate: noteDate || '', author: author || '', note: note || '' });
      }
    }
    return Response.json({ notes: Object.fromEntries(map), configured: true });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e), notes: {}, configured: true }, { status: 500 });
  }
}

// POST /api/notes
export async function POST(req: NextRequest) {
  if (!NOTES_SHEET_ID) return Response.json({ error: 'NOTES_SHEET_ID not configured' }, { status: 400 });
  try {
    const body = await req.json();
    const { program, metricId, noteDate, author, note } = body as {
      program: string; metricId: string; noteDate?: string; author?: string; note: string;
    };
    if (!program || !metricId) return Response.json({ error: 'program and metricId are required' }, { status: 400 });
    const timestamp = new Date().toISOString();
    await appendRows(NOTES_SHEET_ID, NOTES_RANGE, [
      [timestamp, program, metricId, noteDate || '', author || 'Unknown', note || ''],
    ]);
    return Response.json({ ok: true, timestamp });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
