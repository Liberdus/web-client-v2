# Headless multi-chain wallet infrastructure

This directory contains the non-UI foundation for issue 1455 Phase 1.

## Current capabilities

- Reuses a Liberdus secp256k1 account address as its EVM address.
- Verifies that a private key derives the account's stored address when explicitly requested.
- Queries native balances across configured EVM networks with RPC endpoint fallback.
- Verifies `eth_chainId` before trusting an RPC endpoint.
- Preserves exact balances as decimal strings without floating-point conversion.
- Returns successful network results alongside normalized failures when only some chains are unavailable.
- Normalizes paginated native and ERC-20 holdings from Ankr's `ankr_getAccountBalance` method.
- Falls back to native public-RPC balances when indexed token discovery is unavailable.

No component in this directory sends funds or signs transactions.

## Native balance checks

Run a read-only check for an address across all configured networks:

```sh
npm run check:evm-balances -- --address 0x...
```

Limit the check to specific networks:

```sh
npm run check:evm-balances -- \
  --address 0x... \
  --networks ethereum,polygon,base
```

The default registry currently includes Ethereum, Polygon, Arbitrum One, OP Mainnet, Base, and BNB Smart Chain. Each network has two public endpoints and every endpoint must return its configured chain ID before a balance request is accepted.

## Indexed token discovery

Automatic ERC-20 discovery cannot be implemented with standard JSON-RPC alone. Configure `AnkrPortfolioProvider` with either:

- a backend endpoint that proxies and authorizes Ankr requests; or
- an Ankr multichain endpoint for local-only validation.

Do not embed an Ankr token in committed client configuration.

```js
import {
  AnkrPortfolioProvider,
  EvmRpcPool,
  MultiChainWalletService,
} from './evm/index.js';

const rpcPool = new EvmRpcPool();
const tokenProvider = new AnkrPortfolioProvider({
  endpoint: '/api/evm/portfolio',
});
const walletService = new MultiChainWalletService({ rpcPool, tokenProvider });

const portfolio = await walletService.discoverAssets(
  '0x0000000000000000000000000000000000000001',
  ['ethereum', 'polygon', 'base'],
);
```

The backend endpoint must accept JSON-RPC 2.0 `ankr_getAccountBalance` requests and return the corresponding JSON-RPC response. Provider credentials must remain on the backend.

## Tests

```sh
npm run test:evm
```

The tests use fixed public test vectors and mocked RPC/provider responses. They never load the issue 1455 test wallet credential.
