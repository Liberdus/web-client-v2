/**
 * Group chat UI: creation, conversation, and membership management.
 *
 * Deliberately separate from ChatModal. That class carries ~6.5k lines of
 * two-party machinery — tolls, pay-on-reply, read receipts, "blocked by
 * recipient" — none of which has a group meaning. Sharing it would mean
 * branching around 144 toll references in the most heavily used path in the
 * app. What the two genuinely share, the message bubble, lives in chatRender.js.
 *
 * Like groupManager, this module takes app.js's module-scoped helpers through
 * init rather than importing them.
 */

import * as groups from './groupManager.js';
import { MLS_CIPHERSUITE_ID, MLS_CIPHERSUITE_NAME } from './mlsEngine.js';
import { renderTextConversation, buildSystemMessage, buildReactionChips } from './chatRender.js';
import {
  addressAvatar,
  escapeHtml,
  longAddress,
  normalizeAddress,
  normalizeUsername,
  utf82bin,
  formatTime,
  big2str,
  bigxnum2big,
  EthNum,
} from './lib.js';

/** Wei per LIB, matching the rest of the app's amount handling. */
const WEI = 10n ** 18n;

/**
 * Wei -> a short decimal string for display.
 *
 * Trimming trailing zeros is not the same as being readable: a fee derived from
 * a USD peg has eighteen significant decimals and no trailing zeros at all, so
 * this used to render "0.769230769230769230 LIB" in a confirmation dialog.
 *
 * DESIGN.md: one money formatter, app-wide. evmAssets.formatTokenAmount is that
 * formatter -- at most six fraction digits, no minimum, thousands separated,
 * and exponential below a millionth rather than a rounded "0" that would claim
 * nothing moved. The exact wei value is what gets signed; this is display only.
 */
function formatLib(wei) {
  return evmAssets.formatTokenAmount(big2str(BigInt(wei || 0n), 18));
}

/**
 * A typed LIB amount -> wei, or 0n if it is not a usable number.
 *
 * EthNum.toWei is the app's parser and throws on anything it dislikes -- a
 * stray letter, more than eighteen decimals, an empty string. Here that is not
 * an error to surface but a reason to keep the confirm button disabled, so
 * everything unusable collapses to zero and the caller checks for > 0.
 */
function parseLibToWei(raw) {
  const text = String(raw ?? '').trim().replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return 0n;
  try {
    const wei = EthNum.toWei(text.startsWith('.') ? `0${text}` : text);
    return wei > 0n ? wei : 0n;
  } catch {
    return 0n;
  }
}
import { hashBytes } from './crypto.js';
// DESIGN.md: one money formatter, app-wide.
import { evmAssets } from './evm-assets.js';

let deps = null;

export function initGroupUI(d) {
  deps = d;
  createGroupModal.load();
  groupChatModal.load();
  groupInfoModal.load();
  joinGroupModal.load();
}

const $ = (id) => document.getElementById(id);
const myData = () => deps.getMyData();
const myAddr = () => longAddress(deps.getMyAccount().keys.address).toLowerCase();
const toast = (msg, ms, kind) => deps.showToast && deps.showToast(msg, ms, kind);
/**
 * The app's in-app confirmation dialog.
 *
 * Falls back to refusing rather than to window.confirm: everything this guards
 * spends money, and silently proceeding because a dialog was unavailable is the
 * wrong direction to fail in.
 */
const confirmDialog = (opts) => (deps.uiConfirm ? deps.uiConfirm(opts) : Promise.resolve(false));

/**
 * Best-effort display name for an address, falling back to a short form.
 *
 * Deliberately total: longAddress/normalizeAddress throw on anything that is
 * not a well-formed address, and this runs once per rendered message. A single
 * odd roster entry must not be able to blank the whole conversation.
 */
/** Same 40-character preview 1:1 stages in its reply bar. */
function truncateReplyText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length <= 40 ? clean : clean.slice(0, 40) + '...';
}

function displayName(address, groupId) {
  const addr = String(address || '').toLowerCase();
  try {
    if (addr === myAddr()) return 'You';
    const contacts = myData().contacts || {};
    const contact = contacts[addr] || contacts[normalizeAddress(addr)] || contacts[longAddress(addr)];
    if (contact && (contact.username || contact.name)) return contact.username || contact.name;
    // Group members are usually not contacts, so fall back to the username
    // resolved from their account alias before giving up on an address.
    if (groupId) {
      const alias = myData().groups?.[groupId]?.memberNames?.[addr];
      if (alias) return alias;
    }
  } catch {
    // Not a canonical address; fall through to the short form.
  }
  return addr ? `${addr.slice(0, 8)}…` : 'Unknown';
}

/** Contacts that could be invited, excluding anyone already in the group. */
function invitableContacts(excludeAddresses = []) {
  const exclude = new Set(excludeAddresses.map((a) => String(a).toLowerCase()));
  exclude.add(myAddr());
  return Object.entries(myData().contacts || {})
    .map(([address, contact]) => ({ address: longAddress(address).toLowerCase(), contact }))
    .filter((c) => !exclude.has(c.address))
    .sort((a, b) => displayName(a.address).localeCompare(displayName(b.address)));
}

/**
 * How this device's view of a group stands, in terms a person can act on.
 *
 * MLS epochs are protocol state. "Epoch 5" tells someone nothing they can use,
 * and it had leaked into the chat subtitle, the sync section, the reset copy
 * and four warnings — twelve sites quoting a counter. Every user-facing status
 * string now reads from this one value instead; the raw numbers live in the
 * technical details drawer in group info. See DESIGN.md §1.1.
 *
 * The three unhealthy states are ordered by what can be done about them, which
 * is what makes the repair ladder work: 'catching-up' fixes itself,
 * 'needs-attention' is worth one catch-up attempt, and 'unrecoverable' has no
 * route back except a fresh Welcome.
 */
function groupHealth(view) {
  if (!view) return 'fine';
  if (view.removed) return 'removed';
  if (view.invitePending) return 'invited';
  if (view.joinRequested) return 'awaiting';
  /*
   * No amount of syncing helps: either the updates we missed have been pruned,
   * or we committed something the network rejected and are ahead of the chain.
   * MLS state cannot be rebuilt from the public transcript.
   */
  if (view.needsRecovery || view.needsReset) return 'unrecoverable';
  // A commit would not apply. forceCatchUp clears the marker and retries, so
  // this one is worth attempting before giving up on it.
  if (typeof view.applyFailedAtEpoch === 'number') return 'needs-attention';
  if (typeof view.chainEpoch === 'number' && view.chainEpoch > view.epoch) return 'catching-up';
  return 'fine';
}

/**
 * Banner copy per health state. Consequence first, mechanism never.
 *
 * `action` is the label of the one button offered. There is deliberately never
 * a choice of two: someone who has just been told their device is out of step
 * has no basis to pick between catching up and resetting — DESIGN.md §1.4.
 */
const HEALTH_BANNER = {
  'catching-up': {
    icon: '◷',
    tone: '',
    title: 'Catching up with the group…',
    sub: '',
    action: '',
  },
  'needs-attention': {
    icon: '△',
    tone: 'ui-banner--attention',
    title: 'This device is out of step with the group.',
    sub: 'Your messages won’t reach anyone until it’s fixed.',
    action: 'Fix this',
  },
  unrecoverable: {
    icon: '△',
    tone: 'ui-banner--attention',
    title: 'This device can’t catch up on its own.',
    sub: 'The updates it missed are no longer stored.',
    action: 'Reset and rejoin',
  },
  removed: {
    icon: '◦',
    tone: '',
    title: 'You’re no longer a member.',
    sub: 'Messages sent after you left aren’t visible here.',
    // The one thing still available from here. Burying it in group info would
    // be exactly the kind of hunt this redesign exists to remove.
    action: 'Delete',
  },
};

/**
 * Composer placeholder per health state. Only 'fine' can type.
 *
 * Kept short on purpose: the banner above carries the explanation, and the
 * field is ~330px at 430px wide, so anything longer wraps and clips. The
 * placeholder only has to say that sending is off.
 */
const HEALTH_PLACEHOLDER = {
  fine: 'Type a message...',
  'catching-up': 'Catching up…',
  'needs-attention': 'Can’t send right now',
  unrecoverable: 'Can’t send right now',
  removed: 'You can no longer send',
  invited: 'Join the group to send',
  awaiting: 'Waiting for approval',
};

const selectedFrom = (listEl) =>
  [...listEl.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);

