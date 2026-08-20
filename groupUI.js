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
import { MLS_CIPHERSUITE_ID } from './mlsEngine.js';
import { renderTextConversation, buildSystemMessage } from './chatRender.js';
import {
  generateIdenticon,
  escapeHtml,
  longAddress,
  normalizeAddress,
  normalizeUsername,
  utf82bin,
  formatTime,
  big2str,
  bigxnum2big,
} from './lib.js';

/** Wei per LIB, matching the rest of the app's amount handling. */
const WEI = 10n ** 18n;

/** Wei -> a short decimal string for display, trailing zeros trimmed. */
function formatLib(wei) {
  const s = big2str(BigInt(wei || 0n), 18);
  return s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}
import { hashBytes } from './crypto.js';

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
 * Best-effort display name for an address, falling back to a short form.
 *
 * Deliberately total: longAddress/normalizeAddress throw on anything that is
 * not a well-formed address, and this runs once per rendered message. A single
 * odd roster entry must not be able to blank the whole conversation.
 */
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

function renderPicker(listEl, candidates) {
  if (!listEl) return;
  if (candidates.length === 0) {
    listEl.innerHTML = '<li class="group-picker-empty">No contacts available to add.</li>';
    return;
  }
  listEl.innerHTML = candidates
    .map(
      ({ address }) => `
      <li class="group-picker-row">
        <label>
          <input type="checkbox" value="${address}" />
          <span class="group-picker-avatar">${generateIdenticon(address, 28)}</span>
          <span class="group-picker-name">${escapeHtml(displayName(address))}</span>
        </label>
      </li>`,
    )
    .join('');
}

const selectedFrom = (listEl) =>
  [...listEl.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);

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
function makeInviteStaging({ inputEl, addButtonEl, listEl, errorEl, isExcluded }) {
  const staged = [];

  const render = () => {
    listEl.innerHTML = staged
      .map(
        (s, i) => `
        <li class="group-staged-chip">
          <span>${escapeHtml(s.username || displayName(s.address))}</span>
          <button type="button" class="group-staged-remove" data-index="${i}" aria-label="Remove">×</button>
        </li>`,
      )
      .join('');
  };

  const showError = (msg) => {
    errorEl.textContent = msg || '';
    errorEl.style.display = msg ? 'block' : 'none';
  };

  const add = async () => {
    showError('');
    addButtonEl.disabled = true;
    try {
      const entry = await resolveInvitee(inputEl.value, (address) => {
        if (address === myAddr()) throw new Error('That is you');
        if (staged.some((s) => s.address === address)) throw new Error('Already added');
        if (isExcluded && isExcluded(address)) throw new Error('Already in the group');
      });
      staged.push(entry);
      inputEl.value = '';
      render();
    } catch (err) {
      showError(err.message);
    } finally {
      addButtonEl.disabled = false;
    }
  };

  addButtonEl.addEventListener('click', add);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  });
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-index]');
    if (!btn) return;
    staged.splice(Number(btn.dataset.index), 1);
    render();
  });

  return {
    addresses: () => staged.map((s) => s.address),
    reset: () => {
      staged.length = 0;
      inputEl.value = '';
      showError('');
      render();
    },
  };
}

// ---------------------------------------------------------- create a group --

class CreateGroupModal {
  load() {
    this.modal = $('createGroupModal');
    this.form = $('createGroupForm');
    this.nameInput = $('groupNameInput');
    this.picker = $('groupMemberPicker');
    this.error = $('createGroupError');
    this.submit = $('createGroupSubmit');
    if (!this.modal) return;

    $('closeCreateGroupModal').addEventListener('click', () => this.close());
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    this.staging = makeInviteStaging({
      inputEl: $('createGroupInviteInput'),
      addButtonEl: $('createGroupInviteAdd'),
      listEl: $('createGroupStaged'),
      errorEl: $('createGroupInviteError'),
    });
  }

