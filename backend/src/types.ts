export type Decision = 'allow' | 'review' | 'deny';
export type Risk = 'low' | 'medium' | 'high';

export const ACTION_IDS = [
  'read_project_data',
  'create_project_tasks',
  'export_workspace_data',
  'delete_project_records',
  'send_external_messages',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];
export type Rules = Record<ActionId, Decision>;

export type RequestStatus = 'executed' | 'pending' | 'approved' | 'rejected' | 'denied';
export type DecisionType = 'allow' | 'deny' | 'review_approved' | 'review_rejected';
export type RequestSource = 'gateway' | 'simulator' | 'seed';

export type Row = Record<string, any>;
