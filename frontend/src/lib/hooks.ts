import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useLive } from './live';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Fetch `path`, expose loading/error, and quietly refetch whenever the gateway emits an event. */
export function useApi<T>(path: string | null, opts: { live?: boolean } = { live: true }): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  const load = useCallback(
    async (silent: boolean) => {
      if (!path) return;
      if (!silent) setLoading(true);
      try {
        setData(await api.get<T>(path));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    setData(null);
    void load(false);
  }, [load]);

  useLive(() => {
    if (opts.live !== false) void load(true);
  });

  return { data, loading, error, reload: () => void load(false) };
}

/** Re-render every `ms` so relative timestamps stay fresh. */
export function useTick(ms = 30_000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (text: string, key = text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  }, []);
  return { copied, copy };
}
