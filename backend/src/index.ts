import 'dotenv/config';
import './database/db';
import { seedIfEmpty } from './database/seed';
import { createApp } from './app';
import { chainInfo } from './blockchain/near';

seedIfEmpty();

const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => {
  const chain = chainInfo();
  console.log(`AGENTGUARD gateway listening on http://localhost:${port}`);
  console.log(
    chain.mode === 'testnet'
      ? `NEAR: live on ${chain.network}, contract ${chain.contract}`
      : 'NEAR: SIMULATED mode (set NEAR_* env vars for live testnet writes)',
  );
});
