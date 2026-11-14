import { ACTION_BY_ID } from './actions';
import { ACTION_IDS, type ActionId, type Decision, type Risk, type Rules } from '../types';

/**
 * Deterministic policy engine. No AI model is involved in the decision:
 * the same input always yields the same output.
 *
 * Order of evaluation:
 *   1. Unknown action            -> deny (default deny)
 *   2. Suspended agent           -> deny
 *   3. Risk classification       -> base risk of the action, escalated by scope
 *   4. Owner rule for the action -> allow | review | deny
 *   5. Guardrail                 -> an "allow" on a HIGH-risk request becomes "review"
 *      (rules can only ever get stricter here, never looser)
 */

const ORDER: Risk[] = ['low', 'medium', 'high'];
const bump = (risk: Risk, steps: number): Risk => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(risk) + steps)];

export interface Scope {
  records: number;
  recipients: number;
}

export interface EvaluationInput {
  agentStatus: 'active' | 'suspended';
  rules: Rules;
  policyVersion: number;
  action: string;
  params: Record<string, unknown>;
}

export interface Evaluation {
  decision: Decision;
  risk: Risk;
  reason: string;
  /** The owner's configured rule for this action, before any guardrail. */
  ruleDecision: Decision | null;
  escalated: boolean;
  scope: Scope;
}

export const isKnownAction = (action: string): action is ActionId => (ACTION_IDS as readonly string[]).includes(action);

export function scopeFromParams(params: Record<string, unknown>): Scope {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const records = num(params.records) || 1;
  let recipients = 0;
  if (Array.isArray(params.recipients)) recipients = params.recipients.length;
  else recipients = num(params.recipients) || (typeof params.to === 'string' && params.to ? 1 : 0);
  return { records, recipients };
}

export function classifyRisk(action: ActionId, scope: Scope): { risk: Risk; escalated: boolean } {
  const base = ACTION_BY_ID[action].baseRisk;
  let steps = 0;
  if (scope.records > 1000) steps = 2;
  else if (scope.records > 100) steps = 1;
  if (scope.recipients > 5) steps = Math.max(steps, 1);
  const risk = bump(base, steps);
  return { risk, escalated: risk !== base };
}

export function evaluate(input: EvaluationInput): Evaluation {
  const scope = scopeFromParams(input.params);
  const v = input.policyVersion;

  if (!isKnownAction(input.action)) {
    return {
      decision: 'deny',
      risk: 'high',
      reason: `"${input.action}" is not in the policy catalog. Unknown actions are denied by default.`,
      ruleDecision: null,
      escalated: false,
      scope,
    };
  }

  const def = ACTION_BY_ID[input.action];
  const { risk, escalated } = classifyRisk(input.action, scope);
  const ruleDecision: Decision = input.rules[input.action] ?? 'deny';

  if (input.agentStatus === 'suspended') {
    return {
      decision: 'deny',
      risk,
      reason: 'Agent is suspended. Every request is denied until the owner reactivates it.',
      ruleDecision,
      escalated,
      scope,
    };
  }

  if (ruleDecision === 'deny') {
    return { decision: 'deny', risk, reason: `Policy v${v} blocks "${def.label}".`, ruleDecision, escalated, scope };
  }

  if (ruleDecision === 'review') {
    return {
      decision: 'review',
      risk,
      reason: `Policy v${v} requires owner approval for "${def.label}".`,
      ruleDecision,
      escalated,
      scope,
    };
  }

  // ruleDecision === 'allow'
  if (risk === 'high') {
    return {
      decision: 'review',
      risk,
      reason: `Policy v${v} allows "${def.label}", but this request's scope (${scope.records} records) raises risk to high. Owner approval is enforced.`,
      ruleDecision,
      escalated,
      scope,
    };
  }

  return { decision: 'allow', risk, reason: `Policy v${v} allows "${def.label}".`, ruleDecision, escalated, scope };
}
