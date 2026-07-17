# Issue 1455 Phase 1 Infrastructure Validation

## Scope

This validation covers headless multi-chain identity, native-balance RPC fallback, and indexed token-discovery normalization. No UI/UX code and no transaction-sending code are included.

## Test wallet

- Username: `codexwallet1455`
- Public address: `0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760`
- Credential location: macOS Login Keychain service `liberdus-codex-test-wallet-issue-1455`, account `codexwallet1455`

The private key was not printed, written to the repository, or used for balance RPC requests.

## Identity validation

The private key was loaded once from the platform during wallet creation, stored in the Login Keychain, and independently passed through the repository's secp256k1 and Keccak-256 implementations. The derived address matched the Liberdus public address exactly. Temporary in-memory key material was then cleared.

This confirms that the existing Liberdus account key maps to the same externally owned account address on EVM-compatible networks.

## Automated validation

Command:

```sh
npm test
```

Result on 2026-07-17:

- 10 tests passed
- 0 tests failed
- Identity derivation and account verification passed
- Exact unit formatting and hexadecimal quantity parsing passed
- RPC fallback and chain-ID mismatch rejection passed
- Partial multi-chain failure handling passed
- Ankr pagination and asset normalization passed
- Indexed-provider failure to public-RPC fallback passed

## Live read-only RPC validation

Command:

```sh
npm run check:evm-balances -- \
  --address 0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760
```

The address was queried successfully on:

- Ethereum, chain ID 1
- Polygon, chain ID 137
- Arbitrum One, chain ID 42161
- OP Mainnet, chain ID 10
- Base, chain ID 8453
- BNB Smart Chain, chain ID 56

All six network requests completed without failure and returned a zero native balance, which is expected for a newly created wallet.

## Known validation boundary

Standard public EVM JSON-RPC can read native balances and known token contracts, but it cannot enumerate every ERC-20 held by an address. Automatic token discovery therefore uses the Ankr `ankr_getAccountBalance` adapter.

The adapter is covered with deterministic tests, including pagination and response normalization. A live indexed-token test remains pending because no Ankr credential or backend proxy endpoint has been provided. Provider credentials are intentionally not embedded in the web client.
