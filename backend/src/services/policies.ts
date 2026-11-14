import { db } from '../database/db';
import { now } from '../clock';
import { ACTIONS } from '../policy-engine/actions';
import { hashObject } from '../policy-engine/hash';
import * as chain from '../blockchain/near';
import { emitEvent, ping } from './events';
import { ACTION_IDS, type Decision, type Row, type Rules } from '../types';

export type Preset = 'standard' | 'read_only' | 'locked_down';

export function presetRules(preset: Preset): Rules {
  const rules = Object.fromEntries(ACTIONS.map((a) => [a.id, a.defaultDecision])) as Rules;
  if (preset === 'read_only') {
    for (const id of ACTION_IDS) rules[id] = id === 'read_project_data' ? 'allow' : 'deny';
  }
  if (preset === 'locked_down') {
    for (const id of ACTION_IDS) rules[id] = id === 'delete_project_records' ? 'deny' : 'review';
  }
  return rules;
}

export const policyHash = (agentId: string, version: number, rules: Rules): string =>
  hashObject({ agent_id: agentId, version, rules });

export function validateRules(input: Record<string, unknown>): Rules | null {
  const out = {} as Rules;
  for (const id of ACTION_IDS) {
    const v = input[id];
    if (v !== 'allow' && v !== 'review' && v !== 'deny') return null;
    out[id] = v as Decision;
  }
  return out;
}

export function activePolicy(agentId: string): { version: number; rules: Rules; hash: string; row: Row } {
  const row = db
    .prepare(`SELECT * FROM policy_versions WHERE agent_id = ? ORDER BY version DESC LIMIT 1`)
    .get(agentId) as Row | undefined;
  if (!row) throw new Error(`Agent ${agentId} has no policy`);
  return { version: row.version, rules: JSON.parse(row.rules_json) as Rules, hash: row.policy_hash, row };
}

export function policyHistory(agentId: string): Row[] {
  return (
    db.prepare(`SELECT * FROM policy_versions WHERE agent_id = ? ORDER BY version DESC`).all(agentId) as Row[]
  ).map((r) => ({
    version: r.version,
    rules: JSON.parse(r.rules_json),
    policy_hash: r.policy_hash,
    near_tx: r.near_tx,
    near_status: r.near_status,
    near_mode: r.near_mode,
    created_at: r.created_at,
  }));
}

/** Store a new policy version in SQLite and anchor its hash on NEAR. */
export function publishPolicy(agent: Row, rules: Rules, opts: { silent?: boolean } = {}) {
  const current = db
    .prepare(`SELECT MAX(version) AS v FROM policy_versions WHERE agent_id = ?`)
    .get(agent.id) as Row;
  const version = (current.v ?? 0) + 1;
  const hash = policyHash(agent.id, version, rules);

  db.prepare(
    `INSERT INTO policy_versions (agent_id, version, rules_json, policy_hash, near_status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(agent.id, version, JSON.stringify(rules), hash, now());

  chain.updatePolicy(agent.id, hash).then((res) => {
    db.prepare(
      `UPDATE policy_versions SET near_tx = ?, near_status = ?, near_mode = ? WHERE agent_id = ? AND version = ?`,
    ).run(res.txHash || null, res.status, res.mode, agent.id, version);
    ping('chain.updated');
  });

  if (!opts.silent) {
    emitEvent({
      kind: 'policy.updated',
      agent_id: agent.id,
      agent_name: agent.name,
      message: `Policy v${version} published for ${agent.name}`,
    });
  }
  return { version, hash, rules };
}

export const sameRules = (a: Rules, b: Rules): boolean => ACTION_IDS.every((id) => a[id] === b[id]);