/**
 * One row of a person picker.
 *
 * `ui-list-pick` puts the label across the whole row so the hit target is the
 * row rather than a 13px checkbox.
 */
function pickerRow(address, checked) {
  /*
   * The tick sits after the name, not before the avatar: the row reads "who,
   * then whether they are picked", and a column of ticks down the right edge
   * scans as a set of answers rather than as decoration in front of each face.
   * The native checkbox stays in the markup for state and keyboard access and
   * is hidden in CSS; .ui-list-check is what is actually seen.
   */
  return `
      <li class="ui-list-row ui-list-pick">
        <label>
          <input type="checkbox" value="${address}"${checked ? ' checked' : ''} />
          <span class="ui-list-avatar">${addressAvatar(address, 28)}</span>
          <span class="ui-list-name">${escapeHtml(displayName(address))}</span>
          <span class="ui-list-check" aria-hidden="true"></span>
        </label>
      </li>`;
}

/**
 * Contact picker, filtered by whatever has been typed.
 *
 * One field does both jobs it used to take four controls to do. Typing filters
 * the contacts; when nothing matches, the list offers to resolve the text as a
 * username instead. Picking only from contacts is a dead end — a new account
 * has none — so the fallback is not an edge case, it is how the first group
 * gets made.
 */
function renderPicker(listEl, candidates, query = '') {
  if (!listEl) return;
  const q = String(query || '').trim().toLowerCase();
  const checked = new Set(selectedFrom(listEl));
  const matches = q
    ? candidates.filter(({ address }) => displayName(address).toLowerCase().includes(q))
    : candidates;

  /*
   * Anyone already ticked stays visible even when they no longer match. The
   * checkboxes ARE the selection — dropping a row would silently unpick that
   * person, and the only sign would be a smaller group than was asked for.
   */
  const shown = new Set(matches.map((m) => m.address));
  const rows = [...matches, ...candidates.filter((c) => checked.has(c.address) && !shown.has(c.address))];

  const html = rows.map(({ address }) => pickerRow(address, checked.has(address))).join('');

  if (html) {
    listEl.innerHTML = html;
    return;
  }
  // Nothing matched. Offer the username route rather than a dead end.
  /*
   * With no contacts and nothing typed there is nothing to say: the search
   * field above already invites a username, so a line repeating that is a row
   * of text where a list should be. The list empties and its section collapses.
   */
  listEl.innerHTML = q
    ? `<li><button type="button" class="ui-list-action" data-resolve="1">
         <span class="ui-list-plus" aria-hidden="true">+</span>
         <span class="ui-list-name">Add “${escapeHtml(query.trim())}”</span>
       </button></li>`
    : '';
}
/**
 * Resolves a username and checks the account can actually be added.
 *
 * Adding only from the contact list is a dead end: a brand-new account has no
 * contacts, so there would be nobody to put in a group.
 *
 * Everything is checked here rather than at commit time. The alternative is
 * staging someone, filling in the rest of the form, and only discovering on
 * submit that the transaction cannot be built.
 */
async function resolveInvitee(input, precheck) {
  const username = normalizeUsername(String(input || '').trim());
  if (!username) throw new Error('Enter a username');

  // 1. username -> address, same lookup New Chat uses
  const data = await deps.queryNetwork(`/address/${hashBytes(utf82bin(username))}`);
  if (!data || !data.address) throw new Error(`No account found for "${username}"`);
  const address = longAddress(normalizeAddress(data.address)).toLowerCase();

  // Cheap local rejections before spending two more round trips.
  if (precheck) precheck(address);

  // 2. the account must exist on the network
  const accountRes = await deps.queryNetwork(`/account/${address}`);
  if (!accountRes || !accountRes.account) throw new Error(`"${username}" was not found on the network`);

  // 3. private and public accounts cannot be mixed, as in 1:1 chat
  const myIsPrivate = !!myData()?.account?.private;
  const theirIsPrivate = accountRes.account.private === true;
  if (myIsPrivate !== theirIsPrivate) {
    throw new Error(`${myIsPrivate ? 'Private' : 'Public'} accounts can only chat with other ${myIsPrivate ? 'private' : 'public'} accounts`);
  }

  // 4. group-specific: they must be reachable by MLS. Without a published
  //    KeyPackage there is no way to add them, and without a post-quantum
  //    public key the group PSK cannot be sealed to them.
  const mls = await deps.queryNetwork(`/account/${address}/keypackages`);
  const pool = Array.isArray(mls?.keyPackages) ? mls.keyPackages : [];
  if (pool.length === 0 && !mls?.lastResortKeyPackage) {
    throw new Error(`"${username}" has not set up group chat yet — they need to open the app once`);
  }
  if (!mls?.pqPublicKey) {
    throw new Error(`"${username}" has no post-quantum key published`);
  }
  if (mls.cipherSuite && mls.cipherSuite !== MLS_CIPHERSUITE_ID) {
    throw new Error(`"${username}" is using a different encryption suite`);
  }

  return { username, address };
}

/**
 * A staged list of people to invite, shown as removable chips.
 *
 * Used by both the create-group form and group info, since both need to gather
 * invitees before committing them in one transaction.
 */
/**
 * Gathering people to add: one search field, a contact list and a chip per
 * person resolved by username.
 *
 * Used by both the create-group form and group info, since both need to gather
 * invitees before committing them in one transaction.
 *
 * There is no longer a separate "Add" button. The field filters the contact
 * list as you type, and when nothing matches, the list itself offers to resolve
 * what you typed — so one control covers both routes instead of four covering
 * one each. Enter does the same thing, for anyone who expects it to.
 */
function makeInviteStaging({ inputEl, listEl, errorEl, pickerEl, candidates, isExcluded }) {
  const staged = [];

  const renderChips = () => {
    listEl.innerHTML = staged
      .map(
        (s, i) => `
        <li class="ui-chip">
          <span>${escapeHtml(s.username || displayName(s.address))}</span>
          <button type="button" class="ui-chip-remove" data-index="${i}" aria-label="Remove">×</button>
        </li>`,
      )
      .join('');
  };

  const showError = (msg) => {
    errorEl.textContent = msg || '';
    errorEl.style.display = msg ? 'block' : 'none';
  };

  const renderList = () => renderPicker(pickerEl, candidates(), inputEl.value);

  /** Resolve the typed text as a username and stage whoever it names. */
  const resolve = async () => {
    if (!inputEl.value.trim()) return;
    showError('');
    try {
      const entry = await resolveInvitee(inputEl.value, (address) => {
        if (address === myAddr()) throw new Error('That is you');
        if (staged.some((s) => s.address === address)) throw new Error('Already added');
        if (isExcluded && isExcluded(address)) throw new Error('Already in the group');
      });
      staged.push(entry);
      inputEl.value = '';
      renderChips();
      renderList();
    } catch (err) {
      showError(err.message);
    }
  };

  inputEl.addEventListener('input', () => {
    showError('');
    renderList();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      resolve();
    }
  });
  // The "Add <username>" row the picker falls back to when nothing matches.
  pickerEl.addEventListener('click', (e) => {
    if (e.target.closest('button[data-resolve]')) resolve();
  });
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-index]');
    if (!btn) return;
    staged.splice(Number(btn.dataset.index), 1);
    renderChips();
  });

  return {
    /** Everyone chosen, by either route, deduplicated. */
    addresses: () => [...new Set([...selectedFrom(pickerEl), ...staged.map((s) => s.address)])],
    refresh: renderList,
    reset: () => {
      staged.length = 0;
      inputEl.value = '';
      showError('');
      renderChips();
      renderList();
    },
  };
}

// ---------------------------------------------------------- create a group --

class CreateGroupModal {
  load() {
    this.modal = $('createGroupModal');
    if (!this.modal) return;
    this.form = $('createGroupForm');
    this.nameInput = $('groupNameInput');
    this.picker = $('groupMemberPicker');
    this.error = $('createGroupError');
    this.submit = $('createGroupSubmit');
    this.fee = $('createGroupFee');
    this.feeInput = $('createGroupJoinFee');

    $('closeCreateGroupModal').addEventListener('click', () => this.close());
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Only the name is required, so the button says so rather than waiting to
    // reject an empty form after the fact — DESIGN.md §1.7.
    this.nameInput.addEventListener('input', () => {
      this.showError('');
      this.submit.disabled = !this.nameInput.value.trim();
    });

    // The row states the group's actual price, so it reads correctly for the
    // majority who never open it.
    const syncFeeSummary = () => {
      const text = (this.feeInput.value || '').trim();
      const amount = Number(text);
      $('createGroupFeeSummary').textContent =
        text && Number.isFinite(amount) && amount > 0 ? `${text} LIB to join` : 'Free to join';
    };
    this.feeInput.addEventListener('input', syncFeeSummary);
    this.fee.addEventListener('toggle', () => {
      $('createGroupFeeToggle').textContent = this.fee.open ? 'Done' : 'Change';
      if (!this.fee.open) syncFeeSummary();
    });
    this.syncFeeSummary = syncFeeSummary;

    this.staging = makeInviteStaging({
      inputEl: $('createGroupInviteInput'),
      listEl: $('createGroupStaged'),
      errorEl: $('createGroupInviteError'),
      pickerEl: this.picker,
      candidates: () => invitableContacts(),
    });
  }

