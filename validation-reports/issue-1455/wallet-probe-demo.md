# Issue 1455 Wallet Probe Demo

## Start the server

The default port is `8787`:

```sh
npm run serve:wallet-probe
```

If that port is occupied, select another port:

```sh
WALLET_PROBE_PORT=8788 npm run serve:wallet-probe
```

## Demo command

Replace `[wallet]` with any 20-byte EVM address:

```sh
curl -fsS http://127.0.0.1:8788/api/wallets/[wallet]/portfolio
```

Current test-wallet example:

```sh
curl -fsS \
  http://127.0.0.1:8788/api/wallets/0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760/portfolio
```

Validated output on 2026-07-17:

```text
Total value across all chains: unavailable
Available balances for 0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760:
Ethereum (1 token):
  0 ETH
Polygon (1 token):
  0 POL
Arbitrum One (1 token):
  0 ETH
OP Mainnet (1 token):
  0 ETH
Base (1 token):
  0 ETH
BNB Smart Chain (1 token):
  0 BNB
Token discovery: native balances only; configure ANKR_API_TOKEN for ERC-20 holdings and USD totals.
```

## Full token and USD demo

Public JSON-RPC provides native balances but cannot enumerate every ERC-20 contract held by an address. Configure an Ankr multichain API token to show all assets returned by `ankr_getAccountBalance`, per-chain token counts, per-token USD values, and the portfolio total:

```sh
read -s ANKR_API_TOKEN
export ANKR_API_TOKEN
WALLET_PROBE_PORT=8788 npm run serve:wallet-probe
```

The API token is read from the environment, is never returned by the server, and must not be committed.

## JSON and health endpoints

```sh
curl -fsS http://127.0.0.1:8788/health

curl -fsS -H 'accept: application/json' \
  http://127.0.0.1:8788/api/wallets/0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760/portfolio
```
