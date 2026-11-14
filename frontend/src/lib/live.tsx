import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type ApprovalItem, type EventItem } from './api';

type Listener = (e: EventItem) => void;

interface LiveValue {
  connected: boolean;
  pending: number;
  subscribe: (l: Listener) => () => void;
  refreshPending: () => void;
}

const Ctx = createContext<LiveValue>({ connected: false, pending: 0, subscribe: () => () => {}, refreshPending: () => {} });

/** One shared Server-Sent Events connection. Pages subscribe to refetch when something happens. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const refreshPending = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api
        .get<ApprovalItem[]>('/approvals?status=pending')
        .then((rows) => setPending(rows.length))
        .catch(() => undefined);
    }, 200);
  }, []);

  useEffect(() => {
    refreshPending();
    const es = new EventSource('/api/events/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource reconnects on its own
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as EventItem;
        listeners.current.forEach((l) => l(e));
        refreshPending();
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => es.close();
  }, [refreshPending]);

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  const value = useMemo(() => ({ connected, pending, subscribe, refreshPending }), [connected, pending, subscribe, refreshPending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLiveStatus = () => useContext(Ctx);

/** Run `cb` (debounced) whenever the gateway reports activity. */
export function useLive(cb: (e: EventItem) => void) {
  const { subscribe } = useContext(Ctx);
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let t: number | undefined;
    const unsub = subscribe((e) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => ref.current(e), 250);
    });
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, [subscribe]);
}
