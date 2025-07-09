// Import required crypto libraries

// https://github.com/paulmillr/noble-post-quantum
// https://github.com/paulmillr/noble-post-quantum/releases
import { ml_kem1024, randomBytes } from './external/noble-post-quantum.js';

// https://github.com/paulmillr/noble-secp256k1
// https://github.com/paulmillr/noble-secp256k1/raw/refs/heads/main/index.js

import * as secp from './external/noble-secp256k1.js';

// https://github.com/adraffy/keccak.js
// https://github.com/adraffy/keccak.js/blob/main/src/keccak256.js
//   permute.js and utils.js were copied into keccak256.js instead of being imported
import keccak256 from './external/keccak256.js';

// https://github.com/dcposch/blakejs
// https://github.com/dcposch/blakejs/blob/master/blake2b.js
//   some functions from util.js were copied into blake2b.js
import blake from './external/blake2b.js';

// We want to use encryption that we can see the source code for; don't use the native browser encryption
// https://github.com/paulmillr/noble-ciphers/releases
// https://github.com/paulmillr/noble-ciphers/releases/download/1.2.0/noble-ciphers.js
import { xchacha20poly1305 } from './external/noble-ciphers.js';

// https://github.com/shardus/lib-crypto-web/blob/main/utils/stringify.js
// Needed to stringify and parse bigints; also deterministic stringify
//   modified to use export
import { parse } from './external/stringify-shardus.js';

import { utf82bin, bin2utf8, hex2bin, bin2hex, base642bin, bin2base64 } from './lib.js';

// Constants
const myHashKey = hex2bin('69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc');

// Core encryption functions
export function encryptChacha(key, data) {
    const nonce = window.crypto.getRandomValues(new Uint8Array(24))
    const cipher = xchacha20poly1305(key, nonce);
    const encrypted = cipher.encrypt(utf82bin(data));

    // Combine nonce + encrypted data (which includes authentication tag)
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    return bin2base64(combined);
}

export function decryptChacha(key, encrypted) {
    try {
        // Convert from base64
        const combined = base642bin(encrypted);

        // Extract nonce (first 24 bytes) and encrypted data
        const nonce = combined.slice(0, 24);
        const data = combined.slice(24);

        const cipher = xchacha20poly1305(key, nonce);
        const decrypted = cipher.decrypt(data);
        return bin2utf8(decrypted);
    } catch (error) {
        console.log('Decryption failed: message authentication failed or corrupted data', error);
        return null;
    }
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
// Encrypt data using ChaCha20-Poly1305
export async function encryptData(data, password) {
    if (!password) return data;

    let key = utf82bin(password);
    const iterations = 100000;
    const batchSize = 1000;

    for (let i = 0; i < iterations; i++) {
        key = blake.blake2b(key, null, 32);

        // Yield every batch to avoid blocking Safari
        if (i % batchSize === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    const encrypted = encryptChacha(key, data);
    return encrypted;
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
// Decrypt data using ChaCha20-Poly1305
export async function decryptData(encryptedData, password) {
    if (!password) return encryptedData;

    // Generate key using 100,000 iterations of blake2b
    let key = utf82bin(password);
    for (let i = 0; i < 100000; i++) {
        key = blake.blake2b(key, null, 32);
    }

    // Decrypt the data using ChaCha20-Poly1305
    return decryptChacha(key, encryptedData);
}

export async function passwordToKey(password) {
    if (!password) return null;

    let key = utf82bin(password);
    const iterations = 100000;
    const batchSize = 1000;

    for (let i = 0; i < iterations; i++) {
        key = blake.blake2b(key, null, 32);

        // Yield every batch to avoid blocking Safari
        if (i % batchSize === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    return bin2hex(key);
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
export async function decryptMessage(payload, keys) {
    if (payload.encrypted) {
        // Generate shared secret using ECDH
        let dhkey = ecSharedKey(keys.secret, payload.public)
        const { publicKey, secretKey } = ml_kem1024.keygen(hex2bin(keys.pqSeed))
        const sharedSecret = pqSharedKey(secretKey, payload.pqEncSharedKey)
        const combined = new Uint8Array(dhkey.length + sharedSecret.length)
        combined.set(dhkey)
        combined.set(sharedSecret, dhkey.length)
        dhkey = blake.blake2b(combined, myHashKey, 32)

        // Decrypt based on encryption method
        if (payload.encryptionMethod === 'xchacha20poly1305') {
            try {
                if (payload.message) {
                    payload.message = decryptChacha(dhkey, payload.message);
                    if (payload.message == null) { payload.message = 'Decryption failed.' }
                }
            } catch (error) {
                console.error('xchacha20poly1305 decryption failed:', error);
                payload.message = 'Decryption failed';
            }
            if (payload.senderInfo) {
                try {
                    payload.senderInfo = parse(decryptChacha(dhkey, payload.senderInfo));
                } catch (error) {
                    console.error('xchacha20poly1305 senderInfo decryption failed:', error);
                    payload.senderInfo = { username: 'decryption_failed' }
                }
            }
        } else {
            console.error('Unknown encryption method:', payload.encryptionMethod);
            payload.message = 'Unsupported encryption';
        }
    }
    delete payload.encrypted;
    delete payload.encryptionMethod;
    delete payload.public;
    return payload;
}

// Key exchange functions
export function ecSharedKey(sec, pub) {
    return secp.getSharedSecret(
        hex2bin(sec),
        hex2bin(pub)
    ).slice(1, 33);  // Taking first 32 bytes for chacha
}

export function pqSharedKey(recipientKey, encKey) {  // inputs base64 or binary, outputs binary
    if (typeof(recipientKey) == 'string') { recipientKey = base642bin(recipientKey) }
    if (encKey) {
        if (typeof(encKey) == 'string') { encKey = base642bin(encKey) }
        return ml_kem1024.decapsulate(encKey, recipientKey);
    }
    return ml_kem1024.encapsulate(recipientKey);  // { cipherText, sharedSecret }
}

// Based on what ethers.js is doing in the following code
// hashMessage() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/hash/message.ts#L35
// concat() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/utils/data.ts#L116
// MessagePrefix https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/constants/strings.ts#L16
// keccak256 https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/crypto/keccak.ts#L44
// input message can be string or binary; output is hex; binary means Uint8Array
export function ethHashMessage(message) {
    if (typeof(message) === "string") { message = utf82bin(message); }
    const MessagePrefix = "\x19Ethereum Signed Message:\n"
    const str = bin2hex(utf82bin(MessagePrefix)) + bin2hex(utf82bin(String(message.length))) + bin2hex(message)
    return bin2hex(keccak256(hex2bin(str)))
}

// Base hashing function
export function hashBytes(bytes) {
    return blake.blake2bHex(bytes, myHashKey, 32);
}

export function deriveDhKey(combined) {
    return blake.blake2b(combined, myHashKey, 32);
}

// Key generation and signing functions
export function generateRandomPrivateKey() {
    return secp.utils.randomPrivateKey();
}

export function getPublicKey(privateKey) {
    return secp.getPublicKey(privateKey, false);
}

export async function signMessage(message, privateKey) {
    return await secp.signAsync(message, privateKey);
}

export function generatePQKeys(pqSeed) {
    return ml_kem1024.keygen(hex2bin(pqSeed));
}

// Random number generation
export function generateRandomBytes(length) {
    return randomBytes(length);
}

// Address generation
export function generateAddress(publicKey) {
    return keccak256(publicKey.slice(1)).slice(-20);
}
