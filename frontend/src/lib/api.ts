export type Decision = 'allow' | 'review' | 'deny';
export type Risk = 'low' | 'medium' | 'high';
export type DecisionType = 'allow' | 'deny' | 'review_approved' | 'review_rejected';
export type ActionId =
  | 'read_project_data'
  | 'create_project_tasks'
  | 'export_workspace_data'
  | 'delete_project_records'
  | 'send_external_messages';
export type Rules = Record<ActionId, Decision>;
export type ChainStatus = 'pending' | 'confirmed' | 'simulated' | 'failed';
export type RequestStatus = 'executed' | 'pending' | 'approved' | 'rejected' | 'denied';

export interface ActionDef {
  id: ActionId;
  label: string;
  description: string;
  baseRisk: Risk;
  defaultDecision: Decision;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'suspended';
  owner: string;
  created_at: string;
  policy_version: number;
  policy_hash: string;
  rules: Rules;
  permission_counts: Record<Decision, number>;
  stats: { total: number; allowed: number; blocked: number; pending: number; last_active: string | null };
}

export interface ChainInfo {
  mode: 'testnet' | 'simulated';
  network: string;
  contract: string | null;
  writer: string | null;
  explorerBase: string;
}

export interface EventItem {
  id: number;
  ts: string;
  kind: string;
  agent_id: string | null;
  agent_name: string | null;
  action: string | null;
  decision: string | null;
  risk: Risk | null;
  message: string;
}

export interface Overview {
  totals: { agents: number; active_agents: number; allowed: number; blocked: number; pending: number; requests: number };
  timeline: { hour: string; allow: number; review: number; deny: number }[];
  agents: Agent[];
  events: EventItem[];
  chain: ChainInfo & { receipts: number; anchored: number };
}

export interface ApprovalItem {
  id: string;
  agent_id: string;
  agent_name: string;
  action: string;
  params: Record<string, unknown>;
  risk: Risk;
  decision: Decision;
  status: RequestStatus;
  reason: string;
  rule_decision: Decision | null;
  policy_version: number;
  policy_hash: string;
  source: string;
  result: { summary: string } | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface AuditItem {
  id: string;
  request_id: string;
  agent_id: string;
  agent_name: string | null;
  action: string;
  decision_type: DecisionType;
  risk: Risk;
  policy_version: number;
  policy_hash: string;
  decision_hash: string;
  near_tx: string | null;
  near_status: ChainStatus;
  near_mode: 'testnet' | 'simulated' | null;
  near_error: string | null;
  created_at: string;
}

export interface AuditDetail extends AuditItem {
  payload: Record<string, unknown>;
}

export interface VerifyResult {
  id: string;
  stored_hash: string;
  recomputed_hash: string;
  hash_matches: boolean;
  request_params_match: boolean;
  valid: boolean;
  on_chain: boolean;
  near_mode: string | null;
  note: string;
}

export interface HistoryItem {
  id: string;
  action: string;
  risk: Risk;
  decision: Decision;
  status: RequestStatus;
  reason: string;
  policy_version: number;
  source: string;
  created_at: string;
}

export interface PolicyVersion {
  version: number;
  rules: Rules;
  policy_hash: string;
  near_tx: string | null;
  near_status: ChainStatus;
  near_mode: string | null;
  created_at: string;
}

export interface AgentDetail {
  agent: Agent;
  history: HistoryItem[];
  policy_versions: PolicyVersion[];
}

export interface PolicyResponse {
  agent_id: string;
  version: number;
  hash: string;
  rules: Rules;
  history: PolicyVersion[];
}

export interface GatewayOutcome {
  request_id: string;
  decision: Decision;
  status: RequestStatus;
  risk: Risk;
  reason: string;
  policy_version: number;
  result: { summary: string } | null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError('Cannot reach the AGENTGUARD gateway. Is the backend running?', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

const body = (b?: unknown) => (b === undefined ? undefined : JSON.stringify(b));

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, b?: unknown) => request<T>(path, { method: 'POST', body: body(b) }),
  put: <T>(path: string, b?: unknown) => request<T>(path, { method: 'PUT', body: body(b) }),
  patch: <T>(path: string, b?: unknown) => request<T>(path, { method: 'PATCH', body: body(b) }),
};
