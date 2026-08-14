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
} from './lib.js';
import { hashBytes } from './crypto.js';

let deps = null;

export function initGroupUI(d) {
  deps = d;
  createGroupModal.load();
  groupChatModal.load();
  groupInfoModal.load();
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

    this.submit.disabled = true;
    this.submit.textContent = 'Creating…';
    try {
      const groupId = await groups.createGroup(name);

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

    this.title.textContent = view.name || 'Group';
    const count = view.members?.length || 0;
    this.subtitle.textContent = view.removed
      ? 'You are no longer a member'
      : `${count} member${count === 1 ? '' : 's'} · epoch ${view.epoch}`;
    this.avatar.innerHTML = generateIdenticon(this.groupId, 36);

    // Once removed, the keys have been rotated: nothing sent after the removing
    // commit is decryptable, and the network would reject our messages anyway.
    this.input.disabled = !!view.removed;
    this.sendButton.disabled = !!view.removed;
    this.input.placeholder = view.removed ? 'You can no longer send messages' : 'Type a message...';

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

    if (view.removed) {
      this.list.insertAdjacentHTML(
        'beforeend',
        buildSystemMessage('You were removed from this group. Messages sent after this are not visible to you.', 'system-warning'),
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

class GroupInfoModal {
  load() {
    this.modal = $('groupInfoModal');
    if (!this.modal) return;
    this.membersList = $('groupInfoMembers');
    this.picker = $('groupInfoPicker');

    $('closeGroupInfoModal').addEventListener('click', () => this.close());
    $('groupInfoAddButton').addEventListener('click', () => this.addSelected());

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
    this.membersList.innerHTML = (view.members || [])
      .map((address) => {
        const admin = (view.admins || []).includes(address);
        const isMe = address === myAddr();
        const canRemove = isAdmin && !isMe;
        return `
        <li class="group-member-row">
          <span class="group-picker-avatar">${generateIdenticon(address, 28)}</span>
          <span class="group-picker-name">${escapeHtml(displayName(address, this.groupId))}</span>
          ${admin ? '<span class="group-admin-badge">admin</span>' : ''}
          ${canRemove ? `<button class="btn btn--tiny" data-remove="${address}">Remove</button>` : ''}
        </li>`;
      })
      .join('');

    $('groupInfoAddSection').style.display = isAdmin ? '' : 'none';
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

  async remove(address) {
    try {
      await groups.removeMembers(this.groupId, [address]);
      this.render();
      groupChatModal.render();
    } catch (err) {
      toast(`Could not remove: ${err.message}`, 5000, 'error');
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
