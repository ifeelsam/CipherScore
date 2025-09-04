# @cipher/sdk

A minimal TypeScript SDK for the CipherScore API.

## Install

Using Bun (preferred):
```bash
bun add cipherscore-sdk
```

Using npm:
```bash
npm install cipherscore-sdk
```

## Usage

```ts
import { CipherSDK } from 'cipherscore-sdk'

const sdk = new CipherSDK({
  // default base is 'https://api.cipherscore.xyz'
  apiKey: process.env.CIPHERSCORE_API_KEY!
})

// Wallet-only mode
const r1 = await sdk.calculateFromWallet('MovHj25KabjUuoYRGMWHsGxHjb1JgCLdefbVrPFQwwJ')

// Manual metrics mode
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

This will emit `dist/` with ESM JS and `.d.ts` types.