  open() {
    this.nameInput.value = '';
    this.feeInput.value = '';
    this.fee.open = false;
    this.syncFeeSummary();
    this.showError('');
    this.submit.disabled = true;
    this.staging.reset();
    this.modal.classList.add('active');
    /*
     * preventScroll is not optional, and neither is the delay. The modal is
     * still at `left: 100%` when this runs, so a plain focus() scrolls the
     * off-screen input into view; .container is overflow:hidden, so that
     * displacement sticks and the modal is left parked off-screen. Deferred
     * past the 0.3s slide so focus lands once it is actually in place.
     */
    setTimeout(() => this.nameInput.focus({ preventScroll: true }), 350);
  }

  close() {
    this.modal.classList.remove('active');
  }

  showError(message) {
    this.error.textContent = message || '';
    this.error.style.display = message ? 'block' : 'none';
  }

  async handleSubmit(e) {
    e.preventDefault();
    const name = this.nameInput.value.trim();
    if (!name) return this.showError('Give the group a name');

    /*
     * Join fee, entered in LIB and converted to wei the same way the toll input
     * is. Blank or zero means a free group.
     */
    const feeText = (this.feeInput.value || '').trim();
    let joinFee = 0n;
    if (feeText) {
      const parsed = Number(feeText);
      if (!Number.isFinite(parsed) || parsed < 0) return this.showError('The join fee must be a positive number');
      joinFee = bigxnum2big(WEI, feeText);
    }

    this.submit.disabled = true;
    this.submit.textContent = 'Creating…';
    try {
      const groupId = await groups.createGroup(name, 50, joinFee);

      // Adding is a separate commit, so a failure here still leaves a usable
      // (empty) group rather than losing the creation entirely.
      const selected = this.staging.addresses();
      if (selected.length > 0) {
        try {
          await groups.addMembers(groupId, selected);
        } catch (err) {
          toast(`Group created, but adding people failed: ${err.message}`, 6000, 'error');
        }
      }

      this.close();
      deps.onChatListChanged && deps.onChatListChanged();
      groupChatModal.open(groupId);
    } catch (err) {
      this.showError(err.message);
      toast(`Could not create the group: ${err.message}`, 5000, 'error');
    } finally {
      this.submit.disabled = !this.nameInput.value.trim();
      this.submit.textContent = 'Create group';
    }
  }
}

// ------------------------------------------------------------ conversation --

class GroupChatModal {
  constructor() {
    this.groupId = null;
    /** The message being replied to: {id, message, from}, or null. */
    this.replyTo = null;
    /** The bubble whose menu is open, or null. */
    this.menuFor = null;
  }

  load() {
    this.modal = $('groupChatModal');
    if (!this.modal) return;
    this.list = $('groupMessagesList');
    this.input = $('groupMessageInput');
    this.sendButton = $('groupSendButton');
    this.title = $('groupChatTitle');
    this.subtitle = $('groupChatSubtitle');
    this.avatar = $('groupChatAvatar');

    $('closeGroupChatModal').addEventListener('click', () => this.close());
    $('groupInviteAccept').addEventListener('click', () => this.acceptInvite());
    $('groupInviteDecline').addEventListener('click', () => this.declineInvite());
    $('groupPendingWithdraw').addEventListener('click', () => this.withdrawRequest());
    $('groupStatusAction').addEventListener('click', () => this.repair());
    // Both the ⋮ button and the header itself open group info — that screen is
    // the only route to adding or removing members, so it needs to be easy to
    // reach rather than hidden behind one small icon.
    const openInfo = () => {
      if (this.groupId) groupInfoModal.open(this.groupId);
    };
    $('groupChatInfoButton').addEventListener('click', openInfo);
    $('groupChatHeaderInfo').addEventListener('click', openInfo);
    this.sendButton.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    /*
     * Guarded rather than assumed. load() already returns early on a missing
     * modal, and the menu lives OUTSIDE #groupChatModal — so any host that
     * mounts the modal without it (the harness did) would crash the whole of
     * group chat on a null addEventListener.
     */
    this.menu = $('groupMessageMenu');
    this.replyPreview = $('groupReplyPreview');
    this.replyPreviewText = $('groupReplyPreviewText');
    $('groupReplyPreviewClose')?.addEventListener('click', () => this.cancelReply());

    /*
     * One delegated handler for the whole transcript. A tap on the quote jumps
     * to the original; a tap anywhere else on a bubble opens its menu — the
     * same gesture 1:1 uses, so the two chats do not want different habits.
     */
    this.list.addEventListener('click', (e) => {
      const quote = e.target.closest('.reply-quote');
      if (quote) {
        e.preventDefault();
        e.stopPropagation();
        return this.scrollToMessage(quote.dataset.replyTxid);
      }
      // Links inside a message belong to the link, not to the menu.
      if (e.target.closest('a')) return;
      const bubble = e.target.closest('.message');
      if (!bubble || bubble.classList.contains('system-message')) return;
      this.openMessageMenu(e, bubble);
    });

    this.menu?.addEventListener('click', (e) => {
      const emojiButton = e.target.closest('[data-emoji]');
      if (emojiButton) {
        const bubble = this.menuFor;
        this.closeMessageMenu();
        return this.react(bubble, emojiButton.dataset.emoji);
      }
      const option = e.target.closest('[data-action]');
      if (!option) return;
      if (option.dataset.action === 'reply') this.startReply(this.menuFor);
      this.closeMessageMenu();
    });

    // Any tap outside, or a scroll, dismisses it.
    document.addEventListener('click', (e) => {
      if (!this.menu || this.menu.style.display === 'none') return;
      if (this.menu.contains(e.target) || e.target.closest('.message')) return;
      this.closeMessageMenu();
    });
    const scroller = this.list.parentElement;
    if (scroller) scroller.addEventListener('scroll', () => this.closeMessageMenu(), { passive: true });
  }

  openMessageMenu(e, bubble) {
    if (!this.menu) return;
    e.preventDefault();
    e.stopPropagation();
    this.menuFor = bubble;
    // Reused from ChatModal: it already handles the visual viewport, the
    // on-screen keyboard and clamping to the scroller's bounds.
    if (deps.positionMenu) deps.positionMenu(this.menu, bubble);
    this.menu.style.display = 'block';
  }

  closeMessageMenu() {
    if (this.menu) this.menu.style.display = 'none';
    this.menuFor = null;
  }

  /**
   * Adds, changes or clears our reaction on a message.
   *
   * Tapping the emoji already showing clears it, which is what 1:1 does and
   * what every other chat app trains people to expect. Any other emoji
   * replaces ours -- the state machine purges the old one, so this is one
   * transaction, not a remove followed by a set.
   */
  async react(bubble, emoji) {
    if (!bubble || !this.groupId) return;
    const txid = bubble.dataset.txid;
    if (!txid) return toast('Cannot react: this message has no id yet', 2500, 'error');

    /*
     * Both sides normalised. myAddr() is the padded 64-char chain form and the
     * reaction engine stores senders in the 40-char form, so comparing them
     * raw silently never matches -- which shows up as your own chip not being
     * marked as yours, and as a tap adding a second reaction instead of
     * clearing the one you already had.
     */
    const me = normalizeAddress(myAddr());
    const mine = groups
      .groupReactionsFor(this.groupId, txid)
      .find((r) => normalizeAddress(r.sender) === me);

    const reaction = mine && mine.emoji === emoji
      ? { reactId: txid, reactAction: 'remove', targetReactionTxId: mine.reactionTxId }
      : { reactId: txid, reactAction: 'set', reactMessage: emoji };

    try {
      await groups.sendGroupReaction(this.groupId, reaction);
      deps.onChatListChanged && deps.onChatListChanged();
    } catch (err) {
      // sendGroupReaction has already put the chips back.
      this.render();
      toast(`Could not react: ${err.message}`, 5000, 'error');
    }
  }

