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

import { linkifyUrls, escapeHtml, formatTime, normalizeAddress } from './lib.js';

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
 * The quoted original above a reply.
 *
 * Mirrors 1:1's markup exactly, so the two share every rule under .reply-quote
 * and cannot drift apart. The one difference is whose name is shown: 1:1 infers
 * it from a viewer-relative `replyOwnerIsMine` flag, which cannot work in a
 * group, so a group message carries the original sender's ADDRESS and the
 * caller resolves it. That is absolute — every member reaches the same answer.
 *
 * @param {Object} item          the replying message
 * @param {string} ownerName     resolved display name of whoever wrote the original
 * @param {boolean} ownerIsMine  drives the accent colour, as in 1:1
 */
export function buildReplyQuote(item, ownerName, ownerIsMine) {
  const cls = ownerIsMine ? 'reply-owner-me' : 'reply-owner-contact';
  const text = escapeHtml(item.replyMessage || 'View original message');
  return `
    <div class="reply-quote ${cls}" data-reply-txid="${escapeHtml(item.replyId)}">
      <span class="reply-quote-label ${cls}">${escapeHtml(ownerName)}</span>
      <div class="reply-quote-text">${text}</div>
    </div>
  `;
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
 * @param {string}  [o.afterContent]  HTML placed below the time row (reaction chips)
 * @param {string}  [o.senderLabel]   plain text; escaped here
 * @param {string}  [o.senderAvatar]  pre-rendered avatar HTML, group chat only
 * @param {string}  [o.timeSuffix]    HTML appended inside the time row
 */
export function buildMessageBubble(o) {
  const cls = `message ${o.mine ? 'sent' : 'received'}${o.extraClass ? ` ${o.extraClass}` : ''}`;
  const timestampAttr = `data-message-timestamp="${o.timestamp}"`;
  const txidAttr = o.txid ? `data-txid="${o.txid}"` : '';
  const statusAttr = o.status ? `data-status="${o.status}"` : '';
  /*
   * The avatar sits inside the bubble, on the sender line, rather than in a
   * gutter beside it. A gutter avatar has to start at the very left edge of the
   * message list, which collides with the app's container offset and clips at
   * narrow widths. Inline costs a little visual separation and cannot overflow.
   */
  const avatar = o.senderAvatar && !o.mine ? `<span class="message-sender-avatar">${o.senderAvatar}</span>` : '';
  const sender = o.senderLabel
    ? `<div class="message-sender">${avatar}${escapeHtml(o.senderLabel)}</div>`
    : '';

  return `
    <div class="${cls}" ${timestampAttr} ${txidAttr} ${statusAttr} ${o.extraAttrs || ''}>
      ${sender}
      ${o.beforeContent || ''}
      ${o.contentHTML}
      <div class="message-time">${formatTime(o.timestamp)}${o.timeSuffix || ''}</div>
      ${o.afterContent || ''}
    </div>
  `;
}

/**
 * The reaction chip row under a message.
 *
 * Shared so 1:1 and group chat cannot drift: the chips key off .message in
 * styles.css, and both callers emit the same markup into the same slot.
 * The viewer's address is a parameter rather than read from app state, which
 * is what lets groupUI call it.
 *
 * @param {Array<Object>} reactionsForTarget  one effective reaction per sender
 * @param {string} currentUserAddress         normalized, for the "mine" accent
 * @returns {string}
 */
export function buildReactionChips(reactionsForTarget, currentUserAddress) {
  if (reactionsForTarget.length === 0) {
    return '';
  }


  /*
   * Grouped by emoji, not one chip per person. Three people reacting with the
   * same emoji used to draw three chips overlapping at -8px each — a smear
   * that says nothing a single "👍 3" does not say better.
   *
   * Insertion order is preserved, so the first emoji anyone used stays first
   * and chips do not reshuffle underneath someone as reactions arrive.
   */
  const byEmoji = new Map();
  for (const reaction of reactionsForTarget) {
    if (!reaction.emoji) continue;
    const entry = byEmoji.get(reaction.emoji) || { count: 0, mine: false };
    entry.count += 1;
    if (normalizeAddress(reaction.sender) === currentUserAddress) entry.mine = true;
    byEmoji.set(reaction.emoji, entry);
  }
  if (byEmoji.size === 0) return '';

  const chips = [...byEmoji.entries()].map(
    ([emoji, { count, mine }]) => `
      <span class="message-reaction-chip${mine ? ' my-reaction' : ''}">
        <span class="message-reaction-emoji">${escapeHtml(emoji)}</span>
        ${count > 1 ? `<span class="message-reaction-count">${count}</span>` : ''}
      </span>`,
  );

  return `
    <div class="message-reactions" aria-label="Reactions">
      ${chips.join('')}
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
 * @param {Function} [opts.senderAvatarFor] (item) => HTML string|null
 * @param {string}  [opts.emptyHTML]
 */
export function renderTextConversation(container, items, opts = {}) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = opts.emptyHTML || '';
    return;
  }

  const parts = [];

  /*
   * Who spoke last, so a run of messages from one person is attributed once
   * rather than once per bubble. Repeating the avatar and name on every line
   * makes three short replies read as three separate arrivals, and it is the
   * single biggest source of visual noise in a busy group.
   *
   * Reset by any system item: a notice between two messages breaks the run, so
   * the speaker has to be named again on the other side of it.
   */
  let lastSpeaker = null;

  for (const item of items) {
    if (item.system) {
      // 'gap' is the "before you joined" separator, emitted by sync when
      // history was genuinely skipped. Other system items render as plain
      // centred notices.
      parts.push(item.system === 'gap' ? buildJoinBoundary(item.message) : buildSystemMessage(item.message));
      lastSpeaker = null;
      continue;
    }
    const speaker = item.mine ? '__me__' : String(item.from || '');
    const startsRun = speaker !== lastSpeaker;
    lastSpeaker = speaker;

    // Built first: the bubble needs a class reserving room for chips, and that
    // has to be decided before the bubble is assembled.
    const chipsHTML = opts.reactionsFor ? opts.reactionsFor(item) : '';

    parts.push(
      buildMessageBubble({
        mine: !!item.mine,
        timestamp: item.timestamp,
        txid: item.txid,
        status: item.status,
        contentHTML: buildTextContent(item.message),
        /*
         * The quote sits above the text, in the same slot 1:1 uses for it.
         * replyNameFor resolves the original sender's address; without it the
         * quote still renders, just without attribution.
         */
        beforeContent: item.replyId && opts.replyNameFor
          ? buildReplyQuote(item, ...opts.replyNameFor(item))
          : '',
        /*
         * Chips hang off the bubble's bottom edge, so the bubble needs a class
         * reserving room for them — the same one 1:1 sets.
         */
        afterContent: chipsHTML,
        // Attribution only matters when more than one person can be speaking,
        // and only on the first message of each person's run.
        senderLabel: item.mine || !startsRun ? '' : opts.senderLabelFor && opts.senderLabelFor(item),
        senderAvatar: item.mine || !startsRun ? '' : opts.senderAvatarFor && opts.senderAvatarFor(item),
        extraClass: [startsRun ? '' : 'message--continues', chipsHTML ? 'has-reactions' : '']
          .filter(Boolean)
          .join(' '),
      }),
    );
  }

  container.innerHTML = parts.join('');
}
