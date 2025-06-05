# Decryption Sequence Diagram
This diagram shows the process of decrypting a message that was encrypted using the hybrid ECDH + Post-Quantum encryption scheme. It illustrates how the recipient:
1. Receives the encrypted payload
2. Generates their ECDH shared key
3. Decrypts the PQ shared key (if PQ was used)
4. Combines the keys to create the final decryption key
5. Decrypts both the message and sender information

```mermaid
sequenceDiagram
    participant Recipient
    participant Network

    Note over Recipient: Receive Payload
    Network->>Recipient: Receive encrypted payload
    Note right of Recipient: Contains:
    Note right of Recipient: - message (encMemo)
    Note right of Recipient: - sender (encSenderInfo)
    Note right of Recipient: - pqEncSharedKey
    Note right of Recipient: - sharedKeyMethod

    Note over Recipient: Key Generation
    Recipient->>Recipient: ecSharedKey(keys.secret, senderPubKey)
    Note right of Recipient: Generate ECDH shared key

    alt sharedKeyMethod === 'pq'
        Note over Recipient: PQ Decryption
        Recipient->>Recipient: base642bin(payload.pqEncSharedKey)
        Recipient->>Recipient: pqDecryptSharedKey(keys.secret, cipherText)
        Note right of Recipient: Decrypt PQ shared key
        Recipient->>Recipient: new Uint8Array(dhkey.length + sharedSecret.length)
        Recipient->>Recipient: combined.set(dhkey)
        Recipient->>Recipient: combined.set(sharedSecret, dhkey.length)
        Recipient->>Recipient: deriveDhKey(combined)
        Note right of Recipient: Create final decryption key
    else sharedKeyMethod === 'ec'
        Note right of Recipient: Use ECDH key directly
    end

    Note over Recipient: Decryption
    Recipient->>Recipient: decryptChacha(dhkey, payload.message)
    Note right of Recipient: Decrypt memo
    Recipient->>Recipient: decryptChacha(dhkey, payload.sender)
    Note right of Recipient: Decrypt sender info
    Recipient->>Recipient: parse(decryptedSenderInfo)
    Note right of Recipient: Convert sender info back to object
```