  /** Stages a reply. The preview bar is the only thing that records it. */
  startReply(bubble) {
    if (!bubble) return;
    const txid = bubble.dataset.txid;
    if (!txid) return toast('Cannot reply: this message has no id yet', 2500, 'error');

    const view = this.view();
    const target = (view?.messages || []).find((m) => m.txid === txid);
    const preview = truncateReplyText(target?.message || bubble.querySelector('.message-content')?.textContent);
    if (!preview) return toast('Cannot reply to an empty message', 2500, 'error');

    this.replyTo = { id: txid, message: preview, from: target?.from || '' };
    if (this.replyPreviewText) this.replyPreviewText.textContent = preview;
    if (this.replyPreview) this.replyPreview.style.display = '';
    this.input.focus({ preventScroll: true });
  }

  cancelReply() {
    this.replyTo = null;
    if (this.replyPreview) this.replyPreview.style.display = 'none';
    if (this.replyPreviewText) this.replyPreviewText.textContent = '';
  }

  /** Jumps to a quoted message, or says so when it is not held locally. */
  scrollToMessage(txid) {
    if (!txid) return;
    const target = this.list.querySelector(`[data-txid="${CSS.escape(txid)}"]`);
    if (!target) {
      /*
       * Expected in a group, unlike 1:1: forward secrecy means anything sent
       * before we joined is undecryptable, so a reply can legitimately quote a
       * message this device will never hold.
       */
      return toast('That message is not available on this device', 2500, 'info');
    }
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // The same 2s flash 1:1 uses when jumping to a quoted message.
    target.classList.add('highlighted');
    setTimeout(() => target.classList.remove('highlighted'), 2000);
  }

  isActive() {
    return !!this.modal && this.modal.classList.contains('active');
  }

  open(groupId) {
    // A reply staged in one group must not follow you into another.
    if (this.groupId !== groupId) this.cancelReply();
    this.closeMessageMenu();
    this.groupId = groupId;
    /*
     * Modals stack, and closing one reveals whatever is still active beneath it.
     * Reaching a group from the join dialog (request to join, then open the
     * pending group) would otherwise leave that dialog underneath, so the back
     * button would "go back" to the join page instead of the chat list.
     */
    if (joinGroupModal.modal?.classList.contains('active')) joinGroupModal.close();
    groups.markGroupRead(groupId);
    // Resolve any unknown sender names now rather than waiting for the next
    // poll — this is the moment the user is actually looking at them.
    groups.refreshMemberNames(groupId).catch(() => {});
    this.render();
    this.modal.classList.add('active');
    // Deliberately no focus() here: ChatModal.open does not either, and
    // focusing an input inside a modal that is still off-screen makes the
    // browser scroll the modal container sideways.
    deps.onChatListChanged && deps.onChatListChanged();
  }

  close() {
    this.closeMessageMenu();
    this.cancelReply();
    this.groupId = null;
    this.modal.classList.remove('active');
  }

  view() {
    return myData().groups?.[this.groupId];
  }

  render() {
    const view = this.view();
    if (!view) return;

    const health = groupHealth(view);
    const invite = health === 'invited';
    /*
     * Waiting on an admin. We asked to join and the request is on chain, but
     * nobody has approved it yet, so there is no MLS state and nothing to read
     * or send. Distinct from an invite: there is no decision for us to make.
     */
    const awaitingApproval = health === 'awaiting';

    this.title.textContent = view.name || 'Group';
    const count = view.members?.length || 0;
    /*
     * Roster size is the only durable fact worth this space. Before we join,
     * it is not even known — MLS state arrives with the Welcome — so those
     * states say what is actually true instead of counting to zero.
     */
    this.subtitle.textContent =
      health === 'removed'
        ? 'You are no longer a member'
        : awaitingApproval
          ? 'Waiting for approval'
          : invite
            ? 'You have been invited'
            : `${count} member${count === 1 ? '' : 's'}`;
    this.avatar.innerHTML = addressAvatar(this.groupId, 36);

    this.renderStatus(health);

    /*
     * An invite we have not accepted. Nothing has been joined and nothing spent:
     * the composer is replaced rather than merely disabled, because there is no
     * conversation to take part in until we decide.
     */
    const inviteBar = $('groupInviteBar');
    const pendingBar = $('groupPendingBar');
    const composer = $('groupComposer');
    if (pendingBar) {
      pendingBar.hidden = !awaitingApproval;
      if (awaitingApproval) {
        const held = BigInt(view.joinRequested?.escrow || 0);
        $('groupPendingText').textContent =
          held > 0n
            ? `Waiting for an admin to approve you. ${formatLib(held)} LIB is held and comes back if you withdraw.`
            : 'Waiting for an admin to approve your request to join.';
      }
    }
    if (inviteBar && composer) {
      inviteBar.hidden = !invite;
      composer.hidden = invite || awaitingApproval;
      if (invite) {
        const who = view.invitePending?.from ? displayName(view.invitePending.from, this.groupId) : 'Someone';
        $('groupInviteText').textContent = `${who} added you to this group.`;
        // The cost is real and must be stated, but it is a footnote, not the
        // headline — DESIGN.md §2.
        $('groupInviteSub').textContent = 'Joining costs a small network fee.';
      }
    }

    /*
     * Anything but a healthy group blocks the composer. A message is encrypted
     * at OUR epoch, so one sent while behind is undecryptable by everyone who
     * has moved on: the sender sees it in their own transcript and nobody else
     * ever does. Better to say we are catching up than to talk into the void.
     */
    const blocked = health !== 'fine';
    this.input.disabled = blocked;
    this.sendButton.disabled = blocked;
    this.input.placeholder = HEALTH_PLACEHOLDER[health] || HEALTH_PLACEHOLDER.fine;

    const items = [...(view.messages || [])].sort((a, b) => a.timestamp - b.timestamp);

    renderTextConversation(this.list, items, {
      senderLabelFor: (item) => displayName(item.from, this.groupId),
      // Identicon from the sender's address — the same fallback the rest of the
      // app uses when a contact has no uploaded avatar.
      senderAvatarFor: (item) => addressAvatar(item.from, 28),
      // The "before you joined" separator is a real item in the list, emitted
      // by sync only when history was actually skipped, so nothing is inferred
      // from the epoch here.
      /*
       * Who wrote the quoted message. The address travels with the reply, so
       * this is the same answer for every member — but fall back to the local
       * copy of the target for replies sent before replyFrom existed.
       */
      replyNameFor: (item) => {
        let addr = String(item.replyFrom || '').toLowerCase();
        if (!addr) {
          const target = (view.messages || []).find((m) => m.txid === item.replyId);
          addr = String(target?.from || '').toLowerCase();
        }
        if (!addr) return ['Unknown', false];
        return [displayName(addr, this.groupId), addr === myAddr()];
      },
      reactionsFor: (item) =>
        item.txid
          ? buildReactionChips(groups.groupReactionsFor(this.groupId, item.txid), normalizeAddress(myAddr()))
          : '',
      emptyHTML: buildSystemMessage('No messages yet. Say hello.'),
    });

    /*
     * The only system message left. Every warning that used to be appended here
     * is now a banner: in the transcript they scrolled away from the button
     * that fixed them, and mixed with the conversation. This one is not a
     * warning — it is the whole content of an otherwise empty screen.
     */
    if (awaitingApproval) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage(
          'Your request to join is waiting for an admin to approve it. ' +
            'You will join automatically once they do — nothing else is needed from you.',
        ),
      );
    }

    // The scroller is .messages-container, not the list itself — the list
    // carries a large top padding so short conversations sit at the bottom.
    const scroller = this.list.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  /**
   * The status banner. A healthy group shows nothing at all — DESIGN.md §1.2.
   *
   * 'invited' and 'awaiting' are deliberately absent: both already have a bar
   * over the composer carrying their decision, and two things saying the same
   * thing on one screen is worse than one.
   */
  renderStatus(health) {
    const banner = $('groupStatusBanner');
    if (!banner) return;
    const copy = HEALTH_BANNER[health];
    banner.hidden = !copy;
    if (!copy) return;

    banner.className = `ui-banner${copy.tone ? ` ${copy.tone}` : ''}`;
    $('groupStatusIcon').textContent = copy.icon;
    $('groupStatusTitle').textContent = copy.title;
    $('groupStatusSub').textContent = copy.sub;

    const action = $('groupStatusAction');
    action.hidden = !copy.action;
    action.disabled = false;
    action.textContent = copy.action;
  }

  /**
   * The one button on the banner, whatever the banner currently says.
   *
   * This is the repair ladder: 'needs-attention' tries a catch-up, and if that
   * cannot win the view flips to 'unrecoverable' and the banner re-renders
   * asking to reset instead. The person is never shown both options at once,
   * because they have no basis to choose — DESIGN.md §1.4.
   */
  async repair() {
    const health = groupHealth(this.view());
    if (health === 'removed') return groupInfoModal.leaveFrom(this.groupId);
    if (health === 'unrecoverable') return groupInfoModal.resetFrom(this.groupId);

    const action = $('groupStatusAction');
    action.disabled = true;
    action.textContent = 'Fixing…';
    try {
      const r = await groups.forceCatchUp(this.groupId);
      this.render();
      if (r.status === 'advanced' || r.status === 'current') {
        toast('This group is up to date again.', 4000, 'success');
      } else if (r.status === 'behind') {
        toast('Still catching up. It will finish on its own.', 5000, 'info');
      }
      // 'pruned' and 'stuck' need no toast: the banner has already re-rendered
      // as "can't catch up on its own" with the reset it now needs.
    } catch (err) {
      toast(`Could not fix it: ${err.message}`, 5000, 'error');
      this.render();
    }
  }

  /**
   * Accepts a pending invite. The first thing that spends anything for this
   * group, hence the explicit confirmation of cost in the button label above.
   */
  async acceptInvite() {
    const accept = $('groupInviteAccept');
    const decline = $('groupInviteDecline');
    accept.disabled = decline.disabled = true;
    accept.textContent = 'Joining…';
    try {
      await groups.acceptInvite(this.groupId);
      this.render();
      toast('Joined the group.', 3000, 'success');
    } catch (err) {
      toast(`Could not join: ${err.message}`, 5000, 'error');
    } finally {
      accept.disabled = decline.disabled = false;
      accept.textContent = 'Join';
    }
  }

  /**
   * Withdraws our own join request and takes the escrow back.
   *
   * An admin ignoring a request is how a group says no — charging the group a
   * fee to reject a spammer would be backwards — so this is the only way the
   * money comes home.
   */
  async withdrawRequest() {
    const button = $('groupPendingWithdraw');
    button.disabled = true;
    button.textContent = 'Withdrawing…';
    try {
      await groups.reclaimJoinRequest(this.groupId);
      await groups.forgetGroup(this.groupId);
      this.close();
      deps.onChatListChanged && deps.onChatListChanged();
      toast('Request withdrawn. Anything held has been returned.', 5000, 'info');
    } catch (err) {
      toast(`Could not withdraw: ${err.message}`, 5000, 'error');
      button.disabled = false;
    } finally {
      button.textContent = 'Withdraw request';
    }
  }

  /**
   * Declines. Free and entirely local — no transaction, no MLS state. We stay on
   * the group's roster until an admin removes us, which no client can fix from
   * this side without paying for the privilege.
   */
  async declineInvite() {
    try {
      await groups.declineInvite(this.groupId);
      this.close();
      toast('Invitation declined.', 3000, 'info');
    } catch (err) {
      toast(`Could not decline: ${err.message}`, 5000, 'error');
    }
  }

  async send() {
    const text = this.input.value.trim();
    if (!text || !this.groupId) return;

    const reply = this.replyTo;
    this.sendButton.disabled = true;
    this.input.value = '';
    // Cleared up front so the bar does not linger over a sent message; restored
    // with the text if the send fails.
    this.cancelReply();
    try {
      await groups.sendGroupMessage(this.groupId, text, reply);
      this.render();
      deps.onChatListChanged && deps.onChatListChanged();
    } catch (err) {
      // Put the text back so it is not lost, and the reply with it.
      this.input.value = text;
      if (reply) {
        this.replyTo = reply;
        if (this.replyPreviewText) this.replyPreviewText.textContent = reply.message;
        if (this.replyPreview) this.replyPreview.style.display = '';
      }
      toast(`Could not send: ${err.message}`, 5000, 'error');
    } finally {
      this.sendButton.disabled = false;
      this.input.focus();
    }
  }
}

