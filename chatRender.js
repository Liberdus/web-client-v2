/**
 * Shared message rendering for 1:1 and group chat.
 *
 * ChatModal owns a great deal of two-party machinery (tolls, read receipts,
 * attachments, reactions) that has no group equivalent, so the two modals stay
 * separate. What they genuinely share is how a message bubble looks — keeping
 * that here stops the two from drifting apart visually.
 *
 * These are pure functions: they take their data as arguments rather than
 * reading myData or a modal's `this`, so either caller can use them.
 */

import { linkifyUrls, escapeHtml, formatTime } from './lib.js';

/**
 * The message-content block. Text is linkified (which escapes internally) and
 * rendered pre-wrap so newlines survive.
 *
 * @param {string} text
 * @param {{ marginTop?: string }} [opts]
 */
export function buildTextContent(text, opts = {}) {
  const marginTop = opts.marginTop || '0';
  return `<div class="message-content" style="white-space: pre-wrap; margin-top: ${marginTop};">${linkifyUrls(text)}</div>`;
}

/**
 * Assembles one message bubble.
 *
 * Deliberately generic: `beforeContent` carries whatever the caller wants above
 * the text (reply quotes and attachments for 1:1), and `senderLabel` is the
 * group-only attribution line. 1:1 needs no sender label because there is only
 * ever one other participant.
 *
 * @param {Object} o
 * @param {boolean} o.mine            renders as sent vs received
 * @param {number}  o.timestamp
 * @param {string}  o.contentHTML     already-built inner content
 * @param {string}  [o.txid]
 * @param {string}  [o.status]
 * @param {string}  [o.extraClass]
 * @param {string}  [o.extraAttrs]    additional data- attributes
 * @param {string}  [o.beforeContent] HTML placed above the content
 * @param {string}  [o.senderLabel]   plain text; escaped here
 * @param {string}  [o.timeSuffix]    HTML appended inside the time row
 */
export function buildMessageBubble(o) {
  const cls = `message ${o.mine ? 'sent' : 'received'}${o.extraClass ? ` ${o.extraClass}` : ''}`;
  const timestampAttr = `data-message-timestamp="${o.timestamp}"`;
  const txidAttr = o.txid ? `data-txid="${o.txid}"` : '';
  const statusAttr = o.status ? `data-status="${o.status}"` : '';
  const sender = o.senderLabel
    ? `<div class="message-sender">${escapeHtml(o.senderLabel)}</div>`
    : '';

  return `
    <div class="${cls}" ${timestampAttr} ${txidAttr} ${statusAttr} ${o.extraAttrs || ''}>
      ${sender}
      ${o.beforeContent || ''}
      ${o.contentHTML}
      <div class="message-time">${formatTime(o.timestamp)}${o.timeSuffix || ''}</div>
    </div>
  `;
}

/**
 * A separator marking the point a member joined.
 *
 * This is not decoration. MLS forward secrecy means messages sent before a
 * member joined are permanently undecryptable by them — the ciphertext is on
 * chain but the keys never were. Users need to be told that, rather than seeing
 * a gap or an error.
 */
export function buildJoinBoundary(text = 'Messages sent before you joined are not available') {
  return `<div class="message system-message join-boundary">${escapeHtml(text)}</div>`;
}

/** A centred, non-bubble notice (joins, leaves, sync problems). */
export function buildSystemMessage(text, extraClass = '') {
  return `<div class="message system-message${extraClass ? ` ${extraClass}` : ''}">${escapeHtml(text)}</div>`;
}

/**
 * Renders a plain-text conversation into `container`.
 *
 * Used by group chat. 1:1 keeps its own loop because it also renders payments,
 * attachments, voice notes and call invites.
 *
 * @param {HTMLElement} container
 * @param {Array} items          ascending by timestamp
 * @param {Object} opts
 * @param {Function} opts.senderLabelFor  (item) => string|null
 * @param {string}  [opts.emptyHTML]
 */
export function renderTextConversation(container, items, opts = {}) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = opts.emptyHTML || '';
    return;
  }

  const parts = [];

  for (const item of items) {
    if (item.system) {
      // 'gap' is the "before you joined" separator, emitted by sync when
      // history was genuinely skipped. Other system items render as plain
      // centred notices.
      parts.push(item.system === 'gap' ? buildJoinBoundary(item.message) : buildSystemMessage(item.message));
      continue;
    }
    parts.push(
      buildMessageBubble({
        mine: !!item.mine,
        timestamp: item.timestamp,
        txid: item.txid,
        status: item.status,
        contentHTML: buildTextContent(item.message),
        // Attribution only matters when more than one person can be speaking.
        senderLabel: item.mine ? '' : opts.senderLabelFor && opts.senderLabelFor(item),
      }),
    );
  }

  container.innerHTML = parts.join('');
}
