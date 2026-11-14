import { randomBytes } from 'node:crypto';
import { db } from '../database/db';
import { now } from '../clock';
import { hashObject } from '../policy-engine/hash';
import * as chain from '../blockchain/near';
import { ping } from './events';
import type { DecisionType, Row } from '../types';

/**
 * Build the decision receipt, hash it, store it in SQLite and anchor the hash on NEAR.
 * Raw request parameters never leave SQLite: only their digest is part of the receipt.
 *
 * A stored hash is evidence that a decision was recorded. It is NOT proof that an
 * action was safe, or that it executed as described.
 */
export function recordReceipt(request: Row, decisionType: DecisionType, decidedBy: string) {
  const payload = {
    request_id: request.id,
    agent_id: request.agent_id,
    action: request.action,
    decision: decisionType,
    risk: request.risk,
    policy_version: request.policy_version,
    policy_hash: request.policy_hash,
    params_digest: hashObject(JSON.parse(request.params_json)),
    decided_by: decidedBy,
    decided_at: now(),
  };
  const decisionHash = hashObject(payload);
  const id = `aud_${randomBytes(5).toString('hex')}`;

  db.prepare(
    `INSERT INTO audit (id, request_id, agent_id, action, decision_type, risk, policy_version, policy_hash,
                        decision_hash, payload_json, near_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    id,
    request.id,
    request.agent_id,
    request.action,
    decisionType,
    request.risk,
    request.policy_version,
    request.policy_hash,
    decisionHash,
    JSON.stringify(payload),
    payload.decided_at,
  );

  chain.recordDecision(request.agent_id, decisionHash, decisionType).then((res) => {
    db.prepare(`UPDATE audit SET near_tx = ?, near_status = ?, near_mode = ?, near_error = ? WHERE id = ?`).run(
      res.txHash || null,
      res.status,
      res.mode,
      res.error ?? null,
      id,
    );
    ping('chain.updated');
  });

  return { id, decisionHash };
}

const view = (r: Row) => ({
  id: r.id,
  request_id: r.request_id,
  agent_id: r.agent_id,
  agent_name: r.agent_name ?? null,
  action: r.action,
  decision_type: r.decision_type as DecisionType,
  risk: r.risk,
  policy_version: r.policy_version,
  policy_hash: r.policy_hash,
  decision_hash: r.decision_hash,
  near_tx: r.near_tx,
  near_status: r.near_status,
  near_mode: r.near_mode,
  near_error: r.near_error,
  created_at: r.created_at,
});

export function listAudit(filter: { agent_id?: string; decision?: string; q?: string; limit?: number }) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.agent_id) {
    where.push('a.agent_id = ?');
    args.push(filter.agent_id);
  }
  if (filter.decision) {
    // "allowed" / "blocked" are groups that match the overview counters (owner decisions included).
    const groups: Record<string, string[]> = {
      allowed: ['allow', 'review_approved'],
      blocked: ['deny', 'review_rejected'],
    };
    const types = groups[filter.decision] ?? [filter.decision];
    where.push(`a.decision_type IN (${types.map(() => '?').join(',')})`);
    args.push(...types);
  }
  if (filter.q) {
    where.push('(a.action LIKE ? OR a.decision_hash LIKE ? OR a.near_tx LIKE ? OR g.name LIKE ?)');
    const like = `%${filter.q}%`;
    args.push(like, like, like, like);
  }
  const sql = `SELECT a.*, g.name AS agent_name FROM audit a JOIN agents g ON g.id = a.agent_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`;
  return (db.prepare(sql).all(...args, filter.limit ?? 200) as Row[]).map(view);
}

export function getAudit(id: string) {
  const r = db
    .prepare(`SELECT a.*, g.name AS agent_name FROM audit a JOIN agents g ON g.id = a.agent_id WHERE a.id = ?`)
    .get(id) as Row | undefined;
  return r ? view(r) : null;
}

/** Recompute the receipt hash from stored data and compare. Detects tampering with the local database. */
export function verifyReceipt(id: string) {
  const r = db.prepare(`SELECT * FROM audit WHERE id = ?`).get(id) as Row | undefined;
  if (!r) return null;
  const payload = JSON.parse(r.payload_json);
  const req = db.prepare(`SELECT params_json FROM requests WHERE id = ?`).get(r.request_id) as Row | undefined;
  const recomputedHash = hashObject(payload);
  const paramsMatch = req ? hashObject(JSON.parse(req.params_json)) === payload.params_digest : false;
  return {
    id: r.id,
    stored_hash: r.decision_hash as string,
    recomputed_hash: recomputedHash,
    hash_matches: recomputedHash === r.decision_hash,
    request_params_match: paramsMatch,
    valid: recomputedHash === r.decision_hash && paramsMatch,
    on_chain: r.near_status === 'confirmed',
    near_mode: r.near_mode as string | null,
    note:
      r.near_status === 'confirmed'
        ? 'Hash was anchored on NEAR testnet. It proves this decision was recorded, not that the action was safe.'
        : 'Receipt verified locally. It has not been anchored on a live NEAR network (simulated or pending).',
  };
}