  open() {
    this.nameInput.value = '';
    this.error.style.display = 'none';
    this.staging.reset();
    renderPicker(this.picker, invitableContacts());
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  showError(message) {
    this.error.textContent = message;
    this.error.style.display = 'inline';
  }

  async handleSubmit(e) {
    e.preventDefault();
    const name = this.nameInput.value.trim();
    if (!name) return this.showError('required');

    /*
     * Join fee, entered in LIB and converted to wei the same way the toll input
     * is. Blank or zero means an open group.
     */
    const feeInput = $('createGroupJoinFee');
    const feeText = (feeInput?.value || '').trim();
    let joinFee = 0n;
    if (feeText) {
      const parsed = Number(feeText);
      if (!Number.isFinite(parsed) || parsed < 0) return this.showError('join fee must be a positive number');
      joinFee = bigxnum2big(WEI, feeText);
    }

    this.submit.disabled = true;
    this.submit.textContent = 'Creating…';
    try {
      const groupId = await groups.createGroup(name, 50, joinFee);

      // Adding is a separate commit, so a failure here still leaves a usable
      // (empty) group rather than losing the creation entirely.
      const selected = [...new Set([...selectedFrom(this.picker), ...this.staging.addresses()])];
      if (selected.length > 0) {
        try {
          await groups.addMembers(groupId, selected);
        } catch (err) {
          toast(`Group created, but adding members failed: ${err.message}`, 6000, 'error');
        }
      }

      this.close();
      deps.onChatListChanged && deps.onChatListChanged();
      groupChatModal.open(groupId);
    } catch (err) {
      this.showError(err.message);
      toast(`Could not create group: ${err.message}`, 5000, 'error');
    } finally {
      this.submit.disabled = false;
      this.submit.textContent = 'Create group';
    }
  }
}

// ------------------------------------------------------------ conversation --

class GroupChatModal {
  constructor() {
    this.groupId = null;
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
  }

  isActive() {
    return !!this.modal && this.modal.classList.contains('active');
  }

  open(groupId) {
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
    this.groupId = null;
    this.modal.classList.remove('active');
  }

  view() {
    return myData().groups?.[this.groupId];
  }

  render() {
    const view = this.view();
    if (!view) return;

    const invite = view.invitePending;
    /*
     * Waiting on an admin. We asked to join and the request is on chain, but
     * nobody has approved it yet, so there is no MLS state and nothing to read
     * or send. Distinct from an invite: there is no decision for us to make.
     */
    const awaitingApproval = !invite && !!view.joinRequested;

    this.title.textContent = view.name || 'Group';
    const count = view.members?.length || 0;
    /*
     * Roster size and epoch come from MLS state we do not have until we join, so
     * before that they read "0 members · epoch 0" — not merely unhelpful but
     * wrong. Say what is actually true instead.
     */
    this.subtitle.textContent = view.removed
      ? 'You are no longer a member'
      : awaitingApproval
        ? 'Waiting for approval'
        : `${count} member${count === 1 ? '' : 's'} · epoch ${view.epoch}`;
    this.avatar.innerHTML = generateIdenticon(this.groupId, 36);

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
      composer.hidden = !!invite || awaitingApproval;
      if (invite) {
        const who = invite.from ? displayName(invite.from, this.groupId) : 'Someone';
        $('groupInviteText').textContent =
          `${who} added you to this group. Joining publishes a key update from your account, which costs a transaction fee.`;
      }
    }

    // Once removed, the keys have been rotated: nothing sent after the removing
    // commit is decryptable, and the network would reject our messages anyway.
    /*
     * Behind the group. A message is encrypted at OUR epoch, so anything sent
     * from here is undecryptable by everyone who has moved on — the sender sees
     * it in their own transcript and nobody else ever does. Better to say we are
     * catching up than to let them talk into the void.
     */
    const behind = typeof view.chainEpoch === 'number' && view.chainEpoch > view.epoch;
    const wedged = typeof view.applyFailedAtEpoch === 'number';
    const blocked =
      !!view.removed || !!view.needsReset || !!invite || awaitingApproval || behind || wedged;
    this.input.disabled = blocked;
    this.sendButton.disabled = blocked;
    this.input.placeholder = view.removed
      ? 'You can no longer send messages'
      : awaitingApproval
        ? 'Waiting for an admin to approve your request'
        : wedged
          ? 'This group needs to be reset before you can send'
          : behind
            ? 'Catching up with the group…'
            : view.needsReset
              ? 'This group needs to be reset before you can send'
              : 'Type a message...';

    const items = [...(view.messages || [])].sort((a, b) => a.timestamp - b.timestamp);

    renderTextConversation(this.list, items, {
      senderLabelFor: (item) => displayName(item.from, this.groupId),
      // Identicon from the sender's address — the same fallback the rest of the
      // app uses when a contact has no uploaded avatar.
      senderAvatarFor: (item) => generateIdenticon(item.from, 28),
      // The "before you joined" separator is a real item in the list, emitted
      // by sync only when history was actually skipped, so nothing is inferred
      // from the epoch here.
      emptyHTML: buildSystemMessage('No messages yet. Say hello.'),
    });

