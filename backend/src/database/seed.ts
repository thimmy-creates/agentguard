import { db } from './db';
import { setClock } from '../clock';
import { createAgent, getAgentRow } from '../services/agents';
import { handleRequest } from '../gateway/gateway';
import { resolve } from '../services/approvals';
import { activePolicy, publishPolicy } from '../services/policies';
import type { Rules } from '../types';

/**
 * Demo data so the dashboard is alive on first run. Everything goes through the
 * real gateway, approval and receipt code, with the clock rewound, so every
 * seeded receipt still verifies. Disable with SEED=false.
 */
export function seedIfEmpty() {
  if (process.env.SEED === 'false') return;
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM agents`).get() as { n: number }).n;
  if (count > 0) return;

  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  let cursor = minutesAgo(600);
  setClock(() => {
    cursor = new Date(cursor.getTime() + 1500);
    return cursor;
  });
  const at = (m: number) => {
    cursor = minutesAgo(m);
  };

  const atlas = createAgent({ name: 'Atlas', description: 'Project manager agent. Plans sprints and keeps the board tidy.', preset: 'standard' });
  const scribe = createAgent({ name: 'Scribe', description: 'Outreach agent. Drafts and sends customer updates.', preset: 'standard' });
  const sentinel = createAgent({ name: 'Sentinel', description: 'Analyst agent. Reads project data for weekly reports.', preset: 'read_only' });

  const a = getAgentRow(atlas.agent.id)!;
  const s = getAgentRow(scribe.agent.id)!;
  const n = getAgentRow(sentinel.agent.id)!;

  // Atlas gets a stricter policy mid-way through the day, so history shows two versions.
  at(560);
  handleRequest(a, 'read_project_data', { records: 24 }, 'seed');
  at(540);
  handleRequest(a, 'create_project_tasks', { title: 'Plan sprint 14 kickoff' }, 'seed');
  at(500);
  handleRequest(a, 'create_project_tasks', { title: 'Triage open bug reports' }, 'seed');
  at(470);
  handleRequest(a, 'delete_project_records', { records: 3 }, 'seed');
  at(430);
  const tightened: Rules = { ...activePolicy(a.id).rules, send_external_messages: 'deny' };
  publishPolicy(a, tightened, { silent: true });

  at(380);
  handleRequest(n, 'read_project_data', { records: 120 }, 'seed');
  at(350);
  handleRequest(n, 'read_project_data', { records: 18 }, 'seed');
  at(300);
  handleRequest(n, 'export_workspace_data', { records: 800 }, 'seed');
  at(260);
  handleRequest(n, 'send_external_messages', { to: 'press@example.com' }, 'seed');

  at(240);
  const exp = handleRequest(a, 'export_workspace_data', { records: 340, format: 'csv' }, 'seed');
  at(225);
  resolve(exp.request_id, 'reject');
  at(200);
  const msg = handleRequest(s, 'send_external_messages', { recipients: ['ana@acme.io', 'dev@acme.io'], subject: 'Release notes' }, 'seed');
  at(190);
  resolve(msg.request_id, 'approve');
  at(170);
  handleRequest(s, 'read_project_data', { records: 42 }, 'seed');
  at(140);
  handleRequest(s, 'read_project_data', { records: 4200 }, 'seed'); // bulk scope, escalated to approval
  at(120);
  handleRequest(s, 'delete_project_records', { records: 12 }, 'seed');
  at(95);
  handleRequest(a, 'create_project_tasks', { title: 'Prepare launch checklist' }, 'seed');
  at(70);
  handleRequest(a, 'read_project_data', { records: 64 }, 'seed');
  at(48);
  handleRequest(s, 'send_external_messages', { recipients: Array.from({ length: 9 }, (_, i) => `lead${i}@corp.dev`) }, 'seed');
  at(25);
  handleRequest(a, 'export_workspace_data', { records: 1250, format: 'json' }, 'seed');
  at(9);
  handleRequest(n, 'read_project_data', { records: 31 }, 'seed');

  setClock(null);
  console.log('Seeded demo data: 3 agents, with history and pending approvals.');
}
