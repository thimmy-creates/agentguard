import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.cwd(), process.env.DATA_DIR ?? 'data');
fs.mkdirSync(dir, { recursive: true });

export const db = new Database(path.join(dir, 'agentguard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Application data lives here. Only hashes ever go to NEAR.
db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'active',
  owner          TEXT NOT NULL,
  api_key_hash   TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL REFERENCES agents(id),
  version      INTEGER NOT NULL,
  rules_json   TEXT NOT NULL,
  policy_hash  TEXT NOT NULL,
  near_tx      TEXT,
  near_status  TEXT NOT NULL DEFAULT 'pending',
  near_mode    TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE(agent_id, version)
);

CREATE TABLE IF NOT EXISTS requests (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  action          TEXT NOT NULL,
  params_json     TEXT NOT NULL,
  risk            TEXT NOT NULL,
  decision        TEXT NOT NULL,
  status          TEXT NOT NULL,
  reason          TEXT NOT NULL,
  rule_decision   TEXT,
  policy_version  INTEGER NOT NULL,
  policy_hash     TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'gateway',
  result_json     TEXT,
  created_at      TEXT NOT NULL,
  resolved_at     TEXT,
  resolved_by     TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_agent ON requests(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit (
  id             TEXT PRIMARY KEY,
  request_id     TEXT NOT NULL REFERENCES requests(id),
  agent_id       TEXT NOT NULL REFERENCES agents(id),
  action         TEXT NOT NULL,
  decision_type  TEXT NOT NULL,
  risk           TEXT NOT NULL,
  policy_version INTEGER NOT NULL,
  policy_hash    TEXT NOT NULL,
  decision_hash  TEXT NOT NULL,
  payload_json   TEXT NOT NULL,
  near_tx        TEXT,
  near_status    TEXT NOT NULL DEFAULT 'pending',
  near_mode      TEXT,
  near_error     TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  kind        TEXT NOT NULL,
  agent_id    TEXT,
  agent_name  TEXT,
  action      TEXT,
  decision    TEXT,
  risk        TEXT,
  message     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_id ON events(id DESC);
`);
