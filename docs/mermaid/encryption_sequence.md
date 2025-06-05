# Encryption Sequence Diagram
This diagram illustrates the step-by-step process of encrypting a message using both ECDH (Elliptic Curve Diffie-Hellman) and Post-Quantum (PQ) cryptography. It shows how the sender:
1. Retrieves recipient information
2. Generates ECDH shared key
3. Generates PQ shared key
4. Combines both keys
5. Encrypts the message and sender info
6. Creates the final encrypted payload

```mermaid
sequenceDiagram
    participant Sender
    participant Network

    Note over Sender: Initial Key Setup
    Sender->>Network: queryNetwork('/account/${longAddress}')
    Network-->>Sender: Return recipientInfo

    Note over Sender: ECDH Key Generation
    Sender->>Sender: ecSharedKey(keys.secret, recipientPubKey)
    Note right of Sender: Generates ECDH shared key

    Note over Sender: PQ Key Generation
    Sender->>Sender: pqSharedKey(pqRecPubKey)
    Note right of Sender: Returns {cipherText, sharedSecret}

    Note over Sender: Key Combination
    Sender->>Sender: new Uint8Array(dhkey.length + sharedSecret.length)
    Sender->>Sender: combined.set(dhkey)
    Sender->>Sender: combined.set(sharedSecret, dhkey.length)
    Sender->>Sender: deriveDhKey(combined)
    Note right of Sender: Creates final encryption key

    Note over Sender: Encryption
    Sender->>Sender: encryptChacha(dhkey, memo)
    Note right of Sender: Encrypts memo with ChaCha20-Poly1305
    Sender->>Sender: stringify(senderInfo)
    Sender->>Sender: encryptChacha(dhkey, stringify(senderInfo))
    Note right of Sender: Encrypts sender info

    Note over Sender: Final Payload
    Sender->>Sender: Create payload with:
    Note right of Sender: - message: encMemo
    Note right of Sender: - sender: encSenderInfo
    Note right of Sender: - pqEncSharedKey: bin2base64(cipherText)
    Note right of Sender: - sharedKeyMethod: 'pq'
```
