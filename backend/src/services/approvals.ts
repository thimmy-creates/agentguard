import { db } from '../database/db';
import { now } from '../clock';
import { ACTION_BY_ID } from '../policy-engine/actions';
import { isKnownAction } from '../policy-engine/engine';
import { executeTool } from '../gateway/tools';
import { recordReceipt } from './audit';
import { emitEvent } from './events';
import type { Row } from '../types';

const view = (r: Row) => ({
  id: r.id,
  agent_id: r.agent_id,
  agent_name: r.agent_name,
  action: r.action,
  params: JSON.parse(r.params_json),
  risk: r.risk,
  decision: r.decision,
  status: r.status,
  reason: r.reason,
  rule_decision: r.rule_decision,
  policy_version: r.policy_version,
  policy_hash: r.policy_hash,
  source: r.source,
  result: r.result_json ? JSON.parse(r.result_json) : null,
  created_at: r.created_at,
  resolved_at: r.resolved_at,
  resolved_by: r.resolved_by,
});

export function listApprovals(scope: 'pending' | 'resolved') {
  const where = scope === 'pending' ? `r.status = 'pending'` : `r.decision = 'review' AND r.status IN ('approved','rejected')`;
  const order = scope === 'pending' ? 'r.created_at ASC' : 'r.resolved_at DESC';
  return (
    db
      .prepare(
        `SELECT r.*, g.name AS agent_name FROM requests r JOIN agents g ON g.id = r.agent_id WHERE ${where} ORDER BY ${order} LIMIT 100`,
      )
      .all() as Row[]
  ).map(view);
}

export const pendingCount = (): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM requests WHERE status = 'pending'`).get() as Row).n;

export function resolve(requestId: string, verdict: 'approve' | 'reject', by = 'owner') {
  const request = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(requestId) as Row | undefined;
  if (!request) return { error: 'not_found' as const };
  if (request.status !== 'pending') return { error: 'not_pending' as const };

  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(request.agent_id) as Row;
  const params = JSON.parse(request.params_json);
  const approved = verdict === 'approve';
  const result = approved && isKnownAction(request.action) ? executeTool(request.action, params) : null;
  const resolvedAt = now();

  db.prepare(
    `UPDATE requests SET status = ?, resolved_at = ?, resolved_by = ?, result_json = ? WHERE id = ?`,
  ).run(approved ? 'approved' : 'rejected', resolvedAt, by, result ? JSON.stringify(result) : null, requestId);

  const updated = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(requestId) as Row;
  recordReceipt(updated, approved ? 'review_approved' : 'review_rejected', by);

  const label = isKnownAction(request.action) ? ACTION_BY_ID[request.action].label.toLowerCase() : request.action;
  emitEvent({
    kind: approved ? 'request.approved' : 'request.rejected',
    agent_id: agent.id,
    agent_name: agent.name,
    action: request.action,
    decision: approved ? 'allow' : 'deny',
    risk: request.risk,
    message: approved
      ? `Owner approved ${agent.name} to ${label}`
      : `Owner rejected ${agent.name} from ${label}`,
  });

  return { ok: true as const, request: view({ ...updated, agent_name: agent.name }) };
}
