import { google } from 'googleapis';

let readClient:  ReturnType<typeof google.sheets> | null = null;
let writeClient: ReturnType<typeof google.sheets> | null = null;

function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  return JSON.parse(raw);
}

export function getReadClient() {
  if (readClient) return readClient;
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  readClient = google.sheets({ version: 'v4', auth });
  return readClient;
}

export function getWriteClient() {
  if (writeClient) return writeClient;
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  writeClient = google.sheets({ version: 'v4', auth });
  return writeClient;
}

export async function fetchTab(
  spreadsheetId: string,
  tab: string,
  colRange?: string
): Promise<Record<string, string>[]> {
  const sheets = getReadClient();
  const range  = colRange ? `${tab}!${colRange}` : tab;
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    // FORMATTED_VALUE returns dates as "2026-03-14" (ISO) which is what
    // the live sheet uses. All numeric values stay as strings but parseDate handles them.
    valueRenderOption:    'FORMATTED_VALUE',
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  const headers = (rows[0] as string[]).map(h => h.trim());
  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? '').trim()]))
  );
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<void> {
  const sheets = getWriteClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function readAllRows(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const sheets = getReadClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values as string[][]) || [];
}

// ── Write helpers (require Editor access on target sheet) ─────────────────────

export async function getSheetTabs(spreadsheetId: string): Promise<{ id: number; name: string }[]> {
  const sheets = getWriteClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  return (res.data.sheets ?? []).map(s => ({
    id:   s.properties?.sheetId   ?? 0,
    name: s.properties?.title     ?? '',
  }));
}

export async function ensureTab(spreadsheetId: string, tabName: string): Promise<void> {
  const existing = await getSheetTabs(spreadsheetId);
  if (existing.some(t => t.name === tabName)) return;
  const sheets = getWriteClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
  });
}

export async function clearAndWriteTab(
  spreadsheetId: string,
  tabName:        string,
  rows:           (string | number | null)[][]
): Promise<void> {
  const sheets = getWriteClient();
  // Ensure tab exists
  await ensureTab(spreadsheetId, tabName);
  // Clear first
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A:ZZ`,
  });
  if (!rows.length) return;
  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range:            `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows.map(r => r.map(v => v === null ? '' : v)) },
  });
}
