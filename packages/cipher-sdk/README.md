# @cipher/sdk (local)

A minimal TypeScript SDK for the Cipher backend.

## Install (local)

Add to your monorepo workspace and build:

```bash
bun install
bun run build
```

## Usage

```ts
import { CipherSDK } from '@cipher/sdk'

const sdk = new CipherSDK({
  baseUrl: 'http://localhost:3000',
  apiKey: 'cypher_...'
})

// Wallet-only mode
const r1 = await sdk.calculateFromWallet('MovHj25KabjUuoYRGMWHsGxHjb1JgCLdefbVrPFQwwJ')

// Manual mode
const r2 = await sdk.calculateFromMetrics({
  wallet_age_days: 365,
  transaction_count: 120,
  total_volume_usd: 50000,
  unique_protocols: 10,
  defi_positions: 3,
  nft_count: 4,
  failed_txs: 2,
  sol_balance: 100000000
})

// Wallet status
const status = await sdk.walletStatus('B66RQN7Ptrt4G11fHZq8dJdw1kNbJGZ6dxVYaHXZnLXV')
```

## Build

```bash
bun run build
```

This will emit `dist/` with CJS/ESM typings (ESM JS output).
