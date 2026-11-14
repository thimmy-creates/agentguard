import type { ActionId, Decision, Risk } from '../types';

export interface ActionDef {
  id: ActionId;
  label: string;
  description: string;
  baseRisk: Risk;
  defaultDecision: Decision;
}

// The five rules from the product spec, in spec order.
export const ACTIONS: ActionDef[] = [
  {
    id: 'read_project_data',
    label: 'Read project data',
    description: 'Read tasks, files and metadata inside a project.',
    baseRisk: 'low',
    defaultDecision: 'allow',
  },
  {
    id: 'create_project_tasks',
    label: 'Create project tasks',
    description: 'Add new tasks to a project board.',
    baseRisk: 'low',
    defaultDecision: 'allow',
  },
  {
    id: 'export_workspace_data',
    label: 'Export workspace data',
    description: 'Bundle workspace data into an export file.',
    baseRisk: 'high',
    defaultDecision: 'review',
  },
  {
    id: 'delete_project_records',
    label: 'Delete project records',
    description: 'Permanently remove project records.',
    baseRisk: 'high',
    defaultDecision: 'deny',
  },
  {
    id: 'send_external_messages',
    label: 'Send external messages',
    description: 'Send email or chat messages outside the workspace.',
    baseRisk: 'medium',
    defaultDecision: 'review',
  },
];

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a])) as Record<ActionId, ActionDef>;
