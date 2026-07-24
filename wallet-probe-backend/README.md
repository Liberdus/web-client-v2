# Liberdus wallet probe backend

This folder contains the backend-only HTTP service used by Web Client V2 to
discover balances and tokens for an EVM wallet across the configured networks.
It reuses the shared EVM implementation in `../evm` and does not contain UI
code, private keys, or provider credentials.

## Start locally

From this folder:

```sh
ANKR_MULTICHAIN_ENDPOINT='https://your-backend-controlled-endpoint' npm start
```

Or from the Web Client V2 repository root:

```sh
ANKR_MULTICHAIN_ENDPOINT='https://your-backend-controlled-endpoint' \
  npm run serve:wallet-probe
```

The server binds to `127.0.0.1:8787` by default. Override the port with
`WALLET_PROBE_PORT`.

## API

Health check:

```sh
curl http://127.0.0.1:8787/health
```

Probe every configured chain for any valid EVM address:

```sh
curl 'http://127.0.0.1:8787/?wallet=0x0000000000000000000000000000000000000000'
```

The response is JSON and includes aggregate USD value, per-chain totals, token
contract addresses, symbols, prices, amounts, and values. Append
`&format=text` only for the legacy terminal view.

Provider credentials must be supplied through the environment or a backend
secret store. Never commit them to this repository or expose them to browser
code.

## Tests

```sh
npm test
```