// --------------------------------------------------------------- group info --


// ------------------------------------------------------------ invite links --

/**
 * Shareable link for a group.
 *
 * A plain `#group=<id>` fragment on the app's own URL: it survives being pasted
 * into any chat app, and opening it lands on the client with the id already in
 * hand. The fragment is never sent to a server, which suits an identifier that
 * grants the right to ask for admission.
 */
export function groupInviteLink(groupId) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#group=${groupId}`;
}

/**
 * Pulls a group id out of whatever the user pasted — a full invite link, a
 * `#group=` fragment, or a bare id. People paste all three.
 */
export function parseGroupInvite(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fromFragment = raw.match(/[#&?]group=([0-9a-fA-F]{64})/);
  if (fromFragment) return fromFragment[1].toLowerCase();
  const bare = raw.match(/^([0-9a-fA-F]{64})$/);
  return bare ? bare[1].toLowerCase() : null;
}

/**
 * Join-by-link.
 *
 * Only for the request path: being added by a contact needs no link and no
 * lookup, because the invite arrives on its own and is accepted from the group's
 * own screen.
 */
class JoinGroupModal {
  load() {
    this.modal = $('joinGroupModal');
    if (!this.modal) return;
    this.input = $('joinGroupLinkInput');
    this.error = $('joinGroupError');
    this.preview = $('joinGroupPreview');

    $('closeJoinGroupModal').addEventListener('click', () => this.close());
    $('joinGroupLookup').addEventListener('click', () => this.lookup());
    $('joinGroupRequest').addEventListener('click', () => this.request());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.lookup();
      }
    });
  }

  open(prefill = '') {
    if (!this.modal) return;
    this.groupId = null;
    this.input.value = prefill;
    this.error.textContent = '';
    this.preview.hidden = true;
    this.modal.classList.add('active');
    if (prefill) this.lookup();
    /*
     * preventScroll is not optional here, and neither is the delay.
     *
     * At this point the modal is still at `left: 100%` — off-screen to the
     * right — because the slide-in transition has not started. A plain focus()
     * makes the browser scroll the input into view, which scrolls .container
     * horizontally; .container is `overflow: hidden`, so that displacement
     * sticks and the modal is left parked wherever the scroll put it. The
     * symptom is a modal that flashes past and disappears, shifting around as
     * the window width changes.
     *
     * Deferred past the 0.3s transition so focus lands once the modal is
     * actually in place. app.js already uses focus({ preventScroll: true })
     * elsewhere for the same reason.
     */
    else setTimeout(() => this.input.focus({ preventScroll: true }), 350);
  }

  close() {
    this.modal.classList.remove('active');
  }

  async lookup() {
    console.log("Looking up...")
    const groupId = parseGroupInvite(this.input.value);
    this.preview.hidden = true;
    if (!groupId) {
      this.error.textContent = 'That does not look like an invite link.';
      return;
    }
    this.error.textContent = '';
    const button = $('joinGroupLookup');
    button.disabled = true;
    button.textContent = 'Looking up…';
    try {
      const info = await groups.previewGroup(groupId);
      this.groupId = groupId;
      $('joinGroupAvatar').innerHTML = addressAvatar(groupId, 56);

      const fee = BigInt(info.joinFee || '0');
      $('joinGroupMeta').textContent =
        fee > 0n
          ? `${info.memberCount} of ${info.maxMembers} members · ${formatLib(fee)} LIB to join`
          : `${info.memberCount} of ${info.maxMembers} members`;

      const requestButton = $('joinGroupRequest');
      const note = $('joinGroupNote');
      if (info.alreadyMember) {
        requestButton.disabled = true;
        note.textContent = 'You are already a member of this group.';
      } else if (info.requestPending) {
        requestButton.disabled = true;
        note.textContent = 'You already have a request pending. An admin has to approve it.';
      } else {
        requestButton.disabled = false;
        requestButton.textContent = fee > 0n ? `Request to join · ${formatLib(fee)} LIB` : 'Request to join';
        note.textContent =
          fee > 0n
            ? 'The fee is held, not spent: an admin only receives it by approving you, and it comes back in full if you withdraw first.'
            : 'An admin has to approve your request before you join.';
      }
      this.preview.hidden = false;
    } catch (err) {
      this.error.textContent = `Could not find that group: ${err.message}`;
    } finally {
      button.disabled = false;
      button.textContent = 'Look up group';
    }
  }

  async request() {
    const button = $('joinGroupRequest');
    button.disabled = true;
    button.textContent = 'Requesting…';
    try {
      await groups.requestToJoin(this.groupId, $('joinGroupMessage').value);
      this.close();
      toast('Request sent. You will join once an admin approves.', 5000, 'success');
    } catch (err) {
      this.error.textContent = err.message;
      button.disabled = false;
    } finally {
      button.textContent = 'Request to join';
    }
  }
}

