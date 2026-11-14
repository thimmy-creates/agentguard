import { EventEmitter } from 'node:events';
import { db } from '../database/db';
import { now } from '../clock';
import type { Row } from '../types';

export interface EventInput {
  kind: string;
  agent_id?: string | null;
  agent_name?: string | null;
  action?: string | null;
  decision?: string | null;
  risk?: string | null;
  message: string;
}

export const bus = new EventEmitter();
bus.setMaxListeners(100);

/** Persist an activity event and push it to live subscribers (SSE). */
export function emitEvent(input: EventInput): Row {
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO events (ts, kind, agent_id, agent_name, action, decision, risk, message)
       VALUES (@ts, @kind, @agent_id, @agent_name, @action, @decision, @risk, @message)`,
    )
    .run({
      ts,
      kind: input.kind,
      agent_id: input.agent_id ?? null,
      agent_name: input.agent_name ?? null,
      action: input.action ?? null,
      decision: input.decision ?? null,
      risk: input.risk ?? null,
      message: input.message,
    });
  const event = { id: Number(info.lastInsertRowid), ts, ...input };
  bus.emit('event', event);
  return event;
}

/** Transient ping so open dashboards refetch (not stored). */
export const ping = (kind: string) => bus.emit('event', { id: 0, ts: now(), kind, message: '' });

export const recentEvents = (limit = 30): Row[] =>
  db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`).all(limit) as Row[];
