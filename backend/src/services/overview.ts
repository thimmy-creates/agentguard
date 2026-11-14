import { db } from '../database/db';
import { nowDate } from '../clock';
import { chainInfo } from '../blockchain/near';
import { listAgents } from './agents';
import { recentEvents } from './events';
import type { Row } from '../types';

export function getOverview() {
  const agents = listAgents();
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(status IN ('executed','approved')), 0) AS allowed,
              COALESCE(SUM(status IN ('denied','rejected')), 0)   AS blocked,
              COALESCE(SUM(status = 'pending'), 0)                AS pending,
              COUNT(*) AS total
       FROM requests`,
    )
    .get() as Row;

  // 12 hourly buckets ending at the current hour, bucketed by the gateway verdict.
  const end = nowDate();
  end.setMinutes(0, 0, 0);
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(end.getTime() - (11 - i) * 3600_000);
    return { hour: start.toISOString(), allow: 0, review: 0, deny: 0 };
  });
  const since = buckets[0].hour;
  const rows = db.prepare(`SELECT decision, created_at FROM requests WHERE created_at >= ?`).all(since) as Row[];
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const idx = buckets.findIndex((b) => t >= new Date(b.hour).getTime() && t < new Date(b.hour).getTime() + 3600_000);
    if (idx >= 0) (buckets[idx] as any)[r.decision]++;
  }

  const anchored = db.prepare(`SELECT COUNT(*) AS n FROM audit WHERE near_status = 'confirmed'`).get() as Row;
  const receipts = db.prepare(`SELECT COUNT(*) AS n FROM audit`).get() as Row;

  return {
    totals: {
      agents: agents.length,
      active_agents: agents.filter((a) => a.status === 'active').length,
      allowed: totals.allowed as number,
      blocked: totals.blocked as number,
      pending: totals.pending as number,
      requests: totals.total as number,
    },
    timeline: buckets,
    agents,
    events: recentEvents(25),
    chain: { ...chainInfo(), receipts: receipts.n as number, anchored: anchored.n as number },
  };
}
