import { randomBytes } from 'node:crypto';
import { db } from '../database/db';
import { now } from '../clock';
import { sha256 } from '../policy-engine/hash';
import * as chain from '../blockchain/near';
import { activePolicy, presetRules, publishPolicy, type Preset } from './policies';
import { emitEvent, ping } from './events';
import { ACTION_IDS, type Row } from '../types';

export const OWNER = () => process.env.OWNER_ACCOUNT_ID ?? 'owner.testnet';

export function createAgent(input: { name: string; description?: string; preset: Preset }) {
  const id = `agt_${randomBytes(4).toString('hex')}`;
  const apiKey = `agk_${randomBytes(24).toString('base64url')}`;
  db.prepare(
    `INSERT INTO agents (id, name, description, status, owner, api_key_hash, created_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`,
  ).run(id, input.name, input.description ?? '', OWNER(), sha256(apiKey), now());

  const agent = getAgentRow(id)!;
  chain.registerAgent(id, OWNER()).then(() => ping('chain.updated'));
  publishPolicy(agent, presetRules(input.preset), { silent: true });
  emitEvent({ kind: 'agent.registered', agent_id: id, agent_name: agent.name, message: `${agent.name} registered` });
  return { agent: toView(agent), apiKey };
}

export const getAgentRow = (id: string): Row | undefined =>
  db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as Row | undefined;

export function findByKey(agentId: string, key: string): Row | undefined {
  const row = getAgentRow(agentId);
  if (!row || !key) return undefined;
  return row.api_key_hash === sha256(key) ? row : undefined;
}

export function setStatus(id: string, status: 'active' | 'suspended') {
  const agent = getAgentRow(id);
  if (!agent) return null;
  db.prepare(`UPDATE agents SET status = ? WHERE id = ?`).run(status, id);
  emitEvent({
    kind: 'agent.status',
    agent_id: id,
    agent_name: agent.name,
    message: `${agent.name} ${status === 'suspended' ? 'suspended' : 'reactivated'}`,
  });
  return toView(getAgentRow(id)!);
}

export function toView(agent: Row) {
  const policy = activePolicy(agent.id);
  const counts = { allow: 0, review: 0, deny: 0 };
  for (const id of ACTION_IDS) counts[policy.rules[id]]++;

  const stats = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(status IN ('executed','approved')), 0) AS allowed,
              COALESCE(SUM(status IN ('denied','rejected')), 0)   AS blocked,
              COALESCE(SUM(status = 'pending'), 0)                AS pending,
              MAX(created_at) AS last_active
       FROM requests WHERE agent_id = ?`,
    )
    .get(agent.id) as Row;

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status as 'active' | 'suspended',
    owner: agent.owner,
    created_at: agent.created_at,
    policy_version: policy.version,
    policy_hash: policy.hash,
    rules: policy.rules,
    permission_counts: counts,
    stats: {
      total: stats.total as number,
      allowed: stats.allowed as number,
      blocked: stats.blocked as number,
      pending: stats.pending as number,
      last_active: (stats.last_active as string | null) ?? null,
    },
  };
}

export const listAgents = () =>
  (db.prepare(`SELECT * FROM agents ORDER BY created_at ASC`).all() as Row[]).map(toView);
