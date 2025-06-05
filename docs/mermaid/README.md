# Encryption/Decryption Flow Diagrams

This directory contains Mermaid diagrams that illustrate the encryption and decryption processes in the application. The diagrams are written in Markdown files with Mermaid syntax.

## Files

1. `encryption_sequence.md`

   - Shows the sequence of function calls during encryption
   - Illustrates how keys are generated and combined
   - Details the encryption process for both memo and sender info

2. `decryption_sequence.md`

   - Shows the sequence of function calls during decryption
   - Illustrates how keys are regenerated and combined
   - Details the decryption process for both memo and sender info

3. `key_combination_flow.md`

   - Shows how ECDH and PQ keys are combined
   - Illustrates the flow from individual keys to final derived key
   - Shows how the final key is used for encryption

4. `encryption_states.md`
   - Shows the different states of the encryption process
   - Illustrates the paths based on available keys
   - Shows how the system handles different encryption scenarios

## How to View

These diagrams can be viewed using any Markdown viewer that supports Mermaid diagrams, such as:

- GitHub (renders Mermaid diagrams natively)
- VS Code with Markdown Preview Enhanced extension
- Any Markdown editor with Mermaid support

## Key Concepts

- **ECDH**: Elliptic Curve Diffie-Hellman key exchange
- **PQ**: Post-Quantum cryptography
- **ChaCha20-Poly1305**: The encryption algorithm used
- **Shared Key**: The key derived from both ECDH and PQ keys
