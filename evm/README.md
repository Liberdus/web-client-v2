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

## Wallet probe demo server

Start the local terminal-demo server:

```sh
npm run serve:wallet-probe
```

It binds to `127.0.0.1:8787` by default. Probe any EVM address with:

```sh
curl "http://127.0.0.1:8787/?wallet=0x0000000000000000000000000000000000000000"
```

Limit the output to selected chains:

```sh
curl -fsS \
  'http://127.0.0.1:8787/?wallet=0x0000000000000000000000000000000000000000&chains=ethereum,polygon,base'
```

JSON is the default response and is ready to pass to the frontend:

```sh
curl 'http://127.0.0.1:8787/?wallet=0x0000000000000000000000000000000000000000'
```

Request the legacy terminal-text view only when needed:

```sh
curl 'http://127.0.0.1:8787/?wallet=0x0000000000000000000000000000000000000000&format=text'
```

Without an indexed-provider credential, the server explicitly reports native balances only. Enable full Ankr native/ERC-20 discovery and aggregate USD totals without placing the token in a command-line argument:

```sh
read -s ANKR_API_TOKEN
export ANKR_API_TOKEN
npm run serve:wallet-probe
```

Alternatively, point the server at a backend-controlled proxy:

```sh
ANKR_MULTICHAIN_ENDPOINT=http://127.0.0.1:9000/api/evm/portfolio \
  npm run serve:wallet-probe
```

Additional configuration:

- `WALLET_PROBE_HOST` changes the bind address. It defaults to localhost for safety.
- `WALLET_PROBE_PORT` changes the listening port.
- `ANKR_ONLY_WHITELISTED=true` hides unlisted/spam assets. The default is `false` so the demo enumerates every asset returned by Ankr.
- `GET /health` reports provider status and monitored chains.

## Tests

```sh
npm run test:evm
```

The tests use fixed public test vectors and mocked RPC/provider responses. They never load the issue 1455 test wallet credential.
