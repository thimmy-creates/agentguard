import { randomBytes } from 'node:crypto';

/**
 * NEAR writer. The backend holds a writer account (credentials stay server-side)
 * and calls the AGENTGUARD contract. Only hashes are sent on-chain.
 *
 * If NEAR_ACCOUNT_ID / NEAR_PRIVATE_KEY / NEAR_CONTRACT_ID are not all set, the
 * writer runs in SIMULATED mode: nothing leaves this machine and references are
 * prefixed "sim_" so nobody mistakes them for real transactions.
 */

export type ChainMode = 'testnet' | 'simulated';
export type ChainStatus = 'confirmed' | 'simulated' | 'failed';

export interface ChainResult {
  txHash: string;
  status: ChainStatus;
  mode: ChainMode;
  error?: string;
}

const cfg = () => ({
  account: process.env.NEAR_ACCOUNT_ID ?? '',
  key: process.env.NEAR_PRIVATE_KEY ?? '',
  contract: process.env.NEAR_CONTRACT_ID ?? '',
  network: process.env.NEAR_NETWORK ?? 'testnet',
  rpc: process.env.NEAR_RPC_URL ?? 'https://rpc.testnet.near.org',
  explorer: process.env.NEAR_EXPLORER_URL ?? 'https://testnet.nearblocks.io',
});

export const isLive = (): boolean => {
  const c = cfg();
  return Boolean(c.account && c.key && c.contract);
};

export function chainInfo() {
  const c = cfg();
  const live = isLive();
  return {
    mode: (live ? 'testnet' : 'simulated') as ChainMode,
    network: c.network,
    contract: live ? c.contract : null,
    writer: live ? c.account : null,
    explorerBase: c.explorer,
  };
}

let accountPromise: Promise<any> | null = null;

async function getAccount(): Promise<any> {
  if (!accountPromise) {
    accountPromise = (async () => {
      const c = cfg();
      const mod: any = await import('near-api-js');
      const keyStore = new mod.keyStores.InMemoryKeyStore();
      await keyStore.setKey(c.network, c.account, mod.KeyPair.fromString(c.key));
      const near = await mod.connect({ networkId: c.network, keyStore, nodeUrl: c.rpc });
      return near.account(c.account);
    })();
    accountPromise.catch(() => {
      accountPromise = null; // allow retry after a failed connect
    });
  }
  return accountPromise;
}

// One writer key means one nonce sequence: serialise calls.
let queue: Promise<unknown> = Promise.resolve();

function call(method: string, args: Record<string, unknown>): Promise<ChainResult> {
  const run = async (): Promise<ChainResult> => {
    if (!isLive()) {
      return { txHash: `sim_${randomBytes(16).toString('hex')}`, status: 'simulated', mode: 'simulated' };
    }
    try {
      const c = cfg();
      const account = await getAccount();
      const res = await account.functionCall({
        contractId: c.contract,
        methodName: method,
        args,
        gas: 30_000_000_000_000n,
        attachedDeposit: 0n,
      });
      return { txHash: res.transaction.hash as string, status: 'confirmed', mode: 'testnet' };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`NEAR ${method} failed: ${error}`);
      return { txHash: '', status: 'failed', mode: 'testnet', error };
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

export const registerAgent = (agentId: string, owner: string) => call('register_agent', { agent_id: agentId, owner });

export const updatePolicy = (agentId: string, policyHash: string) =>
  call('update_policy', { agent_id: agentId, policy_hash: policyHash });

export const recordDecision = (agentId: string, decisionHash: string, decisionType: string) =>
  call('record_decision', { agent_id: agentId, decision_hash: decisionHash, decision_type: decisionType });