    if (awaitingApproval) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage(
          'Your request to join is waiting for an admin to approve it. ' +
            'You will join automatically once they do — nothing else is needed from you.',
        ),
      );
    }

    if (view.removed) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage('You were removed from this group. Messages sent after this are not visible to you.', 'system-warning'),
      );
    }

    if (view.needsReset) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage(
          `This device is out of step with the group (it is at epoch ${view.localEpoch}, the group is at ${view.chainEpoch}). ` +
            'A change was made here that the network did not accept. Open group info and reset this group to rejoin.',
          'system-warning',
        ),
      );
    }

    if (wedged) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage(
          `This device could not apply the group's update at epoch ${view.applyFailedAtEpoch}, so it is stuck at epoch ` +
            `${view.localEpoch} while the group is at ${view.chainEpoch}. Message keys cannot be rebuilt from anything ` +
            'public, so open group info, reset this group, and ask a member to add you back.',
          'system-warning',
        ),
      );
    } else if (behind) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage(`Catching up — this device is at epoch ${view.epoch}, the group is at ${view.chainEpoch}.`),
      );
    }

    if (view.needsRecovery) {
      this.list.insertAdjacentHTML(
        'afterbegin',
        buildSystemMessage(
          'This group moved on while you were away and the missed updates are no longer stored. You need to rejoin to catch up.',
          'system-warning',
        ),
      );
    }

    // The scroller is .messages-container, not the list itself — the list
    // carries a large top padding so short conversations sit at the bottom.
    const scroller = this.list.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
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
      accept.textContent = 'Join group';
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

    this.sendButton.disabled = true;
    this.input.value = '';
    try {
      await groups.sendGroupMessage(this.groupId, text);
      this.render();
      deps.onChatListChanged && deps.onChatListChanged();
    } catch (err) {
      // Put the text back so it is not lost.
      this.input.value = text;
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
      $('joinGroupAvatar').innerHTML = generateIdenticon(groupId, 56);

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
  load() {
    this.modal = $('groupInfoModal');
    if (!this.modal) return;
    this.membersList = $('groupInfoMembers');
    this.picker = $('groupInfoPicker');

    $('closeGroupInfoModal').addEventListener('click', () => this.close());
    $('groupInviteLinkCopy').addEventListener('click', () => this.copyInviteLink());
    $('groupFeesClaim').addEventListener('click', () => this.claimFees());
    $('groupCatchUpButton').addEventListener('click', () => this.catchUp());
    this.requestsList = $('groupJoinRequests');
    this.requestsList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-approve]');
      if (btn) this.approve(btn.getAttribute('data-approve'), btn);
    });
    $('groupInfoAddButton').addEventListener('click', () => this.addSelected());
    $('groupResetButton').addEventListener('click', () => this.reset());

    this.staging = makeInviteStaging({
      inputEl: $('groupInfoInviteInput'),
      addButtonEl: $('groupInfoInviteAdd'),
      listEl: $('groupInfoStaged'),
      errorEl: $('groupInfoInviteError'),
      isExcluded: (address) => (this.view()?.members || []).includes(address),
    });
    $('groupLeaveButton').addEventListener('click', () => this.leave());
    this.membersList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-remove]');
      if (btn) this.remove(btn.dataset.remove);
    });
  }

  open(groupId) {
    this.groupId = groupId;
    this.staging.reset();
    this.render();
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  view() {
    return myData().groups?.[this.groupId];
  }

  render() {
    const view = this.view();
    if (!view) return;

    $('groupInfoAvatar').innerHTML = generateIdenticon(this.groupId, 56);
    $('groupInfoName').textContent = view.name || 'Group';
    $('groupInfoMeta').textContent = `epoch ${view.epoch} · created ${
      view.lastActivity ? formatTime(view.lastActivity) : 'recently'
    }`;
    $('groupInfoMemberCount').textContent = `(${view.members?.length || 0})`;

    // A removed member keeps read access to old history but has no standing to
    // change membership, and there is nothing left to leave.
    const isAdmin = !view.removed && (view.admins || []).includes(myAddr());
    $('groupLeaveButton').textContent = view.removed ? 'Delete from this device' : 'Leave group';

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

    this.membersList.innerHTML = (view.members || [])
      .map((address) => {
        const admin = (view.admins || []).includes(address);
        const isMe = address === myAddr();
        const canRemove = isAdmin && !isMe && !pending;
        return `
        <li class="group-member-row">
          <span class="group-picker-avatar">${generateIdenticon(address, 28)}</span>
          <span class="group-picker-name">${escapeHtml(displayName(address, this.groupId))}</span>
          ${admin ? '<span class="group-admin-badge">admin</span>' : ''}
          ${canRemove ? `<button class="btn btn--tiny" data-remove="${address}">Remove</button>` : ''}
        </li>`;
      })
      .join('');

    $('groupInfoAddSection').style.display = isAdmin && !pending ? '' : 'none';
    // Fire-and-forget: the queue is a network read and must not hold up the
    // roster, which is already in hand.
    this.renderJoinRequests(isAdmin && !pending);
    this.renderFees(isAdmin);

    /*
     * Where this device stands. Only meaningful once we actually hold state, so
     * it is hidden for a pending invite or an unapproved request.
     */
    const syncSection = $('groupSyncSection');
    if (syncSection) {
      const joined = !view.invitePending && !view.joinRequested;
      syncSection.hidden = !joined;
      if (joined) {
        const chain = view.chainEpoch;
        $('groupSyncStatus').textContent =
          typeof chain === 'number' && chain > view.epoch
            ? `This device is at epoch ${view.epoch}; the group is at ${chain}.`
            : `Up to date at epoch ${view.epoch}.`;
      }
    }

    /*
     * Every member can share the link, not just admins — sharing it only lets
     * someone ASK, and an admin still approves. Hidden once we are removed,
     * where handing out an invite we can no longer vouch for would be odd.
     */
    const canInvite = !view.removed && !view.invitePending;
    $('groupInviteLinkSection').hidden = !canInvite;
    if (canInvite) $('groupInviteLinkInput').value = groupInviteLink(this.groupId);
    // Without this, a non-admin just sees a roster with no controls and no
    // explanation for why.
    $('groupInfoAdminNote').hidden = isAdmin || !!view.removed;

    // Out-of-step recovery: MLS state cannot be rebuilt from the public
    // transcript, so the only way back is a fresh Welcome from a member.
    $('groupResetSection').style.display = view.needsReset || view.applyFailedAtEpoch !== undefined ? '' : 'none';
    if (view.needsReset || view.applyFailedAtEpoch !== undefined) {
      const cause =
        view.applyFailedAtEpoch !== undefined
          ? `This device could not apply the group's update at epoch ${view.applyFailedAtEpoch}, so it is stuck at ` +
            `epoch ${view.localEpoch} while the group is at ${view.chainEpoch}.`
          : `This device is at epoch ${view.localEpoch} but the group is at ${view.chainEpoch}.`;
      $('groupResetExplain').textContent =
        `${cause} Resetting clears this device\u2019s keys for the group, keeping the messages already on screen. ` +
        'Another member then needs to add you back, which sends a new invitation.';
    }
    if (isAdmin) renderPicker(this.picker, invitableContacts(view.members || []));
  }

  async addSelected() {
    const selected = [...new Set([...selectedFrom(this.picker), ...this.staging.addresses()])];
    if (selected.length === 0) {
      toast('Add someone by username, or tick a contact first', 3000, 'info');
      return;
    }
    const button = $('groupInfoAddButton');
    button.disabled = true;
    try {
      await groups.addMembers(this.groupId, selected);
      this.staging.reset();
      this.render();
      groupChatModal.render();
      toast(`Added ${selected.length} member${selected.length === 1 ? '' : 's'}`, 3000, 'success');
    } catch (err) {
      toast(`Could not add: ${err.message}`, 5000, 'error');
    } finally {
      button.disabled = false;
    }
  }

  /**
   * The admin's approval queue.
   *
   * A request is the requester's consent to be added, so approving one is an
   * ordinary add — the server accepts it precisely because the request exists.
   */
  /**
   * Manual sync. Reports the outcome plainly, including the cases it cannot fix:
   * pruned updates and a commit that genuinely will not apply both need a reset,
   * and saying "done" for those would be a lie.
   */
  async catchUp() {
    const button = $('groupCatchUpButton');
    button.disabled = true;
    button.textContent = 'Catching up…';
    try {
      const r = await groups.forceCatchUp(this.groupId);
      this.render();
      groupChatModal.render();
      if (r.status === 'advanced') {
        toast(`Caught up to epoch ${r.after}.`, 4000, 'success');
      } else if (r.status === 'current') {
        toast('Already up to date.', 3000, 'info');
      } else if (r.status === 'behind') {
        toast(`Still behind (epoch ${r.after} of ${r.chainEpoch}). Trying again shortly.`, 5000, 'info');
      } else if (r.status === 'pruned') {
        toast('The updates this device missed are no longer stored. Reset the group and ask to be added back.', 8000, 'error');
      } else {
        toast(`Could not apply the update at epoch ${r.failedAt}. Reset the group and ask to be added back.`, 8000, 'error');
      }
    } catch (err) {
      toast(`Catch-up failed: ${err.message}`, 5000, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Catch up now';
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
      // Clipboard access can be refused (insecure origin, permissions). Select
      // the text so the user can copy it by hand rather than lose the link.
      const input = $('groupInviteLinkInput');
      input.focus();
      input.select();
      toast('Could not copy automatically — the link is selected, copy it manually.', 5000, 'info');
    }
  }

  /**
   * Join fees this admin has earned in the group.
   *
   * Split into collectable and still-vesting, because the difference is the
   * point: until a fee matures, removing that member returns it to them, so it
   * is not the admin's money yet.
   */
  async renderFees(visible) {
    const section = $('groupFeesSection');
    if (!section) return;
    if (!visible) {
      section.hidden = true;
      return;
    }
    let status;
    try {
      status = await groups.joinFeeStatus(this.groupId);
    } catch {
      section.hidden = true;
      return;
    }
    // Nothing earned and nothing charged: no reason to show the section at all.
    if (status.claimable === 0n && status.vesting === 0n) {
      section.hidden = true;
      return;
    }
    section.hidden = false;

    const parts = [];
    if (status.claimable > 0n) parts.push(`${formatLib(status.claimable)} LIB ready to collect`);
    if (status.vesting > 0n) {
      const when = status.nextVestingAt ? ` (first on ${new Date(status.nextVestingAt).toLocaleDateString()})` : '';
      parts.push(`${formatLib(status.vesting)} LIB still held${when}`);
    }
    $('groupFeesSummary').textContent = parts.join(' · ');
    $('groupFeesClaim').disabled = status.claimable === 0n;
    $('groupFeesClaim').textContent =
      status.claimable > 0n ? `Collect ${formatLib(status.claimable)} LIB` : 'Nothing to collect yet';
  }

  async claimFees() {
    const button = $('groupFeesClaim');
    button.disabled = true;
    button.textContent = 'Collecting…';
    try {
      await groups.claimJoinFees(this.groupId);
      this.render();
      toast('Join fees collected.', 4000, 'success');
    } catch (err) {
      toast(`Could not collect: ${err.message}`, 5000, 'error');
      button.disabled = false;
    }
  }

  async renderJoinRequests(visible) {
    const section = $('groupJoinRequestsSection');
    if (!section) return;
    if (!visible) {
      section.hidden = true;
      return;
    }
    let requests = [];
    try {
      requests = await groups.listJoinRequests(this.groupId);
    } catch {
      section.hidden = true;
      return;
    }
    // Hide the whole section when empty rather than showing an empty heading.
    section.hidden = requests.length === 0;
    if (requests.length === 0) return;

    this.requestsList.innerHTML = requests
      .map(
        (r) => `
        <li class="group-member-row">
          <span class="group-picker-avatar">${generateIdenticon(r.address, 28)}</span>
          <span class="group-picker-name">
            ${escapeHtml(displayName(r.address, this.groupId))}
            ${r.message ? `<span class="group-request-message">${escapeHtml(r.message)}</span>` : ''}
          </span>
          <button class="btn btn--tiny" data-approve="${r.address}">Approve</button>
        </li>`,
      )
      .join('');
  }

  async approve(address, button) {
    button.disabled = true;
    button.textContent = 'Approving…';
    try {
      await groups.approveJoinRequest(this.groupId, address);
      this.render();
      groupChatModal.render();
      toast('Member approved.', 3000, 'success');
    } catch (err) {
      toast(`Could not approve: ${err.message}`, 5000, 'error');
      button.disabled = false;
      button.textContent = 'Approve';
    }
  }

  async remove(address) {
    try {
      await groups.removeMembers(this.groupId, [address]);
      this.render();
      groupChatModal.render();
    } catch (err) {
      toast(`Could not remove: ${err.message}`, 5000, 'error');
    }
  }

  async reset() {
    const btn = $('groupResetButton');
    btn.disabled = true;
    try {
      await groups.resetGroupState(this.groupId);
      this.render();
      groupChatModal.render();
      toast('Group reset on this device. Ask a member to add you back.', 6000, 'info');
    } catch (err) {
      toast(`Could not reset: ${err.message}`, 5000, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async leave() {
    const wasRemoved = !!this.view()?.removed;
    try {
      await groups.leaveGroup(this.groupId);
      this.close();
      groupChatModal.close();
      deps.onChatListChanged && deps.onChatListChanged();
      toast(wasRemoved ? 'Group removed from this device' : 'You left the group', 3000, 'info');
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
