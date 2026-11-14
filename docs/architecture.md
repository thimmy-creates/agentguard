# AGENTGUARD architecture

## Request flow

```
AI agent ──► Gateway ──► Policy engine ──┬─ ALLOW  ─► Mock tool executor ─┐
                                         ├─ REVIEW ─► Approval queue ──┬──┤
                                         └─ DENY   ─► Reject request ──┘  │
                                                                          ▼
                                              Hash generator ─► NEAR contract ─► Verifiable audit receipt
```

1. The agent calls `POST /api/gateway/request` with its `x-agent-key`.
2. The gateway authenticates the agent and loads its active policy version from SQLite.
3. The policy engine returns `allow`, `review` or `deny` plus a risk level and a plain-language reason.
4. `allow` executes through a mock tool adapter. `review` is stored as `pending` and waits in the Approval centre. `deny` is rejected.
5. Allow and deny get a receipt immediately. Review gets one when the owner approves or rejects.
6. The receipt is canonicalised (sorted keys), hashed with SHA-256, stored in SQLite, and the hash is sent to NEAR by the backend writer account.

## Modules

| Path | Responsibility |
| --- | --- |
| `backend/src/policy-engine` | Action catalog, deterministic `evaluate()`, canonical JSON and SHA-256 |
| `backend/src/gateway` | `handleRequest()` orchestration and the mock tool adapters |
| `backend/src/services` | Agents, policies (versioning), approvals, audit receipts, overview, event bus |
| `backend/src/blockchain` | NEAR writer. Live on testnet when configured, otherwise simulated |
| `backend/src/database` | SQLite schema and demo seeding |
| `backend/src/routes`, `controllers` | REST API and the SSE activity stream |
| `contract/src/lib.rs` | On-chain hash records with a writer-account check |
| `frontend/src` | One folder per screen: `dashboard`, `agents`, `policies`, `approvals`, `audit` |

## Decision logic

```
unknown action      → deny
agent suspended     → deny
risk = base risk of action, raised by scope
rule = owner's setting for the action (allow | review | deny)
rule = deny         → deny
rule = review       → review
rule = allow, risk high → review      (guardrail: only ever stricter)
rule = allow        → allow
```

| Action | Base risk | Default rule |
| --- | --- | --- |
| Read project data | low | allow |
| Create project tasks | low | allow |
| Export workspace data | high | review |
| Delete project records | high | deny |
| Send external messages | medium | review |

Scope escalation: over 100 records or more than 5 recipients raises risk one level. Over 1,000 records raises it two.

## What goes on NEAR

| On NEAR | In SQLite only |
| --- | --- |
| Policy version hash | Agent names and descriptions |
| Decision receipt hash | Full policy configurations |
| | Approval details and raw agent requests |
| | The contract transaction reference |

The receipt includes a digest of the request parameters, never the parameters themselves.

## Contract

| Method | Who can call | Effect |
| --- | --- | --- |
| `register_agent(agent_id, owner)` | writer | Creates the agent record |
| `update_policy(agent_id, policy_hash)` | writer | Bumps version, stores the hash |
| `record_decision(agent_id, decision_hash, decision_type)` | writer | Appends a receipt. Type is `allow`, `deny`, `review_approved` or `review_rejected` |
| `get_agent_history(agent_id)` | anyone (view) | Policy and decision hashes with timestamps and block heights |

Writes are limited to a backend-controlled writer account, and its credentials stay server-side. Hashes must be 64 hex characters.

## Verification

`GET /api/audit/:id/verify` recomputes the receipt hash from the stored payload and checks the request-parameter digest. It detects edits to the local database. A matching hash proves the record was not altered after it was written. It does not prove the action was safe.

## Honest limits

- Mock tools only. The gateway is the control point, and it only controls what is routed through it.
- No dashboard authentication in the MVP.
- Simulated mode is the default without credentials. Simulated references are labelled in the UI.
