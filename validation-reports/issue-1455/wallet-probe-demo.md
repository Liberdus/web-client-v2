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
curl "http://127.0.0.1:8788/?wallet=[wallet]"
```

This simple endpoint always checks every configured chain. Any `chains=...` query parameter is intentionally ignored on this route so an old demo command cannot accidentally reduce the response to one chain.

Current test-wallet example:

```sh
curl "http://127.0.0.1:8788/?wallet=0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760"
```

The default response is JSON. Its top-level structure is:

```json
{
  "walletAddress": "0x...",
  "totalValueUsd": "0.00",
  "chainCount": 6,
  "tokenCount": 6,
  "indexedTokenDiscovery": true,
  "complete": true,
  "updatedAt": "2026-07-17T12:00:00.000Z",
  "chains": [],
  "tokens": [],
  "warnings": []
}
```

Every token object contains:

```json
{
  "chain": "Ethereum",
  "networkId": "ethereum",
  "chainId": 1,
  "contractAddress": null,
  "tokenType": "native",
  "tokenName": "Ether",
  "tokenSymbol": "ETH",
  "tokenPriceUsd": "1824.06",
  "tokenAmount": "7.3687",
  "tokenValueUsd": "13441.03",
  "tokenDecimals": 18,
  "rawAmount": "7368700000000000000",
  "logoUrl": null
}
```

Native assets use `contractAddress: null`. ERC-20 assets use their contract address. Unknown prices and values use `null`. No portfolio-percentage field is returned.

## Full token and USD demo

Public JSON-RPC provides native balances but cannot enumerate every ERC-20 contract held by an address. Configure an Ankr multichain API token to show all assets returned by `ankr_getAccountBalance`, per-chain token counts, per-token USD values, and the portfolio total:

```sh
read -s ANKR_API_TOKEN
export ANKR_API_TOKEN
WALLET_PROBE_PORT=8788 npm run serve:wallet-probe
```

The API token is read from the environment, is never returned by the server, and must not be committed.

The supplied endpoint is stored persistently in the macOS Login Keychain:

- Service: `liberdus-ankr-multichain-issue-1455`
- Account: `codexwallet1455`

Start the server from that stored endpoint without printing it:

```sh
ANKR_MULTICHAIN_ENDPOINT="$(security find-generic-password \
  -a codexwallet1455 \
  -s liberdus-ankr-multichain-issue-1455 \
  -w)" \
WALLET_PROBE_PORT=8788 \
npm run serve:wallet-probe
```

Unfiltered discovery may include spam assets because any address can receive unsolicited tokens. For a cleaner demo containing only Ankr-whitelisted assets:

```sh
ANKR_MULTICHAIN_ENDPOINT="$(security find-generic-password \
  -a codexwallet1455 \
  -s liberdus-ankr-multichain-issue-1455 \
  -w)" \
ANKR_ONLY_WHITELISTED=true \
WALLET_PROBE_PORT=8788 \
npm run serve:wallet-probe
```

## Text and health endpoints

```sh
curl -fsS http://127.0.0.1:8788/health

curl -fsS \
  'http://127.0.0.1:8788/?wallet=0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760&format=text'
```
