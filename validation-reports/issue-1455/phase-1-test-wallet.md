# Issue 1455 Phase 1 Test Wallet

## Wallet identity

- Created: 2026-07-17
- Platform: Liberdus Testnet (`https://liberdus.com/test/`)
- Username: `codexwallet1455`
- Public address: `0x2e9d029e7ca193a3b2cb8a447c6f0d74d4983760`
- Purpose: Phase 1 multi-chain EVM discovery and balance testing
- Development branch: `issue-1455-multichain-wallet-infrastructure`

The account was created through the Liberdus web client. The browser profile currently retains the account locally.

## Credential storage

The 32-byte private key is stored in the macOS Login Keychain. It is not stored in this repository or in this report.

- Keychain service: `liberdus-codex-test-wallet-issue-1455`
- Keychain account: `codexwallet1455`
- Keychain: Login Keychain for the current macOS user

For automated local tests, load the key into the test process without printing it:

```sh
LIBERDUS_TEST_WALLET_PRIVATE_KEY="$(security find-generic-password \
  -a codexwallet1455 \
  -s liberdus-codex-test-wallet-issue-1455 \
  -w)"
export LIBERDUS_TEST_WALLET_PRIVATE_KEY
```

Do not echo this variable, add it to an environment file, commit it, include it in logs, or pass it as a command-line argument to a test program. Unset it when testing is complete:

```sh
unset LIBERDUS_TEST_WALLET_PRIVATE_KEY
```

## EVM compatibility note

The current web client derives the Liberdus address by:

1. Generating an uncompressed secp256k1 public key from the private key.
2. Hashing the public key body with Keccak-256.
3. Taking the final 20 bytes as the address.

This is the standard Ethereum/EVM externally owned account address derivation. The stored private key was independently run through the repository's secp256k1 and Keccak-256 implementations, and the result matched the public address above. The same private key therefore maps to this address on EVM-compatible networks.

## Recovery and handling

- If the browser-local account is lost, retrieve the private key from the Keychain and use the platform's **Create Account → More Options → Use my own private key (Advanced)** flow.
- This wallet is for development and test assets only.
- Do not send mainnet funds or valuable assets to this wallet.
- Never include the private key in screenshots, reports, issues, commits, PRs, test fixtures, or CI configuration.
