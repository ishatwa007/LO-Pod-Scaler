// Lazy KV import — works without env vars (graceful degradation)
const TTL = 4 * 60 * 60;

async function getKV() {
  if (!process.env.KV_REST_API_URL) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  if (!kv) return null;
  try { return await kv.get<T>(key); } catch { return null; }
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try { await kv.set(key, value, { ex: TTL }); } catch { /* non-fatal */ }
}

export async function clearPrefix(prefix: string): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    const keys = await kv.keys(`${prefix}*`);
    if (keys.length > 0) await Promise.all(keys.map((k: string) => kv.del(k)));
  } catch { /* non-fatal */ }
}
