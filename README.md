# AGENTGUARD

**The security layer between AI agents and their actions.**
Give AI agents freedom to work, without giving them unlimited authority.

AGENTGUARD is a permission-based gateway. Every action an agent requests passes through a deterministic policy engine before anything executes. Sensitive actions pause for a human. Every decision gets a cryptographic receipt, and the receipt hash is recorded on NEAR.

NEAR Hackathon 2026 · solo project.

## What is in the box

| Screen | What it does |
| --- | --- |
| Security overview | Agents, allowed, blocked and pending counts, 12-hour activity chart, live event feed, NEAR receipt count |
| Agents | Register agents (with a one-time API key), see permissions and activity history, suspend or reactivate |
| Policies | Set Allowed / Approval required / Blocked per action. Each publish creates a new hashed version |
| Approval centre | Requested action, agent, applicable policy and reason. Approve or reject |
| Audit explorer | Action, decision, timestamp, policy version, NEAR transaction reference. Verify any receipt |

## Run it

Needs Node 20+ (tested on 22). Rust is only needed for the contract.

Create the backend's local environment file from the checked-in template:

```bash
cp backend/.env.example backend/.env
```

The template starts with `SEED=false` (an empty database). Set it to `true` if
you want the demo agents and sample history. With the NEAR account, private key
and contract ID left blank, the app uses simulated mode. To enable live testnet
writes, fill in those values in `backend/.env`; never commit that local file or
share the private key.

```bash
npm run install:all
npm start            # builds the dashboard, serves everything on http://localhost:4000
```

Development with hot reload:

```bash
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173 (proxies /api)
```

When `SEED=true`, the first run seeds three demo agents with history and pending approvals.

Tests:

```bash
npm test    # policy engine + hashing (backend), contract unit tests (cargo)
```

## NEAR: simulated vs live

Unless all three NEAR writer values (`NEAR_ACCOUNT_ID`, `NEAR_PRIVATE_KEY` and `NEAR_CONTRACT_ID`) are configured, the backend runs in **simulated mode**. Receipts are still canonicalised and SHA-256 hashed and stored locally, but nothing is written to NEAR, and transaction references are prefixed `sim_` and labelled **Simulated** in the UI. Keep this mode documented: it makes local demos easy to run and clearly distinguishes simulated receipts from real on-chain writes. The gateway's allowed actions use mock adapters in either mode; no real external data is read, sent or deleted.

To go live on testnet:

```bash
# 1. Build and deploy the contract (needs near-cli and cargo-near)
cd contract
cargo near build
near create-account agentguard.<you>.testnet --useFaucet
near deploy agentguard.<you>.testnet target/near/agentguard_contract.wasm
near call agentguard.<you>.testnet new '{"writer":"writer.<you>.testnet"}' --accountId agentguard.<you>.testnet

# 2. Give the backend its writer credentials in backend/.env
# Set NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY and NEAR_CONTRACT_ID
```

The writer private key stays server-side. The dashboard then shows real transaction links to the NEAR explorer. I could not deploy to testnet from the build environment, so the live path is implemented but has not been exercised against a real network. Run one request and check the explorer link before you demo it.

## How the engine decides

Deterministic. No AI model is involved in any decision. Evaluation order:

1. Unknown action: **deny** (default deny)
2. Suspended agent: **deny**
3. Risk: base risk of the action, raised by scope (over 100 records or more than 5 recipients: one level; over 1,000 records: two)
4. Owner's rule for the action: **allow**, **review** or **deny**
5. Guardrail: an `allow` on a high-risk request becomes **review**. Rules can tighten at runtime, never loosen

Allowed actions run through **mock tool adapters** only. NEAR cannot control external tools, so the gateway sits between agent and tool, and in this MVP the tools are mocks. Nothing real is read, sent or deleted.

## What lives where

| Data | Storage |
| --- | --- |
| Agent names, full policies, approvals, raw requests | SQLite |
| Policy version hash, decision receipt hash | NEAR |
| Contract transaction reference | SQLite |

A stored hash is evidence that a decision was recorded. It is not proof that an action was safe.

## Call the gateway as an agent

Start the app, open **Agents**, and register an agent with a policy preset. Copy
its agent ID and one-time API key when they are shown; the key cannot be viewed
again. With the default `SEED=false`, the database starts empty, so register an
agent yourself. This API example sends a request as that agent (it does not
start or prompt an AI model):

```bash
curl -X POST http://localhost:4000/api/gateway/request \
  -H "x-agent-key: <key shown once at registration>" \
  -H "content-type: application/json" \
  -d '{"agent_id":"agt_xxxx","action":"export_workspace_data","params":{"records":340}}'
```

Depending on the agent's policy and the request's risk, the gateway allows the
request (`200`), queues it for human approval (`202`), or denies it (`403`).
An invalid agent ID or key returns `401`. Allowed requests invoke only a mock
tool adapter; review and deny outcomes do not run the action.
Actions: `read_project_data`, `create_project_tasks`, `export_workspace_data`, `delete_project_records`, `send_external_messages`.

## Structure

```
agentguard/
├── frontend/   React + TypeScript + Tailwind v4 (dashboard, agents, policies, approvals, audit)
├── backend/    Express gateway, policy-engine, blockchain (NEAR writer), database (SQLite)
├── contract/   Rust + near-sdk: register_agent, update_policy, record_decision, get_agent_history
└── docs/       architecture.md, demo-script.md
```

## Known limits (MVP)

- The dashboard has no login. Owner actions (approve, edit policy) are open to anyone who can reach the server. Do not expose it publicly.
- Single owner, single backend writer account. No team management.
- Live NEAR writes are untested against a real network (see above).
