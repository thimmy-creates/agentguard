//! AGENTGUARD contract.
//!
//! Stores *hashes only*: policy version hashes and decision receipt hashes.
//! Agent names, full policies, approvals and raw requests stay off-chain (SQLite).
//!
//! The backend enforces the action policy. This contract preserves the records.
//! A stored hash is evidence that a decision was recorded; it is NOT proof that
//! an action was safe or that it executed as described.

use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault};

const MAX_ID_LEN: usize = 64;
const HASH_HEX_LEN: usize = 64; // sha256 as hex
const DECISION_TYPES: [&str; 4] = ["allow", "deny", "review_approved", "review_rejected"];

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Agents,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct HistoryEntry {
    /// "policy" or "decision"
    pub kind: String,
    /// Policy hash or decision receipt hash (hex sha256).
    pub hash: String,
    /// Empty for policy entries; allow | deny | review_approved | review_rejected for decisions.
    pub decision_type: String,
    pub timestamp_ms: u64,
    pub block_height: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct AgentRecord {
    pub agent_id: String,
    pub owner: AccountId,
    pub policy_version: u32,
    pub policy_hash: String,
    pub history: Vec<HistoryEntry>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Backend-controlled writer account. Its testnet key lives server-side only.
    writer: AccountId,
    agents: LookupMap<String, AgentRecord>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(writer: AccountId) -> Self {
        Self {
            writer,
            agents: LookupMap::new(StorageKey::Agents),
        }
    }

    /// 1. Register an agent and its owner.
    pub fn register_agent(&mut self, agent_id: String, owner: AccountId) {
        self.assert_writer();
        Self::assert_id(&agent_id);
        require!(!self.agents.contains_key(&agent_id), "Agent already registered");
        self.agents.insert(
            agent_id.clone(),
            AgentRecord {
                agent_id,
                owner,
                policy_version: 0,
                policy_hash: String::new(),
                history: Vec::new(),
            },
        );
    }

    /// 2. Record a new policy version hash for an agent.
    pub fn update_policy(&mut self, agent_id: String, policy_hash: String) {
        self.assert_writer();
        Self::assert_hash(&policy_hash);
        let entry = Self::entry("policy", &policy_hash, "");
        let record = self.agents.get_mut(&agent_id).unwrap_or_else(|| env::panic_str("Unknown agent"));
        record.policy_version += 1;
        record.policy_hash = policy_hash;
        record.history.push(entry);
    }

    /// 3. Record a decision receipt hash. decision_type: allow | deny | review_approved | review_rejected.
    pub fn record_decision(&mut self, agent_id: String, decision_hash: String, decision_type: String) {
        self.assert_writer();
        Self::assert_hash(&decision_hash);
        require!(DECISION_TYPES.contains(&decision_type.as_str()), "Invalid decision_type");
        let entry = Self::entry("decision", &decision_hash, &decision_type);
        let record = self.agents.get_mut(&agent_id).unwrap_or_else(|| env::panic_str("Unknown agent"));
        record.history.push(entry);
    }

    /// 4. Read the full on-chain history (policy hashes and decision receipts) for an agent.
    pub fn get_agent_history(&self, agent_id: String) -> Vec<HistoryEntry> {
        self.agents.get(&agent_id).map(|r| r.history.clone()).unwrap_or_default()
    }

    pub fn get_agent(&self, agent_id: String) -> Option<AgentRecord> {
        self.agents.get(&agent_id).cloned()
    }

    pub fn get_writer(&self) -> AccountId {
        self.writer.clone()
    }

    /// Owner of the contract can rotate the writer account.
    pub fn set_writer(&mut self, writer: AccountId) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only the contract account can change the writer"
        );
        self.writer = writer;
    }
}

impl Contract {
    fn assert_writer(&self) {
        require!(
            env::predecessor_account_id() == self.writer,
            "Only the authorised writer account can write records"
        );
    }

    fn assert_id(id: &str) {
        require!(!id.is_empty() && id.len() <= MAX_ID_LEN, "Invalid agent_id length");
    }

    fn assert_hash(hash: &str) {
        require!(
            hash.len() == HASH_HEX_LEN && hash.bytes().all(|b| b.is_ascii_hexdigit()),
            "Hash must be a 64 character hex string"
        );
    }

    fn entry(kind: &str, hash: &str, decision_type: &str) -> HistoryEntry {
        HistoryEntry {
            kind: kind.to_string(),
            hash: hash.to_string(),
            decision_type: decision_type.to_string(),
            timestamp_ms: env::block_timestamp_ms(),
            block_height: env::block_height(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const H1: &str = "bea1ca88823d9dcaaecaa8bea1ca88823d9dcaaecaa8bea1ca88823d9dcaaeca";
    const H2: &str = "cf631b5995b3a61ac1c47d956e5be257af6f8d596e317c4d4e2956e57aac7170";

    fn acct(n: &str) -> AccountId {
        n.parse().unwrap()
    }

    fn as_account(n: &str) {
        testing_env!(VMContextBuilder::new().predecessor_account_id(acct(n)).build());
    }

    fn fresh() -> Contract {
        as_account("writer.testnet");
        Contract::new(acct("writer.testnet"))
    }

    #[test]
    fn registers_and_records_history() {
        let mut c = fresh();
        c.register_agent("agt_1".into(), acct("owner.testnet"));
        c.update_policy("agt_1".into(), H1.into());
        c.record_decision("agt_1".into(), H2.into(), "review_rejected".into());
        let h = c.get_agent_history("agt_1".into());
        assert_eq!(h.len(), 2);
        assert_eq!(h[0].kind, "policy");
        assert_eq!(h[1].decision_type, "review_rejected");
        assert_eq!(c.get_agent("agt_1".into()).unwrap().policy_version, 1);
    }

    #[test]
    #[should_panic(expected = "Only the authorised writer")]
    fn rejects_non_writer() {
        let mut c = fresh();
        c.register_agent("agt_1".into(), acct("owner.testnet"));
        as_account("mallory.testnet");
        c.record_decision("agt_1".into(), H2.into(), "allow".into());
    }

    #[test]
    #[should_panic(expected = "Unknown agent")]
    fn rejects_unknown_agent() {
        let mut c = fresh();
        c.record_decision("ghost".into(), H2.into(), "allow".into());
    }

    #[test]
    #[should_panic(expected = "64 character hex")]
    fn rejects_malformed_hash() {
        let mut c = fresh();
        c.register_agent("agt_1".into(), acct("owner.testnet"));
        c.update_policy("agt_1".into(), "not-a-hash".into());
    }

    #[test]
    #[should_panic(expected = "Invalid decision_type")]
    fn rejects_bad_decision_type() {
        let mut c = fresh();
        c.register_agent("agt_1".into(), acct("owner.testnet"));
        c.record_decision("agt_1".into(), H2.into(), "maybe".into());
    }

    #[test]
    #[should_panic(expected = "already registered")]
    fn rejects_duplicate_agent() {
        let mut c = fresh();
        c.register_agent("agt_1".into(), acct("owner.testnet"));
        c.register_agent("agt_1".into(), acct("owner.testnet"));
    }
}
