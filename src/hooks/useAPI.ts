'use client';
import { useState, useEffect, useCallback } from 'react';

export function useAPI<T>(url: string, skip = false) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (skip) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url, skip]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refetch: load };
}
