import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ethHashMessage,
  generateAddress,
  getPublicKey,
  signMessage,
} from '../crypto.js';
import {
  getExpectedChatId,
  getUnsignedTransactionId,
  validateChatTransaction,
} from '../chat-security.js';
import { bin2hex, hex2bin, longAddress } from '../lib.js';

const currentPrivateKey = Uint8Array.from(Array(31).fill(0).concat(1));
const contactPrivateKey = Uint8Array.from(Array(31).fill(0).concat(2));
const currentPublicKey = bin2hex(getPublicKey(currentPrivateKey));
const contactPublicKey = bin2hex(getPublicKey(contactPrivateKey));
const currentAddress = bin2hex(generateAddress(hex2bin(currentPublicKey)));
const contactAddress = bin2hex(generateAddress(hex2bin(contactPublicKey)));
const expectedChatId = getExpectedChatId(currentAddress, contactAddress);
const networkId = 'security-test-network';

async function signTransaction(transaction, privateKey, ownerAddress) {
  const txid = getUnsignedTransactionId(transaction);
  const signature = await signMessage(hex2bin(ethHashMessage(txid)), privateKey);
  transaction.sign = {
    owner: longAddress(ownerAddress),
    sig: `0x${signature.r.toString(16).padStart(64, '0')}${signature.s.toString(16).padStart(64, '0')}${(27 + signature.recovery).toString(16).padStart(2, '0')}`,
  };
  return transaction;
}

function encryptedIncomingTransaction() {
  return {
    type: 'message',
    from: longAddress(contactAddress),
    to: longAddress(currentAddress),
    chatId: expectedChatId,
    networkId,
    timestamp: 1_800_000_000_000,
    amount: 0n,
    xmessage: {
      encrypted: true,
      encryptionMethod: 'xchacha20poly1305',
      message: 'encrypted-message',
      pqEncSharedKey: 'encapsulated-key',
      sent_timestamp: 1_800_000_000_000,
    },
  };
}

const incomingContext = {
  currentAddress,
  contactAddress,
  expectedChatId,
  networkId,
  publicKey: contactPublicKey,
};

test('accepts a correctly signed encrypted private message', async () => {
  const transaction = await signTransaction(encryptedIncomingTransaction(), contactPrivateKey, contactAddress);
  const result = validateChatTransaction(transaction, incomingContext);

  assert.equal(result.ok, true);
  assert.equal(result.txid, getUnsignedTransactionId(transaction));
});

test('rejects missing, incorrect, and altered signatures', async () => {
  const unsigned = encryptedIncomingTransaction();
  assert.equal(validateChatTransaction(unsigned, incomingContext).reason, 'missing_signature');

  const wrongSigner = await signTransaction(encryptedIncomingTransaction(), currentPrivateKey, contactAddress);
  assert.equal(validateChatTransaction(wrongSigner, incomingContext).reason, 'invalid_signature');

  const altered = await signTransaction(encryptedIncomingTransaction(), contactPrivateKey, contactAddress);
  altered.xmessage.message = 'altered-ciphertext';
  assert.equal(validateChatTransaction(altered, incomingContext).reason, 'invalid_signature');
});

test('rejects plaintext private messages even when they carry a valid signature', async () => {
  const transaction = encryptedIncomingTransaction();
  transaction.xmessage = { message: 'plaintext', sent_timestamp: transaction.timestamp };
  await signTransaction(transaction, contactPrivateKey, contactAddress);

  assert.equal(validateChatTransaction(transaction, incomingContext).reason, 'unencrypted_message');
});

test('rejects cross-network, cross-chat, and wrong-participant records', async () => {
  const wrongNetwork = encryptedIncomingTransaction();
  wrongNetwork.networkId = 'another-network';
  await signTransaction(wrongNetwork, contactPrivateKey, contactAddress);
  assert.equal(validateChatTransaction(wrongNetwork, incomingContext).reason, 'network_mismatch');

  const wrongChat = encryptedIncomingTransaction();
  wrongChat.chatId = '0'.repeat(64);
  await signTransaction(wrongChat, contactPrivateKey, contactAddress);
  assert.equal(validateChatTransaction(wrongChat, incomingContext).reason, 'chat_mismatch');

  const wrongParticipant = encryptedIncomingTransaction();
  wrongParticipant.to = longAddress('f'.repeat(40));
  await signTransaction(wrongParticipant, contactPrivateKey, contactAddress);
  assert.equal(validateChatTransaction(wrongParticipant, incomingContext).reason, 'participant_mismatch');
});

test('accepts a correctly signed transfer without requiring a message envelope', async () => {
  const transfer = {
    type: 'transfer',
    from: longAddress(contactAddress),
    to: longAddress(currentAddress),
    chatId: expectedChatId,
    networkId,
    timestamp: 1_800_000_000_001,
    amount: 5n,
    xmemo: {},
  };
  await signTransaction(transfer, contactPrivateKey, contactAddress);

  assert.equal(validateChatTransaction(transfer, incomingContext).ok, true);
});

test('message ingestion queries only the locally derived chat identifier', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(app, /expectedChatId = getExpectedChatId\(currentUserAddress, from\)/);
  assert.match(app, /if \(chats\[sender\] !== expectedChatId\)/);
  assert.match(app, /queryNetwork\(`\/messages\/\$\{expectedChatId\}\/\$\{messageQueryTimestamp\}`\)/);
  assert.match(app, /const validation = validateChatTransaction\(tx,/);
  assert.match(app, /if \(verifiedMessages\.length === 0\) continue/);
});
