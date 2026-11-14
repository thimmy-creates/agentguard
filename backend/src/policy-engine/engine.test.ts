import assert from 'node:assert/strict';
import { evaluate } from './engine';
import { ACTIONS } from './actions';
import { canonicalize, hashObject } from './hash';
import type { Rules } from '../types';

const rules = Object.fromEntries(ACTIONS.map((a) => [a.id, a.defaultDecision])) as Rules;
const base = { agentStatus: 'active' as const, rules, policyVersion: 3 };

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

console.log('policy engine');

test('read project data is allowed (low risk)', () => {
  const r = evaluate({ ...base, action: 'read_project_data', params: { records: 10 } });
  assert.equal(r.decision, 'allow');
  assert.equal(r.risk, 'low');
});

test('create project tasks is allowed', () => {
  assert.equal(evaluate({ ...base, action: 'create_project_tasks', params: {} }).decision, 'allow');
});

test('export workspace data requires approval (high risk)', () => {
  const r = evaluate({ ...base, action: 'export_workspace_data', params: {} });
  assert.equal(r.decision, 'review');
  assert.equal(r.risk, 'high');
});

test('delete project records is blocked', () => {
  assert.equal(evaluate({ ...base, action: 'delete_project_records', params: {} }).decision, 'deny');
});

test('send external messages requires approval (medium risk)', () => {
  const r = evaluate({ ...base, action: 'send_external_messages', params: { recipients: ['a@x.com'] } });
  assert.equal(r.decision, 'review');
  assert.equal(r.risk, 'medium');
});

test('bulk scope escalates risk', () => {
  assert.equal(evaluate({ ...base, action: 'read_project_data', params: { records: 500 } }).risk, 'medium');
});

test('allowed action with high-risk scope is forced to review', () => {
  const r = evaluate({ ...base, action: 'read_project_data', params: { records: 5000 } });
  assert.equal(r.risk, 'high');
  assert.equal(r.decision, 'review');
  assert.equal(r.ruleDecision, 'allow');
});

test('guardrail never loosens a block', () => {
  assert.equal(evaluate({ ...base, action: 'delete_project_records', params: { records: 1 } }).decision, 'deny');
});

test('unknown actions are denied by default', () => {
  assert.equal(evaluate({ ...base, action: 'wire_money', params: {} }).decision, 'deny');
});

test('suspended agents are denied even for allowed actions', () => {
  const r = evaluate({ ...base, agentStatus: 'suspended', action: 'read_project_data', params: {} });
  assert.equal(r.decision, 'deny');
});

test('same input always yields the same output', () => {
  const a = evaluate({ ...base, action: 'export_workspace_data', params: { records: 7 } });
  const b = evaluate({ ...base, action: 'export_workspace_data', params: { records: 7 } });
  assert.deepEqual(a, b);
});

console.log('hashing');

test('canonicalize is key-order independent', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 2, c: 3 } }), canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
  assert.equal(hashObject({ x: 1, y: 2 }), hashObject({ y: 2, x: 1 }));
});

test('hash changes when data changes', () => {
  assert.notEqual(hashObject({ decision: 'allow' }), hashObject({ decision: 'deny' }));
});

console.log(`\n${passed} passed`);
