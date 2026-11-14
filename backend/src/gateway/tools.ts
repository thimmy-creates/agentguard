import type { ActionId, Row } from '../types';
import { scopeFromParams } from '../policy-engine/engine';

/**
 * Controlled MOCK tool adapters.
 *
 * NEAR cannot control external tools, so AGENTGUARD sits between the agent and
 * its tools. In this MVP every action runs through one of these adapters. They
 * touch no real systems: that keeps the demo honest and testable.
 */

export interface ToolResult {
  ok: true;
  mock: true;
  summary: string;
  detail: Record<string, unknown>;
}

type Adapter = (params: Record<string, unknown>) => ToolResult;

const adapters: Record<ActionId, Adapter> = {
  read_project_data: (p) => {
    const { records } = scopeFromParams(p);
    return { ok: true, mock: true, summary: `Read ${records} record${records === 1 ? '' : 's'} (mock workspace)`, detail: { records } };
  },
  create_project_tasks: (p) => {
    const title = typeof p.title === 'string' && p.title ? p.title : 'Untitled task';
    const id = `TASK-${Math.floor(1000 + Math.random() * 9000)}`;
    return { ok: true, mock: true, summary: `Created ${id}: "${title}"`, detail: { id, title } };
  },
  export_workspace_data: (p) => {
    const { records } = scopeFromParams(p);
    return {
      ok: true,
      mock: true,
      summary: `Generated mock export of ${records} records. Nothing was delivered anywhere.`,
      detail: { records, delivered: false },
    };
  },
  delete_project_records: (p) => {
    const { records } = scopeFromParams(p);
    return { ok: true, mock: true, summary: `Mock-deleted ${records} records`, detail: { records } };
  },
  send_external_messages: (p) => {
    const { recipients } = scopeFromParams(p);
    return {
      ok: true,
      mock: true,
      summary: `Queued ${recipients || 1} message${recipients > 1 ? 's' : ''} in the mock outbox. Nothing was sent.`,
      detail: { recipients: recipients || 1, sent: false },
    };
  },
};

export function executeTool(action: ActionId, params: Record<string, unknown>): ToolResult {
  return adapters[action](params);
}

export type { Row };
