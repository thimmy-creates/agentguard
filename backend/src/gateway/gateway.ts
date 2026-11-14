import { randomBytes } from 'node:crypto';
import { db } from '../database/db';
import { now } from '../clock';
import { ACTION_BY_ID } from '../policy-engine/actions';
import { evaluate, isKnownAction } from '../policy-engine/engine';
import { activePolicy } from '../services/policies';
import { recordReceipt } from '../services/audit';
import { emitEvent } from '../services/events';
import { executeTool } from './tools';
import type { RequestSource, Row } from '../types';

export interface GatewayOutcome {
  request_id: string;
  decision: 'allow' | 'review' | 'deny';
  status: string;
  risk: string;
  reason: string;
  policy_version: number;
  result: unknown | null;
}

const labelOf = (action: string) => (isKnownAction(action) ? ACTION_BY_ID[action].label : action);

/**
 * Gateway entry point. Every agent action passes through here:
 *   receive -> validate -> policy engine -> ALLOW (execute) | REVIEW (queue) | DENY (reject) -> receipt
 */
export function handleRequest(
  agent: Row,
  action: string,
  params: Record<string, unknown>,
  source: RequestSource = 'gateway',
): GatewayOutcome {
  const policy = activePolicy(agent.id);
  const verdict = evaluate({
    agentStatus: agent.status,
    rules: policy.rules,
    policyVersion: policy.version,
    action,
    params,
  });

  const id = `req_${randomBytes(5).toString('hex')}`;
  const status = verdict.decision === 'allow' ? 'executed' : verdict.decision === 'review' ? 'pending' : 'denied';
  const result = verdict.decision === 'allow' && isKnownAction(action) ? executeTool(action, params) : null;

  db.prepare(
    `INSERT INTO requests (id, agent_id, action, params_json, risk, decision, status, reason, rule_decision,
                           policy_version, policy_hash, source, result_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    agent.id,
    action,
    JSON.stringify(params),
    verdict.risk,
    verdict.decision,
    status,
    verdict.reason,
    verdict.ruleDecision,
    policy.version,
    policy.hash,
    source,
    result ? JSON.stringify(result) : null,
    now(),
  );

  const request = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(id) as Row;
  const label = labelOf(action);

  if (verdict.decision === 'allow') {
    recordReceipt(request, 'allow', 'policy-engine');
    emitEvent({ kind: 'request.allowed', agent_id: agent.id, agent_name: agent.name, action, decision: 'allow', risk: verdict.risk, message: `${agent.name} was allowed to ${label.toLowerCase()}` });
  } else if (verdict.decision === 'deny') {
    recordReceipt(request, 'deny', 'policy-engine');
    emitEvent({ kind: 'request.denied', agent_id: agent.id, agent_name: agent.name, action, decision: 'deny', risk: verdict.risk, message: `${agent.name} was blocked from ${label.toLowerCase()}` });
  } else {
    emitEvent({ kind: 'request.pending', agent_id: agent.id, agent_name: agent.name, action, decision: 'review', risk: verdict.risk, message: `${agent.name} is waiting for approval to ${label.toLowerCase()}` });
  }

  return {
    request_id: id,
    decision: verdict.decision,
    status,
    risk: verdict.risk,
    reason: verdict.reason,
    policy_version: policy.version,
    result,
  };
}
