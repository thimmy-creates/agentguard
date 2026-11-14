import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { db } from '../database/db';
import { ACTIONS } from '../policy-engine/actions';
import { handleRequest } from '../gateway/gateway';
import { bus, recentEvents } from '../services/events';
import { createAgent, findByKey, getAgentRow, listAgents, setStatus, toView } from '../services/agents';
import { activePolicy, policyHistory, publishPolicy, sameRules, validateRules } from '../services/policies';
import { listApprovals, resolve } from '../services/approvals';
import { getAudit, listAudit, verifyReceipt } from '../services/audit';
import { getOverview } from '../services/overview';
import { chainInfo } from '../blockchain/near';
import type { Row } from '../types';

export const wrap =
  (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  (req, res, next: NextFunction) => {
    try {
      const out = fn(req, res);
      if (out instanceof Promise) out.catch(next);
    } catch (e) {
      next(e);
    }
  };

const bad = (res: Response, message: string, details?: unknown) =>
  res.status(400).json({ error: 'bad_request', message, details });

// ---- overview / meta ------------------------------------------------------
export const overview = wrap((_req, res) => res.json(getOverview()));
export const actionsCatalog = wrap((_req, res) => res.json(ACTIONS));
export const chainStatus = wrap((_req, res) => res.json(chainInfo()));

// ---- agents ---------------------------------------------------------------
const createSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(48),
  description: z.string().trim().max(200).optional(),
  preset: z.enum(['standard', 'read_only', 'locked_down']).default('standard'),
});

export const agentsList = wrap((_req, res) => res.json(listAgents()));

export const agentsCreate = wrap((req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0].message, parsed.error.flatten());
  res.status(201).json(createAgent(parsed.data));
});

export const agentsGet = wrap((req, res) => {
  const agent = getAgentRow(req.params.id);
  if (!agent) return res.status(404).json({ error: 'not_found', message: 'Agent not found' });
  const history = (
    db
      .prepare(`SELECT * FROM requests WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50`)
      .all(agent.id) as Row[]
  ).map((r) => ({
    id: r.id,
    action: r.action,
    risk: r.risk,
    decision: r.decision,
    status: r.status,
    reason: r.reason,
    policy_version: r.policy_version,
    source: r.source,
    created_at: r.created_at,
  }));
  res.json({ agent: toView(agent), history, policy_versions: policyHistory(agent.id) });
});

export const agentsStatus = wrap((req, res) => {
  const parsed = z.object({ status: z.enum(['active', 'suspended']) }).safeParse(req.body);
  if (!parsed.success) return bad(res, 'status must be "active" or "suspended"');
  const updated = setStatus(req.params.id, parsed.data.status);
  if (!updated) return res.status(404).json({ error: 'not_found', message: 'Agent not found' });
  res.json(updated);
});

// ---- policies -------------------------------------------------------------
export const policyGet = wrap((req, res) => {
  const agent = getAgentRow(req.params.id);
  if (!agent) return res.status(404).json({ error: 'not_found', message: 'Agent not found' });
  const p = activePolicy(agent.id);
  res.json({ agent_id: agent.id, version: p.version, hash: p.hash, rules: p.rules, history: policyHistory(agent.id) });
});

export const policyPut = wrap((req, res) => {
  const agent = getAgentRow(req.params.id);
  if (!agent) return res.status(404).json({ error: 'not_found', message: 'Agent not found' });
  const rules = validateRules((req.body?.rules ?? {}) as Record<string, unknown>);
  if (!rules) return bad(res, 'rules must set every action to "allow", "review" or "deny"');
  const current = activePolicy(agent.id);
  if (sameRules(current.rules, rules)) return res.json({ unchanged: true, version: current.version, hash: current.hash, rules });
  res.json({ unchanged: false, ...publishPolicy(agent, rules) });
});

// ---- gateway (agents call this) -------------------------------------------
const gatewaySchema = z.object({
  agent_id: z.string().min(1),
  action: z.string().min(1).max(80),
  params: z.record(z.unknown()).default({}),
});

export const gatewayRequest = wrap((req, res) => {
  const parsed = gatewaySchema.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Invalid request', parsed.error.flatten());
  const agent = findByKey(parsed.data.agent_id, String(req.header('x-agent-key') ?? ''));
  if (!agent) return res.status(401).json({ error: 'unauthorized', message: 'Unknown agent or invalid x-agent-key' });
  const outcome = handleRequest(agent, parsed.data.action, parsed.data.params, 'gateway');
  res.status(outcome.decision === 'deny' ? 403 : outcome.decision === 'review' ? 202 : 200).json(outcome);
});

// Owner-side sandbox: same code path as the gateway, no agent key needed.
export const simulate = wrap((req, res) => {
  const parsed = gatewaySchema.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Invalid request', parsed.error.flatten());
  const agent = getAgentRow(parsed.data.agent_id);
  if (!agent) return res.status(404).json({ error: 'not_found', message: 'Agent not found' });
  res.json(handleRequest(agent, parsed.data.action, parsed.data.params, 'simulator'));
});

// ---- approvals ------------------------------------------------------------
export const approvalsList = wrap((req, res) => {
  const scope = req.query.status === 'resolved' ? 'resolved' : 'pending';
  res.json(listApprovals(scope));
});

const decide = (verdict: 'approve' | 'reject') =>
  wrap((req, res) => {
    const out = resolve(req.params.id, verdict);
    if ('error' in out) {
      return res
        .status(out.error === 'not_found' ? 404 : 409)
        .json({ error: out.error, message: out.error === 'not_found' ? 'Request not found' : 'Request is no longer pending' });
    }
    res.json(out.request);
  });
export const approve = decide('approve');
export const reject = decide('reject');

// ---- audit ----------------------------------------------------------------
export const auditList = wrap((req, res) => {
  const q = req.query;
  res.json(
    listAudit({
      agent_id: typeof q.agent_id === 'string' ? q.agent_id : undefined,
      decision: typeof q.decision === 'string' ? q.decision : undefined,
      q: typeof q.q === 'string' ? q.q.trim() : undefined,
    }),
  );
});

export const auditGet = wrap((req, res) => {
  const a = getAudit(req.params.id);
  if (!a) return res.status(404).json({ error: 'not_found', message: 'Receipt not found' });
  res.json(a);
});

export const auditVerify = wrap((req, res) => {
  const v = verifyReceipt(req.params.id);
  if (!v) return res.status(404).json({ error: 'not_found', message: 'Receipt not found' });
  res.json(v);
});

// ---- activity feed --------------------------------------------------------
export const eventsList = wrap((req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  res.json(recentEvents(limit));
});

export const eventsStream = (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`retry: 3000\n\n`);
  const send = (e: unknown) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on('event', send);
  const hb = setInterval(() => res.write(`: hb\n\n`), 25_000);
  req.on('close', () => {
    clearInterval(hb);
    bus.off('event', send);
  });
};
