# Encryption States Diagram
This diagram shows the different states and paths that can occur during the encryption process, depending on what cryptographic keys are available:
1. If only ECDH keys are available, it uses ECDH-only encryption
2. If both ECDH and Post-Quantum (PQ) keys are available, it uses hybrid encryption
3. If no keys are available, it falls back to sending unencrypted messages
This ensures backward compatibility while providing the strongest possible encryption when available.

```mermaid
stateDiagram-v2
    [*] --> CheckKeys
    CheckKeys --> ECDHOnly: Only ECDH available
    CheckKeys --> BothKeys: Both ECDH & PQ available
    CheckKeys --> NoKeys: No keys available

    ECDHOnly --> EncryptEC: Generate ECDH key
    BothKeys --> EncryptBoth: Generate combined key
    NoKeys --> SendPlain: Send unencrypted

    EncryptEC --> SendMessage: Encrypt with ECDH
    EncryptBoth --> SendMessage: Encrypt with combined key
    SendPlain --> SendMessage: Send as is

    SendMessage --> [*]
```