class GroupInfoModal {
  constructor() {
    this.groupId = null;
    /** Requests to join, folded into the people list once they arrive. */
    this.requests = [];
    /** Address whose row menu is expanded, or null. */
    this.openMenuFor = null;
    /** Whether the add-people panel is showing. */
    this.addOpen = false;
  }

  load() {
    this.modal = $('groupInfoModal');
    if (!this.modal) return;
    this.people = $('groupInfoPeople');
    this.picker = $('groupInfoPicker');

    $('closeGroupInfoModal').addEventListener('click', () => this.close());
    $('groupInviteLinkCopy').addEventListener('click', () => this.copyInviteLink());
    $('groupFeesClaim').addEventListener('click', () => this.claimFees());
    $('groupCatchUpButton').addEventListener('click', () => this.catchUp());
    $('groupResetButton').addEventListener('click', () => this.reset());
    $('groupInfoAlertAction').addEventListener('click', () => this.repair());
    $('groupInfoAddButton').addEventListener('click', () => this.addSelected());
    $('groupMaintenanceTopUp')?.addEventListener('click', () => this.topUpMaintenance());
    // Same affordance the DAO form help uses: the explanation lives in the
    // title, and tapping it surfaces that as a dismissible toast.
    $('groupMaintenanceHelp')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toast(e.currentTarget.title, 0, 'info');
    });
    $('groupInfoAddCancel').addEventListener('click', () => this.toggleAdd(false));
    $('groupLeaveButton').addEventListener('click', () => this.leave());
    $('groupMuteRow').addEventListener('click', () => this.toggleMute());

    /*
     * One delegated handler for the whole people list. Members, requests and
     * the add-people row are one list, so they are also one click target —
     * the alternative is three listeners kept in sync by hand.
     */
    this.people.addEventListener('click', (e) => {
      const add = e.target.closest('button[data-add-people]');
      if (add) return this.toggleAdd(true);

      const approve = e.target.closest('button[data-approve]');
      if (approve) return this.approve(approve.dataset.approve, approve);

      const menu = e.target.closest('button[data-menu]');
      if (menu) {
        this.openMenuFor = this.openMenuFor === menu.dataset.menu ? null : menu.dataset.menu;
        return this.renderPeople();
      }

      const remove = e.target.closest('button[data-remove]');
      if (remove) return this.remove(remove.dataset.remove);
    });

    this.staging = makeInviteStaging({
      inputEl: $('groupInfoInviteInput'),
      listEl: $('groupInfoStaged'),
      errorEl: $('groupInfoInviteError'),
      pickerEl: this.picker,
      candidates: () => invitableContacts(this.view()?.members || []),
      isExcluded: (address) => (this.view()?.members || []).includes(address),
    });
  }

  open(groupId) {
    this.groupId = groupId;
    this.requests = [];
    this.openMenuFor = null;
    this.toggleAdd(false);
    const fallback = $('groupInviteLinkInput');
    fallback.hidden = true;
    fallback.value = '';
    this.render();
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  view() {
    return myData().groups?.[this.groupId];
  }

  isAdmin() {
    const view = this.view();
    // A removed member keeps read access to old history but has no standing to
    // change membership.
    return !!view && !view.removed && (view.admins || []).includes(myAddr());
  }

  render() {
    const view = this.view();
    if (!view) return;

    $('groupInfoAvatar').innerHTML = addressAvatar(this.groupId, 56);
    $('groupInfoName').textContent = view.name || 'Group';
    /*
     * Member count and nothing else. This line used to read "epoch N · created
     * <lastActivity>" — the epoch is protocol state, and lastActivity is the
     * last message, not the creation time, so the label was also wrong. There
     * is no creation timestamp on the view to put here instead.
     */
    const count = view.members?.length || 0;
    const founded = view.createdAt
      ? ` · created ${new Date(view.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
      : '';
    $('groupInfoMeta').textContent = `${count} member${count === 1 ? '' : 's'}${founded}`;

    $('groupLeaveLabel').textContent = view.removed ? 'Delete from this device' : 'Leave group';

    this.renderAlert(groupHealth(view));
    this.renderPeople();
    this.renderRows();
    this.renderTech();

    // Fire-and-forget: both are network reads and must not hold up the roster,
    // which is already in hand.
    this.loadRequests();
    this.renderFees();
    this.renderMaintenance();
  }

  /**
   * What the group has left to pay for repairing its own tree.
   *
   * Shown to everyone, not just admins: when the balance runs dry the fee falls
   * on whichever member performs the next repair, so every member has a stake
   * in it, and anyone may top it up.
   *
   * A healthy group shows nothing. This row is only worth a line when it is
   * running low, which is the point at which someone can still do something
   * about it before a member gets charged.
   */
  renderMaintenance() {
    const row = $('groupMaintenanceRow');
    if (!row) return;
    const view = this.view();
    const health = groups.maintenanceHealth(view);
    row.hidden = !health.low;
    if (!health.low) return;

    const summary = $('groupMaintenanceSummary');
    /*
     * Counted in renewals, not in LIB.
     *
     * This line used to read "0.76923076923076923 LIB left of
     * 1.53846153846153846 LIB", which is two unreadable numbers and a
     * relationship nobody can act on -- the second one is members × fee, which
     * is not a quantity anyone holds in their head. What someone actually wants
     * to know is how many more departures the group can absorb before the cost
     * starts landing on a member.
     */
    summary.textContent = health.empty
      ? 'Empty — the next key renewal will be charged to a member'
      : `Enough for ${health.covers} more key renewal${health.covers === 1 ? '' : 's'}`;
  }

  async topUpMaintenance() {
    const view = this.view();
    const health = groups.maintenanceHealth(view);
    // Enough to clear the shortfall outright, so one top-up settles it rather
    // than leaving the row up afterwards.
    const suggested = health.needed > health.balance ? health.needed - health.balance : health.needed;
    if (suggested <= 0n) return;

    /*
     * Confirm the amount before spending it.
     *
     * This moves real money out of the signed-in account and cannot be undone
     * -- the balance is not withdrawable by anyone, by design -- so a single
     * tap on a button labelled "Top up" is not enough consent. The figure is
     * computed rather than typed, which makes showing it before charging it
     * more important, not less.
     */
    const entered = await confirmDialog({
      title: 'Add to group upkeep?',
      body:
        `This moves LIB from your balance into ${view?.name || 'this group'}, on top of the usual ` +
        `transaction fee. It can only ever be spent renewing the group's keys after someone leaves, ` +
        `and cannot be withdrawn — by you or anyone else.\n\n` +
        `${formatLib(suggested)} LIB clears the shortfall. Add more to cover the group for longer.`,
      input: {
        label: 'Amount in LIB',
        // Prefilled with the shortfall, so the common case is one tap, and
        // selected on focus so typing a different figure replaces it.
        value: formatLib(suggested),
        inputMode: 'decimal',
        placeholder: '0',
        validate: (raw) => parseLibToWei(raw) > 0n,
      },
      confirmLabel: 'Add to upkeep',
    });
    if (entered === null) return;

    const amount = parseLibToWei(entered);
    if (amount <= 0n) return;

    const button = $('groupMaintenanceTopUp');
    button.disabled = true;
    button.textContent = 'Adding…';
    try {
      await groups.fundGroupMaintenance(this.groupId, amount);
      toast(`Added ${formatLib(amount)} LIB for upkeep`, 3000, 'success');
      this.render();
    } catch (e) {
      toast(e?.message || 'Could not add to upkeep', 4000, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Top up';
    }
  }

  /**
   * The same banner the chat page shows, repeated here only when the group
   * needs attention.
   *
   * Someone who came looking for a fix should find it without opening the
   * drawer; someone whose group is healthy should see nothing — which is
   * exactly what replaced the permanent "Sync" section.
   */
  renderAlert(health) {
    const alert = $('groupInfoAlert');
    if (!alert) return;
    const copy = health === 'needs-attention' || health === 'unrecoverable' ? HEALTH_BANNER[health] : null;
    alert.hidden = !copy;
    if (!copy) return;
    alert.className = 'ui-banner ui-banner--attention ui-banner--inset';
    $('groupInfoAlertTitle').textContent = copy.title;
    $('groupInfoAlertSub').textContent = copy.sub;
    const action = $('groupInfoAlertAction');
    action.disabled = false;
    action.textContent = copy.action;
  }

  /**
   * Members, requests to join and "add people" as one list.
   *
   * These were three sections at equal weight, and "who's in" sat three slots
   * from "who wants in" despite being one thought — DESIGN.md §1.5. Requests
   * sort to the top because they are the rows carrying a decision.
   *
   * It is also what makes the non-admin view read as simple rather than empty:
   * a list with fewer controls is still a list, where five hidden sections are
   * five holes.
   */
  renderPeople() {
    const view = this.view();
    if (!view) return;
    const isAdmin = this.isAdmin();
    const count = view.members?.length || 0;

    /*
     * A membership commit is in flight. It is NOT applied yet — the receipt
     * decides that — so the roster still shows the old truth and the controls
     * that would build a second, conflicting commit are locked out.
     */
    const pending = view.pendingChange;
    const hint = $('groupInfoPendingHint');
    hint.hidden = !pending;
    if (pending) {
      const who = (pending.addresses || []).map((a) => displayName(a, this.groupId)).join(', ');
      hint.textContent =
        pending.kind === 'remove'
          ? `Removing ${who}… waiting for the network to confirm.`
          : `Adding ${who}… waiting for the network to confirm.`;
    }

    const canManage = isAdmin && !pending;
    const rows = [];

    if (canManage && !this.addOpen) {
      rows.push(`
        <li>
          <button type="button" class="ui-list-action" data-add-people="1">
            <span class="ui-list-plus" aria-hidden="true">+</span>
            <span class="ui-list-name">Add people</span>
          </button>
        </li>`);
    }

    /*
     * Whoever the in-flight commit is adding is marked as such, in place of
     * their Approve button. Without it the row you just approved sits there
     * still saying "wants to join" with no button, which reads as a failure.
     */
    const beingAdded = new Set(
      pending?.kind === 'add' ? (pending.addresses || []).map((a) => String(a).toLowerCase()) : [],
    );
    for (const r of this.requests) {
      const adding = beingAdded.has(String(r.address).toLowerCase());
      rows.push(`
        <li class="ui-list-row ui-list-row--pending">
          <span class="ui-list-avatar">${addressAvatar(r.address, 28)}</span>
          <span class="ui-list-name">
            ${escapeHtml(displayName(r.address, this.groupId))}
            <span class="ui-list-label">${adding ? 'adding…' : 'wants to join'}</span>
            ${r.message ? `<span class="ui-list-note">${escapeHtml(r.message)}</span>` : ''}
          </span>
          ${canManage ? `<button class="btn--tiny btn--tiny-primary" data-approve="${r.address}">Approve</button>` : ''}
        </li>`);
    }

    for (const address of view.members || []) {
      const admin = (view.admins || []).includes(address);
      const isMe = address === myAddr();
      const canRemove = canManage && !isMe;
      rows.push(`
        <li class="ui-list-row">
          <span class="ui-list-avatar">${addressAvatar(address, 28)}</span>
          <span class="ui-list-name">${escapeHtml(isMe ? 'You' : displayName(address, this.groupId))}</span>
          ${admin ? '<span class="ui-badge ui-badge--accent">admin</span>' : ''}
          ${canRemove ? `<button class="ui-list-more" data-menu="${address}" aria-label="More">⋯</button>` : ''}
        </li>`);
      /*
       * The row menu expands in place rather than floating. An anchored popover
       * would have to track a scrolling list inside a sliding modal; this
       * cannot drift, and it works the same under a finger as under a mouse.
       */
      if (canRemove && this.openMenuFor === address) {
        rows.push(`
        <li class="ui-list-actions">
          <button class="btn--tiny btn--tiny-danger" data-remove="${address}">Remove from group</button>
        </li>`);
      }
    }

    this.people.innerHTML = rows.join('');

    /*
     * The count, or the badge in its place. Never both: the header two lines up
     * already says "5 members", so a second count beside a queue that needs
     * attention is noise competing with the thing that matters.
     */
    const badge = $('groupInfoRequestBadge');
    const waiting = this.requests.length;
    badge.hidden = waiting === 0;
    badge.textContent = `${waiting} ${waiting === 1 ? 'wants' : 'want'} to join`;
    $('groupInfoMemberCount').textContent = waiting === 0 && count ? String(count) : '';
  }

  /** Invite link, fees and leave: one line each — DESIGN.md §1.5. */
  renderRows() {
    const view = this.view();
    /*
     * Every member can share the link, not just admins — sharing it only lets
     * someone ASK, and an admin still approves. Hidden once we are removed,
     * where handing out an invite we can no longer vouch for would be odd.
     */
    const canInvite = !view.removed && !view.invitePending;
    $('groupInviteLinkRow').hidden = !canInvite;

    const muted = groups.isGroupMuted(this.groupId);
    $('groupMuteRow').setAttribute('aria-checked', String(!muted));
    $('groupMuteState').textContent = muted ? 'Off' : 'On';
    /*
     * The clipboard fallback is NOT reset here. render() runs on every
     * background sync, which would re-hide the link a second after a failed
     * copy revealed it — exactly while it is being copied by hand. It is
     * cleared in open() instead, when the group actually changes.
     */
  }

  /** Group id, cipher suite and the epochs — everything §1.1 took off screen. */
  renderTech() {
    const view = this.view();
    const rows = [
      ['Group id', this.groupId],
      ['Cipher suite', MLS_CIPHERSUITE_NAME],
      ['Group epoch', typeof view.chainEpoch === 'number' ? String(view.chainEpoch) : '—'],
      ['This device', typeof view.epoch === 'number' ? String(view.epoch) : '—'],
      ['Joined at', typeof view.memberSinceEpoch === 'number' ? `epoch ${view.memberSinceEpoch}` : '—'],
    ];
    if (typeof view.applyFailedAtEpoch === 'number') {
      rows.push(['Stuck at', `epoch ${view.applyFailedAtEpoch}`]);
    }
    /*
     * The upkeep balance, always -- unlike the Upkeep row above, which only
     * appears when it is running low.
     *
     * A warning that is permanently on screen stops being a warning, but "how
     * much is actually in there" is a fair question to be able to answer at any
     * time, and this is where the rest of the group's plumbing already lives.
     */
    const health = groups.maintenanceHealth(view);
    rows.push([
      'Upkeep balance',
      `${formatLib(health.balance)} LIB${health.covers > 0 ? ` · ${health.covers} renewal${health.covers === 1 ? '' : 's'}` : ''}`,
    ]);
    $('groupTechDetails').innerHTML = rows
      .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`)
      .join('');
  }

  /** Shows or hides the add-people panel. */
  toggleAdd(open) {
    this.addOpen = !!open;
    const panel = $('groupInfoAddPanel');
    if (panel) panel.hidden = !this.addOpen;
    if (this.addOpen) {
      this.staging.reset();
      setTimeout(() => $('groupInfoInviteInput').focus({ preventScroll: true }), 50);
    }
    if (this.people) this.renderPeople();
  }

  async addSelected() {
    const selected = this.staging.addresses();
    if (selected.length === 0) {
      toast('Pick someone, or type a username first', 3000, 'info');
      return;
    }
    const button = $('groupInfoAddButton');
    button.disabled = true;
    try {
      await groups.addMembers(this.groupId, selected);
      this.toggleAdd(false);
      this.render();
      groupChatModal.render();
      toast(`Added ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`, 3000, 'success');
    } catch (err) {
      toast(`Could not add: ${err.message}`, 5000, 'error');
    } finally {
      button.disabled = false;
    }
  }

  /**
   * The admin's approval queue, folded into the people list.
   *
   * A request is the requester's consent to be added, so approving one is an
   * ordinary add — the server accepts it precisely because the request exists.
   */
  async loadRequests() {
    if (!this.isAdmin()) {
      this.requests = [];
      this.renderPeople();
      return;
    }
    /*
     * A commit is in flight. Keep the queue exactly as it is and re-render.
     *
     * This used to empty `this.requests` here, so approving one of several
     * requests made all the others vanish behind "Adding …" and reappear when
     * the receipt landed — as though approving one had discarded the rest.
     * Their requests are unaffected by a commit that does not concern them.
     *
     * Re-fetching mid-commit is what is actually unsafe: the server's answer
     * races the receipt. Not fetching is the whole restriction; renderPeople
     * already withholds the Approve buttons while pending, so nothing here can
     * build a second, conflicting commit.
     */
    if (this.view()?.pendingChange) {
      this.renderPeople();
      return;
    }
    try {
      const requests = await groups.listJoinRequests(this.groupId);
      // The screen may have moved on while this was in flight.
      if (!this.modal.classList.contains('active')) return;
      /*
       * A commit may have started while this fetch was in flight. Its answer is
       * now older than the approval that caused the commit — and may already
       * omit the request being approved — so keep what is on screen rather than
       * overwriting it with a list that races the receipt.
       */
      if (this.view()?.pendingChange) return;
      this.requests = Array.isArray(requests) ? requests : [];
    } catch {
      if (this.view()?.pendingChange) return;
      this.requests = [];
    }
    this.renderPeople();
  }

  async approve(address, button) {
    button.disabled = true;
    button.textContent = 'Approving…';
    try {
      await groups.approveJoinRequest(this.groupId, address);
      this.render();
      groupChatModal.render();
      toast('Approved.', 3000, 'success');
    } catch (err) {
      toast(`Could not approve: ${err.message}`, 5000, 'error');
      button.disabled = false;
      button.textContent = 'Approve';
    }
  }

  async remove(address) {
    this.openMenuFor = null;
    try {
      await groups.removeMembers(this.groupId, [address]);
      this.render();
      groupChatModal.render();
    } catch (err) {
      toast(`Could not remove: ${err.message}`, 5000, 'error');
    }
  }

  /**
   * Join fees this admin has earned in the group.
   *
   * Split into collectable and still-vesting, because the difference is the
   * point: until a fee matures, removing that member returns it to them, so it
   * is not the admin's money yet. Hidden entirely when there is no money, so a
   * group nobody pays for never mentions fees.
   */
  async renderFees() {
    const row = $('groupFeesRow');
    if (!row) return;
    if (!this.isAdmin()) {
      row.hidden = true;
      return;
    }
    let status;
    try {
      status = await groups.joinFeeStatus(this.groupId);
    } catch {
      row.hidden = true;
      return;
    }
    if (status.claimable === 0n && status.vesting === 0n) {
      row.hidden = true;
      return;
    }
    row.hidden = false;

    const parts = [];
    if (status.claimable > 0n) parts.push(`${formatLib(status.claimable)} LIB ready`);
    if (status.vesting > 0n) {
      const when = status.nextVestingAt
        ? ` until ${new Date(status.nextVestingAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
        : '';
      parts.push(`${formatLib(status.vesting)} LIB held${when}`);
    }
    $('groupFeesSummary').textContent = parts.join(' · ');
    const claim = $('groupFeesClaim');
    claim.disabled = status.claimable === 0n;
    // Blue says "you can act on this". Nothing to collect is a state, not an
    // action, so it drops to the muted value styling instead.
    claim.classList.toggle('btn--text', status.claimable > 0n);
    claim.classList.toggle('ui-row-value', status.claimable === 0n);
    claim.textContent = status.claimable > 0n ? 'Collect' : 'Nothing yet';
  }

  async claimFees() {
    const button = $('groupFeesClaim');
    button.disabled = true;
    button.textContent = 'Collecting…';
    try {
      await groups.claimJoinFees(this.groupId);
      this.render();
      toast('Collected.', 4000, 'success');
    } catch (err) {
      toast(`Could not collect: ${err.message}`, 5000, 'error');
      button.disabled = false;
      button.textContent = 'Collect';
    }
  }

  async copyInviteLink() {
    const button = $('groupInviteLinkCopy');
    const link = groupInviteLink(this.groupId);
    try {
      await navigator.clipboard.writeText(link);
      button.textContent = 'Copied';
      setTimeout(() => (button.textContent = 'Copy'), 1500);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). Reveal
      // the link and select it so it can be copied by hand rather than lost.
      const input = $('groupInviteLinkInput');
      input.hidden = false;
      input.value = link;
      input.focus({ preventScroll: true });
      input.select();
      toast('Could not copy automatically — the link is selected, copy it by hand.', 5000, 'info');
    }
  }

  /** The banner's button, when group info is the screen showing it. */
  async repair() {
    const health = groupHealth(this.view());
    if (health === 'unrecoverable') return this.reset();
    const action = $('groupInfoAlertAction');
    action.disabled = true;
    action.textContent = 'Fixing…';
    await this.catchUp({ silent: true });
  }

  /**
   * Re-applies group updates this device has not seen.
   *
   * Reports the outcomes it cannot fix honestly: pruned updates and a commit
   * that genuinely will not apply both need a reset, and saying "done" for
   * those would be a lie.
   */
  async catchUp({ silent = false } = {}) {
    const button = $('groupCatchUpButton');
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      const r = await groups.forceCatchUp(this.groupId);
      this.render();
      groupChatModal.render();
      if (r.status === 'advanced' || r.status === 'current') {
        toast('This group is up to date.', 4000, 'success');
      } else if (r.status === 'behind') {
        toast('Still catching up. It will finish on its own.', 5000, 'info');
      } else if (!silent) {
        // The banner now says so too, so a toast is only worth it when the
        // person pressed the drawer button rather than the banner.
        toast('This device can’t catch up on its own — it needs a reset.', 6000, 'error');
      }
    } catch (err) {
      toast(`Could not check: ${err.message}`, 5000, 'error');
      this.render();
    } finally {
      button.disabled = false;
      button.textContent = 'Check for updates';
    }
  }

  async reset() {
    const ok = await confirmDialog({
      title: 'Reset this group on this device?',
      body:
        'This clears the keys this device holds for the group. Messages already on screen ' +
        'stay, and another member then has to add you back before you can take part again.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!ok) {
      this.render();
      return;
    }
    const btn = $('groupResetButton');
    btn.disabled = true;
    try {
      await groups.resetGroupState(this.groupId);
      this.render();
      groupChatModal.render();
      toast('Reset. Ask a member to add you back.', 6000, 'info');
    } catch (err) {
      toast(`Could not reset: ${err.message}`, 5000, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /** Reset a group from the chat page, without opening this screen first. */
  async resetFrom(groupId) {
    this.groupId = groupId;
    await this.reset();
  }

  /** Leave or delete a group from the chat page, without opening this screen. */
  async leaveFrom(groupId) {
    this.groupId = groupId;
    await this.leave();
  }

  /*
   * Local and immediate: no transaction, nothing to confirm, nothing that can
   * fail. Re-rendering the row is the whole feedback.
   */
  toggleMute() {
    if (!this.groupId) return;
    const nowMuted = groups.setGroupMuted(this.groupId, !groups.isGroupMuted(this.groupId));
    this.renderRows();
    toast(
      nowMuted ? 'Notification sound off for this group' : 'Notification sound on for this group',
      2000,
      'info'
    );
  }

  async leave() {
    const wasRemoved = !!this.view()?.removed;
    const ok = await confirmDialog(
      wasRemoved
        ? {
            title: 'Delete this group from this device?',
            body: 'The messages on screen will be lost.',
            confirmLabel: 'Delete',
            danger: true,
          }
        : {
            title: 'Leave this group?',
            body: 'You will stop receiving messages, and an admin has to add you back to rejoin.',
            confirmLabel: 'Leave',
            danger: true,
          },
    );
    if (!ok) return;
    try {
      await groups.leaveGroup(this.groupId);
      this.close();
      groupChatModal.close();
      deps.onChatListChanged && deps.onChatListChanged();
      toast(wasRemoved ? 'Deleted from this device' : 'You left the group', 3000, 'info');
    } catch (err) {
      toast(`Could not leave: ${err.message}`, 5000, 'error');
    }
  }
}

export const createGroupModal = new CreateGroupModal();
export const groupChatModal = new GroupChatModal();
export const groupInfoModal = new GroupInfoModal();
export const joinGroupModal = new JoinGroupModal();

/** Re-render the open group screen after a background sync. */
export function refreshOpenGroup(groupId) {
  if (groupChatModal.isActive() && groupChatModal.groupId === groupId) {
    groups.markGroupRead(groupId);
    groupChatModal.render();
  }
  if (groupInfoModal.modal?.classList.contains('active') && groupInfoModal.groupId === groupId) {
    groupInfoModal.render();
  }
}
