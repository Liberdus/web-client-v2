// Check if there is a newer version and load that using a new random url to avoid cache hits
//   Versions should be YYYY.MM.DD.HH.mm like 2025.01.25.10.05
const version = 't'; // Also increment this when you increment version.html
let myVersion = '0';
async function checkVersion() {
  // Use network-specific version key to avoid false update alerts when switching networks
  const versionKey = network?.netid ? `version_${network.netid}` : 'version';
  myVersion = localStorage.getItem(versionKey) || '0';
  let newVersion;
  try {
    const response = await fetch(`version.html`, {cache: 'reload', headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    }});
    if (!response.ok) throw new Error('Version check failed');
    newVersion = await response.text();
  } catch (error) {
    console.error('Version check failed:', error);
    showToast('Version check failed. Your Internet connection may be down.', 0, 'error');
    // Only trigger offline UI if it's a network error
    if (!navigator.onLine || error instanceof TypeError) {
      isOnline = false;
      updateUIForConnectivity();
    }
    newVersion = myVersion; // Allow continuing with the old version
  }
  //console.log('myVersion < newVersion then reload', myVersion, newVersion)
  console.log(parseInt(myVersion.replace(/\D/g, '')), parseInt(newVersion.replace(/\D/g, '')));
  if (parseInt(myVersion.replace(/\D/g, '')) != parseInt(newVersion.replace(/\D/g, ''))) {
    alert('Updating to new version: ' + newVersion + ' ' + version);
    localStorage.setItem(versionKey, newVersion); // Save new version with network-specific key
    const newUrl = window.location.href.split('?')[0];

    logsModal.log(`Updated to version: ${newVersion}`)
    await forceReload([
      newUrl,
      'styles.css',
      'app.js',
      'dao.repo.js',
      'dao.mock-data.js',
      'lib.js',
      'network.js',
      'crypto.js',
      'encryption.worker.js',
      'offline.html',
      'meet/index.html',
    ]);
    window.location.replace(newUrl);
  }
  logsModal.log(`Started version: ${myVersion}`)
}

async function forceReload(urls) {
  try {
    // Fetch with cache-busting headers
    const fetchPromises = urls.map((url) =>
      fetch(url, {
        cache: 'reload',  // this bypasses the cache to get from the server and updates the cache
        headers: {        // this bypasses the cache of any proxies between the client and the server
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })
    );
    const results = await Promise.all(fetchPromises);
    return results;
  } catch (error) {
    console.error('Force reload failed:', error);
    throw error;
  }
}

// https://github.com/shardus/lib-crypto-web/blob/main/utils/stringify.js
// Needed to stringify and parse bigints; also deterministic stringify
//   modified to use export
import { stringify, parse } from './external/stringify-shardus.js';

import {
  daoRepo,
  DAO_STATES,
  getDaoStateLabel,
  getDaoTypeLabel,
  getEffectiveDaoState,
} from './dao.repo.js';

// Import crypto functions from crypto.js
import {
  encryptChacha,
  encryptData,
  decryptData,
  decryptMessage,
  ethHashMessage,
  hashBytes,
  generateRandomPrivateKey,
  getPublicKey,
  signMessage,
  generatePQKeys,
  generateRandomBytes,
  generateAddress,
  passwordToKey,
  dhkeyCombined,
  decryptChacha,
  generateUUIDv4,
} from './crypto.js';

// Put standalone conversion function in lib.js
import {
  normalizeUsername,
  normalizeName,
  normalizePhone,
  normalizeEmail,
  normalizeLinkedinUsername,
  normalizeXTwitterUsername,
  generateIdenticon,
  formatTime,
  isValidEthereumAddress,
  normalizeAddress,
  longAddress,
  utf82bin,
  bin2utf8,
  bigxnum2big,
  big2str,
  bin2base64,
  base642bin,
  hex2bin,
  bin2hex,
  linkifyUrls,
  escapeHtml,
  debounce,
  truncateMessage,
  normalizeUnsignedFloat,
  EthNum,
} from './lib.js';

const weiDigits = 18;
const wei = 10n ** BigInt(weiDigits);
//network.monitor.url = "http://test.liberdus.com:3000"    // URL of the monitor server
//network.explorer.url = "http://test.liberdus.com:6001"   // URL of the chain explorer
const MAX_MEMO_BYTES = 1000; // 1000 bytes for memos
const MAX_CHAT_MESSAGE_BYTES = 1000; // 1000 bytes for chat messages
const BRIDGE_USERNAME = 'liberdusbridge';

let myData = null;
let myAccount = null; // this is set to myData.account for convience
let timeSkew = 0;
let useLongPolling = true;
let longPollTimeoutId = null;
let isLongPolling = false;
let longPollAbortController = null;

let checkPendingTransactionsIntervalId = null;
let getSystemNoticeIntervalId = null;
//let checkConnectivityIntervalId = null;

let initialViewportHeight = window.innerHeight;

// parameters to add to the call URL when opening the page
const callUrlParams = `#config.toolbarButtons=["camera","microphone","desktop","hangup"]&config.disableDeepLinking=true&config.prejoinPageEnabled=false&config.startWithAudioMuted=false&startWithVideoMuted=false&userInfo.displayName=`

// Used in getNetworkParams function
const NETWORK_ACCOUNT_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const NETWORK_ACCOUNT_ID = '0'.repeat(64);
const MAX_TOLL = 1_000_000; // 1M limit

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minute limit for editing messages

let parameters = {
  current: {
    transactionFee: 1n * wei,
  },
};

/**
 * Check if a username is available or taken
 * @param {*} username 
 * @param {*} address 
 * @param {*} foundAddressObject 
 * @returns 'mine' if the username is taken and the address matches,
 *          'taken' if the username is taken and address does not match,
 *          'available' if the username is available,
 *          'error' if there is an error
 */
async function checkUsernameAvailability(username, address, foundAddressObject) {
  if (foundAddressObject) {
    foundAddressObject.address = null;
  }
  // First check if we're offline
  if (!isOnline) {
    // When offline, check local storage only
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];

    // If we have this username locally and the address matches
    if (
      netidAccounts?.usernames &&
      netidAccounts.usernames[username] &&
      normalizeAddress(netidAccounts.usernames[username].address) === normalizeAddress(address)
    ) {
      return 'mine';
    }

    // If we have the username but address doesn't match
    if (netidAccounts?.usernames && netidAccounts.usernames[username]) {
      if (foundAddressObject) {
        foundAddressObject.address = netidAccounts.usernames[username].address;
      }
      return 'taken';
    }

    // Username not found locally
    return 'available';
  }

  // Online flow - existing implementation
  const selectedGateway = getGatewayForRequest();
  if (!selectedGateway) {
    console.error('No gateway available for username check');
    return 'error';
  }

  const usernameBytes = utf82bin(normalizeUsername(username));
  const usernameHash = hashBytes(usernameBytes);
  try {
    const response = await fetch(`${selectedGateway.web}/address/${usernameHash}`);
    const data = await response.json();
    if (data && data.address) {
      if (address && normalizeAddress(data.address) === normalizeAddress(address)) {
        return 'mine';
      }
      if (foundAddressObject) {
        foundAddressObject.address = data.address;
      }
      return 'taken';
    }
    if (!data) {
      return 'error';
    }
    // log username and response to logs modal for debugging
    logsModal.log(`Checked username returned available: ${username}, response: ${JSON.stringify(data)}`);
    return 'available';
  } catch (error) {
    console.error('Error checking username:', error);
    return 'error2';
  }
}

function newDataRecord(myAccount) {

  const myData = {
    timestamp: getCorrectedTimestamp(),
    account: myAccount,
    network: {
      gateways: [],
      defaultGatewayIndex: -1, // -1 means use random selection
    },
    contacts: {},
    chats: [],
    wallet: {
      networth: 0.0,
      timestamp: 0, // last balance update timestamp
      priceTimestamp: 0, // last time when prices were updated
      assets: [
        {
          id: 'liberdus',
          name: 'Liberdus',
          symbol: 'LIB',
          img: 'images/lib.png',
          chainid: 2220,
          contract: '041e48a5b11c29fdbd92498eb05573c52728398c',
          price: 1.0,
          balance: 0n,
          networth: 0.0,
          addresses: [
            {
              address: myAccount.keys.address,
              balance: 0n,
            },
          ],
        },
      ],
      history: [],
    },
    pending: [], // Array to track pending transactions
    state: {
      unread: 0,
    },
    settings: {
      encrypt: true,
      toll: EthNum.toWei(parameters?.current?.defaultTollUsdStr) || 1n * wei,
      tollUnit: 'USD',
      noticets: 0,
    },
  };

  return myData;
}

/**
 * Clear myData and myAccount variables
 * This function centralizes the clearing of user data to ensure consistency
 */
function clearMyData() {
  myData = null;
  myAccount = null;
}

/**
 * One-time migration: convert legacy friend status (3) to connection (2)
 * @param {Object} data
 * @returns {boolean} True if migration flag was applied
 */
function migrateFriendStatusToConnection(data) {
  if (!data?.account) return false;

  const migrations =
    data.account.migrations && typeof data.account.migrations === 'object'
      ? data.account.migrations
      : null;

  if (migrations?.friendStatusToConnection === true) {
    return false;
  }

  if (data.contacts && typeof data.contacts === 'object') {
    for (const contact of Object.values(data.contacts)) {
      if (!contact || typeof contact !== 'object') continue;
      if (contact.friend === 3) {
        contact.friend = 2;
      }
      if (contact.friendOld === 3) {
        contact.friendOld = 2;
      }
    }
  }

  data.account.migrations = migrations && typeof migrations === 'object' ? migrations : {};
  data.account.migrations.friendStatusToConnection = true;
  return true;
}

/**
 * One-time migration: extract DH-derived encryption keys to random encKey field
 * This decouples attachment encryption from recipient keys for easier sharing
 * @param {Object} data
 * @returns {Promise<boolean>} True if migration flag was applied
 */
async function migrateAttachmentKeysToEncKey(data) {
  if (!data?.account) return false;

  const migrations =
    data.account.migrations && typeof data.account.migrations === 'object'
      ? data.account.migrations
      : null;

  if (migrations?.attachmentKeysToEncKey === true) {
    return false;
  }

  if (data.contacts && typeof data.contacts === 'object') {
    for (const [address, contact] of Object.entries(data.contacts)) {
      if (!contact || typeof contact !== 'object') continue;
      if (!Array.isArray(contact.messages)) continue;

      for (const message of contact.messages) {
        if (!message || typeof message !== 'object') continue;
        if (!Array.isArray(message.xattach)) continue;

        for (const attachment of message.xattach) {
          if (!attachment || typeof attachment !== 'object') continue;
          
          // Skip if already has encKey
          if (attachment.encKey) continue;

          let dhkey;
          
          if (message.my) {
            // Sent message: decrypt selfKey to get dhkey
            if (!attachment.selfKey) continue;
            try {
              const password = data.account.keys.secret + data.account.keys.pqSeed;
              dhkey = hex2bin(decryptData(attachment.selfKey, password, true));
            } catch (e) {
              console.warn('Failed to decrypt attachment selfKey during migration:', e);
              continue;
            }
          } else {
            // Received message: decrypt pqEncSharedKey to get dhkey
            if (!attachment.pqEncSharedKey) continue;
            try {
              // Ensure contact keys are available
              await ensureContactKeys(address);
              const senderPublicKey = data.contacts[address]?.public;
              if (!senderPublicKey) {
                console.warn('No public key found for sender during migration:', address);
                continue;
              }
              
              const pqCipher = (typeof attachment.pqEncSharedKey === 'string') 
                ? base642bin(attachment.pqEncSharedKey) 
                : attachment.pqEncSharedKey;
              
              dhkey = dhkeyCombined(
                data.account.keys.secret,
                senderPublicKey,
                data.account.keys.pqSeed,
                pqCipher
              ).dhkey;
            } catch (e) {
              console.warn('Failed to decrypt attachment pqEncSharedKey during migration:', e);
              continue;
            }
          }

          // Store the dhkey as encKey
          if (dhkey) {
            attachment.encKey = bin2base64(dhkey);
          }
        }
      }
    }
  }

  data.account.migrations = migrations && typeof migrations === 'object' ? migrations : {};
  data.account.migrations.attachmentKeysToEncKey = true;
  return true;
}

/**
 * Checks if the current account is private
 * @returns {boolean} True if the account is private, false otherwise
 */
function isPrivateAccount() {
  return myAccount?.private === true || myData?.account?.private === true;
}

// Load saved account data and update chat list on page load
document.addEventListener('DOMContentLoaded', async () => {
  markConnectivityDependentElements();
  await checkVersion(); // version needs to be checked before anything else happens
  timeDifference(); // Calculate and log time difference early

  setupConnectivityDetection();

  // React Native App
  reactNativeApp.load();

  // Unlock Modal
  unlockModal.load();

  // Sign In Modal
  signInModal.load();
  
  // My Info Modal
  myInfoModal.load();

  // Welcome Screen
  welcomeScreen.load()

  // Welcome Menu Modal
  welcomeMenuModal.load();

  // Footer
  footer.load();

  // Header
  header.load();

  // Chats Screen
  chatsScreen.load();

  // Contacts Screen
  contactsScreen.load();

  // Wallet Screen
  walletScreen.load();

  // About and Contact Modals
  sourceModal.load();
  aboutModal.load();
  updateWarningModal.load();
  helpModal.load();
  farmModal.load();
  logsModal.load();

  // Create Account Modal
  createAccountModal.load();

  // Account Form Modal
  myProfileModal.load();

  restoreAccountModal.load();

  // Validator Modals
  validatorStakingModal.load();

  // Toll Modal
  tollModal.load();

  // Stake Modal
  stakeValidatorModal.load();

  // Backup Form Modal
  backupAccountModal.load();

  // Remove Account Modal
  removeAccountModal.load();

  // Invite Modal
  inviteModal.load();

  // Chat Modal
  chatModal.load();

  // Contact Info Modal
  contactInfoModal.load();

  // Failed Message Modal
  failedMessageMenu.load();

  // New Chat Modal
  newChatModal.load();

  // Send Asset Modal
  sendAssetFormModal.load();

  // Send Asset Confirm Modal
  sendAssetConfirmModal.load();

  // Receive Modal
  receiveModal.load();

  // Edit Contact Modal
  editContactModal.load();

  // Scan QR Modal
  scanQRModal.load();

  // Search Messages Modal
  searchMessagesModal.load();

  // Contact Search Modal
  searchContactsModal.load();

  // History Modal
  historyModal.load();

  // Menu Modal
  menuModal.load();

  // DAO Modals
  daoModal.load();
  addProposalModal.load();
  proposalInfoModal.load();

  // Settings Modal
  settingsModal.load();

  // Manage Contacts Modal
  manageContactsModal.load();

  // Secret Modal
  secretModal.load();

  // Failed Transaction Modal
  failedTransactionModal.load();

  // Calls Modal
  callsModal.load();

  // Group Call Participants Modal
  groupCallParticipantsModal.load();
  
  // Friend Modal
  friendModal.load();

  // Bridge Modal
  bridgeModal.load();

  // Migrate Accounts Modal
  migrateAccountsModal.load();

  // Lock Modal
  lockModal.load();

  // Launch Modal
  launchModal.load();

  // LocalStorage Monitor
  localStorageMonitor.load();

  // Avatar Edit Modal
  avatarEditModal.load();

  // Contact Avatar Cache
  contactAvatarCache.load();

  // Thumbnail Cache
  thumbnailCache.load();

  // Voice Recording Modal
  voiceRecordingModal.load();

  // Call Invite Modal
  callInviteModal.load();

  // Share Attachment Modal
  shareAttachmentModal.load();

  // Share Contacts Modal
  shareContactsModal.load();

  // Import Contacts Modal
  importContactsModal.load();

  // Call Schedule Modals
  callScheduleChoiceModal.load();
  callScheduleDateModal.load();

  // Remove Accounts Modal
  removeAccountsModal.load();

  // add event listener for back-button presses to prevent shift+tab
  document.querySelectorAll('.back-button').forEach((button) => {
    button.addEventListener('keydown', ignoreShiftTabKey);
  });
  // add event listener for last-item to prevent tab
  document.querySelectorAll('.last-item').forEach((item) => {
    item.addEventListener('keydown', ignoreTabKey);
  });

  document.addEventListener('visibilitychange', handleVisibilityChange); // Keep as document

  // Add global keyboard listener for fullscreen toggling
  window.addEventListener('resize', () => setTimeout(handleKeyboardFullscreenToggle(), 300));

  getNetworkParams();

  welcomeScreen.lastItem.focus();
});

// Add unload handler to save myData
function handleBeforeUnload(e) {
  reactNativeApp.handleNativeAppSubscribe();
  if (menuModal.isSignoutExit){
    return;
  }
  if (myData){
    e.preventDefault();
    saveState();    // This save might not work if the amount of data to save is large and user quickly clicks on Leave button
  }
}

// This is for installed apps where we can't stop the back button; just save the state
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    reactNativeApp.handleNativeAppSubscribe();
    if (reactNativeApp.isReactNativeWebView) {
      useLongPolling = false;
    }
    // if chatModal was opened, save the last message count
    if (chatModal.isActive() && chatModal.address) {
      const contact = myData.contacts[chatModal.address];
      // Take a one-time snapshot for this hidden session; don't overwrite if more background events fire
      if (chatModal.lastMessageCount === null) {
        chatModal.lastMessageCount = contact?.messages?.length || 0;
      }
    }
    // save state when app is put into background
    saveState();
  } else if (document.visibilityState === 'visible') {
    if (myAccount) {
      reactNativeApp.handleNativeAppUnsubscribe();
    }
    if (reactNativeApp.isReactNativeWebView) {
      useLongPolling = true;
      setTimeout(longPoll, 10);
    }
    // if chatModal was opened, check if message count changed while hidden
    if (chatModal.isActive() && chatModal.address) {
      const contact = myData.contacts[chatModal.address];
      const currentCount = contact?.messages?.length || 0;
      if (chatModal.lastMessageCount !== null && currentCount !== chatModal.lastMessageCount) {
        chatModal.appendChatModal(true);
      }
      // Clear lastMessageCount at the end of a hidden session
      chatModal.lastMessageCount = null;
    }
    // send message `GetAllPanelNotifications` to React Native when app is brought back to foreground
    if (window?.ReactNativeWebView) {
      reactNativeApp.fetchAllPanelNotifications();
    }
  }
}

async function encryptAllAccounts(oldPassword, newPassword) {
  const oldEncKey = !oldPassword ? null : await passwordToKey(oldPassword+'liberdusData');
  const newEncKey = !newPassword ? null : await passwordToKey(newPassword+'liberdusData');
  // Get all accounts from localStorage
  const accountsObj = parse(localStorage.getItem('accounts') || 'null');
  if (!accountsObj?.netids) return;

  for (const netid in accountsObj.netids) {
    const usernamesObj = accountsObj.netids[netid]?.usernames;
    if (!usernamesObj) continue;
    for (const username in usernamesObj) {
      const key = `${username}_${netid}`;
      let data = localStorage.getItem(key);
      if (!data) continue;

      // If oldEncKey is set, decrypt; otherwise, treat as plaintext
      if (oldEncKey) {
        try {
          data = decryptData(data, oldEncKey, true);
        } catch (e) {
          console.error(`Failed to decrypt data for ${key}:`, e);
          continue;
        }
      }

      let newData = data;

      // If newEncKey is set, encrypt; otherwise, store as plaintext
      if (newEncKey) {
        try {
          newData = encryptData(newData, newEncKey, true);
        } catch (e) {
          console.error(`Failed to encrypt data for ${key}:`, e);
          continue;
        }
      }

      // Save to localStorage (encrypted version uses _ suffix)
      localStorage.setItem(`${key}`, newData);
    }
  }
}

function saveState() {
  if (myData && myAccount && myAccount.username && myAccount.netid) {
    let data = stringify(myData)
    if (localStorage.lock && lockModal.encKey){  // Consider what happens if localStorage.lock was manually deleted
      data = encryptData(data, lockModal.encKey, true)
    }
    localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, data);
  }
}

function loadState(account, noparse=false){
  let data = localStorage.getItem(account);
  if (!data) { return null; }
  if (localStorage.lock && lockModal.encKey) {
    data = decryptData(data, lockModal.encKey, true)
  }
  if (noparse) return data;
  return parse(data);
}

function checkFirstTimeTip(tipName) {
  if (!myData?.account) return false;
  if (typeof tipName !== 'string' || !tipName) return false;
  const existing = myData.account.firstTimeTips;
  if (!existing || typeof existing !== 'object') return false;
  return existing[tipName] === true;
}

function setFirstTimeTipShown(tipName) {
  if (!myData?.account) return;
  if (typeof tipName !== 'string' || !tipName) return;
  const existing = myData.account.firstTimeTips;
  myData.account.firstTimeTips = existing && typeof existing === 'object' ? existing : {};
  myData.account.firstTimeTips[tipName] = true;
  saveState();
}

class WelcomeScreen {
  constructor() {}

  load() {
    this.screen = document.getElementById('welcomeScreen');
    this.signInButton = document.getElementById('signInButton');
    this.createAccountButton = document.getElementById('createAccountButton');
    this.openWelcomeMenuButton = document.getElementById('openWelcomeMenu');
    this.welcomeButtons = document.querySelector('.welcome-buttons');
    this.logoLink = this.screen.querySelector('.logo-link');
    this.logoLink.addEventListener('keydown', ignoreShiftTabKey);  // add event listener for first-item to prevent shift+tab
    this.versionDisplay = document.getElementById('versionDisplay');
    this.networkNameDisplay = document.getElementById('networkNameDisplay');
    this.lastItem = document.getElementById('welcomeScreenLastItem');
    this.appVersionDisplay = document.getElementById('appVersionDisplay');
    this.appVersionText = document.getElementById('appVersionText');
    
    
    this.versionDisplay.textContent = myVersion + ' ' + version;
    this.networkNameDisplay.textContent = network.name;

    if (reactNativeApp?.appVersion) {
      this.updateAppVersionDisplay(reactNativeApp.appVersion);
    }
    
    this.signInButton.addEventListener('click', () => {
      if (localStorage.lock && unlockModal.isLocked()) {
        unlockModal.openButtonElementUsed = this.signInButton;
        unlockModal.open();
      } else {
        signInModal.open();
      }
    });
    this.createAccountButton.addEventListener('click', () => {
      if (localStorage.lock && unlockModal.isLocked()) {
        unlockModal.openButtonElementUsed = this.createAccountButton;
        unlockModal.open();
      } else {
        createAccountModal.openWithReset();
      }
    });
    this.openWelcomeMenuButton.addEventListener('click', () => {
      welcomeMenuModal.open();
    });

    this.orderButtons();

    // Show Apple Safari backup reminder toast after welcome screen has rendered
    setTimeout(() => {
      this.showAppleSafariBackupToast();
      this.showGDriveBackupReminder();
    }, 500);
  }

  open() {
    this.screen.style.display = 'flex';
    // Show the navigation bar on the native app
    reactNativeApp.sendNavigationBarVisibility(true);
  }

  close() {
    this.screen.style.display = 'none';
  }

  /**
   * Detect if user is on Apple device using Safari browser
   */
  isAppleSafari() {
    const userAgent = navigator.userAgent;
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
    const isAppleDevice = /iPhone|iPad|iPod|Macintosh/.test(userAgent);
    const result = isSafari && isAppleDevice;
    
    return result;
  }

  /**
   * Show backup reminder toast for Apple Safari users
   */
  showAppleSafariBackupToast() {
    // Only show if user is on Apple Safari
    if (!this.isAppleSafari()) {
      return;
    }

    // Show the toast
    const message = '<strong>Important:</strong> Apple will delete your data if you don\'t visit this site for a week. Please backup your account data regularly.';
    showToast(message, 0, 'warning', true);
  }

  /**
   * Show Google Drive backup reminder toast when overdue and not recently reminded.
   */
  showGDriveBackupReminder() {
    // Don't show reminder if user has no accounts to back up
    const { usernames } = signInModal.getSignInUsernames() || { usernames: [] };
    if (!usernames?.length) {
      return;
    }

    const now = getCorrectedTimestamp();
    const lastBackup = backupAccountModal.getGDriveBackupTs();
    const lastReminder = backupAccountModal.getGDriveReminderTs();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    if (now - lastBackup <= sevenDaysMs) {
      return;
    }

    if (now - lastReminder <= threeDaysMs) {
      return;
    }

    const message = 'Click "Menu" and "Backup" to Google drive. You can restore if anything happens to this device.';
    showToast(message, 0, 'warning');
    backupAccountModal.setGDriveReminderTs(now);
  }

  isActive() {
    return this.screen.style.display === 'flex';
  }

  orderButtons() {
    // Check for existing accounts and arrange welcome buttons
    const { usernames } = signInModal.getSignInUsernames() || { usernames: [] };
    const hasAccounts = usernames?.length > 0;
    // Reorder buttons based on accounts existence
    if (hasAccounts) {
      this.welcomeButtons.innerHTML = ''; // Clear existing order
      this.signInButton.classList.remove('hidden');
      this.createAccountButton.classList.remove('hidden');
      this.openWelcomeMenuButton.classList.remove('hidden');
      this.welcomeButtons.appendChild(this.signInButton);
      this.welcomeButtons.appendChild(this.createAccountButton);
      this.welcomeButtons.appendChild(this.openWelcomeMenuButton);
      this.signInButton.classList.add('btn--primary');
      this.signInButton.classList.remove('btn--secondary');
      this.createAccountButton.classList.remove('btn--primary');
      this.createAccountButton.classList.add('btn--secondary');
    } else {
      this.welcomeButtons.innerHTML = ''; // Clear existing order
      this.createAccountButton.classList.remove('hidden');
      this.openWelcomeMenuButton.classList.remove('hidden');
      this.welcomeButtons.appendChild(this.createAccountButton);
      this.welcomeButtons.appendChild(this.openWelcomeMenuButton);
      this.createAccountButton.classList.remove('btn--secondary');
      this.createAccountButton.classList.add('btn--primary')
    }
  }

  updateAppVersionDisplay(appVersion) {
    if (appVersion) {
      this.appVersionText.textContent = appVersion;
      this.appVersionDisplay.classList.remove('hidden');
    }
  }
}

const welcomeScreen = new WelcomeScreen();

class WelcomeMenuModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('welcomeMenuModal');
    this.closeButton = document.getElementById('closeWelcomeMenu');
    this.closeButton.addEventListener('click', () => this.close());

    this.backupButton = document.getElementById('welcomeOpenBackup');
    this.restoreButton = document.getElementById('welcomeOpenRestore');
    this.removeButton = document.getElementById('welcomeOpenRemove');
    this.migrateButton = document.getElementById('welcomeOpenMigrate');
    this.aboutButton = document.getElementById('welcomeOpenAbout');
    this.launchButton = document.getElementById('welcomeOpenLaunch');
    this.lockButton = document.getElementById('welcomeOpenLockModal');
    this.updateButton = document.getElementById('welcomeOpenUpdate');
    this.helpButton = document.getElementById('welcomeOpenHelp');

    this.backupButton.addEventListener('click', () => backupAccountModal.open());
    this.restoreButton.addEventListener('click', () => restoreAccountModal.open());
    this.removeButton.addEventListener('click', () => removeAccountsModal.open());
    this.migrateButton.addEventListener('click', () => migrateAccountsModal.open());
    this.aboutButton.addEventListener('click', () => aboutModal.open());
    this.lockButton.addEventListener('click', () => lockModal.open());
    this.helpButton.addEventListener('click', () => helpModal.open());

    // Show launch button if ReactNativeWebView is available
    if (window?.ReactNativeWebView) {
      this.launchButton.addEventListener('click', () => launchModal.open());
      this.launchButton.style.display = 'block';
      this.updateButton.addEventListener('click', () => aboutModal.openStore());
      this.updateButton.style.display = 'block';
    }
  }

  open() {
    if (localStorage.lock && unlockModal.isLocked()) {
      unlockModal.openButtonElementUsed = welcomeScreen.openWelcomeMenuButton;
      unlockModal.open();
    } else {
      this.modal.classList.add('active');
      enterFullscreen();
    }
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

const welcomeMenuModal = new WelcomeMenuModal();

class Header {
  constructor() {}

  load() {
    this.header = document.getElementById('header');
    this.text = this.header.querySelector('.app-name');
    this.avatarContainer = this.header.querySelector('.app-name-avatar');
    this.nameContainer = this.header.querySelector('.app-name-container');
    this.logoLink = this.header.querySelector('.logo-link');
    this.menuButton = document.getElementById('toggleMenu');
    this.settingsButton = document.getElementById('toggleSettings');
    this.upcomingCallsBtn = document.getElementById('upcomingCallsBtn');

    this.logoLink.addEventListener('keydown', ignoreShiftTabKey); // add event listener for first-item to prevent shift+tab
    this.menuButton.addEventListener('click', () => menuModal.open());
    this.settingsButton.addEventListener('click', () => settingsModal.open());
    this.upcomingCallsBtn.addEventListener('click', () => callsModal.open());
    
    // Add click event for whole name container
    this.nameContainer.addEventListener('click', () => {
      if (myData && myData.account) {
        myInfoModal.open();
      }
    });
  }

  open() {
    this.header.classList.add('active');
  }

  close() {
    this.header.classList.remove('active');
  }

  isActive() {
    return this.header.classList.contains('active');
  }

  setText(newText) {
    this.text.textContent = newText;
  }

  /**
   * Updates the header avatar for the current user
   */
  async updateAvatar() {
    try {
      const avatarHtml = await getContactAvatarHtml(
        {
          address: myAccount.keys.address,
          hasAvatar: myData?.account?.hasAvatar,
          avatarId: myData?.account?.avatarId,
        },
        28 // Small size for header
      );
      this.avatarContainer.innerHTML = avatarHtml;
    } catch (e) {
      console.warn('Failed to update header avatar:', e);
    }
  }

  /**
   * Updates the upcoming calls icon visibility and glow state
   */
  updateCallsIcon() {
    if (!this.upcomingCallsBtn) return;
    
    const hasUpcoming = callsModal.hasUpcomingCalls();
    const hasImminent = callsModal.hasImminentCalls();
    
    // Show/hide icon based on upcoming calls
    this.upcomingCallsBtn.style.display = hasUpcoming ? '' : 'none';
    
    // Add/remove glow class based on imminent calls
    if (hasImminent) {
      this.upcomingCallsBtn.classList.add('upcoming-calls-glow');
    } else {
      this.upcomingCallsBtn.classList.remove('upcoming-calls-glow');
    }
  }

}

const header = new Header();

class Footer {
  constructor() {
    // No DOM dependencies in constructor
  }

  load() {
    // DOM elements - only accessed when DOM is ready
    this.footer = document.getElementById('footer');
    this.chatButton = document.getElementById('switchToChats');
    this.contactsButton = document.getElementById('switchToContacts');
    this.walletButton = document.getElementById('switchToWallet');
    this.newChatButton = document.getElementById('newChatButton');
    this.lastItem = this.footer.querySelector('.last-item');

    this.newChatButton.addEventListener('click', () => newChatModal.openNewChatModal());
    this.chatButton.addEventListener('click', () => this.switchView('chats'));
    this.contactsButton.addEventListener('click', () => this.switchView('contacts'));
    this.walletButton.addEventListener('click', () => this.switchView('wallet'));
  }

  open() {
    this.footer.classList.add('active');
  }

  close() {
    this.footer.classList.remove('active');
  }

  openNewChatButton() {
    this.newChatButton.classList.add('visible');
  }

  closeNewChatButton() {
    this.newChatButton.classList.remove('visible');
  }

  async switchView(view) {
    // Store the current view for potential rollback
    const previousView = document.querySelector('.app-screen.active')?.id?.replace('Screen', '') || 'chats';
    const previousButton = document.querySelector('.nav-button.active');
  
    try {
      // Hide all screens
      chatsScreen.close();
      contactsScreen.close();
      walletScreen.close();
  
      // Update nav buttons - remove active class from all
      this.chatButton.classList.remove('active');
      this.contactsButton.classList.remove('active');
      this.walletButton.classList.remove('active');
  
      // Add active class to selected button and add active or use .open() for relevant screen
      if (view === 'chats') {
        chatsScreen.open();
        this.chatButton.classList.add('active');
      } else if (view === 'contacts') {
        contactsScreen.open();
        this.contactsButton.classList.add('active');
      } else if (view === 'wallet') {
        walletScreen.open();
        this.walletButton.classList.add('active');
      }
  
      // Show header and footer
      header.open();
      footer.open();
  
      // Update header with username if signed in
      const appName = document.querySelector('.app-name');
      if (myAccount && myAccount.username) {
        const accountIsPrivate = isPrivateAccount();
        appName.textContent = `${myAccount.username}`;
        appName.classList.toggle('is-private', accountIsPrivate);
        // Update avatar
        await header.updateAvatar();
      } else {
        appName.textContent = '';
        appName.classList.remove('is-private');
        // Clear avatar when not signed in
        if (header.avatarContainer) {
          header.avatarContainer.innerHTML = '';
        }
      }
  
      // Show/hide new chat button
      if (view === 'chats' || view === 'contacts') {
        this.openNewChatButton();
      } else {
        this.closeNewChatButton();
      }
  
      // Update lists when switching views
      if (view === 'chats') {
        this.chatButton.classList.remove('has-notification');
        chatsScreen.updateChatList();
  
        // focus onto last-item in the footer
        if (footer.lastItem) {
          footer.lastItem.focus();
        }
      } else if (view === 'contacts') {
        await contactsScreen.updateContactsList();
      } else if (view === 'wallet') {
        this.walletButton.classList.remove('has-notification');
        await walletScreen.updateWalletView();
        
        // Update last viewed timestamp so we know user has seen the wallet
        if (myData?.wallet) {
          myData.wallet.lastWalletViewTimestamp = getCorrectedTimestamp();
        }
      }
    } catch (error) {
      console.error(`Error switching to ${view} view:`, error);
  
      // Restore previous view if there was an error
      if (previousView && previousButton) {

        // Hide all screens with direct references
        chatsScreen.close();
        contactsScreen.close();
        walletScreen.close();
  
        // Show previous screen
        const previousScreenElement = document.getElementById(`${previousView}Screen`);
        if (previousScreenElement) {
          previousScreenElement.classList.add('active');
        }
  
        // Remove active class from all buttons with direct references
        this.chatButton.classList.remove('active');
        this.contactsButton.classList.remove('active');
        this.walletButton.classList.remove('active');
  
        // Add active to the correct button based on previousView
        if (previousView === 'chats') {
          this.chatButton.classList.add('active');
        } else if (previousView === 'contacts') {
          this.contactsButton.classList.add('active');
        } else if (previousView === 'wallet') {
          this.walletButton.classList.add('active');
        } else {
          // Fallback if previousButton is available
          previousButton.classList.add('active');
        }
  
        // Display error toast to user
        showToast(`Failed to switch to ${view} view`, 0, 'error');
      }
    }
  }
}

const footer = new Footer();

class ChatsScreen {
  constructor() {

  }

  load() {
    this.screen = document.getElementById('chatsScreen');
    this.chatList = document.getElementById('chatList');
    this.searchBarContainer = document.getElementById('searchBarContainer');
    this.searchInput = document.getElementById('searchInput');

    // Handle search input click that's on the chatsScreen
    this.searchInput.addEventListener('click', () => {
      searchMessagesModal.open();
    });
  }

  open() {
    this.screen.classList.add('active');
  }

  close() {
    this.screen.classList.remove('active');
  }

  isActive() {
    return this.screen.classList.contains('active');
  }

  /**
 * Update the chat list by fetching the latest chats from the server
 * @returns {Promise<number>} The number of chats fetched
 */
  async updateChatData() {
    let gotChats = 0;
    if (myAccount && myAccount.keys) {
      try {
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            gotChats = await getChats(myAccount.keys);
            if (gotChats > 0) {
              saveState();
            }
            break; // Success, exit the retry loop
          } catch (networkError) {
            retryCount++;
            if (retryCount > maxRetries) {
              throw networkError; // Rethrow if max retries reached
            }
            console.log(`Retry ${retryCount}/${maxRetries} for chat update...${Date.now()}`);
            await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // Increasing backoff
          }
        }
      } catch (error) {
        console.error('Error updating chat list:', error);
      }
    }
    return gotChats;
  }

  // Update chat list UI
  async updateChatList() {
    const chatList = this.chatList;
    const contacts = myData.contacts;
    const chats = myData.chats;
    const emptyStateEl = chatList.querySelector('.empty-state');
    
    // Save scroll position before DOM manipulation to preserve user's scroll position
    const scrollContainer = this.screen;
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
    // Remove existing rendered chat items without destroying the built-in empty state node
    chatList.querySelectorAll('li.chat-item').forEach((el) => el.remove());

    if (!Array.isArray(chats) || chats.length === 0) {
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      return;
    }

    if (emptyStateEl) emptyStateEl.style.display = 'none';

    const chatItems = [];
    for (const chat of chats) {
      if (isFaucetAddress(chat.address)) {
        continue;
      }
      
      const contact = contacts[chat.address];
      if (!contact) continue;
      // In chat list don't show people that are blocked
      if (Number(contact?.friend) === 0) continue;

      const latestActivity = contact.messages && contact.messages.length > 0 ? contact.messages[0] : null;
      // If there's no latest activity (no messages), skip this chat item
      if (!latestActivity) continue;

      chatItems.push({ chat, contact, latestActivity });
    }

    // If everything was filtered out (e.g. all chats are blocked), show empty state
    if (chatItems.length === 0) {
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      return;
    }

    const avatarHtmlList = await Promise.all(
      chatItems.map(({ contact }) => getContactAvatarHtml(contact))
    );

    chatItems.forEach(({ chat, contact, latestActivity }, index) => {
      const avatarHtml = avatarHtmlList[index];
      const latestItemTimestamp = latestActivity.timestamp;
      const contactName = getContactDisplayName(contact);

      let previewHTML = '';
      // Check if the latest activity is a payment/transfer message
      if (latestActivity.deleted === 1) {
        previewHTML = `<span><i>${latestActivity.message}</i></span>`;
      } else if (typeof latestActivity.amount === 'bigint') {
        // Latest item is a payment/transfer
        const amountStr = parseFloat(big2str(latestActivity.amount, 18)).toFixed(6);
        const amountDisplay = `${amountStr} ${latestActivity.symbol || 'LIB'}`;
        const directionText = latestActivity.my ? '-' : '+';
        // Create payment preview text
        previewHTML = `<span class="payment-preview">${directionText} ${amountDisplay}</span>`;
        // Optionally add memo preview
        if (latestActivity.message) {
          // Memo is stored in the 'message' field for transfers
          previewHTML += ` <span class="memo-preview"> | ${truncateMessage(escapeHtml(latestActivity.message), 50)}</span>`;
        }
      } else if (latestActivity.type === 'call') {
        const callStartForPreview = Number(latestActivity.callTime || 0) > 0
          ? Number(latestActivity.callTime)
          : Number(latestActivity.timestamp || latestActivity.sent_timestamp || 0);
        const isExpired = chatModal.isCallExpired(callStartForPreview);

        if (isExpired) {
          // Over 2 hours since call time: show as plain text without join button
          const label = latestActivity.my
            ? `You called ${escapeHtml(contactName)}`
            : `${escapeHtml(contactName)} called you`;
          previewHTML = `<span><i>${label}</i></span>`;
        } else {
          previewHTML = `<span><i>Join call</i></span>`;
        }
      } else if (latestActivity.type === 'vm') {
        previewHTML = `<span><i>Voice message</i></span>`;
      } else if ((!latestActivity.message || String(latestActivity.message).trim() === '') && latestActivity.xattach) {
        previewHTML = `<span><i>Attachment</i></span>`;
      } else if (latestActivity.xattach && latestActivity.message && String(latestActivity.message).trim() !== '') {
        previewHTML = `<span><i>Attachment</i></span> <span class="memo-preview"> | ${truncateMessage(escapeHtml(latestActivity.message), 40)}</span>`;
      } else {
        // Latest item is a regular message
        const messageText = escapeHtml(latestActivity.message);
        previewHTML = `${truncateMessage(messageText, 50)}`;
      }
      // Use the determined latest timestamp for display
      const timeDisplay = formatTime(latestItemTimestamp, false);
      // Determine what to show in the preview

      let displayPreview = previewHTML;
      let displayPrefix = latestActivity.my ? '< ' : '> ';
      let hasDraftAttachment = false;

      // Check for draft attachments
      if (contact.draftAttachments && Array.isArray(contact.draftAttachments) && contact.draftAttachments.length > 0) {
        hasDraftAttachment = true;
      }
      
      // If there's draft text, show that (prioritize draft text over reply preview)
      if (contact.draft && contact.draft.trim() !== '') {
        displayPreview = truncateMessage(escapeHtml(contact.draft), 50);
        displayPrefix = '< ';
      } else if (contact.draftReplyTxid) {
        // If there's only reply content (no text), show "Replying to: [message]"
        const replyMessage = contact.draftReplyMessage || '';
        if (replyMessage.trim()) {
          // Always escape on display for defense in depth
          displayPreview = `${truncateMessage(escapeHtml(replyMessage), 40)}`;
        } else {
          // Fallback: shouldn't happen, but handle gracefully
          displayPreview = '[message]';
        }
        displayPrefix = 'Replying to: ';
      } else if (hasDraftAttachment && !contact.draft) {
        // If there's only attachment draft (no text, no reply), show attachment indicator
        const attachmentCount = contact.draftAttachments.length;
        displayPreview = attachmentCount === 1 
          ? '📎 Attachment' 
          : `📎 ${attachmentCount} attachments`;
        displayPrefix = '< ';
      }
      // Create the list item element
      const li = document.createElement('li');
      li.classList.add('chat-item');
      // Set its inner HTML
      li.innerHTML = `
          <div class="chat-avatar">${avatarHtml}</div>
          <div class="chat-content">
              <div class="chat-header">
                  <div class="chat-name">${escapeHtml(contactName)}</div>
                  <div class="chat-time">${timeDisplay}</div>
              </div>
              <div class="chat-message">
                ${contact.unread ? `<span class="chat-unread">${contact.unread}</span>` : ((contact.draft || contact.draftReplyTxid || hasDraftAttachment) ? `<span class="chat-draft" title="Draft"></span>` : '')}
                ${displayPrefix}${displayPreview}
              </div>
          </div>
      `;
      // Set click handler to open chat modal
      li.onclick = () => chatModal.open(chat.address);

      chatList.appendChild(li);
    });
    
    // Restore scroll position after DOM manipulation to preserve user's scroll position
    if (scrollContainer && savedScrollTop > 0) {
      // Use requestAnimationFrame to ensure DOM has been updated
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = savedScrollTop;
      });
    }
  }
}

const chatsScreen = new ChatsScreen();

class ContactsScreen {
  constructor() {

  }

  load() {
    this.screen = document.getElementById('contactsScreen');
    this.contactsList = document.getElementById('contactsList');
    this.contactSearchInput = document.getElementById('contactSearchInput');

    // Handle search input click that's on the contactsScreen
    this.contactSearchInput.addEventListener('click', () => {
      searchContactsModal.open();
    });
  }

  open() {
    this.screen.classList.add('active');
  }

  close() {
    this.screen.classList.remove('active');
  }

  isActive() {
    return this.screen.classList.contains('active');
  }

  // Update contacts list UI
  async updateContactsList() {
    const contacts = myData.contacts;

    if (Object.keys(contacts).length === 0) {
      this.contactsList.querySelector('.empty-state').style.display = 'block';
      return;
    }

    // Convert contacts object to array, filter out faucet address, and sort
    const contactsArray = Object.values(contacts).filter(
      (contact) => !isFaucetAddress(contact.address)
    );

    // Split into status groups in a single pass
    const statusGroups = contactsArray.reduce(
      (acc, contact) => {
        // 0 = blocked, 1 = Other, 2 = Connection
        switch (contact.friend) {
          case 0:
            acc.blocked.push(contact);
            break;
          case 3: // legacy friend status treated as connection
          case 2:
            acc.acquaintances.push(contact);
            break;
          default:
            acc.others.push(contact);
        }
        return acc;
      },
      { others: [], acquaintances: [], blocked: [] }
    );

    // Sort each group by name first, then by username if name is not available
    const sortByName = (a, b) => {
      const nameA = a.name || a.username || '';
      const nameB = b.name || b.username || '';
      return nameA.localeCompare(nameB);
    };
    Object.values(statusGroups).forEach((group) => group.sort(sortByName));

    // Group metadata for rendering
    const groupMeta = [
      { key: 'acquaintances', label: 'Connections', itemClass: 'chat-item' },
      { key: 'others', label: 'Tolled', itemClass: 'chat-item' },
      { key: 'blocked', label: 'Blocked', itemClass: 'chat-item blocked' },
    ];

    // Helper to check if contact is incomplete (missing public keys)
    const isContactIncomplete = (contact) => !contact.public;

    // Helper to render a contact item
    const renderContactItem = async (contact, itemClass) => {
      const avatarHtml = await getContactAvatarHtml(contact);
      const contactName = getContactDisplayName(contact);
      const incompleteIndicator = isContactIncomplete(contact) 
        ? '<span class="contact-incomplete" title="Incomplete contact"></span>' 
        : '';
      return `
            <li class="${itemClass}">
                <div class="chat-avatar">${avatarHtml}</div>
                <div class="chat-content">
                    <div class="chat-header">
                        <div class="chat-name">${incompleteIndicator}${contactName}</div>
                    </div>
                    <div class="contact-list-info">
                        ${contact.email || contact.x || contact.phone || `${contact.address.slice(0, 8)}…${contact.address.slice(-6)}`}
                    </div>
                </div>
            </li>
        `;
    };

    // Build HTML for all sections
    let html = '';
    let allContacts = [];
    for (const { key, label, itemClass } of groupMeta) {
      const group = statusGroups[key];
      if (group.length > 0) {
        html += `<div class="contact-section-header">${label}</div>`;
        const items = await Promise.all(group.map((contact) => renderContactItem(contact, itemClass)));
        html += items.join('');
        allContacts = allContacts.concat(group);
      }
    }

    this.contactsList.innerHTML = html;

    // Add click handlers to contact items
    this.contactsList.querySelectorAll('.chat-item').forEach((item, index) => {
      const contact = allContacts[index];
      item.onclick = () => {
        contactInfoModal.open(createDisplayInfo(contact));
      };
    });
  }
}

const contactsScreen = new ContactsScreen();

class WalletScreen {
  constructor() {
    this.firstTimeLoad = true;
    this.isFaucetRequestInProgress = false;
  }

  load() {
    // screen
    this.screen = document.getElementById('walletScreen');
    // balance elements
    this.totalBalance = document.getElementById('walletTotalBalance');
    this.refreshBalanceButton = document.getElementById('refreshBalance');
    // assets list
    this.assetsList = document.getElementById('assetsList');
    // action buttons
    this.openSendAssetFormModalButton = document.getElementById('openSendAssetFormModal');
    this.openReceiveModalButton = document.getElementById('openReceiveModal');
    this.openHistoryModalButton = document.getElementById('openHistoryModal');
    this.openBuyButton = document.getElementById('openBuyButton');
    this.openSellButton = document.getElementById('openSellButton');
    this.openFaucetBridgeButton = document.getElementById('openFaucetBridgeButton');

    this.openSendAssetFormModalButton.addEventListener('click', () => {
      sendAssetFormModal.open();
    });
    this.openReceiveModalButton.addEventListener('click', () => {
      receiveModal.open();
    });
    this.openHistoryModalButton.addEventListener('click', () => {
      historyModal.open();
    });

    // dynamic Faucet/Bridge button label and icon based on mainnet status
    const faucetBridgeLabel = this.openFaucetBridgeButton.querySelector('.action-label');
    const isMainnet = this.isMainnet();

    if (faucetBridgeLabel) {
      faucetBridgeLabel.textContent = isMainnet ? 'Bridge' : 'Faucet';
    }
    // Update icon: add/remove bridge-mode class
    if (isMainnet) {
      this.openFaucetBridgeButton.classList.add('bridge-mode');
    } else {
      this.openFaucetBridgeButton.classList.remove('bridge-mode');
    }

    this.openBuyButton.addEventListener('click', () => {
      window.open('https://liberdus.com/buy', '_blank');
    });

    this.openSellButton.addEventListener('click', () => {
      window.open('https://liberdus.com/sell', '_blank');
    });

    // Faucet/Bridge button handler
    this.openFaucetBridgeButton.addEventListener('click', async () => {
      if (this.isMainnet()) {
        // Mainnet: open bridge modal
        bridgeModal.open();
      } else {
        // Not mainnet: request from faucet API
        await this.requestFromFaucet();
      }
    });

    // Add refresh balance button handler
    this.refreshBalanceButton.addEventListener('click', async () => {
      
      // Add active class for animation
      this.refreshBalanceButton.classList.add('active');
      
      // Remove active class after animation completes
      setTimeout(() => {
        this.refreshBalanceButton.classList.remove('active');
        // Force blur to remove focus
        this.refreshBalanceButton.blur();
      }, 300);

      this.updateWalletView();
    });
  }

  open() {
    this.screen.classList.add('active');
    // Show testnet warning toast once per account (first-time tip).
    if (!this.isMainnet() && !checkFirstTimeTip('testnetWarning')) {
      showToast('The LIB in this Testnet is not of any value and will not be transferred to the Mainnet.', 0, 'info');
      setFirstTimeTipShown('testnetWarning');
    }
  }

  close() {
    this.screen.classList.remove('active');
  }

  isActive() {
    return this.screen.classList.contains('active');
  }

  // Check if the current network is mainnet
  isMainnet() {
    return network?.name === 'Mainnet';
  }

  // Update wallet view; refresh wallet
  async updateWalletView() {
    const walletData = myData.wallet;

    // Show loading toast if we're about to fetch fresh data
    let loadingToastId = null;
    // only show toast if myData.wallet.timestamp is not 0
    if (this.firstTimeLoad && isOnline) {
      loadingToastId = showToast('Loading wallet balance...', 0, 'loading');
      this.firstTimeLoad = false;
    }

    try {
      await this.updateWalletBalances();
    } catch (error) {
      console.error('Error updating wallet balances:', error);
    } finally {
      // Always hide loading toast if it was shown, regardless of success or failure
      if (loadingToastId) {
        hideToast(loadingToastId);
      }
    }

    // Update total networth
    this.totalBalance.textContent = (walletData.networth || 0).toFixed(2);

    if (!Array.isArray(walletData.assets) || walletData.assets.length === 0) {
      this.assetsList.querySelector('.empty-state').style.display = 'block';
      return;
    }

    this.assetsList.innerHTML = walletData.assets
      .map((asset) => {
        return `
              <div class="asset-item">
                  <div class="asset-logo"><img src="./media/liberdus_logo_50.png" class="asset-logo"></div>
                  <div class="asset-info">
                      <div class="asset-name">${asset.name}</div>
                      <div class="asset-symbol">$${asset.price} / ${asset.symbol}</div>
                  </div>
                  <div class="asset-balance">${(Number(asset.balance) / Number(wei)).toFixed(6)}<br><span class="asset-symbol">$${asset.networth.toFixed(6)}</span></div>
              </div>
          `;
      })
      .join('');
  }

  // refresh wallet balance
  async updateWalletBalances() {
    if (!myAccount || !myData || !myData.wallet || !myData.wallet.assets) {
      console.error('No wallet data available');
      return;
    } else if (!isOnline) {
      console.warn('Not online. Not updating wallet balances');
      return;
    }
    await updateAssetPricesIfNeeded();
    const now = getCorrectedTimestamp();
    if (!myData.wallet.timestamp) {
      myData.wallet.timestamp = 0;
    }
    if (now - myData.wallet.timestamp < 5000) {
      return;
    }

    let totalWalletNetworth = 0.0;
    let failedToGetBalance = false;
    // Update balances for each asset and address
    for (const asset of myData.wallet.assets) {
      let assetTotalBalance = 0n;

      // Get balance for each address in the asset
      for (const addr of asset.addresses) {
        try {
          const address = longAddress(addr.address);
          const data = await queryNetwork(`/account/${address}/balance`);
          if (!data) {
            failedToGetBalance = true;
            console.error(`Error fetching balance for address ${addr.address}:`, data);
            continue;
          }
          if (data?.balance !== undefined) {
            // Update address balance
            addr.balance = data.balance;
          }
          // Add to asset total (convert to USD using asset price)
          assetTotalBalance += addr.balance;
        } catch (error) {
          console.error(`Error fetching balance for address ${addr.address}:`, error);
        }
      }
      asset.balance = assetTotalBalance;
      asset.networth = (asset.price * Number(assetTotalBalance)) / Number(wei);

      // Add this asset's total to wallet total
      totalWalletNetworth += asset.networth;
    }

    if (failedToGetBalance) {
      showToast(`Error fetching balance. Try again later.`, 0, 'error');
      console.error('Failed to get balance for some addresses');
    }

    // Update total wallet balance
    myData.wallet.networth = totalWalletNetworth;
    myData.wallet.timestamp = now;
  }

  /**
   * Request funds from the faucet for normal users
   * @returns {Promise<void>}
   */
  async requestFromFaucet() {
    // Disable button immediately to prevent spam clicking
    if (this.openFaucetBridgeButton.disabled) {
      return;
    }
    this.openFaucetBridgeButton.disabled = true;
    // Re-enable button after 5 seconds
    setTimeout(() => {
      this.openFaucetBridgeButton.disabled = false;
    }, 5000);

    if (this.isFaucetRequestInProgress) {
      return;
    }

    if (!myAccount?.keys?.address) {
      console.error('Account address not available');
      showToast('Account address not available', 0, 'error');
      return;
    }

    if (!isOnline) {
      showToast('You must be online to request from faucet', 0, 'error');
      return;
    }

    // Check LIB balance - faucet only works if balance is less than 100 LIB
    const libAsset = myData.wallet.assets.find((asset) => asset.symbol === 'LIB');
    if (libAsset) {
      const balanceInWei = BigInt(libAsset.balance);
      const minBalanceForFaucet = 100n * wei; // 100 LIB in wei
      if (balanceInWei >= minBalanceForFaucet) {
        showToast('Balance exceeds 100 LIB, so you cannot claim more tokens from the faucet.', 0, 'warning');
        return;
      }
    }

    const toastId = showToast('Requesting from faucet...', 0, 'loading');
    try {
      this.isFaucetRequestInProgress = true;
      
      const payload = {
        username: myAccount.username,
        userAddress: longAddress(myAccount.keys.address),
        networkId: network.netid,
      };
      await signObj(payload, myAccount.keys);
      
      const faucetUrl = network.faucetUrl || 'https://dev.liberdus.com:3355/faucet';
      
      const response = await fetch(faucetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showToast('Faucet request successful! The LIB will be sent to your wallet. Refresh your balance in 10 seconds.', 5000, 'success');
      } else {
        const errorMessage = result.message || result.error || `HTTP ${response.status}: ${response.statusText}`;
        showToast(`Faucet error: ${errorMessage}`, 0, 'error');
      }
      
    } catch (error) {
      console.error('Faucet request error:', error);
      showToast(`Faucet request failed: ${error.message || 'Unknown error'}`, 0, 'error');
    } finally {
      hideToast(toastId);
      this.isFaucetRequestInProgress = false;
    }
  }
}

const walletScreen = new WalletScreen();

class MenuModal {
  constructor() {
    this.isSignoutExit = false;
  }

  load() {
    this.modal = document.getElementById('menuModal');
    this.closeButton = document.getElementById('closeMenu');
    this.closeButton.addEventListener('click', () => this.close());
    this.validatorButton = document.getElementById('openValidator');
    this.validatorButton.addEventListener('click', () => validatorStakingModal.open());
    this.daoButton = document.getElementById('openDao');
    if (network.name === 'Devnet') {
      this.daoButton.style.display = 'block';
      this.daoButton.addEventListener('click', () => daoModal.open());
    }
    this.inviteButton = document.getElementById('openInvite');
    this.inviteButton.addEventListener('click', () => inviteModal.open());
    this.explorerButton = document.getElementById('openExplorer');
    this.explorerButton.addEventListener('click', () => this.handleExternalClick('./explorer', 'explorer'));
    this.networkButton = document.getElementById('openMonitor');
    this.networkButton.addEventListener('click', () => this.handleExternalClick('./network', 'network'));
    this.helpButton = document.getElementById('openHelp');
    this.helpButton.addEventListener('click', () => helpModal.open());
    this.aboutButton = document.getElementById('openAbout');
    this.aboutButton.addEventListener('click', () => aboutModal.open());
    this.signOutButton = document.getElementById('handleSignOut');
    this.signOutButton.addEventListener('click', async () => await this.handleSignOut());
    this.bridgeButton = document.getElementById('openBridge');
    this.bridgeButton.addEventListener('click', () => bridgeModal.open());
    this.logsButton = document.getElementById('openLogs');
    this.logsButton.addEventListener('click', () => logsModal.open());
    this.farmButton = document.getElementById('openFarm');
    this.farmButton.addEventListener('click', () => farmModal.open());
    
    // Header sign out button
    this.signOutHeaderButton = document.getElementById('signOutMenuHeader');
    this.signOutHeaderButton.addEventListener('click', async () => await this.handleSignOut());
    
    
    // Show launch button if ReactNativeWebView is available
    if (window?.ReactNativeWebView) {
      this.launchButton = document.getElementById('openLaunchUrl');
      this.launchButton.addEventListener('click', () => launchModal.open());
      this.launchButton.style.display = 'block';

      this.updateButton = document.getElementById('openUpdate');
      this.updateButton.addEventListener('click', () => updateWarningModal.open());
      this.updateButton.style.display = 'block';
    }
  }

  enableSignOutButtonWithDelay() {
    // Disable button initially
    this.signOutHeaderButton.classList.remove('active');
    // Re-enable after modal animation completes (300ms) + small buffer to prevent accidental double-taps
    setTimeout(() => {
      if (this.isActive()) {
        this.signOutHeaderButton.classList.add('active');
      }
    }, 400); // 400ms = modal animation (300ms) + 100ms buffer
  }

  open() {
    this.modal.classList.add('active');
    this.enableSignOutButtonWithDelay();
    enterFullscreen();
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  handleExternalClick(url, pageName) {
    if (!isOnline) {
      showToast(`Require internet connection to access the ${pageName} page`, 0, 'warning');
      return;
    }
    window.open(url, '_blank');
  }
  
  async handleSignOut() {
    logsModal.log(`Signout ${myAccount.username}`)
    this.isSignoutExit = true;

    // Clear intervals
    if (checkPendingTransactionsIntervalId) {
      clearInterval(checkPendingTransactionsIntervalId);
      checkPendingTransactionsIntervalId = null;
    }
    if (getSystemNoticeIntervalId) {
      clearInterval(getSystemNoticeIntervalId);
      getSystemNoticeIntervalId = null;
    }
    callsModal.stopPeriodicCallsRefresh();
    // Stop camera if it's running
    if (typeof scanQRModal !== 'undefined' && scanQRModal.camera.scanInterval) {
      scanQRModal.stopCamera();
    }

    // Remove event listeners for beforeunload and visibilitychange
    window.removeEventListener('beforeunload', handleBeforeUnload);

    // Lock the app
    unlockModal.lock();

    // Close all modals
    menuModal.close();
    settingsModal.close(); // may be triggered from settings modal, calls openFullscreen() again

    // Hide header and footer
    header.close();
    footer.close();
    footer.closeNewChatButton();

    // Reset header text
    header.setText('Liberdus');
    // Clear avatar on sign out
    if (header.avatarContainer) {
      header.avatarContainer.innerHTML = '';
    }

    // Hide all app screens
    document.querySelectorAll('.app-screen').forEach((screen) => {
      screen.classList.remove('active');
    });


    // Show welcome screen
    welcomeScreen.open();


    // Save myData to localStorage if it exists
    saveState();

    // clear storage
    clearMyData();

    // Add offline fallback
    if (!isOnline) {
      return;
    }

    await reactNativeApp.handleNativeAppSubscribe();
    await checkVersion();

    // checkVersion() may update online status
    if (isOnline) {
      const newUrl = window.location.href.split('?')[0];
      window.location.replace(newUrl);
    }
  }
}

const menuModal = new MenuModal();

// =====================
// DAO / Proposals
// =====================

// DAO proposals are loaded via `daoRepo` and kept in memory (no localStorage persistence).

function getDaoVoterId() {
  return myAccount?.address || myData?.account?.address || myAccount?.username || myData?.account?.username || 'anon';
}

function formatDaoTimestamp(ts) {
  const n = Number(ts || 0);
  if (!n) return '';
  try {
    return new Date(n).toLocaleString();
  } catch {
    return '';
  }
}

class DaoModal {
  constructor() {
    this.selectedGroupKey = 'active';
    this.selectedStateKey = 'voting';
    this._outsideClickHandler = null;
    this.isLoading = false;
  }

  load() {
    this.modal = document.getElementById('daoModal');
    this.closeButton = document.getElementById('closeDaoModal');
    this.titleEl = document.getElementById('daoModalTitle');
    this.statusMenuButton = document.getElementById('daoFilterButton');
    this.statusMenu = document.getElementById('daoStatusContextMenu');
    this.groupActiveButton = document.getElementById('daoGroupActiveButton');
    this.groupArchivedButton = document.getElementById('daoGroupArchivedButton');
    this.list = document.getElementById('daoProposalList');
    this.emptyState = document.getElementById('daoProposalEmptyState');
    this.addButton = document.getElementById('daoAddProposalButton');

    if (this.closeButton) this.closeButton.addEventListener('click', () => this.close());
    if (this.addButton) this.addButton.addEventListener('click', () => addProposalModal.open());

    if (this.statusMenuButton) {
      this.statusMenuButton.addEventListener('click', (e) => this.toggleStatusMenu(e));
    }

    if (this.groupActiveButton) {
      this.groupActiveButton.addEventListener('click', () => {
        this.setGroupFilter('active');
      });
    }
    if (this.groupArchivedButton) {
      this.groupArchivedButton.addEventListener('click', () => {
        this.setGroupFilter('archived');
      });
    }

    if (this.statusMenu) {
      this.statusMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.context-menu-option');
        if (!option) return;
        const key = option.dataset.stateKey;
        if (!key) return;
        this.setStateFilter(key);
      });
    }

    // Close the DAO menu on outside click
    this._outsideClickHandler = (e) => {
      if (!this.statusMenu || this.statusMenu.style.display !== 'block') return;
      if (this.statusMenu.contains(e.target)) return;
      if (this.statusMenuButton && this.statusMenuButton.contains(e.target)) return;
      this.closeStatusMenu();
    };
    document.addEventListener('click', this._outsideClickHandler);
  }

  open() {
    this._open();
  }

  async _open() {
    this.isLoading = true;

    // Close the main menu if opened from it
    if (menuModal?.isActive?.()) menuModal.close();
    footer?.closeNewChatButton?.();

    this.modal.classList.add('active');
    enterFullscreen();

    // Default filter is Voting
    this.selectedStateKey = this.selectedStateKey || 'voting';
    this.selectedGroupKey = this.selectedGroupKey || 'active';
    this.render();

    try {
      await daoRepo.refresh({ force: true });
    } catch (e) {
      console.warn('Failed to refresh DAO proposals:', e);
      showToast('Failed to load proposals', 2500, 'error');
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  close() {
    this.closeStatusMenu();
    this.modal.classList.remove('active');
    enterFullscreen();

    if (this.addButton) {
      this.addButton.classList.remove('visible');
    }

    // Restore new chat button if user is on chats/contacts
    const activeScreenId = document.querySelector('.app-screen.active')?.id;
    if (activeScreenId === 'chatsScreen' || activeScreenId === 'contactsScreen') {
      footer?.openNewChatButton?.();
    }
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  toggleStatusMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.statusMenu) return;
    if (this.statusMenu.style.display === 'block') {
      this.closeStatusMenu();
      return;
    }
    this.showStatusMenu();
  }

  showStatusMenu() {
    if (!this.statusMenu || !this.statusMenuButton) return;
    const buttonRect = this.statusMenuButton.getBoundingClientRect();
    const menuWidth = 200;
    const approxMenuHeight = 8 + DAO_STATES.length * 44; // padding + items

    let left = buttonRect.right - menuWidth;
    let top = buttonRect.bottom + 8;

    if (left < 10) left = 10;
    if (top + approxMenuHeight > window.innerHeight - 10) {
      top = buttonRect.top - approxMenuHeight - 8;
    }

    Object.assign(this.statusMenu.style, {
      left: `${left}px`,
      top: `${top}px`,
      display: 'block',
    });
  }

  closeStatusMenu() {
    if (!this.statusMenu) return;
    this.statusMenu.style.display = 'none';
  }

  setStateFilter(key) {
    this.selectedStateKey = key;
    this.closeStatusMenu();
    this.render();
  }

  setGroupFilter(key) {
    this.selectedGroupKey = key;
    this.render();
  }

  getProposals() {
    return daoRepo.getProposalsForUi(this.selectedGroupKey);
  }

  render() {
    const proposalsActive = daoRepo.getProposalsForUi('active');
    const proposalsArchived = daoRepo.getProposalsForUi('archived');

    const proposals = this.selectedGroupKey === 'archived' ? proposalsArchived : proposalsActive;

    // Update counts by state (within selected group)
    const counts = Object.fromEntries(DAO_STATES.map((s) => [s.key, 0]));
    for (const p of proposals) {
      const state = getEffectiveDaoState(p);
      if (counts[state] !== undefined) counts[state] += 1;
    }

    // Update header title
    const groupLabel = this.selectedGroupKey === 'archived' ? 'Archived' : 'Active';
    const label = getDaoStateLabel(this.selectedStateKey);
    if (this.titleEl) this.titleEl.textContent = `DAO · ${groupLabel} · ${label}`;

    // Update group toggle labels + selection
    if (this.groupActiveButton) {
      this.groupActiveButton.textContent = `Active ${proposalsActive.length}`;
      this.groupActiveButton.classList.toggle('active', this.selectedGroupKey !== 'archived');
    }
    if (this.groupArchivedButton) {
      this.groupArchivedButton.textContent = `Archived ${proposalsArchived.length}`;
      this.groupArchivedButton.classList.toggle('active', this.selectedGroupKey === 'archived');
    }

    for (const s of DAO_STATES) {
      const el = document.getElementById(`daoStatusOption${s.label.replace(/\s+/g, '')}`);
      if (el) el.textContent = `${s.label} ${counts[s.key] || 0}`;
    }

    // Filter + sort (newest entered into state first)
    const filtered = proposals
      .filter((p) => getEffectiveDaoState(p) === this.selectedStateKey)
      .sort((a, b) => Number(b.stateEnteredAt || b.createdAt || 0) - Number(a.stateEnteredAt || a.createdAt || 0));

    // Clear old list items
    if (this.list) {
      this.list.querySelectorAll('li.chat-item').forEach((el) => el.remove());
    }

    const hasAny = filtered.length > 0;
    if (this.emptyState) this.emptyState.style.display = hasAny ? 'none' : 'block';

    // Update empty state copy based on group.
    if (this.emptyState && !hasAny) {
      const lines = Array.from(this.emptyState.querySelectorAll('div'));
      // Structure is: [0]=spacer, [1]=headline, [2]=subline, [3]=optional third line.
      const headlineEl = lines[1] || null;
      const sublineEl = lines[2] || null;
      const isArchived = this.selectedGroupKey === 'archived';

      if (this.isLoading) {
        if (headlineEl) headlineEl.textContent = 'Loading proposals…';
        if (sublineEl) sublineEl.textContent = 'Please wait';
      } else {
        if (headlineEl) headlineEl.textContent = isArchived ? 'No archived proposals found' : 'No proposals found';
        if (sublineEl) {
          sublineEl.textContent = isArchived
            ? 'Archived proposals appear here after they age out'
            : 'Use + to create a proposal';
        }
      }
    }

    if (!this.list) return;

    for (const p of filtered) {
      const li = document.createElement('li');
      li.classList.add('chat-item');

      const title = escapeHtml(p.title || 'Untitled Proposal');
      const summary = escapeHtml((p.summary || '').trim());
      const time = formatDaoTimestamp(p.stateEnteredAt || p.createdAt);

      const numberPrefix = p.number ? `#${p.number} ` : '';

      li.innerHTML = `
        <div class="chat-content">
          <div class="chat-header">
            <div class="chat-name">${escapeHtml(numberPrefix)}${title}</div>
            <div class="chat-time">${escapeHtml(time)}</div>
          </div>
          <div class="chat-message">${truncateMessage(summary || '—', 70)}</div>
        </div>
      `;
      li.onclick = () => proposalInfoModal.open(p.id);
      this.list.appendChild(li);
    }

    // Show + button when modal is active
    if (this.addButton) {
      this.addButton.classList.toggle('visible', this.isActive());
    }
  }
}

const daoModal = new DaoModal();

class AddProposalModal {
  load() {
    this.modal = document.getElementById('addProposalModal');
    this.closeButton = document.getElementById('closeAddProposalModal');
    this.cancelButton = document.getElementById('cancelAddProposal');
    this.form = document.getElementById('addProposalForm');
    this.titleInput = document.getElementById('addProposalTitle');
    this.typeSelect = document.getElementById('addProposalType');
    this.summaryInput = document.getElementById('addProposalSummary');
    this.typeFieldsContainer = document.getElementById('addProposalTypeFields');

    if (this.closeButton) this.closeButton.addEventListener('click', () => this.close());
    if (this.cancelButton) this.cancelButton.addEventListener('click', () => this.close());

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreate();
      });
    }

    if (this.typeSelect) {
      this.typeSelect.addEventListener('change', () => {
        this.renderTypeFields();
      });
    }
  }

  open() {
    this.modal.classList.add('active');
    enterFullscreen();
    if (this.titleInput) this.titleInput.value = '';
    if (this.typeSelect) this.typeSelect.value = 'treasury_project';
    if (this.summaryInput) this.summaryInput.value = '';
    this.renderTypeFields();
    setTimeout(() => {
      this.titleInput.focus();
    }, 325);
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  renderTypeFields() {
    if (!this.typeFieldsContainer) return;
    const typeKey = this.typeSelect?.value || 'treasury_project';

    // Minimal, mock-only dynamic fields.
    if (typeKey === 'treasury_project' || typeKey === 'treasury_mint') {
      this.typeFieldsContainer.innerHTML = `
        <div class="form-group">
          <label for="addProposalAddress">Address</label>
          <input id="addProposalAddress" class="form-control" type="text" maxlength="128" placeholder="Destination address" />
        </div>
        <div class="form-group">
          <label for="addProposalAmount">Amount</label>
          <input id="addProposalAmount" class="form-control" type="number" min="0" step="0.0001" placeholder="0" />
        </div>
      `;
      return;
    }

    if (typeKey === 'params_governance') {
      this.typeFieldsContainer.innerHTML = `
        <div class="form-group">
          <label for="addProposalVotingThreshold">Voting Threshold</label>
          <input id="addProposalVotingThreshold" class="form-control" type="text" maxlength="20" placeholder="e.g. 60%" />
        </div>
        <div class="form-group">
          <label for="addProposalVotingEligibility">Voting Eligibility</label>
          <input id="addProposalVotingEligibility" class="form-control" type="text" maxlength="120" placeholder="e.g. validators + stakers" />
        </div>
      `;
      return;
    }

    if (typeKey === 'params_economic') {
      this.typeFieldsContainer.innerHTML = `
        <div class="form-group">
          <label for="addProposalMinTxFee">Min Tx Fee</label>
          <input id="addProposalMinTxFee" class="form-control" type="text" maxlength="24" placeholder="e.g. 0.001" />
        </div>
        <div class="form-group">
          <label for="addProposalNodeRewards">Node Rewards</label>
          <input id="addProposalNodeRewards" class="form-control" type="text" maxlength="24" placeholder="e.g. unchanged" />
        </div>
        <div class="form-group">
          <label for="addProposalValidatorPenalty">Validator Penalty</label>
          <input id="addProposalValidatorPenalty" class="form-control" type="text" maxlength="24" placeholder="e.g. 50" />
        </div>
      `;
      return;
    }

    // params_protocol
    this.typeFieldsContainer.innerHTML = `
      <div class="form-group">
        <label for="addProposalMinActiveNodes">Min Active Nodes</label>
        <input id="addProposalMinActiveNodes" class="form-control" type="number" min="0" step="1" placeholder="e.g. 100" />
      </div>
      <div class="form-group">
        <label for="addProposalMaxActiveNodes">Max Active Nodes</label>
        <input id="addProposalMaxActiveNodes" class="form-control" type="number" min="0" step="1" placeholder="e.g. 250" />
      </div>
      <div class="form-group">
        <label for="addProposalMinValidatorVersion">Min Validator Version</label>
        <input id="addProposalMinValidatorVersion" class="form-control" type="text" maxlength="40" placeholder="e.g. 1.2.3" />
      </div>
    `;
  }

  async handleCreate() {
    const title = (this.titleInput?.value || '').trim();
    const summary = (this.summaryInput?.value || '').trim();
    const typeKey = (this.typeSelect?.value || '').trim();

    if (!title) {
      showToast('Please enter a title', 2000, 'warning');
      return;
    }
    if (!summary) {
      showToast('Please enter a summary', 2000, 'warning');
      return;
    }

    if (!typeKey) {
      showToast('Please select a type', 2000, 'warning');
      return;
    }

    const fields = {};
    // Collect dynamic fields if present.
    const addrEl = document.getElementById('addProposalAddress');
    const amtEl = document.getElementById('addProposalAmount');
    const thrEl = document.getElementById('addProposalVotingThreshold');
    const eligEl = document.getElementById('addProposalVotingEligibility');
    const feeEl = document.getElementById('addProposalMinTxFee');
    const rewardsEl = document.getElementById('addProposalNodeRewards');
    const penEl = document.getElementById('addProposalValidatorPenalty');
    const minNodesEl = document.getElementById('addProposalMinActiveNodes');
    const maxNodesEl = document.getElementById('addProposalMaxActiveNodes');
    const minVerEl = document.getElementById('addProposalMinValidatorVersion');

    if (addrEl?.value) fields.address = addrEl.value.trim();
    if (amtEl?.value) fields.amount = amtEl.value;
    if (thrEl?.value) fields.votingThreshold = thrEl.value.trim();
    if (eligEl?.value) fields.votingEligibility = eligEl.value.trim();
    if (feeEl?.value) fields.minTxFee = feeEl.value.trim();
    if (rewardsEl?.value) fields.nodeRewards = rewardsEl.value.trim();
    if (penEl?.value) fields.validatorPenalty = penEl.value.trim();
    if (minNodesEl?.value) fields.minActiveNodes = Number(minNodesEl.value);
    if (maxNodesEl?.value) fields.maxActiveNodes = Number(maxNodesEl.value);
    if (minVerEl?.value) fields.minValidatorVersion = minVerEl.value.trim();

    try {
      await daoRepo.createProposal({
        title,
        summary,
        type: typeKey,
        fields,
        createdBy: myAccount?.username || myAccount?.address || 'unknown',
      });
    } catch (e) {
      console.warn('Failed to create proposal:', e);
      showToast(e?.message || 'Failed to create proposal', 2500, 'error');
      return;
    }

    this.close();
    // Ensure DAO modal shows the new proposal (Discussion by default for new proposals)
    daoModal.selectedStateKey = 'discussion';
    daoModal.selectedGroupKey = 'active';
    if (!daoModal.isActive()) daoModal.open();
    else daoModal.render();

    showToast('Proposal submitted (Discussion)', 2000, 'success');
  }
}

const addProposalModal = new AddProposalModal();

class ProposalInfoModal {
  load() {
    this.modal = document.getElementById('proposalInfoModal');
    this.closeButton = document.getElementById('closeProposalInfoModal');
    this.numberEl = document.getElementById('proposalInfoNumber');
    this.titleEl = document.getElementById('proposalInfoTitle');
    this.typeEl = document.getElementById('proposalInfoType');
    this.metaEl = document.getElementById('proposalInfoMeta');
    this.summaryEl = document.getElementById('proposalInfoSummary');
    this.fieldsEl = document.getElementById('proposalInfoFields');
    this.voteSection = document.getElementById('proposalVoteSection');
    this.voteYesBtn = document.getElementById('proposalVoteYes');
    this.voteNoBtn = document.getElementById('proposalVoteNo');
    this.voteCountsEl = document.getElementById('proposalVoteCounts');

    this._currentProposalId = null;

    if (this.closeButton) this.closeButton.addEventListener('click', () => this.close());

    if (this.voteYesBtn) this.voteYesBtn.addEventListener('click', () => this.castVote('yes'));
    if (this.voteNoBtn) this.voteNoBtn.addEventListener('click', () => this.castVote('no'));
  }

  open(proposalId) {
    this._open(proposalId);
  }

  async _open(proposalId) {
    this._currentProposalId = proposalId;

    this.modal.classList.add('active');
    enterFullscreen();

    let p = null;
    try {
      await daoRepo.ensureLoaded();
      p = daoRepo.getProposalById(proposalId);
    } catch (e) {
      console.warn('Failed to load proposal:', e);
    }

    if (!p) {
      if (this.numberEl) this.numberEl.textContent = '';
      if (this.titleEl) this.titleEl.textContent = 'Proposal not found';
      if (this.typeEl) this.typeEl.textContent = '';
      if (this.metaEl) this.metaEl.textContent = '';
      if (this.summaryEl) this.summaryEl.textContent = '';
      if (this.fieldsEl) this.fieldsEl.innerHTML = '';
      if (this.voteSection) this.voteSection.style.display = 'none';
      return;
    }

    const uiState = getDaoStateLabel(getEffectiveDaoState({ state: p.state, stateEnteredAt: p.state_changed, createdAt: p.created }));
    const entered = formatDaoTimestamp(p.state_changed || p.created);
    const createdBy = p.createdBy ? ` · by ${p.createdBy}` : '';
    const typeLabel = getDaoTypeLabel(p.type);

    if (this.numberEl) this.numberEl.textContent = p.number ? `Proposal #${p.number}` : 'Proposal';
    if (this.titleEl) this.titleEl.textContent = p.title || 'Untitled Proposal';
    if (this.typeEl) this.typeEl.textContent = typeLabel ? `Type: ${typeLabel}` : '';
    if (this.metaEl) this.metaEl.textContent = `${uiState} · ${entered}${createdBy}`;
    if (this.summaryEl) this.summaryEl.textContent = p.summary || '';

    if (this.fieldsEl) {
      const entries = Object.entries(p.fields || {}).filter(([, v]) => v !== undefined && v !== null && String(v).length > 0);
      if (entries.length === 0) {
        this.fieldsEl.innerHTML = '';
      } else {
        this.fieldsEl.innerHTML = entries
          .map(([k, v]) => {
            const key = escapeHtml(String(k));
            const val = escapeHtml(String(v));
            return `<div><span style="color: var(--secondary-text-color)">${key}</span>: ${val}</div>`;
          })
          .join('');
      }
    }

    this.renderVotingSection(p);
  }

  renderVotingSection(p) {
    if (!this.voteSection) return;
    const effective = getEffectiveDaoState({ state: p.state, stateEnteredAt: p.state_changed, createdAt: p.created });
    const showVoting = effective === 'voting';
    this.voteSection.style.display = showVoting ? 'block' : 'none';
    if (!showVoting) return;

    const voterId = getDaoVoterId();
    const votes = p.votes || { yes: 0, no: 0, by: {} };
    const myVote = votes.by?.[voterId] || '';

    if (this.voteCountsEl) this.voteCountsEl.textContent = `Yes: ${votes.yes || 0} · No: ${votes.no || 0}`;

    if (this.voteYesBtn) {
      this.voteYesBtn.classList.toggle('btn--primary', myVote === 'yes');
      this.voteYesBtn.classList.toggle('btn--secondary', myVote !== 'yes');
    }
    if (this.voteNoBtn) {
      this.voteNoBtn.classList.toggle('btn--primary', myVote === 'no');
      this.voteNoBtn.classList.toggle('btn--secondary', myVote !== 'no');
    }
  }

  async castVote(choice) {
    if (!this._currentProposalId) return;

    const voterId = getDaoVoterId();
    const result = await daoRepo.castVote({
      proposalId: this._currentProposalId,
      voterId,
      choice,
    });

    if (!result?.ok) {
      showToast(result?.error || 'Failed to vote', 2000, 'warning');
      return;
    }

    // Re-render this modal and the list counts.
    this.open(this._currentProposalId);
    if (daoModal?.isActive?.()) daoModal.render();
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

const proposalInfoModal = new ProposalInfoModal();

class SettingsModal {
  constructor() { }

  load() {
    this.modal = document.getElementById('settingsModal');
    this.closeButton = document.getElementById('closeSettings');
    this.closeButton.addEventListener('click', () => this.close());
    
    this.callsButton = document.getElementById('openCallsModal');
    this.callsButton.addEventListener('click', () => callsModal.open());
    
    this.contactsButton = document.getElementById('openManageContactsModal');
    this.contactsButton.addEventListener('click', () => manageContactsModal.open());
    
    this.profileButton = document.getElementById('openAccountForm');
    this.profileButton.addEventListener('click', () => myProfileModal.open());
    
    this.tollButton = document.getElementById('openToll');
    this.tollButton.addEventListener('click', () => tollModal.open());
    
    this.lockButton = document.getElementById('openLockModal');
    this.lockButton.addEventListener('click', () => lockModal.open());
    
    this.backupButton = document.getElementById('openBackupForm');
    this.backupButton.addEventListener('click', () => backupAccountModal.open());
    
    this.removeButton = document.getElementById('openRemoveAccount');
    this.removeButton.addEventListener('click', () => removeAccountModal.open());
    
    this.secretButton = document.getElementById('openSecretModal');
    this.secretButton.addEventListener('click', () => secretModal.open());
    
    this.signOutButton = document.getElementById('handleSignOutSettings');
    this.signOutButton.addEventListener('click', async () => await menuModal.handleSignOut());
    
    // Header sign out button
    this.signOutHeaderButton = document.getElementById('signOutSettingsHeader');
    this.signOutHeaderButton.addEventListener('click', async () => await menuModal.handleSignOut());
  }

  enableSignOutButtonWithDelay() {
    // Disable button initially
    this.signOutHeaderButton.classList.remove('active');
    // Re-enable after modal animation completes (300ms) + small buffer to prevent accidental double-taps
    setTimeout(() => {
      if (this.isActive()) {
        this.signOutHeaderButton.classList.add('active');
      }
    }, 400); // 400ms = modal animation (300ms) + 100ms buffer
  }

  open() {
    this.modal.classList.add('active');
    this.enableSignOutButtonWithDelay();
    enterFullscreen();
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

const settingsModal = new SettingsModal();

/**
 * Manage Contacts Modal
 * Allows users to import contacts from a VCF file
 */
class ManageContactsModal {
  constructor() {
    this.selectedFile = null;
  }

  load() {
    this.modal = document.getElementById('manageContactsModal');
    this.closeButton = document.getElementById('closeManageContactsModal');
    this.fileInput = document.getElementById('manageContactsFileInput');
    this.selectedFileDisplay = document.getElementById('manageContactsSelectedFile');
    this.clearFileBtn = document.getElementById('manageContactsClearFile');
    this.importBtn = document.getElementById('manageContactsImportBtn');

    // Event listeners
    this.closeButton.addEventListener('click', () => this.close());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelected(e));
    this.clearFileBtn.addEventListener('click', () => this.clearFile());
    this.importBtn.addEventListener('click', () => this.handleImport());
  }

  /**
   * Opens the manage contacts modal
   */
  open() {
    this.clearFile();
    this.modal.classList.add('active');
    enterFullscreen();
  }

  /**
   * Closes the modal
   */
  close() {
    this.modal.classList.remove('active');
    this.clearFile();
    enterFullscreen();
  }

  /**
   * Checks if the modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  /**
   * Handles file selection
   * @param {Event} e - Change event
   */
  handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) {
      this.clearFile();
      return;
    }

    // Validate file type
    const isVcf = file.name.toLowerCase().endsWith('.vcf') || 
                  file.type === 'text/vcard' || 
                  file.type === 'text/x-vcard';
    if (!isVcf) {
      showToast('Please select a VCF file', 2000, 'error');
      this.clearFile();
      return;
    }

    this.selectedFile = file;
    this.selectedFileDisplay.style.display = 'flex';
    this.selectedFileDisplay.querySelector('.selected-file-name').textContent = file.name;
    this.fileInput.style.display = 'none';
    this.importBtn.disabled = false;
  }

  /**
   * Clears the selected file
   */
  clearFile() {
    this.selectedFile = null;
    this.fileInput.value = '';
    this.fileInput.style.display = 'block';
    this.selectedFileDisplay.style.display = 'none';
    this.importBtn.disabled = true;
  }

  /**
   * Handles the import button click
   */
  async handleImport() {
    if (!this.selectedFile) {
      showToast('Please select a VCF file first', 2000, 'error');
      return;
    }

    try {
      // Read the file content
      const vcfContent = await this.selectedFile.text();

      // Close this modal
      this.close();

      // Open the import contacts modal with local VCF content
      // The import modal handles network ID validation and parsing
      importContactsModal.open({ vcfContent, isLocal: true });

    } catch (err) {
      console.error('Failed to read VCF file:', err);
      showToast('Failed to read the VCF file', 0, 'error');
    }
  }
}

const manageContactsModal = new ManageContactsModal();

class SecretModal {
  constructor() { }

  load() {
    this.modal = document.getElementById('secretModal');
    this.closeButton = document.getElementById('closeSecretModal');
    this.closeButton.addEventListener('click', () => this.close());
    
    this.showButton = document.getElementById('showSecretButton');
    this.showButton.addEventListener('click', () => this.showSecret());
    
    this.secretContent = document.getElementById('secretContent');
    this.secretHexDisplay = document.getElementById('secretHexDisplay');
    this.copyButton = document.getElementById('copySecretButton');
    this.copyButton.addEventListener('click', () => this.copyToClipboard());
    
    this.qrContainer = document.getElementById('secretQRCode');
  }

  resetSecretState() {
    // Reset the secret content state
    this.secretContent.style.display = 'none';
    this.showButton.textContent = 'Show';
    this.showButton.style.display = 'block';
    this.secretHexDisplay.textContent = '';
    if (this.qrContainer) {
      this.qrContainer.innerHTML = '';
    }
  }

  open() {
    this.modal.classList.add('active');
    enterFullscreen();
    this.resetSecretState();
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
    this.resetSecretState();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  showSecret() {
    if (!myAccount || !myAccount.keys || !myAccount.keys.secret) {
      console.error('Secret key not available');
      showToast('Secret key not available', 0, 'error');
      return;
    }

    const secretKey = myAccount.keys.secret;
    
    // Display the secret as hex string with 0x prefix
    const secretKeyWithPrefix = '0x' + secretKey;
    this.secretHexDisplay.textContent = secretKeyWithPrefix;
    
    // Generate and display QR code with 0x prefix
    this.renderSecretQR(secretKeyWithPrefix);
    
    // Show the content and hide the button
    this.secretContent.style.display = 'block';
    this.showButton.style.display = 'none';
  }

  renderSecretQR(secretKey) {
    try {
      if (!this.qrContainer) return;
      this.qrContainer.innerHTML = '';
      
      // Generate QR using the global qr library as GIF
      const gifBytes = qr.encodeQR(secretKey, 'gif', { scale: 4 });
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
      const dataUrl = 'data:image/gif;base64,' + base64;
      const img = document.createElement('img');
      img.src = dataUrl;
      img.width = 200;
      img.height = 200;
      img.alt = 'Secret key QR code';
      this.qrContainer.appendChild(img);
    } catch (e) {
      console.error('Failed to render secret QR:', e);
      showToast('Failed to generate QR code', 0, 'error');
    }
  }

  async copyToClipboard() {
    const secretKey = this.secretHexDisplay.textContent;
    if (!secretKey) {
      showToast('No secret key to copy', 0, 'error');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(secretKey);
      this.copyButton.classList.add('success');
      setTimeout(() => {
        this.copyButton.classList.remove('success');
      }, 2000);
      showToast('Secret key copied to clipboard', 2000, 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy to clipboard', 0, 'error');
    }
  }
}

const secretModal = new SecretModal();

/**
 * createNewContact
 * @param {string} addr - the address of the contact
 * @param {string} username - the username of the contact
 * @param {number = 1} friendStatus - the friend status of the contact, default is 1
 * @param {boolean = true} tolledDepositToastShown - if false, ChatModal may show a one-time toast about the sender's toll deposit
 * @returns {void}
 */
function createNewContact(addr, username, friendStatus = 1, tolledDepositToastShown = true) {
  const address = normalizeAddress(addr);
  if (myData.contacts[address]) {
    return;
  } // already exists
  const c = (myData.contacts[address] = {});
  c.address = address;
  // Set username to "Liberdus Faucet" if this is the faucet address
  if (isFaucetAddress(address)) {
    c.username = 'Liberdus Faucet';
  } else if (username) {
    c.username = normalizeUsername(username);
  }
  c.messages = [];
  c.timestamp = 0;
  c.unread = 0;
  c.hasAvatar = false;
  c.toll = 0n;
  c.tollRequiredToReceive = 1;
  c.tollRequiredToSend = 1;
  c.friend = friendStatus;
  c.friendOld = friendStatus;
  c.tolledDepositToastShown = tolledDepositToastShown;
}

class ScanQRModal {
  constructor() {
    this.fillFunction = null;
    this.camera = {
      stream: null,
      scanning: false,
      scanInterval: null
    };
  }

  load() {
    this.modal = document.getElementById('qrScanModal');
    this.closeButton = document.getElementById('closeQRScanModal');
    this.video = document.getElementById('video');
    this.canvasElement = document.getElementById('canvas');
    this.canvas = this.canvasElement.getContext('2d');

    this.closeButton.addEventListener('click', () => { this.close(); });
  }

  open() {
    this.modal.classList.add('active');
    this.startCamera();
  }

  close() {
    this.modal.classList.remove('active');
    this.stopCamera();
  }

  async startCamera() {
    try {
      // First check if camera API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser');
      }

      // Stop any existing stream
      if (this.camera.stream) {
        this.stopCamera();
      }

      // Request camera access with specific error handling
      try {
        this.camera.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Use back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (mediaError) {
        // Handle specific getUserMedia errors
        switch (mediaError.name) {
          case 'NotAllowedError':
            this.close();
            throw new Error(
              'Camera access was denied. Please check your device settings and grant permission to use the camera.'
            );
          case 'NotFoundError':
            throw new Error('No camera device was found on your system.');
          case 'NotReadableError':
            throw new Error('Camera is already in use by another application or encountered a hardware error.');
          case 'SecurityError':
            throw new Error("Camera access was blocked by your browser's security policy.");
          case 'AbortError':
            throw new Error('Camera access was cancelled.');
          default:
            throw new Error(`Camera error: ${mediaError.message}`);
        }
      }

      // Connect the camera stream to the video element
      this.video.srcObject = this.camera.stream;
      this.video.setAttribute('playsinline', true); // required for iOS Safari

      // When video is ready to play
      this.video.onloadedmetadata = () => {
        this.video.play();

        // Enable scanning and update button
        this.camera.scanning = true;

        // Start scanning for QR codes
        // Use interval instead of requestAnimationFrame for better control over scan frequency
        this.camera.scanInterval = setInterval(() => this.readQRCode(), 100); // scan every 100ms (10 times per second)
      };

      // Add error handler for video element
      this.video.onerror = function (error) {
        console.error('Video element error:', error);
        this.stopCamera();
        throw new Error('Failed to start video stream');
      };
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.stopCamera(); // Ensure we clean up any partial setup

      // Show user-friendly error message
      showToast(error.message || 'Failed to access camera. Please check your permissions and try again.', 0, 'error');
    }
  }

  stopCamera() {
    if (this.camera.scanInterval) {
      clearInterval(this.camera.scanInterval);
      this.camera.scanInterval = null;
    }

    if (this.camera.stream) {
      this.camera.stream.getTracks().forEach((track) => track.stop());
      this.camera.stream = null;
      this.video.srcObject = null;
      this.camera.scanning = false;
    }
  }

  readQRCode() {
    if (this.camera.scanning && this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      // Set canvas size to match video dimensions
      this.canvasElement.height = this.video.videoHeight;
      this.canvasElement.width = this.video.videoWidth;

      // Draw video frame onto canvas
      this.canvas.drawImage(this.video, 0, 0, this.canvasElement.width, this.canvasElement.height);

      // Get image data for QR processing
      const imageData = this.canvas.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);

      try {
        // Process image with qr.js library
        // qr.decodeQR expects an object { data, height, width }
        const decodedText = qr.decodeQR({
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
        });

        // If QR code found and decoded
        if (decodedText) {
          this.handleSuccessfulScan(decodedText);
        }
      } catch (error) {
        // qr.decodeQR throws error if not found or on error
        //console.log('QR scanning error or not found:', error); // Optional: Log if needed since function is called every 100ms
      }
    }
  }

  handleSuccessfulScan(data) {
    this.close();
    if (this.fillFunction) this.fillFunction(data); // Call the assigned fill function (e.g., fillPaymentFromQR or fillStakeAddressFromQR)
  }
}

const scanQRModal = new ScanQRModal();

/**
 * Validate the balance of the user
 * @param {BigInt} amount - The amount to validate
 * @param {number} assetIndex - The index of the asset to validate
 * @param {HTMLElement} balanceWarning - The element to display the balance warning
 * @returns {Promise<boolean>} - A promise that resolves to true if the balance is sufficient, false otherwise
 */
async function validateBalance(amount, assetIndex = 0, balanceWarning = null) {
  if (balanceWarning) balanceWarning.style.display = 'none';
  // not checking for 0 since we allow 0 amount for messages when toll is not required
  if (amount < 0n) {
    if (balanceWarning) balanceWarning.style.display = 'inline';
    balanceWarning.textContent = 'Amount cannot be negative';
    return false;
  }

  await getNetworkParams();
  const asset = myData.wallet.assets[assetIndex];
  
  // Check if transaction fee is available from network parameters
  if (!parameters.current || !parameters.current.transactionFeeUsdStr) {
    console.error('Transaction fee not available from network parameters');
    if (balanceWarning) {
      balanceWarning.textContent = 'Network error: Cannot determine transaction fee';
      balanceWarning.style.display = 'inline';
    }
    return false;
  }
  
  const feeInWei = getTransactionFeeWei();
  const totalRequired = amount + feeInWei;
  const hasInsufficientBalance = BigInt(asset.balance) < totalRequired;

  if (balanceWarning) {
    if (hasInsufficientBalance) {
      // Check if the fee makes the difference
      const insufficientForAmount = BigInt(asset.balance) < amount;
      
      if (insufficientForAmount) {
        balanceWarning.textContent = 'Insufficient balance';
      } else {
        balanceWarning.textContent = 'Insufficient balance (including fee)';
      }
      balanceWarning.style.display = 'inline';
    } else {
      balanceWarning.style.display = 'none';
    }
  }

  // use ! to return true if the balance is sufficient, false otherwise
  return !hasInsufficientBalance;
}

// Sign In Modal Management
class SignInModal {
  constructor() {
    this.preselectedUsername = null;
  }

  load () {
    this.modal = document.getElementById('signInModal');
    this.usernameSelect = document.getElementById('username');
    this.submitButton = document.querySelector('#signInForm button[type="submit"]');
    this.removeButton = document.getElementById('removeAccountButton');
    this.notFoundMessage = document.getElementById('usernameNotFound');
    this.signInModalLastItem = document.getElementById('signInModalLastItem');
    this.backButton = document.getElementById('closeSignInModal');

    // Sign in form submission
    document.getElementById('signInForm').addEventListener('submit', (event) => this.handleSignIn(event));
    
    // Username selection change
    this.usernameSelect.addEventListener('change', () => this.handleUsernameChange());
    
    // Remove account button
    this.removeButton.addEventListener('click', () => this.handleRemoveAccount());

    // Back button
    this.backButton.addEventListener('click', () => this.close());
  }

  // Centralized UI state helpers for availability results
  setUiForMine() {
    this.submitButton.disabled = false;
    this.submitButton.textContent = 'Sign In';
    this.submitButton.style.display = 'inline';
    this.removeButton.style.display = 'none';
    this.notFoundMessage.style.display = 'none';
  }

  setUiDisabledSignIn() {
    this.submitButton.disabled = true;
    this.submitButton.textContent = 'Sign In';
    this.submitButton.style.display = 'inline';
    this.removeButton.style.display = 'none';
    this.notFoundMessage.style.display = 'none';
  }

  setUiForTaken() {
    this.submitButton.style.display = 'none';
    this.removeButton.style.display = 'inline';
    this.notFoundMessage.textContent = 'taken';
    this.notFoundMessage.style.display = 'inline';
  }

  setUiForAvailableNotFound() {
    this.submitButton.disabled = false;
    this.submitButton.textContent = 'Recreate';
    this.submitButton.style.display = 'inline';
    this.removeButton.style.display = 'inline';
    this.notFoundMessage.textContent = 'not found';
    this.notFoundMessage.style.display = 'inline';
  }

  setUiForNetworkError() {
    this.submitButton.disabled = true;
    this.submitButton.textContent = 'Sign In';
    this.submitButton.style.display = 'none';
    this.removeButton.style.display = 'none';
    this.notFoundMessage.textContent = 'network error';
    this.notFoundMessage.style.display = 'inline';
    showToast('The gateway server is down, please try again later.', 5000, 'warning');
  }

  // When auto-selecting after account creation, the network may not have propagated
  // the alias yet. In that case we suppress the
  // transient "not found" and allow local sign-in using stored state.
  applyAutoSelectNotFoundOverride() {
    this.notFoundMessage.textContent = '';
    this.notFoundMessage.style.display = 'none';
    this.submitButton.style.display = 'inline';
    this.submitButton.disabled = false;
    this.submitButton.textContent = 'Sign In';
    this.removeButton.style.display = 'none';
  }

  /**
   * Get the available usernames for the current network
   * @returns {string[]} - An array of available usernames
   */
  getSignInUsernames() {
    const { netid } = network;
    const accounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = accounts.netids[netid];
    if (!netidAccounts || !netidAccounts.usernames) return [];
    return { usernames: Object.keys(netidAccounts.usernames), netidAccounts };
  }

  /**
   * Update the username select dropdown with notification indicators and sort by notification status
   * @param {string} [selectedUsername] - Optionally preserve a selected username
   * @returns {Object} Object containing usernames array and account information
   */
  updateUsernameSelect(selectedUsername = null) {
    const signInData = signInModal.getSignInUsernames() || {};
    const usernames = Array.isArray(signInData.usernames) ? signInData.usernames : [];
    const netidAccounts = signInData.netidAccounts || { usernames: {} };
    const { netid } = network;

    // Get the notified addresses and sort usernames to prioritize them
    const notifiedAddresses = reactNativeApp.isReactNativeWebView ? reactNativeApp.getNotificationAddresses() : [];
    let sortedUsernames = [...usernames];
    const notifiedUsernameSet = new Set();
    
    // if there are notified addresses, partition the usernames (stable) so notified come first
    if (notifiedAddresses.length > 0) {
      const normalizedNotifiedSet = new Set(notifiedAddresses.map(addr => normalizeAddress(addr)));
      const notifiedUsernames = [];
      const otherUsernames = [];
      for (const username of sortedUsernames) {
        const address = netidAccounts?.usernames?.[username]?.address;
        const isNotified = address && normalizedNotifiedSet.has(normalizeAddress(address));
        if (isNotified) {
          notifiedUsernames.push(username);
          notifiedUsernameSet.add(username);
        } else {
          otherUsernames.push(username);
        }
      }
      sortedUsernames = [...notifiedUsernames, ...otherUsernames];
    }

    // Populate select with sorted usernames.
    // Build a map of privacy flags to avoid multiple loadState calls and
    // render options via a small helper to reduce duplication.
    const isPrivateMap = Object.create(null);
    for (const username of sortedUsernames) {
      let isPrivateAccount = false;
      try {
        const localState = loadState(`${username}_${netid}`);
        isPrivateAccount = localState?.account?.private === true;
      } catch (e) {
        isPrivateAccount = false;
      }
      isPrivateMap[username] = isPrivateAccount;
    }

    // Keep notified accounts (any privacy) at the very top, in the order
    // they appear in sortedUsernames. Then render remaining public accounts,
    // and finally remaining private accounts grouped under a disabled label.
    const notifiedTop = sortedUsernames.filter(u => notifiedUsernameSet.has(u));
    const remaining = sortedUsernames.filter(u => !notifiedUsernameSet.has(u));
    const publicRemaining = remaining.filter(u => !isPrivateMap[u]);
    const privateRemaining = remaining.filter(u => isPrivateMap[u]);

    const renderOption = (username) => {
      const isNotifiedAccount = notifiedUsernameSet.has(username);
      const dotIndicator = isNotifiedAccount ? ' 🔔' : '';
      const optionColor = isPrivateMap[username] ? 'var(--danger-color)' : 'var(--text-color)';
      const displayName = isPrivateMap[username] ? `- ${username}` : username;
      return `<option value="${username}" style="color: ${optionColor};">${displayName}${dotIndicator}</option>`;
    };

    let html = `<option value="" disabled selected hidden>Select an account</option>`;

    if (notifiedTop.length > 0) {
      html += notifiedTop.map(renderOption).join('');
    }

    if (publicRemaining.length > 0) {
      html += publicRemaining.map(renderOption).join('');
    }

    // Private accounts grouped with a disabled label (avoids optgroup indentation)
    if (privateRemaining.length > 0) {
      html += `<option value="" disabled style="font-weight:600; color:var(--danger-color);">Private accounts</option>`;
      html += privateRemaining.map(renderOption).join('');
    }

    this.usernameSelect.innerHTML = html;

    // Restore the previously selected username if it exists
    if (selectedUsername && usernames.includes(selectedUsername)) {
      this.usernameSelect.value = selectedUsername;
    }

    // Update selected styling (so chosen private account shows red when the dropdown is closed)
    this.updateSelectedAccountPrivateIndicator(netid);

    return { usernames, netidAccounts, sortedUsernames };
  }

  updateSelectedAccountPrivateIndicator(netid) {
    const username = this.usernameSelect.value;
    if (!username) {
      this.usernameSelect.classList.remove('is-private');
      return;
    }

    let isPrivateAccount = false;
    try {
      const localState = loadState(`${username}_${netid}`);
      isPrivateAccount = localState?.account?.private === true;
    } catch (e) {
      isPrivateAccount = false;
    }
    this.usernameSelect.classList.toggle('is-private', isPrivateAccount);
  }

  async open(preselectedUsername_) {
    this.preselectedUsername = preselectedUsername_;

    // Update username select and get usernames BEFORE opening modal
    const { usernames } = this.updateUsernameSelect();

    // Wait for browser to process DOM changes before starting modal transition
    requestAnimationFrame(async () => {
      this.modal.classList.add('active');

      // If no accounts exist, close modal and open Create Account modal
      if (usernames.length === 0) {
        this.close();
        createAccountModal.open();
        return;
      }

      // If a username should be auto-selected (either preselect or only one account), do it
      if ((preselectedUsername_ && usernames.includes(preselectedUsername_))) {
        this.usernameSelect.value = this.preselectedUsername;
        await this.handleUsernameChange();
        // happens when autoselect parameter is given since new account was just created and network may not have propagated account
        if (this.notFoundMessage.textContent === 'not found') {
          this.applyAutoSelectNotFoundOverride();
          this.handleSignIn();
        }
        return;
      }

      // If only one account exists, select it and trigger change event
      if (usernames.length === 1) {
        this.usernameSelect.value = usernames[0];
        this.usernameSelect.dispatchEvent(new Event('change'));
        return;
      }

      // Multiple accounts exist, show modal with select dropdown
      this.setUiDisabledSignIn();

      // set timeout to focus on the last item so shift+tab and tab prevention works
      setTimeout(() => {
        this.signInModalLastItem.focus();
      }, 325);
    });
  }

  close() {
    // clear signInModal input fields
    this.usernameSelect.value = '';
    this.setUiDisabledSignIn();
    
    this.modal.classList.remove('active');
    this.preselectedUsername = null;
  }

  async handleSignIn(event) {
    if (event) {
      event.preventDefault();
    }

    history.pushState({state:1}, "", ".")
    window.addEventListener('popstate', handleBrowserBackButton);
    
    enterFullscreen();
    
    const username = this.usernameSelect.value;

    // Get network ID from network.js
    const { netid } = network;

    // Get existing accounts
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Check if username exists
    if (!existingAccounts.netids[netid]?.usernames?.[username]) {
      console.error('Account not found');
      return;
    }

    // Check if the button text is 'Recreate'
    if (this.submitButton.textContent === 'Recreate') {
//      const myData = parse(localStorage.getItem(`${username}_${netid}`));
      const myData = loadState(`${username}_${netid}`);
      const privateKey = myData.account.keys.secret;
      createAccountModal.usernameInput.value = username;

      createAccountModal.privateKeyInput.value = privateKey;
      this.close();
      createAccountModal.open();
      // Dispatch a change event to trigger the availability check
      createAccountModal.usernameInput.dispatchEvent(new Event('input'));
      return;
    }

    myData = loadState(`${username}_${netid}`)
    if (!myData) {
      console.warn('Account data not found');
      return;
    }
    myAccount = myData.account;
    logsModal.log(`SignIn as ${username}_${netid}`)

    // One-time migration: convert legacy friend status to connection
    if (migrateFriendStatusToConnection(myData)) {
      saveState();
    }


    // One-time migration: extract attachment encryption keys to encKey field
    if (await migrateAttachmentKeysToEncKey(myData)) {
      saveState();
    }

    // Clear notification address for this account when signing in
    // Notification storage is only for accounts the user is NOT signed in to
    if (reactNativeApp.isReactNativeWebView && myAccount?.keys?.address) {
      const addressToClear = myAccount.keys.address;
      reactNativeApp.clearNotificationAddress(addressToClear);
      reactNativeApp.sendClearNotifications(addressToClear);
    }

    /* requestNotificationPermission(); */
    if (useLongPolling) {
      setTimeout(longPoll, 10);
    }
    if (!checkPendingTransactionsIntervalId) {
      checkPendingTransactionsIntervalId = setInterval(checkPendingTransactions, 5000);
    }
    if (!getSystemNoticeIntervalId) {
      getSystemNoticeIntervalId = setInterval(getSystemNotice, 15000);
    }

    // Register events that will saveState if the browser is closed without proper signOut
    // Add beforeunload handler to save myData; don't use unload event, it is getting depricated
    window.addEventListener('beforeunload', handleBeforeUnload);

    reactNativeApp.handleNativeAppUnsubscribe();
    reactNativeApp.sendNavigationBarVisibility(false);

    // Close modal and proceed to app
    this.close();
    welcomeScreen.close();
    
    // Log storage information after successful sign-in
    try {
      const storageInfo = localStorageMonitor.getStorageInfo();
      logsModal.log(`💾 Storage Status: ${storageInfo.usageMB}MB used, ${storageInfo.availableMB}MB available (${storageInfo.percentageUsed}% used)`);
    } catch (error) {
      logsModal.log('⚠️ Could not retrieve storage information');
    }
    
    await footer.switchView('chats'); // Default view
    
    // Restore wallet/history notification dots if there are unread transfers
    if (myData?.wallet?.history && Array.isArray(myData.wallet.history) && myData.wallet.history.length > 0) {
      restoreWalletNotificationDots();
    }
    
    // Initialize upcoming calls icon and start periodic refresh
    callsModal.refreshCalls();
    header.updateCallsIcon();
    callsModal.startPeriodicCallsRefresh();
  }

  async handleUsernameChange() {
    // Get existing accounts
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];
    const usernames = netidAccounts?.usernames ? Object.keys(netidAccounts.usernames) : [];
    // Enable submit button when an account is selected
    const username = this.usernameSelect.value;
    if (!username) {
      this.submitButton.disabled = true;
      this.notFoundMessage.style.display = 'none';
      return;
    }

    // Update selected styling
    this.updateSelectedAccountPrivateIndicator(netid);
    //        const address = netidAccounts.usernames[username].keys.address;
    const address = netidAccounts.usernames[username].address;
    let availability = await checkUsernameAvailability(username, address);
    // Retry logic: if availability reported as 'available' but we have local account data
    // (meaning the account previously existed locally), we suspect propagation delay.
    if (availability === 'available' && netidAccounts?.usernames?.[username]) {
      const localStateKey = `${username}_${netid}`;
      const hasLocalState = !!localStorage.getItem(localStateKey);
      if (hasLocalState) {
        const maxAttempts = 3; // total attempts including initial (so 2 more re-tries)
        const delayMs = 200;
        let attempt = 1;
        while (attempt < maxAttempts && availability === 'available') {
          attempt++;
          logsModal.log(`[SignInModal] Retry ${attempt}/${maxAttempts} username availability for '${username}' because local data exists but network returned 'available'.`);
          try {
            await new Promise(res => setTimeout(res, delayMs));
            availability = await checkUsernameAvailability(username, address);
          } catch (err) {
            break; // break on explicit error; will treat as network error below if availability not set
          }
        }
        if (availability === 'available') {
          logsModal.log(`[SignInModal] After ${maxAttempts} attempts username '${username}' still reported as available. Assuming account deleted on network; offering recreate/delete options.`);
        } else {
          logsModal.log(`[SignInModal] Availability resolved to '${availability}' after retries for '${username}'.`);
        }
      }
    }
    //console.log('usernames.length', usernames.length);
    //console.log('availability', availability);

    // If this username was pre-selected and is available, auto-sign-in
    if (this.preselectedUsername && username === this.preselectedUsername && availability === 'mine') {
      this.handleSignIn();
      this.preselectedUsername = null;
      return;
    }
    if (usernames.length === 1 && availability === 'mine') {
      this.handleSignIn();
      return;
    } else if (availability === 'mine') {
      this.setUiForMine();
    } else if (availability === 'taken') {
      this.setUiForTaken();
    } else if (availability === 'available') {
      this.setUiForAvailableNotFound();
    } else {
      this.setUiForNetworkError();
    }
  }

  async handleRemoveAccount() {
    const username = this.usernameSelect.value;
    if (!username) {
      showToast('Please select an account to remove', 2000, 'warning');
      return;
    }
    removeAccountModal.removeAccount(username);
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  /**
   * Update the display to reflect new notifications while the modal is open
   * This is called when new notifications arrive while the modal is open
   */
  updateNotificationDisplay() {
    // Only update if the modal is actually active
    if (!this.isActive()) return;
    
    // Get the currently selected username so we can keep it selected after the update
    const selectedUsername = this.usernameSelect.value;
    
    // Update the dropdown with sorted usernames and notification indicators
    // This will also preserve the selected username if it still exists
    this.updateUsernameSelect(selectedUsername);
  }
}

// create a singleton instance of the SignInModal
const signInModal = new SignInModal();

// Contact Info Modal Management
class MyInfoModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('myInfoModal');
    this.backButton = document.getElementById('closeMyInfoModal');
    this.editButton = document.getElementById('myInfoEditButton');
    this.avatarSection = this.modal.querySelector('.contact-avatar-section');
    this.avatarDiv = this.avatarSection.querySelector('.avatar');
    this.nameDiv = this.avatarSection.querySelector('.name');
    this.addressDiv = document.getElementById('myInfoDisplayUsername');
    this.copyButton = document.getElementById('myInfoCopyAddress');
    this.qrContainer = this.modal.querySelector('#myInfoQR');
    this.fullAddress = null; // Store full address for copying

    // Create avatar edit button
    this.avatarEditButton = document.createElement('button');
    this.avatarEditButton.className = 'icon-button edit-icon avatar-edit-button avatar-edit-button-outside';
    this.avatarEditButton.setAttribute('aria-label', 'Edit photo');

    this.backButton.addEventListener('click', () => this.close());
    this.editButton.addEventListener('click', () => myProfileModal.open());

    // Copy address functionality
    this.copyButton.addEventListener('click', () => this.copyAddress());
    this.addressDiv.addEventListener('click', () => this.copyAddress());

    // Avatar edit button click
    this.avatarEditButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAvatarEdit();
    });

    // Make the avatar itself clickable
    this.avatarDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAvatarEdit();
    });

    // Attach edit button to the avatar div
    if (!this.avatarDiv.contains(this.avatarEditButton)) {
      this.avatarDiv.appendChild(this.avatarEditButton);
    }
  }

  // Helper method to open avatar edit modal for own avatar
  openAvatarEdit() {
    if (!myAccount?.keys?.address) return;
    avatarEditModal.open(myAccount.keys.address, true); // true = isOwnAvatar
  }

  async updateMyInfo() {
    if (!myAccount) return;

    // Use getContactAvatarHtml for consistent avatar rendering
    // Include account avatar fields so user preference (`useAvatar`) is respected
    const avatarHtml = await getContactAvatarHtml(
      {
        address: myAccount.keys.address,
        hasAvatar: myData?.account?.hasAvatar,
        avatarId: myData?.account?.avatarId,
      },
      96
    );
    this.avatarDiv.innerHTML = avatarHtml;

    // Re-append the avatar edit button after setting the avatar content
    if (!this.avatarDiv.contains(this.avatarEditButton)) {
      this.avatarDiv.appendChild(this.avatarEditButton);
    }

    this.nameDiv.textContent = myAccount.username;
    const address = myAccount.keys.address;
    const addressWithPrefix = address.startsWith('0x') ? address : `0x${address}`;
    
    // Store full address for copying
    this.fullAddress = addressWithPrefix;
    
    // Display full address (address is always shown, so no need to check display)
    this.addressDiv.textContent = addressWithPrefix;

    const { account = {} } = myData ?? {};
    const fields = {
      name:      { id: 'myInfoName',      label: 'Name' },
      // Email and Phone fields hidden - may want to restore later
      // email:     { id: 'myInfoEmail',     label: 'Email',    href: v => `mailto:${v}` },
      // phone:     { id: 'myInfoPhone',     label: 'Phone' },
      linkedin:  { id: 'myInfoLinkedin',  label: 'LinkedIn', href: v => `https://linkedin.com/in/${v}` },
      x:         { id: 'myInfoX',         label: 'X',        href: v => `https://x.com/${v}` },
    };

    // Cache DOM elements once
    const elements = Object.fromEntries(
      Object.values(fields).map(({ id }) => [id, document.getElementById(id)])
    );

    // Iterate through each profile field to populate or hide it based on whether data exists
    // For fields with values: display the container, set the text content, and set href if applicable
    // For fields without values: hide the container
    for (const [fieldKey, fieldConfig] of Object.entries(fields)) {
      const element = elements[fieldConfig.id];
      if (!element) continue; // skip if element not found in DOM
      
      // For clickable links (email, linkedin, x), the element is nested deeper in the DOM
      const container =
        fieldKey === 'email' || fieldKey === 'linkedin' || fieldKey === 'x'
          ? element.parentElement.parentElement // label + anchor live two levels up
          : element.parentElement;

      const value = account[fieldKey] ?? '';
      const isEmpty = !value;

      // Always show the Name field, hide others when empty
      container.style.display = (fieldKey === 'name' || !isEmpty) ? 'flex' : 'none';
      if (isEmpty && fieldKey !== 'name') continue;

      // Populate the field with data
      if (fieldKey === 'name') {
        element.textContent = isEmpty ? 'Not Entered' : value;
        element.classList.toggle('contact-info-value--empty', isEmpty);
      } else {
        element.textContent = value;
        if (fieldConfig.href) element.href = fieldConfig.href(value);
      }
    }
    this.renderUsernameQR();
  }

  async open() {
    await this.updateMyInfo();
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  // Generate a QR code that contains ONLY the username as raw text
  renderUsernameQR() {
    try {
      if (!this.qrContainer) return;
      this.qrContainer.innerHTML = '';
      const username = myAccount?.username || '';
      if (!username) return;

      // Build minimal payload and encode as liberdus://<base64(JSON)>
      const payload = { u: username };
      const jsonData = JSON.stringify(payload);
      const base64Data = bin2base64(utf82bin(jsonData));
      const qrText = `liberdus://${base64Data}`;

      // Generate QR using the global qr library as GIF (consistent with other QRs)
      const gifBytes = qr.encodeQR(qrText, 'gif', { scale: 4 });
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
      const dataUrl = 'data:image/gif;base64,' + base64;
      const img = document.createElement('img');
      img.src = dataUrl;
      img.width = 160;
      img.height = 160;
      img.alt = 'Username QR code';
      this.qrContainer.appendChild(img);
    } catch (e) {
      console.error('Failed to render username QR:', e);
    }
  }

  async copyAddress() {
    // Copy the full address, not the displayed truncated version and toast 
    const address = this.fullAddress || this.addressDiv.textContent;
    try {
      await navigator.clipboard.writeText(address);
      showToast('Address copied to clipboard', 2000, 'success');
      this.copyButton.classList.add('success');
      setTimeout(() => {
        this.copyButton.classList.remove('success');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy address', 0, 'error');
    }
  }
}

// Create a singleton instance
const myInfoModal = new MyInfoModal();

class ContactInfoModal {
  constructor() {
    this.currentContactAddress = null;
    this.needsContactListUpdate = false; // track if we need to update the contact list
    this.fullAddress = null; // Store full address for copying
  }

  // Helper method to open avatar edit modal
  openAvatarEdit() {
    if (!this.currentContactAddress) return;
    avatarEditModal.open(this.currentContactAddress);
  }

  // Initialize event listeners that only need to be set up once
  load() {
    this.modal = document.getElementById('contactInfoModal');
    this.backButton = document.getElementById('closeContactInfoModal');
    this.nameEditButton = document.getElementById('nameEditButton');
    this.chatButton = document.getElementById('contactInfoChatButton');
    this.sendButton = document.getElementById('contactInfoSendButton');
    this.addFriendButton = document.getElementById('addFriendButtonContactInfo');
    this.avatarSection = this.modal.querySelector('.contact-avatar-section');
    this.avatarDiv = this.avatarSection.querySelector('.avatar');
    this.nameDiv = this.avatarSection.querySelector('.name');
    this.subtitleDiv = document.getElementById('contactInfoDisplayAddress');
    this.copyButton = document.getElementById('contactInfoCopyAddress');
    this.usernameDiv = document.getElementById('contactInfoUsername');
    this.avatarEditButton = document.createElement('button');
    this.avatarEditButton.className = 'icon-button edit-icon avatar-edit-button avatar-edit-button-outside';
    this.avatarEditButton.setAttribute('aria-label', 'Edit photo');
    this.notesElement = document.getElementById('contactInfoNotes');
    this.notesEditButton = document.getElementById('notesEditButton');

    // Back button
    this.backButton.addEventListener('click', () => this.close());

    this.nameEditButton.addEventListener('click', () => editContactModal.open('name'));

    // Add chat button handler for contact info modal
    this.chatButton.addEventListener('click', () => {
      const addressToOpen = this.currentContactAddress;
      if (addressToOpen) {
        // Ensure we have an address before proceeding
        this.close();
        chatModal.open(addressToOpen);
      }
    });

    // Add send money button handler
    this.sendButton.addEventListener('click', () => {
      sendAssetFormModal.username = this.usernameDiv.textContent;
      sendAssetFormModal.open();
    });

    // Add add friend button handler
    this.addFriendButton.addEventListener('click', () => {
      if (!this.currentContactAddress) return;
      friendModal.open();
    });

    // Avatar edit button
    this.avatarEditButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering avatar click
      this.openAvatarEdit();
    });

    // Notes edit button
    this.notesEditButton.addEventListener('click', (e) => {
      e.stopPropagation();
      editContactModal.open('notes');
    });

    // Make the avatar itself clickable
    this.avatarDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAvatarEdit();
    });

    // Attach edit button to the avatar div
    if (!this.avatarDiv.contains(this.avatarEditButton)) {
      this.avatarDiv.appendChild(this.avatarEditButton);
    }

    // Copy address functionality
    this.copyButton.addEventListener('click', () => this.copyAddress());
    this.subtitleDiv.addEventListener('click', () => this.copyAddress());
  }

  // Update contact info values
  async updateContactInfo(displayInfo) {
    const avatarHtml = await getContactAvatarHtml(displayInfo, 96);

    // Update the avatar section
    this.avatarDiv.innerHTML = avatarHtml;

    // Re-append the avatar edit button after setting the avatar content
    if (!this.avatarDiv.contains(this.avatarEditButton)) {
      this.avatarDiv.appendChild(this.avatarEditButton);
    }
    this.nameDiv.textContent = displayInfo.name !== 'Not Entered' ? displayInfo.name : displayInfo.username;
    
    // Store and display address
    const addressWithPrefix = displayInfo.address?.startsWith('0x') ? displayInfo.address : `0x${displayInfo.address || ''}`;
    this.fullAddress = addressWithPrefix;
    this.subtitleDiv.textContent = addressWithPrefix;

    const fields = {
      Username: 'contactInfoUsername',
      Name: 'contactInfoName',
      ProvidedName: 'contactInfoProvidedName',
      // Email and Phone fields hidden - may want to restore later
      // Email: 'contactInfoEmail',
      // Phone: 'contactInfoPhone',
      LinkedIn: 'contactInfoLinkedin',
      X: 'contactInfoX',
    };

    Object.entries(fields).forEach(([field, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      const rawValue = displayInfo[field.toLowerCase()];
      const value = (rawValue === null || rawValue === undefined || rawValue === '') ? 'Not provided' : rawValue;
      const isEmpty = value === 'Not provided' || value === '';
      
      // Get the container to show/hide (contact-info-item div)
      const container = field === 'Email' || field === 'LinkedIn' || field === 'X' 
        ? element.parentElement.parentElement 
        : element.parentElement;

      if (isEmpty) {
        // Hide the entire field container (including label)
        container.style.display = 'none';
        return;
      }

      // Show the container and set the value (use flex to maintain side-by-side layout)
      container.style.display = 'flex';
      
      if (field === 'Email') {
        element.textContent = value;
        element.href = `mailto:${value}`;
      } else if (field === 'LinkedIn') {
        element.textContent = value;
        element.href = `https://linkedin.com/in/${value}`;
      } else if (field === 'X') {
        element.textContent = value;
        element.href = `https://x.com/${value}`;
      } else {
        element.textContent = value;
        // Add empty class only if the stored value is actually empty
        if (field === 'Name') {
          const storedName = displayInfo.address && myData.contacts?.[displayInfo.address]?.name;
          element.classList.toggle('contact-info-value--empty', value === 'Not Entered' && !storedName);
        } else {
          element.classList.toggle('contact-info-value--empty', value === 'Not Entered');
        }
      }
    });

    // Notes
    const notesRaw = displayInfo.notes ?? (displayInfo.address && myData.contacts?.[displayInfo.address]?.notes);
    this.notesElement.textContent = notesRaw || 'Not Entered';
    this.notesElement.classList.toggle('contact-info-value--empty', !notesRaw);
  }

  // Set up chat button functionality
  setupChatButton(displayInfo) {
    if (displayInfo.address) {
      this.chatButton.style.display = 'block';
    } else {
      this.chatButton.style.display = 'none';
    }
  }

  async copyAddress() {
    // Copy the full address, not the displayed truncated version and toast
    const address = this.fullAddress || this.subtitleDiv.textContent;
    try {
      await navigator.clipboard.writeText(address);
      showToast('Address copied to clipboard', 2000, 'success');
      this.copyButton.classList.add('success');
      setTimeout(() => {
        this.copyButton.classList.remove('success');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy address', 0, 'error');
    }
  }

  // Open the modal
  async open(displayInfo) {
    friendModal.setAddress(displayInfo.address);
    this.currentContactAddress = displayInfo.address;
    await this.updateContactInfo(displayInfo);
    this.setupChatButton(displayInfo);

    // Update friend button status
    const contact = myData.contacts[displayInfo.address];
    if (contact) {
      friendModal.updateFriendButton(contact, 'addFriendButtonContactInfo');
    }

    this.modal.classList.add('active');
  }

  // Close the modal
  close() {
    this.currentContactAddress = null;
    this.modal.classList.remove('active');

    // If we made changes that affect the contact list, update it
    if (this.needsContactListUpdate) {
      contactsScreen.updateContactsList();
      this.needsContactListUpdate = false;
    }
  }

  /**
   * Check if the contact info modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }
}

// Create a singleton instance
const contactInfoModal = new ContactInfoModal();

/**
 * Friend Modal
 * Frontend: 0 = blocked, 1 = Other, 2 = Connection
 * Backend: 1 = toll required, 0 = toll not required, 2 = blocked
 * 
 * @description Modal for setting the friend status for a contact
 * @class FriendModal
 */
class FriendModal {
  constructor() {
    this.currentContactAddress = null;
    this.lastChangeTimeStamp = 0; // track the last time the friend status was changed
    this.initialFriendStatus = null; // track the initial friend status when modal opens
    this.warningShown = false; // track if warning has been shown
  }

  load() {
    this.modal = document.getElementById('friendModal');
    this.friendForm = document.getElementById('friendForm');
    this.submitButton = document.getElementById('friendSubmitButton');

    // Friend modal form submission
    this.friendForm.addEventListener('submit', (event) => this.handleFriendSubmit(event));

    // Enable/disable submit button based on selection changes
    this.friendForm.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'friendStatus') {
        this.updateSubmitButtonState();
      }
    });

    // Friend modal close button
    this.modal.querySelector('.back-button').addEventListener('click', () => this.close());
  }

  // Open the friend modal
  async open() {
    const contact = myData.contacts[this.currentContactAddress];
    if (!contact) return;

    // Query network for current toll required status
    try {
      const myAddr = longAddress(myAccount.keys.address);
      const contactAddr = longAddress(this.currentContactAddress);
      const sortedAddresses = [myAddr, contactAddr].sort();
      const chatId = hashBytes(sortedAddresses.join(''));
      const myIndex = sortedAddresses.indexOf(myAddr);

      const tollInfo = await queryNetwork(`/messages/${chatId}/toll`);
      const networkRequired = tollInfo?.toll?.required?.[myIndex];

      if (networkRequired !== undefined) {
        // Map backend required value to frontend status
        // Backend: 1 = toll required, 0 = toll not required, 2 = blocked
        // Frontend: 0 = blocked, 1 = Other, 2 = Connection
        let networkFriendStatus;
        if (networkRequired === 2) {
          networkFriendStatus = 0; // blocked
        } else if (networkRequired === 1) {
          networkFriendStatus = 1; // Other (toll required)
        } else if (networkRequired === 0) {
          // toll not required - connection
          networkFriendStatus = 2;
        }

        // Update contact's friend status if it differs from network
        if (networkFriendStatus !== undefined && networkFriendStatus !== contact.friend) {
          const previousFriendStatus = contact.friend;
          contact.friend = networkFriendStatus;
          contact.friendOld = networkFriendStatus;
          if (networkFriendStatus === 0 && previousFriendStatus !== 0) {
            await this.clearContactAvatar(contact);
          }
          // Update the friend button color
          this.updateFriendButton(contact, 'addFriendButtonContactInfo');
          this.updateFriendButton(contact, 'addFriendButtonChat');
        }
      }
    } catch (error) {
      console.error('Error querying toll required status:', error);
    }

    // Set the current friend status
    const status = contact.friend.toString();
    const radio = this.friendForm.querySelector(`input[value="${status}"]`);
    if (radio) radio.checked = true;

    // Store initial friend status for change detection
    this.initialFriendStatus = contact.friend;
    this.warningShown = false;

    // Initialize submit button state
    this.updateSubmitButtonState();

    this.modal.classList.add('active');
  }

  /**
   * Closes the friend modal with optional warning if friend status has changed
   * @param {boolean} skipWarning - If true, skip the warning check (e.g., when submitting form)
   */
  close(skipWarning = false) {
    if (!skipWarning && this.initialFriendStatus != null) {
      const currentStatus = Number(this.friendForm.querySelector('input[name="friendStatus"]:checked')?.value);
      if (!isNaN(currentStatus) && currentStatus !== this.initialFriendStatus && !this.warningShown) {
        this.warningShown = true;
        showToast('Press back again to discard changes.', 5000, 'warning');
        return;
      }
    }

    this.modal.classList.remove('active');
    this.initialFriendStatus = null;
    this.warningShown = false;
  }

  async postUpdateTollRequired(address, friend) {
    // 0 = blocked, 1 = Other, 2 = Connection
    // required = 1 if toll required, 0 if not and 2 to block other party
    const requiredNum = friend === 2 ? 0 : friend === 1 ? 1 : friend === 0 ? 2 : 1;
    const fromAddr = longAddress(myAccount.keys.address);
    const toAddr = longAddress(address);
    const chatId_ = hashBytes([fromAddr, toAddr].sort().join(''));

    const tx = {
      from: fromAddr,
      to: toAddr,
      chatId: chatId_,
      required: requiredNum,
      type: 'update_toll_required',
      timestamp: getCorrectedTimestamp(),
      networkId: network.netid,
    };
    const txid = await signObj(tx, myAccount.keys);
    const res = await injectTx(tx, txid);
    return res;
  }

  /**
  * Handle friend form submission
  * 0 = blocked, 1 = Other, 2 = Connection
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async handleFriendSubmit(event) {
    event.preventDefault();
    this.submitButton.disabled = true;
    const contact = myData.contacts[this.currentContactAddress];
    const selectedStatus = this.friendForm.querySelector('input[name="friendStatus"]:checked')?.value;
    const prevFriendStatus = Number(contact?.friend);

    if (selectedStatus == null || Number(selectedStatus) === contact.friend) {
      this.submitButton.disabled = true;
      console.log('No change in friend status or no status selected.');
      return;
    }

    if (Number(contact.friend) === 2 && Number(selectedStatus) === 2) {
      console.log('no need to post a change to the network since toll required would be 0 for both cases')
    } else {
      try {
        // send transaction to update chat toll
        const res = await this.postUpdateTollRequired(this.currentContactAddress, Number(selectedStatus));
        if (res?.result?.success !== true) {
          console.log(
            `[handleFriendSubmit] update_toll_required transaction failed: ${res?.result?.reason}. Did not update contact status.`
          );
          showToast('Failed to update friend status. Please try again.', 0, 'error');
          return;
        }
      } catch (error) {
        console.error('Error sending transaction to update chat toll:', error);
        showToast('Failed to update friend status. Please try again.', 0, 'error');
        return;
      }
    }

    if (Number(contact.friend) === 2 && Number(selectedStatus) === 2) {
      // set friend and friendold the same since no transaction is needed
      contact.friendOld = Number(selectedStatus);
    } else {
      // store the old friend status
      contact.friendOld = contact.friend;
    }
    // Update friend status based on selected value
    contact.friend = Number(selectedStatus);
    if (contact.friend === 0 && prevFriendStatus !== 0) {
      await this.clearContactAvatar(contact);
    }

    this.lastChangeTimeStamp = Date.now();

    // Show appropriate toast message depending value 0,1,2
    const toastMessage =
      contact.friend === 0
        ? 'Blocked'
        : contact.friend === 1
          ? 'Added as Tolled'
          : contact.friend === 2
            ? 'Added as Connection'
            : 'Error updating friend status';
    const toastType = toastMessage === 'Error updating friend status' ? 'error' : 'success';
    showToast(toastMessage, 2000, toastType);

    // Update the friend button
    this.updateFriendButton(contact, 'addFriendButtonContactInfo');
    this.updateFriendButton(contact, 'addFriendButtonChat');

    // Update the contact list
    await contactsScreen.updateContactsList();
    // Only refresh chats list if the change enters or exits "blocked"
    const nextFriendStatus = Number(selectedStatus);
    if (prevFriendStatus === 0 || nextFriendStatus === 0) {
      await chatsScreen.updateChatList();
    }

    // Close the friend modal (skip warning since form was submitted)
    this.close(true);
    this.submitButton.disabled = false;
  }

  // setAddress fuction that sets a global variable that can be used to set the currentContactAddress
  setAddress(address) {
    this.currentContactAddress = address;
  }

  /**
   * Update the friend button based on the contact's friend status
   * @param {Object} contact - The contact object
   * @param {string} buttonId - The ID of the button to update
   * @returns {void}
   */
  updateFriendButton(contact, buttonId) {
    const button = document.getElementById(buttonId);
    // Remove all status classes
    button.classList.remove('status-0', 'status-1', 'status-2');
    // Add the current status class
    button.classList.add(`status-${contact.friend}`);
  }

  async clearContactAvatar(contact) {
    if (!contact) return;

    const avatarId = contact.avatarId || contact?.senderInfo?.avatarId;
    if (avatarId) {
      try {
        await contactAvatarCache.delete(avatarId);
      } catch (e) {
        console.warn('Failed to delete contact avatar:', e);
      }
    }

    contact.avatarId = null;
    contact.hasAvatar = false;
    if (contact.senderInfo) {
      delete contact.senderInfo.avatarId;
      delete contact.senderInfo.avatarKey;
    }
    if (contact.useAvatar === 'contact') {
      delete contact.useAvatar;
    }

    saveState();

    if (chatModal.isActive() && chatModal.address === contact.address) {
      chatModal.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);
      chatModal.appendChatModal(true);
    }
    if (typeof chatsScreen !== 'undefined') {
      chatsScreen.updateChatList();
    }
  }

  // Update the submit button's enabled state based on current and selected status
  updateSubmitButtonState() {
    const contact = myData?.contacts?.[this.currentContactAddress];
    // return early if contact is not found or offline
    if (!contact || !isOnline) {
      this.submitButton.disabled = true;
      return;
    }

    // If there's already a pending tx (friend != friendOld) keep disabled
    if (contact.friend !== contact.friendOld) {
      const SIXTY_SECONDS = 60 * 1000;
      // if the last change was more than 60 seconds ago, reset the friend status so user does not get stuck
      if (this.lastChangeTimeStamp < (Date.now() - SIXTY_SECONDS)) {
        contact.friend = contact.friendOld
      } else {
        this.submitButton.disabled = true;
        showToast('You have a pending transaction to update the friend status. Come back to this page later.', 0, 'error');
        return;
      }
    }

    const selectedStatus = this.friendForm.querySelector('input[name="friendStatus"]:checked')?.value;
    if (!selectedStatus) {
      this.submitButton.disabled = true;
      return;
    }

    // Enable only if different from current friend status
    this.submitButton.disabled = Number(selectedStatus) === contact.friend;
  }

  // get the current contact address
  getCurrentContactAddress() {
    return this.currentContactAddress || false;
  }

  isActive() {
    return this.modal?.classList.contains('active') || false;
  }
}

const friendModal = new FriendModal();

class EditContactModal {
  constructor() {
    this.currentContactAddress = null;
  }

  load() {
    this.modal = document.getElementById('editContactModal');
    this.nameInput = document.getElementById('editContactNameInput');
    this.nameClearButton = document.getElementById('nameClearButton');
    this.providedNameContainer = document.getElementById('editContactProvidedNameContainer');
    this.notesInput = document.getElementById('editContactNotesInput');
    this.notesClearButton = document.getElementById('notesClearButton');
    this.saveButton = document.getElementById('saveEditContactButton');
    this.backButton = document.getElementById('closeEditContactModal');
    this.avatarSection = this.modal.querySelector('#editContactModal .contact-avatar-section');
    this.avatarDiv = this.avatarSection.querySelector('.avatar');

    // Setup event listeners
    this.nameInput.addEventListener('input', (e) => this.handleNameInput(e));
    this.nameInput.addEventListener('blur', () => this.handleNameBlur());
    this.nameInput.addEventListener('keydown', (e) => this.handleNameKeydown(e));
    this.nameClearButton.addEventListener('click', () => this.handleNameClear());
    this.notesClearButton.addEventListener('click', () => this.handleNotesClear());
    this.saveButton.addEventListener('click', () => this.handleSave());
    this.providedNameContainer.addEventListener('click', () => this.handleProvidedNameClick());
    this.backButton.addEventListener('click', () => this.close());
    this.avatarDiv.addEventListener('click', (e) => this.handleAvatarEdit(e));
  }

  open(focusField = 'name') {
    // Get the avatar section elements
    const nameDiv = this.avatarSection.querySelector('.name');
    const subtitleDiv = this.avatarSection.querySelector('.subtitle');

    // Update the avatar section
    this.avatarDiv.innerHTML = document.getElementById('contactInfoAvatar').innerHTML;
    // update the name and subtitle
    nameDiv.textContent = contactInfoModal.usernameDiv.textContent;
    subtitleDiv.textContent = contactInfoModal.subtitleDiv.textContent;

    // update the provided name
    const providedNameDiv = this.providedNameContainer.querySelector('.contact-info-value');

    // if the textContent is 'Not provided', set it to an empty string
    const providedName = document.getElementById('contactInfoProvidedName').textContent;
    if (providedName === 'Not provided' || !providedName || providedName.trim() === '') {
      this.providedNameContainer.style.display = 'none';
    } else {
      providedNameDiv.textContent = providedName;
      this.providedNameContainer.style.display = 'flex';
    }

    // Get the original name from the contact info display
    const contactNameDisplay = document.getElementById('contactInfoName');
    let originalName = contactNameDisplay.textContent;
    if (originalName === 'Not Entered') {
      originalName = '';
    }

    // Set up the input field with the original name
    this.nameInput.value = originalName;


    // Get the current contact info from the contact info modal
    this.currentContactAddress = contactInfoModal.currentContactAddress;
    if (!this.currentContactAddress || !myData.contacts[this.currentContactAddress]) {
      console.error('No current contact found');
      return;
    }

    // Populate notes field
    const contactNotes = myData.contacts[this.currentContactAddress]?.notes || '';
    this.notesInput.value = contactNotes;

    // Show the edit contact modal
    this.modal.classList.add('active');
    // Delay focus to ensure transition completes (modal transition is 300ms)
    setTimeout(() => {
      const inputToFocus = focusField === 'notes' ? this.notesInput : this.nameInput;
      inputToFocus.focus();
      // Set cursor position to the end of the input content
      inputToFocus.setSelectionRange(inputToFocus.value.length, inputToFocus.value.length);
    }, 325);
  }

  close() {
    this.modal.classList.remove('active');
    this.currentContactAddress = null;
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  async updateAvatar(contact) {
    const avatarHtml = await getContactAvatarHtml(contact, 96);
    this.avatarDiv.innerHTML = avatarHtml;
  }

  handleAvatarEdit(e) {
    // Open avatar edit modal when clicking anywhere in the avatar div (button or image)
    e.stopPropagation();
    this.openAvatarEdit();
  }

  openAvatarEdit() {
    if (!this.currentContactAddress) return;
    avatarEditModal.open(this.currentContactAddress);
  }

  handleProvidedNameClick() {
    const providedNameValue = this.providedNameContainer.querySelector('.contact-info-value').textContent;
    
    // Fill the input with the provided name
    this.nameInput.value = providedNameValue;
    
    // Focus on the input and set cursor to end
    this.nameInput.focus();
    this.nameInput.setSelectionRange(this.nameInput.value.length, this.nameInput.value.length);

    // Invoke input event
    this.nameInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  handleNameInput() {
    // normalize the input using normalizeName
    const normalizedName = normalizeName(this.nameInput.value);
    this.nameInput.value = normalizedName;
  }

  handleNameBlur() {
    // normalize the input using normalizeName
    const normalizedName = normalizeName(this.nameInput.value, true);
    this.nameInput.value = normalizedName;
  }

  handleNameClear() {
    // Clear the name field
    this.nameInput.value = '';
    this.nameInput.focus();
  }

  handleNotesClear() {
    // Clear the notes field
    this.notesInput.value = '';
    this.notesInput.focus();
  }

  handleNameKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.handleSave();
    }
  }

  handleSave() {
    // Save changes - if input is empty/spaces, it will become undefined
    const newName = this.nameInput.value.trim() || null;
    // Enforce 1000 character limit on notes (safety check)
    const maxNotesLength = 1000;
    let notesValue = this.notesInput.value;
    if (notesValue.length > maxNotesLength) {
      notesValue = notesValue.substring(0, maxNotesLength);
    }
    const newNotes = notesValue.trim() || null;
    const contact = myData.contacts[this.currentContactAddress];
    if (contact) {
      contact.name = newName;
      contact.notes = newNotes;
      contactInfoModal.needsContactListUpdate = true;
    }

    // update title if chatModal is open and if contact.name is '' fallback to contact.username
    if (chatModal.isActive() && chatModal.address === this.currentContactAddress) {
      chatModal.modalTitle.textContent = getContactDisplayName(contact);
    }

    // Safely update the contact info modal if it exists and is open
    if (contactInfoModal.currentContactAddress) {
      if (contactInfoModal.isActive()) {
        contactInfoModal.updateContactInfo(createDisplayInfo(myData.contacts[this.currentContactAddress]));
      }
    }

    // Safely close the edit modal
    this.close();
  }
}

// make singleton instance
const editContactModal = new EditContactModal();

class HistoryModal {
  constructor() {
    // No DOM dependencies in constructor
  }

  load() {
    // DOM elements - only accessed when DOM is ready
    this.modal = document.getElementById('historyModal');
    this.assetSelect = document.getElementById('historyAsset');
    this.transactionList = document.getElementById('transactionList');
    this.closeButton = document.getElementById('closeHistoryModal');

    // Cache the form container for scrollToTop
    this.formContainer = this.modal.querySelector('.form-container');

    // Setup event listeners
    this.closeButton.addEventListener('click', () => this.close());
    this.assetSelect.addEventListener('change', () => this.handleAssetChange());
    this.transactionList.addEventListener('click', (event) => this.handleItemClick(event));
  }

  open() {
    this.modal.classList.add('active');
    this.populateAssets();
    this.updateTransactionHistory();
    
    // Update last viewed timestamp when user opens history modal
    // This clears the history button dot, but wallet dot remains if user hasn't viewed wallet screen
    if (myData?.wallet) {
      myData.wallet.lastHistoryViewTimestamp = getCorrectedTimestamp();
      walletScreen.openHistoryModalButton.classList.remove('has-notification');
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  populateAssets() {
    const walletData = myData.wallet;
    
    if (!walletData.assets || walletData.assets.length === 0) {
      this.assetSelect.innerHTML = '<option value="">No assets available</option>';
      return;
    }
    
    this.assetSelect.innerHTML = walletData.assets
      .map((asset, index) => `<option value="${index}">${asset.name} (${asset.symbol})</option>`)
      .join('');
  }

  updateTransactionHistory() {
    const walletData = myData.wallet;
    const assetIndex = this.assetSelect.value;
    
    if (!walletData.history || walletData.history.length === 0) {
      this.showEmptyState();
      return;
    }
    
    const asset = walletData.assets[assetIndex];
    const contacts = myData.contacts;
    
    this.transactionList.innerHTML = walletData.history
      .map((tx) => {
        const txidAttr = tx?.txid ? `data-txid="${tx.txid}"` : '';
        const statusAttr = tx?.status ? `data-status="${tx.status}"` : '';
        
        // Check if transaction was deleted
        if (tx?.deleted > 0) {
          return `
            <div class="transaction-item deleted-transaction" ${txidAttr} ${statusAttr}>
              <div class="transaction-info">
                <div class="transaction-type deleted">
                  <span class="delete-icon"></span>
                  Deleted
                </div>
                <div class="transaction-amount">-- --</div>
              </div>
              <div class="transaction-memo">${tx.memo || "Deleted on this device"}</div>
            </div>
          `;
        }
        
        // Handle stake transactions differently
        if (tx.type === 'deposit_stake' || tx.type === 'withdraw_stake') {
          const isStake = tx.type === 'deposit_stake';
          const isUnstake = tx.type === 'withdraw_stake';
          const stakeType = isStake ? 'stake' : 'unstake';
          
          // Determine unstake color based on amount (positive = blue, negative = red)
          let unstakeTypeClass = '';
          if (isUnstake) {
            const amount = Number(tx.amount);
            unstakeTypeClass = amount >= 0 ? 'unstake-positive' : 'unstake-negative';
          }
          
          // Add data attribute for negative unstake transactions to help with CSS styling
          const amountNegativeAttr = (isUnstake && Number(tx.amount) < 0) ? 'data-amount-negative="true"' : '';
          
          return `
            <div class="transaction-item" data-memo="${stakeType}" ${txidAttr} ${statusAttr} ${amountNegativeAttr}>
              <div class="transaction-info">
                <div class="transaction-type ${isStake ? 'stake' : unstakeTypeClass}">
                  ${isStake ? '↑ Staked' : '↓ Unstaked'}
                </div>
                <div class="transaction-amount">
                  ${isStake ? '-' : (Number(tx.amount) >= 0 ? '+' : '-')} ${Math.abs(Number(tx.amount) / Number(wei)).toFixed(6)} ${asset.symbol}
                </div>
              </div>
              <div class="transaction-details">
                <div class="transaction-address">
                  ${isStake ? 'To:' : 'From:'} ${tx.nominee || 'Unknown Validator'}
                </div>
                <div class="transaction-time">${formatTime(tx.timestamp)}</div>
              </div>
              <div class="transaction-memo">${stakeType}</div>
            </div>
          `;
        }
        
        // Render normal transaction
        const contactName = getContactDisplayName(contacts[tx.address]);
        
        return `
          <div class="transaction-item" data-address="${tx.address}" ${txidAttr} ${statusAttr}>
            <div class="transaction-info">
              <div class="transaction-type ${tx.sign === -1 ? 'send' : 'receive'}">
                ${tx.sign === -1 ? '↑ Sent' : '↓ Received'}
              </div>
              <div class="transaction-amount">
                ${tx.sign === -1 ? '-' : '+'} ${(Number(tx.amount) / Number(wei)).toFixed(6)} ${asset.symbol}
              </div>
            </div>
            <div class="transaction-details">
              <div class="transaction-address">
                ${tx.sign === -1 ? 'To:' : 'From:'} ${tx.nominee || contactName}
              </div>
              <div class="transaction-time">${formatTime(tx.timestamp)}</div>
            </div>
            ${tx.memo ? `<div class="transaction-memo">${linkifyUrls(tx.memo)}</div>` : ''}
          </div>
        `;
      })
      .join('');
    
    // Scroll the form container to top after rendering
    requestAnimationFrame(() => (this.formContainer.scrollTop = 0));
  }

  showEmptyState() {
    this.transactionList.querySelector('.empty-state').style.display = 'block';
  }

  handleAssetChange() {
    this.updateTransactionHistory();
  }

  handleItemClick(event) {
    const item = event.target.closest('.transaction-item');
    
    if (!item) return;
    
    // Prevent clicking on deleted transactions
    if (item.classList.contains('deleted-transaction')) {
      return;
    }
    
    if (item.dataset.status === 'failed') {

      if (event.target.closest('.transaction-item')) {
        failedTransactionModal.open(item.dataset.txid, item);
      }
      return;
    }
    
    const type = item.querySelector('.transaction-type')?.textContent;
    if (type.includes('stake')) {
      validatorStakingModal.open();
      return;
    }
    
    const address = item.dataset.address;
    // Don't open chat modal for faucet address
    if (address && isFaucetAddress(address)) {
      return;
    }
    if (address && myData.contacts[address]) {
      // Close contact info modal if open
      if (contactInfoModal.isActive()) {
        contactInfoModal.close();
      }
      
      this.close();
      chatModal.open(address);
    }
  }

  // Public method for external updates
  refresh() {
    if (this.isActive()) {
      this.updateTransactionHistory();
    }
  }

  /**
   * Check if the history modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }
}

// Create singleton instance
const historyModal = new HistoryModal();

/**
 * Reusable Clock Timer utility class
 * Provides ticking clock functionality for modal headers
 */
class ClockTimer {
  constructor(elementId) {
    this.elementId = elementId;
    this.timerInterval = null;
    this.currentTimeElement = null;
  }

  /**
   * Formats current time as HH:MM:SS for the ticking clock display
   * @returns {string} Formatted current time string
   */
  formatCurrentTime() {
    const now = getCorrectedTimestamp();
    const localMs = now - timeSkew;
    const date = new Date(localMs);
    
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true // Use 12-hour format with AM/PM
    });
  }

  /**
   * Starts the ticking clock timer
   * @returns {void}
   */
  start() {
    // Clear any existing timer
    this.stop();
    
    // Get the current time element
    this.currentTimeElement = document.getElementById(this.elementId);
    if (!this.currentTimeElement) {
      console.warn(`ClockTimer: Element with id '${this.elementId}' not found`);
      return;
    }
    
    // Update immediately
    this.update();
    
    // Set up interval to update every second
    this.timerInterval = setInterval(() => {
      this.update();
    }, 1000);
  }

  /**
   * Stops the ticking clock timer
   * @returns {void}
   */
  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Updates the clock display with current time
   * @returns {void}
   */
  update() {
    if (!this.currentTimeElement) return;
    
    try {
      const currentTime = this.formatCurrentTime();
      this.currentTimeElement.textContent = currentTime;
    } catch (error) {
      console.error(`ClockTimer: Error updating clock for '${this.elementId}':`, error);
    }
  }
}

class CallsModal {
  constructor() {
    this.calls = [];
    this.clockTimer = new ClockTimer('callsCurrentTime');
  }

  load() {
    this.modal = document.getElementById('callsModal');
    this.list = document.getElementById('callList');
    this.closeButton = document.getElementById('closeCallsModal');
    this.closeButton.addEventListener('click', () => this.close());

    // Click on list item: open chat (single calls) or show participants (group calls)
    this.list.addEventListener('click', (e) => {
      const li = e.target.closest('.chat-item');
      if (!li) return;
      const action = e.target.closest('.call-join');
      if (action) {
        this.handleJoinClick(li);
        return;
      }
      // Handle clicks on the list item itself
      const isGroupCall = li.classList.contains('group-call');
      if (isGroupCall) {
        // Group calls: show participant selection modal
        this.showGroupCallParticipants(li);
      } else {
        // Single participant calls: clicking opens chat
        const address = li.getAttribute('data-address');
        chatModal.open(address);
      }
    });
  }

  /**
   * Opens the calls modal
   * @returns {void}
   */
  open() {
    this.refreshCalls();
    this.render();
    this.modal.classList.add('active');
    this.clockTimer.start();
    // start periodic refresh to update call button states every 5s
    this._stateInterval = setInterval(() => {
      if (this.modal.classList.contains('active')) {
        this.refreshCalls();
        this.render();
      }
    }, 5000); 
  }

  /**
   * Closes the calls modal
   * @returns {void}
   */
  close() {
    this.clockTimer.stop();
    this.modal.classList.remove('active');
    if (this._stateInterval) {
      clearInterval(this._stateInterval);
      this._stateInterval = null;
    }
  }

  /**
   * Refreshes the calls list by looping through contacts and getting calls that are within last 2 hours or in future
   * @returns {void}
   */
  refreshCalls() {
    this.calls = [];
    if (!myData?.contacts) return;
    const now = getCorrectedTimestamp();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const threshold = now - twoHoursMs;
    
    // Group calls by URL and callTime
    const callGroups = new Map();
    
    // loop through contacts and get calls that are within last 2 hours or in future
    for (const [address, contact] of Object.entries(myData.contacts)) {
      const messages = contact?.messages || [];
      const displayName = getContactDisplayName(contact);
      for (const msg of messages) {
        if (msg?.type !== 'call') continue;
        // Skip deleted messages
        if (msg?.deleted === 1) continue;
        // Skip messages that failed to send
        if (msg?.status === 'failed') continue;
        const callTime = Number(msg.callTime);
        // Only include valid scheduled calls: positive timestamp within last 2h or in future
        if (!Number.isFinite(callTime) || callTime <= 0) continue;
        if (callTime >= threshold) {
          const callUrl = msg.message;
          const groupKey = `${callTime}-${callUrl}`;
          
          if (!callGroups.has(groupKey)) {
            callGroups.set(groupKey, {
              callTime,
              callUrl,
              participants: []
            });
          }
          
          callGroups.get(groupKey).participants.push({
            address,
            calling: displayName,
            txid: msg.txid || ''
          });
        }
      }
    }
    
    // Convert grouped calls to array and sort by call time
    this.calls = Array.from(callGroups.values()).sort((a, b) => (a.callTime || 0) - (b.callTime || 0));
  }

  /** 
   * Handles the join click event for a call
   * @param {HTMLElement} li - The list item element
   * @returns {void}
   */
  handleJoinClick(li) {
    const idx = Number(li.getAttribute('data-index'));
    const callGroup = this.calls[idx];
    if (!callGroup) return;
    // Gate future calls
    if (chatModal.isFutureCall(callGroup.callTime)) {
      // have id be with call time so we don't repeat same toast for same call
      showToast(`Call scheduled for ${chatModal.formatLocalDateTime(callGroup.callTime)}`, 2500, 'info');
      return;
    }
    if (!callGroup.callUrl) {
      showToast('Call link not found', 0, 'error');
      return;
    }
    window.open(callGroup.callUrl+`${callUrlParams}"${myAccount.username}"`, '_blank');
  }

  /**
   * Shows the group call participants modal
   * @param {HTMLElement} li - The list item element
   * @returns {void}
   */
  showGroupCallParticipants(li) {
    const idx = Number(li.getAttribute('data-index'));
    const callGroup = this.calls[idx];
    if (!callGroup) return;

    groupCallParticipantsModal.open(callGroup);
  }

  /**
   * Renders the calls list by looping through calls and creating a list item for each call
   * @returns {void}
   */
  render() {
    const list = this.list;
    const empty = list.querySelector('.empty-state');
    const hasCalls = this.calls.length > 0;
    const existingItems = list.querySelectorAll('.chat-item');
    // if no calls, show empty state and remove existing items
    if (!hasCalls) {
      if (empty) empty.style.display = 'block';
      if (existingItems.length) existingItems.forEach((el) => el.remove());
      return;
    }

    if (empty) empty.style.display = 'none';
    // create a fragment to append new items to
    const fragment = document.createDocumentFragment();
    this.calls.forEach((callGroup, i) => {
      // format the call time
      const when = chatModal.formatLocalDateTime(callGroup.callTime);
      const isGroupCall = callGroup.participants.length > 1;
      
      let li;
      if (isGroupCall) {
        // Group call: use template
        const template = document.getElementById('groupCallTemplate');
        li = template.content.cloneNode(true).querySelector('li');
        
        // Generate avatars for all participants
        const participantAvatars = callGroup.participants.map(p => 
          `<div class="participant-avatar" title="${escapeHtml(p.calling)}">${generateIdenticon(p.address)}</div>`
        ).join('');
        
        // Create participant names list
        const participantNames = callGroup.participants.map(p => escapeHtml(p.calling)).join(', ');
        
        // Populate template
        li.setAttribute('data-index', String(i));
        li.querySelector('.call-group-avatars').innerHTML = participantAvatars;
        li.querySelector('.chat-name').textContent = participantNames;
        li.querySelector('.call-time').textContent = when;
      } else {
        // Single participant call: use template
        const template = document.getElementById('singleCallTemplate');
        li = template.content.cloneNode(true).querySelector('li');
        
        const participant = callGroup.participants[0];
        const identicon = generateIdenticon(participant.address);
        
        // Populate template
        li.setAttribute('data-index', String(i));
        li.setAttribute('data-address', participant.address);
        li.querySelector('.chat-avatar').innerHTML = identicon;
        li.querySelector('.chat-name').textContent = participant.calling;
        li.querySelector('.call-time').textContent = when;
      }
      // annotate scheduled time for state updates
      li.setAttribute('data-call-time', String(callGroup.callTime));
      
      fragment.appendChild(li);
    });
    // remove previous items and append new items
    if (existingItems.length) existingItems.forEach((el) => el.remove());
    list.appendChild(fragment);
    // After rendering, update button states
    this.updateJoinButtonStates();
  }

  /**
   * Updates the color of join buttons based on current time
   */
  updateJoinButtonStates() {
    if (!this.list) return;
      this.list.querySelectorAll('.chat-item').forEach(li => {
        const callTime = Number(li.getAttribute('data-call-time'));
        const joinBtn = li.querySelector('.call-join');
        if (!joinBtn || !Number.isFinite(callTime)) return;
        const isFuture = chatModal.isFutureCall(callTime);
        joinBtn.classList.remove('call-join--future', 'call-join--active');
        if (isFuture) {
          joinBtn.classList.add('call-join--future');
        } else {
          joinBtn.classList.add('call-join--active');
        }
    });
  }

  /**
   * Returns true if there are any calls within the last 1 hour or next hour
   * @returns {boolean}
   */
  hasUpcomingCalls() {
    const now = getCorrectedTimestamp();
    const oneHourMs = 60 * 60 * 1000;
    const oneHourAgo = now - oneHourMs;
    const oneHourFromNow = now + oneHourMs;
    return this.calls.some(callGroup => {
      const callTime = Number(callGroup.callTime);
      return Number.isFinite(callTime) && callTime >= oneHourAgo && callTime <= oneHourFromNow;
    });
  }

  /**
   * Returns true if there are any calls within 15 minutes before or after now
   * @returns {boolean}
   */
  hasImminentCalls() {
    const now = getCorrectedTimestamp();
    const fifteenMinMs = 15 * 60 * 1000;
    const windowStart = now - fifteenMinMs;
    const windowEnd = now + fifteenMinMs;
    return this.calls.some(callGroup => {
      const callTime = Number(callGroup.callTime);
      return Number.isFinite(callTime) && callTime >= windowStart && callTime <= windowEnd;
    });
  }

  /**
   * Starts the periodic refresh interval (every minute)
   */
  startPeriodicCallsRefresh() {
    if (this._periodicRefreshInterval) return;
    this._periodicRefreshInterval = setInterval(() => {
      this.refreshCalls();
      header.updateCallsIcon();
    }, 60000);
  }

  /**
   * Stops the periodic refresh interval
   */
  stopPeriodicCallsRefresh() {
    if (this._periodicRefreshInterval) {
      clearInterval(this._periodicRefreshInterval);
      this._periodicRefreshInterval = null;
    }
  }
}

const callsModal = new CallsModal();

class GroupCallParticipantsModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('groupCallParticipantsModal');
    this.participantsList = document.getElementById('groupCallParticipantsList');
    this.closeButton = document.getElementById('closeGroupCallParticipantsModal');
    this.participantsList.addEventListener('click', (e) => this.onParticipantClick(e));
    this.closeButton.addEventListener('click', () => this.close());
  }

  open(callGroup) {
    // Clear existing participants
    if (this.participantsList) {
      this.participantsList.innerHTML = '';
    }

    // Populate participants
    if (callGroup?.participants) {
      const template = document.getElementById('groupCallParticipantTemplate');
      if (template) {
        callGroup.participants.forEach(participant => {
          const participantEl = template.content.cloneNode(true).querySelector('.participant-item');
          participantEl.setAttribute('data-address', participant.address);
          
          const avatar = participantEl.querySelector('.participant-avatar');
          const name = participantEl.querySelector('.participant-name');
          
          if (avatar) avatar.innerHTML = generateIdenticon(participant.address);
          if (name) name.textContent = participant.calling;
          
          this.participantsList.appendChild(participantEl);
        });
      }
    }

    this.modal?.classList.add('active');
  }

  onParticipantClick(e) {
    const participantItem = e.target.closest('.participant-item');
    if (!participantItem) return;
    
    const address = participantItem.getAttribute('data-address');
    if (address) {
      this.close();
      // Directly open the chat modal for the selected participant
      chatModal.open(address);
    }
  }

  close() {
    this.modal.classList.remove('active');
  }
}

const groupCallParticipantsModal = new GroupCallParticipantsModal();

async function updateAssetPricesIfNeeded() {
  if (!myData || !myData.wallet || !myData.wallet.assets) {
    console.error('No wallet data available to update asset prices');
    return;
  }

  const now = getCorrectedTimestamp();
  const priceUpdateInterval = 10 * 60 * 1000; // 10 minutes in milliseconds

  if (now - myData.wallet.priceTimestamp < priceUpdateInterval) {
    return;
  }

  for (let i = 0; i < myData.wallet.assets.length; i++) {
    const asset = myData.wallet.assets[i];
    const contractAddress = '0x' + asset.contract;
    const apiUrl = `https://api.dexscreener.com/latest/dex/search?q=${contractAddress}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        console.error(`API request failed for ${asset.symbol} with status ${response.status}`);
        continue; // Skip to the next asset
      }
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0 && data.pairs[0].priceUsd) {
        asset.price = parseFloat(data.pairs[0].priceUsd);
        myData.wallet.priceTimestamp = now;
      } else {
        console.warn(`No price data found for ${asset.symbol} from API`);
      }
    } catch (error) {
      console.error(`Failed to update price for ${asset.symbol}`, error);
    }
  }
}

async function queryNetwork(url, abortSignal = null) {
  //console.log('queryNetwork', url)
  if (!isOnline) {
    console.warn('QueryNetwork: not online');
    return null;
  }
  const selectedGateway = getGatewayForRequest();
  if (!selectedGateway) {
    console.error('No gateway available for network query');
    showToast('queryNetwork: no gateway', 0, 'error')
    return null;
  }

  try {
    if (network.name != 'Testnet'){
//      showToast(`${now} query ${selectedGateway.web}${url}`, 0, 'info')
    }
    const response = await fetch(`${selectedGateway.web}${url}`, { signal: abortSignal });
    const data = parse(await response.text());
    return data;
  } catch (error) {
    // Check if error is due to abort
    if (error.name === 'AbortError') {
      console.error('queryNetwork aborted:', url);
      return null;
    }
    // log local hh:mm:ss
    const now = new Date().toLocaleTimeString();
    console.error(`${now} queryNetwork ERROR: ${error} ${url} `);
    if (network.name != 'Testnet'){
  //    showToast(`queryNetwork: error: ${error} ${url} ${now}`, 0, 'error')
    }
    return null;
  }
}

async function getChats(keys, retry = 1) {
  // needs to return the number of chats that need to be processed
  //console.log('keys', keys)
  if (!keys) {
    console.warn('no keys in getChats');
    return 0;
  } // TODO don't require passing in keys
  const now = getCorrectedTimestamp();
  if (now - getChats.lastCall < 1000) {
    return 0;
  }
  getChats.lastCall = now;
  //console.log('address', keys)
  //console.log('mydata', myData)
  //console.log('contacts', myData.contacts[keys.address])
  //console.log('messages', myData.contacts[keys.address].messages)
  //console.log('last messages', myData.contacts[keys.address].messages.at(-1))
  //console.log('timestamp', myData.contacts[keys.address].messages.at(-1).timestamp)
  let timestamp = myAccount.chatTimestamp || 0;
  //    const timestamp = myData.contacts[keys.address]?.messages?.at(-1).timestamp || 0

  if (timestamp > longPollResult.timestamp){ timestamp = longPollResult.timestamp }

  const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/${timestamp}`); // TODO get this working
  //    const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/0`) // TODO stop using this
  let chatCount = senders?.chats ? Object.keys(senders.chats).length : 0; // Handle null/undefined senders.chats
  if (senders && senders.chats && chatCount) {
    await processChats(senders.chats, keys);
  } else {
    console.error('getChats: no senders found')
    myAccount.chatTimestamp = timestamp;
  }
  if (chatModal.address) {
    // clear the unread count of address for open chat modal
    myData.contacts[chatModal.address].unread = 0;
  }
  return chatCount;
}
getChats.lastCall = 0;

// play sound if true or false parameter
function playChatSound() {
  const notificationAudio = document.getElementById('notificationSound');
  if (notificationAudio) {
    notificationAudio.play().catch((error) => {
      console.warn('Notification sound playback failed:', error);
    });
  }
}

function playTransferSound() {
  const notificationAudio = document.getElementById('transferSound');
  if (notificationAudio) {
    notificationAudio.play().catch((error) => {
      console.warn('Notification sound playback failed:', error);
    });
  }
}

// Ensure a contact has both EC and PQ public keys in local data.
// Returns true if both keys are available (already or fetched), false otherwise.
async function ensureContactKeys(address) {
  try {
    const contact = myData.contacts[address];
    let hasPub = !!contact.public;
    let hasPq = !!contact.pqPublic;
    if (hasPub && hasPq) return true;

    const accountInfo = await queryNetwork(`/account/${longAddress(address)}`);
    const netPub = accountInfo?.account?.publicKey;
    const netPq = accountInfo?.account?.pqPublicKey;
    if (netPub) {
      try {
        const derivedHex = bin2hex(generateAddress(hex2bin(netPub)));
        const expected = normalizeAddress(address);
        if (derivedHex === expected) {
          contact.public = netPub;
          hasPub = true;
        } else {
          console.error('ensureContactKeys: public key/address mismatch', { address: expected, derivedHex });
          return false;
        }
      } catch (verr) {
        console.error('ensureContactKeys: failed to verify public key', verr);
        return false;
      }
    }
    if (netPq) {
      contact.pqPublic = netPq;
      hasPq = true;
    }
    return hasPub && hasPq;
  } catch (e) {
    console.error('ensureContactKeys error:', e);
    return false;
  }
}

// Actually payments also appear in the chats, so we can add these to
async function processChats(chats, keys) {
  let newTimestamp = 0;
  const timestamp = myAccount.chatTimestamp || 0;
  const messageQueryTimestamp = Math.max(0, timestamp+1);
  let hasAnyTransfer = false;

  for (let sender in chats) {
    // Fetch messages using the adjusted timestamp
    const res = await queryNetwork(`/messages/${chats[sender]}/${messageQueryTimestamp}`);
    if (res && res.messages) {
      const from = normalizeAddress(sender);
      if (!myData.contacts[from]) {
        // New inbound chat (not previously in contacts): create as tolled + allow one-time tolled deposit toast
        createNewContact(from, undefined, 1, false);
      }
      const contact = myData.contacts[from];
      // Set username to "Liberdus Faucet" if there is no username for the faucet address contact
      if (isFaucetAddress(from) && !contact.username) {
        contact.username = 'Liberdus Faucet';
      }
      //            contact.address = from        // not needed since createNewContact does this
      let added = 0;
      let hasNewTransfer = false;
      let mine = false;
      // Count of edits (from the other party) applied while user not viewing this chat
      let editIncrements = 0;

      // This check determines if we're currently chatting with the sender
      // We ONLY want to avoid notifications if we're actively viewing this exact chat
      const inActiveChatWithSender =
        chatModal.address === from && chatModal.isActive();

      for (let i in res.messages) {
        const tx = res.messages[i]; // the messages are actually the whole tx
        // compute the transaction id (txid)
        const txidHex = getTxid(tx);
        let useTxTimestamp = false;

        newTimestamp = tx.timestamp > newTimestamp ? tx.timestamp : newTimestamp;
        mine = tx.from == longAddress(keys.address) ? true : false;
        // timestamp-skew check for incoming messages/transfers (ensures we don't use out of range sent_timestamp)
        if (!mine && (tx.type === 'message' || tx.type === 'transfer')) {
          const sentTs = Number(((tx.type === 'message' ? tx.xmessage : tx.xmemo) || {}).sent_timestamp || 0);
          const txTs = Number(tx.timestamp || 0);
          const MAX_TS_SKEW_MS = 10 * 1000;
          if ((txTs - sentTs) < 0 || (txTs - sentTs) > MAX_TS_SKEW_MS) {
            // ensures we don't use out of range sent_timestamp
            useTxTimestamp = true;
          }
        }
        if (tx.type == 'message') {
          // Handle messages without xmessage (same as transfer handling)
          // Ensure payload is always an object, even if xmessage is null/undefined
          let payload = tx.xmessage;
          if (!payload || typeof payload !== 'object') {
            payload = {};
          }
          // Set sent_timestamp - use tx.timestamp if useTxTimestamp is true, otherwise use payload.sent_timestamp or tx.timestamp
          if (useTxTimestamp || !payload.sent_timestamp) {
            payload.sent_timestamp = tx.timestamp;
          }
          if (mine){
            // console.warn('my message tx', tx)
          }
          else if (payload.encrypted) {
            await ensureContactKeys(from);
            if (!myData.contacts[from]?.public) {
              console.warn(`no public key found for sender ${sender}`);
              continue;
            }
            payload.public = myData.contacts[from].public;
          }
          if (payload.xattach && typeof payload.xattach === 'string') {
            try {
              // if mine, use selfKey to get dhkey
              // if not mine, use public key and pqEncSharedKey to get dhkey
              const dhkey = mine 
                ? hex2bin(decryptData(payload.selfKey, keys.secret + keys.pqSeed, true))
                : dhkeyCombined(keys.secret, payload.public, keys.pqSeed, payload.pqEncSharedKey).dhkey;
              const decryptedAttachData = decryptChacha(dhkey, payload.xattach);
              payload.xattach = parse(decryptedAttachData);
            } catch (error) {
              console.error('Failed to decrypt xattach:', error);
              delete payload.xattach;
            }
          }
          //console.log("payload", payload)
          decryptMessage(payload, keys, mine); // modifies the payload object
          
          // Process new message format if it's JSON, otherwise keep old format
          if (typeof payload.message === 'string') {
            try {
              const parsedMessage = JSON.parse(payload.message);
              // Check if it's the new message format with type field
              if (parsedMessage && typeof parsedMessage === 'object') {
                // Handle delete messages
                if (parsedMessage.type === 'delete') {
                  const txidToDelete = parsedMessage.txid;
                  
                  // Verify that the sender is the same who sent the message they're trying to delete
                  const messageToDelete = contact.messages.find(msg => msg.txid === txidToDelete);
                  if (!messageToDelete) {
                    continue; // ignore delete control messages for missing txid
                  }
                  
                  // Only allow deletion if the sender of this delete tx is the same who sent the original message
                  // (normalize addresses for comparison)
                  const originalSender = normalizeAddress(tx.from);
                  
                  if (!messageToDelete.my && originalSender === from) {
                    // This is a message received from sender, who is now deleting it - valid
                    // Purge cached thumbnails for image attachments, if any
                    chatModal.purgeThumbnail(messageToDelete.xattach);

                    // Mark the message as deleted
                    messageToDelete.deleted = 1;
                    messageToDelete.message = "Deleted by sender";
                    // Remove attachments so we don't keep references around
                    delete messageToDelete.xattach;
                    
                    // Remove payment-specific fields if present
                    if (messageToDelete.amount) {
                      if (messageToDelete.payment) delete messageToDelete.payment;
                      if (messageToDelete.memo) messageToDelete.memo = "Deleted by sender";
                      if (messageToDelete.amount) delete messageToDelete.amount;
                      if (messageToDelete.symbol) delete messageToDelete.symbol;
                      
                      // Update corresponding transaction in wallet history
                      const txIndex = myData.wallet.history.findIndex((tx) => tx.txid === messageToDelete.txid);
                      if (txIndex !== -1) {
                        Object.assign(myData.wallet.history[txIndex], { deleted: 1, memo: 'Deleted by sender' });
                        delete myData.wallet.history[txIndex].amount;
                        delete myData.wallet.history[txIndex].symbol;
                        delete myData.wallet.history[txIndex].payment;
                        delete myData.wallet.history[txIndex].sign;
                        delete myData.wallet.history[txIndex].address;
                      }
                    }
                  } else if (messageToDelete.my && normalizeAddress(keys.address) === normalizeAddress(tx.from)) {
                    // This is our own message, and we're deleting it - valid
                    // Purge cached thumbnails for image attachments, if any
                    chatModal.purgeThumbnail(messageToDelete.xattach);

                    // Mark the message as deleted
                    messageToDelete.deleted = 1;
                    messageToDelete.message = "Deleted for all";
                    // Remove attachments so we don't keep references around
                    delete messageToDelete.xattach;
                    
                    // Remove payment-specific fields if present - same logic as above
                    if (messageToDelete.amount) {
                      if (messageToDelete.payment) delete messageToDelete.payment;
                      if (messageToDelete.memo) messageToDelete.memo = "Deleted for all";
                      if (messageToDelete.amount) delete messageToDelete.amount;
                      if (messageToDelete.symbol) delete messageToDelete.symbol;
                      
                      // Update corresponding transaction in wallet history
                      const txIndex = myData.wallet.history.findIndex((tx) => tx.txid === messageToDelete.txid);
                      if (txIndex !== -1) {
                        Object.assign(myData.wallet.history[txIndex], { deleted: 1, memo: 'Deleted for all' });
                        delete myData.wallet.history[txIndex].amount;
                        delete myData.wallet.history[txIndex].symbol;
                        delete myData.wallet.history[txIndex].payment;
                        delete myData.wallet.history[txIndex].sign;
                        delete myData.wallet.history[txIndex].address;
                      }
                    }
                  }

                  if (reactNativeApp.isReactNativeWebView && messageToDelete.type === 'call' && Number(messageToDelete.callTime) > 0) {
                    reactNativeApp.sendCancelScheduledCall(contact?.username, Number(messageToDelete.callTime));
                  }
                  
                  if (chatModal.isActive() && chatModal.address === from) {
                    chatModal.appendChatModal();
                  }
                  // Don't process this message further - it's just a control message
                  continue;
                } else if (parsedMessage.type === 'edit') {
                  const txidToEdit = parsedMessage.txid;
                  const newText = parsedMessage.text;
                  if (txidToEdit && typeof newText === 'string') {
                    const messageToEdit = contact.messages.find(msg => msg.txid === txidToEdit);
                    if (messageToEdit && !messageToEdit.deleted) {
                      // Allow editing only if original sender matches editor and it's their own message OR
                      // we receive someone else's edit for their own message
                      const originalSender = normalizeAddress(tx.from);
                      const isOriginalMine = messageToEdit.my && normalizeAddress(keys.address) === originalSender;
                      const isOriginalTheirs = !messageToEdit.my && originalSender === from;
                      if (isOriginalMine || isOriginalTheirs) {
                        // Enforce client-side edit window with 5 min slack (20 minutes total)
                        const originalTs = Number(messageToEdit.sent_timestamp || 0);
                        const editTs = Number(tx.timestamp || 0);
                        const CLIENT_EDIT_ACCEPT_MS = EDIT_WINDOW_MS + (5 * 60 * 1000);
                        // Ignore invalid/missing timestamps, edits older than window, or edits that predate the original
                        if ( editTs < originalTs || (editTs - originalTs) >= CLIENT_EDIT_ACCEPT_MS) {
                          console.warn('Ignoring edit outside allowed time window', { originalTs, editTs, txid: txidToEdit });
                          continue; // too old or invalid edit; skip processing this control message
                        }
                        // Update chat message memo/text
                        messageToEdit.message = newText;
                        messageToEdit.edited = 1;
                        messageToEdit.edited_timestamp = tx.timestamp;
                        // Also update wallet history entry memo if present
                        if (myData?.wallet?.history && Array.isArray(myData.wallet.history)) {
                          const hIdx = myData.wallet.history.findIndex((h) => h.txid === txidToEdit);
                          if (hIdx !== -1) {
                            myData.wallet.history[hIdx].memo = newText;
                            myData.wallet.history[hIdx].edited = 1;
                            myData.wallet.history[hIdx].edited_timestamp = tx.timestamp;
                          }
                        }
                        if (!messageToEdit.my && !inActiveChatWithSender) {
                          editIncrements += 1;
                        }
                        if (chatModal.isActive() && chatModal.address === from) {
                          chatModal.appendChatModal();
                        }
                      }
                    }
                  }
                  continue; // control message, don't add
                } else if (parsedMessage.type === 'call') {
                  payload.message = parsedMessage.url;
                  payload.type = 'call';
                  // Use callTime when present; default to 0 (immediate)
                  payload.callTime = Number(parsedMessage.callTime) || 0;
                  if (payload.callTime && reactNativeApp.isReactNativeWebView) {
                    // Send it to the native app to display the scheduled call notification
                    if (!chatModal.isCallExpired(payload.callTime) || chatModal.isFutureCall(payload.callTime)) {
                      // Pass the current account address so we can show bell in sign-in modal
                      const accountAddress = myAccount?.keys?.address;
                      reactNativeApp.sendScheduledCall(contact.username, payload.callTime, accountAddress);
                    }
                  }
                } else if (parsedMessage.type === 'vm') {
                  // Voice message format processing
                  payload.message = ''; // Voice messages don't have text
                  payload.url = parsedMessage.url;
                  payload.duration = parsedMessage.duration;
                  payload.type = 'vm';
                  // Extract reply info for voice messages
                  if (parsedMessage.replyId) {
                    payload.replyId = parsedMessage.replyId;
                  }
                  if (parsedMessage.replyMessage) {
                    payload.replyMessage = parsedMessage.replyMessage;
                  }
                  if (typeof parsedMessage.replyOwnerIsMine !== 'undefined') {
                    payload.replyOwnerIsMine = parsedMessage.replyOwnerIsMine;
                  }
                } else if (parsedMessage.type === 'message') {
                  // Regular message format processing
                  payload.message = parsedMessage.message;
                  if (parsedMessage.replyId) {
                    payload.replyId = parsedMessage.replyId;
                  }
                  if (parsedMessage.replyMessage) {
                    payload.replyMessage = parsedMessage.replyMessage;
                  }
                  if (typeof parsedMessage.replyOwnerIsMine !== 'undefined') {
                    payload.replyOwnerIsMine = parsedMessage.replyOwnerIsMine;
                  }
                  
                  // Handle attachments field (replacing xattach)
                  if (parsedMessage.attachments) {
                    // If we have both new attachments and old xattach, prioritize the new format
                    if (!payload.xattach) {
                      payload.xattach = parsedMessage.attachments;
                    }
                  }
                }
              }
            } catch (e) {
              // Not JSON or invalid format - keep using the message as is (backwards compatibility)
            }
          }
          
          if (payload.senderInfo && !mine){
            contact.senderInfo = cleanSenderInfo(payload.senderInfo)
            delete payload.senderInfo;
            if (contact.senderInfo.avatarId && contact.senderInfo.avatarKey && contact.avatarId !== contact.senderInfo.avatarId) {
              downloadAndDecryptAvatar(`${network.attachmentServerUrl}/get/${contact.senderInfo.avatarId}`, contact.senderInfo.avatarKey)
                .then(async (blob) => {
                  try {
                    // Save blob under the server-provided avatar id
                    await contactAvatarCache.save(contact.senderInfo.avatarId, blob);
                    contact.avatarId = contact.senderInfo.avatarId;
                    contact.hasAvatar = true;
                    // If contact provided a new avatar, prefer their sent avatar
                    myData.contacts ??= {};
                    myData.contacts[contact.address] ??= { address: contact.address };
                    myData.contacts[contact.address].useAvatar = 'contact';
                    saveState();
                    // Refresh UI immediately: chat modal avatar + messages + chat list
                    if (chatModal.isActive() && chatModal.address === contact.address) {
                      chatModal.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);
                      chatModal.appendChatModal(true);
                    }
                    if (typeof chatsScreen !== 'undefined') {
                      chatsScreen.updateChatList();
                    }
                  } catch (e) {
                    console.warn('Failed to save avatar after download:', e);
                  }
                })
                .catch(err => console.warn('Failed to download avatar:', err));
            }
            if (contact.username) {
              // if we already have the username, we can use it
              contact.senderInfo.username = contact.username;
            } else if (contact.senderInfo.username) {
              // check if the username given with the message maps to the address of this contact
              const usernameAddress = await getUsernameAddress(contact.senderInfo.username);
              if (usernameAddress && normalizeAddress(usernameAddress) === normalizeAddress(tx.from)) {
                contact.username = contact.senderInfo.username;
              } else {
                // username doesn't match address so skipping this message
                console.error(`Username: ${contact.senderInfo.username} does not match address ${tx.from}`);
                continue;
              }
            } else {
              console.error(`Username not provided in senderInfo.`)
              continue
            }
          }
          //  skip if this tx was processed before and is already in contact.messages;
          //    messages are the same if the messages[x].sent_timestamp is the same as the tx.timestamp,
          //    and messages[x].my is false and messages[x].message == payload.message
          let alreadyExists = false;
          for (const messageTx of contact.messages) {
            if (messageTx.txid === txidHex) {
              alreadyExists = true;
              break;
            }
          }
          if (alreadyExists) {
            //console.log(`Skipping already existing message: ${payload.sent_timestamp}`);
            continue; // Skip to the next message
          }

          //console.log('contact.message', contact.messages)
          payload.my = mine;
          payload.timestamp = payload.sent_timestamp;
          payload.txid = txidHex;
          delete payload.pqEncSharedKey;
          
          // Store voice message fields if present
          if (payload.type === 'vm') {
            // Keep the voice message fields and encryption keys
            // url and duration are already set from the parsing above
            if (!mine && tx.xmessage.pqEncSharedKey) {
              payload.pqEncSharedKey = tx.xmessage.pqEncSharedKey;
            }
            if (mine && tx.xmessage.selfKey) {
              payload.selfKey = tx.xmessage.selfKey;
            }
            // Store audio file encryption keys for voice message playback
            if (!mine && tx.xmessage.audioPqEncSharedKey) {
              payload.audioPqEncSharedKey = tx.xmessage.audioPqEncSharedKey;
            }
            if (mine && tx.xmessage.audioSelfKey) {
              payload.audioSelfKey = tx.xmessage.audioSelfKey;
            }
          } else {
            delete payload.pqEncSharedKey;
          }
          if (payload.attachments) {
            // If we processed attachments from the new format, make sure they're in xattach
            if (!payload.xattach) {
              payload.xattach = payload.attachments;
            }
            delete payload.attachments;
          }
          
          insertSorted(contact.messages, payload, 'timestamp');
          // if we are not in the chatModal of who sent it, playChatSound or if device visibility is hidden play sound
          if (!inActiveChatWithSender || document.visibilityState === 'hidden') {
            playChatSound();
          }
          if (!mine){
            added += 1;
          }
        }

        //   Process transfer messages; this is a payment with an optional memo 
        else if (tx.type == 'transfer') {
          // Handle transfers without xmemo (e.g., faucet transfers)
          // Ensure payload is always an object, even if xmemo is null/undefined
          let payload = tx.xmemo;
          if (!payload || typeof payload !== 'object') {
            payload = {};
          }
          // Set sent_timestamp - use tx.timestamp if useTxTimestamp is true, otherwise use payload.sent_timestamp or tx.timestamp
          if (useTxTimestamp || !payload.sent_timestamp) {
            payload.sent_timestamp = tx.timestamp;
          }
          if (mine) {
            const txx = parse(stringify(tx))
            // console.warn('my transfer tx', txx)
          }
          else if (payload.encrypted) {
            await ensureContactKeys(from);
            if (!myData.contacts[from]?.public) {
              console.warn(`no public key found for sender ${sender}`);
              continue;
            }
            payload.public = myData.contacts[from].public;
          }
          //console.log("payload", payload)
          decryptMessage(payload, keys, mine); // modifies the payload object

          // Process new message format if it's JSON, otherwise keep old format
          if (typeof payload.message === 'string') {
            try {
              const parsedMessage = JSON.parse(payload.message);
              // Check if it's the new message format with type field
              if (parsedMessage && typeof parsedMessage === 'object' && parsedMessage.type === 'transfer') {
                // Extract actual message text
                payload.message = parsedMessage.message;
              }
            } catch (e) {
              // Not JSON or invalid format - keep using the message as is (backwards compatibility)
            }
          }

          if (payload.senderInfo && !mine) {
            contact.senderInfo = cleanSenderInfo(payload.senderInfo);
            delete payload.senderInfo;
            if (contact.senderInfo.avatarId && contact.senderInfo.avatarKey && contact.avatarId !== contact.senderInfo.avatarId) {
              downloadAndDecryptAvatar(`${network.attachmentServerUrl}/get/${contact.senderInfo.avatarId}`, contact.senderInfo.avatarKey)
                .then(async (blob) => {
                  try {
                    await contactAvatarCache.save(contact.senderInfo.avatarId, blob);
                    contact.avatarId = contact.senderInfo.avatarId;
                    contact.hasAvatar = true;
                    // If contact provided a new avatar, prefer their sent avatar
                    myData.contacts ??= {};
                    myData.contacts[contact.address] ??= { address: contact.address };
                    myData.contacts[contact.address].useAvatar = 'contact';
                    saveState();
                    // Refresh UI immediately: chat modal avatar + messages + chat list
                    if (chatModal.isActive() && chatModal.address === contact.address) {
                      chatModal.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);
                      chatModal.appendChatModal(true);
                    }
                    if (typeof chatsScreen !== 'undefined') {
                      chatsScreen.updateChatList();
                    }
                  } catch (e) {
                    console.warn('Failed to save avatar after download:', e);
                  }
                })
                .catch(err => console.warn('Failed to download avatar:', err));
            }
            if (contact.username) {
              // if we already have the username, we can use it
              contact.senderInfo.username = contact.username;
            } else if (contact.senderInfo.username) {
              // check if the username given with the message maps to the address of this contact
              const usernameAddress = await getUsernameAddress(contact.senderInfo.username);
              if (usernameAddress && normalizeAddress(usernameAddress) === normalizeAddress(tx.from)) {
                contact.username = contact.senderInfo.username;
              } else {
                // username doesn't match address so skipping this message
                console.error(`Username: ${contact.senderInfo.username} does not match address ${tx.from}`);
                continue;
              }
            } else {
              console.error(`Username not provided in senderInfo.`)
              continue
            }
          }

          // skip if this tx was processed before and is already in the history array;
          //    txs are the same if the history[x].txid is the same as txidHex
          const history = myData.wallet.history;
          let alreadyInHistory = false;
          for (const historyTx of history) {
            if (historyTx.txid === txidHex) {
              alreadyInHistory = true;
              break;
            }
          }
          if (alreadyInHistory) {
            //console.log(`Skipping already existing transfer: ${txidHex}`);
            continue; // Skip to the next message
          }
          // add the transfer tx to the wallet history
          const newPayment = {
            txid: txidHex,
            amount: parse(stringify(tx.amount)), // need to make a copy
//            sign: 1,
            sign: mine ? -1 : 1,
            timestamp: payload.sent_timestamp,
            address: from,
            memo: payload.message,
          };
          insertSorted(history, newPayment, 'timestamp');
          // TODO: redundant but keep for now
          //  sort history array based on timestamp field in descending order
          //history.sort((a, b) => b.timestamp - a.timestamp);

          // --- Create and Insert Transfer Message into contact.messages ---
          const transferMessage = {
            timestamp: payload.sent_timestamp,
            sent_timestamp: payload.sent_timestamp,
            my: mine,
            message: payload.message, // Use the memo as the message content
            amount: parse(stringify(tx.amount)), // Ensure amount is stored as BigInt
            symbol: 'LIB', // TODO: get the symbol from the asset
            txid: txidHex,
          };
          // Insert the transfer message into the contact's message list, maintaining sort order
          insertSorted(contact.messages, transferMessage, 'timestamp');
          // --------------------------------------------------------------

          if (!mine){
            added += 1;
          }

          // Mark that we have a new transfer for toast notification
          if (!mine){
            hasNewTransfer = true;
          }
        }
      }
      if (hasNewTransfer){ hasAnyTransfer = true; }
      // If messages were added to contact.messages, update myData.chats
      if (added > 0) {
        // Update unread count ONLY if the chat modal for this sender is NOT active
        if (!inActiveChatWithSender) {
          contact.unread = (contact.unread || 0) + added; // Ensure unread is initialized
        } else {
          // If chat modal is active, explicitly call appendChatModal to update it
          // and trigger highlight/scroll for the new message.
          if (document.visibilityState === 'visible') {
            chatModal.appendChatModal(true); // Pass true for highlightNewMessage flag
          }
        }

        // Add sender to the top of the chats tab
        // Remove existing chat for this contact if it exists
        const existingChatIndex = myData.chats.findIndex((chat) => chat.address === from);
        if (existingChatIndex !== -1) {
          myData.chats.splice(existingChatIndex, 1);
        }
        // Get the most recent message (index 0 because it's sorted descending)
        const latestMessage = contact.messages[0];
        // Create chat object with only guaranteed fields
        const chatUpdate = {
          address: from,
          timestamp: latestMessage.timestamp,
        };
        // Find insertion point to maintain timestamp order (newest first)
        const insertIndex = myData.chats.findIndex((chat) => chat.timestamp < chatUpdate.timestamp);
        if (insertIndex === -1) {
          // If no earlier timestamp found, append to end
          myData.chats.push(chatUpdate);
        } else {
          // Insert at correct position to maintain order
          myData.chats.splice(insertIndex, 0, chatUpdate);
        }

        // Add bubble to chats tab if we are not on it
        // Only suppress notification if we're ACTIVELY viewing this chat and if not a transfer
        // Don't add notification for faucet address
        if (!inActiveChatWithSender && !chatsScreen.isActive() && !isFaucetAddress(from)) {
          footer.chatButton.classList.add('has-notification');
        }
      }

      // Show transfer notification even if no messages were added
      if (hasNewTransfer) {
        // Add bubble to Wallet tab if we're not on it
        if (!walletScreen.isActive()) {
          footer.walletButton.classList.add('has-notification');
        }
        // Add bubble to the wallet history button
        walletScreen.openHistoryModalButton.classList.add('has-notification');
      }

      // Handle edit-only (or edit + message) unread increments.
      if (editIncrements > 0) {
        // If the chat is not active, increment unread for edits.
        if (!inActiveChatWithSender) {
          contact.unread = (contact.unread || 0) + editIncrements;
          // Add notification bubble if chats screen not active
          // Don't add notification for faucet address
          if (!chatsScreen.isActive() && !isFaucetAddress(from)) {
            footer.chatButton.classList.add('has-notification');
          }
          // Refresh list if user is currently viewing chat list so unread counts update
          if (chatsScreen.isActive()) {
            chatsScreen.updateChatList();
          }
        } else {
          // If user is in the chat while edits arrive, just re-render to show edited markers
          if (chatModal.isActive() && chatModal.address === from) {
            chatModal.appendChatModal();
          }
        }
      }
    }
  }
  if (hasAnyTransfer){
    playTransferSound()
    // update history modal if it's active
    if (historyModal.isActive()) historyModal.refresh();
    // Update wallet view if it's active
    if (walletScreen.isActive()) walletScreen.updateWalletView();
  }

  // Update the global timestamp AFTER processing all senders
  if (newTimestamp > 0) {
    // Update the timestamp
    myAccount.chatTimestamp = newTimestamp;
  }
}

/**
 * Restore wallet/history notification dots based on whether there are transfers
 * newer than when the user last viewed those screens
 */
function restoreWalletNotificationDots() {
  if (!myData?.wallet?.history || !Array.isArray(myData.wallet.history) || myData.wallet.history.length === 0) {
    return;
  }
  
  // Get the most recent transfer timestamp
  const mostRecentTransfer = myData.wallet.history[0];
  if (!mostRecentTransfer || !mostRecentTransfer.timestamp) {
    return;
  }
  
  const mostRecentTransferTimestamp = mostRecentTransfer.timestamp;
  const lastWalletViewTimestamp = myData.wallet.lastWalletViewTimestamp || 0;
  const lastHistoryViewTimestamp = myData.wallet.lastHistoryViewTimestamp || 0;
  
  // Only show dots for received transfers (sign === 1)
  const isReceivedTransfer = mostRecentTransfer.sign === 1;
  
  // Show wallet tab dot if there's a newer received transfer and wallet screen is not active
  // This dot is cleared when user switches to wallet screen
  if (isReceivedTransfer && mostRecentTransferTimestamp > lastWalletViewTimestamp && !walletScreen.isActive()) {
    footer.walletButton.classList.add('has-notification');
  }
  
  // Show history button dot if there's a newer received transfer than when user last opened history modal
  // This dot is cleared when user opens the history modal (not when they open wallet screen)
  if (isReceivedTransfer && mostRecentTransferTimestamp > lastHistoryViewTimestamp) {
    walletScreen.openHistoryModalButton.classList.add('has-notification');
  }
}

/**
 * Get the address of a username and return the address if it exists
 * @param {string} username - The username to check
 * @returns {Promise<string|null>} The address of the username or null if it doesn't exist
 */
async function getUsernameAddress(username) {
  const usernameBytes = utf82bin(normalizeUsername(username));
  const usernameHash = hashBytes(usernameBytes);
  const selectedGateway = getGatewayForRequest();
  if (!selectedGateway) {
    console.error('No gateway available for username check');
    return null;
  }
  try {
    const response = await fetch(
      `${selectedGateway.web}/address/${usernameHash}`
    );
    const data = await response.json();
    // if address is not present, return null
    if (!data || !data.address) {
      return null;
    }
    return data.address;
  } catch (error) {
    console.error('Error checking username:', error);
    return null;
  }
}


`
The main difference between a chat message and an asset transfer is
    chat message pays a toll to the recipient as determined by recipient, but message length can be long
    asset transfer pays an amount to the recipient as determined by sender, but message (memo) length is limited

    How does toll work
    When a new contact (chatId) is being established (sending a message or payment for the first time)
    between two users the sender must include the toll of the recipient
        * The chatId account toll fields are setup as:
            toll.required.initialFromAddress = 1
            toll.required.initialToAddress = 0
        * This means that the sender who established the chatId will have to keep paying a toll and
          the receipient can reply or send messages to the sender without paying a toll.
        * Either user can submit a tx to not require the other to pay a toll; setting required.otherUser to 0.
        * Either user can submit a tx to require the other to pay a toll; the client should show the sender the required toll
        * Either user can block message from the other; this sets the toll field of the blocked user to 2.
        * Either user can unblock the other user if blocked; this sets the toll field of the unblocked user to 0
        * If a payment is being sent and it includes a memo and the sender is required to pay a toll than the
          amount being sent must be at least the toll amount required by the recipient
    The actual toll paid by a sender is first stored in the chatId account.
        * 50% is paid to the recipient for reading the message and 50% is paid when they reply.
            toll.payOnRead.initialFromAddress = amount
            toll.payOnRead.initialToAddress
            toll.payOnReply.initialFromAddress
            toll.payOnReply.initialToAddress
    A sender can reclaim the tolls for messages that were not read or replied to after one week
        * The following fields are used to track the last read and reply time for each user
            read.initialFromAddress = millisecond timestamp of when initialFromAddress read messages
            read.initoalToAddress
            replied.initialFromAddress
            replied.initialToAddress
        * Note that the receipient has to submit a tx specifying the read time; downloading the messages does not count as read
        * When a user sends a message it sets both the read and replied timestamps for the user
        * If the recipient reads or replies to a message after the sender has reclaimed the toll they do not get the toll
    A sender can retract a message if it has not been read yet and it has been less than one minute since the message was sent
        * However, this does not gaurantee that the recipient has not already downloaded the message and may read it later
`;

async function postAssetTransfer(to, amount, memo, keys) {
  const toAddr = longAddress(to);
  const fromAddr = longAddress(keys.address);
  await getNetworkParams();

  const tx = {
    type: 'transfer',
    from: fromAddr,
    to: toAddr,
    amount: BigInt(amount),
    chatId: hashBytes([fromAddr, toAddr].sort().join('')),
    // TODO backend is not allowing memo > 140 characters; by pass using xmemo; we might have to check the total tx size instead
    // memo: stringify(memo),
    xmemo: memo,
    timestamp: getCorrectedTimestamp(),
    fee: getTransactionFeeWei(), // This is not used by the backend
    networkId: network.netid,
  };

  const txid = await signObj(tx, keys);
  const res = await injectTx(tx, txid);
  return res;
}

// TODO - backend - when account is being registered, ensure that loserCase(alias)=alias and hash(alias)==aliasHash
async function postRegisterAlias(alias, keys, isPrivate = false) {
  const aliasBytes = utf82bin(alias);
  const aliasHash = hashBytes(aliasBytes);
  const { publicKey } = generatePQKeys(keys.pqSeed);
  const pqPublicKey = bin2base64(publicKey);
  const tx = {
    type: 'register',
    aliasHash: aliasHash,
    from: longAddress(keys.address),
    alias: alias,
    publicKey: keys.public,
    pqPublicKey: pqPublicKey,
    timestamp: getCorrectedTimestamp(),
    networkId: network.netid,
    private: isPrivate,
  };
  const txid = await signObj(tx, keys);
  const res = await injectTx(tx, txid);
  return res;
}

/**
 * Inject a transaction
 * @param {Object} tx - The transaction object
 * @param {string} txid - The transaction ID
 * @returns {Promise<Object>} The response from the injectTx call
 */
async function injectTx(tx, txid) {
  if (!isOnline) {
    return null;
  }
  const selectedGateway = getGatewayForRequest();
  if (!selectedGateway) {
    console.error('No gateway available for transaction injection');
    return null;
  }

  function maybeShowLowLibToast() {
    try {
      // Keep this simple: check locally cached wallet values only.
      const LOW_LIB_USD_THRESHOLD = 0.2;
      if (!myData?.wallet?.assets || !Array.isArray(myData.wallet.assets)) return;
      const libAsset = myData.wallet.assets.find((asset) => asset?.symbol === 'LIB');
      if (!libAsset) return;

      let usd = Number(libAsset.networth);
      if (!Number.isFinite(usd)) {
        // Fallback: estimate from cached balance + price.
        const balance = libAsset.balance ?? 0n;
        const price = Number(libAsset.price);
        if (!Number.isFinite(price) || typeof wei === 'undefined') return;
        usd = (price * Number(balance)) / Number(wei);
      }

      if (Number.isFinite(usd) && usd < LOW_LIB_USD_THRESHOLD) {
        showToast(
          'Add more LIB before you run out. On the Wallet page click the Faucet button.',
          0,
          'warning'
        );
      }
    } catch (e) {
      // Never block the transaction flow on toast logic.
      console.warn('Low-LIB toast check failed:', e);
    }
  }

  try {
    const timestamp = getCorrectedTimestamp();
    // initialize pending array if it doesn't exist
    if (!myData.pending) {
      myData.pending = [];
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: stringify({ tx: stringify(tx) }),
    };
    const response = await fetch(
      `${selectedGateway.web}/inject`,
      options
    );
    const data = await response.json();
    data.txid = txid;

    if (data?.result?.success) {
      const pendingTxData = {
        txid: txid,
        type: tx.type,
        submittedts: timestamp,
        checkedts: 0,
      };
      if (tx.type === 'register') {
        pendingTxData.username = tx.alias;
        pendingTxData.address = tx.from; // User's address (longAddress form)
      } else if (tx.type === 'update_toll_required') {
        pendingTxData.to = normalizeAddress(tx.to);
      } else if (tx.type === 'read') {
        pendingTxData.oldContactTimestamp = tx.oldContactTimestamp;
      } else if (tx.type === 'message' || tx.type === 'transfer') {
        pendingTxData.to = normalizeAddress(tx.to);
      } else if (tx.type === 'deposit_stake' || tx.type === 'withdraw_stake') {
        pendingTxData.to = tx.nominee; // Store 64-character address as-is for stake transactions
      }
      myData.pending.push(pendingTxData);

      if (tx.type !== 'register') {
        // After submitting a transaction, warn if user is low on LIB.
        maybeShowLowLibToast();
      }
    } else {
      let toastMessage = 'Error injecting transaction: ' + data?.result?.reason;
      console.error('Error injecting transaction:', data?.result?.reason);
      if (data?.result?.reason?.includes('timestamp out of range')) {
        console.error('Timestamp out of range, updating timestamp');
        timeDifference()
        toastMessage += ' (Please try again)';
      }
      showToast(toastMessage, 0, 'error');
    }
    return data;
  } catch (error) {
    // if error is a string and contains 'timestamp out of range' 
    if (typeof error === 'string' && error.includes('timestamp out of range')) {
      showToast('Error injecting transaction (Please try again): ' + error, 0, 'error');
    } else {
      showToast('Error injecting transaction: ' + error, 0, 'error');
    }
    console.error('Error injecting transaction:', error);
    return null;
  } finally {
    setTimeout(() => {
      saveState();
    }, 1000);
  }
}

/**
 * Sign a transaction object and return the transaction ID hash
 * @param {Object} tx - The transaction object to sign
 * @param {Object} keys - The keys object containing address and secret
 * @returns {Promise<string>} The transaction ID hash
 */
async function signObj(tx, keys) {
  const jstr = stringify(tx);
  //console.log('tx stringify', jstr)
  const jstrBytes = utf82bin(jstr);
  const txidHex = hashBytes(jstrBytes);
  const txidHashHex = ethHashMessage(txidHex); // Asked Thant why we are doing this;
  //  why hash txid with ethHashMessage again before signing
  //  why not just sign the original txid
  // https://discord.com/channels/746426387606274199/1303158886089359431/1329097165137772574

  const sig = await signMessage(hex2bin(txidHashHex), hex2bin(keys.secret));
  const r = sig.r.toString(16).padStart(64, '0');
  const s = sig.s.toString(16).padStart(64, '0');
  // Convert recovery to hex and append (27 + recovery)
  const v = (27 + sig.recovery).toString(16).padStart(2, '0');
  // Concatenate everything with 0x prefix
  const flatSignature = `0x${r}${s}${v}`;
  tx.sign = {
    owner: longAddress(keys.address),
    sig: flatSignature,
  };
  return txidHex;
}

function getTxid(tx){
  let txo = '';
  if (typeof(tx) !== "string"){
    txo = stringify(tx)
  }
  txo = parse(txo)
  delete txo.sign;
  const jstr = stringify(txo);
  const jstrBytes = utf82bin(jstr);
  const txidHex = hashBytes(jstrBytes);
  return txidHex;
}

class SearchMessagesModal {
  constructor() {
    // memoized debounced search function
    this._debouncedSearch = null;
  }

  load() {
    this.modal = document.getElementById('searchModal');
    this.searchInput = document.getElementById('messageSearch');
    this.closeButton = document.getElementById('closeSearchModal');
    this.searchResults = document.getElementById('searchResults');

    this.closeButton.addEventListener('click', () => {this.close();});
    this.searchInput.addEventListener('input', (e) => {this.handleMessageSearchInput(e);});
  }

  open() {
    this.modal.classList.add('active');
    // Delay focus to ensure transition completes (modal transition is 300ms)
    setTimeout(() => {
      this.searchInput.focus();
    }, 325);
  }

  close() {
    this.modal.classList.remove('active');
    this.searchInput.value = '';
    this.searchResults.innerHTML = '';
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  searchMessages(searchText) {
    if (!searchText || !myData?.contacts) return [];

    const results = [];
    const searchLower = searchText.toLowerCase();

    // Search through all contacts and their messages
    Object.entries(myData.contacts).forEach(([address, contact]) => {
      if (!contact.messages) return;

      contact.messages.forEach((message) => {
        if (!message.message) return; // some messages like calls have no message field
        // Skip deleted messages and call messages
        if (message.deleted > 0) return;
        if (message.type === 'call') return;
        if (message.message.toLowerCase().includes(searchLower)) {
          // Highlight matching text
          const messageText = escapeHtml(message.message);
          // Escape search text for safe regex usage
          const escapedSearch = escapeRegExp(searchText);
          const highlightedText = messageText.replace(new RegExp(escapedSearch, 'gi'), (match) => `<mark>${match}</mark>`);
          
          const maxDisplayLength = 100;
          
          // Adjust maxLength to account for <mark> tags (add 13 chars per highlight)
          // This ensures truncateMessage gets enough characters to display ~100 chars of actual text
          const highlightCount = (highlightedText.match(/<mark>/g) || []).length;
          const adjustedMaxLength = maxDisplayLength + (highlightCount * 13); // <mark> + </mark> = 13 chars
          
          const displayedName = getContactDisplayName(contact);
          results.push({
            contactAddress: address,
            username: displayedName,
            messageId: message.txid,
            message: message, // Pass the entire message object
            timestamp: message.timestamp,
            preview: truncateMessage(highlightedText, adjustedMaxLength),
            my: message.my, // Include the my property
          });
        }
      });
    });

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  // this is also used by contact search 
  displayEmptyState(containerId, message = 'No results found') {
    const resultsContainer = document.getElementById(containerId);
    // Scroll to top before rendering
    resultsContainer.closest('.modal-content')?.scrollTo(0, 0);
    resultsContainer.innerHTML = `
          <div class="empty-state" style="display: block">
              <div class="empty-state-message">${message}</div>
          </div>
      `;
  }

  async handleSearchResultClick(result) {
    try {
      // Close search modal
      this.close();

      // Switch to chats view if not already there
      footer.switchView('chats');

      // Open the chat with this contact, skip auto-scroll since we'll scroll to specific message
      await chatModal.open(result.contactAddress, true);

      // Messages are already in DOM after await, use requestAnimationFrame for layout
      requestAnimationFrame(() => {
        chatModal.scrollToMessage(result.messageId);
      });
    } catch (error) {
      console.error('Error handling search result:', error);
      // Could add error notification here
    }
  }

  displaySearchResults(results) {
    // Scroll to top before rendering new results
    this.searchResults.closest('.modal-content')?.scrollTo(0, 0);

    // Create a ul element to properly contain the list items
    const resultsList = document.createElement('ul');
    resultsList.className = 'chat-list';

    results.forEach(async (result) => {
      const resultElement = document.createElement('li');
      resultElement.className = 'chat-item search-result-item';

      const avatarHtml = await getContactAvatarHtml(result.contactAddress);

      // Format message preview with "<" for user messages and ">" for contact messages
      // make this textContent?
      const messagePreview = result.my ? `< ${result.preview}` : `> ${result.preview}`;

      resultElement.innerHTML = `
              <div class="chat-avatar">
                  ${avatarHtml}
              </div>
              <div class="chat-content">
                  <div class="chat-header">
                      <div class="chat-name">${result.username}</div>
                      <div class="chat-time">${formatTime(result.timestamp)}</div>
                  </div>
                  <div class="chat-message">
                      ${messagePreview}
                  </div>
              </div>
          `;

      resultElement.addEventListener('click', async (event) => {
        event.stopImmediatePropagation(); // Stop all other listeners and bubbling immediately
        // clear search input and clear results
        document.getElementById('messageSearch').value = '';
        document.getElementById('searchResults').innerHTML = '';
        await this.handleSearchResultClick(result);
      });

      resultsList.appendChild(resultElement);
    });

    // Clear and append the new list
    this.searchResults.innerHTML = '';
    this.searchResults.appendChild(resultsList);
  }

  handleMessageSearchInput(e) {
    // Create the debounced function once and reuse it so earlier keypress timers are cleared
    if (!this._debouncedSearch) {
      this._debouncedSearch = debounce(
        (searchText) => {
          // Only trim leading whitespace; preserve trailing spaces for exact matches
          const processedText = (searchText || '').trimStart();

          // If input is empty, clear results
          if (!processedText) {
            this.searchResults.innerHTML = '';
            return;
          }

          // Guard against stale callbacks after further typing or modal close
          const currentText = (this.searchInput?.value || '').trimStart();
          if (!this.isActive() || currentText !== processedText) {
            return;
          }

          const results = this.searchMessages(processedText);
          if (results.length === 0) {
            this.displayEmptyState('searchResults', 'No messages found');
          } else {
            this.displaySearchResults(results);
          }
        },
        (searchText) => ((searchText || '').length === 1 ? 600 : 300)
      );
    }

    this._debouncedSearch(e.target.value);
  }
}

const searchMessagesModal = new SearchMessagesModal();

class SearchContactsModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('contactSearchModal');
    this.searchInput = document.getElementById('contactSearch');
    this.resultsContainer = document.getElementById('contactSearchResults');
    this.closeButton = document.getElementById('closeContactSearchModal');
    
    this.closeButton.addEventListener('click', () => { this.close(); });
    this.searchInput.addEventListener(
      'input',
      debounce(
        (e) => {
          const searchText = e.target.value.trim();

          // Just clear results if empty
          if (!searchText) {
            document.getElementById('contactSearchResults').innerHTML = '';
            return;
          }

          const results = this.searchContacts(searchText);
          if (results.length === 0) {
            searchMessagesModal.displayEmptyState('contactSearchResults', 'No contacts found');
          } else {
            this.displayContactResults(results, searchText);
          }
        },
        (event) => {
          const searchText = event?.target?.value ?? '';
          return searchText.trim().length === 1 ? 600 : 300;
        }
      )
    );
  }

  open() {
    this.modal.classList.add('active');
    // Delay focus to ensure transition completes (modal transition is 300ms)
    setTimeout(() => {
      this.searchInput.focus();
    }, 325);
  }

  close() {
    this.modal.classList.remove('active');
    this.searchInput.value = '';
    this.resultsContainer.innerHTML = '';
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  getSearchableFields(contact) {
    const fields = [];
    const seenValues = new Set();

    const fieldDefinitions = [
      { key: 'username', label: 'username' },
      { key: 'name', label: 'name' },
      { key: 'email', label: 'email' },
      { key: 'phone', label: 'phone' },
      { key: 'linkedin', label: 'linkedin' },
      { key: 'x', label: 'x' },
    ];
    const knownSenderInfoKeys = new Set(fieldDefinitions.map(({ key }) => key));
    const senderInfo = contact.senderInfo || null;

    const normalize = (value) =>
      value === undefined || value === null ? '' : String(value).trim();

    const addField = (fieldLabel, value) => {
      const stringValue = normalize(value);
      if (!stringValue) {
        return;
      }

      const lowerValue = stringValue.toLowerCase();
      if (seenValues.has(lowerValue)) {
        return;
      }

      seenValues.add(lowerValue);
      fields.push({ field: fieldLabel, value: stringValue });
    };

    fieldDefinitions.forEach(({ key, label }) => {
      const primaryValue = normalize(contact[key]);
      const senderValue = senderInfo ? normalize(senderInfo[key]) : '';

      addField(label, primaryValue);

      if (senderValue && senderValue !== primaryValue) {
        addField(`${label}`, senderValue);
      }
    });

    if (senderInfo) {
      Object.entries(senderInfo).forEach(([key, value]) => {
        if (knownSenderInfoKeys.has(key)) {
          return;
        }
        addField(`${key}`, value);
      });
    }

    return fields;
  }

  searchContacts(searchText) {
    if (!searchText || !myData?.contacts) return [];

    const results = [];
    const searchLower = searchText.toLowerCase();

    // Search through all contacts
    Object.entries(myData.contacts).forEach(([address, contact]) => {
      // Skip faucet address
      if (isFaucetAddress(address)) {
        return;
      }
      
      // Fields to search through
      const searchableFields = this.getSearchableFields(contact);
      const searchFields = searchableFields.map((f) => f.value);

      // Check if any field matches
      const matches = searchFields.some((field) => field.toLowerCase().includes(searchLower));

      if (matches) {
        // Determine match type for sorting
        const exactMatch = searchFields.some((field) => field.toLowerCase() === searchLower);
        const startsWithMatch = searchFields.some((field) => field.toLowerCase().startsWith(searchLower));

        results.push({
          ...contact,
          address,
          matchType: exactMatch ? 2 : startsWithMatch ? 1 : 0,
        });
      }
    });

    // Sort results by match type and then alphabetically by username
    return results.sort((a, b) => {
      if (a.matchType !== b.matchType) {
        return b.matchType - a.matchType;
      }
      return (a.username || '').localeCompare(b.username || '');
    });
  }

  createMatchPreview(contact, searchText) {
    if (!searchText) {
      return '';
    }

    const searchLower = searchText.toLowerCase();
    const searchableFields = this.getSearchableFields(contact);

    const matchBuckets = {
      exact: [],
      startsWith: [],
      includes: [],
    };

    searchableFields.forEach((field) => {
      const valueLower = field.value.toLowerCase();
      if (valueLower === searchLower) {
        matchBuckets.exact.push(field);
      } else if (valueLower.startsWith(searchLower)) {
        matchBuckets.startsWith.push(field);
      } else if (valueLower.includes(searchLower)) {
        matchBuckets.includes.push(field);
      }
    });

    const prioritizedField =
      matchBuckets.exact[0] || matchBuckets.startsWith[0] || matchBuckets.includes[0];

    if (!prioritizedField) {
      return '';
    }

    const highlightRegex = new RegExp(escapeRegExp(searchText), 'gi');
    const highlightedValue = prioritizedField.value.replace(
      highlightRegex,
      (match) => `<mark>${match}</mark>`
    );

    return `${prioritizedField.field}: ${highlightedValue}`;
  }

  displayContactResults(results, searchText) {
    // Scroll to top before rendering new results
    this.resultsContainer.closest('.modal-content')?.scrollTo(0, 0);
    this.resultsContainer.innerHTML = '';

    results.forEach(async (contact) => {
      const contactElement = document.createElement('div');
      contactElement.className = 'chat-item contact-item';

      const avatarHtml = await getContactAvatarHtml(contact);

      // Create match preview with label and highlighted matched value prioritizing exact and starts-with matches
      const matchPreview = this.createMatchPreview(contact, searchText);
      const displayedName = getContactDisplayName(contact);

      contactElement.innerHTML = `
              <div class="chat-avatar">
                  ${avatarHtml}
              </div>
              <div class="chat-content">
                  <div class="chat-header">
                      <span class="chat-name">${displayedName}</span>
                  </div>
                  <div class="chat-message">
                      <span class="match-label">${matchPreview}</span>
                  </div>
              </div>
          `;

      // Add click handler to show contact info
      contactElement.addEventListener('click', () => {
        // clear search results and input contactSearchResults
        this.resultsContainer.innerHTML = '';
        this.searchInput.value = '';
        // Create display info and open contact info modal
        contactInfoModal.open(createDisplayInfo(contact));
        // Close the search modal
        this.close();
      });

      this.resultsContainer.appendChild(contactElement);
    });
  }
}

const searchContactsModal = new SearchContactsModal();

// Create a display info object from a contact object
function createDisplayInfo(contact) {
  return {
    username: contact.username || contact.address.slice(0, 8) + '…' + contact.address.slice(-6),
    name: contact.name || 'Not Entered',
    providedname: contact.senderInfo?.name || 'Not provided',
    email: contact.senderInfo?.email || 'Not provided',
    phone: contact.senderInfo?.phone || 'Not provided',
    linkedin: contact.senderInfo?.linkedin || 'Not provided',
    x: contact.senderInfo?.x || 'Not provided',
    address: contact.address,
    hasAvatar: !!contact.hasAvatar,
    avatarId: contact.avatarId,
    mineAvatarId: contact.mineAvatarId,
    useAvatar: contact.useAvatar,
  };
}

/**
 * AvatarEditModal manages the upload/edit/delete flow for contact avatars,
 * including pan/zoom preview, cropping, and persistence hooks.
 */
class AvatarEditModal {
  constructor() {
    this.modal = null;
    this.backButton = null;
    this.uploadButton = null;
    this.deleteButton = null;
    this.fileInput = null;
    this.previewContainer = null;
    this.previewSquare = null;
    this.previewBg = null;
    this.foregroundImg = null;
    this.currentAddress = null;
    this.previewUrl = null;
    this.pendingBlob = null;
    this.activeImageBlob = null;
    this.imageNaturalWidth = 0;
    this.imageNaturalHeight = 0;
    this.baseScale = 1;
    this.zoom = 1;
    this.minZoom = 1;
    this.maxZoom = 3;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialOffsetX = 0;
    this.initialOffsetY = 0;
    this.zoomRange = null;
    this.circleSize = 218;
    this.squareSize = 220;
    this.enableTransform = false;
    this.coverOverscan = 16; // extra pixels to ensure circle is always fully covered
    this.isOwnAvatar = false; // Track if editing own avatar vs contact avatar
    this._avatarEditSelected = null; // 'contact' | 'mine' | 'identicon'
    // Cached DOM refs for avatar options
    this.avatarOptionsContainer = null;
    this.avatarOptionsActions = null;
    this.avatarThumbContact = null;
    this.avatarThumbUploaded = null;
    this.avatarThumbIdenticon = null;
    this.avatarOptionContact = null;
    this.avatarOptionUploaded = null;
    this.avatarOptionIdenticon = null;
    this.avatarUseButton = null;
    // Track object URLs created for option thumbnails so we can revoke them
    this._optionBlobUrls = [];
  }

  load() {
    this.modal = document.getElementById('avatarEditModal');
    this.backButton = document.getElementById('closeAvatarEditModal');
    this.uploadButton = document.getElementById('avatarEditUploadButton');
    this.deleteButton = document.getElementById('avatarEditDeleteButton');
    this.saveActionButton = document.getElementById('avatarEditSaveButton');
    this.cancelButton = document.getElementById('avatarEditCancelButton');
    this.fileInput = document.getElementById('avatarEditFileInput');
    this.previewContainer = document.getElementById('avatarEditPreview');
    this.previewSquare = document.getElementById('avatarEditSquare');
    this.zoomRange = document.getElementById('avatarZoomRange');
    this.zoomControls = document.querySelector('.avatar-edit-controls');
    this.avatarOptionsContainer = document.getElementById('avatarOptionsContainer');
    this.avatarOptionsActions = document.getElementById('avatarOptionsActions');
    this.avatarThumbContact = document.getElementById('avatarThumbContact');
    this.avatarThumbUploaded = document.getElementById('avatarThumbUploaded');
    this.avatarThumbIdenticon = document.getElementById('avatarThumbIdenticon');
    this.avatarOptionContact = document.getElementById('avatarOptionContact');
    this.avatarOptionUploaded = document.getElementById('avatarOptionUploaded');
    this.avatarOptionIdenticon = document.getElementById('avatarOptionIdenticon');
    this.avatarUseButton = document.getElementById('avatarUseButton');

    if (!this.modal || !this.backButton || !this.uploadButton || !this.deleteButton || !this.saveActionButton || !this.cancelButton || !this.fileInput || !this.previewContainer || !this.previewSquare || !this.zoomRange) {
      console.warn('AvatarEditModal elements not found');
      return;
    }

    // Ensure background img layer exists
    this.previewBg = document.createElement('img');
    this.previewBg.className = 'avatar-edit-bg-img';
    this.previewBg.setAttribute('aria-hidden', 'true');
    this.previewBg.draggable = false;
    this.previewSquare.prepend(this.previewBg);

    // Ensure foreground img element exists
    this.foregroundImg = document.createElement('img');
    this.foregroundImg.className = 'avatar-edit-img';
    this.foregroundImg.setAttribute('alt', '');
    this.foregroundImg.draggable = false;
    this.previewContainer.innerHTML = '';
    this.previewContainer.appendChild(this.foregroundImg);

    this.backButton.addEventListener('click', () => this.close());
    this.uploadButton.addEventListener('click', () => this.handleUploadButton());
    this.deleteButton.addEventListener('click', () => this.handleDelete());
    this.saveActionButton.addEventListener('click', () => this.handleSave());
    this.cancelButton.addEventListener('click', () => this.handleCancel());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelected(e));

    this.zoomRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.enableTransform) {
        this.setZoom(val);
      }
    });

    // Pointer events for panning
    const startDrag = (clientX, clientY) => {
      if (!this.enableTransform) return;
      this.dragging = true;
      this.dragStartX = clientX;
      this.dragStartY = clientY;
      this.initialOffsetX = this.offsetX;
      this.initialOffsetY = this.offsetY;
    };

    const moveDrag = (clientX, clientY) => {
      if (!this.dragging) return;
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      this.setOffsets(this.initialOffsetX + dx, this.initialOffsetY + dy);
    };

    const endDrag = () => {
      this.dragging = false;
    };

    this.previewSquare.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', endDrag);

    this.previewSquare.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener('touchend', endDrag);
  }

  async open(address, isOwnAvatar = false) {
    this.currentAddress = normalizeAddress(address);
    this.isOwnAvatar = isOwnAvatar; // Track if editing own avatar vs contact avatar
    this.pendingBlob = null;
    this.activeImageBlob = null;
    this.enableTransform = false;
    await this.refreshPreview();
    // populate three-option avatar selector (contact, mine, identicon)
    try { await this.populateOptions(); } catch (e) { console.warn('populateOptions failed', e); }
    this.modal.classList.add('active');
    enterFullscreen();
  }

  close() {
    this.modal.classList.remove('active');
    this.clearPreviewUrl();
    this.pendingBlob = null;
    this.activeImageBlob = null;
    this.enableTransform = false;
    this.isOwnAvatar = false;
    this.imageNaturalWidth = 0;
    this.imageNaturalHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dragging = false;
    this.fileInput.value = '';
    // hide avatar options UI if present
    try {
      const container = document.getElementById('avatarOptionsContainer');
      const actions = document.getElementById('avatarOptionsActions');
      if (container) container.style.display = 'none';
      if (actions) actions.style.display = 'none';
      this._avatarEditSelected = null;
      const [o1,o2,o3] = [
        document.getElementById('avatarOptionContact'),
        document.getElementById('avatarOptionUploaded'),
        document.getElementById('avatarOptionIdenticon')
      ];
      [o1,o2,o3].forEach(o => { if (o) o.style.outline = 'none'; });
      const useBtn = document.getElementById('avatarUseButton');
      if (useBtn) useBtn.disabled = true;
      // Revoke any object URLs created for option thumbnails
      if (this._optionBlobUrls && this._optionBlobUrls.length) {
        for (const u of this._optionBlobUrls) {
          try { URL.revokeObjectURL(u); } catch (e) {}
        }
        this._optionBlobUrls = [];
      }
    } catch (e) {}
    enterFullscreen();
  }

  /**
   * Populate the avatar selection options (contact, mine, identicon)
   * and wire handlers to persist `useAvatar` for the contact.
   */
  async populateOptions() {
    const address = this.currentAddress;
    const contactThumb = this.avatarThumbContact;
    const uploadedThumb = this.avatarThumbUploaded;
    const identiconThumb = this.avatarThumbIdenticon;
    const container = this.avatarOptionsContainer;
    const actions = this.avatarOptionsActions;
    const useBtn = this.avatarUseButton;

    if (!contactThumb || !uploadedThumb || !identiconThumb || !container || !actions || !useBtn) return;

    // clear previous
    contactThumb.innerHTML = '';
    uploadedThumb.innerHTML = '';
    identiconThumb.innerHTML = '';
    this._avatarEditSelected = null;
    useBtn.disabled = true;

    // Revoke any previously-created option object URLs to avoid showing stale
    // thumbnails after deletes and to avoid leaking object URLs.
    if (this._optionBlobUrls && this._optionBlobUrls.length) {
      for (const u of this._optionBlobUrls) {
        try { URL.revokeObjectURL(u); } catch (e) {}
      }
      this._optionBlobUrls = [];
    }

    // fetch blobs (may be null). Use `get()` (blob) rather than cached blob URLs
    // so we can detect actual existence after deletes.
    let contactBlob = null;
    let userBlob = null;
    if (this.isOwnAvatar) {
      // When editing own avatar we do not show preference options —
      // only allow upload/delete. Hide options UI and show delete/upload as appropriate.
      container.style.display = 'none';
      actions.style.display = 'none';
      // Clear any stale option handlers and disable use button since options are hidden.
      try { useBtn.onclick = null; } catch (e) {}
      useBtn.disabled = true;
      this.deleteButton.style.display = myData?.account?.hasAvatar ? 'inline-flex' : 'none';
      // Early return: remaining option population is contact-specific and not needed for own avatar.
      return;
    } else {
      const contactObj = myData?.contacts?.[address] || null;
      try { contactBlob = contactObj?.avatarId ? await contactAvatarCache.get(contactObj.avatarId) : null; } catch (e) { contactBlob = null; }
      try { userBlob = contactObj?.mineAvatarId ? await contactAvatarCache.get(contactObj.mineAvatarId) : null; } catch (e) { userBlob = null; }
    }

    const contactUrl = contactBlob ? URL.createObjectURL(contactBlob) : null;
    const userUrl = userBlob ? URL.createObjectURL(userBlob) : null;
    if (contactUrl) this._optionBlobUrls.push(contactUrl);
    if (userUrl) this._optionBlobUrls.push(userUrl);

    // If there are no uploaded avatars for this contact (neither contact-sent nor user's uploaded),
    // do not show the avatar options UI at all. For own-avatar editing we hide the options when
    // there is no account avatar available.
    if (!contactUrl && !userUrl) {
      if (container) container.style.display = 'none';
      if (actions) actions.style.display = 'none';
      // ensure use button disabled
      if (useBtn) useBtn.disabled = true;
      // hide delete button as there's nothing for the user to delete
      if (this.deleteButton) this.deleteButton.style.display = 'none';
      return;
    }

    if (contactUrl) {
      contactThumb.innerHTML = `<img src="${contactUrl}" width="64" height="64" style="border-radius:50%">`;
    } else {
      contactThumb.innerHTML = '';
    }

    if (userUrl) {
      uploadedThumb.innerHTML = `<img src="${userUrl}" width="64" height="64" style="border-radius:50%">`;
    } else {
      uploadedThumb.innerHTML = '';
    }

    identiconThumb.innerHTML = generateIdenticon(address, 64);

    // hide option entries that don't have an image (don't show empty options)
    if (this.avatarOptionContact) this.avatarOptionContact.style.display = contactUrl ? '' : 'none';
    if (this.avatarOptionUploaded) this.avatarOptionUploaded.style.display = userUrl ? '' : 'none';
    if (this.avatarOptionIdenticon) this.avatarOptionIdenticon.style.display = identiconThumb ? '' : 'none';

    // show container and actions
    container.style.display = 'block';
    actions.style.display = 'block';

    // Show Delete button only when appropriate:
    // - If editing own avatar: show when account hasAvatar
    // - If editing a contact: show when the user's uploaded ('mine') avatar exists
    try {
      if (this.deleteButton) {
        this.deleteButton.style.display = userUrl ? 'inline-flex' : 'none';
      }
    } catch (e) {}

    // Ensure any avatar images inside this modal's header/controls show the user's uploaded
    // avatar (`mine`) or the identicon — never the contact-sent avatar. This prevents the
    // edit-icon area from displaying the contact avatar when editing.
    try {
      const headerImgs = this.modal.querySelectorAll('.contact-avatar-img');
      if (headerImgs && headerImgs.length) {
        for (const imgEl of headerImgs) {
          if (userUrl) {
            imgEl.src = userUrl;
          } else {
            // Replace the <img> with the identicon SVG
            const sizeAttr = parseInt(imgEl.getAttribute('width')) || 40;
            const wrapper = document.createElement('span');
            wrapper.innerHTML = generateIdenticon(address, sizeAttr);
            imgEl.replaceWith(wrapper.firstChild);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to update modal header avatar images:', e);
    }

    // attach click handlers (re-attach to ensure latest)

    const selectOption = (type, el) => {
      this._avatarEditSelected = type;
      useBtn.disabled = false;
      [this.avatarOptionContact, this.avatarOptionUploaded, this.avatarOptionIdenticon].forEach(o => { if (o) o.style.outline = 'none'; });
      if (el) el.style.outline = '3px solid #007acc';
    };

    // Pre-select the current useAvatar preference if set (only if that option is visible).
    // For contacts, prefer stored per-contact preference; default to identicon.
    const currentPref = myData?.contacts?.[address]?.useAvatar ?? null;
    const effectivePref = currentPref ?? 'identicon';

    if (effectivePref) {
      if (effectivePref === 'contact' && this.avatarOptionContact && this.avatarOptionContact.style.display !== 'none') selectOption('contact', this.avatarOptionContact);
      else if (effectivePref === 'mine' && this.avatarOptionUploaded && this.avatarOptionUploaded.style.display !== 'none') selectOption('mine', this.avatarOptionUploaded);
      else if (effectivePref === 'identicon' && this.avatarOptionIdenticon && this.avatarOptionIdenticon.style.display !== 'none') selectOption('identicon', this.avatarOptionIdenticon);
    }
    if (this.avatarOptionContact) this.avatarOptionContact.onclick = () => selectOption('contact', this.avatarOptionContact);
    if (this.avatarOptionUploaded) this.avatarOptionUploaded.onclick = () => selectOption('mine', this.avatarOptionUploaded);
    if (this.avatarOptionIdenticon) this.avatarOptionIdenticon.onclick = () => selectOption('identicon', this.avatarOptionIdenticon);

    useBtn.onclick = async () => {
      if (!this._avatarEditSelected || !address) return;
      if (this.isOwnAvatar) {
        // Own-avatar options are not shown; do not persist an account-level preference.
        // Just refresh the My Info UI in case nothing changed.
        try {
          if (myInfoModal && typeof myInfoModal.updateMyInfo === 'function') {
            myInfoModal.updateMyInfo();
          }
        } catch (e) {
          console.warn('Failed to refresh My Info UI after avatar option selection (own avatar):', e);
        }
      } else {
        // persist preference on contact
        myData.contacts ??= {};
        myData.contacts[address] ??= { address };
        myData.contacts[address].useAvatar = this._avatarEditSelected;
        saveState();
        // Update UI where appropriate so the change is visible immediately
        try {
          const contact = myData.contacts[address];
          if (contactInfoModal && typeof contactInfoModal.updateContactInfo === 'function') {
            await contactInfoModal.updateContactInfo(createDisplayInfo(contact));
            contactInfoModal.needsContactListUpdate = true;
          }
          if (chatModal && chatModal.isActive && chatModal.isActive() && chatModal.address === address) {
            chatModal.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);
          }
          // Update EditContactModal avatar if it's active and showing this contact
          if (editContactModal.isActive() && editContactModal.currentContactAddress === address) {
            await editContactModal.updateAvatar(contact);
          }
        } catch (e) {
          console.warn('Failed to refresh avatar UI after selecting useAvatar:', e);
        }
      }
      // Close modal
      this.close();
    };

    // wire close button to hide our controls when closed
    const closeBtn = document.getElementById('closeAvatarEditModal');
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (container) container.style.display = 'none';
        if (actions) actions.style.display = 'none';
      };
    }
  }

  /**
   * Revoke the current preview object URL, if any.
   */
  revokePreviewUrl() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  /**
   * Clear preview URLs and hide image elements when not editing.
   */
  clearPreviewUrl() {
    this.revokePreviewUrl();
    // Clear sources to release memory when not editing
    if (!this.enableTransform) {
      if (this.foregroundImg) {
        this.foregroundImg.src = '';
        this.foregroundImg.style.display = 'none';
      }
      if (this.previewBg) {
        this.previewBg.src = '';
        this.previewBg.style.display = 'none';
      }
    }
  }

  /**
   * Refresh the preview based on pending state, cached avatar, or identicon fallback.
   */
  async refreshPreview() {
    this.clearPreviewUrl();
    let displayInfo;
    if (this.isOwnAvatar) {
      // For own avatar, use account data
      displayInfo = { address: this.currentAddress, hasAvatar: myData?.account?.hasAvatar || false };
    } else {
      const contact = myData?.contacts?.[this.currentAddress];
      displayInfo = contact ? createDisplayInfo(contact) : { address: this.currentAddress, hasAvatar: false };
    }

    if (this.pendingBlob) {
      await this.setImageFromBlob(this.pendingBlob, true);
      return;
    }

    // For contact avatar editing: show only the user's uploaded avatar ('mine') if present,
    // otherwise fall back to identicon. We intentionally ignore the contact-sent avatar here.
    if (!this.isOwnAvatar) {
      try {
        const contactObj = myData?.contacts?.[this.currentAddress] || null;
        const mineBlob = contactObj?.mineAvatarId ? await contactAvatarCache.get(contactObj.mineAvatarId) : null;
        if (mineBlob) {
          await this.setImageFromBlob(mineBlob, false);
          return;
        }
      } catch (e) {
        // ignore and fall through to identicon
      }

      // No user-uploaded avatar -> show identicon (never show contact avatar here)
      const avatarHtml = generateIdenticon(this.currentAddress, 218);
      this.previewContainer.innerHTML = avatarHtml;
      this.enableTransform = false;
      this.updateZoomUI();
      if (this.previewBg) this.previewBg.style.display = 'none';
      if (this.foregroundImg) this.foregroundImg.style.display = 'none';
      this.updateButtonVisibility();
      return;
    }

    // For own avatar, keep existing behavior (account-based)
    let avatarBlob = null;
    try {
      avatarBlob = await contactAvatarCache.get(myData?.account?.avatarId);
    } catch (e) {
      avatarBlob = null;
    }

    if (avatarBlob) {
      await this.setImageFromBlob(avatarBlob, false);
      return;
    }

    // Fallback to identicon if no avatar blob for own avatar
    const avatarHtml = await getContactAvatarHtml(displayInfo, 218);
    this.previewContainer.innerHTML = avatarHtml;
    this.enableTransform = false;
    this.updateZoomUI();
    if (this.previewBg) this.previewBg.style.display = 'none';
    if (this.foregroundImg) this.foregroundImg.style.display = 'none';
    this.updateButtonVisibility();
  }

  /**
   * Update button visibility based on whether a new image is uploaded.
   * Only shows Save/Cancel when user uploads a new photo, not when viewing existing avatar.
   */
  updateButtonVisibility() {
    const hasNewUpload = !!this.pendingBlob; // Only true when user uploads a new photo
    
    if (hasNewUpload) {
      // Show Save/Cancel buttons, hide Upload/Delete buttons
      this.uploadButton.style.display = 'none';
      this.deleteButton.style.display = 'none';
      this.saveActionButton.style.display = 'inline-flex';
      this.cancelButton.style.display = 'inline-flex';
    } else {
      // Show Upload button and Save/Cancel hidden. Delete visibility for contacts is
      // controlled by `populateOptions()` (which has async knowledge of cache). Only
      // set Delete visibility here for own-avatar context.
      this.uploadButton.style.display = 'inline-flex';
      if (this.isOwnAvatar) {
        const hasAvatar = !!myData?.account?.hasAvatar;
        this.deleteButton.style.display = hasAvatar ? 'inline-flex' : 'none';
      }
      this.saveActionButton.style.display = 'none';
      this.cancelButton.style.display = 'none';
    }
  }

  /**
   * Handle file chooser selection for avatar upload.
   * @param {Event} event Input change event
   */
  handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      showToast('Please select an image file.', 2000, 'error');
      return;
    }
    this.pendingBlob = file;
    // Allow selecting the same file again after delete by clearing input value post-read
    if (this.fileInput) {
      this.fileInput.value = '';
    }
    this.setImageFromBlob(file, true);
    this.updateButtonVisibility();
  }

  /**
   * Handle cancel - discard uploaded image and revert to original state.
   */
  async handleCancel() {
    // Clear any pending uploads but keep existing avatar
    this.pendingBlob = null;
    if (this.fileInput) {
      this.fileInput.value = '';
    }
    // Refresh to show original state
    await this.refreshPreview();
  }

  /**
   * Attempt to delete an avatar from the attachment server.
   * Accepts an avatarId and optional secret; for backwards compatibility
   * the secret may be omitted.
   * @param {string} id Avatar id
   * @param {string?} secret Avatar secret
   */
  async deleteAvatarFromServer(id, secret) {
    if (!id) return false;
    try {
      const idParam = encodeURIComponent(secret ? `${id}-${secret}` : id);
      try {
        const delRes = await fetch(`${network.attachmentServerUrl}/delete/${idParam}`, { method: 'DELETE' });
        if (!delRes.ok) {
          if (delRes.status === 404) {
            // Missing resource on server -> treat as already-deleted (success)
            return true;
          }
          console.warn('Avatar delete request failed on server:', delRes.status, await delRes.text().catch(() => ''));
          return false;
        }
        return true;
      } catch (e) {
        console.warn('Failed to call avatar delete endpoint:', e);
        return false;
      }
    } catch (e) {
      console.warn('Error while attempting avatar server delete:', e);
      return false;
    }
  }

  handleUploadButton(){
    if (!isOnline && this.isOwnAvatar) {
      showToast('You are offline. Please try again when connected.', 3000, 'error');
      return;
    }
    this.fileInput.click(); 
  }

  /**
   * Delete the current avatar immediately and save.
   */
  async handleDelete() {
    if (!isOnline && this.isOwnAvatar) {
      showToast('You are offline. Please try again when connected.', 3000, 'error');
      return;
    }

    if (!this.currentAddress) {
      this.close();
      return;
    }

    try {
      if (this.isOwnAvatar) {
        // Update own avatar state
        if (myData?.account) {
          // Attempt to delete avatar on attachment server if we have id (secret optional)
          let deletedOnServer = true;
          try {
            const aid = myData.account.avatarId;
            const secret = myData.account.avatarSecret;
            if (aid) deletedOnServer = await this.deleteAvatarFromServer(aid, secret);
          } catch (e) {
            console.warn('Error while attempting avatar server delete:', e);
            deletedOnServer = false;
          }

          if (deletedOnServer) {
            // delete account avatar by id
            await contactAvatarCache.delete(myData?.account?.avatarId);
            myData.account.hasAvatar = false;
            delete myData.account.avatarId;
            delete myData.account.avatarKey;
            delete myData.account.avatarSecret;
            saveState();
          } else {
            showToast('Failed to delete avatar', 3000, 'error');
          }
        }
        // Update My Info modal UI
        myInfoModal.updateMyInfo();
        // Update header avatar
        header.updateAvatar();
      } else {
        const contact = myData?.contacts?.[this.currentAddress];
        if (!contact) {
          this.close();
          return;
        }

        // Delete only the user's uploaded avatar slot ('mine'). Do not remove contact-sent avatar.
        if (contact.mineAvatarId) {
          await contactAvatarCache.delete(contact.mineAvatarId);
          delete contact.mineAvatarId;
        }

        // Check whether a contact-sent avatar still exists
        let contactExists = false;
        try {
          const contactBlob = contact.avatarId ? await contactAvatarCache.get(contact.avatarId) : null;
          contactExists = !!contactBlob;
        } catch (e) {
          contactExists = false;
        }

        // Update contact.hasAvatar to reflect any remaining avatar
        contact.hasAvatar = contactExists;

        // Set per-contact preference only if the user previously preferred their uploaded avatar.
        // If the current preference is not 'mine', leave it unchanged.
        myData.contacts ??= {};
        myData.contacts[this.currentAddress] ??= { address: this.currentAddress };
        const currentPref = myData.contacts[this.currentAddress].useAvatar ?? null;
        if (currentPref === 'mine') {
          myData.contacts[this.currentAddress].useAvatar = contactExists ? 'contact' : 'identicon';
          saveState();
        }

        // Update UI so contact info reflects deletion
        contactInfoModal.updateContactInfo(createDisplayInfo(contact));
        contactInfoModal.needsContactListUpdate = true;
        if (chatModal.isActive() && chatModal.address === this.currentAddress) {
          chatModal.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);
        }
      }

      // Revoke any option thumbnails in this modal to avoid showing stale URLs
      if (this._optionBlobUrls && this._optionBlobUrls.length) {
        for (const u of this._optionBlobUrls) {
          try { URL.revokeObjectURL(u); } catch (e) {}
        }
        this._optionBlobUrls = [];
      }

      // Refresh the option list once so the modal immediately reflects the deletion
      try {
        await this.populateOptions();
      } catch (e) {
        console.warn('Failed to repopulate avatar options after delete:', e);
      }

      // Update preview in the modal to show identicon
      await this.refreshPreview();
    } catch (err) {
      console.warn('Failed to delete avatar:', err);
      showToast('Failed to delete avatar', 2000, 'error');
    }
  }

  /**
   * Load a blob into the preview, enabling transforms only for user uploads.
   * @param {Blob} blob Image blob
   * @param {boolean} isUserUpload Whether this is a new user upload
   */
  async setImageFromBlob(blob, isUserUpload = false) {
    try {
      this.revokePreviewUrl();
      const blobUrl = URL.createObjectURL(blob);
      const img = await this.loadImage(blobUrl);
      // Ensure foreground container is clean (remove any identicon innerHTML)
      if (this.previewContainer) {
        this.previewContainer.innerHTML = '';
        this.previewContainer.appendChild(this.foregroundImg);
      }

      this.activeImageBlob = blob;
      this.previewUrl = blobUrl;
      this.imageNaturalWidth = img.naturalWidth;
      this.imageNaturalHeight = img.naturalHeight;
      this.enableTransform = !!isUserUpload;
      this.resetTransform();
      this.applyImageSources(blobUrl);

      // If user uploaded, enable pan/zoom with background context image
      if (this.enableTransform) {
        if (this.previewBg) this.previewBg.style.display = 'block';
        if (this.foregroundImg) this.foregroundImg.style.display = 'block';
        this.applyTransform();
      } else {
        // Existing avatar preview: fit image to circle, hide background
        if (this.previewBg) {
          this.previewBg.style.display = 'none';
        }
        if (this.foregroundImg) {
          this.foregroundImg.style.display = 'block';
          this.foregroundImg.style.width = '100%';
          this.foregroundImg.style.height = '100%';
          this.foregroundImg.style.left = '50%';
          this.foregroundImg.style.top = '50%';
          this.foregroundImg.style.transform = 'translate(-50%, -50%)';
        }
      }
      this.updateButtonVisibility();
    } catch (e) {
      console.warn('Failed to load image for avatar editing:', e);
      showToast('Could not load image', 2000, 'error');
    }
  }

  /**
   * Load an image and resolve when ready.
   * @param {string} url Object URL to load
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  resetTransform() {
    // Calculate base scale to ensure circle is covered with overscan
    if (!this.imageNaturalWidth || !this.imageNaturalHeight) {
      this.baseScale = 1;
    } else {
      const minW = this.circleSize + this.coverOverscan * 2;
      const minH = this.circleSize + this.coverOverscan * 2;
      this.baseScale = Math.max(minW / this.imageNaturalWidth, minH / this.imageNaturalHeight);
      // Ensure tiny images at least cover the square
      const squareScale = Math.max(this.squareSize / this.imageNaturalWidth, this.squareSize / this.imageNaturalHeight);
      this.baseScale = Math.max(this.baseScale, squareScale);
    }
    this.minZoom = this.baseScale;
    this.maxZoom = this.baseScale * 3;
    this.zoom = this.baseScale;
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateZoomUI();
  }

  /**
   * Update zoom slider bounds/state and disable when transform is off.
   */
  updateZoomUI() {
    if (this.zoomRange) {
      this.zoomRange.min = this.minZoom.toFixed(2);
      this.zoomRange.max = this.maxZoom.toFixed(2);
      this.zoomRange.value = this.zoom.toFixed(2);
      this.zoomRange.disabled = !this.enableTransform;
    }
    // Show/hide zoom controls based on whether transform is enabled
    if (this.zoomControls) {
      this.zoomControls.style.display = this.enableTransform ? 'flex' : 'none';
    }
  }

  /**
   * Set zoom level and re-apply transform.
   * @param {number} value Requested zoom
   */
  setZoom(value) {
    const clamped = Math.min(this.maxZoom, Math.max(this.minZoom, value));
    this.zoom = clamped;
    this.applyTransform();
    this.updateZoomUI();
  }

  /**
   * Set pan offsets and re-apply transform.
   * @param {number} x Offset in px
   * @param {number} y Offset in px
   */
  setOffsets(x, y) {
    this.offsetX = x;
    this.offsetY = y;
    this.applyTransform();
  }

  /**
   * Clamp offsets to ensure circle stays covered when panning.
   * @param {number} displayWidth Rendered image width
   * @param {number} displayHeight Rendered image height
   */
  clampOffsets(displayWidth, displayHeight) {
    const circleRadius = this.circleSize / 2 + this.coverOverscan;
    const halfW = displayWidth / 2;
    const halfH = displayHeight / 2;

    const maxOffsetX = Math.max(0, halfW - circleRadius);
    const maxOffsetY = Math.max(0, halfH - circleRadius);

    this.offsetX = Math.min(Math.max(this.offsetX, -maxOffsetX), maxOffsetX);
    this.offsetY = Math.min(Math.max(this.offsetY, -maxOffsetY), maxOffsetY);
  }

  /**
   * Apply current zoom/offset transforms to the preview images.
   */
  applyTransform() {
    if (!this.enableTransform) return;
    if (!this.imageNaturalWidth || !this.imageNaturalHeight) return;

    const displayWidth = this.imageNaturalWidth * this.zoom;
    const displayHeight = this.imageNaturalHeight * this.zoom;

    this.clampOffsets(displayWidth, displayHeight);

    const translateX = `calc(-50% + ${this.offsetX}px)`;
    const translateY = `calc(-50% + ${this.offsetY}px)`;

    if (this.foregroundImg) {
      this.foregroundImg.style.width = `${displayWidth}px`;
      this.foregroundImg.style.height = `${displayHeight}px`;
      this.foregroundImg.style.left = '50%';
      this.foregroundImg.style.top = '50%';
      this.foregroundImg.style.transform = `translate(${translateX}, ${translateY})`;
    }

    if (this.previewBg) {
      this.previewBg.style.width = `${displayWidth}px`;
      this.previewBg.style.height = `${displayHeight}px`;
      this.previewBg.style.left = '50%';
      this.previewBg.style.top = '50%';
      this.previewBg.style.transform = `translate(${translateX}, ${translateY})`;
    }
  }

  /**
   * Set src attributes for both background and foreground layers.
   * @param {string} url Object URL for the image
   */
  applyImageSources(url) {
    if (this.previewBg) {
      this.previewBg.src = url;
    }
    if (this.foregroundImg) {
      this.foregroundImg.src = url;
    }
  }

  /**
   * Save current avatar state: delete, or export cropped thumbnail and persist.
   */
  async handleSave() {
    if (!this.currentAddress) {
      this.close();
      return;
    }

    try {
      // Need an image source to save
      if (this.pendingBlob || this.activeImageBlob) {
        const sourceBlob = this.pendingBlob || this.activeImageBlob;
        const thumbnail = await this.exportCroppedThumbnail(sourceBlob);

        if (this.isOwnAvatar) {
          // If we already have an avatar on the server, try to delete it first
          let deletedOld = true;
          try {
            const oldId = myData?.account?.avatarId;
            const oldSecret = myData?.account?.avatarSecret;
            if (oldId) deletedOld = await this.deleteAvatarFromServer(oldId, oldSecret);
          } catch (e) {
            console.warn('Failed to delete existing avatar before upload:', e);
            deletedOld = false;
          }

          if (!deletedOld) {
            showToast('Upload failed: could not delete existing avatar from server', 3000, 'error');
            return;
          }

          // Generate random key and secret, encrypt thumbnail
          const avatarKey = generateRandomBytes(32);
          const secret = bin2hex(generateRandomBytes(16));
          const encryptedBlob = await encryptBlob(thumbnail, avatarKey);

          // Upload encrypted blob to attachment server
          const formData = new FormData();
          formData.append('file', encryptedBlob);
          formData.append('secret', secret);
          const response = await fetch(`${network.attachmentServerUrl}/post`, {
            method: 'POST',
            body: formData
          });
          if (!response.ok) {
            showToast('Failed to upload avatar', 3000, 'error');
            return;
          }
          const result = await response.json();
          const avatarId = result.id;

          // Save thumbnail to cache now that server operations succeeded (keyed by avatarId)
          await contactAvatarCache.save(avatarId, thumbnail);

          // Save id, key and secret in account
          myData.account.avatarId = avatarId;
          myData.account.avatarKey = bin2base64(avatarKey);
          myData.account.avatarSecret = secret;
          myData.account.hasAvatar = true;
          saveState();

          // Update My Info modal UI
          myInfoModal.updateMyInfo();
          // Update header avatar
          header.updateAvatar();
        } else {
          const contact = myData?.contacts?.[this.currentAddress];
          if (!contact) {
            this.close();
            return;
          }
          contact.hasAvatar = true;
          // Save user's uploaded avatar under a generated id and reference it on the contact
          const mineId = bin2hex(generateRandomBytes(16));
          await contactAvatarCache.save(mineId, thumbnail);
          contact.mineAvatarId = mineId;
          // Prefer the user's uploaded avatar for this contact
          myData.contacts ??= {};
          myData.contacts[this.currentAddress] ??= { address: this.currentAddress };
          myData.contacts[this.currentAddress].useAvatar = 'mine';
          saveState();
          await contactInfoModal.updateContactInfo(createDisplayInfo(contact));
          contactInfoModal.needsContactListUpdate = true;
          if (chatModal.isActive() && chatModal.address === this.currentAddress) {
            chatModal.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);
          }
          // Update EditContactModal avatar if it's active and showing this contact
          if (editContactModal.isActive() && editContactModal.currentContactAddress === this.currentAddress ) {
            await editContactModal.updateAvatar(contact);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to save avatar:', err);
      showToast('Failed to save avatar', 2000, 'error');
    } finally {
      this.close();
    }
  }

  /**
   * Export the current view as a circular thumbnail blob.
   * Falls back to basic thumbnail generation if dimensions are unavailable.
   * @param {Blob} sourceBlob Original image blob
   * @returns {Promise<Blob>}
   */
  async exportCroppedThumbnail(sourceBlob) {
    // Ensure image is loaded
    if (!this.imageNaturalWidth || !this.imageNaturalHeight) {
      return contactAvatarCache.generateThumbnail(sourceBlob);
    }

    const canvasSize = this.circleSize; // 180
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    // Clip to circle
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const displayWidth = this.imageNaturalWidth * this.zoom;
    const displayHeight = this.imageNaturalHeight * this.zoom;
    const squareCenter = this.squareSize / 2; // 110
    const imgDrawX = (squareCenter + this.offsetX) - (displayWidth / 2);
    const imgDrawY = (squareCenter + this.offsetY) - (displayHeight / 2);
    const circleLeft = (this.squareSize - this.circleSize) / 2; // 20
    const circleTop = (this.squareSize - this.circleSize) / 2; // 20

    // Draw using the loaded image element
    const imageForDraw = await this.loadImage(this.previewUrl || URL.createObjectURL(sourceBlob));

    ctx.drawImage(
      imageForDraw,
      imgDrawX - circleLeft,
      imgDrawY - circleTop,
      displayWidth,
      displayHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export avatar thumbnail'));
        }
      }, 'image/jpeg', 0.9);
    });
  }
}

const avatarEditModal = new AvatarEditModal();

// Safely escape user-entered search text before building regex-based highlights.
function escapeRegExp(string = '') {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to generate a hash-based deduplication key from message content
function generateMessageHash(message) {
  if(!message) return '';
  if (typeof message !== 'string') {
    console.error('Message is not a string', message);
    return '';
  }
  const hex = hashBytes(message);
  return hex.slice(0, 20);
}

// Add this function before the ContactInfoModal class
function showToast(message, duration = 2000, type = 'default', isHTML = false) {
  const toastContainer = document.getElementById('toastContainer');
  
  // Generate deduplication key from message hash
  const deduplicateKey = generateMessageHash(message);
  
  // Check for duplicate toasts using the deduplication key
  const existingToast = document.querySelector(`[data-deduplicate-key="${deduplicateKey}"]`);
  if (existingToast) {
    // Toast with this key already exists, don't create another one
    return existingToast.id;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  if (isHTML) {
    toast.innerHTML = message;
  } else {
    toast.textContent = message;
  }

  // Generate a unique ID for this toast
  const toastId = 'toast-' + getCorrectedTimestamp() + '-' + Math.floor(Math.random() * 1000);
  toast.id = toastId;
  
  // Add deduplication key (always set since we generate one if not provided)
  toast.setAttribute('data-deduplicate-key', deduplicateKey);

  toastContainer.appendChild(toast);

  // Force reflow to enable transition
  toast.offsetHeight;

  // Show with a slight delay to ensure rendering
  setTimeout(() => {
    toast.classList.add('show');
    
    // Duration determines behavior: <= 0 = sticky (requires close button), > 0 = auto-dismiss
    // Exception: loading toasts are never manually closable by user
    if (duration <= 0 && type !== 'loading') {
      // Sticky toast - add close button and click handler (but not for loading toasts)
      toast.classList.add('sticky');
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close-btn';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '&times;';
      toast.appendChild(closeBtn);

      // Make the whole toast clickable to close
      toast.onclick = () => {
        hideToast(toastId);
      };
    } else if (duration > 0) {
      // Auto-dismiss toast - no close button needed
      setTimeout(() => {
        hideToast(toastId);
      }, duration);
    }
    // If duration <= 0 and type === 'loading', do nothing - toast stays until programmatically removed
  }, 10);

  return toastId;
}

// Function to hide a specific toast by ID
function hideToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  toast.classList.remove('show');
  setTimeout(() => {
    const toastContainer = document.getElementById('toastContainer');
    if (toast.parentNode === toastContainer) {
      toastContainer.removeChild(toast);
    }
  }, 300); // Match transition duration
}


// Handle online/offline events
async function handleConnectivityChange() {
  if (isOnline) {
    await getNetworkParams();
    if (!isOnline) return;
    // We just came back online
    updateUIForConnectivity();
    showToast("You're back online!", 3000, 'online');
    // Force update data with reconnection handling
    if (myAccount && myAccount.keys) {
      // restart long polling
      if (useLongPolling) {
        stopLongPoll(); // Stop any existing polling first
        setTimeout(longPoll, 10);
      }
      try {
        // Update chats with reconnection handling
        const gotChats = await chatsScreen.updateChatData();
        if (gotChats > 0) {
          chatsScreen.updateChatList();
        }

        // Update contacts with reconnection handling
        await contactsScreen.updateContactsList();

        // Update wallet with reconnection handling
        await walletScreen.updateWalletView();
      } catch (error) {
        console.error('Failed to update data on reconnect:', error);
        showToast("Some data couldn't be updated. Please refresh if you notice missing information.", 5000, 'warning');
      }
    }
  } else if (!isOnline) {
    // We just went offline
    updateUIForConnectivity();
    showToast("You're offline. Some features are unavailable.", 3000, 'offline');
    // Stop long polling when going offline
    stopLongPoll();
  }
}

// Setup connectivity detection
function setupConnectivityDetection() {
  // Listen for browser online/offline events
  window.addEventListener('online', checkConnectivity);
  window.addEventListener('offline', checkConnectivity);

  // Mark elements that depend on connectivity
  markConnectivityDependentElements();

  // Check initial status (don't trust the browser's initial state)
  checkConnectivity();

  // Periodically check connectivity (every 5 seconds)
  setInterval(checkConnectivity, 5000);
}

// Mark elements that should be disabled when offline
function markConnectivityDependentElements() {
  // Elements that require network connectivity
  const networkDependentElements = [
    // Chat related
    '#handleSendMessage',
    '#voiceRecordButton',
    '#newChatForm button[type="submit"]',

    // Wallet related
    '#refreshBalance',
    '#openFaucetBridgeButton',
    '#sendForm button[type="submit"]',

    // Send asset related
    '#sendAssetForm button[type="submit"]',
    '#sendToAddress',
    '#toggleBalance',

    // Add friend related
    '#friendForm button[type="submit"]',
    '#friendForm input[name="friendStatus"]',

    // Contact related
    '#chatRecipient',
    '#chatAddFriendButton',
    '#addFriendButton',

    // Profile related
    '#createAccountForm button[type="submit"]',
    '#importForm button[type="submit"]',
    '#newUsername',
    '#newPrivateKey',
    '#migrateAccountsButton',

    // stakeModal
    '#submitStake',
    '#faucetButton',
    '#stakeNodeAddress',

    // tollModal
    '#saveNewTollButton',


    //validatorModal
    '#validator-learn-more',
    '#submitUnstake',

    //farmModal
    '#continueToFarm',

    // Call schedule modals
    '#callScheduleNowBtn',
    '#openCallScheduleDateBtn',
    '#confirmCallSchedule',

    // Message context menu (disable all except 'Delete for me' and 'Copy' and 'Join')
    '.message-context-menu .context-menu-option:not([data-action="delete"]):not([data-action="copy"]):not([data-action="join"])',

    // bridgeModal
    '#bridgeForm button[type="submit"]',

    // helpModal
    '#joinDiscord',
    '#submitFeedback',

    // updateWarningModal
    '#proceedToStoreBtn',

    // launchModal
    '#launchForm button[type="submit"]',    
  ];

  // Add data attribute to all network-dependent elements
  networkDependentElements.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      element.setAttribute('data-requires-connection', 'true');

      // Add tooltip for disabled state
      // element.title = 'This feature requires an internet connection';

      // Add aria label for accessibility
      element.setAttribute('aria-disabled', !isOnline);
    });
  });
}

// Update UI elements based on connectivity status
function updateUIForConnectivity() {
  const networkDependentElements = document.querySelectorAll('[data-requires-connection]');
  const offlineIndicator = document.getElementById('offlineIndicator');

  // Update offline indicator in header
  if (offlineIndicator) {
    if (!isOnline) {
      offlineIndicator.style.opacity = '1';
      offlineIndicator.style.visibility = 'visible';
      offlineIndicator.style.width = 'auto';
      offlineIndicator.style.padding = '4px 8px';
      offlineIndicator.style.overflow = 'visible';
    } else {
      offlineIndicator.style.opacity = '0';
      offlineIndicator.style.visibility = 'hidden';
      offlineIndicator.style.width = '0';
      offlineIndicator.style.padding = '0';
      offlineIndicator.style.overflow = 'hidden';
    }
  }

  networkDependentElements.forEach((element) => {
    if (!isOnline) {
      // Disable element
      element.disabled = true;
      element.classList.add('offline-disabled');

      // If it's a form, prevent submission
      if (element.form) {
        element.form.addEventListener('submit', preventOfflineSubmit);
      }
    } else {
      // Enable element
      element.disabled = false;
      element.classList.remove('offline-disabled');

      // Remove form submit prevention
      if (element.form) {
        element.form.removeEventListener('submit', preventOfflineSubmit);
      }
    }

    // Update aria-disabled state
    element.setAttribute('aria-disabled', !isOnline);
  });

  // When coming back online, re-validate buttons that may be disabled for reasons other than connectivity
  if (isOnline) {
    revalidateButtonStates();
  }
}

/**
 * Re-validates button states for modals/forms that have buttons disabled for multiple reasons
 * (not just offline status). This should be called when coming back online to ensure
 * buttons aren't incorrectly enabled if they should remain disabled for other reasons.
 */
function revalidateButtonStates() {
  // Check if validator modal is open and refresh it to re-validate all button states
  if (typeof validatorStakingModal !== 'undefined' && validatorStakingModal.isActive()) {
    validatorStakingModal.close();
    validatorStakingModal.open();
  }

  // Check if friend modal is open and re-validate submit button
  if (typeof friendModal !== 'undefined' && friendModal.isActive()) {
    friendModal.updateSubmitButtonState();
  }

  // Check if toll modal is open and re-validate save button
  if (typeof tollModal !== 'undefined' && tollModal.isActive()) {
    tollModal.updateSaveButtonState();
  }

  // Check if send asset form modal is open and re-validate send button
  if (typeof sendAssetFormModal !== 'undefined' && sendAssetFormModal.isActive()) {
    sendAssetFormModal.refreshSendButtonDisabledState();
  }
}

// Prevent form submissions when offline
function preventOfflineSubmit(event) {
  if (!isOnline) {
    event.preventDefault();
    showToast('This action requires an internet connection', 0, 'error');
  }
}

// Add global isOnline variable at the top with other globals
let isOnline = navigator.onLine; // Will be updated by connectivity checks
let netIdMismatch = false; // Will be updated by checkConnectivity

// Add checkConnectivity function before setupConnectivityDetection
async function checkConnectivity() {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;

  if (netIdMismatch) {
    isOnline = false;
  }

  if (isOnline !== wasOnline) {
    // Only trigger change handler if state actually changed
    await handleConnectivityChange();
  }
}

// Verify username availability when coming back online
/* async function verifyUsernameOnReconnect() {
    // Only proceed if user is logged in
    if (!myAccount || !myAccount.username) {
        console.log('No active account to verify');
        return;
    }

    console.log('Verifying username on reconnect:', myAccount.username);

    // Check if the username is still valid on the network
    const availability = await checkUsernameAvailability(myAccount.username, myAccount.keys.address);

    if (availability !== 'mine') {
        console.log('Username verification failed on reconnect:', availability);

        // Show a notification to the user
        showToast('Your account is no longer valid on the network. You will be signed out.', 5000, 'error');

        // Wait a moment for the user to see the toast
        setTimeout(() => {
            // Sign out the user
            handleSignOut();
        }, 5000);
    } else {
        console.log('Username verified successfully on reconnect');
    }
} */

// Gateway Management Functions

// Function to initialize the gateway configuration
// TODO: can remove this eventually since new account creation does this
function initializeGatewayConfig() {
  // Safety check for myData
  if (!myData) {
    console.error('Cannot initialize gateway config: myData is null');
    return;
  }

  // Ensure network property exists
  if (!myData.network) {
    myData.network = {};
  }

  // Ensure gateways array exists
  if (!myData.network.gateways) {
    myData.network.gateways = [];
  }

  if (network && network.gateways && network.gateways.length > 0){
    myData.network = parse(stringify(network))
  }
  else if (myData.network.gateway.length <= 0){
    showToast("No gateway server available; edit network.js file", 0, "error")
    return;
  }

  // Ensure defaultGatewayIndex property exists and set to -1 (random selection)
  if (myData.network.defaultGatewayIndex === undefined) {
    // TODO ping the gateway servers and pick one that is working
    myData.network.defaultGatewayIndex = 0; // -1 means use random selection
  }
  
  /*
  // If no gateways, initialize with system gateways
  if (myData.network.gateways.length === 0) {
    // Add system gateways from the global network object
    if (network && network.gateways) {
      network.gateways.forEach((gateway) => {
        myData.network.gateways.push({
          protocol: gateway.protocol,
          host: gateway.host,
          port: gateway.port,
          web: gateway.web,
          ws: gateway.ws,
          name: `${gateway.host} (System)`,
          isSystem: true,
          isDefault: false,
        });
      });
    }
  }
  */
}

// Function to get the gateway to use for a request
function getGatewayForRequest() {
  //TODO: ask Omar if we should just let use edit network.js or keep current logic where when we sign in it uses network.js and when signed in we use myData.network.gateways
  // Check if myData exists
  if (!myData) {
    // Fall back to global network if available
    if (typeof network !== 'undefined' && network?.gateways?.length) {
      return network.gateways[Math.floor(Math.random() * network.gateways.length)];
    }
    console.error('No myData or network available');
    return null;
  }

  // Initialize if needed
  initializeGatewayConfig();

  // If we have a default gateway set, use it
  if (myData.network.defaultGatewayIndex >= 0 && myData.network.defaultGatewayIndex < myData.network.gateways.length) {
    return myData.network.gateways[myData.network.defaultGatewayIndex];
  }

  // Otherwise use random selection
  return myData.network.gateways[Math.floor(Math.random() * myData.network.gateways.length)];
}

/**
 * Inserts an item into an array while maintaining descending order based on a timestamp field.
 * Assumes the array is already sorted in descending order.
 *
 * @param {Array<Object>} array - The array to insert into (e.g., myData.chats, contact.messages, myData.wallet.history).
 * @param {Object} item - The item to insert (e.g., chatUpdate, newMessage, newPayment).
 * @param {string} [timestampField='timestamp'] - The name of the field containing the timestamp to sort by.
 */
function insertSorted(array, item, timestampField = 'timestamp') {
  // Find the index where the new item should be inserted.
  // We are looking for the first element with a timestamp LESS THAN the new item's timestamp.
  // This is because the array is sorted descending (newest first).
  const index = array.findIndex((existingItem) => existingItem[timestampField] < item[timestampField]);

  if (index === -1) {
    // If no such element is found, the new item is the oldest (or the array is empty),
    // so add it to the end.
    array.push(item);
  } else {
    // Otherwise, insert the new item at the found index.
    array.splice(index, 0, item);
  }
}

/**
 * Calculates the time difference between the client's local time and the network gateway's time.
 * Fetches the timestamp from the '/timestamp' endpoint on a network gateway using queryNetwork,
 * compares it to local time, and stores the difference in `timeSkew`.
 * Includes a retry mechanism for transient network errors.
 *
 * @param {number} [retryCount=0] - The current retry attempt number.
 */
async function timeDifference(retryCount = 0) {
  const maxRetries = 2; // Maximum number of retries
  const retryDelay = 1000; // Delay between retries in milliseconds (1 second)
  const timestampEndpoint = '/timestamp'; // Endpoint to query

  try {
    // Use queryNetwork to fetch the timestamp from a gateway
    const data = await queryNetwork(timestampEndpoint);

    // queryNetwork returns null on network errors or if offline
    if (data === null) {
      // Throw an error to trigger the retry logic
      throw new Error(`queryNetwork returned null for ${timestampEndpoint}`);
    }

    const clientTimeMs = Date.now(); // Get client time as close as possible to response processing

    // Extract server time directly from the 'timestamp' field
    if (!data || typeof data.timestamp !== 'number' || isNaN(data.timestamp)) {
      console.error('Error: Invalid or missing server timestamp received from gateway:', data);
      // Don't retry on parsing errors, it's likely a data issue from the gateway
      return;
    }

    const serverTimeMs = data.timestamp;

    const difference = serverTimeMs - clientTimeMs;
    timeSkew = difference; // Store the calculated skew

    // Optional: Update logging for verification
    //console.log(`Gateway time (UTC ms): ${serverTimeMs} (${new Date(serverTimeMs).toISOString()})`);
    //console.log(`Client time (local ms): ${clientTimeMs} (${new Date(clientTimeMs).toISOString()})`);
    //console.log(`Time difference (Gateway - Client): ${difference} ms`);
    const minutes = Math.floor(Math.abs(difference) / 60000);
    const seconds = Math.floor((Math.abs(difference) % 60000) / 1000);
    const milliseconds = Math.abs(difference) % 1000;
    const sign = difference < 0 ? '-' : '+';
    console.log(`Time difference: ${sign}${minutes}m ${seconds}s ${milliseconds}ms`);
    console.log(
      `Successfully obtained time skew (${timeSkew}ms) from gateway endpoint ${timestampEndpoint} on attempt ${retryCount + 1}.`
    );
  } catch (error) {
    // Handle errors from queryNetwork (e.g., network issues, gateway unavailable)
    console.warn(`Attempt ${retryCount + 1} failed to fetch time via queryNetwork(${timestampEndpoint}):`, error);

    if (retryCount < maxRetries) {
      console.log(`Retrying time fetch in ${retryDelay}ms... (Attempt ${retryCount + 2})`);
      setTimeout(() => timeDifference(retryCount + 1), retryDelay);
    } else {
      console.error(
        `Failed to fetch time from gateway endpoint ${timestampEndpoint} after ${maxRetries + 1} attempts. Time skew might be inaccurate.`
      );
      // Keep timeSkew at its default (0) or last known value if applicable
    }
  }
}

/**
 * Returns the current timestamp adjusted by the calculated time skew.
 * This provides a timestamp closer to the server's time.
 * @returns {number} The corrected timestamp in milliseconds since the Unix Epoch.
 */
function getCorrectedTimestamp() {
  // Get the current client time
  const clientNow = Date.now();

  // Add the stored skew (difference between server and client time)
  // If server was ahead, timeSkew is positive, making the corrected time larger.
  // If server was behind, timeSkew is negative, making the corrected time smaller.
  const correctedTime = clientNow + timeSkew;

  return correctedTime;
}

// Validator Modals

// fetching market price by invoking `updateAssetPricesIfNeeded` and extracting from myData.assetPrices
async function getMarketPrice() {
  try {
    // Ensure asset prices are potentially updated by the central function
    await updateAssetPricesIfNeeded();

    // Check if wallet data and assets exist after the update attempt
    if (!myData?.wallet?.assets) {
      console.warn('getMarketPrice: Wallet assets not available in myData.');
      return null;
    }

    // Find the LIB asset in the myData structure
    const libAsset = myData.wallet.assets.find((asset) => asset.id === 'liberdus');

    if (libAsset) {
      // Check if the price exists and is a valid number on the found asset
      if (typeof libAsset.price === 'number' && !isNaN(libAsset.price)) {
        // console.log(`getMarketPrice: Retrieved LIB price from myData: ${libAsset.price}`); // Optional: For debugging
        return libAsset.price;
      } else {
        // Price might be missing if the initial fetch failed or hasn't happened yet
        console.warn(
          `getMarketPrice: LIB asset found in myData, but its price is missing or invalid (value: ${libAsset.price}).`
        );
        return null;
      }
    } else {
      console.warn('getMarketPrice: LIB asset not found in myData.wallet.assets.');
      return null;
    }
  } catch (error) {
    console.error('getMarketPrice: Error occurred while trying to get price from myData:', error);
    return null; // Return null on any unexpected error during the process
  }
}

class RemoveAccountModal {
  constructor() {}

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('removeAccountModal');
    document.getElementById('closeRemoveAccountModal').addEventListener('click', () => this.close());
    document.getElementById('confirmRemoveAccount').addEventListener('click', () => this.removeAccount());
    document.getElementById('openBackupFromRemove').addEventListener('click', () => backupAccountModal.open());
  }

  signin() {
    // called when user logs in
  }

  open() {
    // called when the modal needs to be opened
    this.modal.classList.add('active');
  }

  close() {
    // called when the modal needs to be closed
    this.modal.classList.remove('active');
  }

  submit(username = myAccount.username) {
    // called when the form is submitted
    // Get network ID from network.js
    const { netid } = network;

    // Get existing accounts
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Remove the account from the accounts object
    if (existingAccounts.netids[netid] && existingAccounts.netids[netid].usernames) {
      delete existingAccounts.netids[netid].usernames[username];
      localStorage.setItem('accounts', stringify(existingAccounts));
    }
    // Remove the account data from localStorage
    localStorage.removeItem(`${username}_${netid}`);

    // Reload the page to redirect to welcome screen
    clearMyData(); // need to delete this so that the reload does not save the data into localStore again
    window.location.reload();
  }

  removeAccount(username = null) {
    // Username must be provided explicitly - when called from sign-in modal, myAccount is not yet available
    if (!username) {
      // if myAccount is available and removeAccountModal is open, use myAccount.username
      if(myAccount && this.isActive()) {
        username = myAccount.username;
      } else {
        showToast('No account selected for removal', 0, 'error');
        return;
      }
    }
    const confirmed = confirm(`Are you sure you want to remove the account "${username}" from this device?`);
    if (!confirmed) return;
    
    const { netid } = network;

    // Get existing accounts
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Remove the account from the accounts object
    if (existingAccounts.netids[netid] && existingAccounts.netids[netid].usernames) {
      delete existingAccounts.netids[netid].usernames[username];
      localStorage.setItem('accounts', stringify(existingAccounts));
    }
    // Remove the account data from localStorage
    localStorage.removeItem(`${username}_${netid}`);

    // Reload the page to redirect to welcome screen
    clearMyData(); // need to delete this so that the reload does not save the data into localStore again
    window.location.reload();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  signout() {
    // called when user is logging out
  }
}
const removeAccountModal = new RemoveAccountModal();

// Modal to remove multiple accounts at once from welcome screen
class RemoveAccountsModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('removeAccountsModal');
    this.closeButton = document.getElementById('closeRemoveAccountsModal');
    this.listContainer = document.getElementById('removeAccountsList');
    this.submitButton = document.getElementById('submitRemoveAccounts');
    this.removeAllButton = document.getElementById('removeAllAccountsButton');
    this.closeButton.addEventListener('click', () => this.close());
    this.submitButton.addEventListener('click', () => this.handleSubmit());
    this.removeAllButton.addEventListener('click', () => this.handleRemoveAllAccounts());
  }

  open() {
    this.renderAccounts();
    this.submitButton.disabled = true;
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
    this.listContainer.innerHTML = '';
  }

  isActive() { 
    return this.modal?.classList.contains('active'); 
  }

  /**
   * Helper function to count contacts and messages from an account state.
   * Returns { contactsCount, messagesCount } or { contactsCount: -1, messagesCount: -1 } on error.
   */
  getContactsAndMessagesCount(state, contextKey) {
    let contactsCount = 0;
    let messagesCount = 0;
    
    if (state) {
      try {
        contactsCount = Object.keys(state.contacts || {}).length;
        // Sum messages arrays lengths per contact
        if (state.contacts) {
          for (const addr in state.contacts) {
            messagesCount += (state.contacts[addr].messages?.length || 0);
          }
        }
      } catch (e) {
        console.warn('Error counting contacts/messages for', contextKey, e);
        return { contactsCount: -1, messagesCount: -1 };
      }
    } else {
      // State is null - could be decryption failure or no data
      return { contactsCount: -1, messagesCount: -1 };
    }
    
    return { contactsCount, messagesCount };
  }

  getAllAccountsData() {
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const result = [];
    // Walk accounts registry to get username + netid list and derive counts
    for (const netid in accountsObj.netids) {
      const usernamesObj = accountsObj.netids[netid]?.usernames || {};
      for (const username in usernamesObj) {
        const key = `${username}_${netid}`;
        
        // Check if account data exists in storage
        const hasStorageData = localStorage.getItem(key) !== null;
        
        let state = null;
        try {
          state = loadState(key); // decrypted & parsed
          
          // If loadState returned null, it could be decryption failure
          if (hasStorageData && !state) {
            console.warn('Decryption failed for account', key, '- data exists but could not be decrypted');
          }
        } catch (e) {
          console.warn('Error loading account', key, e);
          // Continue processing - we'll still add it to the list with error counts
        }
        
        const { contactsCount, messagesCount } = this.getContactsAndMessagesCount(state, key);
        result.push({ username, netid, contactsCount, messagesCount });
      }
    }

    // Find any orphaned account files not in accounts object
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey) continue;
      
      // Use regex to extract username and netid from storage key: username_<64-hex>
      const match = storageKey.match(/^([^_]+)_([0-9a-fA-F]{64})$/);
      if (!match) continue;
      
      const [, username, netid] = match;
      
      // Validate username and netid
      if (!username || !netid) continue;
      
      // Check if this account is registered in the accounts object
      const isRegistered = accountsObj.netids[netid]?.usernames?.[username];
      if (isRegistered) continue;
      let state = null;
      try {
        state = loadState(storageKey);
        
        // If loadState returned null, it could be decryption failure
        if (!state) {
          console.warn('Failed to load orphaned account', storageKey, '- likely decryption failure');
        }
      } catch (e) {
        console.warn('Error loading orphaned account', storageKey, e);
        result.push({ username, netid, contactsCount: -1, messagesCount: -1, orphan: true });
        continue;
      }
      
      const { contactsCount, messagesCount } = this.getContactsAndMessagesCount(state, storageKey);
      result.push({ username, netid, contactsCount, messagesCount, orphan: true });
    }
    return result;
  }

  sortAccounts(accounts) {
    const orderedNetids = network.netids || [];
    return accounts.sort((a,b) => {
      const ia = orderedNetids.indexOf(a.netid);
      const ib = orderedNetids.indexOf(b.netid);
      const aKnown = ia !== -1; const bKnown = ib !== -1;
      if (aKnown && bKnown && ia !== ib) return ia - ib; // both known use index order
      if (aKnown && !bKnown) return -1; // known before unknown
      if (!aKnown && bKnown) return 1;
      if (!aKnown && !bKnown) { // both unknown alphabetical by netid
        if (a.netid !== b.netid) return a.netid.localeCompare(b.netid);
      }
      // same netid or both unknown same netid -> by username
      return a.username.localeCompare(b.username);
    });
  }

  groupByNetid(accounts) {
    const groups = {};
    for (const acct of accounts) {
      if (!groups[acct.netid]) groups[acct.netid] = [];
      groups[acct.netid].push(acct);
    }
    return groups;
  }

  renderAccounts() {
    const accounts = this.sortAccounts(this.getAllAccountsData());
    const groups = this.groupByNetid(accounts);
    this.listContainer.innerHTML = '';
    const orderedNetids = [...(network.netids || [])];
    // Append unknown netids afterwards
    const unknownNetids = Object.keys(groups).filter(n => !orderedNetids.includes(n)).sort();
    const finalOrder = [...orderedNetids.filter(n => groups[n]), ...unknownNetids];
    for (const netid of finalOrder) {
      const section = document.createElement('div');
      section.className = 'remove-accounts-section';
      const accountsForNet = groups[netid];
      section.innerHTML = `<h3>${netid.slice(0,6)} (${accountsForNet.length})</h3>`;
      const list = document.createElement('div');
      list.className = 'account-checkboxes';
      accountsForNet.forEach(acc => {
        const label = document.createElement('label');
        label.className = 'remove-account-row';
        
        // Handle display of account stats
        let statsText;
        if (acc.contactsCount === -1 || acc.messagesCount === -1) {
          // Error loading/decrypting account data
          statsText = 'unable to load data';
        } else {
          statsText = `${acc.contactsCount} contacts, ${acc.messagesCount} messages`;
        }
        statsText += acc.orphan ? ' (orphan)' : '';
        
        label.innerHTML = `
          <input type="checkbox" data-username="${acc.username}" data-netid="${acc.netid}" />
          <span class="remove-account-username">${acc.username}</span>
          <span class="remove-account-stats">${statsText}</span>
        `;
        list.appendChild(label);
      });
      section.appendChild(list);
      this.listContainer.appendChild(section);
    }
    // checkbox change handler for enabling submit
    this.listContainer.addEventListener('change', () => {
      const checked = this.listContainer.querySelectorAll('input[type="checkbox"]:checked').length;
      this.submitButton.disabled = checked === 0;
    }, { once: true }); // attach once, inside we attach nested listeners via event bubbling
  }

  handleSubmit() {
    const checked = this.listContainer.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) return;
    const confirmText = confirm(`Remove ${checked.length} selected account(s) from this device?`);
    if (!confirmText) return;
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    checked.forEach(cb => {
      const username = cb.dataset.username;
      const netid = cb.dataset.netid;
      // remove account data file
      localStorage.removeItem(`${username}_${netid}`);
      // remove from registry if present
      if (accountsObj.netids[netid] && accountsObj.netids[netid].usernames && accountsObj.netids[netid].usernames[username]) {
        delete accountsObj.netids[netid].usernames[username];
      }
    });
    localStorage.setItem('accounts', stringify(accountsObj));
    showToast('Selected accounts removed', 3000, 'success');
    this.close();
  }

  handleRemoveAllAccounts() {
    const confirmText = prompt(`WARNING: All accounts and data will be permanently removed from this device.\n\nType "REMOVE ALL" to confirm:`);
    if (confirmText !== "REMOVE ALL") {
      showToast('Remove all cancelled', 2000, 'warning');
      return;
    }
    
    // Clear all localStorage data
    localStorage.clear();
    
    // Show success message
    showToast('All data has been removed from this device', 3000, 'success');
    
    // Reload the page to redirect to welcome screen
    clearMyData();
    window.location.reload();
  }
}
const removeAccountsModal = new RemoveAccountsModal();

class BackupAccountModal {
  constructor() {
    this.GOOGLE_TOKEN_STORAGE_KEY = 'google_drive_token';
    this.GDRIVE_BACKUP_TS_KEY = 'googleDriveBackupTimestamp';
    this.GDRIVE_REMINDER_TS_KEY = 'googleDriveReminderTimestamp';
  }

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('backupModal');
    this.passwordInput = document.getElementById('backupPassword');
    this.passwordWarning = document.getElementById('backupPasswordWarning');
    this.passwordRequired = document.getElementById('backupPasswordRequired');
    this.passwordConfirmInput = document.getElementById('backupPasswordConfirm');
    this.passwordConfirmWarning = document.getElementById('backupPasswordConfirmWarning');
    this.submitButton = document.getElementById('backupForm').querySelector('button[type="submit"]');
    this.backupAllAccountsCheckbox = document.getElementById('backupAllAccounts');
    this.backupAllAccountsGroup = document.getElementById('backupAllAccountsGroup');
    this.storageLocationSelect = document.getElementById('backupStorageLocation');
    
    document.getElementById('closeBackupForm').addEventListener('click', () => this.close());
    document.getElementById('backupForm').addEventListener('submit', (event) => {
      this.handleSubmit(event);
    });

    this.passwordInput.addEventListener('input', () => this.updateButtonState());
    this.passwordConfirmInput.addEventListener('input', () => this.updateButtonState());
    this.storageLocationSelect.addEventListener('change', () => this.handleStorageLocationChange());

    // Handle legacy OAuth callback (in case someone lands on page with OAuth hash)
    this.handleGoogleOAuthCallback();
  }

  open() {
    // called when the modal needs to be opened
    this.modal.classList.add('active');
    
    // Show/hide checkbox based on login status
    if (myData) {
      // User is signed in - show checkbox
      this.backupAllAccountsGroup.style.display = 'block';
      this.backupAllAccountsCheckbox.checked = false; // Default to current account
    } else {
      // User is not signed in - hide checkbox but default to all accounts
      this.backupAllAccountsGroup.style.display = 'none';
      this.backupAllAccountsCheckbox.checked = true; // Default to all accounts
    }
    
    this.updateButtonState();
  }

  close() {
    // called when the modal needs to be closed
    this.modal.classList.remove('active');
    // Clear passwords for security
    this.passwordInput.value = '';
    this.passwordConfirmInput.value = '';
    // Reset checkbox
    this.backupAllAccountsCheckbox.checked = false;
    // Reset storage location to default
    this.storageLocationSelect.value = 'local';
    this.handleStorageLocationChange();
  }

  // ======================================
  // GOOGLE DRIVE TOKEN MANAGEMENT
  // ======================================
  // Not using below because we are requiring user to confirm account to use each time
  /* storeGoogleToken(tokenData) {
    localStorage.setItem(this.GOOGLE_TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
  } */

  getStoredGoogleToken() {
    const raw = localStorage.getItem(this.GOOGLE_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    try {
      const tokenData = JSON.parse(raw);
      if (!tokenData.accessToken || !tokenData.expiresAt) return null;
      if (Date.now() >= tokenData.expiresAt) {
        localStorage.removeItem(this.GOOGLE_TOKEN_STORAGE_KEY);
        return null;
      }
      return tokenData;
    } catch (e) {
      console.error('Failed to parse stored Google token, clearing.', e);
      localStorage.removeItem(this.GOOGLE_TOKEN_STORAGE_KEY);
      return null;
    }
  }

  clearGoogleToken() {
    localStorage.removeItem(this.GOOGLE_TOKEN_STORAGE_KEY);
  }

  // ======================================
  // GOOGLE DRIVE BACKUP TIMESTAMP MANAGEMENT
  // ======================================
  _getStoredTimestamp(key) {
    const rawValue = localStorage.getItem(key);
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  getGDriveBackupTs() {
    return this._getStoredTimestamp(this.GDRIVE_BACKUP_TS_KEY);
  }

  setGDriveBackupTs(timestamp = getCorrectedTimestamp()) {
    localStorage.setItem(this.GDRIVE_BACKUP_TS_KEY, String(timestamp));
  }

  getGDriveReminderTs() {
    // If this returns null, set timestamp to 3 days from now
    const ts = this._getStoredTimestamp(this.GDRIVE_REMINDER_TS_KEY);
    if (!ts) {
      this.setGDriveReminderTs(getCorrectedTimestamp() + 3 * 24 * 60 * 60 * 1000);
      return getCorrectedTimestamp() + 3 * 24 * 60 * 60 * 1000;
    }
    return ts;
  }

  setGDriveReminderTs(timestamp = getCorrectedTimestamp()) {
    localStorage.setItem(this.GDRIVE_REMINDER_TS_KEY, String(timestamp));
  }

  // ======================================
  // GOOGLE OAUTH FLOW (via OAuth Server with PKCE)
  // ======================================
  buildOAuthServerUrl(sessionId) {
    const config = network.googleDrive;
    const params = new URLSearchParams({
      sessionId,
      provider: 'google',
      flow: 'code' // Use PKCE flow (server-side)
    });
    return `${config.oauthServerUrl}/auth?${params.toString()}`;
  }

  /**
   * Start Google Drive authentication via OAuth server with PKCE flow.
   * Opens a popup (or delegates to React Native), polls the OAuth server for a token,
   * and resolves with token data or rejects on cancel/deny/timeout/error.
   *
   * @returns {Promise<{accessToken: string, tokenType: string, expiresAt: number}>}
   *          Resolves with token data on success; rejects with Error on cancel/deny/timeout/error.
   */
  async startGoogleDriveAuth() {
    const sessionId = generateUUIDv4();
    const url = this.buildOAuthServerUrl(sessionId);
    const isReactNative = reactNativeApp.isReactNativeWebView;

    let popup = null;
    let waitingToastId = null;
    let currentAbortController = null;
    
    // In React Native, send message to native app to open in-app browser
    if (isReactNative) {
      if (window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'GOOGLE_OAUTH_REQUEST',
          url: url,
          sessionId: sessionId
        }));
        // Don't use window.open() in React Native - let native app handle it
      } else {
        console.warn('ReactNativeWebView.postMessage not available, falling back to window.open()');
        // Fallback to window.open if postMessage is not available
        popup = window.open(url, '_blank');
      }
    } else {
      // Regular browser flow - open popup
      // Calculate popup position (centered)
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      // Open popup to OAuth server
      popup = window.open(
        url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      
      // Check if popup was blocked
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
    }

    // Poll the OAuth server for the token
    const config = network.googleDrive;
    const deadline = Date.now() + 120_000; // 120s overall timeout
    let popupClosed = false;

    // Wait ~2s before first poll, but abort early if popup closes.
    const waitInitialDelay = async () => {
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 2000)),
        new Promise(resolve => {
          const earlyInterval = setInterval(() => {
            if (popupClosed) {
              clearInterval(earlyInterval);
              resolve();
            }
          }, 100);
        })
      ]);
    };

    // Detect terminal (non-retryable) auth errors surfaced from the server.
    const shouldStopRetry = (err) =>
      err?.message && (
        err.message.includes('Authentication was cancelled') ||
        err.message.startsWith('Authentication failed:')
      );

    // Watch the popup for closure; on close, mark state and abort in-flight poll.
    const startPopupWatcher = () => {
      if (popup && !isReactNative) {
        popupCheckInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(popupCheckInterval);
            popupCheckInterval = null;
            popupClosed = true;
            if (currentAbortController) {
              currentAbortController.abort();
            }
          }
        }, 500);
      }
    };

    // Single poll request with AbortController and attempt logging.
    const fetchPollResponse = async (attempt) => {
      currentAbortController = new AbortController();
      const response = await fetch(
        `${config.oauthServerUrl}/auth/poll?sessionId=${sessionId}`,
        { signal: currentAbortController.signal }
      );
      currentAbortController = null;
      return response;
    };

    // Monitor popup closure (only for regular browser where we have a valid popup reference)
    let popupCheckInterval = null;
    startPopupWatcher();

    // Wait a bit before polling, but allow early exit on close/cancel
    await waitInitialDelay();

    const cleanup = () => {
      if (popupCheckInterval) {
        clearInterval(popupCheckInterval);
      }
      if (waitingToastId) {
        hideToast(waitingToastId);
      }
      if (popup && !popup.closed) {
        popup.close();
      }
    };

    const finalPollIfNeeded = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(
          `${config.oauthServerUrl}/auth/poll?sessionId=${sessionId}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.token && !(typeof data.token === 'string' && data.token.startsWith('error:'))) {
            const now = Date.now();
            const tokenData = {
              accessToken: data.token,
              tokenType: 'Bearer',
              expiresAt: now + 3600 * 1000
            };
            cleanup();
            return tokenData;
          }
        }
      } catch (e) {
        // ignore final poll errors; fall through to cancellation
      }
      return null;
    };

    try {
      let attempt = 0;
      while (Date.now() < deadline) {
        attempt += 1;
        // Check for cancellation/closure before polling
        if (!isReactNative && popupClosed) {
          const maybeToken = await finalPollIfNeeded();
          if (maybeToken) {
            return maybeToken;
          }
          throw new Error('Authentication cancelled.');
        }

        try {
          const response = await fetchPollResponse(attempt);

          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.token) {
              // Check if token is actually an error message from OAuth server
              if (typeof data.token === 'string' && data.token.startsWith('error:')) {
                // User cancelled or denied access
                const errorMessage = data.token.replace('error:', '').trim();
                const userFriendlyMessage = errorMessage === 'access_denied' 
                  ? 'Authentication was cancelled or denied. Please try again if you want to connect Google Drive.'
                  : `Authentication failed: ${errorMessage}`;
                
                console.error('OAuth error received from server:', errorMessage);
                cleanup();
                throw new Error(userFriendlyMessage);
              }
              
              // Store token with expiration (assume 1 hour if not provided)
              const now = Date.now();
              const tokenData = {
                accessToken: data.token,
                tokenType: 'Bearer',
                expiresAt: now + 3600 * 1000 // 1 hour expiration
              };
              
              //this.storeGoogleToken(tokenData);
              cleanup();
              return tokenData;
            }
          } else if (response.status === 408) {
            // Timeout from server, retry
            console.warn('Poll timeout, retrying...', { attempt });
            continue;
          } else if (response.status === 404) {
            // Session not found, retry
            console.warn('Session not found, retrying...', { attempt });
            continue;
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Poll failed: ${response.status}`);
          }
        } catch (fetchError) {
          // If user closed/cancelled during fetch, surface immediately
          if (!isReactNative && popupClosed) {
            const maybeToken = await finalPollIfNeeded();
            if (maybeToken) {
              return maybeToken;
            }
            throw new Error('Authentication cancelled.');
          }
          // If server indicated cancel/denied, stop retrying
          if (shouldStopRetry(fetchError)) {
            throw fetchError;
          }
          // Abort -> just retry until deadline
          if (fetchError?.name === 'AbortError') {
            continue;
          }
          console.error('Poll fetch error, retrying...', fetchError.message);
        }
      }

      // Deadline exhausted
      cleanup();
      throw new Error('Failed to get token before timeout. Please try again.');
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  handleGoogleOAuthCallback() {
    // Legacy OAuth callback handler - kept for backwards compatibility
    // The new PKCE flow uses the OAuth server, so this is only needed
    // if someone lands on the page with an old OAuth hash
    if (!window.location.hash || window.location.hash.length <= 1) return;

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    // Only process if this looks like an OAuth callback
    if (!accessToken) return;
    
    const tokenType = hashParams.get('token_type');
    const expiresIn = hashParams.get('expires_in');
    const error = hashParams.get('error');

    if (error) {
      console.error('OAuth error from Google:', error);
      showToast('Google Drive authentication failed: ' + error, 5000, 'error');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return;
    }

    const now = Date.now();
    const expiresAt = now + parseInt(expiresIn || '3600', 10) * 1000;

    const tokenData = {
      accessToken,
      tokenType: tokenType || 'Bearer',
      expiresAt
    };
    //this.storeGoogleToken(tokenData);

    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }

  // ======================================
  // GOOGLE DRIVE FOLDER HELPERS
  // ======================================
  async ensureBackupFolder(tokenData) {
    const folderName = network.googleDrive.backupFolder;

    const queryParams = new URLSearchParams({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`,
      fields: 'files(id, name)'
    });

    const listRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?' + queryParams.toString(),
      {
        headers: {
          Authorization: `${tokenData.tokenType} ${tokenData.accessToken}`
        }
      }
    );

    if (!listRes.ok) {
      const text = await listRes.text();
      throw new Error(`Drive folder search failed: ${listRes.status} ${text}`);
    }

    const listData = await listRes.json();
    if (listData.files && listData.files.length > 0) {
      return listData.files[0].id;
    }

    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root']
    };

    const createRes = await fetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          Authorization: `${tokenData.tokenType} ${tokenData.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(folderMetadata)
      }
    );

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Drive folder create failed: ${createRes.status} ${text}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  }

  // ======================================
  // GOOGLE DRIVE UPLOAD
  // ======================================
  async uploadToGoogleDrive(data, filename, tokenData) {
    // Ensure backup folder exists and get its ID
    const folderId = await this.ensureBackupFolder(tokenData);

    // Set metadata to put file in that folder
    const metadata = {
      name: filename,
      parents: [folderId]
    };

    const blob = new Blob([data], { type: 'application/json' });
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', blob, filename);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `${tokenData.tokenType} ${tokenData.accessToken}`
        },
        body: form
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Drive upload failed: ${res.status} ${text}`);
    }

    const result = await res.json();
    return result;
  }

  /**
   * Generate a backup filename based on the current date and time.
   * @param {string} username - The username to include in the filename.
   * @returns {string} The generated filename.
   */
  generateBackupFilename(username = null) {
    // Generate timestamp with hour and minute
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get first 6 characters from network ID
    const networkIdPrefix = network.netid.substring(0, 6);
    
    // Generate filename based on whether username is provided
    if (username) {
      return `liberdus-${username}-${dateStr}-${timeStr}-${networkIdPrefix}.json`;
    } else {
      return `liberdus-${dateStr}-${timeStr}-${networkIdPrefix}.json`;
    }
  }

  /**
   * Handle the form submission based on checkbox state.
   * @param {Event} event - The event object.
   */
  async handleSubmit(event) {
    event.preventDefault();

    // Enforce confirmation match when a password is provided
    const password = this.passwordInput.value || '';
    const confirmPassword = this.passwordConfirmInput.value || '';
    if (password.length > 0 && confirmPassword !== password) {
      this.updateButtonState();
      return;
    }

    const isGoogleDrive = this.storageLocationSelect.value === 'google-drive';

    // Determine which backup method to use
    if (myData && !this.backupAllAccountsCheckbox.checked) {
      // User is signed in and wants to backup only current account
      await this.handleSubmitOne(isGoogleDrive);
    } else {
      // User wants to backup all accounts (either not signed in or checkbox checked)
      await this.handleSubmitAll(isGoogleDrive);
    }
  }

  /**
   * Handle the submission of a single account backup.
   * @param {boolean} toGoogleDrive - Whether to upload to Google Drive
   */
  async handleSubmitOne(toGoogleDrive = false) {
    // Disable button to prevent multiple submissions
    this.submitButton.disabled = true;

    saveState();

    const password = this.passwordInput.value;
    // Build new structured backup object
    const username = myData?.account?.username;
    const netid = myData?.account?.netid;
    const accountKey = `${username}_${netid}`;
    // get key from localStorage
    const account = localStorage.getItem(accountKey);

    const backupObj = {
      [accountKey]: account,
    };

    // Include global lock value from localStorage if present
    const lockVal = localStorage.getItem('lock');
    if (lockVal !== null) {
      backupObj.lock = lockVal;
    }

    // Include contact avatars from IndexedDB
    try {
      const avatars = await contactAvatarCache.exportAll();
      if (avatars && Object.keys(avatars).length > 0) {
        backupObj._avatars = avatars;
      }
    } catch (e) {
      console.warn('Failed to export avatars for backup:', e);
    }

    // Include message thumbnails from IndexedDB
    try {
      const thumbnails = await thumbnailCache.exportAll();
      if (thumbnails && Object.keys(thumbnails).length > 0) {
        backupObj._thumbnails = thumbnails;
      }
    } catch (e) {
      console.warn('Failed to export thumbnails for backup:', e);
    }

    const jsonData = stringify(backupObj, null, 2);

    try {
      // Encrypt data if password is provided
      const finalData = password ? encryptData(jsonData, password) : jsonData;
      const filename = this.generateBackupFilename(myAccount.username);

      if (toGoogleDrive) {
        // Google Drive upload flow
        await this.handleGoogleDriveUpload(finalData, filename);
      } else {
        // Local download flow
        const blob = new Blob([finalData], { type: 'application/json' });
        // Detect if running inside React Native WebView
        if (window.ReactNativeWebView?.postMessage) {
          // ✅ React Native WebView: Send base64 via postMessage
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64DataUrl = reader.result;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EXPORT_BACKUP',
              filename,
              dataUrl: base64DataUrl,
            }));
          };
          reader.readAsDataURL(blob);
        } else {
          // Regular browser download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        // Close backup modal
        this.close();
      }
    } catch (error) {
      console.error('Backup failed:', error);
      showToast('Failed to create backup. Please try again.', 0, 'error');
      // Re-enable button so user can try again
      this.updateButtonState();
    }
  }

  /**
   * Handle the submission of a backup for all accounts.
   * @param {boolean} toGoogleDrive - Whether to upload to Google Drive
   */
  async handleSubmitAll(toGoogleDrive = false) {

    // Disable button to prevent multiple submissions
    this.submitButton.disabled = true;

    const password = this.passwordInput.value;
    const myLocalStore = this.copyLocalStorageToObject();

    // Include contact avatars from IndexedDB
    try {
      const avatars = await contactAvatarCache.exportAll();
      if (avatars && Object.keys(avatars).length > 0) {
        myLocalStore._avatars = avatars;
      }
    } catch (e) {
      console.warn('Failed to export avatars for backup:', e);
    }

    // Include message thumbnails from IndexedDB
    try {
      const thumbnails = await thumbnailCache.exportAll();
      if (thumbnails && Object.keys(thumbnails).length > 0) {
        myLocalStore._thumbnails = thumbnails;
      }
    } catch (e) {
      console.warn('Failed to export thumbnails for backup:', e);
    }

    const jsonData = stringify(myLocalStore, null, 2);

    try {
      // Encrypt data if password is provided
      const finalData = password ? encryptData(jsonData, password) : jsonData;
      const filename = this.generateBackupFilename();

      if (toGoogleDrive) {
        // Google Drive upload flow
        await this.handleGoogleDriveUpload(finalData, filename);
      } else {
        // Local download flow
        const blob = new Blob([finalData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        // Detect if running inside React Native WebView
        if (window.ReactNativeWebView?.postMessage) {
          // ✅ React Native WebView: Send base64 via postMessage
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64DataUrl = reader.result;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EXPORT_BACKUP',
              filename,
              dataUrl: base64DataUrl,
            }));
          };
          reader.readAsDataURL(blob);
        } else {
          // Regular browser download
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        // Close backup modal
        this.close();
      }
    } catch (error) {
      console.error('Backup failed:', error);
      showToast('Failed to create backup. Please try again.', 0, 'error');
      // Re-enable button so user can try again
      this.updateButtonState();
    }
  }

  /**
   * Handle Google Drive upload - checks for token or initiates OAuth flow
   * @param {string} data - The backup data to upload
   * @param {string} filename - The filename for the backup
   */
  async handleGoogleDriveUpload(data, filename) {
    let tokenData = this.getStoredGoogleToken();

    // If no valid token, authenticate first via popup
    if (!tokenData) {
      try {
        showToast('Approve Drive access in the Google window.', 3000, 'info');
        tokenData = await this.startGoogleDriveAuth();
      } catch (error) {
        console.error('Google Drive authentication failed:', error);
        showToast(error.message || 'Authentication failed.', 0, 'error');
        this.updateButtonState();
        return;
      }
    }

    // Now upload with the token
    try {
      showToast('Uploading backup to Google Drive...', 3000, 'info');
      await this.uploadToGoogleDrive(data, filename, tokenData);
      showToast('Backup uploaded to Google Drive successfully!', 5000, 'success');
      this.setGDriveBackupTs();
      this.close();
    } catch (error) {
      console.error('Google Drive upload failed:', error);
      // Token might be invalid, clear it and retry auth
      if (error.message.includes('401') || error.message.includes('403')) {
        this.clearGoogleToken();
        showToast('Google Drive session expired. Please authenticate again.', 3000, 'warning');
        // Retry with fresh authentication
        try {
          tokenData = await this.startGoogleDriveAuth();
          showToast('Uploading backup to Google Drive...', 3000, 'info');
          await this.uploadToGoogleDrive(data, filename, tokenData);
          showToast('Backup uploaded to Google Drive successfully!', 5000, 'success');
          this.setGDriveBackupTs();
          this.close();
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          showToast(retryError.message || 'Upload failed.', 0, 'error');
          this.updateButtonState();
        }
      } else {
        showToast('Failed to upload to Google Drive: ' + error.message, 5000, 'error');
        this.updateButtonState();
      }
    }
  }

  copyLocalStorageToObject() {
    const myLocalStore = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      myLocalStore[key] = localStorage.getItem(key);
    }
    return myLocalStore;
  }

  updateButtonState() {
    const password = this.passwordInput.value;
    const confirmPassword = this.passwordConfirmInput.value;
    const isGoogleDrive = this.storageLocationSelect.value === 'google-drive';
    
    // Password is required for Google Drive, optional for local
    let isValid = true;
    
    // Check if password is required (Google Drive)
    if (isGoogleDrive && password.length === 0) {
      isValid = false;
      this.passwordRequired.style.display = 'inline';
      this.passwordWarning.style.display = 'none';
    } else if (password.length > 0 && password.length < 4) {
      // Validate password length
      isValid = false;
      this.passwordWarning.style.display = 'inline';
      this.passwordRequired.style.display = 'none';
    } else {
      this.passwordWarning.style.display = 'none';
      this.passwordRequired.style.display = 'none';
    }
    
    // Validate password confirmation
    // If password has been entered, confirmation is required and must match
    if (password.length > 0) {
      if (confirmPassword.length === 0) {
        isValid = false;
      } else if (confirmPassword !== password) {
        isValid = false;
        this.passwordConfirmWarning.style.display = 'inline';
      } else {
        this.passwordConfirmWarning.style.display = 'none';
      }
    } else {
      this.passwordConfirmWarning.style.display = 'none';
    }
    
    // Update button state
    this.submitButton.disabled = !isValid;
  }

  handleStorageLocationChange() {
    const isGoogleDrive = this.storageLocationSelect.value === 'google-drive';
    
    // Update placeholder text based on storage location
    if (isGoogleDrive) {
      this.passwordInput.placeholder = 'Password required for Google Drive';
    } else {
      this.passwordInput.placeholder = 'Leave empty for unencrypted backup';
    }
    
    // Re-validate form
    this.updateButtonState();
  }
}
const backupAccountModal = new BackupAccountModal();

class RestoreAccountModal {
  constructor() {
    this.developerOptionsEnabled = false;
    this.netids = []; // Will be populated from network.js
    this.selectedGoogleDriveFile = null; // Store selected Google Drive file info
    this.googleDriveFileContent = null; // Store downloaded file content
  }

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('importModal');
    this.developerOptionsToggle = document.getElementById('developerOptionsToggle');
    this.oldStringSelect = document.getElementById('oldStringSelect');
    this.oldStringCustom = document.getElementById('oldStringCustom');
    this.newStringSelect = document.getElementById('newStringSelect');
    this.newStringCustom = document.getElementById('newStringCustom');
    this.closeImportForm = document.getElementById('closeImportForm');
    this.importForm = document.getElementById('importForm');
    this.fileInput = document.getElementById('importFile');
    this.passwordInput = document.getElementById('importPassword');
    this.passwordRequired = document.getElementById('importPasswordRequired');
    this.overwriteAccountsCheckbox = document.getElementById('overwriteAccountsCheckbox');
    this.backupAccountLockGroup = document.getElementById('backupAccountLockGroup');
    this.backupAccountLock = document.getElementById('backupAccountLock');
    this.developerOptionsSection = document.getElementById('developerOptionsSection');
    this.submitButton = document.getElementById('restoreSubmitButton');

    // Google Drive elements
    this.sourceLocationSelect = document.getElementById('restoreSourceLocation');
    this.localFileGroup = document.getElementById('localFileGroup');
    this.googleDriveFileGroup = document.getElementById('googleDriveFileGroup');
    this.pickGoogleDriveFileBtn = document.getElementById('pickGoogleDriveFile');
    this.selectedGoogleDriveFileDisplay = document.getElementById('selectedGoogleDriveFile');
    this.clearGoogleDriveFileBtn = document.getElementById('clearGoogleDriveFile');

    // Google Drive picker modal elements
    this.pickerModal = document.getElementById('googleDrivePickerModal');
    this.closePickerBtn = document.getElementById('closeGoogleDrivePicker');
    this.pickerLoading = document.getElementById('googleDrivePickerLoading');
    this.pickerFileList = document.getElementById('googleDriveFileList');
    this.pickerEmpty = document.getElementById('googleDrivePickerEmpty');

    this.closeImportForm.addEventListener('click', () => this.close());
    this.importForm.addEventListener('submit', (event) => this.handleSubmit(event));

    // Add new event listeners for developer options
    this.developerOptionsToggle.addEventListener('change', () => this.toggleDeveloperOptions());
    // setup mutual exclusion for the developer options
    this.setupMutualExclusion(this.oldStringSelect, this.oldStringCustom);
    this.setupMutualExclusion(this.newStringSelect, this.newStringCustom);
    
    // Add listeners to extract netids from selected file
    this.fileInput.addEventListener('change', () => {
      this.extractNetids();
      this.updateButtonState();
    });
    this.debouncedExtractNetids = debounce(() => this.extractNetids(), 500);
    this.passwordInput.addEventListener('input', () => {
      this.debouncedExtractNetids();
      this.updateButtonState();
    });

    // Google Drive event listeners
    this.sourceLocationSelect.addEventListener('change', () => this.handleSourceLocationChange());
    this.pickGoogleDriveFileBtn.addEventListener('click', () => this.openGoogleDrivePicker());
    this.clearGoogleDriveFileBtn.addEventListener('click', () => this.clearSelectedGoogleDriveFile());
    this.closePickerBtn.addEventListener('click', () => this.closeGoogleDrivePicker());

    // Reset form state
    this.clearForm();
  }

  setupMutualExclusion(selectElement, inputElement) {
    selectElement.addEventListener('change', (e) => {
      if (e.target.value) {
        inputElement.disabled = true;
        inputElement.value = '';
      } else {
        inputElement.disabled = false;
      }
    });
  
    inputElement.addEventListener('change', (e) => {
      if (e.target.value.trim()) {
        selectElement.value = '';
      }
    });
  }

  open() {
    // reset any backup lock UI
    this.resetBackupLockPrompt();

    // clear and show modal
    this.clearForm();
    this.modal.classList.add('active');
  }

  close() {
    // called when the modal needs to be closed
    this.modal.classList.remove('active');
    this.clearForm();
  }

  // toggle the developer options section
  toggleDeveloperOptions() {
    this.developerOptionsEnabled = !!this.developerOptionsToggle?.checked;
    this.developerOptionsSection.style.display = this.developerOptionsEnabled ? 'block' : 'none';
  }

  // Handle source location change (Local vs Google Drive)
  handleSourceLocationChange() {
    const isGoogleDrive = this.sourceLocationSelect.value === 'google-drive';
    
    // Toggle visibility of file selection groups
    this.localFileGroup.style.display = isGoogleDrive ? 'none' : 'block';
    this.googleDriveFileGroup.style.display = isGoogleDrive ? 'block' : 'none';
    
    // Clear selections when switching
    if (isGoogleDrive) {
      this.fileInput.value = '';
    } else {
      this.clearSelectedGoogleDriveFile();
    }
    
    // Update password required indicator
    if (this.passwordRequired) {
      this.passwordRequired.style.display = isGoogleDrive ? 'inline' : 'none';
    }
    
    this.updateButtonState();
  }

  // Update the submit button state based on form validity
  updateButtonState() {
    const isGoogleDrive = this.sourceLocationSelect.value === 'google-drive';
    let isValid = false;
    
    if (isGoogleDrive) {
      // Google Drive: require file selection and password
      const hasFile = this.selectedGoogleDriveFile !== null;
      const hasPassword = this.passwordInput.value.trim().length > 0;
      isValid = hasFile && hasPassword;
    } else {
      // Local: require file selection, password optional
      isValid = this.fileInput.files && this.fileInput.files.length > 0;
    }
    
    this.submitButton.disabled = !isValid;
  }

  // Open Google Drive file picker
  async openGoogleDrivePicker() {
    try {
      // Start OAuth flow using the backup modal's auth method
      showToast('Approve Drive access in the Google window.', 3000, 'info');
      const tokenData = await backupAccountModal.startGoogleDriveAuth();
      
      // Show picker modal and load files
      this.pickerModal.classList.add('active');
      this.pickerLoading.style.display = 'block';
      this.pickerFileList.style.display = 'none';
      this.pickerEmpty.style.display = 'none';
      
      // List files from backup folder
      await this.loadGoogleDriveFiles(tokenData);
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      showToast(error.message || 'Authentication failed.', 0, 'error');
    }
  }

  // Load files from Google Drive backup folder
  async loadGoogleDriveFiles(tokenData) {
    try {
      const folderName = network.googleDrive.backupFolder;
      
      // First, find the backup folder
      const folderQuery = new URLSearchParams({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`,
        fields: 'files(id, name)'
      });
      
      const folderRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?' + folderQuery.toString(),
        {
          headers: {
            Authorization: `${tokenData.tokenType} ${tokenData.accessToken}`
          }
        }
      );
      
      if (!folderRes.ok) {
        throw new Error(`Failed to search for backup folder: ${folderRes.status}`);
      }
      
      const folderData = await folderRes.json();
      
      if (!folderData.files || folderData.files.length === 0) {
        // No backup folder found
        this.pickerLoading.style.display = 'none';
        this.pickerEmpty.style.display = 'block';
        return;
      }
      
      const folderId = folderData.files[0].id;
      
      // List JSON files in the backup folder
      const filesQuery = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/json' or name contains '.json')`,
        fields: 'files(id, name, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });
      
      const filesRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?' + filesQuery.toString(),
        {
          headers: {
            Authorization: `${tokenData.tokenType} ${tokenData.accessToken}`
          }
        }
      );
      
      if (!filesRes.ok) {
        throw new Error(`Failed to list files: ${filesRes.status}`);
      }
      
      const filesData = await filesRes.json();
      
      this.pickerLoading.style.display = 'none';
      
      if (!filesData.files || filesData.files.length === 0) {
        this.pickerEmpty.style.display = 'block';
        return;
      }
      
      // Render file list
      this.renderGoogleDriveFileList(filesData.files, tokenData);
      this.pickerFileList.style.display = 'block';
      
    } catch (error) {
      console.error('Failed to load Google Drive files:', error);
      showToast('Failed to load files from Google Drive.', 0, 'error');
      this.closeGoogleDrivePicker();
    }
  }

  // Render the list of files from Google Drive
  renderGoogleDriveFileList(files, tokenData) {
    this.pickerFileList.innerHTML = '';
    
    files.forEach(file => {
      const li = document.createElement('li');
      li.className = 'chat-item';
      li.style.cursor = 'pointer';
      
      const modifiedDate = new Date(file.modifiedTime);
      const dateStr = modifiedDate.toLocaleDateString() + ' ' + modifiedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      li.innerHTML = `
        <div class="chat-content" style="padding-left: 16px;">
          <div class="chat-name" style="white-space: normal; word-break: break-word;">${file.name}</div>
          <div class="chat-time" style="position: static; margin-top: 4px;">${dateStr}</div>
        </div>
      `;
      
      li.addEventListener('click', () => this.selectGoogleDriveFile(file, tokenData));
      this.pickerFileList.appendChild(li);
    });
  }

  // Select a file from Google Drive
  async selectGoogleDriveFile(file, tokenData) {
    try {
      showToast('Downloading backup file...', 2000, 'info');
      
      // Download the file content
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        {
          headers: {
            Authorization: `${tokenData.tokenType} ${tokenData.accessToken}`
          }
        }
      );
      
      if (!downloadRes.ok) {
        throw new Error(`Failed to download file: ${downloadRes.status}`);
      }
      
      const fileContent = await downloadRes.text();
      
      // Store file info and content
      this.selectedGoogleDriveFile = file;
      this.googleDriveFileContent = fileContent;
      
      // Update UI
      this.selectedGoogleDriveFileDisplay.style.display = 'flex';
      this.selectedGoogleDriveFileDisplay.querySelector('.selected-file-name').textContent = file.name;
      
      // Close picker and update button state
      this.closeGoogleDrivePicker();
      this.updateButtonState();
      
      // Try to extract netids from the downloaded content
      this.extractNetids();
      
      showToast('Backup file selected.', 2000, 'success');
    } catch (error) {
      console.error('Failed to download file:', error);
      showToast('Failed to download file from Google Drive.', 0, 'error');
    }
  }

  // Extract netids from file content and add to dropdowns
  async extractNetids() {
    // Get content from Google Drive or local file
    let content;
    if (this.googleDriveFileContent) {
      content = this.googleDriveFileContent;
    } else {
      const file = this.fileInput.files[0];
      if (!file) {
        this.resetBackupLockPrompt();
        this.removeFileInjectedNetids();
        return;
      }
      content = await file.text();
    }
    
    try {
      // Try to decrypt if encrypted
      // manual scan using regex: find first non-whitespace char
      const m = /\S/.exec(content);
      const firstNonWs = m ? m[0] : '';
      if (firstNonWs !== '{') {
        const password = this.passwordInput.value.trim();
        if (!password) {
          this.resetBackupLockPrompt();
          return;
        }
        try {
          content = decryptData(content, password);
        } catch (error) {
          this.resetBackupLockPrompt();
          return;
        }
      }
      
      const data = parse(content);
      
      // Check if backup requires password
      const requiresBackupPassword = data.lock && !(localStorage.lock && data.lock === localStorage.lock);
      if (requiresBackupPassword) {
        this.backupAccountLockGroup.style.display = 'block';
      } else {
        this.resetBackupLockPrompt();
      }
      
      const netids = new Set();
      
      // Extract netids from localStorage keys (username_netid format)
      Object.keys(data).forEach(key => {
        if (key.includes('_') && key !== 'accounts' && key !== 'version') {
          const parts = key.split('_');
          if (parts.length >= 2) {
            const possibleNetid = parts[parts.length - 1];
            if (possibleNetid.length === 64 && /^[a-f0-9]+$/.test(possibleNetid)) {
              netids.add(possibleNetid);
            }
          }
        }
      });
      
      // Add new netids to dropdowns
      this.removeFileInjectedNetids();
      const existing = Array.from(this.oldStringSelect.options).map(opt => opt.value);
      [...netids].filter(netid => !existing.includes(netid)).forEach(netid => {
        const label = `${netid} (from file)`;
        const oldOption = new Option(label, netid);
        oldOption.dataset.source = 'file';
        this.oldStringSelect.add(oldOption);
        const newOption = new Option(label, netid);
        newOption.dataset.source = 'file';
        this.newStringSelect.add(newOption);
      });
      
    } catch (error) {
      this.resetBackupLockPrompt();
    }
  }

  // Clear selected Google Drive file
  clearSelectedGoogleDriveFile() {
    this.selectedGoogleDriveFile = null;
    this.googleDriveFileContent = null;
    this.selectedGoogleDriveFileDisplay.style.display = 'none';
    this.selectedGoogleDriveFileDisplay.querySelector('.selected-file-name').textContent = '';
    this.removeFileInjectedNetids();
    this.resetBackupLockPrompt();
    this.updateButtonState();
  }

  // Close the Google Drive picker modal
  closeGoogleDrivePicker() {
    this.pickerModal.classList.remove('active');
    this.pickerFileList.innerHTML = '';
  }

  // populate the netid dropdowns
  populateNetidDropdowns() {
    // get all netids from network.js
    const allNetids = [...new Set([network.netid, ...(network?.netids || [])])]; // Remove duplicates with Set
    // remove any null or undefined netids
    allNetids.filter(Boolean).forEach(netid => {
      this.oldStringSelect.add(new Option(netid, netid));
      this.newStringSelect.add(new Option(netid, netid));
    });
  }

  // get the string substitution
  getStringSubstitution() {
    if (!this.developerOptionsEnabled) return null;
    
    const oldString = this.oldStringSelect.value || 
                     this.oldStringCustom.value.trim();
    const newString = this.newStringSelect.value || 
                     this.newStringCustom.value.trim();
    if (oldString && newString && oldString !== newString) {
      return { oldString, newString };
    }
    
    return null;
  }

  /**
   * Performs a string substitution on the given file content.
   * @param {string} fileContent - The file content to perform the substitution on.
   * @param {Object} substitution - The substitution object to perform.
   * @returns {string} - The modified file content.
   */
  performStringSubstitution(fileContent, substitution) {
    if (!substitution) return fileContent;

    // Count occurrences before replacement
    const regex = new RegExp(substitution.oldString, 'g');
    
    // Global string replacement (like sed -i 's/old/new/g')
    const modifiedContent = fileContent.replace(regex, substitution.newString);

    
    return modifiedContent;
  }

  /**
   * Merge accounts from a parsed backup object into localStorage without removing any existing unrelated keys.
   * @param {Object} backupData Parsed JSON object produced from the backup file contents.
   * @returns {number|false} Number of accounts stored, or false if the merge was aborted.
   */
  async mergeBackupAccountsToLocal(backupData) {
    const overwrite = this.overwriteAccountsCheckbox?.checked;
    const locksMatch = !!(backupData.lock && localStorage.lock && backupData.lock === localStorage.lock);

    // If backup has a lock, require backup password
    let backupEncKey = null;
    if (backupData.lock && !locksMatch) {
      const password = this.backupAccountLock.value || '';
      if (!password) {
        showToast('Backup password required to unlock accounts in the backup file', 0, 'error');
        return false;
      }
      backupEncKey = await passwordToKey(password + 'liberdusData');
      if (!backupEncKey) {
        showToast('Invalid backup password', 0, 'error');
        return false;
      }
    }

    // Ensure we have local accounts registry
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Merge accounts registry first
    const backupAccountsRegistry = parse(backupData.accounts || '{"netids":{}}');
    Object.keys(backupAccountsRegistry.netids || {}).forEach(netid => {
      if (!existingAccounts.netids[netid]) existingAccounts.netids[netid] = { usernames: {} };
      const usernames = backupAccountsRegistry.netids[netid].usernames || {};
      Object.keys(usernames).forEach(username => {
        if (overwrite || !existingAccounts.netids[netid].usernames[username]) {
          existingAccounts.netids[netid].usernames[username] = usernames[username];
        }
      });
    });
    localStorage.setItem('accounts', stringify(existingAccounts));


    // Iterate over keys in backupData and copy account entries
    let restoredCount = 0;
    for (const key of Object.keys(backupData)) {
      const parts = key.split('_');
      if (parts.length !== 2) continue;
      const username = parts[0];
      const netid = parts[1];
      // basic netid check
      if (netid.length !== 64 || !/^[a-f0-9]+$/.test(netid)) continue;

      const localKey = `${username}_${netid}`;
      const exists = localStorage.getItem(localKey) !== null;
      if (exists && !overwrite) {
        // skip when not overwriting
        showToast(`Account ${username} on ${netid.slice(0, 6)}... already exists. Not overwriting.`, 3000, 'warning');
        continue;
      }

      let value = backupData[key];
      let decryptedAccount = null;

      if (locksMatch) {
        localStorage.setItem(localKey, value);
        restoredCount++;
        decryptedAccount = this.tryDecryptWithLocalLock(value);
      } else {
        // Need to decrypt with backupEncKey if available
        let decrypted = value;
        if (backupData.lock) {
          try {
            const maybe = decryptData(value, backupEncKey, true);
            if (maybe != null) {
              decrypted = maybe;
            } else {
              showToast(`Failed to decrypt account ${username} on ${netid}. Skipping.`, 0, 'error');
              continue;
            }
          } catch (e) {
            showToast(`Failed to decrypt account ${username} on ${netid}. Skipping.`, 0, 'error');
            continue;
          }
        }

        decryptedAccount = decrypted;

        // Now re-encrypt with local lock if localStorage.lock exists
        let finalValue = decrypted;
        if (localStorage.lock) {
          if (!lockModal?.encKey) {
            showToast('Local lock is set but unlock state is missing. Please unlock before importing.', 0, 'error');
            return false;
          }
          try {
            finalValue = encryptData(decrypted, lockModal.encKey, true);
          } catch (e) {
            showToast(`Failed to re-encrypt account ${username} on ${netid}. Skipping.`, 0, 'error');
            continue;
          }
        }

        localStorage.setItem(localKey, finalValue);
        restoredCount++;
      }

      if (decryptedAccount) {
        this.updateAccountRegistryAddress(netid, username, decryptedAccount);
      }
    }

    // Import contact avatars if present in backup
    if (backupData._avatars && typeof backupData._avatars === 'object') {
      try {
        await contactAvatarCache.importAll(backupData._avatars, overwrite);
      } catch (e) {
        console.warn('Failed to import avatars from backup:', e);
      }
    }

    // Import message thumbnails if present in backup
    if (backupData._thumbnails && typeof backupData._thumbnails === 'object') {
      try {
        await thumbnailCache.importAll(backupData._thumbnails, overwrite);
      } catch (e) {
        console.warn('Failed to import thumbnails from backup:', e);
      }
    }

    return restoredCount;
  }

  async handleSubmit(event) {
    event.preventDefault();

    const isGoogleDrive = this.sourceLocationSelect.value === 'google-drive';

    try {
      let fileContent;
      
      if (isGoogleDrive) {
        // Use downloaded Google Drive file content
        if (!this.googleDriveFileContent) {
          showToast('Please select a file from Google Drive', 0, 'error');
          return;
        }
        fileContent = this.googleDriveFileContent;
      } else {
        // Read the local file
        const file = this.fileInput.files[0];
        if (!file) {
          showToast('Please select a file', 0, 'error');
          return;
        }
        fileContent = await file.text();
      }
      
      // Manual scan using regex: find first non-whitespace char
      const m = /\S/.exec(fileContent);
      const firstNonWs = m ? m[0] : '';
      const isNotEncryptedData = firstNonWs === '{';

      // Check if data is encrypted and decrypt if necessary
      if (!isNotEncryptedData) {
        if (!this.passwordInput.value.trim()) {
          showToast('Password required for encrypted data', 0, 'error');
          return;
        }
        fileContent = decryptData(fileContent, this.passwordInput.value.trim());
        if (fileContent == null) {
          throw '';
        }
      }

      // Apply string substitution if developer options are enabled
      const substitution = this.getStringSubstitution();
      if (substitution) {
        fileContent = this.performStringSubstitution(fileContent, substitution);
      }

      // We first parse to jsonData so that if the parse does not work we don't destroy myData
      let backupData = parse(fileContent);

      // Instead of clearing localStorage, we'll merge accounts from backup into localStorage
      // Ask for confirmation (previous behavior warned about clearing; keep a similar warning)
      const confirmed = confirm('⚠️ WARNING: This will import all accounts from the backup file.\n\nExisting local accounts will not be removed. If "Overwrite existing accounts" is checked, accounts with the same username and netid will be replaced.\n\nIt is recommended to backup your current data before proceeding.\n\nDo you want to continue with the restore?');

      if (!confirmed) {
        showToast('Restore cancelled by user', 2000, 'info');
        return;
      }

      // backwards compatibility for old single account export
      if (typeof backupData === 'object' && 'account' in backupData) {
        const username = backupData.account.username;
        const netid = backupData.account.netid;
        backupData = {
          [`${username}_${netid}`]: stringify(backupData)
        };
      }

      // Merge and abort if merge failed
      const restoredCount = await this.mergeBackupAccountsToLocal(backupData);
      if (restoredCount === false) {
        return; // merge failed — keep modal open and do not proceed to reset/close
      }
      showToast(`${restoredCount} account${restoredCount === 1 ? '' : 's'} restored`, 3000, 'success');
      
      // handleNativeAppSubscription()

      // Reset form and close modal after delay
      setTimeout(() => {
        this.close();
        clearMyData(); // since we already saved to localStore, we want to make sure beforeunload calling saveState does not also save
        window.location.reload(); // need to go through Sign In to make sure imported account exists on network
      }, 2000);
    } catch (error) {
      showToast(error.message || 'Import failed. Please check file and password.', 0, 'error');
    }
  }

  clearForm() {
    this.fileInput.value = '';
    this.passwordInput.value = '';
    this.developerOptionsToggle.checked = false;
    this.oldStringCustom.value = '';
    this.newStringCustom.value = '';
    this.oldStringSelect.value = '';
    this.newStringSelect.value = '';
    // hide the developer options section and sync state
    this.toggleDeveloperOptions();
    // reset dropdowns to original state
    this.oldStringSelect.length = 1;
    this.newStringSelect.length = 1;
    this.populateNetidDropdowns();
    this.resetBackupLockPrompt();
    
    // Reset Google Drive state
    this.sourceLocationSelect.value = 'local';
    this.clearSelectedGoogleDriveFile();
    this.handleSourceLocationChange();
  }

  resetBackupLockPrompt() {
    if (this.backupAccountLockGroup) {
      this.backupAccountLockGroup.style.display = 'none';
    }
    if (this.backupAccountLock) {
      this.backupAccountLock.value = '';
    }
  }

  removeFileInjectedNetids() {
    const cleanup = (selectElement) => {
      if (!selectElement) return;
      Array.from(selectElement.options)
        .filter(option => option.dataset?.source === 'file')
        .forEach(option => option.remove());
    };

    cleanup(this.oldStringSelect);
    cleanup(this.newStringSelect);
  }

  extractAddress(maybeJson) {
    try {
      const obj = typeof maybeJson === 'string' ? parse(maybeJson) : maybeJson;
      return obj?.account?.keys?.address || '';
    } catch (e) {
      return '';
    }
  }

  updateAccountRegistryAddress(netid, username, accountData) {
    const address = this.extractAddress(accountData);
    if (!address) return;

    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    if (!accountsObj.netids[netid]) accountsObj.netids[netid] = { usernames: {} };
    accountsObj.netids[netid].usernames[username] = { address };
    localStorage.setItem('accounts', stringify(accountsObj));
  }

  tryDecryptWithLocalLock(value) {
    if (!localStorage.lock) return value;
    if (!lockModal?.encKey) return null;

    try {
      return decryptData(value, lockModal.encKey, true);
    } catch (e) {
      return null;
    }
  }
}
const restoreAccountModal = new RestoreAccountModal();

class TollModal {
  constructor() {
    this.currentCurrency = 'LIB'; // Initialize currency state
    this.oldToll = null;
    this.minToll = null; // Will be set from network account
  }

  load() {
    this.modal = document.getElementById('tollModal');
    this.minTollDisplay = document.getElementById('minTollDisplay');
    this.equivalentLibDisplay = document.getElementById('equivalentLibDisplay');
    this.newTollAmountInputElement = document.getElementById('newTollAmountInput');
    this.warningMessageElement = document.getElementById('tollWarningMessage');
    this.saveButton = document.getElementById('saveNewTollButton');
    this.closeButton = document.getElementById('closeTollModal');
    this.tollForm = document.getElementById('tollForm');
    this.tollCurrencySymbol = document.getElementById('tollCurrencySymbol');

    this.tollForm.addEventListener('submit', (event) => this.saveAndPostNewToll(event));
    this.closeButton.addEventListener('click', () => this.close());
    this.newTollAmountInputElement.addEventListener('input', () => this.newTollAmountInputElement.value = normalizeUnsignedFloat(this.newTollAmountInputElement.value));
    this.newTollAmountInputElement.addEventListener('input', () => this.updateSaveButtonState());
    this.newTollAmountInputElement.addEventListener('input', () => this.updateEquivalentLibDisplay());
  }

  open() {
    this.modal.classList.add('active');
    // set currentTollValue to the toll value
    const toll = myData.settings.toll || 0n;
    const tollUnit = myData.settings.tollUnit || 'USD';

    this.updateTollDisplay(toll, tollUnit);

    this.currentCurrency = 'USD';
    if (this.tollCurrencySymbol) this.tollCurrencySymbol.textContent = 'USD';
    this.newTollAmountInputElement.value = ''; // Clear input field
    this.warningMessageElement.textContent = '';
    this.warningMessageElement.classList.remove('show');
    this.saveButton.disabled = true;

        // Fetch network parameters to get minToll
    const stabilityFactor = getStabilityFactor();
    try {
      const minTollUsdStr = parameters?.current?.minTollUsdStr;
      this.minToll = EthNum.toWei(EthNum.div(minTollUsdStr, stabilityFactor.toString()));
      // Update min toll display under input (USD)
      const minTollUSD = bigxnum2big(this.minToll, stabilityFactor.toString());
      this.minTollDisplay.textContent = `Minimum toll: ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD`;
    } catch (e) {
      this.minTollDisplay.textContent = `Minimum toll: error`;
      console.error('Failed to fetch minToll from network parameters:', e);
      showToast('Failed to fetch minimum toll from network.', 0, 'error');
    }
    this.updateEquivalentLibDisplay();
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  /**
   * Save and post the new toll to the network
   * @param {Event} event - The event object
   * @returns {Promise<void>}
   */
  async saveAndPostNewToll(event) {
    event.preventDefault();
    let newTollValue = parseFloat(this.newTollAmountInputElement.value);

    // disable submit button
    this.saveButton.disabled = true;

    if (isNaN(newTollValue) || newTollValue < 0) {
      showToast('Invalid toll amount entered.', 0, 'error');
      return;
    }

    const newToll = bigxnum2big(wei, this.newTollAmountInputElement.value);

    // Check if the toll is non-zero but less than minimum
    if (newToll > 0n) {
      if (this.currentCurrency === 'LIB' && newToll < this.minToll) {
        showToast(`Toll must be at least ${parseFloat(big2str(this.minToll, 18)).toFixed(6)} LIB or 0 LIB`, 0, 'error');
        return;
      }
      if (this.currentCurrency === 'USD') {
        const stabilityFactor = getStabilityFactor();
        const newTollLIB = bigxnum2big(newToll, (1 / stabilityFactor).toString());
        if (newTollLIB < this.minToll) {
          const minTollUSD = bigxnum2big(this.minToll, stabilityFactor.toString());
          showToast(`Toll must be at least ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD or 0 USD`, 0, 'error');
          return;
        }
      }
    }

    // Add maximum toll validation
    if (this.currentCurrency === 'LIB') {
      if (newTollValue > MAX_TOLL) {
        showToast(`Toll cannot exceed ${MAX_TOLL} LIB`, 0, 'error');
        return;
      }
    } else {
      // For USD, convert the max toll to USD for comparison
      const stabilityFactor = getStabilityFactor();
      const maxTollUSD = MAX_TOLL * stabilityFactor;
      if (newTollValue > maxTollUSD) {
        showToast(`Toll cannot exceed ${maxTollUSD.toFixed(2)} USD`, 0, 'error');
        return;
      }
    }

    // Post the new toll to the network
    const response = await this.postToll(newToll, this.currentCurrency);

    if (response && response.result && response.result.success) {
      this.editMyDataToll(newToll, this.currentCurrency);
    } else {
      console.error(`Toll submission failed for txid: ${response.txid}`);
      return;
    }

    this.newTollAmountInputElement.value = '';

    // Update the display for tollAmountLIB and tollAmountUSD
    this.updateTollDisplay(newToll, this.currentCurrency);
  }

  /**
   * Update the toll display in the UI
   * @param {BigInt} toll - The toll value in wei
   * @param {string} tollUnit - The unit of the toll
   * @returns {void}
   */
  updateTollDisplay(toll, tollUnit) {
    const stabilityFactor = getStabilityFactor();
    let tollValueUSD = '';
    let tollValueLIB = '';

    if (tollUnit == 'LIB') {
      const libFloat = parseFloat(big2str(toll, 18));
      tollValueUSD = (libFloat * stabilityFactor).toString();
      tollValueLIB = libFloat.toString();
    } else {
      const usdFloat = parseFloat(big2str(toll, 18));
      tollValueUSD = usdFloat.toString();
      tollValueLIB = (usdFloat / stabilityFactor).toString();
    }

    const usdDisplay = parseFloat(tollValueUSD).toFixed(6);
    const libDisplay = stabilityFactor > 0 ? parseFloat(tollValueLIB).toFixed(6) : 'N/A';

    // USD-only UI
    document.getElementById('tollAmountUSD').textContent = `${usdDisplay} USD (≈ ${libDisplay} LIB)`;
  }

  /**
   * Updates the equivalent LIB display beneath the USD input
   * @returns {void}
   */
  updateEquivalentLibDisplay() {
    if (!this.equivalentLibDisplay) return;
    const value = this.newTollAmountInputElement.value;
    if (!value || value.trim() === '' || value.trim() === '.' || value.trim() === ',') {
      this.equivalentLibDisplay.textContent = '';
      return;
    }
    const usd = parseFloat(value);
    if (isNaN(usd) || usd < 0) {
      this.equivalentLibDisplay.textContent = '';
      return;
    }
    const factor = getStabilityFactor();
    if (!factor || factor <= 0) {
      this.equivalentLibDisplay.textContent = '';
      return;
    }
    const lib = usd / factor;
    this.equivalentLibDisplay.style.display = 'block';
    this.equivalentLibDisplay.textContent = `≈ ${lib.toFixed(6)} LIB`;
  }

  /**
   * Edit the toll in myData.settings
   * @param {BigInt} toll - The toll value in wei
   * @param {string} tollUnit - The unit of the toll
   * @returns {void}
   */
  editMyDataToll(toll, tollUnit) {
    this.oldToll = myData.settings.toll;
    myData.settings.toll = toll;
    myData.settings.tollUnit = tollUnit;
  }

  /**
   * Post the toll to the network
   * @param {BigInt} toll - The toll value in wei
   * @param {string} tollUnit - The unit of the toll
   * @returns {Promise<Object>} - The response from the network
   */
  async postToll(toll, tollUnit) {
    const tollTx = {
      from: longAddress(myAccount.keys.address),
      toll: toll,
      type: 'toll',
      timestamp: getCorrectedTimestamp(),
      tollUnit: tollUnit,
      networkId: network.netid,
    };

    const txid = await signObj(tollTx, myAccount.keys);
    const response = await injectTx(tollTx, txid);
    return response;
  }

  /**
   * Gets the warning message based on input validation
   * @returns {string|null} - The warning message or null if no warning
   */
  getWarningMessage() {
    const value = this.newTollAmountInputElement.value;

    // return null if just . or ,
    if (value.trim() === '.' || value.trim() === ',') {
      return null;
    }

    // check if input is empty or only whitespace
    if (value.trim() === '') {
      return 'Please enter a toll amount';
    }

    const newTollValue = parseFloat(value);

    // Check if it's a valid number
    if (isNaN(newTollValue) || newTollValue < 0) {
      return 'Please enter a valid positive number';
    }

    // Allow zero toll
    if (newTollValue === 0) {
      return null;
    }

    const newToll = bigxnum2big(wei, value);

    // Check minimum toll requirements
    if (this.currentCurrency === 'LIB') {
      if (newToll < this.minToll) {
        return `Toll must be at least ${parseFloat(big2str(this.minToll, 18)).toFixed(6)} LIB or 0 LIB`;
      }
    } else {
      const stabilityFactor = getStabilityFactor();
      const newTollLIB = bigxnum2big(newToll, (1 / stabilityFactor).toString());
      if (newTollLIB < this.minToll) {
        const minTollUSD = bigxnum2big(this.minToll, stabilityFactor.toString());
        return `Toll must be at least ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD or 0 USD`;
      }
    }

    // Check if the new toll is the same as the current toll
    const currentToll = myData.settings.toll;
    const currentTollUnit = myData.settings.tollUnit;
    
    if (currentTollUnit === this.currentCurrency && newToll === currentToll) {
      return 'Toll amount is the same as current toll';
    }

    return null;
  }

  /**
   * Updates the save button state and warning message based on input validation
   */
  updateSaveButtonState() {
    // If offline, keep button disabled
    if (!isOnline) {
      this.saveButton.disabled = true;
      return;
    }

    const warningMessage = this.getWarningMessage();
    const isValid = !warningMessage;

    // Update save button state
    this.saveButton.disabled = !isValid;

    // Update warning message
    if (warningMessage) {
      this.warningMessageElement.textContent = warningMessage;
      this.warningMessageElement.classList.add('show');
    } else {
      this.warningMessageElement.textContent = '';
      this.warningMessageElement.classList.remove('show');
    }
  }
}

const tollModal = new TollModal();

// Invite Modal
class InviteModal {
  constructor() {
    this.invitedContacts = new Set(); // Track invited emails/phones
    this.inviteURL = "https://liberdus.com/download";
  }

  load() {
    this.modal = document.getElementById('inviteModal');
    this.inviteMessageInput = document.getElementById('inviteMessage');
    this.submitButton = document.querySelector('#inviteForm button[type="submit"]');
    this.closeButton = document.getElementById('closeInviteModal');
    this.inviteForm = document.getElementById('inviteForm');
    this.shareButton = document.getElementById('shareInviteButton');
    this.resetInviteButton = document.getElementById('resetInviteMessage');

    this.closeButton.addEventListener('click', () => this.close());
    this.inviteForm.addEventListener('submit', (event) => this.handleSubmit(event));

    // input listener for editable message
    this.inviteMessageInput.addEventListener('input', () => this.validateInputs());
    // reset invite message
    this.resetInviteButton.addEventListener('click', () => this.handleResetClick());
  }

  handleResetClick() {
    this.inviteMessageInput.value = this.getDefaultInviteText();
    this.validateInputs();
    this.inviteMessageInput.focus();
  }

  getDefaultInviteText() {
    return `Message ${myAccount?.username || ''} on Liberdus! ${this.inviteURL}`;
  }

  validateInputs() {
    const message = (this.inviteMessageInput && this.inviteMessageInput.value) ? this.inviteMessageInput.value.trim() : '';
    this.submitButton.disabled = !message;
  }

  open() {
    // Clear any previous values
    // Prefill the editable invite message with a useful default
    const savedText = myData?.settings?.inviteMessage;
    const defaultText = this.getDefaultInviteText();
    const initialText = (savedText && savedText.trim()) ? savedText : defaultText;
    if (this.inviteMessageInput) {
      // Only set default if the user hasn't previously entered something
      if (!this.inviteMessageInput.value || !this.inviteMessageInput.value.trim()) {
        this.inviteMessageInput.value = initialText;
      }
    }
    this.validateInputs(); // Set initial button state
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  async handleSubmit(event) {
    event.preventDefault();

    const message = this.inviteMessageInput.value.trim();

    if (!message) {
      showToast('Please enter a message to share', 0, 'error');
      return;
    }

    // Save edited message to settings and persist
    if (myData && myData.settings) {
      myData.settings.inviteMessage = message;
      saveState();
    }

    // 2-second cooldown on Share button
    this.submitButton.disabled = true;
    this.resetInviteButton.disabled = true;
    setTimeout(() => {
      this.validateInputs();
      this.resetInviteButton.disabled = false;
    }, 2000);

    try {
      await this.shareLiberdusInvite(message);
    } catch (err) {
      // shareLiberdusInvite will show its own errors; rely on cooldown to re-enable
      showToast('Could not share invitation. Try copying manually.', 0, 'error');
    }
  }

  async shareLiberdusInvite(overrideText) {
    const title = "Join me on Liberdus";
    const text = (typeof overrideText === 'string' && overrideText.trim().length) ? overrideText.trim() : this.getDefaultInviteText();

    // 1) Check if running in React Native WebView
    if (reactNativeApp.isReactNativeWebView) {
      try {
        reactNativeApp.shareInvite(this.inviteURL, text, title);
        return; // success
      } catch (err) {
        // fall through to native share or clipboard on errors
      }
    }

    // 2) Try native share sheet
    if (navigator.share) {
      try {
        await navigator.share({ url: this.inviteURL, text, title });
        return; // success
      } catch (err) {
        // iOS Safari/WKWebView: cancel → AbortError / "Share canceled"
        if (err && (err.name === "AbortError" || /canceled/i.test(String(err.message || "")))) {
          showToast("Share canceled", 2000, "warning");
          return; // don't fallback: user activation is gone
        }
        // fall through to clipboard on real errors
      }
    }

    // 3) Clipboard fallback (no mailto)
    try {
      // Ensure URL is in the text
      const clipboardText = text.includes(this.inviteURL) ? text : `${text} ${this.inviteURL}`;
      await navigator.clipboard.writeText(clipboardText);
      showToast("Invite copied to clipboard!", 3000, "success");
    } catch {
      showToast("Could not copy invite link.", 0, "error");
    }
  }
}
const inviteModal = new InviteModal();

class SourceModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('sourceModal');
    this.closeButton = document.getElementById('closeSourceModal');
    this.closeButton.addEventListener('click', () => this.close());
  }

  open() {
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }
}
const sourceModal = new SourceModal();

class AboutModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('aboutModal');
    this.closeButton = document.getElementById('closeAboutModal');
    this.versionDisplay = document.getElementById('versionDisplayAbout');
    this.appVersionDisplay = document.getElementById('appVersionAbout');
    this.appVersionText = document.getElementById('appVersionTextAbout');
    this.networkName = document.getElementById('networkNameAbout');
    this.netId = document.getElementById('netIdAbout');
    this.openSourceLink = document.getElementById('openSourceModal');

    // Set up event listeners
    this.closeButton.addEventListener('click', () => this.close());
    this.openSourceLink.addEventListener('click', (e) => {
      e.preventDefault();
      sourceModal.open();
    });

    // Set version and network information once during initialization
    this.versionDisplay.textContent = myVersion + ' ' + version;
    this.networkName.textContent = network.name;
    this.netId.textContent = network.netid;

    // Set up app version display if available
    if (reactNativeApp?.appVersion) {
      this.updateAppVersionDisplay(reactNativeApp.appVersion);
    }
  }

  open() {
    // Show the modal
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  openStore() {
    // Show update warning modal
    updateWarningModal.open();
  }

  updateAppVersionDisplay(appVersion) {
    if (appVersion) {
      this.appVersionText.textContent = appVersion;
      this.appVersionDisplay.style.display = 'block';
    }
  }
}
const aboutModal = new AboutModal();

class UpdateWarningModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('updateWarningModal');
    this.closeButton = document.getElementById('closeUpdateWarningModal');
    this.backupFirstBtn = document.getElementById('backupFirstBtn');
    this.proceedToStoreBtn = document.getElementById('proceedToStoreBtn');

    // Set up event listeners
    this.closeButton.addEventListener('click', () => this.close());
    this.backupFirstBtn.addEventListener('click', () => backupAccountModal.open());
    this.proceedToStoreBtn.addEventListener('click', () => this.proceedToStore());

    // Event delegation for dynamically created update toast button
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target && (target.id === 'updateToastButton' || target.classList.contains('toast-update-button'))) {
        event.preventDefault();
        this.open();
      }
    }, { capture: true });
  }

  open() {
    // This method only runs when user is in React Native app
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('android')) {
      this.storeUrl = 'https://play.google.com/store/apps/details?id=com.jairaj.liberdus';
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ios')) {
      this.storeUrl = 'https://testflight.apple.com/join/zSRCWyxy';
    } else {
      this.storeUrl = 'https://play.google.com/store/apps/details?id=com.jairaj.liberdus';
    }
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  proceedToStore() {
    // Close this modal and open the store URL
    this.close();
    if (this.storeUrl) {
      window.open(this.storeUrl, '_blank');
    }
  }
}
const updateWarningModal = new UpdateWarningModal();

class HelpModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('helpModal');
    this.closeButton = document.getElementById('closeHelpModal');
    this.submitFeedbackButton = document.getElementById('submitFeedback');
    this.joinDiscordButton = document.getElementById('joinDiscord');

    this.closeButton.addEventListener('click', () => this.close());
    this.submitFeedbackButton.addEventListener('click', () => {
      window.open('https://github.com/liberdus/web-client-v2/issues', '_blank');
    });
    this.joinDiscordButton.addEventListener('click', () => {
      window.open('https://discord.gg/2cpJzFnwCR', '_blank');
    });
  }

  open() {
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }
}
const helpModal = new HelpModal();

class FarmModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('farmModal');
    this.closeButton = document.getElementById('closeFarmModal');
    this.continueButton = document.getElementById('continueToFarm');

    this.closeButton.addEventListener('click', () => this.close());
    this.continueButton.addEventListener('click', () => this.handleContinue());
  }

  open() {
    this.modal.classList.add('active');
    enterFullscreen();
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  handleContinue() {
    // Get the farm URL from network configuration
    const farmURL = network?.farmUrl || 'https://liberdus.com/farm';
    // Open the farm URL in a new tab
    window.open(farmURL, '_blank');
    this.close();
  }
}
const farmModal = new FarmModal();

class LogsModal {
  constructor() {
    this.data = localStorage.getItem('logs') || '';
  }

  load() {
    this.modal = document.getElementById('logsModal');
    this.closeButton = document.getElementById('closeLogsModal');
    this.logsTextarea = document.getElementById('logsTextarea');
    this.clearButton = document.getElementById('clearLogsButton');

    this.closeButton.addEventListener('click', () => this.close());
    if (this.clearButton) {
      this.clearButton.addEventListener('click', () => this.clear());
    }
  }

  open() {
    this.modal.classList.add('active');
    // Fill the textarea with data and position the scroll to the bottom
    this.logsTextarea.value = this.data;
    this.logsTextarea.scrollTop = this.logsTextarea.scrollHeight;
  }
  
  log(...args) {
    const s = args.join(' ');
    try {
      this.data += s + '\n\n';
      // if length of data is more than 100k; remove some of the old lines from data to keep only the most recent 100k of lines
      if (this.data.length > 100000) {
        this.data = this.data.slice(this.data.length - 100000);
        this.data += s + '\n\n';
      }
      localStorage.setItem('logs', this.data);
    } catch (e) {
      console.error('Error saving logs to localStorage:', e);
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  clear() {
    this.data = '';
    localStorage.setItem('logs', '');
    if (this.logsTextarea) {
      this.logsTextarea.value = '';
    }
  }
}
const logsModal = new LogsModal();

class MyProfileModal {
  constructor() {}

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('accountModal');
    this.closeButton = document.getElementById('closeAccountForm');
    this.name = document.getElementById('name');
    // Email and Phone fields hidden - may want to restore later
    // this.email = document.getElementById('email');
    // this.phone = document.getElementById('phone');
    this.linkedin = document.getElementById('linkedin');
    this.x = document.getElementById('x');
    this.accountForm = document.getElementById('accountForm');
    this.submitButton = document.querySelector('#accountForm .btn.btn--primary');

    this.closeButton.addEventListener('click', () => this.close());
    this.accountForm.addEventListener('submit', (event) => this.handleSubmit(event));
    

    // Add input event listeners for validation
    this.name.addEventListener('input', (e) => this.handleNameInput(e));
    this.name.addEventListener('blur', (e) => this.handleNameBlur(e));
    // Email and Phone event listeners hidden - may want to restore later
    // this.phone.addEventListener('input', (e) => this.handlePhoneInput(e));
    // this.phone.addEventListener('blur', (e) => this.handlePhoneBlur(e));
    // this.email.addEventListener('input', (e) => this.handleEmailInput(e));
    this.linkedin.addEventListener('input', (e) => this.handleLinkedInInput(e));
    this.linkedin.addEventListener('blur', (e) => this.handleLinkedInBlur(e));
    this.x.addEventListener('input', (e) => this.handleXTwitterInput(e));
    this.x.addEventListener('blur', (e) => this.handleXTwitterBlur(e));
  }

  // Input sanitization and validation methods
  handleNameInput(e) {
    // Allow letters, spaces, and basic punctuation
//    const normalized = e.target.value.replace(/[^a-zA-Z\s\-'.]/g, '');
    const normalized = normalizeName(e.target.value)
    e.target.value = normalized;
  }

  handleNameBlur(e) {
    const normalized = normalizeName(e.target.value, true)
    e.target.value = normalized;
  }

  // Email and Phone handler methods hidden - may want to restore later
  // handlePhoneInput(e) {
  //   // Allow only numbers, spaces, dashes, and parentheses
  // //    const normalized = e.target.value.replace(/[^\d\s\-()]/g, '');
  //   const normalized = normalizePhone(e.target.value);
  //   e.target.value = normalized;
  // }

  // handleEmailInput(e) {
  //   const normalized = normalizeEmail(e.target.value);
  //   e.target.value = normalized;
  // }

  // handlePhoneBlur(e) {
  //   const normalized = normalizePhone(e.target.value, true);
  //   e.target.value = normalized;
  // }

  handleLinkedInInput(e) {
    // Allow letters, numbers, dashes, and underscores
//    const normalized = e.target.value.replace(/[^a-zA-Z0-9\-_]/g, '');
    const normalized = normalizeLinkedinUsername(e.target.value);
    e.target.value = normalized;
  }

  handleLinkedInBlur(e) {
    // Allow letters, numbers, dashes, and underscores
//    const normalized = e.target.value.replace(/[^a-zA-Z0-9\-_]/g, '');
    const normalized = normalizeLinkedinUsername(e.target.value, true);
    e.target.value = normalized;
  }

  handleXTwitterInput(e) {
    // Allow letters, numbers, and underscores
//    const normalized = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    const normalized = normalizeXTwitterUsername(e.target.value);
    e.target.value = normalized;
  }

  handleXTwitterBlur(e) {
    // Allow letters, numbers, and underscores
//    const normalized = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    const normalized = normalizeXTwitterUsername(e.target.value, true);
    e.target.value = normalized;
  }

  open() {
    // called when the modal needs to be opened
    this.modal.classList.add('active');
    if (myData && myData.account) {
      this.name.value = myData.account.name || '';
      // Email and Phone fields hidden - may want to restore later
      // this.email.value = myData.account.email || '';
      // this.phone.value = myData.account.phone || '';
      this.linkedin.value = myData.account.linkedin || '';
      this.x.value = myData.account.x || '';
    }
  }

  close() {
    // called when the modal needs to be closed
    this.modal.classList.remove('active');
  }

  async handleSubmit(event) {
    event.preventDefault();

    // Get and sanitize form data
    const formData = {
      name: this.name.value.trim(),
      // Email and Phone fields hidden - may want to restore later
      // email: this.email.value.trim(),
      // phone: this.phone.value.trim(),
      linkedin: this.linkedin.value.trim(),
      x: this.x.value.trim(),
    };

    // Save to myData.account
    myData.account = { ...myData.account, ...formData };

    showToast('Profile updated successfully', 2000, 'success');
    // disable the close button and submit button
    this.closeButton.disabled = true;
    this.submitButton.disabled = true;

    // if myInfo modal is open update the info
    if (myInfoModal && myInfoModal.isActive()) {
      myInfoModal.updateMyInfo();
    }

    // Hide success message after 2 seconds
    setTimeout(() => {
      this.close();
      // enable the close button and submit button
      this.closeButton.disabled = false;
      this.submitButton.disabled = false;
    }, 2000);
  }
}
const myProfileModal = new MyProfileModal();

class ValidatorStakingModal {
  constructor() {
    this.lockInfo = null; // { remainingMs, remainingReason }
  }

  load() {
    // Modal and main buttons
    this.modal = document.getElementById('validatorModal');
    this.stakeButton = document.getElementById('openStakeModal');
    this.unstakeButton = document.getElementById('submitUnstake');
    this.backButton = document.getElementById('closeValidatorModal');

    // UI state elements
    this.detailsElement = document.getElementById('validator-details');
    this.loadingElement = document.getElementById('validator-loading');
    this.errorElement = document.getElementById('validator-error-message');

    // Inline info area for unstake lock status (static element from index.html)
    this.unstakeLockInfoElement = document.getElementById('unstake-lock-info');
    if (this.unstakeLockInfoElement) this.unstakeLockInfoElement.textContent = '';

    // Stake info section
    this.stakeInfoSection = document.getElementById('validator-stake-info');

    // Display elements
    this.totalStakeElement = document.getElementById('validator-total-stake');
    this.totalStakeUsdElement = document.getElementById('validator-total-stake-usd');
    this.userStakeLibElement = document.getElementById('validator-user-stake-lib');
    this.userStakeUsdElement = document.getElementById('validator-user-stake-usd');
    this.nomineeLabelElement = document.getElementById('validator-nominee-label');
    this.nomineeValueElement = document.getElementById('validator-nominee');
    this.earnMessageElement = document.getElementById('validator-earn-message');
    this.learnMoreButton = document.getElementById('validator-learn-more');
    this.rewardsEstimateElement = document.getElementById('validator-rewards-estimate');

    // Skeleton bar elements
    this.pendingSkeletonBar = document.getElementById('pending-nominee-skeleton-1');
    this.pendingTxTextInBar = document.getElementById('pending-tx-text-in-bar');

    // Network info elements
    this.networkStakeUsdValue = document.getElementById('validator-network-stake-usd');
    this.networkStakeLibValue = document.getElementById('validator-network-stake-lib');
    this.stabilityFactorValue = document.getElementById('validator-stability-factor');
    this.marketPriceValue = document.getElementById('validator-market-price');
    this.marketStakeUsdValue = document.getElementById('validator-market-stake-usd');
    this.stakeForm = document.getElementById('stakeForm');


    this.unstakeButton.addEventListener('click', () => this.handleUnstake());
    this.backButton.addEventListener('click', () => this.close());
    
    // Set up the learn more button click handler
    if (this.learnMoreButton) {
      this.learnMoreButton.addEventListener('click', this.handleLearnMoreClick.bind(this));
    }
  }

  async open() {
    // Reset UI state
    this.loadingElement.style.display = 'block';
    this.detailsElement.style.display = 'none';
    this.errorElement.style.display = 'none';
    this.errorElement.textContent = '';

    // Reset conditional elements to default state
    this.nomineeLabelElement.textContent = 'Nominated Validator:';
    this.nomineeValueElement.textContent = '';
    // Ensure stake info section and items are visible by default
    this.stakeInfoSection.style.display = 'block';
    this.userStakeLibElement.parentElement.style.display = 'flex';
    this.userStakeUsdElement.parentElement.style.display = 'flex';
    // Hide earn message by default
    if (this.earnMessageElement) {
      this.earnMessageElement.style.display = 'none';
    }
    // Reset rewards display by default
    if (this.rewardsEstimateElement) {
      this.rewardsEstimateElement.textContent = 'N/A';
    }
    // Disable unstake button initially
    this.unstakeButton.disabled = true;
    this.stakeButton.disabled = false;

    // Show the modal
    this.modal.classList.add('active');

    // logic for text in skeleton bar
    // Pending Transaction UI
    this.nomineeValueElement.style.display = ''; // as in the original code
    this.pendingTxTextInBar.style.display = 'none';
    this.pendingSkeletonBar.style.display = 'none';

    let currentPendingTx = null;
    if (myData && myData.pending && Array.isArray(myData.pending) && myData.pending.length > 0) {
      currentPendingTx = myData.pending.find((tx) => tx.type === 'deposit_stake' || tx.type === 'withdraw_stake');
    }

    if (currentPendingTx) {
      this.detailsElement.style.display = 'block';
      this.pendingSkeletonBar.style.display = 'flex';
      this.pendingTxTextInBar.textContent =
        currentPendingTx.type === 'withdraw_stake' ? 'Pending Unstake Transaction' : 'Pending Stake Transaction';
      this.pendingTxTextInBar.style.display = 'block';

      if (currentPendingTx.type === 'deposit_stake') {
        this.stakeButton.disabled = true;
      }
    }

    let nominee = null;

    try {
      // Fetch Data Concurrently
      const userAddress = myData?.account?.keys?.address;
      if (!userAddress) {
        console.warn('User address not found in myData. Skipping user account fetch.');
        // Decide how to handle this - maybe show an error or a specific state?
        // For now, we'll proceed, but nominee/user stake will be unavailable.
      }

      const [userAccountData] = await Promise.all([
        userAddress ? queryNetwork(`/account/${longAddress(userAddress)}`) : Promise.resolve(null), // Fetch User Data if available
        getNetworkParams(), // Refresh Network params
        walletScreen.updateWalletBalances(),
      ]);

      // Extract Raw Data (API values are now actual BigInt objects or other types)
      nominee = userAccountData?.account?.operatorAccountInfo?.nominee; // string
      const userStakedBaseUnits = userAccountData?.account?.operatorAccountInfo?.stake; // BigInt object

      const stakeRequiredUsd = EthNum.toWei(parameters.current?.stakeRequiredUsdStr); // BigInt object

      const marketPrice = await getMarketPrice(); // number or null
      const stabilityFactor = getStabilityFactor(); // number


      let stakeAmountLibBaseUnits = null; // This will be a BigInt object or null
      if (
        stakeRequiredUsd != null &&
        typeof stakeRequiredUsd === 'bigint' &&
        stabilityFactor > 0
      ) {
        try {
          stakeAmountLibBaseUnits = bigxnum2big(stakeRequiredUsd, (1 / stabilityFactor).toString());
        } catch (e) {
          console.error('Error calculating stakeAmountLibBaseUnits with BigInt:', e, {
            stabilityFactor,
            stakeRequiredUsd: stakeRequiredUsd.toString()
          });
        }
      }

      let userStakedUsd = null; // number or null
      // TODO: Calculate User Staked Amount (USD) using market price - Use stability factor if available?
      // For now, using market price as implemented previously.
      if (userStakedBaseUnits != null && typeof userStakedBaseUnits === 'bigint' && marketPrice != null) {
        // Check it's a BigInt
        try {
          // userStakedBaseUnits is already a BigInt object
          const userStakedLib = Number(userStakedBaseUnits) / 1e18;
          userStakedUsd = userStakedLib * marketPrice;
        } catch (e) {
          console.error('Error calculating userStakedUsd:', e, {
            userStakedBaseUnits,
            marketPrice,
          });
        }
      }

      let marketStakeUsdBaseUnits = null; // BigInt object or null
      // Calculate Min Stake at Market (USD) using BigInt and market price
      if (stakeAmountLibBaseUnits !== null && marketPrice != null) {
        // stakeAmountLibBaseUnits is BigInt object here
        try {
          const stakeAmountLib = Number(stakeAmountLibBaseUnits) / 1e18;
          const marketStakeUsd = stakeAmountLib * marketPrice;
          // Approximate back to base units (assuming 18 decimals for USD base units)
          marketStakeUsdBaseUnits = BigInt(Math.round(marketStakeUsd * 1e18));
        } catch (e) {
          console.error('Error calculating marketStakeUsdBaseUnits:', e, {
            stakeAmountLibBaseUnits,
            marketPrice,
          });
        }
      }

      // Format & Update UI

      // stakeAmountLibBaseUnits is a BigInt object or null. Pass its string representation to big2str.
      this.stakeForm.dataset.minStake = stakeAmountLibBaseUnits === null ? '0' : big2str(stakeAmountLibBaseUnits, 18);

      // stakeRequiredUsd is a BigInt object or null/undefined. Pass its string representation.
      const displayNetworkStakeUsd = stakeRequiredUsd != null ? '$' + big2str(stakeRequiredUsd, 18).slice(0, 6) : 'N/A';
      // stakeAmountLibBaseUnits is a BigInt object or null. Pass its string representation.
      const displayNetworkStakeLib =
        stakeAmountLibBaseUnits !== null ? big2str(stakeAmountLibBaseUnits, 18).slice(0, 7) : 'N/A';
      const displayStabilityFactor = stabilityFactor ? stabilityFactor.toFixed(6) : 'N/A';
      const displayMarketPrice = marketPrice ? '$' + marketPrice.toFixed(6) : 'N/A';
      // marketStakeUsdBaseUnits is a BigInt object or null. Pass its string representation.
      const displayMarketStakeUsd =
        marketStakeUsdBaseUnits !== null ? '$' + big2str(marketStakeUsdBaseUnits, 18).slice(0, 6) : 'N/A';

      this.networkStakeUsdValue.textContent = displayNetworkStakeUsd;
      this.networkStakeLibValue.textContent = displayNetworkStakeLib;
      this.stabilityFactorValue.textContent = displayStabilityFactor;
      this.marketPriceValue.textContent = displayMarketPrice;
      this.marketStakeUsdValue.textContent = displayMarketStakeUsd;

      if (!nominee) {
        // Case: No Nominee - Hide the stake info section completely and show earn message
        this.stakeInfoSection.style.display = 'none';
        
        // Show earn message and learn more button
        if (this.earnMessageElement) {
          this.earnMessageElement.style.display = 'block';
        }
        
        // Reset rewards display
        if (this.rewardsEstimateElement) {
          this.rewardsEstimateElement.textContent = 'N/A';
        }
      } else {
        // Case: Nominee Exists - Show staking info section
        this.stakeInfoSection.style.display = 'block';
        
        // userStakedBaseUnits is a BigInt object or null/undefined. Pass its string representation.
        const displayUserStakedLib = userStakedBaseUnits != null ? big2str(userStakedBaseUnits, 18).slice(0, 6) : 'N/A';
        const displayUserStakedUsd = userStakedUsd != null ? '$' + userStakedUsd.toFixed(6) : 'N/A';

        this.nomineeLabelElement.textContent = 'Nominated Validator:';
        this.nomineeValueElement.textContent = nominee;
        this.userStakeLibElement.textContent = displayUserStakedLib;
        this.userStakeUsdElement.textContent = displayUserStakedUsd;
        
        // Hide earn message
        if (this.earnMessageElement) {
          this.earnMessageElement.style.display = 'none';
        }

        const nodeRewardAmountUsd = EthNum.toWei(parameters.current.nodeRewardAmountUsdStr);
        const nodeRewardInterval = parameters.current.nodeRewardInterval;

        // Calculate and display estimated rewards based on node's start time
        try {
          await this.calculateAndDisplayValidatorRewards(nominee, nodeRewardAmountUsd, nodeRewardInterval);
        } catch (e) {
          console.error('Error calculating rewards: ', e);
          
          // Set fallback value on error
          if (this.rewardsEstimateElement) this.rewardsEstimateElement.textContent = 'N/A';
        }
      }

      // Compute and cache lock state once per open, then update UI consistently
      try {
        if (nominee) {
          this.lockInfo = await this.calculateStakeLockRemaining(nominee);
        } else {
          this.lockInfo = null;
        }
      } catch (_) {
        this.lockInfo = null;
      }

      this.detailsElement.style.display = 'block'; // Or 'flex' if it's a flex container
    } catch (error) {
      console.error('Error fetching validator details:', error);
      // Display error in UI
      this.errorElement.textContent = 'Failed to load validator details. Please try again later.';
      this.errorElement.style.display = 'block';
      // Ensure details are hidden if an error occurs
      this.detailsElement.style.display = 'none';
      // Ensure unstake button remains disabled on error
      this.unstakeButton.disabled = true;
    } finally {
      // Hide loading indicator regardless of success or failure
      this.loadingElement.style.display = 'none';
      // Apply final UI state for Unstake (considers nominee, pending tx, and lockInfo)
      this.updateUnstakeLockUI({ nominee, currentPendingTx });
    }
  }

  close() {
    this.modal.classList.remove('active');
  }
  
  handleLearnMoreClick() {
    const validatorUrl = network.validatorUrl || 'https://liberdus.com/validator';
    window.open(validatorUrl, '_blank');
  }

  /**
   * Centralized UI updates for Unstake lock state
   * Ensures consistent disabled state, tooltip, and inline message.
   * @param {Object} params - { nominee, currentPendingTx }
   * @param {string} params.nominee - The address of the nominee
   * @param {Object} params.currentPendingTx - The current pending transaction
   * @returns {void}
   */
  updateUnstakeLockUI({ nominee, currentPendingTx }) {
    try {
      // Default title and enable state
      this.unstakeButton.title = '';
      this.unstakeButton.disabled = !nominee;
      if (this.unstakeLockInfoElement) this.unstakeLockInfoElement.textContent = '';

      // Pending tx disables both actions
      if (currentPendingTx) {
        this.unstakeButton.disabled = true;
        this.stakeButton.disabled = true;
        return;
      }

      // Apply lock info if available
      const info = this.lockInfo;
      if (!info || !nominee) return;

      const { remainingMs, remainingReason } = info;
      if (remainingReason === 'validator active') {
        this.unstakeButton.disabled = true;
        this.unstakeButton.title = `Unstake disabled (validator active).`;
        if (this.unstakeLockInfoElement) this.unstakeLockInfoElement.textContent = `Unstake disabled (validator active).`;
        return;
      }

      if (remainingMs > 0) {
        const durationInWords = this.formatDuration(remainingMs);
        this.unstakeButton.disabled = true;
        this.unstakeButton.title = `Unstake locked (${remainingReason}). Wait ${durationInWords}.`;
        if (this.unstakeLockInfoElement) this.unstakeLockInfoElement.textContent = `Unstake locked (${remainingReason}). Wait ${durationInWords}.`;
      }
    } catch (_) {
      // Non-fatal UI update failure; do nothing
    }
  }

  async handleUnstake() {
    // Attempt to read nominee from the DOM element populated by openValidatorModal
    const nominee = this.nomineeValueElement.textContent.trim();

    // Check if we successfully retrieved a nominee address from the DOM
    if (!nominee || nominee.length < 10) {
      // Add a basic sanity check for length
      showToast('Could not find nominated validator.', 0, 'error');
      console.warn('ValidatorStakingModal: Nominee not found or invalid in DOM element #validator-nominee.');
      return;
    }

    // If the button is disabled for any reason, show the current reason and exit
    if (this.unstakeButton.disabled) {
      const message = this.unstakeButton.title || this.unstakeLockInfoElement?.textContent || 'Unstake unavailable.';
      if (message) showToast(message, 0, 'error');
      return;
    }

    // Stake-lock period check using cached lockInfo; tiny guard if missing
    const info = this.lockInfo;
    if (info) {
      const { remainingMs, remainingReason } = info;
      if (remainingReason === 'validator active') {
        showToast(`Unstake unavailable (validator active).`, 0, 'error');
        return;
      } else if (remainingMs > 0) {
        const durationInWords = this.formatDuration(remainingMs);
        showToast(`Unstake unavailable (${remainingReason}). Please wait ${durationInWords} before trying again.`, 0, 'error');
        return;
      }
    }

    // Confirmation dialog
    const confirmationMessage = `Are you sure you want to unstake from validator: ${nominee}?`;
    if (window.confirm(confirmationMessage)) {
      //console.log(`User confirmed unstake from: ${nominee}`);
      showToast('Submitting unstake transaction...', 3000, 'loading');
      // Call the function to handle the actual transaction submission
      await this.submitUnstakeTransaction(nominee);
    }
  }

  async submitUnstakeTransaction(nodeAddress) {
    // disable the unstake button, back button, and submitStake button
    this.unstakeButton.disabled = true;
    this.backButton.disabled = true;
    this.stakeButton.disabled = true;

    try {
      const response = await this.postUnstake(nodeAddress);
      if (response && response.result && response.result.success) {
        myData.wallet.history.unshift({
          nominee: nodeAddress,
          amount: bigxnum2big(wei, '0'),
          type: 'withdraw_stake',
          sign: 1,
          status: 'sent',
          timestamp: getCorrectedTimestamp(),
          txid: response.txid,
        });

        this.close();
        this.open();
      } else {
        // not showing toast since shown in injectTx
        console.error('Unstake failed. API Response:', response);
      }
    } catch (error) {
      console.error('Error submitting unstake transaction:', error);
      // Provide a user-friendly error message
      showToast('Unstake transaction failed. Network or server error.', 0, 'error');
    } finally {
      this.unstakeButton.disabled = false;
      this.backButton.disabled = false;
      this.stakeButton.disabled = false;
    }
  }

  async postUnstake(nodeAddress) {
    // TODO: need to query network for the correct nominator address
    const unstakeTx = {
      type: 'withdraw_stake',
      nominator: longAddress(myAccount?.keys?.address),
      nominee: nodeAddress,
      force: false,
      timestamp: getCorrectedTimestamp(),
      networkId: network.netid,
    };

    const txid = await signObj(unstakeTx, myAccount.keys);
    const response = await injectTx(unstakeTx, txid);
    return response;
  }

  async checkValidatorActivity(validatorAddress) {
    if (!validatorAddress) {
      console.error('ValidatorStakingModal: No validator address provided.');
      return { isActive: false, error: 'No address provided' }; // Cannot determine activity without address
    }
    try {
      const data = await queryNetwork(`/account/${validatorAddress}`);
      if (data && data.account) {
        const account = data.account;
        // Active if reward has started (not 0) but hasn't ended (is 0)
        const isActive =
          account.rewardStartTime &&
          account.rewardStartTime !== 0 &&
          (!account.rewardEndTime || account.rewardEndTime === 0);
        return { isActive: isActive, error: null };
      } else {
        console.warn(`ValidatorStakingModal: No account data found for validator ${validatorAddress}.`);
        return { isActive: false, error: 'Could not fetch validator data' };
      }
    } catch (error) {
      console.error(`ValidatorStakingModal: Error fetching data for validator ${validatorAddress}:`, error);
      // Network error or other issue fetching data.
      return { isActive: false, error: 'Network error fetching validator status' };
    }
  }

  /**
   * Calculate the remaining time for a stake lock
   * @param {string} nomineeAddress - The address of the nominee
   * @returns {Object} - { remainingMs, stakeLockTime, remainingReason }
   */
  async calculateStakeLockRemaining(nomineeAddress) {
    // Ensure network parameters are fresh
    await getNetworkParams();

    const now = getCorrectedTimestamp();
    const stakeLockTime = parameters?.current?.stakeLockTime || 0;

    // Gather nominator (user) side info
    const nominatorAddress = myData?.account?.keys?.address;
    let certExp = 0;

    try {
      if (nominatorAddress) {
        const userRes = await queryNetwork(`/account/${longAddress(nominatorAddress)}`);
        certExp = userRes?.account?.operatorAccountInfo?.certExp || 0;
      }
    } catch (e) {
      console.warn('ValidatorStakingModal: Failed to fetch nominator account for stake-lock calc:', e);
    }

    // Gather nominee (validator) side info
    let rewardStartTimeMs = 0;
    let rewardEndTimeMs = 0;

    try {
      if (nomineeAddress) {
        const validatorRes = await queryNetwork(`/account/${nomineeAddress}`);
        const rs = validatorRes?.account?.rewardStartTime || 0; // seconds
        const re = validatorRes?.account?.rewardEndTime || 0;   // seconds
        rewardStartTimeMs = rs * 1000;
        rewardEndTimeMs = re * 1000;
      }
    } catch (e) {
      console.warn('ValidatorStakingModal: Failed to fetch validator account for stake-lock calc:', e);
    }

    // From reward end (recently inactive/exit)
    if (stakeLockTime > 0 && rewardEndTimeMs > 0) {
      const rem = stakeLockTime - (now - rewardEndTimeMs);
      return { remainingMs: rem, stakeLockTime, remainingReason: 'recent validator deactivation' };
    }

    // Validator active (immediate blocker; no countdown)
    if (rewardStartTimeMs > 0 && rewardEndTimeMs === 0) {
      return { remainingMs: 0, stakeLockTime: 0, remainingReason: 'validator active' };
    }

    // Certificate delay
    if (certExp > now) {
      return { remainingMs: certExp - now, stakeLockTime: 0, remainingReason: 'certificate active' };
    }
  }

  /**
   * Format a duration in milliseconds into a human-readable string
   * @param {number} ms - The duration in milliseconds
   * @returns {string} - The formatted duration in hours, minutes, and seconds
   */
  formatDuration(ms) {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  /**
   * Calculates and displays validator rewards
   * @param {string} nominee - The nominee address
   * @param {BigInt} nodeRewardAmountUsd - The reward amount in USD (could be an object with value property or a BigInt)
   * @param {number} nodeRewardInterval - The reward interval in milliseconds
   * @returns {Promise<void>}
   */
  async calculateAndDisplayValidatorRewards(nominee, nodeRewardAmountUsd, nodeRewardInterval) {
    if (!nominee || !nodeRewardAmountUsd || !nodeRewardInterval) {
      if (this.rewardsEstimateElement) this.rewardsEstimateElement.textContent = 'N/A';
      return;
    }
    
    // Get validator info to calculate rewards based on start time
    let validatorData;
    try {
      validatorData = await queryNetwork(`/account/${nominee}`);
    } catch (e) {
      console.warn('Failed to fetch validator data for rewards calculation:', e);
      if (this.rewardsEstimateElement) this.rewardsEstimateElement.textContent = 'N/A';
      return;
    }

    // Get already accumulated rewards from node account - for both active and inactive validators
    const accumulatedRewardLib = validatorData.account.reward;
    let accumulatedRewardUsd = BigInt(0);
    // Convert accumulatedRewardLib from LIB to USD using stability factor
    try {
      const stabilityFactor = getStabilityFactor();
      if (stabilityFactor > 0) {
        accumulatedRewardUsd = bigxnum2big(accumulatedRewardLib, stabilityFactor.toString());
      }
    } catch (e) {
      console.warn('Failed to convert reward from LIB to USD:', e);
    }

    const rewardStartTime = validatorData?.account?.rewardStartTime || 0; // in seconds
    const rewardEndTime = validatorData?.account?.rewardEndTime || 0; // in seconds
    
    // If the validator hasn't started earning rewards, but might have accumulated rewards
    // OR if the validator has ended (rewardEndTime > 0), only show accumulated rewards
    if (!rewardStartTime || rewardEndTime > 0) {
      // Display only accumulated rewards
      const bigStrValue = big2str(accumulatedRewardUsd.toString(), 18);
      const numValue = parseFloat(bigStrValue);
      const rewardsDisplay = '$' + numValue.toFixed(2);
      this.rewardsEstimateElement.textContent = rewardsDisplay || '$0.00';
      return;
    }
    
    // Calculate rewards based on time since start (only for active validators)
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    const timeSinceStart = now - rewardStartTime; // seconds running
    const timeInMs = timeSinceStart * 1000;
    
    // Calculate both completed and partial intervals
    const completedIntervals = timeInMs / nodeRewardInterval;
    
    // Calculate total rewards including partial completion of current interval
    const completedRewards = bigxnum2big(nodeRewardAmountUsd, completedIntervals.toString());
    
    // Add already accumulated rewards from the node account to estimated rewards
    const totalRewardsValue = completedRewards + accumulatedRewardUsd;
    
    // Convert to display format with 2 decimal places for USD
    const bigStrValue = big2str(totalRewardsValue.toString(), 18);
    const numValue = parseFloat(bigStrValue);
    const rewardsDisplay = '$' + numValue.toFixed(2);
    
    // Set reward estimate text
    if (this.rewardsEstimateElement) {
      this.rewardsEstimateElement.textContent = rewardsDisplay;
    }
  }

  /**
   * Check if the validator staking modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }
}
const validatorStakingModal = new ValidatorStakingModal();

class StakeValidatorModal {
  constructor() {
    this.stakedAmount = 0n;
    this.lastValidationTimestamp = 0;
    this.hasNominee = false;
    this.isFaucetRequestInProgress = false;
  }

  load() {
    this.modal = document.getElementById('stakeModal');
    this.form = document.getElementById('stakeForm');
    this.nodeAddressInput = document.getElementById('stakeNodeAddress');
    this.amountInput = document.getElementById('stakeAmount');
    this.submitButton = document.getElementById('submitStake');
    this.backButton = document.getElementById('closeStakeModal');
    this.nodeAddressGroup = document.getElementById('stakeNodeAddressGroup');
    this.balanceDisplay = document.getElementById('stakeAvailableBalanceDisplay');
    this.balanceAmount = document.getElementById('stakeBalanceAmount');
    this.transactionFee = document.getElementById('stakeTransactionFee');
    this.amountWarning = document.getElementById('stakeAmountWarning');
    this.nodeAddressWarning = document.getElementById('stakeNodeAddressWarning');
    this.scanStakeQRButton = document.getElementById('scanStakeQRButton');
    this.uploadStakeQRButton = document.getElementById('uploadStakeQRButton');
    this.stakeQRFileInput = document.getElementById('stakeQrFileInput');
    this.faucetButton = document.getElementById('faucetButton');

    // Setup event listeners
    this.form.addEventListener('submit', (event) => this.handleSubmit(event));
    this.backButton.addEventListener('click', () => this.close());

    this.debouncedValidateStakeInputs = debounce(() => this.validateStakeInputs(), 300);

    this.nodeAddressInput.addEventListener('input', this.debouncedValidateStakeInputs);
    this.amountInput.addEventListener('input', () => this.amountInput.value = normalizeUnsignedFloat(this.amountInput.value));
    this.amountInput.addEventListener('input', this.debouncedValidateStakeInputs);
    this.scanStakeQRButton.addEventListener('click', () => scanQRModal.open());
    this.uploadStakeQRButton.addEventListener('click', () => this.stakeQRFileInput.click());
    this.stakeQRFileInput.addEventListener('change', (event) => sendAssetFormModal.handleQRFileSelect(event, this));
    this.faucetButton.addEventListener('click', () => this.requestFromFaucet());

    // Add listener for opening the modal
    document.getElementById('openStakeModal').addEventListener('click', () => this.open());
  }

  open() {
    this.modal.classList.add('active');

    // Set the correct fill function for the staking context
    scanQRModal.fillFunction = this.fillFromQR.bind(this);

    // Display Available Balance and Fee
    this.updateStakeBalanceDisplay();

    // Check for nominee address from validator modal
    const nominee = document.getElementById('validator-nominee')?.textContent?.trim();
    const isNominee = !!nominee;

    // Set node address and UI state based on nominee
    this.nodeAddressInput.value = isNominee ? nominee : '';
    this.nodeAddressGroup.style.display = isNominee ? 'none' : 'block';
    this.submitButton.textContent = isNominee ? 'Add Stake' : 'Submit Stake';
    
    // Reset faucet button state
    this.faucetButton.disabled = true;
    this.isFaucetRequestInProgress = false;

    // Set minimum stake amount
    const minStakeAmount = this.form.dataset.minStake || '0';
    if (this.amountInput && minStakeAmount) {
      this.amountInput.value = minStakeAmount;
    }

    // Call initial validation
    this.validateStakeInputs();
  }

  close() {
    this.modal.classList.remove('active');
    // Reset the form fields
    this.resetForm();
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.submitButton.disabled = true;

    const nodeAddress = this.nodeAddressInput.value.trim();
    const amountStr = this.amountInput.value.trim();

    // Basic Validation
    if (!nodeAddress || !amountStr) {
      showToast('Please fill in all fields.', 0, 'error');
      this.submitButton.disabled = false;
      return;
    }

    let amount_in_wei;
    try {
      amount_in_wei = bigxnum2big(wei, amountStr);
    } catch (error) {
      showToast('Invalid amount entered.', 0, 'error');
      this.submitButton.disabled = false;
      return;
    }

    try {
      this.backButton.disabled = true;

      const response = await this.postStake(nodeAddress, amount_in_wei, myAccount.keys);

      if (response && response.result && response.result.success) {
        myData.wallet.history.unshift({
          nominee: nodeAddress,
          amount: amount_in_wei,
          type: 'deposit_stake',
          sign: -1,
          status: 'sent',
          timestamp: getCorrectedTimestamp(),
          txid: response.txid,
        });

        showToast('Submitted stake transaction...', 3000, 'loading');

        validatorStakingModal.close();
        this.nodeAddressInput.value = ''; // Clear form
        this.amountInput.value = '';
        this.close();
        validatorStakingModal.open();
      }
    } catch (error) {
      console.error('Stake transaction error:', error);
      showToast('Stake transaction failed. See console for details.', 0, 'error');
    } finally {
      this.submitButton.disabled = false;
      this.backButton.disabled = false;
    }
  }

  async postStake(nodeAddress, amount, keys) {
    const stakeTx = {
      type: 'deposit_stake',
      nominator: longAddress(myAccount.keys.address),
      nominee: nodeAddress,
      stake: amount,
      timestamp: getCorrectedTimestamp(),
      networkId: network.netid,
    };

    const txid = await signObj(stakeTx, keys);
    const response = await injectTx(stakeTx, txid);
    return response;
  }

  async updateStakeBalanceDisplay() {
    const libAsset = myData.wallet.assets.find((asset) => asset.symbol === 'LIB');
    
    if (!libAsset) {
      this.balanceAmount.textContent = '0.000000 LIB';
      this.transactionFee.textContent = '0.00 LIB';
      return;
    }

    await getNetworkParams();
    const txFeeInLIB = getTransactionFeeWei();
    
    const balanceInLIB = big2str(BigInt(libAsset.balance), 18).slice(0, -12);
    const feeInLIB = big2str(txFeeInLIB, 18).slice(0, -16);

    this.balanceAmount.textContent = balanceInLIB + ' LIB';
    this.transactionFee.textContent = feeInLIB + ' LIB';
  }

  async validateStakeInputs() {
    const nodeAddress = this.nodeAddressInput.value.trim();
    const amountStr = this.amountInput.value.trim();
    const minStakeAmountStr = this.form.dataset.minStake || '0';

    // Default state: button disabled, warnings hidden
    this.submitButton.disabled = true;
    this.amountWarning.style.display = 'none';
    this.amountWarning.textContent = '';
    this.nodeAddressWarning.style.display = 'none';
    this.nodeAddressWarning.textContent = '';
    
    // Disable faucet button by default
    this.faucetButton.disabled = true;

    // Check 1: Empty Fields
    if (!nodeAddress) {
      return;
    }

    // Check 1.5: Node Address Format (64 hex chars)
    const addressRegex = /^[0-9a-fA-F]{64}$/;
    if (!addressRegex.test(nodeAddress)) {
      this.nodeAddressWarning.textContent = 'Invalid (need 64 hex chars)';
      this.nodeAddressWarning.style.display = 'inline';
      this.amountWarning.style.display = 'none';
      this.amountWarning.textContent = '';
      return;
    } else {
      this.nodeAddressWarning.style.display = 'none';
      this.nodeAddressWarning.textContent = '';
      
      // Enable faucet button if node address is valid
      this.faucetButton.disabled = false;
    }

    if (!amountStr) {
      return;
    }

    // --- Amount Checks ---
    let amountWei;
    let minStakeWei;
    try {
      amountWei = bigxnum2big(wei, amountStr);

      // if amount is 0 or less, than return
      if (amountWei <= 0n) {
        return;
      }

      // get the account info for the address
      const address = longAddress(myData?.account?.keys?.address);

      // if the time stamps are more than 30 seconds ago, reset the staked amount and time stamps
      if (getCorrectedTimestamp() - this.lastValidationTimestamp > 30000) {
        const res = await queryNetwork(`/account/${address}`);
        this.stakedAmount = res?.account?.operatorAccountInfo?.stake || 0n;
        this.lastValidationTimestamp = getCorrectedTimestamp();
        this.hasNominee = res?.account?.operatorAccountInfo?.nominee;
      }

      const staked = this.hasNominee;
      minStakeWei = bigxnum2big(wei, minStakeAmountStr);

      if (staked) {
        // get the amount they have staked from the account info
        const stakedAmount = this.stakedAmount;

        // subtract the staked amount from the min stake amount and this will be the new min stake amount
        minStakeWei = minStakeWei - stakedAmount;
        // if minStake is less than 0, then set the min stake to 0
        if (minStakeWei < 0n) {
          minStakeWei = 0n;
        }
      }
    } catch (error) {
      showToast(`Error validating stake inputs: ${error}`, 0, 'error');
      console.error(`error validating stake inputs: ${error}`);
      return;
    }

    // Check 2: Minimum Stake Amount
    if (amountWei < minStakeWei) {
      const minStakeFormatted = big2str(minStakeWei, 18).slice(0, -16);
      this.amountWarning.textContent = `must be at least ${minStakeFormatted} LIB`;
      this.amountWarning.style.display = 'inline';
      return;
    }

    // Check 3: Sufficient Balance
    const hasSufficientBalance = await validateBalance(amountWei, 0, this.amountWarning);
    if (!hasSufficientBalance) {
      return;
    }

    // All checks passed: Enable button
    this.submitButton.disabled = false;
    this.amountWarning.style.display = 'none';
    this.nodeAddressWarning.style.display = 'none';
  }

  /**
   * Fills the stake address input field from QR data
   * @param {string} data - The QR data to fill the stake address input field
   * @returns {void}
   * */
  async fillFromQR(data) {
    // Directly set the value of the stakeNodeAddress input field
    if (this.nodeAddressInput) {
      this.nodeAddressInput.value = data;
      this.nodeAddressInput.dispatchEvent(new Event('input'));
    } else {
      console.error('Stake node address input field not found!');
      showToast('Could not find stake address field.', 0, 'error');
    }
  }

  /**
   * Resets the form to its default state
   * @returns {void}
   * */
  resetForm() {
    // Default state: button disabled, warnings hidden
    this.nodeAddressInput.value = '';    
    this.submitButton.disabled = true;
    this.amountWarning.style.display = 'none';
    this.amountWarning.textContent = '';
    this.nodeAddressWarning.style.display = 'none';
    this.nodeAddressWarning.textContent = '';
    this.faucetButton.disabled = true;
  }
  
  /**
   * Request funds from the faucet for the validator node
   * @returns {Promise<void>}
   */
  async requestFromFaucet() {
    if (this.isFaucetRequestInProgress) {
      return;
    }

    const toastId = showToast('Requesting from faucet...', 0, 'loading');
    try {
      this.isFaucetRequestInProgress = true;
      this.faucetButton.disabled = true;
      
      const payload = {
        username: myAccount.username,
        userAddress: longAddress(myAccount.keys.address),
        networkId: network.netid,
        nodeAddress: this.nodeAddressInput.value.trim(),
      };
      await signObj(payload, myAccount.keys);
      
      const faucetUrl = network.faucetUrl || 'https://dev.liberdus.com:3355/faucet';
      
      const response = await fetch(faucetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        showToast('Faucet request successful! The LIB will be sent to your wallet.', 5000, 'success');
        this.close();
      } else {
        const errorMessage = result.message || result.error || 'Unknown error';
        showToast(`Faucet error: ${errorMessage}`, 0, 'error');
      }
      
    } catch (error) {
      console.error('Faucet request error:', error);
      showToast(`Faucet request failed: ${error.message || 'Unknown error'}`, 0, 'error');
    } finally {
      hideToast(toastId);
      this.isFaucetRequestInProgress = false;
    }
  }
}
const stakeValidatorModal = new StakeValidatorModal();

class ChatModal {
  constructor() {
    this.newestReceivedMessage = null;
    this.newestSentMessage = null;
    this.lastMessageCount = null;

    // used by updateTollValue and updateTollRequired
    this.toll = null;
    this.tollUnit = null;
    this.address = null;

    // file attachments
    this.fileAttachments = [];
    // context menu properties
    this.currentContextMessage = null;

    // Flag to prevent multiple downloads
    this.attachmentDownloadInProgress = false; 

    // Abort controller for cancelling file operations
    this.abortController = new AbortController();
    
    // Keyboard detection properties
    this.isKeyboardVisible = false; // Track keyboard state
    this.initialViewportHeight = window.innerHeight; // Store initial viewport height
    
    // Track whether we've locked background/modal scroll
    this.scrollLocked = false;
    this._touchMoveBlocker = null; // blocks touch outside messages container

    // Track which voice message element is playing
    this.playingVoiceMessageElement = null;
  }

  /**
   * Gets toll info message from HTML template
   * @returns {string} The toll info message HTML
   */
  getTollInfoMessage() {
    if (this.tollTemplate) {
      return this.tollTemplate.innerHTML;
    }
    // Fallback message if template not found
    return '<strong>What is a Toll?</strong><br><br>A toll is a payment in LIB that recipients can require with messages to prevent spam.';
  }

  /**
   * Cancels all ongoing file operations and creates a new abort controller
   * @returns {void}
   */
  cancelAllOperations() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }

  /**
   * Loads the chat modal event listeners
   * @returns {void}
   */
  load() {
    this.modal = document.getElementById('chatModal');
    this.closeButton = document.getElementById('closeChatModal');
    this.messagesList = document.querySelector('.messages-list');
    this.sendButton = document.getElementById('handleSendMessage');
    this.cancelEditButton = document.getElementById('cancelEditButton');
    this.modalAvatar = this.modal.querySelector('.modal-avatar');
    this.modalTitle = this.modal.querySelector('.modal-title');
    this.headerMenuButton = document.getElementById('chatHeaderMenuButton');
    this.headerContextMenu = document.getElementById('chatHeaderContextMenu');
    this.retryOfTxId = document.getElementById('retryOfTxId');
    this.messageInput = document.querySelector('.message-input');
    this.replyPreview = document.getElementById('replyPreview');
    this.replyPreviewContent = document.querySelector('#replyPreview .reply-preview-content');
    this.replyPreviewText = document.querySelector('#replyPreview .reply-preview-text');
    this.replyPreviewClose = document.getElementById('replyPreviewClose');
    this.replyToTxId = document.getElementById('replyToTxId');
    this.replyToMessage = document.getElementById('replyToMessage');
    this.replyOwnerIsMine = document.getElementById('replyOwnerIsMine');
    this.messageByteCounter = document.querySelector('.message-byte-counter');
    this.tollTemplate = document.getElementById('tollInfoMessageTemplate');
    this.messagesContainer = document.querySelector('.messages-container');
    this.addFriendButtonChat = document.getElementById('addFriendButtonChat');
    this.addAttachmentButton = document.getElementById('addAttachmentButton');
    this.chatFileInput = document.getElementById('chatFileInput');
    this.chatPhotoLibraryInput = document.getElementById('chatPhotoLibraryInput');
    this.chatFilesInput = document.getElementById('chatFilesInput');
    
    // Camera capture modal elements
    this.cameraCaptureOverlay = document.getElementById('cameraCaptureOverlay');
    this.cameraCaptureDialog = document.getElementById('cameraCaptureDialog');
    this.cameraCaptureVideo = document.getElementById('cameraCaptureVideo');
    this.cameraCancelButton = document.getElementById('cameraCancelButton');
    this.cameraCaptureButton = document.getElementById('cameraCaptureButton');

    // Voice recording elements
    this.voiceRecordButton = document.getElementById('voiceRecordButton');
    

    // this.voiceRecordingModal = new VoiceRecordingModal(this);
    // this.voiceRecordingModal.init();


    // Initialize context menu
    this.contextMenu = document.getElementById('messageContextMenu');
    // Initialize image attachment context menu
    this.imageAttachmentContextMenu = document.getElementById('imageAttachmentContextMenu');
    // Initialize attachment options context menu
    this.attachmentOptionsContextMenu = document.getElementById('attachmentOptionsContextMenu');
    // Cache attachment options context menu option elements
    this.cameraOpt = this.attachmentOptionsContextMenu?.querySelector('.context-menu-option[data-action="camera"]');
    this.photoLibraryOpt = this.attachmentOptionsContextMenu?.querySelector('.context-menu-option[data-action="photo-library"]');
    this.filesOpt = this.attachmentOptionsContextMenu?.querySelector('.context-menu-option[data-action="files"]');
    this.cameraFileOpt = this.attachmentOptionsContextMenu?.querySelector('.context-menu-option[data-action="camera-file"]');
    this.contactsOpt = this.attachmentOptionsContextMenu?.querySelector('.context-menu-option[data-action="contacts"]');
    
    this.currentImageAttachmentRow = null;
    
    // Add event delegation for message clicks (since messages are created dynamically)
    this.messagesList.addEventListener('click', this.handleMessageClick.bind(this));
    // Intercept clicks on call icon to gate future calls
    this.messagesList.addEventListener('click', (e) => {
      const phoneAnchor = e.target.closest('.call-message-phone-button');
      if (!phoneAnchor) return;
      const messageEl = phoneAnchor.closest('.message');
      if (!messageEl) return;
      if (this.gateScheduledCall(messageEl)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    });
    
    // Add context menu option listeners
    this.contextMenu.addEventListener('click', (e) => {
      if (e.target.closest('.context-menu-option')) {
        const action = e.target.closest('.context-menu-option').dataset.action;
        this.handleContextMenuAction(action);
      }
    });
    // Add image attachment context menu option listeners
    if (this.imageAttachmentContextMenu) {
      this.imageAttachmentContextMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.context-menu-option');
        if (!option) return;
        const action = option.dataset.action;
        this.handleImageAttachmentContextMenuAction(action);
      });
    }
    // Add attachment options context menu option listeners
    if (this.attachmentOptionsContextMenu) {
      this.attachmentOptionsContextMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.context-menu-option');
        if (!option) return;
        const action = option.dataset.action;
        this.handleAttachmentOptionsContextMenuAction(action);
      });
    }
    
    // Close context menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.closeContextMenu();
      }
      if (this.imageAttachmentContextMenu && !this.imageAttachmentContextMenu.contains(e.target)) {
        this.closeImageAttachmentContextMenu();
      }
      if (this.attachmentOptionsContextMenu && !this.attachmentOptionsContextMenu.contains(e.target) && !this.addAttachmentButton.contains(e.target)) {
        this.closeAttachmentOptionsContextMenu();
      }
      if (this.headerContextMenu && !this.headerContextMenu.contains(e.target) && this.headerMenuButton && !this.headerMenuButton.contains(e.target)) {
        this.closeHeaderContextMenu();
      }
    });
    this.sendButton.addEventListener('click', this.handleSendMessage.bind(this));
    this.cancelEditButton.addEventListener('click', () => this.cancelEdit());
    this.closeButton.addEventListener('click', this.close.bind(this));
    this.sendButton.addEventListener('keydown', ignoreTabKey);

    // Add debounced draft saving
    this.debouncedSaveDraft = debounce((text) => {
      this.saveDraft(text);
    }, 500);

    // Add input event listener for message textarea auto-resize
    this.messageInput.addEventListener('input', (e) => {
      this.messageInput.style.height = '48px';
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';

      const messageText = e.target.value;
      const messageValidation = this.validateMessageSize(messageText);
      this.updateMessageByteCounter(messageValidation);

      // Save draft (text is already limited to 2000 chars by maxlength attribute)
      this.debouncedSaveDraft(e.target.value);
      this.toggleSendButtonVisibility();
    });

    // allow ctlr+enter or cmd+enter to send message
    this.messageInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!this.sendButton.disabled) {
          this.handleSendMessage();
        }
      }
    });

    // Add viewport resize listener for keyboard detection
    window.addEventListener('resize', () => {
      const currentHeight = window.innerHeight;
      const heightDifference = this.initialViewportHeight - currentHeight;
      
      // If viewport height decreased significantly, keyboard is likely open
      if (heightDifference > 150) { // 150px threshold for keyboard detection
        this.isKeyboardVisible = true;
        this.lockBackgroundScroll();
      } else if (heightDifference < 50) { // If height increased or stayed similar, keyboard is likely closed
        this.isKeyboardVisible = false;
        /* console.log('⌨️ Keyboard detected as closed (viewport height difference:', heightDifference, 'px)'); */
        this.unlockBackgroundScroll();
      }
    });

    // Add focus event listener for message input to handle scrolling
    this.messageInput.addEventListener('focus', () => {
      // Extra guard: immediately lock background/modal scroll when focusing input
      this.lockBackgroundScroll();
      if (this.messagesContainer) {
        // Check if we're already at the bottom (within 50px threshold)
        const isAtBottom =
          this.messagesContainer.scrollHeight - this.messagesContainer.scrollTop - this.messagesContainer.clientHeight <= 50;
        if (isAtBottom) {
          // Wait for keyboard to appear and viewport to adjust
          setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            // removed for now since RN android causing extra scroll behavior
            /* this.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); // To provide smoother, more reliable scrolling on mobile. */
          }, 500); // Increased delay to ensure keyboard is fully shown
        }
      }
    });

    // Unlock when input loses focus (keyboard likely dismissed)
    this.messageInput.addEventListener('blur', () => {
      this.unlockBackgroundScroll();
    });

    // Header context menu handlers
    if (this.headerMenuButton) {
      this.headerMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showHeaderContextMenu(e);
      });
    }

    if (this.headerContextMenu) {
      this.headerContextMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.context-menu-option');
        if (!option) return;
        const action = option.dataset.action;
        this.handleHeaderContextMenuAction(action);
      });
    }

    this.addFriendButtonChat.addEventListener('click', () => {
      this.pauseVoiceMessages();
      if (!friendModal.getCurrentContactAddress()) return;
      friendModal.open();
    });

    if (this.replyPreviewClose) {
      this.replyPreviewClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cancelReply();
      });
    }

    if (this.replyPreview) {
      this.replyPreview.addEventListener('click', (e) => this.handleReplyPreviewClick(e));
    }

    if (this.addAttachmentButton) {
      this.addAttachmentButton.addEventListener('click', (e) => {
        e.stopPropagation();
        // Always show our custom context menu (includes Camera, Photo Library, Files, Contacts)
        this.showAttachmentOptionsContextMenu(e);
      });
    }

    if (this.chatFileInput) {
      this.chatFileInput.addEventListener('change', (e) => {
        this.handleFileAttachment(e);
      });
    }
    if (this.chatPhotoLibraryInput) {
      this.chatPhotoLibraryInput.addEventListener('change', (e) => {
        this.handleFileAttachment(e);
      });
    }
    if (this.chatFilesInput) {
      this.chatFilesInput.addEventListener('change', (e) => {
        this.handleFileAttachment(e);
      });
    }

    // Voice recording event listeners
    if (this.voiceRecordButton) {
      this.voiceRecordButton.addEventListener('click', async () => {
        const tollInLib = myData.contacts[this.address].tollRequiredToSend == 0 ? 0n : this.toll;
        const sufficientBalance = await validateBalance(tollInLib);
        if (!sufficientBalance) {
          const msg = `Insufficient balance for fee${tollInLib > 0n ? ' and toll' : ''}. Go to the wallet to add more LIB.`;
          showToast(msg, 0, 'error');
          return;
        }
        voiceRecordingModal.open();
      });
    }

    // Voice message play button event delegation
    this.messagesList.addEventListener('click', (e) => {
      const playButton = e.target.closest('.voice-message-play-button');
      if (playButton) {
        e.preventDefault();
        this.playVoiceMessage(playButton);
      }
    });

    // Reply quote click delegation
    this.messagesList.addEventListener('click', (e) => {
      const replyQuote = e.target.closest('.reply-quote');
      if (replyQuote) {
        const targetTxid = replyQuote.dataset.replyTxid;
        if (targetTxid) {
          e.preventDefault();
          e.stopPropagation();
          this.scrollToMessage(targetTxid);
        }
      }
    });

    // Voice message speed button event delegation
    this.messagesList.addEventListener('click', (e) => {
      const speedButton = e.target.closest('.voice-message-speed-button');
      if (speedButton) {
        e.preventDefault();
        this.togglePlaybackSpeed(speedButton);
      }
    });

    // live updates while dragging the slider thumb
    this.messagesList.addEventListener('input', (e) => {
      const seekEl = e.target.closest('.voice-message-seek');
      if (seekEl) this.updateVmTimeFromSeek(seekEl);
    });

    // ensures click-to-seek updates on mouse/touch release
    this.messagesList.addEventListener('change', (e) => {
      const seekEl = e.target.closest('.voice-message-seek');
      if (seekEl) this.updateVmTimeFromSeek(seekEl);
    });


    // Make toll info clickable: show sticky info toast and refresh toll in background
    const tollContainer = this.modal.querySelector('.toll-container');
    if (tollContainer) {
      tollContainer.style.cursor = 'pointer';
      tollContainer.addEventListener('click', () => {
        const message = this.getTollInfoMessage();
        showToast(message, 0, 'toll', true);
      });
    }

    this.toggleSendButtonVisibility();
  }

    // Voice message seek slider live time display (works even before playback)
    updateVmTimeFromSeek (seekEl) {
      const voiceMessageElement = seekEl.closest('.voice-message');
      if (!voiceMessageElement) return;

      const timeDisplayElement = voiceMessageElement.querySelector('.voice-message-time-display');

      const newTime = Number(seekEl.value || 0);

      const totalSeconds = Math.floor(Number(seekEl.max) || Number(voiceMessageElement.dataset.duration) || 0);
      // updates the on-screen "current / total" label
      if (timeDisplayElement) {
        const currentTime = this.formatDuration(newTime);
        const totalTime = this.formatDuration(totalSeconds);
        timeDisplayElement.textContent = `${currentTime} / ${totalTime}`;
      }
      // ensures playback starts at the chosen position when audio is ready
      voiceMessageElement.pendingSeekTime = newTime;
    };

  /**
   * Set voice message button icon (play or pause)
   * @param {HTMLElement} voiceMessageElement - Voice message element
   * @param {boolean} isPlaying - True for pause icon, false for play icon
   */
  setVoiceMessageButton(voiceMessageElement, isPlaying) {
    const button = voiceMessageElement?.querySelector('.voice-message-play-button');
    if (!button) return;
    button.disabled = false;
    button.innerHTML = isPlaying 
      ? '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  }

  /**
   * Reset voice message UI to initial state
   */
  resetVoiceMessageUI(voiceMessageElement) {
    if (!voiceMessageElement) return;
    this.setVoiceMessageButton(voiceMessageElement, false);
    const seekEl = voiceMessageElement.querySelector('.voice-message-seek');
    const timeDisplay = voiceMessageElement.querySelector('.voice-message-time-display');
    if (seekEl) seekEl.value = 0;
    if (timeDisplay && voiceMessageElement.dataset.duration) {
      const duration = this.formatDuration(Number(voiceMessageElement.dataset.duration) || 0);
      timeDisplay.textContent = `0:00 / ${duration}`;
    }
  }

  /**
   * Clean up voice message audio resources
   */
  cleanupVoiceMessageResources(voiceMessageElement) {
    if (!voiceMessageElement) return;
    // Revoke blob URL to prevent memory leak (critical - blobs aren't auto-cleaned)
    if (voiceMessageElement.audioUrl) URL.revokeObjectURL(voiceMessageElement.audioUrl);
    // TODO: delete these when we set up listeners properly since we don't have to remove them manually and will be set up during load()
    // Remove event listeners from seekEl by cloning (removes all listeners at once)
    const seekEl = voiceMessageElement.querySelector('.voice-message-seek');
    if (seekEl && voiceMessageElement.seekSetup) {
      const newSeekEl = seekEl.cloneNode(true);
      seekEl.parentNode?.replaceChild(newSeekEl, seekEl);
    }
    // Delete references to help GC
    delete voiceMessageElement.audioElement;
    delete voiceMessageElement.audioUrl;
    delete voiceMessageElement.pendingSeekTime;
    delete voiceMessageElement.isScrubbing;
    delete voiceMessageElement.seekSetup;
  }

  /**
   * Pause voice message without cleanup (keeps audio cached for quick resume)
   */
  pauseVoiceMessage(voiceMessageElement) {
    if (!voiceMessageElement) return;
    const audio = voiceMessageElement.audioElement;
    if (audio && !audio.paused) {
      audio.pause();
      this.setVoiceMessageButton(voiceMessageElement, false);
      if (this.playingVoiceMessageElement === voiceMessageElement) {
        this.playingVoiceMessageElement = null;
      }
    }
  }

  /**
   * Pause voice messages when clicking any header action button
   */
  pauseVoiceMessages() {
    if (this.playingVoiceMessageElement) {
      this.pauseVoiceMessage(this.playingVoiceMessageElement);
    }
  }

  /**
   * Stop and cleanup a voice message (frees all resources)
   */
  stopVoiceMessage(voiceMessageElement) {
    if (!voiceMessageElement) return;
    if (voiceMessageElement.audioElement) voiceMessageElement.audioElement.pause();
    this.resetVoiceMessageUI(voiceMessageElement);
    this.cleanupVoiceMessageResources(voiceMessageElement);
    if (this.playingVoiceMessageElement === voiceMessageElement) {
      this.playingVoiceMessageElement = null;
    }
  }

  /**
   * Toggles visibility of send button and microphone button based on input content
   */
  toggleSendButtonVisibility() {
    const hasText = this.messageInput.value.trim().length > 0 || (this.fileAttachments && this.fileAttachments.length > 0);
    this.sendButton.style.display = hasText ? 'flex' : 'none';
    if (this.voiceRecordButton) {
      this.voiceRecordButton.style.display = hasText ? 'none' : 'flex';
    }
  }

  /**
   * Opens the chat modal for the given address.
   * @param {string} address - The address of the contact to open the chat modal for.
   * @param {boolean} skipAutoScroll - Whether to skip auto-scrolling to bottom (used when scrolling to a specific message)
   * @returns {Promise<void>}
   */
  async open(address, skipAutoScroll = false) {
    // clear message input
    this.messageInput.value = '';
    this.messageInput.style.height = '48px';
    this.messageByteCounter.style.display = 'none';
    this.toggleSendButtonVisibility();
    // clear any edit state and hide cancel button
    const editInputInit = document.getElementById('editOfTxId');
    editInputInit.value = '';
    this.cancelEditButton.style.display = 'none';
    this.addAttachmentButton.disabled = false;

    friendModal.setAddress(address);
    footer.closeNewChatButton();
    const contact = myData.contacts[address];
    friendModal.updateFriendButton(contact, 'addFriendButtonChat');
    // Set user info
    this.modalTitle.textContent = getContactDisplayName(contact);

    walletScreen.updateWalletBalances();

    // update the toll value. Will not await this and it'll update the toll value while the modal is open.
    this.updateTollValue(address);

    // update local contact object with the toll required to send and receive
    this.updateTollRequired(address);

    // clear hidden txid input
    this.retryOfTxId.value = '';

    this.updateTollAmountUI(address);

    // Store username for context menu pay action
    if (this.headerContextMenu) {
      const payOption = this.headerContextMenu.querySelector('[data-action="pay"]');
      if (payOption) {
        payOption.dataset.username = contact.username || address;
      }
    }

    this.modalAvatar.innerHTML = await getContactAvatarHtml(contact, 40);

    // Stop and cleanup all voice messages from previous conversation
    this.messagesList?.querySelectorAll('.voice-message').forEach(vm => this.stopVoiceMessage(vm));

    // Clear previous messages from the UI
    this.messagesList.innerHTML = '';

    // Scroll to bottom (initial scroll for empty list, appendChatModal will scroll later)
    // Skip if we're going to scroll to a specific message
    if (!skipAutoScroll) {
      setTimeout(() => {
        this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
      }, 100);
    }

    // Add click handler for username to show contact info
    // TODO: create event listener instead of onclick here
    const userInfo = this.modal.querySelector('.chat-user-info');
    userInfo.onclick = () => {
      this.pauseVoiceMessages();
      const contact = myData.contacts[address];
      if (contact) {
        contactInfoModal.open(createDisplayInfo(contact));
      }
    };


    // Load any draft message
    this.loadDraft(address);

    // Show modal
    this.modal.classList.add('active');

    // Clear unread count
    if (contact.unread > 0) {
      myData.state.unread = Math.max(0, (myData.state.unread || 0) - contact.unread);
      contact.unread = 0;
      chatsScreen.updateChatList();
    }

    this.clearNotificationsIfAllRead();

    // Setup state for appendChatModal and perform initial render
    this.address = address;

    // One-time tolled deposit toast (only if explicitly enabled on the contact)
    this.maybeShowTolledDepositToast(address);

    this.appendChatModal(false, skipAutoScroll); // Call appendChatModal to render messages, ensure highlight=false
  }

  /**
   * Show a one-time toast when opening a chat where the other party is tolled and has deposited a toll.
   * This is opt-in via contact.tolledDepositToastShown === false (older accounts may not have this field).
   * @param {string} address
   * @returns {Promise<void>}
   */
  async maybeShowTolledDepositToast(address) {
    try {
      const contact = myData?.contacts?.[address];
      if (!contact) return;

      // Only show if explicitly marked as not-yet-shown.
      if (contact.tolledDepositToastShown !== false) return;

      // Only for tolled contacts
      if (Number(contact.friend) !== 1) return;

      // Need network to confirm there is an actual deposited toll on this chat
      if (!isOnline) return;

      const depositInfo = await this.hasIncomingTolledDeposit(address);
      const hasDeposit = !!depositInfo?.hasDeposit;
      if (!hasDeposit) return;

      // User may have navigated away while we were awaiting network
      if (!this.isActive() || this.address !== address) return;

      showToast(
        '<strong>This user has deposited a toll to message you.</strong><ul style="margin: 8px 0 0 0; padding-left: 20px;"><li>Change their status to a connection to refund the toll</li><li>Reply to collect the full toll</li><li>Ignore to collect half the toll</li></ul>',
        0,
        'toll',
        true
      );

      contact.tolledDepositToastShown = true;
      saveState();
    } catch (e) {
      console.warn('maybeShowTolledDepositToast failed', e);
    }
  }

  /**
   * Returns true if the other party has an outstanding toll deposit for us on this chat (payOnRead only).
   * @param {string} address
   * @returns {Promise<{hasDeposit: boolean, payOnRead: bigint}>}
   */
  async hasIncomingTolledDeposit(address) {
    try {
      if (!myAccount?.keys?.address) return { hasDeposit: false, payOnRead: 0n };
      const myAddr = longAddress(myAccount.keys.address);
      const contactAddr = longAddress(address);
      const sortedAddresses = [myAddr, contactAddr].sort();
      const chatId = hashBytes(sortedAddresses.join(''));
      const myIndex = sortedAddresses.indexOf(myAddr);

      const chatIdAccount = await queryNetwork(`/messages/${chatId}/toll`);
      if (!chatIdAccount || chatIdAccount?.error || !chatIdAccount?.toll) {
        return { hasDeposit: false, payOnRead: 0n };
      }

      const payOnReadRaw = chatIdAccount.toll?.payOnRead?.[myIndex];

      const payOnRead =
        typeof payOnReadRaw === 'bigint' ? payOnReadRaw : BigInt(payOnReadRaw || 0);

      // Only consider payOnRead for triggering the toast (per product decision).
      return { hasDeposit: payOnRead !== 0n, payOnRead };
    } catch (e) {
      console.warn('hasIncomingTolledDeposit failed', e);
      return { hasDeposit: false, payOnRead: 0n };
    }
  }

  /**
   * Check if chatModal is active
   * @returns {boolean} - True if modal is open, false otherwise
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  /**
   * Closes the chat modal
   * @returns {void}
   */
  close() {
    // Ensure scroll is unlocked when closing
    this.unlockBackgroundScroll();
    if (isOnline) {
      const needsToSendReadTx = this.needsToSend();
      // if newestRecevied message does not have an amount property and user has not responded, then send a read transaction
      if (needsToSendReadTx) {
        this.sendReadTransaction(this.address);
      }
      
      this.sendReclaimTollTransaction(this.address);
    } else {
      console.warn('Offline: toll not processed');
    }

    // Save any unsaved draft before closing (save immediately, not debounced)
    this.saveDraft(this.messageInput.value);

    // Cancel all ongoing file operations
    this.cancelAllOperations();

    // Stop all playing voice messages
    this.messagesList?.querySelectorAll('.voice-message').forEach(vm => this.stopVoiceMessage(vm));

    // Clean up thumbnail blob URLs
    this.messagesList?.querySelectorAll('[data-thumbnail-url]').forEach(row => {
      const thumbnailUrl = row.dataset.thumbnailUrl;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
        delete row.dataset.thumbnailUrl;
      }
    });

    // clear file attachments
    this.fileAttachments = [];
    this.showAttachmentPreview(); // clear listeners

    this.clearNotificationsIfAllRead();

    this.modal.classList.remove('active');
    if (chatsScreen.isActive()) {
      chatsScreen.updateChatList();
      footer.openNewChatButton();
    }
    if (contactsScreen.isActive()) {
      contactsScreen.updateContactsList();
      footer.openNewChatButton();
    }

    // Record the time user last viewed this chat for edit notification purposes
    if (this.address && myData.contacts[this.address]) {
      myData.contacts[this.address].lastChatOpenTs = getCorrectedTimestamp();
    }

    this.address = null;
  }

  clearNotificationsIfAllRead() {
    if (!reactNativeApp.isReactNativeWebView) {
      return;
    }

    const allRead = Object.values(myData.contacts).every((c) => c.unread === 0);
    const currentAddress = myAccount?.keys?.address;
    
    if (allRead) {
      logsModal.log('Clearing notification address for account', currentAddress);
      reactNativeApp.clearNotificationAddress(currentAddress);
      reactNativeApp.sendClearNotifications(currentAddress);
    }

    const notificationAddresses = reactNativeApp.getNotificationAddresses();
    if (notificationAddresses.length === 0) {
      reactNativeApp.sendClearNotifications();
    }
  }

  /**
   * Check if the user needs to send a read transaction since we don't need to send if we have replied to the message and if the last message is from the other party and the contact's timestamp is less than the latest message's timestamp
   * @returns {boolean} - True if the user needs to send a read transaction, false otherwise
   */
  needsToSend() {
    const contact = myData.contacts[this.address];
    if (!contact?.messages?.length) {
      return false;
    }

    // if the other party is not required to pay toll, then don't send a read transaction.
    if (contact.tollRequiredToReceive === 0 || contact.friend === 2 || contact.friend === 3) {
      return false;
    }

    // Find the last relevant message
    const lastChatMessage = contact.messages.find((message) => {
      // Skip payment-only messages
      if (message.amount) {
        return false;
      }

      // Include chat messages that are not payment messages
      return true;
    });

    if (!lastChatMessage) {
      return false;
    }
    if (lastChatMessage.my) {
      return false;
    } else {
      // if the last message is from the other party, then we need to send a read transaction if the contact's timestamp is less than the latest message's timestamp
      if (contact.timestamp < lastChatMessage.timestamp) {
        return true;
      }
      return false;
    }
  }

  /**
   * Send a reclaim toll if the newest sent message is older than 7 days and the contact has a value not 0 in payOnReplay or payOnRead
   * @param {string} contactAddress - The address of the contact
   * @returns {Promise<void>}
   */
  async sendReclaimTollTransaction(contactAddress) {
    await getNetworkParams();
    const currentTime = getCorrectedTimestamp();
    const networkTollTimeoutInMs = parameters.current.tollTimeout; 
    const timeSinceNewestSentMessage = currentTime - this.newestSentMessage?.timestamp;
    if (!this.newestSentMessage || timeSinceNewestSentMessage < networkTollTimeoutInMs) {
      // console.log(
      //   `[sendReclaimTollTransaction] timeSinceNewestSentMessage ${timeSinceNewestSentMessage}ms is less than networkTollTimeoutInMs ${networkTollTimeoutInMs}ms, skipping reclaim toll transaction`
      // );
      return;
    }
    const canReclaimToll = await this.canSenderReclaimToll(contactAddress);
    if (!canReclaimToll) {
      // console.log(
      //   `[sendReclaimTollTransaction] does not have a value not 0 in payOnReplay or payOnRead, skipping reclaim toll transaction`
      // );
      return;
    }

    const tx = {
      type: 'reclaim_toll',
      from: longAddress(myData.account.keys.address),
      to: longAddress(contactAddress),
      chatId: hashBytes([longAddress(myData.account.keys.address), longAddress(contactAddress)].sort().join('')),
      timestamp: getCorrectedTimestamp(),
      networkId: network.netid,
    };
    const txid = await signObj(tx, myAccount.keys);
    const response = await injectTx(tx, txid);
    if (!response || !response.result || !response.result.success) {
      console.warn('reclaim toll transaction failed to send', response);
    }
  }

  /**
   * return true if when we query chatID account , then check payOnReplay and payOnRead for index of the receiver has a value not 0
   * @param {string} contactAddress - The address of the contact
   * @returns {Promise<boolean>} - True if the contact has a value not 0 in payOnReplay or payOnRead, false otherwise
   */
  async canSenderReclaimToll(contactAddress) {
    // keep track receiver index during the sort
    const sortedAddresses = [longAddress(myData.account.keys.address), longAddress(contactAddress)].sort();
    const receiverIndex = sortedAddresses.indexOf(longAddress(contactAddress));
    const chatId = hashBytes(sortedAddresses.join(''));
    const chatIdAccount = await queryNetwork(`/messages/${chatId}/toll`);
    if (!chatIdAccount || !chatIdAccount.toll) {
      console.warn('chatIdAccount not found', chatIdAccount);
      return false;
    }
    const payOnReply = chatIdAccount.toll.payOnReply[receiverIndex]; // bigint
    const payOnRead = chatIdAccount.toll.payOnRead[receiverIndex]; // bigint
    if (payOnReply !== 0n) {
      return true;
    }
    if (payOnRead !== 0n) {
      return true;
    }
    return false;
  }

  /**
   * Sends a read transaction to the contact if the contact's timestamp is less than the newest received message's timestamp
   * @param {string} contactAddress - The address of the contact
   * @returns {void}
   */
  async sendReadTransaction(contactAddress) {
    const contact = myData.contacts[contactAddress];

    const readTransaction = await this.createReadTransaction(contactAddress);
    const txid = await signObj(readTransaction, myAccount.keys);
    showToast(`Sending read transaction`, 3000, 'info');

    const response = await injectTx(readTransaction, txid);
    if (!response || !response.result || !response.result.success) {
      console.warn('read transaction failed to send', response);
    } else {
      contact.timestamp = readTransaction.timestamp;
    }
  }

  /**
   * Creates a read transaction object for the given contact address
   * @param {string} contactAddress - The address of the contact
   * @returns {Object} The read transaction object
   */
  async createReadTransaction(contactAddress) {
    const readTransaction = {
      type: 'read',
      from: longAddress(myData.account.keys.address),
      to: longAddress(contactAddress),
      chatId: hashBytes([longAddress(myData.account.keys.address), longAddress(contactAddress)].sort().join('')),
      timestamp: getCorrectedTimestamp(),
      oldContactTimestamp: myData.contacts[contactAddress].timestamp,
      networkId: network.netid,
    };
    return readTransaction;
  }

  /**
   * Invoked when the user clicks the Send button in a recipient (appendChatModal.address) chat modal
   * Recipient account exists in myData.contacts; was created when the user submitted the New Chat form
   * @returns {void}
   */
  async handleSendMessage() {
    this.sendButton.disabled = true; // Disable the button

    // Check if user is offline - prevent sending messages when offline
    if (!isOnline) {
      showToast('You are offline. Please check your internet connection.', 3000, 'error');
      return;
    }

    // if user is blocked, don't send message, show toast
    if (myData.contacts[this.address].tollRequiredToSend == 2) {
      showToast('You are blocked by this user', 0, 'error');
      this.sendButton.disabled = false;
      return;
    }

    // Declare edit-related state outside try so catch can access
    let isEdit = false;
    let originalMsg = null;
    let originalMsgState = null;
    let editInput = null;
    let editTargetTxId = '';

    try {
      this.messageInput.focus(); // Add focus back to keep keyboard open

      const message = this.messageInput.value.trim();
      if (!message && !this.fileAttachments?.length) {
        this.sendButton.disabled = false;
        return;
      }

      const amount = myData.contacts[this.address].tollRequiredToSend == 1 ? this.toll : 0n;
      const sufficientBalance = await validateBalance(amount);
      if (!sufficientBalance) {
        const msg = `Insufficient balance for fee${amount > 0n ? ' and toll' : ''}. Go to the wallet to add more LIB.`;
        showToast(msg, 0, 'error');
        this.sendButton.disabled = false;
        return;
      }

      //const messagesList = this.messagesList;

      // Get current chat data
      const chatsData = myData;
      /*
            const currentAddress = Object.values(chatsData.contacts).find(contact =>
                modalTitle.textContent === (contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`)
            )?.address;
            */
      const currentAddress = this.address;
      if (!currentAddress) return;

      // Check if trying to message self
      if (currentAddress === myAccount.address) {
        return;
      }

      // Get sender's keys from wallet
      const keys = myAccount.keys;
      if (!keys) {
        showToast('Keys not found for sender address', 0, 'error');
        return;
      }

      // Ensure recipient's keys are available
      const keysOk = await ensureContactKeys(currentAddress);
      let recipientPubKey = myData.contacts[currentAddress]?.public;
      let pqRecPubKey = myData.contacts[currentAddress]?.pqPublic;
      if (!keysOk || !recipientPubKey || !pqRecPubKey) {
        console.warn(`no public/PQ key found for recipient ${currentAddress}`);
        return;
      }

      /*
      // Generate shared secret using ECDH and take first 32 bytes
      let dhkey = ecSharedKey(keys.secret, recipientPubKey);
      const { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey);
      const combined = new Uint8Array(dhkey.length + sharedSecret.length);
      combined.set(dhkey);
      combined.set(sharedSecret, dhkey.length);
      dhkey = deriveDhKey(combined);
      */
      const {dhkey, cipherText} = dhkeyCombined(keys.secret, recipientPubKey, pqRecPubKey)
      const selfKey = encryptData(bin2hex(dhkey), keys.secret+keys.pqSeed, true)  // used to decrypt our own message

      // Determine if this is an edit of an existing message
      editInput = document.getElementById('editOfTxId');
      editTargetTxId = editInput ? editInput.value.trim() : '';

      // Build message object: either normal message or edit control
      let messageObj;
      if (editTargetTxId) {
        // Validate we still can edit
        const contactMsgs = myData.contacts[currentAddress].messages;
        originalMsg = contactMsgs.find(m => m.txid === editTargetTxId);
        if (!originalMsg) {
          // Original disappeared; fallback to normal send
          console.warn('Edit target message not found locally; sending as new message');
        } else if (!originalMsg.my) {
          console.warn('Attempt to edit a message not owned by user');
        } else if (originalMsg.deleted) {
          console.warn('Attempt to edit a deleted message');
        } else if ((Date.now() - Number(originalMsg.timestamp || 0)) > EDIT_WINDOW_MS) {
          showToast('Edit window expired', 3000, 'info');
        } else {
          isEdit = true;
        }
      }

      if (isEdit) {
        messageObj = {
          type: 'edit',
            txid: editTargetTxId,
            text: message
        };
      } else {
        const replyIdVal = this.replyToTxId?.value?.trim?.() || '';
        const replyMsgVal = this.replyToMessage?.value?.trim?.() || '';
        const replyOwnerIsMineVal = this.replyOwnerIsMine?.value === '1';
        // Convert message to new JSON format with type and optional attachments
        messageObj = {
          type: 'message',
          message: message
        };
        if (replyIdVal) {
          messageObj.replyId = replyIdVal;
          messageObj.replyMessage = replyMsgVal || '';
          messageObj.replyOwnerIsMine = replyOwnerIsMineVal;
        }
      }

      // Handle attachments - add them to the JSON structure instead of using xattach
      if (this.fileAttachments && this.fileAttachments.length > 0) {
        messageObj.attachments = this.fileAttachments;
      }

      // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
      // Encrypt the JSON message using shared secret
      const encMessage = encryptChacha(dhkey, stringify(messageObj));

      // Create message payload
      const payload = {
        message: encMessage,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: bin2base64(cipherText),
        selfKey: selfKey,
        sent_timestamp: getCorrectedTimestamp()
      };

      // Always include username, but only include other info if recipient is a friend
      const contact = myData.contacts[currentAddress];
      // Create basic sender info with just username
      const senderInfo = {
        username: myAccount.username,
      };

      // Add additional info only if recipient is a connection
      if (contact && contact?.friend && contact?.friend >= 2) {
        // Add more personal details for connections
        senderInfo.name = myData.account.name;
        senderInfo.linkedin = myData.account.linkedin;
        senderInfo.x = myData.account.x;
        // Add avatar info if available
        if (myData.account.avatarId && myData.account.avatarKey) {
          senderInfo.avatarId = myData.account.avatarId;
          senderInfo.avatarKey = myData.account.avatarKey;
        }
        // Add timezone if available
        const tz = getLocalTimeZone();
        if (tz) {
          senderInfo.timezone = tz;
        }
      }

      // Always encrypt and send senderInfo (which will contain at least the username)
      payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

      // can create a function to query the account and get the receivers toll they've set
      // TODO: will need to query network and receiver account where we validate
      // TODO: decided to query everytime we do chatModal.open and save as global variable. We don't need to clear it but we can clear it when closing the modal but should get reset when opening the modal again anyway
      let tollInLib =
        myData.contacts[currentAddress].tollRequiredToSend == 0 ? 0n : this.toll

      const chatMessageObj = await this.createChatMessage(currentAddress, payload, tollInLib, keys);
      await signObj(chatMessageObj, keys);
      const txid = getTxid(chatMessageObj)

      // if there a hidden txid input, get the value to be used to delete that txid from relevant data stores
      const retryTxId = this.retryOfTxId.value;
      if (retryTxId) {
        removeFailedTx(retryTxId, currentAddress);
        this.retryOfTxId.value = '';
      }

      // --- Optimistic UI Update ---
      // Create new message object for local display immediately
      let newMessage;
      if (isEdit) {
        // Optimistic update of original message (record original so we can revert on failure)
        const contactMsgs = chatsData.contacts[currentAddress].messages;
        originalMsg = contactMsgs.find(m => m.txid === editTargetTxId);
        if (originalMsg) {
          originalMsgState = {
            message: originalMsg.message,
            edited: originalMsg.edited,
            edited_timestamp: originalMsg.edited_timestamp
          };
          originalMsg.message = message;
          originalMsg.edited = 1;
          originalMsg.edited_timestamp = payload.sent_timestamp;
          // Also update wallet history memo if this was a payment we sent
          if (myData?.wallet?.history && Array.isArray(myData.wallet.history)) {
            const hIdx = myData.wallet.history.findIndex((h) => h.txid === editTargetTxId);
            if (hIdx !== -1) {
              // Preserve prior state for potential revert
              if (!originalMsgState.history) originalMsgState.history = {};
              originalMsgState.history.memo = myData.wallet.history[hIdx].memo;
              originalMsgState.history.edited = myData.wallet.history[hIdx].edited;
              originalMsgState.history.edited_timestamp = myData.wallet.history[hIdx].edited_timestamp;
              myData.wallet.history[hIdx].memo = message;
              myData.wallet.history[hIdx].edited = 1;
              myData.wallet.history[hIdx].edited_timestamp = payload.sent_timestamp;
            }
          }
          this.appendChatModal();
        }
        // Clear edit marker only after capturing state and hide cancel button
        editInput.value = '';
        this.cancelEditButton.style.display = 'none';
        // Leaving edit mode optimistically; re-enable attachments
        this.addAttachmentButton.disabled = false;
      } else {
        newMessage = {
          message,
          timestamp: payload.sent_timestamp,
          sent_timestamp: payload.sent_timestamp,
          my: true,
          txid: txid,
          status: 'sent',
          ...(this.fileAttachments && this.fileAttachments.length > 0 && { xattach: this.fileAttachments }), // Only include if there are attachments
        };
        if (messageObj.replyId) {
          newMessage.replyId = messageObj.replyId;
          newMessage.replyMessage = messageObj.replyMessage;
          newMessage.replyOwnerIsMine = messageObj.replyOwnerIsMine;
        }
        insertSorted(chatsData.contacts[currentAddress].messages, newMessage, 'timestamp');
      }

      // clear file attachments and remove preview
      if (this.fileAttachments && this.fileAttachments.length > 0) {
        this.fileAttachments = [];
        this.showAttachmentPreview();
      }

      // Clear reply state after sending
      this.cancelReply();

      // Update or add to chats list, maintaining chronological order
      const chatUpdate = {
        address: currentAddress,
        timestamp: (newMessage ? newMessage.sent_timestamp : getCorrectedTimestamp()),
        txid: txid,
      };

      // Remove existing chat for this contact if it exists. Not handling in removeFailedTx anymore.
      const existingChatIndex = chatsData.chats.findIndex((chat) => chat.address === currentAddress);
      if (existingChatIndex !== -1) {
        chatsData.chats.splice(existingChatIndex, 1);
      }

      insertSorted(chatsData.chats, chatUpdate, 'timestamp');

      // Clear input and reset height, and delete any saved draft
           this.messageInput.value = '';
      this.messageInput.style.height = '48px'; // original height

      // Hide byte counter
      this.messageByteCounter.style.display = 'none';
      // Toggle button visibility (should show microphone when empty)
      this.toggleSendButtonVisibility(); 

      // Call debounced save directly with empty string
      this.debouncedSaveDraft('');
      contact.draft = '';
      // Clear reply draft state
      this.clearReplyState(contact);
      // Clear attachment draft state
      this.clearAttachmentState(contact);

      // Update the chat modal UI immediately
      if (!isEdit) this.appendChatModal(); // This should now display the 'sending' message

      // Scroll to bottom of chat modal
      this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
      // --- End Optimistic UI Update ---

      //console.log('payload is', payload)
      // Send the message transaction using createChatMessage with default toll of 1
      const response = await injectTx(chatMessageObj, txid);

      if (!response || !response.result || !response.result.success) {
        console.error('message failed to send', response);
        const str = response.result.reason;
        const regex = /toll/i;
  
        if (str.match(regex)) {
          await this.reopen();
        }
        //let userMessage = 'Message failed to send. Please try again.';
        //const reason = response.result?.reason || '';

        /* if (reason.includes('does not have sufficient funds')) {
                    userMessage = 'Message failed: Insufficient funds for toll & fees.';
                } else if (reason) {
                    // Attempt to provide a slightly more specific message if reason is short
                    userMessage = `Message failed: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`;
                } */
        //showToast(userMessage, 4000, 'error');

        // Update message status to 'failed' in the UI
        if (!isEdit) {
          updateTransactionStatus(txid, currentAddress, 'failed', 'message');
          this.appendChatModal();
        } else {
          showToast('Edit failed to send', 0, 'error');
          // Revert optimistic edit
          if (originalMsg && originalMsgState) {
            originalMsg.message = originalMsgState.message;
            if (originalMsgState.edited) {
              originalMsg.edited = originalMsgState.edited;
              originalMsg.edited_timestamp = originalMsgState.edited_timestamp;
            } else {
              delete originalMsg.edited;
              delete originalMsg.edited_timestamp;
            }
            // Revert wallet history memo if we changed it optimistically
            this.revertWalletHistoryEdit(editTargetTxId, originalMsgState.history);
            this.appendChatModal();
          }
          // Restore edit UI state to allow user to retry or cancel
          editInput.value = editTargetTxId;
          this.cancelEditButton.style.display = '';
          this.addAttachmentButton.disabled = true;
          // Restore the attempted edit text in the input
          this.messageInput.value = message;
          this.messageInput.focus();
        }

        // Remove from pending transactions as injectTx itself indicated failure
        /* if (myData && myData.pending) {
                    myData.pending = myData.pending.filter(pTx => pTx.txid !== txid);
                } */
      } else {
        // Success: for normal message nothing extra; for edit we already updated locally
        if (isEdit) {
          showToast('Message edited', 2000, 'success');
          this.addAttachmentButton.disabled = false;
        }
      }
    } catch (error) {
      console.error('Message error:', error);
      showToast('Failed to send message. Please try again.', 0, 'error');
      // Revert optimistic edit on exception
      if (isEdit && originalMsg && originalMsgState) {
        originalMsg.message = originalMsgState.message;
        if (originalMsgState.edited) {
          originalMsg.edited = originalMsgState.edited;
          originalMsg.edited_timestamp = originalMsgState.edited_timestamp;
        } else {
          delete originalMsg.edited;
          delete originalMsg.edited_timestamp;
        }
        // Revert wallet history memo if we changed it optimistically
        this.revertWalletHistoryEdit(editTargetTxId, originalMsgState.history);
        this.appendChatModal();
      }
    } finally {
      this.sendButton.disabled = false; // Re-enable the button
    }
  }

  /**
   * Cancel editing mode without sending: clears hidden edit txid and restores UI state
   */
  cancelEdit() {
    try {
      const editInput = document.getElementById('editOfTxId');
      if (editInput) editInput.value = '';
      // Clear input text and reset height
      this.messageInput.value = '';
      this.messageInput.style.height = '48px';
      this.messageByteCounter.style.display = 'none';
      // Clear any saved draft
      if (typeof this.debouncedSaveDraft === 'function') {
        this.debouncedSaveDraft('');
      }
      // Hide cancel button
      this.cancelEditButton.style.display = 'none';
      // Toggle button visibility (should show microphone when empty)
      this.toggleSendButtonVisibility();
      // Re-enable attachments on cancel
      this.addAttachmentButton.disabled = false;
      // Give feedback
      showToast('Edit cancelled', 1500, 'info');
    } catch (e) {
      console.error('Failed to cancel edit', e);
    }
  }

  /**
   * Revert wallet history memo/edited fields for a given txid using the provided originalHistory snapshot
   * @param {string} txid - Transaction id to locate in myData.wallet.history
   * @param {{memo?: string, edited?: number, edited_timestamp?: number}} originalHistory - Original values to restore
   */
  revertWalletHistoryEdit(txid, originalHistory) {
    try {
      if (!originalHistory) return; // nothing captured, nothing to revert
      if (!(myData?.wallet?.history) || !Array.isArray(myData.wallet.history)) return;
      const hIdx = myData.wallet.history.findIndex((h) => h.txid === txid);
      if (hIdx === -1) return;

      if (typeof originalHistory.memo !== 'undefined') {
        myData.wallet.history[hIdx].memo = originalHistory.memo;
      } else {
        delete myData.wallet.history[hIdx].memo;
      }
      if (typeof originalHistory.edited !== 'undefined') {
        myData.wallet.history[hIdx].edited = originalHistory.edited;
      } else {
        delete myData.wallet.history[hIdx].edited;
      }
      if (typeof originalHistory.edited_timestamp !== 'undefined') {
        myData.wallet.history[hIdx].edited_timestamp = originalHistory.edited_timestamp;
      } else {
        delete myData.wallet.history[hIdx].edited_timestamp;
      }
    } catch (e) {
      console.error('Failed to revert wallet history edit', e);
    }
  }

  /**
   * Create a chat message object
   * @param {string} to - The address of the recipient
   * @param {string} payload - The payload of the message
   * @param {number} toll - The toll of the message
   * @param {Object} keys - The keys of the sender
   * @returns {Object} The chat message object
   */
  async createChatMessage(to, payload, tollInLib, keys) {
    const toAddr = longAddress(to);
    const fromAddr = longAddress(keys.address);
    await getNetworkParams();
    const tx = {
      type: 'message',
      from: fromAddr,
      to: toAddr,
      amount: tollInLib,
      chatId: hashBytes([fromAddr, toAddr].sort().join('')),
      message: 'x',
      xmessage: payload,
      timestamp: getCorrectedTimestamp(),
      fee: getTransactionFeeWei(), // This is not used by the backend
      networkId: network.netid,
    };
    return tx;
  }

  /**
   * Appends the chat modal to the DOM
   * @param {boolean} highlightNewMessage - Whether to highlight the newest message
   * @param {boolean} skipAutoScroll - Whether to skip auto-scrolling to bottom (used when scrolling to a specific message)
   * @returns {void}
   */
  appendChatModal(highlightNewMessage = false, skipAutoScroll = false) {
    const currentAddress = this.address; // Use a local constant
    if (!currentAddress) {
      return;
    }

    const contact = myData.contacts[currentAddress];
    if (!contact || !contact.messages) {
      console.warn('No contact or messages found for address:', this.address);
      return;
    }
    const messages = contact.messages; // Already sorted descending
    // Last time user previously had this chat open (used to mark newly edited messages)
    const lastReadTs = contact.lastChatOpenTs || 0;

    if (!this.modal) return;
    if (!this.messagesList) return;

    // --- 1. Identify the actual newest received message data item ---
    // Since messages are sorted descending (newest first), the first item with my: false is the newest received.
    const newestReceivedItem = messages.find((item) => !item.my);
    this.newestReceivedMessage = newestReceivedItem;
    this.newestSentMessage = messages.find((item) => item.my);

    // 2. Clear the entire list
    this.messagesList.innerHTML = '';

    // 3. Iterate backwards through messages (oldest to newest for rendering order)
    // messages are already sorted descending (newest first) in myData
    for (let i = messages.length - 1; i >= 0; i--) {
      const item = messages[i];
      let messageHTML = '';
      const timeString = formatTime(item.timestamp);
      // Use a consistent timestamp attribute for potential future use (e.g., message jumping)
      const timestampAttribute = `data-message-timestamp="${item.timestamp}"`;
      // Add txid attribute if available
      const txidAttribute = item?.txid ? `data-txid="${item.txid}"` : '';
      const statusAttribute = item?.status ? `data-status="${item.status}"` : '';

      // Check if it's a payment based on the presence of the amount property (BigInt)
      if (typeof item.amount === 'bigint') {
        // Define common payment variables
        const itemAmount = item.amount;
        const itemMemo = item.message; // Memo is stored in the 'message' field for transfers

        // Assuming LIB (18 decimals) for now. TODO: Handle different asset decimals if needed.
        // Format amount correctly using big2str
        const amountStr = big2str(itemAmount, 18);
        const amountNum = parseFloat(amountStr);
        const amountDisplay = `${amountNum.toFixed(6)} ${item.symbol || 'LIB'}`;

        // Check item.my for sent/received

        //console.log(`debug item: ${JSON.stringify(item, (key, value) => typeof value === 'bigint' ? big2str(value, 18) : value)}`)
        // --- Render Payment Transaction ---
        const directionText = item.my ? '-' : '+';
        const messageClass = item.my ? 'sent' : 'received';
    const showEditedDot = !item.my && item.edited && item.edited_timestamp && item.edited_timestamp > lastReadTs && !item.deleted;
    messageHTML = `
          <div class="message ${messageClass} payment-info" ${timestampAttribute} ${txidAttribute} ${statusAttribute}>
            <div class="payment-header">
              <span class="payment-direction">${directionText}</span>
              <span class="payment-amount">${amountDisplay}</span>
            </div>
            ${itemMemo ? `<div class="payment-memo">${linkifyUrls(itemMemo)}</div>` : ''}
            <div class="message-time">${timeString}${item.edited ? ' <span class="message-edited-label">edited</span>' : ''}${showEditedDot ? ' <span class="edited-new-dot" title="Edited since last read"></span>' : ''}</div>
          </div>
        `;
      } else {
        // --- Render Chat Message ---
        const messageClass = item.my ? 'sent' : 'received'; // Use item.my directly
        
        // Initialize replyHTML at this scope so it's always defined
        let replyHTML = '';
        
        // Check if message was deleted
        if (item?.deleted > 0) {
          // Render deleted message with special styling
          messageHTML = `
                    <div class="message ${messageClass} deleted-message" ${timestampAttribute} ${txidAttribute} ${statusAttribute}>
                        <div class="message-content deleted-content">${item.message}</div>
                        <div class="message-time">${timeString}</div>
                    </div>
                `;
        } else {
          // --- Render Reply Quote if present ---
          if (item.replyId) {
              const replyText = escapeHtml(item.replyMessage || 'View original message');
              // Determine owner label: "You" if the referenced message is ours, else contact name
              const ownerIsMineHint = item.replyOwnerIsMine;
              const hasHint = typeof ownerIsMineHint !== 'undefined';
              let isOwnerMine = false;
              if (hasHint) {
                // Use both item.my and replyOwnerIsMine to determine from current viewer's perspective
                // item.my: true if reply is from current user (viewer's perspective)
                // replyOwnerIsMine: true if original message was from sender's perspective
                // If they match (both true or both false), original message is from current user's perspective
                const isSelfReply = ownerIsMineHint === true || ownerIsMineHint === '1';
                isOwnerMine = item.my === isSelfReply;
              } else {
                const targetMsg = contact.messages?.find((m) => m.txid === item.replyId);
                isOwnerMine = !!(targetMsg && targetMsg.my);
              }
              const ownerText = isOwnerMine ? 'You' : (getContactDisplayName(contact) || 'Contact');
              const ownerClass = isOwnerMine ? 'reply-owner-me' : 'reply-owner-contact';
              const replyOwnerLabel = `<span class="reply-quote-label ${ownerClass}">${escapeHtml(ownerText)}</span>`;

              replyHTML = `
                <div class="reply-quote ${ownerClass}" data-reply-txid="${escapeHtml(item.replyId)}">
                  ${replyOwnerLabel}
                  <div class="reply-quote-text">${replyText}</div>
                </div>
              `;
          }
          // --- Render Attachments if present ---
          let attachmentsHTML = '';
          if (item.xattach && Array.isArray(item.xattach) && item.xattach.length > 0) {
            attachmentsHTML = item.xattach.map(att => {
              const fileUrl = att.url || '#';
              const fileName = att.name || 'Attachment';
              const fileSize = att.size ? this.formatFileSize(att.size) : '';
              const fileType = att.type ? att.type.split('/').pop().toUpperCase() : '';
              const isImage = att.type && att.type.startsWith('image/');
              const isVideo = att.type && att.type.startsWith('video/');
              const hasThumbnail = isImage || isVideo;
              const fileTypeIcon = this.getFileTypeForIcon(att.type || '', fileName);
              const paddingStyle = hasThumbnail ? 'padding: 5px 5px;' : 'padding: 10px 12px;';
              return `
                <div class="attachment-row" style="display: flex; ${hasThumbnail ? 'flex-direction: column;' : 'align-items: center;'} background: #f5f5f7; border-radius: 12px; ${paddingStyle} margin-bottom: 6px;"
                  data-url="${fileUrl}"
                  data-p-url="${att.pUrl || ''}"
                  data-name="${encodeURIComponent(fileName)}"
                  data-type="${att.type || ''}"
                  data-msg-idx="${i}"
                  ${isImage ? 'data-image-attachment="true"' : ''}
                  ${isVideo ? 'data-video-attachment="true"' : ''}
                >
                  <div class="attachment-icon-container" style="${hasThumbnail ? 'margin-bottom: 10px; flex-direction: column;' : 'margin-right: 14px; flex-shrink: 0;'}">
                    <div class="attachment-icon" data-file-type="${fileTypeIcon}"></div>
                    ${hasThumbnail ? '<div class="attachment-preview-hint">Click for options</div>' : ''}
                  </div>
                  <div style="min-width:0;">
                    <span class="attachment-label" style="font-weight:500;color:#222;font-size:0.7em;display:block;word-wrap:break-word;">
                      ${fileName}
                    </span><br>
                    <span style="font-size: 0.93em; color: #888;">${fileType}${fileType && fileSize ? ' · ' : ''}${fileSize}</span>
                  </div>
                </div>
              `;
            }).join('');
          }
          
          // --- Render message text (if any) ---
          let messageTextHTML = '';
          if (item.message && item.message.trim()) {
            // Check if this is a call message
            if (item.type === 'call') {
              // Determine call timing and whether join should be allowed
              const callTimeMs = Number(item.callTime || 0);
              const callStart = callTimeMs > 0 ? callTimeMs : Number(item.timestamp || item.sent_timestamp || 0);
              const isExpired = this.isCallExpired(callStart);

              if (isExpired) {
                // Over 2 hours since call time: show as plain text without join button
                const theirName = getContactDisplayName(contact);
                const label = item.my ? `You called ${escapeHtml(theirName)}` : `${escapeHtml(theirName)} called you`;
                messageTextHTML = `
                  <div class="call-message">
                    <div class="call-message-text"><i>${label}</i></div>
                  </div>`;
              } else {
                // Build scheduled label if in the future
                const scheduleHTML = this.buildCallScheduleHTML(callTimeMs);
                // Render call message with a left circular phone icon (clickable) and plain text to the right
                // TODO - remove the href and instead have it call a function which will open the URL and at the time of opening it adds the callUrlParam and username
                messageTextHTML = `
                  <div class="call-message">
                    <a href='${item.message}${callUrlParams}"${myAccount.username}"' target="_blank" rel="noopener noreferrer" class="call-message-phone-button" aria-label="Join Video Call">
                      <span class="sr-only">Join Video Call</span>
                    </a>
                    <div>
                      <div class="call-message-text">Join Video Call</div>
                      ${scheduleHTML}
                    </div>
                  </div>`;
              }
            } else {
              // Regular message rendering
              messageTextHTML = `<div class="message-content" style="white-space: pre-wrap; margin-top: ${attachmentsHTML ? '2px' : '0'};">${linkifyUrls(item.message)}</div>`;
            }
          }
          
          // Check for voice message
          if (item.type === 'vm') {
            const duration = this.formatDuration(item.duration);
            // Use audio encryption keys for playback, fall back to message encryption keys if not available
            messageTextHTML = `
              <div class="voice-message" data-url="${item.url || ''}" data-name="voice-message" data-type="audio/webm" data-msg-idx="${i}" data-duration="${item.duration || 0}">
                <div class="voice-message-controls">
                  <div class="voice-message-top-row">
                    <button class="voice-message-play-button" aria-label="Play voice message">
                      <svg viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                    <div class="voice-message-text">Voice message</div>
                    <div class="voice-message-time-display">0:00 / ${duration}</div>
                  </div>
                  <div class="voice-message-bottom-row">
                    <input type="range" class="voice-message-seek" min="0" max="${item.duration || 0}" value="0" step="1" aria-label="Seek voice message">
                    <button class="voice-message-speed-button" aria-label="Toggle playback speed" data-speed="1">1x</button>
                  </div>
                </div>
              </div>`;
          }
          
          const callTimeAttribute = item.type === 'call' && item.callTime ? `data-call-time="${item.callTime}"` : '';
      const showEditedDot = !item.my && item.edited && item.edited_timestamp && item.edited_timestamp > lastReadTs && !item.deleted;
      messageHTML = `
            <div class="message ${messageClass}" ${timestampAttribute} ${txidAttribute} ${statusAttribute} ${callTimeAttribute}>
              ${replyHTML}
              ${attachmentsHTML}
              ${messageTextHTML}
              <div class="message-time">${timeString}${item.edited ? ' <span class="message-edited-label">edited</span>' : ''}${showEditedDot ? ' <span class="edited-new-dot" title="Edited since last read"></span>' : ''}</div>
            </div>
          `;
        }
      }

      // 4. Append the constructed HTML
      // Insert at the end of the list to maintain correct chronological order
      this.messagesList.insertAdjacentHTML('beforeend', messageHTML);
      // The newest received element will be found after the loop completes
    }

    // --- 4.5. Load thumbnails for image attachments (async, non-blocking) ---
    this.loadThumbnailsForAttachments();

    // --- 5. Find the corresponding DOM element after rendering ---
    // This happens inside the setTimeout to ensure elements are in the DOM

    // 6. Delayed Scrolling & Highlighting Logic (after loop)
    setTimeout(() => {
      // Skip auto-scrolling if we're going to scroll to a specific message
      if (skipAutoScroll) return;

      const messageContainer = this.messagesList.parentElement;

      // Find the DOM element for the actual newest received item using its timestamp
      // Only proceed if newestReceivedItem was found and highlightNewMessage is true
      if (newestReceivedItem && highlightNewMessage) {
        const newestReceivedElementDOM = this.messagesList.querySelector(
          `[data-message-timestamp="${newestReceivedItem.timestamp}"]`
        );

        if (newestReceivedElementDOM) {
          // Focus the modal first
          this.modal.focus();
          
          if (messageContainer) {
            // Calculate the scroll position manually
            const elementTop = newestReceivedElementDOM.offsetTop;
            const containerHeight = messageContainer.clientHeight;
            const scrollTop = elementTop - (containerHeight / 2); // Center the element
            
            // Scroll to the calculated position
            messageContainer.scrollTop = scrollTop;
          }
          
          // Apply highlight immediately
          newestReceivedElementDOM.classList.add('highlighted');

          // Set timeout to remove the highlight after a duration
          setTimeout(() => {
            // Check if element still exists before removing class
            if (newestReceivedElementDOM && newestReceivedElementDOM.parentNode) {
              newestReceivedElementDOM.classList.remove('highlighted');
            }
          }, 3000);
        } else {
          console.warn(
            'appendChatModal: Could not find DOM element for newestReceivedItem with timestamp:',
            newestReceivedItem.timestamp
          );
          // If element not found, just scroll to bottom
          if (messageContainer) {
            messageContainer.scrollTop = messageContainer.scrollHeight;
          }
        }
      } else {
        // No received messages found, not highlighting, or highlightNewMessage is false,
        // just scroll to the bottom if the container exists.
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      }
    }, 300); // <<< Delay of 300 milliseconds for rendering
  }



  /**
   * Refresh the current view based on which screen the user is viewing.
   * Primarily called when a pending transaction fails to remove it from the UI.
   * Updates UI components only for the view that's currently active.
   * @param {string} [txid] - Optional transaction ID that failed and needs removal.
   */
  refreshCurrentView(txid) {
    // contactAddress is kept for potential future use but not needed for this txid-based logic
    const messagesList = this.modal ? this.messagesList : null;

    // 1. Refresh History Modal if active
    if (historyModal.isActive()) {
      historyModal.refresh();
    }
    // 2. Refresh Chat Modal if active AND the failed txid's message is currently rendered
    if (this.isActive() && txid && messagesList) {
      // Check if an element with the specific data-txid exists within the message list
      const messageElement = messagesList.querySelector(`[data-txid="${txid}"]`);

      if (messageElement) {
        // If the element exists, the failed message is visible in the open chat. Refresh the modal.
        this.appendChatModal(); // This will redraw the messages based on the updated data (where the failed tx is removed)
      }
    }
    // 3. Refresh Chat List if active
    if (chatsScreen.isActive()) {
      chatsScreen.updateChatList();
    }
    // No other active view to refresh in this context
  }

  /**
   * Saves reply state to a contact object
   * @param {Object} contact - The contact object to save reply state to
   */
  saveReplyState(contact) {
    const replyTxid = this.replyToTxId.value.trim();
    if (replyTxid) {
      contact.draftReplyTxid = replyTxid;
      contact.draftReplyMessage = this.replyToMessage.value.trim();
      contact.draftReplyOwnerIsMine = this.replyOwnerIsMine.value;
    } else {
      this.clearReplyState(contact);
    }
  }

  /**
   * Clears reply state from a contact object
   * @param {Object} contact - The contact object to clear reply state from
   */
  clearReplyState(contact) {
    delete contact.draftReplyTxid;
    delete contact.draftReplyMessage;
    delete contact.draftReplyOwnerIsMine;
  }

  /**
   * Saves attachment state to a contact object
   * @param {Object} contact - The contact object to save attachment state to
   */
  saveAttachmentState(contact) {
    if (this.fileAttachments && this.fileAttachments.length > 0) {
      contact.draftAttachments = JSON.parse(JSON.stringify(this.fileAttachments));
    } else {
      this.clearAttachmentState(contact);
    }
  }

  /**
   * Clears attachment state from a contact object
   * @param {Object} contact - The contact object to clear attachment state from
   */
  clearAttachmentState(contact) {
    delete contact.draftAttachments;
  }

  /**
   * Saves a draft message for the current contact
   * @param {string} text - The draft message text to save
   */
  saveDraft(text) {
    if (this.address && myData.contacts[this.address]) {
      // Sanitize the text before saving
      const sanitizedText = escapeHtml(text);
      myData.contacts[this.address].draft = sanitizedText;
      
      // Save or clear reply state
      this.saveReplyState(myData.contacts[this.address]);
      
      // Save or clear attachment state
      this.saveAttachmentState(myData.contacts[this.address]);
    }
  }

  /**
   * Loads a draft message for the current contact if one exists
   */
  loadDraft(address) {
    // Always clear the input first
    this.messageInput.value = '';
    this.messageInput.style.height = '48px';
    
    // Clear any existing reply state
    this.cancelReply();
    
    // Clear any existing attachments
    this.fileAttachments = [];
    this.showAttachmentPreview();

    // Load draft if exists
    const contact = myData.contacts[address];
    if (contact?.draft) {
      this.messageInput.value = contact.draft;
      // Trigger resize
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
      // trigger input event to update the byte counter
      this.messageInput.dispatchEvent(new Event('input'));
    }
    this.toggleSendButtonVisibility();
    
    // Restore reply state if it exists
    if (contact?.draftReplyTxid) {
      this.replyToTxId.value = contact.draftReplyTxid;
      this.replyToMessage.value = contact.draftReplyMessage || '';
      this.replyOwnerIsMine.value = contact.draftReplyOwnerIsMine || '';
      
      // Show the reply preview
      if (this.replyPreviewText) {
        this.replyPreviewText.textContent = contact.draftReplyMessage || '';
      }
      if (this.replyPreview) {
        this.replyPreview.style.display = '';
      }
    }
    
    // Restore attachment state if it exists
    if (contact?.draftAttachments && Array.isArray(contact.draftAttachments) && contact.draftAttachments.length > 0) {
      this.fileAttachments = JSON.parse(JSON.stringify(contact.draftAttachments));
      this.showAttachmentPreview();
    }
  }

  async reopen() {
    const tempAddress = this.address;
    this.close();
    await this.open(tempAddress);
  }

  /**
   * Validates the size of a message
   * @param {string} text - The message text to validate
   * @returns {Object} - An object containing the validation result
   */
  validateMessageSize(text) {
    const maxBytes = MAX_CHAT_MESSAGE_BYTES;
    const byteSize = new Blob([text]).size;
    return {
      isValid: byteSize <= maxBytes,
      currentBytes: byteSize,
      remainingBytes: maxBytes - byteSize,
      percentage: (byteSize / maxBytes) * 100,
      maxBytes: maxBytes
    };
  }
  
  /**
   * Updates the message byte counter
   * @param {Object} validation - The validation result
   * @returns {void}
   */
  updateMessageByteCounter(validation) {
    // Only show counter when at 90% or higher
    if (validation.percentage >= 90) {
      if (validation.percentage > 100) {
        this.messageByteCounter.style.color = '#dc3545';
        this.messageByteCounter.textContent = `${validation.currentBytes - validation.maxBytes} bytes - over limit`;
        // disable send button
        this.sendButton.disabled = true;
      } else if (validation.percentage >= 90) {
        this.messageByteCounter.style.color = '#ffa726';
        this.messageByteCounter.textContent = `${validation.remainingBytes} bytes - left`;
        if (isOnline) this.sendButton.disabled = false;
      }
      this.messageByteCounter.style.display = 'block';
    } else {
      this.messageByteCounter.style.display = 'none';
      // Only enable if online
      if (isOnline) this.sendButton.disabled = false;
    }
  }

  /**
   * Handles file selection for chat attachments
   * @param {Event} event - The file input change event
   * @returns {Promise<void>}
   */
  async handleFileAttachment(event) {
    const file = event.target.files[0];
    if (!file) {
      return; // No file selected
    }

    // limit to 5 files
    if (this.fileAttachments.length >= 5) {
      showToast('You can only attach up to 5 files.', 0, 'error');
      event.target.value = ''; // Reset file input
      return;
    }

    // File size limit (e.g., 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      showToast('File size too large. Maximum size is 100MB.', 0, 'error');
      event.target.value = ''; // Reset file input
      return;
    }

    let loadingToastId;
    let thumbnailBlob = null;
    
    // Normalize file type (fallback to extension detection for missing MIME types)
    const normalizedType = this.getMimeTypeFromFilename(file.name, file.type);
    
    // Generate thumbnail for images before encryption
    const isImage = normalizedType.startsWith('image/');
    if (isImage) {
      try {
        thumbnailBlob = await thumbnailCache.generateThumbnail(file);
      } catch (error) {
        console.warn('Failed to generate thumbnail for attached image:', error);
      }
    }

    // Generate thumbnail for videos before encryption
    const isVideo = normalizedType.startsWith('video/');
    if (isVideo && !thumbnailBlob) {
      try {
        thumbnailBlob = await thumbnailCache.extractVideoThumbnail(file);
      } catch (error) {
        console.warn('Failed to extract thumbnail for attached video:', error);
      }
    }

    const capturedThumbnailBlob = thumbnailBlob;
    
    try {
      this.isEncrypting = true;
      this.sendButton.disabled = true; // Disable send button during encryption
      this.addAttachmentButton.disabled = true;
      loadingToastId = showToast(`Attaching file...`, 0, 'loading');
      
      // Generate random encryption key for this attachment
      const encKey = generateRandomBytes(32);

      const worker = new Worker('encryption.worker.js', { type: 'module' });
      worker.onmessage = async (e) => {
        this.isEncrypting = false;
        if (e.data.error) {
          hideToast(loadingToastId);
          showToast(e.data.error, 0, 'error');
          
          const messageValidation = this.validateMessageSize(this.messageInput.value);
          this.updateMessageByteCounter(messageValidation); // Re-enable send button if message size is valid
          
          this.addAttachmentButton.disabled = false;
        } else {
          // Encryption successful
          // upload to get url here 

          const bytes = new Uint8Array(e.data.cipherBin);
          const blob = new Blob([bytes], { type: 'application/octet-stream' });

          try {
            // Upload main file
            const attachmentUrl = await this.uploadEncryptedFile(blob, file.name);
            
            // NEW: Encrypt and upload thumbnail ONLY if main file upload succeeded
            let previewUrl = null;
            if (capturedThumbnailBlob) {
              try {
                // Encrypt thumbnail using same random key as main file
                const encryptedThumbnailBlob = await encryptBlob(capturedThumbnailBlob, encKey);
                // Upload encrypted thumbnail
                previewUrl = await this.uploadEncryptedFile(encryptedThumbnailBlob, file.name);
              } catch (error) {
                console.warn('Failed to upload thumbnail:', error);
                // If thumbnail upload fails, delete the successfully uploaded main file
                this.deleteAttachmentsFromServer(attachmentUrl);
                throw error;  // Re-throw to trigger cleanup
              }
            }
            
            this.fileAttachments.push({
              url: attachmentUrl,
              pUrl: previewUrl,
              name: file.name,
              size: file.size,
              type: normalizedType,
              encKey: bin2base64(encKey)
            });
            
            // Cache thumbnail if we generated one - use captured variable
            if (capturedThumbnailBlob && (isImage || isVideo)) {
              thumbnailCache.save(attachmentUrl, capturedThumbnailBlob, file.type).catch(err => {
                console.warn('Failed to cache thumbnail for attached file:', err);
              });
            }
            
            hideToast(loadingToastId);
            this.showAttachmentPreview(file);

            if (this.address && myData.contacts[this.address]) {
              this.saveAttachmentState(myData.contacts[this.address]);
            }
            
            const messageValidation = this.validateMessageSize(this.messageInput.value);
            this.updateMessageByteCounter(messageValidation); // Re-enable send button if message size is valid
            this.toggleSendButtonVisibility();
            
            this.addAttachmentButton.disabled = false;
            showToast(`File "${file.name}" attached successfully`, 2000, 'success');
          } catch (fetchError) {
            // Handle fetch errors (including AbortError) inside the worker callback
            if (fetchError.name === 'AbortError') {
              hideToast(loadingToastId);
            } else {
              hideToast(loadingToastId);
              showToast(`Upload failed: ${fetchError.message}`, 0, 'error');
            }
            
            const messageValidation = this.validateMessageSize(this.messageInput.value);
            this.updateMessageByteCounter(messageValidation); // Re-enable send button if message size is valid
            
            this.addAttachmentButton.disabled = false;
            this.isEncrypting = false;
          }
        }
        worker.terminate();
      };

      worker.onerror = (err) => {
        hideToast(loadingToastId);
        showToast(`File encryption failed: ${err.message}`, 0, 'error');
        this.isEncrypting = false;
        
        const messageValidation = this.validateMessageSize(this.messageInput.value);
        this.updateMessageByteCounter(messageValidation); // Re-enable send button if message size is valid
        
        this.addAttachmentButton.disabled = false;
        worker.terminate();
      };
      
      // read the file and send it to the worker for encryption
      const reader = new FileReader();
      reader.onload = async (e) => {
        worker.postMessage({ fileBuffer: e.target.result, dhkey: encKey }, [e.target.result]);
      };
      reader.readAsArrayBuffer(file);
      
    } catch (error) {
      console.error('Error handling file attachment:', error);
      
      hideToast(loadingToastId);

      if (error.name !== 'AbortError') {
        showToast('Error processing file attachment', 0, 'error');
      }
      
      // Re-enable buttons
      const messageValidation = this.validateMessageSize(this.messageInput.value);
      this.updateMessageByteCounter(messageValidation); // Re-enable send button if message size is valid
      
      this.addAttachmentButton.disabled = false;
      this.isEncrypting = false;
    } finally {
      event.target.value = ''; // Reset the file input value
    }
  }

  /**
   * Upload encrypted file to attachment server
   * @param {Blob} encryptedBlob - The encrypted blob to upload
   * @param {string} fileName - File name for the upload
   * @returns {Promise<string>} File URL
   */
  async uploadEncryptedFile(encryptedBlob, fileName) {
    const form = new FormData();
    form.append('file', encryptedBlob, fileName);

    const uploadUrl = network.attachmentServerUrl;
    const response = await fetch(`${uploadUrl}/post`, {
      method: 'POST',
      body: form,
      signal: this.abortController.signal
    });

    if (!response.ok) {
      throw new Error(`upload failed ${response.status}`);
    }

    const { id } = await response.json();
    if (!id) {
      throw new Error('No file ID returned from upload');
    }

    // Construct and return file URL
    const fileUrl = `${uploadUrl}/get/${id}`;
    return fileUrl;
  }

  /**
   * Shows a preview of the attached file just above the textarea
   * @returns {void}
   */
  showAttachmentPreview() {
    const preview = document.getElementById('attachmentPreview');
    
    if (!this.fileAttachments || this.fileAttachments.length === 0) {
      preview.innerHTML = '';
      preview.style.display = 'none';
      this.toggleSendButtonVisibility();
      return;
    }
  
    const attachmentItems = this.fileAttachments.map((attachment, index) => {
      const fileTypeIcon = this.getFileTypeForIcon(attachment.type || '', attachment.name);
      return `
      <div class="attachment-item">
        <div class="attachment-icon" data-file-type="${fileTypeIcon}"></div>
        <span class="attachment-name">${attachment.name}</span>
        <button class="remove-attachment" data-index="${index}">×</button>
      </div>
    `;
    }).join('');
  
    preview.innerHTML = attachmentItems;
    
    // Add event listeners to remove buttons
    const removeButtons = preview.querySelectorAll('.remove-attachment');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.removeAttachment(index);
      });
    });

    preview.style.display = 'block';
    // Toggle button visibility when attachments are added
    this.toggleSendButtonVisibility();
    // Check if user was at the bottom before showing preview
    const messageContainer = this.messagesContainer;
    const wasAtBottom = messageContainer ? 
      messageContainer.scrollHeight - messageContainer.scrollTop - messageContainer.clientHeight <= 50 : false;
    
    // Only auto-scroll if user was already at the bottom
    if (wasAtBottom) {
      setTimeout(() => {
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      }, 100); // Small delay to ensure the DOM has updated
    }
  }

  /**
   * Best effort delete of files from attachment server
   * @param {string|Array<string>|Array<{url?: string, pUrl?: string}>} urlsOrAttachments - Single URL string, array of URLs, or array of attachment objects with url/pUrl
   * @returns {void}
   */
  deleteAttachmentsFromServer(urlsOrAttachments) {
    if (!urlsOrAttachments) return;
    
    const uploadUrl = network.attachmentServerUrl;
    if (!uploadUrl) return;

    const extractFileId = (url) => {
      if (typeof url !== 'string') return null;
      // Extract ID from URL format: {attachmentServerUrl}/get/{id}
      // Be tolerant of query/hash suffixes.
      const match = url.match(/\/get\/([^/?#]+)(?:[/?#]|$)/);
      return match && match[1] ? match[1] : null;
    };

    const urls = Array.isArray(urlsOrAttachments)
      ? urlsOrAttachments.flatMap((item) => {
          if (typeof item === 'string') return [item];
          if (item && typeof item === 'object') return [item.url, item.pUrl].filter(Boolean);
          return [];
        })
      : [urlsOrAttachments];

    // De-dupe to avoid double-deleting the same id.
    const uniqueUrls = Array.from(new Set(urls.filter(u => typeof u === 'string')));

    uniqueUrls.forEach((url) => {
      const fileId = extractFileId(url);
      if (!fileId) return;

      fetch(`${uploadUrl}/delete/${fileId}`, { method: 'DELETE' }).catch((err) => {
        // Silently ignore errors - best effort delete
        console.warn('Failed to delete attachment from server:', err);
      });
    });
  }

  /**
   * Removes a specific attached file
   * @param {number} index - Index of file to remove
   * @returns {void}
   */
  removeAttachment(index) {
    if (this.fileAttachments && index >= 0 && index < this.fileAttachments.length) {
      const removedFile = this.fileAttachments.splice(index, 1)[0];
      this.showAttachmentPreview(); // Refresh the preview
      showToast(`"${removedFile.name}" removed`, 2000, 'info');

      if (this.address && myData.contacts[this.address]) {
        this.saveAttachmentState(myData.contacts[this.address]);
      }

      // Best effort delete from server
      this.deleteAttachmentsFromServer(removedFile.url);
    }
  }

  /**
   * Triggers file selection using the existing hidden input
   * @returns {void}
   */
  triggerFileSelection() {
    if (this.chatFileInput) {
      this.chatFileInput.click();
    }
  }


  /**
   * Helper function to get the shared DH key for a recipient.
   * @param {string} recipientAddress - The recipient's address.
   * @returns {Promise<{dhkey: Uint8Array, cipherText: Uint8Array}>}
   */
  async getRecipientDhKey(recipientAddress) {
    const ok = await ensureContactKeys(recipientAddress);
    if (!ok) {
      throw new Error('Recipient keys unavailable');
    }
    const recipient = myData.contacts[recipientAddress];
    return dhkeyCombined(myAccount.keys.secret, recipient.public, recipient.pqPublic);
  }

  /**
   * Get MIME type from filename extension with fallback
   * @param {string} filename - The filename
   * @param {string} existingType - Existing MIME type from file.type
   * @returns {string} Normalized MIME type
   */
  getMimeTypeFromFilename(filename, existingType) {
    // If we already have a valid MIME type, use it
    if (existingType && existingType !== '' && existingType !== 'application/octet-stream') {
      return existingType;
    }
    
    // Fallback: detect from file extension
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      // Video formats
      'mov': 'video/quicktime',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      'm4v': 'video/x-m4v',
      '3gp': 'video/3gpp',
      'flv': 'video/x-flv',
      'ogv': 'video/ogg',
      // Image formats
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      // Audio formats
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
    };
    
    return mimeTypes[ext] || existingType || 'application/octet-stream';
  }

  /**
   * Get the file type for icon display
   * @param {string} type - MIME type of the file
   * @param {string} name - Name of the file
   * @returns {string} File type identifier for icon
   */
  getFileTypeForIcon(type, name) {
    if (type && type.startsWith('image/')) return 'image';
    if (type && type.startsWith('audio/')) return 'audio';
    if (type && type.startsWith('video/')) return 'video';
    if ((type === 'application/pdf') || (name && name.toLowerCase().endsWith('.pdf'))) return 'pdf';
    if ((type === 'text/vcard') || (name && name.toLowerCase().endsWith('.vcf'))) return 'contacts';
    if (type && type.startsWith('text/')) return 'text';
    return 'file';
  }

  /**
   * Update an attachment row with a thumbnail image
   * @param {HTMLElement} attachmentRow - The attachment row element
   * @param {Blob} thumbnailBlob - The thumbnail blob to display
   * @returns {boolean} True if update was successful, false otherwise
   */
  updateThumbnailInPlace(attachmentRow, thumbnailBlob) {
    if (!attachmentRow || !attachmentRow.parentNode || !thumbnailBlob) {
      return false;
    }

    const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
    const iconContainer = attachmentRow.querySelector('.attachment-icon-container');
    
    if (iconContainer && iconContainer.parentNode) {
      // Clean up old thumbnail blob URL if it exists
      const oldThumbnailUrl = attachmentRow.dataset.thumbnailUrl;
      if (oldThumbnailUrl) {
        URL.revokeObjectURL(oldThumbnailUrl);
      }
      
      // Replace icon with thumbnail image
      iconContainer.innerHTML = `<img src="${thumbnailUrl}" alt="Thumbnail" class="attachment-thumbnail">`;
      
      // Store blob URL for cleanup
      attachmentRow.dataset.thumbnailUrl = thumbnailUrl;
      return true;
    } else {
      // Element was removed, revoke the blob URL
      URL.revokeObjectURL(thumbnailUrl);
      return false;
    }
  }

  /**
   * Load thumbnails for image and video attachments asynchronously
   * Only loads from local IndexedDB cache - pUrl downloads happen on user action (Preview)
   * @returns {void}
   */
  async loadThumbnailsForAttachments() {
    const thumbnailAttachments = this.messagesList.querySelectorAll(
      '[data-image-attachment="true"], [data-video-attachment="true"]'
    );
    
    for (const attachmentRow of thumbnailAttachments) {
      const url = attachmentRow.dataset.url;
      if (!url || url === '#') continue;

      try {
        const thumbnailBlob = await thumbnailCache.get(url);
        if (thumbnailBlob) {
          this.updateThumbnailInPlace(attachmentRow, thumbnailBlob);
        }
      } catch (error) {
        console.warn('Failed to load thumbnail for', url, error);
      }
    }
  }

  /**
   * Formats file size in bytes to human-readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size string
   */
  formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Determines if a file type can be viewed in a browser
   * @param {string} mimeType - The MIME type of the file
   * @returns {boolean} True if the file type can be viewed in a browser, false otherwise
   */
  isViewableInBrowser(mimeType) {
    if (!mimeType) return false;

    const normalizedMime = mimeType.toLowerCase().trim();

    // Exclude vCard types (VCF). Many servers report vcf as a text/* subtype
    // but vCard files shouldn't be opened inline in the browser here.
    if (normalizedMime.includes('vcard')) return false;

    const viewableTypes = [
      'image/',           // All images
      'text/',            // Text files
      'application/pdf',  // PDFs
      'video/',           // Videos
      'audio/',           // Audio files
      'application/json', // JSON
      'application/xml',  // XML
      'text/xml'          // XML (alternative)
    ];

    return viewableTypes.some(type => normalizedMime.startsWith(type));
  }

  /**
   * Triggers a file download
   * @param {string} blobUrl - The URL of the file to download
   * @param {string} filename - The name of the file to download
   * @returns {void}
   */
  triggerFileDownload(blobUrl, filename) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(`${filename} downloaded`, 3000, 'success');
  }

  /**
   * Decrypts an attachment URL into a Blob using the message encryption metadata.
   * Shared by download (Save) and Preview thumbnail generation.
   * @param {Object} item - message object from myData.contacts[address].messages[idx]
   * @param {HTMLElement} linkEl - element with data-* fields (attachment row or voice message element)
   * @param {string} [urlOverride] - optional URL to fetch instead of linkEl.dataset.url (used for pUrl thumbnails)
   * @returns {Promise<Blob>}
   */
  async decryptAttachmentToBlob(item, linkEl, urlOverride = null) {
    if (!item || !linkEl) throw new Error('Missing item or attachment element');

    // Use urlOverride if provided, otherwise use the main attachment URL
    const mainUrl = linkEl.dataset.url;
    const fetchUrl = urlOverride || mainUrl;
    if (!mainUrl || mainUrl === '#') throw new Error('Missing attachment url');

    const isVoice = item.type === 'vm';
    let dhkey;
    
    // 1) Get encryption key
    if (isVoice) {
      // Voice message: use audio keys from the message item (no encKey for voice messages)
      const selfKey = item.audioSelfKey || item.selfKey;
      const pqEncSharedKey = item.audioPqEncSharedKey || item.pqEncSharedKey;
      
      if (item.my) {
        if (!selfKey) throw new Error('Missing selfKey for decrypt');
        const password = myAccount.keys.secret + myAccount.keys.pqSeed;
        dhkey = hex2bin(decryptData(selfKey, password, true));
      } else {
        if (!pqEncSharedKey) throw new Error('Missing pqEncSharedKey for decrypt');
        const ok = await ensureContactKeys(this.address);
        const senderPublicKey = myData.contacts[this.address]?.public;
        if (!ok || !senderPublicKey) throw new Error(`No public key found for sender ${this.address}`);
        const pqCipher = (typeof pqEncSharedKey === 'string') ? base642bin(pqEncSharedKey) : pqEncSharedKey;
        dhkey = dhkeyCombined(
          myAccount.keys.secret,
          senderPublicKey,
          myAccount.keys.pqSeed,
          pqCipher
        ).dhkey;
      }
    } else {
      // Attachment: look up attachment entry by main url
      const att = Array.isArray(item.xattach) ? item.xattach.find((a) => a?.url === mainUrl) : null;
      if (!att) throw new Error('Attachment entry not found');
      
      // Use encKey if available (new attachments), otherwise fall back to DH-derived keys (migrated/legacy)
      if (att.encKey) {
        dhkey = base642bin(att.encKey);
      } else {
        const selfKey = att.selfKey;
        const pqEncSharedKey = att.pqEncSharedKey;
        
        if (item.my) {
          if (!selfKey) throw new Error('Missing selfKey for decrypt');
          const password = myAccount.keys.secret + myAccount.keys.pqSeed;
          dhkey = hex2bin(decryptData(selfKey, password, true));
        } else {
          if (!pqEncSharedKey) throw new Error('Missing pqEncSharedKey for decrypt');
          const ok = await ensureContactKeys(this.address);
          const senderPublicKey = myData.contacts[this.address]?.public;
          if (!ok || !senderPublicKey) throw new Error(`No public key found for sender ${this.address}`);
          const pqCipher = (typeof pqEncSharedKey === 'string') ? base642bin(pqEncSharedKey) : pqEncSharedKey;
          dhkey = dhkeyCombined(
            myAccount.keys.secret,
            senderPublicKey,
            myAccount.keys.pqSeed,
            pqCipher
          ).dhkey;
        }
      }
    }

    // 2) Download encrypted bytes (use fetchUrl which may be pUrl or main url)
    const res = await fetch(fetchUrl, { signal: this.abortController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cipherBin = new Uint8Array(await res.arrayBuffer());

    // 3) Decrypt
    const cipherB64 = bin2base64(cipherBin);
    const plainB64 = decryptChacha(dhkey, cipherB64);
    if (!plainB64) throw new Error('decryptChacha returned null');
    const clearBin = base642bin(plainB64);

    // 4) Blob - use image/jpeg for thumbnails (urlOverride), otherwise use original type
    const blobType = urlOverride ? 'image/jpeg' : (linkEl.dataset.type || 'application/octet-stream');
    return new Blob([clearBin], { type: blobType });
  }

  /**
   * Handles attachment errors, showing appropriate toast messages.
   * Shows warning for expired files (404/410/403), error for other failures.
   * @param {Error} err - The error that occurred
   * @param {string} defaultErrorMessage - Default error message to show for non-expired errors
   */
  handleAttachmentError(err, defaultErrorMessage = 'Decryption failed.') {
    if (err?.name === 'AbortError') {
      return; // Don't show error for user-initiated cancellations
    }

    // Check if the error is due to file not being available (expired)
    const isFileExpired = err.message && (
      err.message.includes('HTTP 404') ||
      err.message.includes('HTTP 410') ||
      err.message.includes('HTTP 403')
    );

    if (isFileExpired) {
      showToast('File has expired. Please ask that it be resent to you.', 0, 'warning');
    } else {
      showToast(defaultErrorMessage, 0, 'error');
    }
  }

  async handleAttachmentDownload(item, linkEl) {
    let loadingToastId;
    try {
      loadingToastId = showToast(`Decrypting attachment...`, 0, 'loading');
      const blob = await this.decryptAttachmentToBlob(item, linkEl);
      const blobUrl = URL.createObjectURL(blob);
      const filename = decodeURIComponent(linkEl.dataset.name || 'download');

      // Generate and cache thumbnail for images and videos, then update in place
      if (blob.type.startsWith('image/') || blob.type.startsWith('video/')) {
        const attachmentUrl = linkEl.dataset.url;
        const attachmentRow = linkEl.closest('.attachment-row') || 
          linkEl.closest('[data-image-attachment="true"]') ||
          linkEl.closest('[data-video-attachment="true"]');
        
        const thumbnailPromise = blob.type.startsWith('image/')
          ? thumbnailCache.generateThumbnail(blob)
          : thumbnailCache.extractVideoThumbnail(blob);
        
        thumbnailPromise
          .then(thumbnail => thumbnailCache.save(attachmentUrl, thumbnail, blob.type))
          .then(async () => {
            // Update thumbnail in place
            if (attachmentRow) {
              const thumbnailBlob = await thumbnailCache.get(attachmentUrl);
              if (thumbnailBlob) {
                this.updateThumbnailInPlace(attachmentRow, thumbnailBlob);
              }
            }
          })
          .catch(err => {
            console.warn('Failed to generate or cache thumbnail:', err);
          });
      }

      hideToast(loadingToastId);
      if (window.ReactNativeWebView?.postMessage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "DOWNLOAD_ATTACHMENT",
              filename: filename,
              mime: blob.type,
              dataUrl: reader.result,
            })
          );
        };
        reader.readAsDataURL(blob);
      } else {
        // Web browser handling
        const isViewable = this.isViewableInBrowser(blob.type);
        
        try {
          if (isViewable) {
            // Open in new tab and download
            const newTab = window.open(blobUrl, '_blank');
            this.triggerFileDownload(blobUrl, filename);
          } else {
            // Non-viewable files: download only
            this.triggerFileDownload(blobUrl, filename);
          }
        } finally {
          // Clean up blob URL after enough time for downloads/tabs to initialize
          setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        }
      }

    } catch (err) {
      console.error('Attachment decrypt failed:', err);
      
      hideToast(loadingToastId);
      this.handleAttachmentError(err, 'Decryption failed.');
    }
  }

  /**
   * Detects if the keyboard is currently open
   * @returns {boolean} True if keyboard is likely open
   */
  isKeyboardOpen() {
    // Use the tracked state from resize listener for more reliable detection
    return this.isKeyboardVisible;
  }

  /**
   * Lock background and modal-level scrolling so only the messages container can scroll
   */
  lockBackgroundScroll() {
    if (this.scrollLocked) return;
    this.scrollLocked = true;
    try {
      // Prevent page/body scrolling
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      // Prevent modal container from scrolling; keep messages container scrollable
      if (this.modal) {
        this.modal.dataset.prevOverflowY = this.modal.style.overflowY || '';
        this.modal.style.overflowY = 'hidden';
      }
      // Allow vertical pan only within messages container and message input; block elsewhere
      const allowEl = this.messagesContainer;
      this._touchMoveBlocker = (e) => {
        if (!allowEl || (!e.target.closest('.messages-container') && !e.target.closest('.message-input') && !e.target.closest('.form-container'))) {
          e.preventDefault();
        }
      };
      document.addEventListener('touchmove', this._touchMoveBlocker, { passive: false });
    } catch (_) {}
  }

  /**
   * Unlock background and modal-level scrolling after keyboard is hidden
   */
  unlockBackgroundScroll() {
    if (!this.scrollLocked) return;
    this.scrollLocked = false;
    try {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      if (this.modal) {
        this.modal.style.overflowY = this.modal.dataset.prevOverflowY || '';
        delete this.modal.dataset.prevOverflowY;
      }
      if (this._touchMoveBlocker) {
        document.removeEventListener('touchmove', this._touchMoveBlocker, { passive: false });
        this._touchMoveBlocker = null;
      }
    } catch (_) {}
  }

  /**
   * Handles message click events
   * @param {Event} e - Click event
   */
  async handleMessageClick(e) {
    const attachmentRow = e.target.closest('.attachment-row');
    if (attachmentRow) {
      e.preventDefault();
      e.stopPropagation();
      await this.showAttachmentContextMenu(e, attachmentRow);
      return;
    }
    if (e.target.closest('.voice-message-play-button')) return;
    if (e.target.closest('.voice-message-speed-button')) return;
    if (e.target.closest('.voice-message-seek')) return;
    if (e.target.closest('.reply-quote')) return;

    // Check if keyboard is open - if so, don't show context menu
    if (this.isKeyboardOpen()) {
      console.warn('⌨️ Keyboard is open, preventing context menu');
      return;
    }

    if (e.target.tagName === 'A' || e.target.closest('a')) return;
    
    const messageEl = e.target.closest('.message');
    if (!messageEl) return;

    if (messageEl.classList.contains('deleted-message')) return;

    if (messageEl.dataset.status === 'failed') {
      const isPayment = messageEl.classList.contains('payment-info');
      if (isPayment) {
        // Open main context menu but configure for failed payment
        this.showMessageContextMenu(e, messageEl);
        return;
      }
      return failedMessageMenu.open(e, messageEl);
    }

    this.showMessageContextMenu(e, messageEl);
  }

  /**
   * Shows context menu for a message
   * @param {Event} e - Click event
   * @param {HTMLElement} messageEl - The message element clicked
   */
  showMessageContextMenu(e, messageEl) {
    e.preventDefault();
    e.stopPropagation();

    // Do not open context menu when clicking on reply quote
    if (e.target.closest('.reply-quote')) return;

    // Ensure only one context menu is open at a time
    this.closeAllContextMenus();
    
    this.currentContextMessage = messageEl;
    
    // Show/hide "Delete for all" option based on whether the message is from the current user
    const deleteForAllOption = this.contextMenu.querySelector('[data-action="delete-for-all"]');
    if (deleteForAllOption) {
      const canDeleteForAll = this.canDeleteMessageForAll(messageEl);
      deleteForAllOption.style.display = canDeleteForAll ? 'flex' : 'none';
    }

    // If this is a call message, show call-specific options and hide copy
    const isCall = !!messageEl.querySelector('.call-message');
    const isVoice = !!messageEl.querySelector('.voice-message');
    const copyOption = this.contextMenu.querySelector('[data-action="copy"]');
    const joinOption = this.contextMenu.querySelector('[data-action="join"]');
    const inviteOption = this.contextMenu.querySelector('[data-action="call-invite"]');
    const replyOption = this.contextMenu.querySelector('[data-action="reply"]');
    const editResendOption = this.contextMenu.querySelector('[data-action="edit-resend"]');
    const editOption = this.contextMenu.querySelector('[data-action="edit"]');
    const saveOption = this.contextMenu.querySelector('[data-action="save"]');
    const isFailedPayment = messageEl.dataset.status === 'failed' && messageEl.classList.contains('payment-info');
    // Show save option only for voice messages
    if (saveOption) saveOption.style.display = isVoice ? 'flex' : 'none';
    // For failed payment messages, hide copy and delete-for-all regardless of sender
    if (isFailedPayment) {
      if (copyOption) copyOption.style.display = 'none';
      if (deleteForAllOption) deleteForAllOption.style.display = 'none';
    }
    if (isCall) {
      if (copyOption) copyOption.style.display = 'none';
      // Determine if join is allowed (not future, not expired > 2h)
      const callTimeAttr = Number(messageEl.getAttribute('data-call-time') || 0);
      const msgTs = Number(messageEl.dataset.messageTimestamp || 0);
      const callStart = callTimeAttr > 0 ? callTimeAttr : msgTs;
      const isExpired = this.isCallExpired(callStart);
      const isFuture = callTimeAttr > 0 ? this.isFutureCall(callTimeAttr) : false;
      const allowJoin = !isFuture && !isExpired;
      if (joinOption) joinOption.style.display = allowJoin ? 'flex' : 'none';
      if (inviteOption) inviteOption.style.display = isExpired ? 'none' : 'flex';
      if (editResendOption) editResendOption.style.display = 'none';
      if (editOption) editOption.style.display = 'none';
      if (replyOption) replyOption.style.display = isFuture ? 'flex' : 'none';
    } else if (isVoice) {
      if (copyOption) copyOption.style.display = 'none';
      if (inviteOption) inviteOption.style.display = 'none';
      if (joinOption) joinOption.style.display = 'none';
      if (replyOption) replyOption.style.display = 'flex';
      if (editOption) editOption.style.display = 'none';
    } else {
      if (copyOption) copyOption.style.display = 'flex';
      if (joinOption) joinOption.style.display = 'none';
      if (inviteOption) inviteOption.style.display = 'none';
      if (replyOption) replyOption.style.display = 'flex';
      if (editResendOption) editResendOption.style.display = isFailedPayment ? 'flex' : 'none';
      // Determine if edit should be shown
      if (editOption) {
        // Conditions: own plain message OR own payment with memo text, not deleted/failed/voice, within 15 minutes
        const isMine = messageEl.classList.contains('sent');
        const createdTs = parseInt(messageEl.dataset.messageTimestamp || messageEl.dataset.timestamp || '0', 10);
        const ageOk = createdTs && (Date.now() - createdTs) < EDIT_WINDOW_MS;
        const isDeleted = messageEl.classList.contains('deleted-message');
        const isPayment = messageEl.classList.contains('payment-info');
        const hasMemo = !!messageEl.querySelector('.payment-memo');
        const isVoice = !!messageEl.querySelector('.voice-message');
        const allowedType = !isPayment || (isPayment && hasMemo);
        const show = isMine && !isDeleted && allowedType && !isVoice && !isFailedPayment && ageOk;
        editOption.style.display = show ? 'flex' : 'none';
      }
    }
    
    // Hide copy and edit for attachment/payment without text content
    const hasTextContent = messageEl.querySelector('.message-content')?.textContent.trim() || 
                           messageEl.querySelector('.payment-memo')?.textContent.trim();
    if ((messageEl.querySelector('.attachment-row') || messageEl.classList.contains('payment-info')) && !hasTextContent) {
      if (copyOption) copyOption.style.display = 'none';
      if (editOption) editOption.style.display = 'none';
    }
    
    this.positionContextMenu(this.contextMenu, messageEl);
    this.contextMenu.style.display = 'block';
  }

  /**
   * Utility function to position context menus based on available space
   * @param {HTMLElement} menu - The context menu element
   * @param {HTMLElement} messageEl - The message element to position relative to
   */
  positionContextMenu(menu, messageEl) {
    if (!menu || !messageEl) return;

    const rect = messageEl.getBoundingClientRect();
    const container = messageEl.closest('.messages-container');
    const containerRect = container?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };

    const margin = 10;
    const wasHidden = window.getComputedStyle(menu).display === 'none';
    const prevDisplay = menu.style.display;
    const prevVisibility = menu.style.visibility;

    // Temporarily render hidden so we can measure the real size after option toggles.
    if (wasHidden) {
      menu.style.visibility = 'hidden';
      menu.style.display = 'block';
    }

    let menuRect = menu.getBoundingClientRect();
    let menuWidth = menuRect.width || 200;
    let menuHeight = menuRect.height || 100;

    // Keep long menus usable in small viewports by making them internally scrollable.
    const availableHeight = Math.max(80, containerRect.bottom - containerRect.top - margin * 2);
    if (menuHeight > availableHeight) {
      menu.style.maxHeight = `${Math.floor(availableHeight)}px`;
      menu.style.overflowY = 'auto';
      menuRect = menu.getBoundingClientRect();
      menuWidth = menuRect.width || menuWidth;
      menuHeight = menuRect.height || availableHeight;
    } else {
      menu.style.maxHeight = '';
      menu.style.overflowY = '';
    }

    // Center horizontally, then clamp to container bounds.
    const minLeft = containerRect.left + margin;
    const maxLeft = containerRect.right - menuWidth - margin;
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    left = maxLeft < minLeft ? minLeft : Math.max(minLeft, Math.min(maxLeft, left));

    // Prefer below, otherwise above; finally clamp to bounds.
    const minTop = containerRect.top + margin;
    const maxTop = containerRect.bottom - menuHeight - margin;
    const belowTop = rect.bottom + margin;
    const aboveTop = rect.top - menuHeight - margin;
    let top;

    if (belowTop <= maxTop) {
      top = belowTop;
    } else if (aboveTop >= minTop) {
      top = aboveTop;
    } else {
      top = Math.max(minTop, Math.min(maxTop, belowTop));
    }

    Object.assign(menu.style, {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`
    });

    if (wasHidden) {
      menu.style.display = prevDisplay;
      menu.style.visibility = prevVisibility;
    }
  }

  /**
   * Closes the context menu
   */
  closeContextMenu() {
    if (!this.contextMenu) return;
    this.contextMenu.style.display = 'none';
    this.currentContextMessage = null;
  }

  closeAllContextMenus() {
    this.closeContextMenu();
    this.closeImageAttachmentContextMenu();
    this.closeAttachmentOptionsContextMenu();
    this.closeHeaderContextMenu();
  }

  /**
   * Shows the header context menu
   * @param {Event} e - Click event
   */
  showHeaderContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    // Ensure only one context menu is open at a time
    this.closeAllContextMenus();

    if (!this.headerContextMenu || !this.headerMenuButton) return;

    const buttonRect = this.headerMenuButton.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 150; // Approximate height for 3 options

    // Position menu below and aligned to the right of the button
    let left = buttonRect.right - menuWidth;
    let top = buttonRect.bottom + 8;

    // Adjust if menu would go off screen
    if (left < 10) {
      left = 10;
    }
    if (top + menuHeight > window.innerHeight - 10) {
      top = buttonRect.top - menuHeight - 8;
    }

    Object.assign(this.headerContextMenu.style, {
      left: `${left}px`,
      top: `${top}px`,
      display: 'block'
    });
  }

  /**
   * Closes the header context menu
   */
  closeHeaderContextMenu() {
    if (!this.headerContextMenu) return;
    this.headerContextMenu.style.display = 'none';
  }

  /**
   * Handles header context menu actions
   * @param {string} action - The action to perform
   */
  handleHeaderContextMenuAction(action) {
    this.closeHeaderContextMenu();
    this.pauseVoiceMessages();

    const contact = myData.contacts[this.address];
    if (!contact) return;

    switch (action) {
      case 'call':
        this.handleCallUser();
        break;
      case 'info':
        contactInfoModal.open(createDisplayInfo(contact));
        break;
      case 'pay':
        const payOption = this.headerContextMenu.querySelector('[data-action="pay"]');
        const username = payOption?.dataset.username || contact.username || this.address;
        sendAssetFormModal.username = username;
        sendAssetFormModal.open();
        break;
    }
  }

  /**
   * Returns whether "Delete for all" should be available for a given message element.
   * Mirrors the gating used in the message context menu.
   * @param {HTMLElement} messageEl
   * @returns {boolean}
   */
  canDeleteMessageForAll(messageEl) {
    const isMine = !!messageEl?.classList?.contains('sent');
    return isMine && myData.contacts[this.address]?.tollRequiredToSend == 0;
  }

  /**
   * Removes cached thumbnails for any image attachments in an xattach array.
   * Safe to call even if thumbnails don't exist.
   * @param {any} xattach
   */
  purgeThumbnail(xattach) {
    if (!Array.isArray(xattach) || !xattach.length) return;
    for (const att of xattach) {
      const url = att?.url;
      const type = att?.type || '';
      if (!url || url === '#') continue;
      if (typeof type === 'string' && type.startsWith('image/')) {
        // Fire-and-forget; deletion errors shouldn't block UI actions
        void thumbnailCache.delete(url).catch((e) => console.warn('Failed to delete thumbnail:', e));
      }
    }
  }

  /**
   * Resolve common attachment context fields from an attachment row.
   * @param {HTMLElement} attachmentRow
   * @returns {{ attachmentRow: HTMLElement, messageEl: HTMLElement | null, idx: number, item: any, url: string }}
   */
  getAttachmentContextFromRow(attachmentRow) {
    const idx = Number(attachmentRow?.dataset?.msgIdx);
    const item = Number.isFinite(idx) ? myData.contacts[this.address]?.messages?.[idx] : null;
    return {
      attachmentRow,
      messageEl: attachmentRow?.closest?.('.message') || null,
      idx,
      item,
      url: attachmentRow?.dataset?.url || ''
    };
  }

  closeImageAttachmentContextMenu() {
    if (!this.imageAttachmentContextMenu) return;
    this.imageAttachmentContextMenu.style.display = 'none';
    this.currentImageAttachmentRow = null;
  }

  /**
   * Shows the attachment options context menu
   * @param {Event} e - The click event
   */
  showAttachmentOptionsContextMenu(e) {
    if (!this.attachmentOptionsContextMenu) return;
    
    this.closeAllContextMenus();
    
    const menu = this.attachmentOptionsContextMenu;
    const buttonRect = this.addAttachmentButton.getBoundingClientRect();

    if (isIOS()) {
      // iOS: Only show "Camera/File" and "Contacts"
      if (this.cameraOpt) this.cameraOpt.style.display = 'none';
      if (this.photoLibraryOpt) this.photoLibraryOpt.style.display = 'none';
      if (this.filesOpt) this.filesOpt.style.display = 'none';
      if (this.cameraFileOpt) this.cameraFileOpt.style.display = '';
      if (this.contactsOpt) this.contactsOpt.style.display = '';
    } else {
      // Non-iOS: Hide "Camera/File", show others
      if (this.cameraFileOpt) this.cameraFileOpt.style.display = 'none';
      
      // Desktop: only show "Camera" + "Files" (hide "Photo Library")
      // Heuristic: devices with a fine pointer + hover are typically desktop/laptop.
      try {
        const isDesktopLike = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (this.photoLibraryOpt) this.photoLibraryOpt.style.display = isDesktopLike ? 'none' : '';
      } catch (_) {
        // ignore
      }
    }
    
    // Show menu first to get its dimensions
    menu.style.display = 'block';
    const menuRect = menu.getBoundingClientRect();
    
    // Position menu above the button by default (since button is at bottom)
    let top = buttonRect.top - menuRect.height - 8;
    
    // If menu would go off top of screen, position it below instead
    if (top < 10) {
      top = buttonRect.bottom + 8;
    }
    
    // Ensure menu doesn't go off left or right of screen
    let left = buttonRect.left;
    if (left + menuRect.width > window.innerWidth - 10) {
      left = window.innerWidth - menuRect.width - 10;
    }
    if (left < 10) {
      left = 10;
    }
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  /**
   * Closes the attachment options context menu
   */
  closeAttachmentOptionsContextMenu() {
    if (!this.attachmentOptionsContextMenu) return;
    this.attachmentOptionsContextMenu.style.display = 'none';
  }

  /**
   * Handles attachment options context menu actions
   * @param {string} action - The action to perform
   */
  handleAttachmentOptionsContextMenuAction(action) {
    this.closeAttachmentOptionsContextMenu();

    // Important: keep this synchronous to preserve the user gesture required by some browsers
    // (notably Android Chrome) to open native file pickers via input.click().
    switch (action) {
      case 'camera':
        if (isIOS()) {
          // iOS: use photo library picker which includes camera option
          if (this.chatPhotoLibraryInput) {
            this.chatPhotoLibraryInput.value = '';
            this.chatPhotoLibraryInput.click();
          }
        } else if (isAndroidLikeMobileUA()) {
          // Android: check/request permission, then open file picker or toast
          void this.handleAndroidCameraAction();
        } else {
          // Desktop: use full camera overlay
          void this.capturePhotoFromCamera();
        }
        break;
      case 'photo-library':
        if (this.chatPhotoLibraryInput) {
          this.chatPhotoLibraryInput.value = '';
          this.chatPhotoLibraryInput.click();
        }
        break;
      case 'files':
        if (this.chatFilesInput) {
          this.chatFilesInput.value = '';
          this.chatFilesInput.click();
        }
        break;
      case 'camera-file':
        // iOS: open file input which includes Camera, Photo Library, and Files options
        if (this.chatFileInput) {
          this.chatFileInput.value = '';
          this.chatFileInput.click();
        }
        break;
      case 'contacts':
        shareContactsModal.open(chatModal.address);
        break;
    }
  }

  /**
   * Handles Android camera action: checks/requests permission, then opens file picker or shows toast
   * @returns {Promise<void>}
   */
  async handleAndroidCameraAction() {
    try {
      let permissionStatus = 'unknown';
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        permissionStatus = result.state;
      }
      
      if (permissionStatus === 'granted') {
        // Already granted - open file picker
        if (this.chatFilesInput) {
          this.chatFilesInput.value = '';
          this.chatFilesInput.click();
        }
        return;
      }
      
      if (permissionStatus === 'denied') {
        // Permission already denied - show toast
        showToast('Camera permission required. Please enable it in your device settings.', 0, 'error');
        return;
      }
      
      // Permission is 'prompt' or 'unknown' - request permission via getUserMedia
      // This will trigger the permission prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Immediately stop the stream (don't show camera)
        stream.getTracks().forEach(track => track.stop());
        // Permission granted - open file picker
        if (this.chatFilesInput) {
          this.chatFilesInput.value = '';
          this.chatFilesInput.click();
        }
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          // User denied permission - show toast
          showToast('Camera permission required. Please enable it in your device settings.', 0, 'error');
        } else {
          showToast('Unable to access camera', 0, 'error');
        }
      }
    } catch (err) {
      console.warn('Camera permission check failed:', err);
    }
  }

  /**
   * Opens a camera overlay, lets the user capture a photo, and attaches it.
   * Cleanup is guaranteed via try/finally so media tracks never leak.
   * @returns {Promise<void>}
   */
  async capturePhotoFromCamera() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      showToast('Camera is not supported on this device.', 0, 'error');
      return;
    }

    if (!this.cameraCaptureOverlay || !this.cameraCaptureDialog || !this.cameraCaptureVideo) {
      showToast('Camera modal elements not found.', 0, 'error');
      return;
    }

    // Prevent opening multiple overlays.
    if (this.cameraCaptureOverlay.style.display !== 'none') return;

    const prevFocusedEl = document.activeElement;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    /** @type {MediaStream|null} */
    let stream = null;
    let done = false;

    const lockPageScroll = () => {
      try {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      } catch (_) {
        // ignore
      }
    };

    const unlockPageScroll = () => {
      try {
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.overflow = prevBodyOverflow;
      } catch (_) {
        // ignore
      }
    };

    const stopStream = () => {
      try {
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch (_) {
        // ignore
      } finally {
        stream = null;
      }
    };

    /** @type {(e: KeyboardEvent) => void} */
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!done) this.cameraCancelButton?.click();
        return;
      }

      // Minimal focus trap: keep Tab within our two buttons.
      if (e.key === 'Tab' && this.cameraCaptureOverlay) {
        const focusables = [this.cameraCancelButton, this.cameraCaptureButton].filter(Boolean);
        if (focusables.length === 0) return;
        const currentIdx = focusables.indexOf(document.activeElement);
        const nextIdx = e.shiftKey
          ? (currentIdx <= 0 ? focusables.length - 1 : currentIdx - 1)
          : (currentIdx >= focusables.length - 1 ? 0 : currentIdx + 1);
        e.preventDefault();
        focusables[nextIdx]?.focus?.();
      }
    };

    /** @type {() => void} */
    const onOverlayClick = () => {
      this.cameraCancelButton?.click();
    };

    const cleanup = () => {
      if (done) return;
      done = true;

      document.removeEventListener('keydown', onKeyDown, true);
      this.cameraCaptureOverlay.removeEventListener('click', onOverlayClick);

      try {
        this.cameraCaptureOverlay.style.display = 'none';
        // Reset dialog styles
        this.cameraCaptureDialog.style.width = '';
        this.cameraCaptureDialog.style.height = '';
        this.cameraCaptureDialog.style.position = '';
        this.cameraCaptureDialog.style.top = '';
        this.cameraCaptureDialog.style.left = '';
        this.cameraCaptureDialog.style.borderRadius = '';
        this.cameraCaptureDialog.style.margin = '';
        this.cameraCaptureOverlay.style.alignItems = '';
        this.cameraCaptureOverlay.style.justifyContent = '';
      } catch (_) {
        // ignore
      }

      stopStream();
      unlockPageScroll();

      try {
        if (prevFocusedEl && typeof prevFocusedEl.focus === 'function') prevFocusedEl.focus();
      } catch (_) {
        // ignore
      }
    };

    // Get container dimensions to match dialog size
    const containerEl = document.querySelector('.container');
    let containerRect = null;
    if (containerEl) {
      containerRect = containerEl.getBoundingClientRect();
    }

    // Size and position dialog to match container if it exists
    if (containerRect) {
      this.cameraCaptureDialog.style.width = `${containerRect.width}px`;
      this.cameraCaptureDialog.style.height = `${containerRect.height}px`;
      this.cameraCaptureDialog.style.maxWidth = 'none';
      this.cameraCaptureDialog.style.maxHeight = 'none';
      this.cameraCaptureDialog.style.position = 'fixed';
      this.cameraCaptureDialog.style.top = `${containerRect.top}px`;
      this.cameraCaptureDialog.style.left = `${containerRect.left}px`;
      this.cameraCaptureDialog.style.borderRadius = '8px';
      this.cameraCaptureDialog.style.margin = '0';
      // Remove flexbox centering from overlay when dialog is positioned
      this.cameraCaptureOverlay.style.alignItems = 'flex-start';
      this.cameraCaptureOverlay.style.justifyContent = 'flex-start';
    }

    // Click outside the dialog cancels.
    this.cameraCaptureOverlay.addEventListener('click', onOverlayClick);
    this.cameraCaptureDialog.addEventListener('click', (e) => e.stopPropagation());

    // Show overlay
    this.cameraCaptureOverlay.style.display = 'flex';
    document.addEventListener('keydown', onKeyDown, true);
    lockPageScroll();
    this.cameraCaptureOverlay.focus();

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      this.cameraCaptureVideo.srcObject = stream;
      
      // Ensure video is properly constrained to dialog size
      // Wait for metadata to ensure video dimensions are available
      await new Promise((resolve) => {
        if (this.cameraCaptureVideo.readyState >= 1) {
          resolve();
        } else {
          this.cameraCaptureVideo.addEventListener('loadedmetadata', resolve, { once: true });
        }
      });
      
      // Explicitly constrain video to dialog bounds
      this.cameraCaptureVideo.style.width = '100%';
      this.cameraCaptureVideo.style.height = '100%';
      this.cameraCaptureVideo.style.maxWidth = '100%';
      this.cameraCaptureVideo.style.maxHeight = '100%';
      
      try {
        await this.cameraCaptureVideo.play();
      } catch (err) {
        // Autoplay restrictions / transient failures: user can still press Capture.
        console.warn('Camera video.play() failed:', err);
      }

      this.cameraCaptureButton.focus();

      const waitForAction = () =>
        new Promise((resolve) => {
          this.cameraCancelButton.addEventListener(
            'click',
            () => resolve({ type: 'cancel' }),
            { once: true }
          );
          this.cameraCaptureButton.addEventListener(
            'click',
            () => resolve({ type: 'capture' }),
            { once: true }
          );
        });

      const action = await waitForAction();
      if (action.type !== 'capture') return;

      // Get the actual displayed size of the video element (what user sees)
      const videoRect = this.cameraCaptureVideo.getBoundingClientRect();
      const displayedWidth = Math.round(videoRect.width);
      const displayedHeight = Math.round(videoRect.height);
      
      // Get the camera's native resolution for aspect ratio calculation
      const nativeWidth = this.cameraCaptureVideo.videoWidth || stream.getVideoTracks?.()?.[0]?.getSettings?.()?.width || 0;
      const nativeHeight = this.cameraCaptureVideo.videoHeight || stream.getVideoTracks?.()?.[0]?.getSettings?.()?.height || 0;
      
      if (!nativeWidth || !nativeHeight || !displayedWidth || !displayedHeight) {
        showToast('Camera not ready yet. Please try again.', 0, 'error');
        return;
      }

      // Calculate the source crop to match what's visible in the preview
      // The video uses object-fit: cover, so we need to calculate the visible portion
      const videoAspect = nativeWidth / nativeHeight;
      const displayAspect = displayedWidth / displayedHeight;
      
      let sourceWidth, sourceHeight, sourceX = 0, sourceY = 0;
      
      if (videoAspect > displayAspect) {
        // Video is wider - crop left/right
        sourceHeight = nativeHeight;
        sourceWidth = nativeHeight * displayAspect;
        sourceX = (nativeWidth - sourceWidth) / 2;
      } else {
        // Video is taller - crop top/bottom
        sourceWidth = nativeWidth;
        sourceHeight = nativeWidth / displayAspect;
        sourceY = (nativeHeight - sourceHeight) / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = displayedWidth;
      canvas.height = displayedHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showToast('Unable to capture photo.', 0, 'error');
        return;
      }

      // Draw the visible portion of the video at the displayed size
      ctx.drawImage(
        this.cameraCaptureVideo,
        sourceX, sourceY, sourceWidth, sourceHeight,  // Source crop
        0, 0, displayedWidth, displayedHeight          // Destination size
      );

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        showToast('Unable to capture photo.', 0, 'error');
        return;
      }

      const fileName = `camera_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // Feed into the existing attachment pipeline. (handleFileAttachment only reads files[0])
      cleanup(); // hide overlay + stop camera before heavy work starts
      await this.handleFileAttachment({ target: { files: [file], value: '' } });
    } catch (err) {
      console.error('Camera capture failed:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        showToast('Camera permission required. Please enable it in your device settings.', 0, 'error');
      } else {
        showToast('Unable to access camera.', 0, 'error');
      }
    } finally {
      cleanup();
    }
  }

  /**
   * Shows context menu for an attachment row.
   * - Images/Videos: "Preview" when no thumbnail exists in IndexedDB; "Save" when it exists
   * - Non-images/videos: always "Save"
   * @param {Event} e
   * @param {HTMLElement} attachmentRow
   */
  async showAttachmentContextMenu(e, attachmentRow) {
    if (!this.imageAttachmentContextMenu || !attachmentRow) return;
    e.preventDefault();
    e.stopPropagation();

    // Close other menus
    this.closeAllContextMenus();

    this.currentImageAttachmentRow = attachmentRow;

    // Toggle delete-for-all visibility similar to regular message context menu gating
    const { messageEl, url } = this.getAttachmentContextFromRow(attachmentRow);

    // Show copy only if parent message has actual message text
    const copyOption = this.imageAttachmentContextMenu.querySelector('[data-action="copy"]');
    if (copyOption) {
      const text = messageEl?.querySelector?.('.message-content')?.textContent?.trim() || '';
      copyOption.style.display = text ? 'flex' : 'none';
    }

    const deleteForAllOption = this.imageAttachmentContextMenu.querySelector('[data-action="delete-for-all"]');
    if (deleteForAllOption) {
      const canDeleteForAll = this.canDeleteMessageForAll(messageEl);
      deleteForAllOption.style.display = canDeleteForAll ? 'flex' : 'none';
    }

    const isImageAttachment = attachmentRow.dataset.imageAttachment === 'true';
    const isVideoAttachment = attachmentRow.dataset.videoAttachment === 'true';
    const hasThumbnailSupport = isImageAttachment || isVideoAttachment;

    // Decide Preview/Save vs Save:
    // - Images/Videos: Show both Preview and Save when no thumbnail exists; Show only Save when it exists
    // - Non-images/videos: always Save (no thumbnail concept)
    let hasThumb = true;
    if (hasThumbnailSupport) {
      hasThumb = false;
      if (url && url !== '#') {
        try {
          const thumb = await thumbnailCache.get(url);
          hasThumb = !!thumb;
        } catch (_) {
          hasThumb = false;
        }
      }
    }

    // Show Preview only for images/videos without a thumbnail; Save is always visible
    const previewOpt = this.imageAttachmentContextMenu.querySelector('[data-action="preview"]');
    if (previewOpt) previewOpt.style.display = (hasThumbnailSupport && !hasThumb) ? '' : 'none';

    // Show Import Contacts option for VCF files
    const importContactsOpt = this.imageAttachmentContextMenu.querySelector('[data-action="import-contacts"]');
    if (importContactsOpt) {
      const fileName = attachmentRow.dataset.name ? decodeURIComponent(attachmentRow.dataset.name) : '';
      const fileType = attachmentRow.dataset.type || '';
      const isVcf = fileType === 'text/vcard' || fileName.toLowerCase().endsWith('.vcf');
      importContactsOpt.style.display = isVcf ? '' : 'none';
    }

    this.positionContextMenu(this.imageAttachmentContextMenu, attachmentRow);
    this.imageAttachmentContextMenu.style.display = 'block';
  }

  handleImageAttachmentContextMenuAction(action) {
    const row = this.currentImageAttachmentRow;
    if (!row) return;

    const { messageEl } = this.getAttachmentContextFromRow(row);
    switch (action) {
      case 'import-contacts':
        void this.openImportContactsModal(row);
        break;
      case 'preview':
        void this.previewMediaAttachment(row);
        break;
      case 'save':
        void this.saveImageAttachment(row);
        break;
      case 'share':
        if (messageEl) shareAttachmentModal.open(messageEl);
        break;
      case 'reply':
        if (messageEl) this.startReplyToMessage(messageEl);
        break;
      case 'copy':
        if (messageEl) void this.copyMessageContent(messageEl);
        break;
      case 'delete':
        if (messageEl) this.deleteMessage(messageEl);
        break;
      case 'delete-for-all':
        if (messageEl) void this.deleteMessageForAll(messageEl);
        break;
    }

    this.closeImageAttachmentContextMenu();
  }

  /**
   * Opens the Import Contacts modal for a VCF attachment
   * @param {HTMLElement} attachmentRow - The attachment row element
   */
  async openImportContactsModal(attachmentRow) {
    const url = attachmentRow.dataset.url;
    const name = attachmentRow.dataset.name ? decodeURIComponent(attachmentRow.dataset.name) : 'contacts.vcf';
    const type = attachmentRow.dataset.type || 'text/vcard';
    const msgIdx = attachmentRow.dataset.msgIdx;

    // Get encryption keys from the message
    const contact = myData.contacts[this.address];
    const message = contact?.messages?.[msgIdx];
    if (!message?.xattach) {
      showToast('Could not find attachment data', 0, 'error');
      return;
    }

    // Find the attachment in xattach array
    const attachment = message.xattach.find(att => att.url === url);
    if (!attachment) {
      showToast('Could not find attachment data', 0, 'error');
      return;
    }

    // Open the import contacts modal with attachment data
    importContactsModal.open({
      url: attachment.url,
      name,
      type,
      pqEncSharedKey: attachment.pqEncSharedKey,
      selfKey: attachment.selfKey,
      my: message.my,
      senderAddress: this.address
    });
  }

  /**
   * Preview a media attachment (image or video): download + decrypt thumbnail from pUrl + cache in IndexedDB.
   * Does NOT trigger full file download - uses the pre-generated thumbnail from server.
   * @param {HTMLElement} attachmentRow
   */
  async previewMediaAttachment(attachmentRow) {
    let loadingToastId;
    try {
      const { item, url } = this.getAttachmentContextFromRow(attachmentRow);
      if (!item || !url || url === '#') return;
      
      // Get pUrl from data attributes
      const pUrl = attachmentRow.dataset.pUrl;
      if (!pUrl) {
        showToast('Preview not available for this attachment', 2000, 'info');
        return;
      }
      
      loadingToastId = showToast(`Loading preview...`, 0, 'loading');
      
      // Decrypt thumbnail using pUrl (reuses same key derivation as main file)
      const thumbnailBlob = await this.decryptAttachmentToBlob(item, attachmentRow, pUrl);
      
      // Cache and display thumbnail
      await thumbnailCache.save(url, thumbnailBlob, 'image/jpeg');
      this.updateThumbnailInPlace(attachmentRow, thumbnailBlob);
      
      hideToast(loadingToastId);
    } catch (err) {
      console.error('Preview failed:', err);
      hideToast(loadingToastId);
      this.handleAttachmentError(err, 'Preview failed.');
    }
  }

  /**
   * Save an image attachment using the existing download/decrypt flow.
   * @param {HTMLElement} attachmentRow
   */
  async saveImageAttachment(attachmentRow) {
    // Reuse normal attachment download flow (decrypt + download)
    const { item } = this.getAttachmentContextFromRow(attachmentRow);
    if (!item) return;

    // Concurent download prevention
    if (this.attachmentDownloadInProgress) return;
    this.attachmentDownloadInProgress = true;
    try {
      await this.handleAttachmentDownload(item, attachmentRow);
    } finally {
      this.attachmentDownloadInProgress = false;
    }
  }

  /**
   * Handles context menu option selection
   * @param {string} action - The action to perform
   */
  handleContextMenuAction(action) {
    const messageEl = this.currentContextMessage;
    if (!messageEl) return;
    
    switch (action) {
      case 'save':
        void this.saveVoiceMessage(messageEl);
        break;
      case 'copy':
        this.copyMessageContent(messageEl);
        break;
      case 'join':
        this.handleJoinCall(messageEl);
        break;
      case 'call-invite':
        this.closeContextMenu();
        callInviteModal.open(messageEl);
        break;
      case 'reply':
        this.startReplyToMessage(messageEl);
        break;
      case 'delete':
        if (messageEl.dataset.status === 'failed' && messageEl.classList.contains('payment-info')) {
          this.deleteFailedPayment(messageEl);
        } else {
          this.deleteMessage(messageEl);
        }
        break;
      case 'delete-for-all':
        this.deleteMessageForAll(messageEl);
        break;
      case 'edit-resend':
        this.handleFailedPaymentEditResend(messageEl);
        break;
      case 'edit':
        this.startEditMessage(messageEl);
        break;
    }
    
    this.closeContextMenu();
  }

  /**
   * Initiates editing of a message: fills input with existing text and stores txid
   * @param {HTMLElement} messageEl
   */
  startEditMessage(messageEl) {
    try {
      this.cancelReply();
      const txid = messageEl.dataset.txid;
      const timestamp = parseInt(messageEl.dataset.messageTimestamp || '0', 10);
      if (!txid) return;
      // Enforce edit window in case UI got out of sync
      if (timestamp && (Date.now() - timestamp) > EDIT_WINDOW_MS) {
        return showToast('Edit window expired', 3000, 'info');
      }

      // One-time toast
      if (!checkFirstTimeTip('editMessageFee')) {
        showToast('Editing a message costs the same transaction fee as sending a new message.', 0, 'info');
        setFirstTimeTipShown('editMessageFee');
      }

      // If this is a payment, edit the memo; else edit plain message content
      const contentEl = messageEl.classList.contains('payment-info')
        ? messageEl.querySelector('.payment-memo')
        : messageEl.querySelector('.message-content');
      if (!contentEl) return;
      const text = contentEl.textContent || '';
      this.messageInput.value = text;
      const editInput = document.getElementById('editOfTxId');
      if (editInput) editInput.value = txid;
      // Show cancel edit button while editing
      this.cancelEditButton.style.display = '';
      // Disable attachments while editing
      this.addAttachmentButton.disabled = true;
      
      // Trigger input event for other listeners (byte counter, etc.)
      this.messageInput.dispatchEvent(new Event('input'));
      
      // Manually resize textarea after browser has updated layout
      // requestAnimationFrame ensures scrollHeight is accurate
      requestAnimationFrame(() => {
        this.messageInput.style.height = '48px';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
      });
      
      // Toggle button visibility to show send button since input has content
      this.toggleSendButtonVisibility();
      // Focus input and move caret to end
      this.messageInput.focus();
      this.messageInput.selectionStart = this.messageInput.selectionEnd = this.messageInput.value.length;
    } catch (err) {
      console.error('startEditMessage error', err);
    }
  }

  /**
   * Starts reply flow: shows preview bar and stores reply metadata
   * @param {HTMLElement} messageEl
   */
  startReplyToMessage(messageEl) {
    if (!messageEl) return;
    const txid = messageEl.dataset.txid;
    if (!txid) {
      return showToast('Cannot reply: missing message id', 2000, 'error');
    }

    const previewText = this.truncateReplyText(this.getMessageTextForReply(messageEl));
    if (!previewText) {
      return showToast('Cannot reply to an empty message', 2000, 'error');
    }

    this.replyToTxId.value = txid;
    this.replyToMessage.value = previewText;
    this.replyOwnerIsMine.value = messageEl.classList.contains('sent') ? '1' : '0';

    if (this.replyPreviewText) this.replyPreviewText.textContent = previewText;
    if (this.replyPreview) this.replyPreview.style.display = '';

    this.debouncedSaveDraft(this.messageInput.value);

    // focus input
    this.messageInput.focus();
    this.messageInput.selectionStart = this.messageInput.selectionEnd = this.messageInput.value.length;
  }

  /**
   * Clears reply state and hides the preview bar
   * Note: Hidden input elements are guaranteed to exist in the DOM
   */
  cancelReply() {
    if (this.replyToTxId) this.replyToTxId.value = '';
    if (this.replyToMessage) this.replyToMessage.value = '';
    if (this.replyOwnerIsMine) this.replyOwnerIsMine.value = '';
    if (this.replyPreview) this.replyPreview.style.display = 'none';
    if (this.replyPreviewText) this.replyPreviewText.textContent = '';

    this.debouncedSaveDraft(this.messageInput.value);
  }

  /**
   * Returns cleaned text for reply preview from a message element
   * @param {HTMLElement} messageEl
   * @returns {string}
   */
  getMessageTextForReply(messageEl) {
    if (!messageEl) return '';
    const voice = messageEl.querySelector('.voice-message');
    if (voice) {
      const ts = parseInt(messageEl.dataset.messageTimestamp || '', 10);
      const tsLabel = Number.isFinite(ts) ? formatTime(ts, true) : '';
      return tsLabel ? `Voice message · ${tsLabel}` : 'Voice message';
    }
    const call = messageEl.querySelector('.call-message-text');
    if (call) {
      const callTimeAttr = Number(messageEl.getAttribute('data-call-time') || 0);
      if (callTimeAttr > 0) {
        const schedDate = new Date(callTimeAttr);
        const dateStr = schedDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = schedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `Call at ${timeStr}, ${dateStr}`;
      }
      const baseText = (call.textContent || '').trim() || 'Call';
      return baseText;
    }
    const isPayment = messageEl.classList.contains('payment-info');
    const paymentMemoEl = messageEl.querySelector('.payment-memo');
    if (isPayment && !paymentMemoEl) {
      const dir = (messageEl.querySelector('.payment-direction')?.textContent || '').trim();
      const amount = (messageEl.querySelector('.payment-amount')?.textContent || '').trim();
      const ts = parseInt(messageEl.dataset.messageTimestamp || '', 10);
      const dateStr = Number.isFinite(ts) ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const timeStr = Number.isFinite(ts) ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      if (dir && amount) {
        if (dateStr && timeStr) return `${dir}${amount} · ${timeStr}, ${dateStr}`;
        return `${dir}${amount}`;
      }
    }
    const memo = messageEl.querySelector('.payment-memo');
    if (memo) return memo.textContent || '';
    const content = messageEl.querySelector('.message-content');
    if (content) return content.textContent || '';
    return messageEl.textContent || '';
  }

  /**
   * Truncates reply text to 40 chars with ellipsis
   * @param {string} text
   * @returns {string}
   */
  truncateReplyText(text) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= 40) return clean;
    return clean.slice(0, 40) + '...';
  }

  /**
   * Handles click on reply preview bar to scroll to the original message
   * @param {Event} e - Click event
   */
  handleReplyPreviewClick(e) {
    // Don't scroll if clicking the close button (it has stopPropagation)
    if (e.target === this.replyPreviewClose || e.target.closest('.reply-preview-close')) {
      return;
    }
    
    const replyTxid = this.replyToTxId?.value?.trim();
    if (replyTxid) {
      e.preventDefault();
      e.stopPropagation();
      this.scrollToMessage(replyTxid);
    }
  }

  /**
   * Scroll to a message by txid and highlight it
   * @param {string} txid
   */
  scrollToMessage(txid) {
    if (!txid || !this.messagesList) return;
    const target = this.messagesList.querySelector(`[data-txid="${txid}"]`);
    if (!target) {
      showToast('Message not found', 2000, 'info');
      return;
    }

    const container = this.messagesContainer;
    if (!container) return;

    requestAnimationFrame(() => {
      const elementTop = target.offsetTop;
      const containerHeight = container.clientHeight;
      const elementHeight = target.offsetHeight;
      const scrollTarget = Math.max(0, elementTop - (containerHeight / 2) + (elementHeight / 2));
      
      container.scrollTo?.({ top: scrollTarget, behavior: 'smooth' }) || (container.scrollTop = scrollTarget);
      target.classList.add('highlighted');
      setTimeout(() => target.classList.remove('highlighted'), 2000);
    });
  }

  /**
   * Deletes a failed payment
   * @param {HTMLElement} messageEl
   */
  deleteFailedPayment(messageEl) {
      const txid = messageEl.dataset.txid;
      if (txid) {
        const currentAddress = this.address;
        removeFailedTx(txid, currentAddress);
        this.appendChatModal();
      }
  }

  /**
   * Prefill Send form for a failed payment to edit and resend
   * @param {HTMLElement} messageEl
   */
  handleFailedPaymentEditResend(messageEl) {
    const txid = messageEl.dataset.txid;
    const address = messageEl?.dataset?.address || this.address;
    const memo = messageEl.querySelector('.payment-memo')?.textContent || '';

    if (!sendAssetFormModal?.modal || !sendAssetFormModal?.retryTxIdInput) return;

    // Open send modal
    sendAssetFormModal.open();

    // Hidden retry txid input (used later to remove original failed tx on successful resend)
    sendAssetFormModal.retryTxIdInput.value = txid || '';

    // Memo
    sendAssetFormModal.memoInput.value = memo || '';

    // Recipient username (best-effort from contacts)
    sendAssetFormModal.usernameInput.value = myData.contacts[address]?.username || '';
    sendAssetFormModal.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Amount from wallet history (BigInt → string)
    const amountBig = myData.wallet.history.find((tx) => tx.txid === txid)?.amount;
    if (typeof amountBig === 'bigint') {
      sendAssetFormModal.amountInput.value = big2str(amountBig, 18);
    }
  }


    /**
   * Copies message content to clipboard
   * @param {HTMLElement} messageEl - The message element
   */
  async copyMessageContent(messageEl) {
    if (messageEl.classList.contains('deleted-message')) {
      return showToast('Cannot copy deleted message', 2000, 'info');
    }

    const isPayment = messageEl.classList.contains('payment-info');
    const selector = isPayment ? '.payment-memo' : '.message-content';
    const contentType = isPayment ? 'Memo' : 'Message';
    const contentEl = messageEl.querySelector(selector);

    if (!contentEl) {
      return showToast(`No ${contentType.toLowerCase()} to copy`, 2000, 'info');
    }

    const textToCopy = contentEl.textContent?.trim();
    if (!textToCopy) {
      return showToast(`${contentType} is empty`, 2000, 'info');
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast(`${contentType} copied to clipboard`, 2000, 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast(`Failed to copy ${contentType.toLowerCase()}`, 0, 'error');
    }
  }

  /**
   * Attempts to join the call represented by the call message element.
   * @param {HTMLElement} messageEl
   */
  handleJoinCall(messageEl) {
    const callUrl = messageEl.querySelector('.call-message a')?.href;
    if (!callUrl) return showToast('Call link not found', 2000, 'error');
    // Gate future scheduled calls (context menu path)
    if (this.gateScheduledCall(messageEl)) {
      this.closeContextMenu();
      return;
    }
    window.open(callUrl+`${callUrlParams}"${myAccount.username}"`, '_blank');
    this.closeContextMenu();
  }

  /**
   * Deletes a message locally (and potentially from network if it's a sent message)
   * @param {HTMLElement} messageEl - The message element to delete
   */
  deleteMessage(messageEl) {
    const { txid, messageTimestamp: timestamp } = messageEl.dataset;
    
    if (!timestamp || !confirm('Delete this message?')) return;
    
    try {
      const contact = myData.contacts[this.address];
      const messageIndex = contact?.messages?.findIndex(msg => 
        msg.timestamp == timestamp || msg.txid === txid
      );
      
      if (messageIndex === -1) return;
      
      const message = contact.messages[messageIndex];
      
      if (message.deleted) {
        return showToast('Message already deleted', 2000, 'info');
      }
      

      if (reactNativeApp.isReactNativeWebView && message.type === 'call') {
        const callTimeNum = Number(message.callTime) || 0;
        if (callTimeNum > 0) {
          reactNativeApp.sendCancelScheduledCall(contact?.username, callTimeNum);
        }
      }

      // Mark as deleted and clear payment info if present
      Object.assign(message, {
        deleted: 1,
        message: "Deleted on this device"
      });
      // Remove payment-specific fields if present
      if (message?.amount) {
        if (message.payment) delete message.payment;
        if (message.memo) message.memo = "Deleted on this device";
        if (message.amount) delete message.amount;
        if (message.symbol) delete message.symbol;
        
        // Update corresponding transaction in wallet history
        const txIndex = myData.wallet.history.findIndex((tx) => tx.txid === message.txid);
        if (txIndex !== -1) {
          Object.assign(myData.wallet.history[txIndex], { deleted: 1, memo: 'Deleted on this device' });
          delete myData.wallet.history[txIndex].amount;
          delete myData.wallet.history[txIndex].symbol;
          delete myData.wallet.history[txIndex].payment;
          delete myData.wallet.history[txIndex].sign;
          delete myData.wallet.history[txIndex].address;
        }
      }
      // Remove cached thumbnails for image attachments, then remove attachments
      this.purgeThumbnail(message.xattach);
      delete message.xattach;
      
      this.appendChatModal();
      showToast('Message deleted', 2000, 'success');
      setTimeout(() => {
        const selector = `[data-message-timestamp="${timestamp}"]`;
        const deletedEl = this.messagesList.querySelector(selector);
        if (deletedEl) {
          deletedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    } catch (error) {
      console.error('Error deleting message:', error);
      showToast('Failed to delete message', 0, 'error');
    }
  }

    /**
   * Deletes a message for all users by sending a delete message transaction
   * @param {HTMLElement} messageEl - The message element to delete for all
   */
  async deleteMessageForAll(messageEl) {
    const { txid, messageTimestamp: timestamp } = messageEl.dataset;
    
    if (!timestamp || !confirm('Delete this message for all participants?')) return;
    
    try {
      // Get the message object from contact.messages
      const contact = myData.contacts[this.address];
      const messageIndex = contact?.messages?.findIndex(msg => 
        msg.timestamp == timestamp || msg.txid === txid
      );
      
      if (messageIndex === -1) return;
      
      const message = contact.messages[messageIndex];
      
      if (message.deleted) {
        return showToast('Message already deleted', 2000, 'info');
      }

      // Check if the message was sent by the current user
      if (!message.my) {
        return showToast('You can only delete your own messages for all', 0, 'error');
      }

      // Create and send a "delete" message
      const keys = myAccount.keys;
      if (!keys) {
        showToast('Keys not found', 0, 'error');
        return;
      }

      const tollInLib = myData.contacts[this.address].tollRequiredToSend == 0 ? 0n : this.toll;

      const sufficientBalance = await validateBalance(tollInLib);
      if (!sufficientBalance) {
        const msg = `Insufficient balance for fee${tollInLib > 0n ? ' and toll' : ''}. Go to the wallet to add more LIB.`;
        showToast(msg, 0, 'error');
        return;
      }

      // Ensure recipient keys are available
      const ok = await ensureContactKeys(this.address);
      const recipientPubKey = myData.contacts[this.address]?.public;
      const pqRecPubKey = myData.contacts[this.address]?.pqPublic;
      if (!ok || !recipientPubKey || !pqRecPubKey) {
        console.warn(`No public/PQ key found for recipient ${this.address}`);
        showToast('Failed to get recipient key', 0, 'error');
        return;
      }

      const {dhkey, cipherText} = dhkeyCombined(keys.secret, recipientPubKey, pqRecPubKey);
      const selfKey = encryptData(bin2hex(dhkey), keys.secret+keys.pqSeed, true);

      // Create delete message payload
      const deleteObj = {
        type: 'delete',
        txid: txid  // ID of the message to delete
      };

      // Encrypt the message
      const encMessage = encryptChacha(dhkey, stringify(deleteObj));

      // Create message payload
      const payload = {
        message: encMessage,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: bin2base64(cipherText),
        selfKey: selfKey,
        sent_timestamp: getCorrectedTimestamp()
      };

      // Prepare and send the delete message transaction
      const deleteMessageObj = await this.createChatMessage(this.address, payload, tollInLib, keys);
      await signObj(deleteMessageObj, keys);
      const deleteTxid = getTxid(deleteMessageObj);

      // Send the delete transaction
      const response = await injectTx(deleteMessageObj, deleteTxid);

      if (!response || !response.result || !response.result.success) {
        console.error('Delete message failed to send', response);
        return showToast('Failed to delete message: ' + (response?.result?.reason || 'Unknown error'), 0, 'error');
      }

      showToast('Delete request sent', 5000, 'loading');
      
      // Best effort delete attachments from server
      if (message.xattach && Array.isArray(message.xattach)) {
        this.deleteAttachmentsFromServer(message.xattach);
      }
      // Also handle voice messages which have url directly
      if (message.url && message.type === 'vm') {
        this.deleteAttachmentsFromServer(message.url);
      }
      
      // Note: We don't do optimistic UI updates for delete-for-all
      // The message will be deleted when we process the delete tx from the network
      
    } catch (error) {
      console.error('Delete for all error:', error);
      showToast('Failed to delete message. Please try again.', 0, 'error');
    }
  }

  /**
   * Formats toll amounts to display text and returns LIB wei and unit for internal use
   * @param {bigint} tollBigInt
   * @param {string} tollUnit
   * @returns {{ text: string, libWei: bigint, unit: string }}
   */
  formatTollDisplay(tollBigInt, tollUnit) {
    const factor = getStabilityFactor();
    const factorValid = Number.isFinite(factor) && factor > 0;
    const safeToll = typeof tollBigInt === 'bigint' ? tollBigInt : 0n;
    const tollFloat = parseFloat(big2str(safeToll, weiDigits));

    const usdValue = tollUnit === 'USD' ? tollFloat : (factorValid ? tollFloat * factor : NaN);
    const libValue = factorValid ? (usdValue / factor) : NaN;

    let text;
    if (isNaN(usdValue) || isNaN(libValue)) {
      text = `${tollFloat.toFixed(6)} USD`;
    } else {
      // text = `${usdValue.toFixed(6)} USD (≈ ${libValue.toFixed(6)} LIB)`;
      // Only show USD in display; LIB calculations kept for potential future use
      text = `${usdValue.toFixed(6)} USD`;
    }

    // Calculate libWei using BigInt arithmetic to preserve precision
    let libWei;
    if (tollUnit === 'USD' && factorValid) {
      // Convert USD wei to LIB wei by dividing by factor using scaled BigInt math
      // libWei = safeToll / factor, but we use: libWei = (safeToll * PRECISION) / scaledFactor
      const PRECISION = 10n ** 18n;
      const scaledFactor = BigInt(Math.round(factor * 1e18));
      libWei = (safeToll * PRECISION) / scaledFactor;
    } else if (tollUnit === 'LIB') {
      libWei = safeToll;
    } else {
      libWei = 0n;
    }

    return { text, libWei };
  }

  /**
   * updateTollAmountUI updates the toll amount UI for a given contact
   * @param {string} address - the address of the contact
   * @returns {void}
   */
  updateTollAmountUI(address) {
    const tollValue = document.getElementById('tollValue');
    const tollLabel = document.getElementById('tollLabel');
    const contact = myData.contacts[address] || {};
    const isOffline = !isOnline;

    // Remove any existing color classes
    tollValue.classList.remove('toll-cost', 'toll-free');

    // If offline and no cached toll, show a clear offline status and exit
    if (isOffline && (contact.toll === undefined || contact.toll === null)) {
      tollLabel.textContent = 'Toll:';
      tollValue.textContent = 'offline';
      this.toll = 0n;
      this.tollUnit = 'LIB';
      return;
    }

    // Format toll display
    const { text: usdString, libWei } = this.formatTollDisplay(
      contact.toll,
      contact.tollUnit
    );

    let display;
    if (contact.tollRequiredToSend == 1) {
      // Toll is required - show as "Toll cost:" with amount in red
      tollLabel.textContent = 'Toll cost:';
      display = usdString;
      // if the value of toll is 0, use toll-free class instead
      if(contact.toll == 0n) {  
        tollValue.classList.add('toll-free');
      } else {
        tollValue.classList.add('toll-cost');
      }
    } else if (contact.tollRequiredToSend == 2) {
      // User is blocked - show as "Toll cost:" with "blocked" in red
      tollLabel.textContent = 'Toll cost:';
      display = 'blocked';
      tollValue.classList.add('toll-cost');
    } else {
      // Toll is free - show as "Toll free:" with amount in green
      tollLabel.textContent = 'Toll free:';
      display = usdString;
      tollValue.classList.add('toll-free');
    }
    tollValue.textContent = display;

    // Store the toll in LIB format for message creation (chat messages expect LIB wei)
    this.toll = typeof libWei === 'bigint' ? libWei : 0n;
    this.tollUnit = contact.tollUnit || 'LIB';
  }

  /**
   * updateTollRequired queries contact object and updates the tollRequiredByMe and tollRequiredByOther fields
   * @param {string} address - the address of the contact
   * @returns {void}
   */
  async updateTollRequired(address) {
    const myAddr = longAddress(myAccount.keys.address);
    const contactAddr = longAddress(address);
    // use `hashBytes([fromAddr, toAddr].sort().join(''))` to get the hash of the sorted addresses and have variable to keep track fromAddr which will be the current users order in the array
    const sortedAddresses = [myAddr, contactAddr].sort();
    const hash = hashBytes(sortedAddresses.join(''));
    const myIndex = sortedAddresses.indexOf(myAddr);
    const toIndex = 1 - myIndex;

    // console.log(`hash: ${hash}`);

    try {
      // query the contact's toll field from the network
      const contactAccountData = await queryNetwork(`/messages/${hash}/toll`);

      if (contactAccountData?.error === 'No account with the given chatId') {
        console.warn(`chatId has not been created yet: ${address}`, contactAccountData.error);
      } else if (contactAccountData?.error) {
        console.error(`Error querying toll required for address: ${address}`, contactAccountData.error);
        return;
      }

      const localContact = myData.contacts[address];
      localContact.tollRequiredToSend = contactAccountData.toll.required[toIndex];
      localContact.tollRequiredToReceive = contactAccountData.toll.required[myIndex];

      if (this.isActive() && this.address === address) {
        this.updateTollAmountUI(address);
      }

      // console.log(`localContact.tollRequiredToSend: ${localContact.tollRequiredToSend}`);
      // console.log(`localContact.tollRequiredToReceive: ${localContact.tollRequiredToReceive}`);
    } catch (error) {
      console.warn(`Error updating contact toll required to send and receive: ${error}`);
    }
  }

  /**
   * Invoked when opening chatModal. In the background, it will query the contact's toll field from the network.
   * If the queried toll value is different from the toll field in localStorage, it will update the toll field in localStorage and update the UI element that displays the toll field value.
   * @param {string} address - the address of the contact
   * @returns {void}
   */
  async updateTollValue(address) {
    // query the contact's toll field from the network
    const contactAccountData = await queryNetwork(`/account/${longAddress(address)}`);
    // If invalid response, do not overwrite cached values
    if (!contactAccountData?.account?.data) {
      console.warn('updateTollValue: no network data available; skipping update');
      return;
    }
    const queriedToll = contactAccountData.account.data.toll; // type bigint
    const queriedTollUnit = contactAccountData.account.data.tollUnit; // type string

    // update the toll value in the UI if the queried toll value is different from the toll value or toll unit in localStorage
    if (myData.contacts[address].toll != queriedToll || myData.contacts[address].tollUnit != queriedTollUnit) {
      myData.contacts[address].toll = queriedToll;
      myData.contacts[address].tollUnit = queriedTollUnit;
      // if correct modal is open for this address, update the toll value
      if (this.isActive() && this.address === address) {
        this.updateTollAmountUI(address);
      }
    } else {
      return;
    }
  }

  /**
   * Opens a lightweight chooser to select calling now or scheduling for later.
   * Returns 0 for immediate call or a corrected future timestamp (ms since epoch) using timeSkew.
   * Returns null if user cancels.
   * @returns {Promise<number|null>}
   */
  async openCallTimeChooser() {
    return new Promise((resolve) => {
      const openChoice = () => {
        callScheduleChoiceModal.open((choice) => {
          if (choice === null) return resolve(null);
          if (choice === 'now') return resolve(0);
          // schedule
          callScheduleDateModal.open((dateTs) => {
            if (dateTs === null) {
              // back to choice
              return openChoice();
            }
            resolve(dateTs);
          });
        });
      };
      openChoice();
    });
  }

  /**
   * Handles the call user action by generating a unique WebRTC Meet URL and sending it as a call message
   * @returns {Promise<void>}
   */
  async handleCallUser() {
    try {
      // Synchronous eligibility based on cached value fetched on ChatModal open
      const contact = myData.contacts[this.address] || {};
      const required = contact.tollRequiredToSend;
      if (required !== 0) {
        const username = contact.username || `${this.address.slice(0, 8)}...${this.address.slice(-6)}`;
        if (required === 2) {
          showToast('You are blocked by this user', 0, 'error');
        } else {
          showToast(
            `You can only call people who have added you as a connection. Ask ${username} to add you as a connection`,
            0,
            'info'
          );
        }
        return;
      }

      const sufficientBalance = await validateBalance(0n);
      if (!sufficientBalance) {
        showToast('Insufficient balance for fee. Go to the wallet to add more LIB.', 0, 'error');
        return;
      }

      // Choose call time: now or scheduled
      const chosenCallTime = await this.openCallTimeChooser();
      if (chosenCallTime === null) {
        // user cancelled
        return;
      }

      // Generate a 256-bit random number and convert to base64
      const randomBytes = generateRandomBytes(32); // 32 bytes = 256 bits
      const randomHex = bin2hex(randomBytes).slice(0, 20);

      // Create the Meet URL
      const callUrl = `https://meet.liberdus.com/${randomHex}`;
      
      // Send a call message to the contact with callTime (0 or future timestamp)
      const success = await this.sendCallMessage(callUrl, chosenCallTime);
      
      if (success) {
        if (chosenCallTime === 0) {
          window.open(callUrl + `${callUrlParams}"${myAccount.username}"`, '_blank');
        } else {
          const when = new Date(chosenCallTime - timeSkew); // convert back to local wall-clock for display
          showToast(`Call scheduled for ${when.toLocaleString()}`, 3000, 'success');
        }
      }
      
    } catch (error) {
      console.error('Error handling call user:', error);
      showToast('Failed to start call. Please try again.', 0, 'error');
    }
  }

  /**
   * Sends a call message with the Meet URL
   * @param {string} meetUrl - The Meet URL to send
   * @returns {Promise<void>}
   */
  async sendCallMessage(meetUrl, callTime = 0) {
    // if user is blocked, don't send message, show toast
    if (myData.contacts[this.address].tollRequiredToSend == 2) {
      showToast('You are blocked by this user', 0, 'error');
      return false;
    }

    try {
      // Get current chat data
      const chatsData = myData;
      const currentAddress = this.address;
      if (!currentAddress) return false;

      // Check if trying to message self
      if (currentAddress === myAccount.address) {
        return false;
      }

      // Get sender's keys from wallet
      const keys = myAccount.keys;
      if (!keys) {
        showToast('Keys not found for sender address', 0, 'error');
        return false;
      }

      // Ensure recipient keys are available
      const ok = await ensureContactKeys(currentAddress);
      const recipientPubKey = myData.contacts[currentAddress]?.public;
      const pqRecPubKey = myData.contacts[currentAddress]?.pqPublic;
      if (!ok || !recipientPubKey || !pqRecPubKey) {
        console.warn(`no public/PQ key found for recipient ${currentAddress}`);
        showToast('Failed to get recipient key', 0, 'error');
        return false;
      }

      const {dhkey, cipherText} = dhkeyCombined(keys.secret, recipientPubKey, pqRecPubKey)
      const selfKey = encryptData(bin2hex(dhkey), keys.secret+keys.pqSeed, true)  // used to decrypt our own message

      // Convert call message to new JSON format
      const normalizedCallTime = Number(callTime) || 0;
      const callObj = {
        type: 'call',
        url: meetUrl,
        // callTime: 0 for immediate, or corrected future timestamp (ms since epoch)
        callTime: normalizedCallTime
      };

      // Encrypt the JSON message using shared secret
      const encMessage = encryptChacha(dhkey, stringify(callObj));

      // Create message payload
      const payload = {
        message: encMessage,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: bin2base64(cipherText),
        selfKey: selfKey,
        sent_timestamp: getCorrectedTimestamp()
      };

      // Always include username, but only include other info if recipient is a friend
      const contact = myData.contacts[currentAddress];
      const senderInfo = {
        username: myAccount.username,
      };

      // Add additional info only if recipient is a connection
      if (contact && contact?.friend && contact?.friend >= 2) {
        senderInfo.name = myData.account.name;
        senderInfo.linkedin = myData.account.linkedin;
        senderInfo.x = myData.account.x;
        // Add avatar info if available
        if (myData.account.avatarId && myData.account.avatarKey) {
          senderInfo.avatarId = myData.account.avatarId;
          senderInfo.avatarKey = myData.account.avatarKey;
        }
        // Add timezone if available
        const tz = getLocalTimeZone();
        if (tz) {
          senderInfo.timezone = tz;
        }
      }

      // Always encrypt and send senderInfo
      payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

      // Create and send the call message transaction
      const tollInLib = myData.contacts[currentAddress].tollRequiredToSend == 0 ? 0n : this.toll;
      const chatMessageObj = await this.createChatMessage(currentAddress, payload, tollInLib, keys);
      // if there's a callobj.calltime is present and is 0 set callType to true to make recipient phone ring
      if (callObj?.callTime === 0) {
        chatMessageObj.callType = true;
      }

      await signObj(chatMessageObj, keys);
      const txid = getTxid(chatMessageObj);

      // Create new message object for local display immediately
      const newMessage = {
        message: meetUrl,
        timestamp: payload.sent_timestamp,
        sent_timestamp: payload.sent_timestamp,
        my: true,
        txid: txid,
        status: 'sent',
        type: 'call',
        callTime: normalizedCallTime
      };
      insertSorted(chatsData.contacts[currentAddress].messages, newMessage, 'timestamp');

      // Update chats list
      const chatUpdate = {
        address: currentAddress,
        timestamp: newMessage.sent_timestamp,
        txid: txid,
      };

      const existingChatIndex = chatsData.chats.findIndex((chat) => chat.address === currentAddress);
      if (existingChatIndex !== -1) {
        chatsData.chats.splice(existingChatIndex, 1);
      }
      insertSorted(chatsData.chats, chatUpdate, 'timestamp');

      // Update the chat modal UI immediately
      this.appendChatModal();

      // Send the message transaction
      const response = await injectTx(chatMessageObj, txid);

      if (!response || !response.result || !response.result.success) {
        console.error('call message failed to send', response);
        updateTransactionStatus(txid, currentAddress, 'failed', 'message');
        this.appendChatModal();
        return false;
      }

      return true;
      
    } catch (error) {
      console.error('Call message error:', error);
      showToast('Failed to send call invitation. Please try again.', 0, 'error');
      return false;
    }
  }

  // ========== Voice Message Methods ==========

  /**
   * Format duration from seconds to mm:ss
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Send voice message transaction
   * @param {string} voiceMessageUrl - URL of the uploaded voice message
   * @param {number} duration - Duration in seconds
   * @param {Uint8Array} audioPqEncSharedKey - Encrypted shared key for audio file
   * @param {string} audioSelfKey - Self key for audio file decryption
   * @returns {Promise<void>}
   */
  async sendVoiceMessageTx(voiceMessageUrl, duration, audioPqEncSharedKey, audioSelfKey, replyInfo = null) {
    // Create voice message object
    const messageObj = {
      type: 'vm',
      url: voiceMessageUrl,
      duration: duration
    };

    // Add reply info if provided
    if (replyInfo && replyInfo.replyId) {
      messageObj.replyId = replyInfo.replyId;
      messageObj.replyMessage = replyInfo.replyMessage || '';
      messageObj.replyOwnerIsMine = replyInfo.replyOwnerIsMine;
    }

    // Ensure recipient keys are available
    const ok = await ensureContactKeys(this.address);
    const recipientPubKey = myData.contacts[this.address]?.public;
    const pqRecPubKey = myData.contacts[this.address]?.pqPublic;
    if (!ok || !recipientPubKey || !pqRecPubKey) {
      throw new Error(`No public/PQ key found for recipient ${this.address}`);
    }

    // Encrypt message object
    const {dhkey, cipherText: messagePqEncSharedKey} = dhkeyCombined(myAccount.keys.secret, recipientPubKey, pqRecPubKey);
    const encMessage = encryptChacha(dhkey, stringify(messageObj));

    // Create payload
    const payload = {
      message: encMessage,
      encrypted: true,
      encryptionMethod: 'xchacha20poly1305',
      pqEncSharedKey: bin2base64(messagePqEncSharedKey),
      selfKey: encryptData(bin2hex(dhkey), myAccount.keys.secret + myAccount.keys.pqSeed, true),
      // Audio file encryption keys (for voice message playback)
      audioPqEncSharedKey: bin2base64(audioPqEncSharedKey),
      audioSelfKey: audioSelfKey,
      sent_timestamp: getCorrectedTimestamp()
    };

    // Add sender info
    const contact = myData.contacts[this.address];
    const senderInfo = {
      username: myAccount.username,
    };

    if (contact && contact?.friend && contact?.friend >= 2) {
      senderInfo.name = myData.account.name;
      senderInfo.linkedin = myData.account.linkedin;
      senderInfo.x = myData.account.x;
      // Add avatar info if available
      if (myData.account.avatarId && myData.account.avatarKey) {
        senderInfo.avatarId = myData.account.avatarId;
        senderInfo.avatarKey = myData.account.avatarKey;
      }
      // Add timezone if available
      const tz = getLocalTimeZone();
      if (tz) {
        senderInfo.timezone = tz;
      }
    }

    payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

    // Calculate toll
    const tollInLib = myData.contacts[this.address].tollRequiredToSend == 0 ? 0n : this.toll;

    // Create and send transaction
    const chatMessageObj = await this.createChatMessage(this.address, payload, tollInLib, myAccount.keys);
    await signObj(chatMessageObj, myAccount.keys);
    const txid = getTxid(chatMessageObj);

    // If retrying a failed message, remove the old failed tx from local stores
    const retryTxId = this.retryOfTxId?.value;
    if (retryTxId) {
      removeFailedTx(retryTxId, this.address);
      this.retryOfTxId.value = '';
    }

    // Optimistic UI update
    const newMessage = {
      message: '', // Voice messages don't have text
      url: voiceMessageUrl,
      duration: duration,
      type: 'vm',
      timestamp: payload.sent_timestamp,
      sent_timestamp: payload.sent_timestamp,
      my: true,
      txid: txid,
      status: 'sent',
      selfKey: audioSelfKey, // Add audio file selfKey for our own message decryption
      pqEncSharedKey: bin2base64(audioPqEncSharedKey) // Add audio file pqEncSharedKey
    };

    // Add reply info to the optimistic message if present
    if (replyInfo && replyInfo.replyId) {
      newMessage.replyId = replyInfo.replyId;
      newMessage.replyMessage = replyInfo.replyMessage || '';
      newMessage.replyOwnerIsMine = replyInfo.replyOwnerIsMine;
    }

    const contact2 = myData.contacts[this.address];
    if (contact2) {
      insertSorted(contact2.messages, newMessage, 'timestamp');
      this.appendChatModal();
      
      // Update chats list
      const existingChatIndex = myData.chats.findIndex((chat) => chat.address === this.address);
      if (existingChatIndex !== -1) {
        myData.chats.splice(existingChatIndex, 1);
      }
      
      const chatUpdate = {
        address: this.address,
        timestamp: newMessage.timestamp,
      };
      
      const insertIndex = myData.chats.findIndex((chat) => chat.timestamp < chatUpdate.timestamp);
      if (insertIndex === -1) {
        myData.chats.push(chatUpdate);
      } else {
        myData.chats.splice(insertIndex, 0, chatUpdate);
      }
    }

    // Send to network (injectTx may either throw OR return { result: { success:false } })
    try {
      const response = await injectTx(chatMessageObj, txid);

      if (!response || !response.result || !response.result.success) {
        console.error('voice message failed to send', response);

        const reason = response?.result?.reason || '';
        if (/toll/i.test(reason)) {
          await this.reopen();
        }

        newMessage.status = 'failed';
        updateTransactionStatus(txid, this.address, 'failed', 'message');
      } else {
        newMessage.status = 'sent';
      }
    } catch (error) {
      console.error('Failed to send voice message to network:', error);
      newMessage.status = 'failed';
      updateTransactionStatus(txid, this.address, 'failed', 'message');
      showToast('Voice message failed to send', 0, 'error');
    }

    this.appendChatModal();
    chatsScreen.updateChatList();
    saveState();
  }

  /**
   * Play voice message
   * @param {HTMLElement} buttonElement - Play button element
   * @returns {Promise<void>}
   */
  async playVoiceMessage(buttonElement) {
    const voiceMessageElement = buttonElement.closest('.voice-message');
    if (!voiceMessageElement) return;
    // Pause only if playing a different voice message
    if (this.playingVoiceMessageElement !== voiceMessageElement) {
      this.pauseVoiceMessages();
    }

    // Check if audio is already playing/paused
    const existingAudio = voiceMessageElement.audioElement;
    
    if (existingAudio) {
      if (existingAudio.paused) {
        // Resume playback
        const existingSeek = buttonElement.closest('.voice-message')?.querySelector('.voice-message-seek');
        if (existingSeek) {
          const desired = Number(existingSeek.value || 0);
          if (!isNaN(desired) && Math.abs(existingAudio.currentTime - desired) > 0.25) {
            try { existingAudio.currentTime = desired; } catch (e) { /* ignore */ }
          }
        }
        existingAudio.play();
        this.setVoiceMessageButton(voiceMessageElement, true);
        this.playingVoiceMessageElement = voiceMessageElement;
      } else {
        // Pause playback
        existingAudio.pause();
        this.setVoiceMessageButton(voiceMessageElement, false);
        this.playingVoiceMessageElement = null;
      }
      return;
    }

    const voiceUrl = voiceMessageElement.dataset.url;
    const msgIdx = voiceMessageElement.dataset.msgIdx;

    if (!voiceUrl) {
      showToast('Voice message URL not found', 0, 'error');
      return;
    }

    try {
      // Check if it's our own message or received message
      const message = myData.contacts[this.address].messages[msgIdx];
      if (!message) {
        throw new Error('Message not found');
      }
      const isMyMessage = message.my;
      
      // Get keys from message item (voice messages use audio-specific keys with fallback)
      const pqEncSharedKey = message.audioPqEncSharedKey || message.pqEncSharedKey;
      const selfKey = message.audioSelfKey || message.selfKey;

      buttonElement.disabled = true;
      
      // Download the encrypted voice message
      const response = await fetch(voiceUrl);
      if (!response.ok) {
        throw new Error(`Failed to download voice message: ${response.status}`);
      }

      const encryptedData = await response.arrayBuffer();
      
      let dhkey;
      if (isMyMessage && selfKey) {
        // For our own messages, decrypt using selfKey
        const password = myAccount.keys.secret + myAccount.keys.pqSeed;
        dhkey = hex2bin(decryptData(selfKey, password, true));
      } else if (pqEncSharedKey) {
        // For received messages, ensure keys are present and use pqEncSharedKey
        const ok = await ensureContactKeys(this.address);
        const senderPublicKey = myData.contacts[this.address]?.public;
        if (!ok || !senderPublicKey) {
          throw new Error(`No public key found for sender ${this.address}`);
        }
        dhkey = dhkeyCombined(myAccount.keys.secret, senderPublicKey, myAccount.keys.pqSeed, base642bin(pqEncSharedKey)).dhkey;
      } else {
        throw new Error('Missing encryption keys for voice message');
      }

      // Decrypt the voice message
      const cipherB64 = bin2base64(new Uint8Array(encryptedData));
      const plainB64 = decryptChacha(dhkey, cipherB64);
      if (!plainB64) {
        throw new Error('decryptChacha returned null');
      }
      const clearBin = base642bin(plainB64);
      
      // Create audio blob and play
      const audioBlob = new Blob([clearBin], { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Store audio element reference for pause/resume functionality
      voiceMessageElement.audioElement = audio;
      voiceMessageElement.audioUrl = audioUrl;
      
      // Set initial playback speed based on button state
      const speedButton = voiceMessageElement.querySelector('.voice-message-speed-button');
      if (speedButton) {
        const speed = parseFloat(speedButton.dataset.speed || '1');
        audio.playbackRate = speed;
      }
      const seekEl = voiceMessageElement.querySelector('.voice-message-seek');
      const timeDisplayElement = voiceMessageElement.querySelector('.voice-message-time-display');
      // Use stored duration from message object
      const totalDurationSeconds = (Number.isFinite(message.duration) && message.duration > 0)
        ? Math.floor(message.duration)
        : 0;
      
      // Set max immediately so slider is seekable before playback
      if (seekEl) seekEl.max = totalDurationSeconds || 0;
      
      // Handle pending seeks (if user moved slider before clicking play)
      audio.addEventListener('loadedmetadata', () => {
        if (voiceMessageElement.pendingSeekTime !== undefined) {
          const pst = voiceMessageElement.pendingSeekTime;
          if (pst >= 0 && pst < totalDurationSeconds) {
            try { audio.currentTime = pst; } catch (e) { /* ignore */ }
          }
          delete voiceMessageElement.pendingSeekTime;
        }
      }, { once: true });
      
      // Update UI to show playing state and enable button for pause functionality
      this.setVoiceMessageButton(voiceMessageElement, true);
      
      // Track this as the currently playing voice message
      this.playingVoiceMessageElement = voiceMessageElement;
      
      // Time & progress tracking
      audio.ontimeupdate = () => {
        if (!voiceMessageElement.isScrubbing) {
          if (seekEl) {
            seekEl.value = Math.floor(audio.currentTime);
          }
          if (timeDisplayElement) {
            const currentTime = this.formatDuration(Math.floor(audio.currentTime));
            const totalTime = this.formatDuration(totalDurationSeconds);
            timeDisplayElement.textContent = `${currentTime} / ${totalTime}`;
          }
        }
      };

      if (seekEl && !voiceMessageElement.seekSetup) {
        // Avoid duplicate listener setup
        voiceMessageElement.seekSetup = true;
        const updateFromSeekValue = (commit) => {
          const newTime = Number(seekEl.value || 0);
          if (audio && !isNaN(newTime)) {
            // If metadata not yet loaded, store pending seek
            if (audio.readyState < 1) { // HAVE_METADATA
              voiceMessageElement.pendingSeekTime = newTime;
            } else if (commit || voiceMessageElement.isScrubbing) {
              // During scrubbing (live) or on commit, set currentTime
              try { audio.currentTime = newTime; } catch (e) { /* ignore */ }
            }
          }
        };
        const startScrub = () => { voiceMessageElement.isScrubbing = true; };
        const endScrub = () => { voiceMessageElement.isScrubbing = false; updateFromSeekValue(true); };
        seekEl.addEventListener('pointerdown', startScrub);
        seekEl.addEventListener('pointerup', endScrub);
        seekEl.addEventListener('touchstart', startScrub, { passive: true });
        seekEl.addEventListener('touchend', endScrub, { passive: true });
        seekEl.addEventListener('mousedown', startScrub);
        seekEl.addEventListener('mouseup', endScrub);
        // Throttle input updates to avoid performance issues
        let lastInputUpdate = 0;
        seekEl.addEventListener('input', () => {
          const now = performance.now();
            if (now - lastInputUpdate > 50) { // ~20fps updates
              lastInputUpdate = now;
              updateFromSeekValue(false);
            }
        });
        seekEl.addEventListener('change', () => updateFromSeekValue(true));
      }
      
      audio.onended = () => {
        this.resetVoiceMessageUI(voiceMessageElement);
        this.cleanupVoiceMessageResources(voiceMessageElement);
        this.playingVoiceMessageElement = null;
      };
      
      audio.onerror = (error) => {
        console.error('Error playing voice message:', error);
        showToast('Error playing voice message', 0, 'error');
        this.resetVoiceMessageUI(voiceMessageElement);
        this.cleanupVoiceMessageResources(voiceMessageElement);
        this.playingVoiceMessageElement = null;
      };
      
      // Start playing
      await audio.play();
      
    } catch (error) {
      console.error('Error playing voice message:', error);
      showToast(`Error playing voice message: ${error.message}`, 0, 'error');
      buttonElement.disabled = false;
    }
  }

  /**
   * Save a voice message by downloading, decrypting, and saving it as a file
   * Reuses the existing attachment download flow
   * @param {HTMLElement} messageEl - The message element containing the voice message
   */
  async saveVoiceMessage(messageEl) {
    const voiceEl = messageEl.querySelector('.voice-message');
    const msgIdx = voiceEl?.dataset?.msgIdx;
    const item = msgIdx !== undefined ? myData.contacts[this.address]?.messages?.[msgIdx] : null;
    
    if (!voiceEl || !item || item.type !== 'vm') {
      showToast('Voice message not found', 2000, 'error');
      return;
    }

    if (this.attachmentDownloadInProgress) return;
    this.attachmentDownloadInProgress = true;

    try {
      // Generate filename with timestamp if not already set
      if (!voiceEl.dataset.name || voiceEl.dataset.name === 'voice-message') {
        const ts = parseInt(messageEl.dataset.messageTimestamp || Date.now(), 10);
        voiceEl.dataset.name = `voice-message-${new Date(ts).toISOString().replace(/[:.]/g, '-').slice(0, -5)}.webm`;
      }
      
      await this.handleAttachmentDownload(item, voiceEl);
    } finally {
      this.attachmentDownloadInProgress = false;
    }
  }

  /**
   * Toggle playback speed between 1x and 2x
   * @param {HTMLElement} speedButton - Speed button element
   * @returns {void}
   */
  togglePlaybackSpeed(speedButton) {
    const voiceMessageElement = speedButton.closest('.voice-message');
    if (!voiceMessageElement) return;

    const currentSpeed = parseFloat(speedButton.dataset.speed || '1');
    const speedOptions = [1, 1.5, 2];
    const currentIndex = speedOptions.indexOf(currentSpeed);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % speedOptions.length;
    const newSpeed = speedOptions[nextIndex];
    
    speedButton.dataset.speed = newSpeed.toString();
    const displaySpeed = Number.isInteger(newSpeed) ? newSpeed.toString() : newSpeed.toFixed(1);
    speedButton.textContent = `${displaySpeed}x`;
    
    // Update button appearance
    if (newSpeed > 1) {
      speedButton.classList.add('active');
    } else {
      speedButton.classList.remove('active');
    }
    
    // Update audio playback speed if audio is playing
    const audio = voiceMessageElement.audioElement;
    if (audio) {
      audio.playbackRate = newSpeed;
    }
  }

  // ---- Call scheduling helpers ----
  isFutureCall(ts) {
    return typeof ts === 'number' && ts > getCorrectedTimestamp();
  }

  // Returns true if more than 2 hours have elapsed since the call started
  // callStart: the effective call start time in ms (either scheduled callTime or message timestamp for immediate calls)
  isCallExpired(callStart) {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const cs = Number(callStart || 0);
    if (!(cs > 0)) return false;
    const now = getCorrectedTimestamp();
    return (now - cs) > TWO_HOURS_MS;
  }

  formatLocalDateTime(ts) {
    const localMs = (typeof ts === 'number' ? ts : Number(ts)) - timeSkew;
    const minute = 60 * 1000;
    const roundedMs = Math.round(localMs / minute) * minute;
    return new Date(roundedMs).toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  gateScheduledCall(messageEl) {
    if (!messageEl) return false;
    const callTime = Number(messageEl.dataset?.callTime || 0);
    if (this.isFutureCall(callTime)) {
      showToast(`Call scheduled for ${this.formatLocalDateTime(callTime)}`, 2500, 'info');
      return true;
    }
    return false;
  }

  buildCallScheduleHTML(callTime) {
    if (!callTime) return '';
    callTime = Number(callTime);
    return `<div class="call-message-schedule">Scheduled: ${this.formatLocalDateTime(callTime)}</div>`;
  }
}

const chatModal = new ChatModal();

class CallInviteModal {
  constructor() {
    this.messageEl = null;
  }

  load() {
    this.modal = document.getElementById('callInviteModal');
    this.contactsList = document.getElementById('callInviteContactsList');
    this.emptyState = this.modal.querySelector('.empty-state');
    this.inviteCounter = document.getElementById('callInviteCounter');
    this.inviteSendButton = document.getElementById('callInviteSendBtn');
    this.cancelButton = document.getElementById('callInviteCancelBtn');
    this.closeButton = document.getElementById('closeCallInviteModal');

    this.contactsList.addEventListener('change', this.updateCounter.bind(this));
    this.contactsList.addEventListener('click', this.handleContactClick.bind(this));
    this.inviteSendButton.addEventListener('click', this.sendInvites.bind(this));
    this.cancelButton.addEventListener('click', () => {
      this.close();
    });
    this.closeButton.addEventListener('click', this.close.bind(this));
  }

  /**
   * Gets avatar HTML for a contact with priority: user-selected avatar → contact's provided avatar → identicon
   * @param {Object} contact - Contact object
   * @param {number} size - Avatar size in pixels
   * @returns {Promise<string>} Avatar HTML
   */
  async getContactAvatarHtmlForInvite(contact, size = 40) {
    return getContactAvatarHtml(contact, size);
  }

  /**
   * Renders a section of contacts with a header
   * @param {string} label - Section label
   * @param {Array} contacts - Array of contact objects
   */
  async renderSection(label, contacts) {
    const header = document.createElement('div');
    header.className = 'share-contacts-section-header';
    header.textContent = label;
    this.contactsList.appendChild(header);

    const avatarPromises = contacts.map(contact => this.getContactAvatarHtmlForInvite(contact, 40));
    const avatarHtmlList = await Promise.all(avatarPromises);

    contacts.forEach((contact, index) => {
      const row = document.createElement('div');
      row.className = 'share-contact-row';
      row.dataset.address = contact.address;

      const avatarHtml = avatarHtmlList[index];
      const displayName = contact.displayName || contact.address || 'Unknown';

      row.innerHTML = `
        <div class="share-contact-avatar">${avatarHtml}</div>
        <div class="share-contact-info">
          <div class="share-contact-name">${escapeHtml(displayName)}</div>
        </div>
        <input type="checkbox" class="share-contact-checkbox call-invite-checkbox" value="${escapeHtml(contact.address || '')}" />
      `;

      this.contactsList.appendChild(row);
    });
  }

  /**
   * Opens the invite modal and populates contact list.
   * @param {HTMLElement} messageEl
   */
  async open(messageEl) {
    this.messageEl = messageEl;

    this.contactsList.innerHTML = '';
    this.emptyState.style.display = 'none';
    this.modal.classList.add('active');

    // Build contacts list (exclude the current chat participant and self) and group by status
    const allContacts = Object.values(myData.contacts || {})
      .filter(c => c.address !== chatModal.address && c.address !== myAccount.address)
      .map(c => {
        const displayName = getContactDisplayName(c);
        return {
          address: c.address,
          friend: c.friend || 1,
          avatarId: c.avatarId,
          mineAvatarId: c.mineAvatarId,
          displayName,
          displayNameLower: (displayName || '').toLowerCase()
        };
      });

    // Group contacts by friend status: friends (3), acquaintances (2), others (1), blocked (0)
    const groups = {
      friends: allContacts.filter(c => c.friend === 3).sort((a,b) => a.displayNameLower.localeCompare(b.displayNameLower)),
      acquaintances: allContacts.filter(c => c.friend === 2).sort((a,b) => a.displayNameLower.localeCompare(b.displayNameLower)),
      others: allContacts.filter(c => ![2, 3, 0].includes(c.friend)).sort((a,b) => a.displayNameLower.localeCompare(b.displayNameLower)),
    };

    if (allContacts.length === 0) {
      this.emptyState.style.display = 'block';
      // initial counter update to ensure Invite button is disabled
      this.updateCounter();
      return;
    }

    const sectionMeta = [
      { key: 'friends', label: 'Friends' },
      { key: 'acquaintances', label: 'Connections' },
      { key: 'others', label: 'Tolled' },
    ];

    for (const { key, label } of sectionMeta) {
      const list = groups[key];
      if (!list || list.length === 0) continue;
      await this.renderSection(label, list);
    }

    // initial counter update
    this.updateCounter();
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  handleContactClick(e) {
    const row = e.target.closest('.share-contact-row');
    if (!row) return;
    const checkbox = row.querySelector('.call-invite-checkbox');
    if (!checkbox) return;
    if (checkbox.disabled && !checkbox.checked) return;
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
    }
    this.updateCounter();
  }

  updateCounter() {
    const selected = this.contactsList.querySelectorAll('.call-invite-checkbox:checked').length;
    this.inviteCounter.textContent = `${selected} selected (max 10)`;
    this.inviteSendButton.disabled = selected === 0;
    // enforce max 10: disable unchecked boxes when limit reached
    const unchecked = Array.from(this.contactsList.querySelectorAll('.call-invite-checkbox:not(:checked)'));
    if (selected >= 10) {
      unchecked.forEach(cb => cb.disabled = true);
    } else {
      unchecked.forEach(cb => cb.disabled = false);
    }
  }

  async sendInvites() {
    const selectedBoxes = Array.from(this.contactsList.querySelectorAll('.call-invite-checkbox:checked'));
    const addresses = selectedBoxes.map(cb => cb.value).slice(0,10);
    // get call link from original message up to the first # so we don't duplicate callUrlParams
    const anchorHref = this.messageEl.querySelector('.call-message a')?.href || '';
    const msgCallLink = anchorHref.split('#')[0];
    if (!msgCallLink) return showToast('Call link not found', 2000, 'error');
    let msgCallTime = Number(this.messageEl.getAttribute('data-call-time')) || 0;
    this.inviteSendButton.disabled = true;
    this.inviteSendButton.textContent = 'Sending...';

    try {
      const successMessages = [];
      const failureGroups = new Map();
      const addFailure = (reason, name) => {
        if (!failureGroups.has(reason)) {
          failureGroups.set(reason, new Set());
        }
        if (name) {
          failureGroups.get(reason).add(name);
        }
      };
      for (const addr of addresses) {
        const keys = myAccount.keys;
        if (!keys) {
          addFailure('keysMissing');
          break;
        }

        const payload = { type: 'call', url: msgCallLink, callTime: msgCallTime };

        let messagePayload = {}
        const contact = myData.contacts[addr];
        const ok = await ensureContactKeys(addr);
        if (!ok) {
          addFailure('noPublicKey', contact.username || addr);
          continue;
        }
        const recipientPubKey = myData.contacts[addr].public;
        const pqRecPubKey = myData.contacts[addr].pqPublic;
        
        const {dhkey, cipherText} = dhkeyCombined(keys.secret, recipientPubKey, pqRecPubKey);
        const encMessage = encryptChacha(dhkey, stringify(payload));
        const selfKey = encryptData(bin2hex(dhkey), keys.secret+keys.pqSeed, true);

        messagePayload = {
          message: encMessage,
          encrypted: true,
          encryptionMethod: 'xchacha20poly1305',
          pqEncSharedKey: bin2base64(cipherText),
          selfKey: selfKey,
          sent_timestamp: getCorrectedTimestamp()
        };

        // get user toll amount
        const sortedAddresses = [longAddress(keys.address), longAddress(addr)].sort();
        const chatId = hashBytes(sortedAddresses.join(''));
        const chatIdAccount = await queryNetwork(`/messages/${chatId}/toll`);
        const toIndex = sortedAddresses.indexOf(longAddress(addr));
        const tollRequiredToSend = chatIdAccount?.toll?.required?.[toIndex] ?? 1;
        let toll = 0n;
        // 0 => no toll required (recipient added you as friend/connection)
        // 1 => toll required (recipient has NOT added you)
        // 2 => blocked
        if (tollRequiredToSend === 2) {
          addFailure('blocked', contact.username || addr);
          continue;
        }
        if (tollRequiredToSend === 1) {
          const username = (contact?.username) || `${addr.slice(0, 8)}...${addr.slice(-6)}`;
          addFailure('notConnection', username);
          continue;
        }

        const messageObj = await chatModal.createChatMessage(addr, messagePayload, toll, keys);
        // set callType to true if callTime is within 5 minutes of now or after callTime
        if (payload?.callTime <= getCorrectedTimestamp() + 5 * 60 * 1000) {
          messageObj.callType = true
        }
        await signObj(messageObj, keys);
        const txid = getTxid(messageObj);

        // Create new message object for local display immediately
        const newMessage = {
          message: payload.url,
          timestamp: messagePayload.sent_timestamp,
          sent_timestamp: messagePayload.sent_timestamp,
          my: true,
          txid: txid,
          status: 'sent',
          type: 'call',
          callTime: payload.callTime
        };
        insertSorted(contact.messages, newMessage, 'timestamp');

        // Update chats list
        const chatUpdate = {
          address: addr,
          timestamp: newMessage.sent_timestamp,
          txid: txid,
        };

        const existingChatIndex = myData.chats.findIndex((chat) => chat.address === addr);
        if (existingChatIndex !== -1) {
          myData.chats.splice(existingChatIndex, 1);
        }
        insertSorted(myData.chats, chatUpdate, 'timestamp');

        // Update the chat modal UI immediately
        if (chatModal.isActive() && chatModal.address === addr) {
          chatModal.appendChatModal();
        }

        // Send the message transaction
        const response = await injectTx(messageObj, txid);

        if (!response || !response.result || !response.result.success) {
          console.error('call message failed to send', response);
          updateTransactionStatus(txid, addr, 'failed', 'message');
          if (chatModal.isActive() && chatModal.address === addr) {
            chatModal.appendChatModal();
          }
          addFailure('sendFailed', contact.username || addr);
        } else {
          successMessages.push(`Call invite sent to ${contact.username || addr}`);
        }
      }

      if (successMessages.length > 0) {
        const successNames = successMessages.map(message => {
          const match = message.match(/^Call invite sent to (.+)$/);
          return match ? match[1] : message;
        });
        const successHtml = [
          '<div class="toast-list-content">',
          '<div class="toast-list-title">Invite sent:</div>',
          '<ul class="toast-list">',
          ...successNames.map(name => `<li><strong>${escapeHtml(name)}</strong></li>`),
          '</ul>',
          '</div>'
        ].join('');
        showToast(successHtml, 3000, 'success', true);
      }
      if (failureGroups.size > 0) {
        const failureItems = [];
        for (const [reason, names] of failureGroups.entries()) {
          const nameList = Array.from(names);
          switch (reason) {
            case 'keysMissing':
              failureItems.push({ text: 'Keys not found' });
              break;
            case 'noPublicKey':
              failureItems.push({
                text: 'Cannot get public key for:',
                sublist: nameList
              });
              break;
            case 'blocked':
              failureItems.push({
                text: 'You cannot invite these contacts (you are blocked):',
                sublist: nameList
              });
              break;
            case 'notConnection':
              failureItems.push({
                text: 'You can only invite people who have added you as a connection. Ask the listed contacts to add you as a connection.',
                sublist: nameList
              });
              break;
            case 'sendFailed':
              failureItems.push({
                text: 'Call invite failed to send to:',
                sublist: nameList
              });
              break;
          }
        }
        const failureHtml = [
          '<div class="toast-list-content">',
          '<div class="toast-list-title">Invite not sent:</div>',
          '<ul class="toast-list">',
          ...failureItems.map(item => {
            const sublist = Array.isArray(item.sublist) && item.sublist.length > 0
              ? `<ul class="toast-sublist">${item.sublist.map(name => `<li><strong>${escapeHtml(name)}</strong></li>`).join('')}</ul>`
              : '';
            return `<li>${item.text}${sublist}</li>`;
          }),
          '</ul>',
          '</div>'
        ].join('');
        showToast(failureHtml, 0, 'warning', true);
      }

    } catch (err) {
      console.error('Invite send error', err);
      showToast('Failed to send invites', 0, 'error');
    } finally {
      this.inviteSendButton.disabled = false;
      this.inviteSendButton.textContent = 'Invite';
      this.close();
    }
  };
}

const callInviteModal = new CallInviteModal();

/**
 * Share Attachment Modal
 * Allows users to select contacts to share an attachment with
 */
class ShareAttachmentModal {
  constructor() {
    this.messageEl = null;
    this.attachmentData = null;
  }

  load() {
    this.modal = document.getElementById('shareAttachmentModal');
    this.contactsList = document.getElementById('shareAttachmentContactsList');
    this.emptyState = this.modal.querySelector('.empty-state');
    this.counter = document.getElementById('shareAttachmentCounter');
    this.sendButton = document.getElementById('shareAttachmentSendBtn');
    this.cancelButton = document.getElementById('shareAttachmentCancelBtn');
    this.closeButton = document.getElementById('closeShareAttachmentModal');

    this.contactsList.addEventListener('change', this.updateCounter.bind(this));
    this.contactsList.addEventListener('click', this.handleContactClick.bind(this));
    this.sendButton.addEventListener('click', this.sendAttachments.bind(this));
    this.cancelButton.addEventListener('click', () => {
      this.close();
    });
    this.closeButton.addEventListener('click', this.close.bind(this));
  }

  /**
   * Opens the share modal and populates contact list.
   * @param {HTMLElement} messageEl - The message element containing the attachment
   */
  async open(messageEl) {
    this.messageEl = messageEl;
    this.attachmentData = this.extractAttachmentData(messageEl);

    if (!this.attachmentData) {
      showToast('No attachment data found', 2000, 'error');
      return;
    }

    this.contactsList.innerHTML = '';
    this.emptyState.style.display = 'none';
    this.modal.classList.add('active');

    // Build contacts list (exclude self and current chat contact) and group by status
    const currentChatAddress = chatModal.address;
    const allContacts = Object.values(myData.contacts || {})
      .filter(c => c.address !== myAccount.address && c.address !== currentChatAddress)
      .map(c => {
        const displayName = getContactDisplayName(c);
        return {
          address: c.address,
          friend: c.friend || 1,
          avatarId: c.avatarId,
          mineAvatarId: c.mineAvatarId,
          displayName,
          displayNameLower: (displayName || '').toLowerCase()
        };
      });

    // Group contacts by friend status
    const groups = {
      friends: allContacts.filter(c => c.friend === 3).sort((a,b) => a.displayNameLower.localeCompare(b.displayNameLower)),
      acquaintances: allContacts.filter(c => c.friend === 2).sort((a,b) => a.displayNameLower.localeCompare(b.displayNameLower)),
      others: allContacts.filter(c => ![2,3,0].includes(c.friend)).sort((a,b) => a.displayNameLower.localeCompare(b.displayNameLower)),
    };

    if (allContacts.length === 0) {
      this.emptyState.style.display = 'block';
      this.updateCounter();
      return;
    }

    const sectionMeta = [
      { key: 'friends', label: 'Friends' },
      { key: 'acquaintances', label: 'Connections' },
      { key: 'others', label: 'Tolled' },
    ];

    for (const { key, label } of sectionMeta) {
      const list = groups[key];
      if (!list || list.length === 0) continue;
      await this.renderSection(label, list);
    }

    this.updateCounter();
  }

  async renderSection(label, contacts) {
    const header = document.createElement('div');
    header.className = 'share-contacts-section-header';
    header.textContent = label;
    this.contactsList.appendChild(header);

    const avatarPromises = contacts.map(contact => getContactAvatarHtml(contact, 40));
    const avatarHtmlList = await Promise.all(avatarPromises);

    contacts.forEach((contact, index) => {
      const row = document.createElement('div');
      row.className = 'share-contact-row';
      row.dataset.address = contact.address;

      const avatarHtml = avatarHtmlList[index];
      const displayName = contact.displayName || contact.address || 'Unknown';

      row.innerHTML = `
        <div class="share-contact-avatar">${avatarHtml}</div>
        <div class="share-contact-info">
          <div class="share-contact-name">${escapeHtml(displayName)}</div>
        </div>
        <input type="checkbox" class="share-contact-checkbox call-invite-checkbox" value="${escapeHtml(contact.address || '')}" />
      `;

      this.contactsList.appendChild(row);
    });
  }

  handleContactClick(e) {
    const row = e.target.closest('.share-contact-row');
    if (!row) return;
    const checkbox = row.querySelector('.call-invite-checkbox');
    if (!checkbox) return;
    if (checkbox.disabled && !checkbox.checked) return;
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
    }
    this.updateCounter();
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  updateCounter() {
    const selected = this.contactsList.querySelectorAll('.call-invite-checkbox:checked').length;
    this.counter.textContent = `${selected} selected (max 10)`;
    this.sendButton.disabled = selected === 0;
    const unchecked = Array.from(this.contactsList.querySelectorAll('.call-invite-checkbox:not(:checked)'));
    if (selected >= 10) {
      unchecked.forEach(cb => cb.disabled = true);
    } else {
      unchecked.forEach(cb => cb.disabled = false);
    }
  }

  /**
   * Extract attachment data from message element
   * @param {HTMLElement} messageEl
   * @returns {Object|null} Attachment data
   */
  extractAttachmentData(messageEl) {
    const attachmentRow = messageEl.querySelector('.attachment-row');
    if (!attachmentRow) return null;

    const url = attachmentRow.dataset.url;
    const name = attachmentRow.dataset.name;
    const type = attachmentRow.dataset.type;
    const msgIdx = attachmentRow.dataset.msgIdx;

    if (!url) return null;

    // Get the actual message data from myData to access encryption keys
    const contactAddress = chatModal.address;
    const contact = myData.contacts[contactAddress];
    
    if (!contact || !contact.messages || !msgIdx) {
      console.error('Cannot find message data for attachment');
      return null;
    }

    const messageData = contact.messages[parseInt(msgIdx)];
    if (!messageData || !messageData.xattach || !messageData.xattach[0]) {
      console.error('Cannot find attachment in message data');
      return null;
    }

    const attachmentData = messageData.xattach[0];

    return {
      url: attachmentData.url,
      pUrl: attachmentData.pUrl || null,
      name: attachmentData.name || name || 'attachment',
      size: attachmentData.size || 0,
      type: attachmentData.type || type || 'application/octet-stream',
      encKey: attachmentData.encKey
    };
  }

  async sendAttachments() {
    const selectedBoxes = Array.from(this.contactsList.querySelectorAll('.call-invite-checkbox:checked'));
    const addresses = selectedBoxes.map(cb => cb.value).slice(0, 10);
    
    if (!this.attachmentData) {
      showToast('No attachment data found', 2000, 'error');
      return;
    }

    this.sendButton.disabled = true;
    this.sendButton.textContent = 'Sending...';

    try {
      const keys = myAccount.keys;
      if (!keys) {
        showToast('Keys not found', 0, 'error');
        return;
      }

      // Get the file's encryption key (migration ensures all attachments have encKey)
      const encKey = this.attachmentData.encKey;
      if (!encKey) {
        showToast('Missing encryption key for attachment', 0, 'error');
        return;
      }

      for (const addr of addresses) {
        const contact = myData.contacts[addr];
        const ok = await ensureContactKeys(addr);
        if (!ok) {
          showToast(`Skipping ${contact?.username || addr} (cannot get public key)`, 2000, 'warning');
          continue;
        }

        const recipientPubKey = myData.contacts[addr].public;
        const pqRecPubKey = myData.contacts[addr].pqPublic;
        
        // Create new dhkey for sharing recipient
        const {dhkey: recipientDhkey, cipherText} = dhkeyCombined(keys.secret, recipientPubKey, pqRecPubKey);

        // Create attachment object - encKey will be encrypted in the message envelope
        const sharedAttachment = {
          url: this.attachmentData.url,
          pUrl: this.attachmentData.pUrl,
          name: this.attachmentData.name,
          size: this.attachmentData.size,
          type: this.attachmentData.type,
          encKey: encKey  // File encryption key (will be encrypted with message)
        };

        // Build message with attachment
        const messageObj = {
          type: 'message',
          message: '',  // Empty message text
          attachments: [sharedAttachment]
        };

        const encMessage = encryptChacha(recipientDhkey, stringify(messageObj));
        
        // For ourselves: re-encrypt encKey with our password for local storage
        const password = keys.secret + keys.pqSeed;
        const selfKey = encryptData(bin2hex(base642bin(encKey)), password, true);

        const messagePayload = {
          message: encMessage,
          encrypted: true,
          encryptionMethod: 'xchacha20poly1305',
          pqEncSharedKey: bin2base64(cipherText),
          selfKey: selfKey,
          sent_timestamp: getCorrectedTimestamp()
        };

        // Get toll amount
        const sortedAddresses = [longAddress(keys.address), longAddress(addr)].sort();
        const chatId = hashBytes(sortedAddresses.join(''));
        const chatIdAccount = await queryNetwork(`/messages/${chatId}/toll`);
        const toIndex = sortedAddresses.indexOf(longAddress(addr));
        const tollRequiredToSend = chatIdAccount?.toll?.required?.[toIndex] ?? 1;

        if (tollRequiredToSend === 2) {
          showToast(`You cannot share with ${contact?.username || addr} (you are blocked)`, 0, 'warning');
          continue;
        }
        
        // Calculate toll amount: 0 for connections, recipient's required toll for others
        let tollInLib = tollRequiredToSend === 0 ? 0n : (contact.toll || 0n);
        
        // Add network fee to the toll amount
        tollInLib = tollInLib + getTransactionFeeWei();
        // if (tollRequiredToSend === 1) {
        //   const username = (contact?.username) || `${addr.slice(0, 8)}...${addr.slice(-6)}`;
        //   showToast(`You can only share with people who have added you as a connection. Ask ${username} to add you as a connection`, 0, 'info');
        //   continue;
        // }

        const chatMessageObj = await chatModal.createChatMessage(addr, messagePayload, tollInLib, keys);
        await signObj(chatMessageObj, keys);
        const txid = getTxid(chatMessageObj);

        // Create new message object for local display (with encKey in plaintext for our use)
        const newMessage = {
          message: '',
          timestamp: messagePayload.sent_timestamp,
          sent_timestamp: messagePayload.sent_timestamp,
          my: true,
          txid: txid,
          status: 'sent',
          xattach: [{
            url: this.attachmentData.url,
            pUrl: this.attachmentData.pUrl,
            name: this.attachmentData.name,
            size: this.attachmentData.size,
            type: this.attachmentData.type,
            encKey: encKey  // Store in plaintext locally
          }]
        };
        insertSorted(contact.messages, newMessage, 'timestamp');

        // Update chats list
        const chatUpdate = {
          address: addr,
          timestamp: newMessage.sent_timestamp,
          txid: txid,
        };

        const existingChatIndex = myData.chats.findIndex((chat) => chat.address === addr);
        if (existingChatIndex !== -1) {
          myData.chats.splice(existingChatIndex, 1);
        }
        insertSorted(myData.chats, chatUpdate, 'timestamp');

        // Update the chat modal UI if open
        if (chatModal.isActive() && chatModal.address === addr) {
          chatModal.appendChatModal();
        }

        // Send the message transaction
        const response = await injectTx(chatMessageObj, txid);

        if (!response || !response.result || !response.result.success) {
          console.error('attachment share message failed to send', response);
          updateTransactionStatus(txid, addr, 'failed', 'message');
          if (chatModal.isActive() && chatModal.address === addr) {
            chatModal.appendChatModal();
          }
          showToast(`Failed to share with ${contact?.username || addr}`, 3000, 'error');
        } else {
          showToast(`Attachment shared with ${contact?.username || addr}`, 3000, 'success');
        }
      }

    } catch (err) {
      console.error('Share send error', err);
      showToast('Failed to share attachment', 0, 'error');
    } finally {
      this.sendButton.disabled = false;
      this.sendButton.textContent = 'Share';
      this.close();
    }
  }
}

const shareAttachmentModal = new ShareAttachmentModal();

/**
 * Share Contacts Modal
 * Allows users to select contacts (Friends and Connections) to share as a VCF file attachment
 */
class ShareContactsModal {
  constructor() {
    this.selectedContacts = new Set();
    this.warningShown = false;
    this.isUploading = false;
    this.recipientAddress = null;
  }

  load() {
    this.modal = document.getElementById('shareContactsModal');
    this.contactsList = document.getElementById('shareContactsList');
    this.emptyState = document.getElementById('shareContactsEmptyState');
    this.actionButton = document.getElementById('shareContactsActionBtn');
    this.allNoneButton = document.getElementById('shareContactsAllNoneBtn');
    this.doneButton = document.getElementById('shareContactsDoneBtn');
    this.closeButton = document.getElementById('closeShareContactsModal');

    // Event listeners
    this.closeButton.addEventListener('click', () => this.handleClose());
    this.allNoneButton.addEventListener('click', () => this.toggleAllNone());
    this.doneButton.addEventListener('click', () => this.handleDone());
    this.contactsList.addEventListener('click', (e) => this.handleContactClick(e));
    this.actionButton.addEventListener('click', () => {
      if (this.recipientAddress) {
        this.close();
        friendModal.setAddress(this.recipientAddress);
        friendModal.open();
      }
    });
  }

  /**
   * Opens the share contacts modal and populates the contact list
   * @param {string|null} recipientAddress - The address of the recipient (from chatModal)
   */
  async open(recipientAddress = null) {
    // Reset state
    this.selectedContacts.clear();
    this.warningShown = false;
    this.isUploading = false;
    this.recipientAddress = recipientAddress;
    this.doneButton.classList.remove('loading');
    this.doneButton.disabled = true;
    this.allNoneButton.classList.remove('all-selected');
    this.allNoneButton.setAttribute('aria-label', 'Select all');
    this.allNoneButton.disabled = false;

    // Clear existing list
    this.contactsList.innerHTML = '';
    this.contactsList.style.display = 'none';

    // Hide action button by default
    this.actionButton.style.display = 'none';

    // Show modal
    this.modal.classList.add('active');

    // Check if account is private - show restriction message if so
    if (isPrivateAccount()) {
      // Update empty state message for private account restriction
      const emptyStateChildren = this.emptyState.children;
      if (emptyStateChildren.length >= 3) {
        emptyStateChildren[1].textContent = 'Private accounts cannot share contacts';
        emptyStateChildren[2].textContent = 'Only public accounts can share contacts';
      }
      this.emptyState.style.display = 'block';
      this.doneButton.disabled = true;
      this.allNoneButton.disabled = true;
      return;
    }

    // Check contact status if recipient address is provided
    if (recipientAddress) {
      const recipient = myData.contacts[recipientAddress];
      if (recipient) {
        // if undefined fallback to value 1 (toll required) so user cannot share contacts
        const tollRequiredToSend = recipient.tollRequiredToSend ?? 1;

        // Check if user hasn't added recipient as connection (contact.friend !== 2)
        if (recipient.friend !== 2) {
          const emptyStateChildren = this.emptyState.children;
          if (emptyStateChildren.length >= 3) {
            emptyStateChildren[1].textContent = 'Cannot share contacts';
            emptyStateChildren[2].textContent = 'You need to add the recipient as a connection before you can share contacts with them';
          }
          this.emptyState.style.display = 'block';
          this.doneButton.disabled = true;
          this.allNoneButton.disabled = true;
          // Show button to open Contact Status modal
          this.actionButton.textContent = 'Change Contact Status';
          this.actionButton.style.display = 'block';
          return;
        }

        // Check if recipient hasn't added user as connection (tollRequiredToSend !== 0)
        if (tollRequiredToSend !== 0) {
          const emptyStateChildren = this.emptyState.children;
          if (emptyStateChildren.length >= 3) {
            emptyStateChildren[1].textContent = 'Cannot share contacts';
            emptyStateChildren[2].textContent = 'The recipient must add you as a connection before you can share contacts with them. Ask them to add you as a connection';
          }
          this.emptyState.style.display = 'block';
          this.doneButton.disabled = true;
          this.allNoneButton.disabled = true;
          return;
        }
      }
    }

    // For public accounts, proceed with contact list population
    // Get Friends (friend === 3) and Connections (friend === 2)
    const allContacts = Object.values(myData.contacts || {});
    
    // Filter out the current chat contact (the person you're chatting with)
    const currentChatAddress = chatModal.isActive() && chatModal.address 
      ? normalizeAddress(chatModal.address) 
      : null;
    
    const filteredContacts = currentChatAddress
      ? allContacts.filter(c => normalizeAddress(c.address) !== currentChatAddress)
      : allContacts;
    
    const friends = filteredContacts
      .filter(c => c.friend === 3)
      .sort((a, b) => this.getContactDisplayNameForShare(a).toLowerCase().localeCompare(this.getContactDisplayNameForShare(b).toLowerCase()));
    const connections = filteredContacts
      .filter(c => c.friend === 2)
      .sort((a, b) => this.getContactDisplayNameForShare(a).toLowerCase().localeCompare(this.getContactDisplayNameForShare(b).toLowerCase()));

    const hasContacts = friends.length > 0 || connections.length > 0;

    // Show/hide empty state
    this.emptyState.style.display = hasContacts ? 'none' : 'block';
    this.contactsList.style.display = hasContacts ? 'block' : 'none';
    this.doneButton.disabled = !hasContacts;
    this.allNoneButton.disabled = !hasContacts;

    if (hasContacts) {
      // Render Friends section
      if (friends.length > 0) {
        await this.renderSection('Friends', friends);
      }
      // Render Connections section
      if (connections.length > 0) {
        await this.renderSection('Connections', connections);
      }
    }
  }

  /**
   * Gets display name for a contact with priority: contact's provided name → user-assigned name → username
   * @param {Object} contact - Contact object
   * @returns {string} Display name
   */
  getContactDisplayNameForShare(contact) {
    return contact?.senderInfo?.name || 
           contact?.name || 
           contact?.username || 
           `${contact?.address?.slice(0, 8)}…${contact?.address?.slice(-6)}`;
  }

  /**
   * Gets avatar HTML for a contact with priority: contact's provided avatar → user-selected avatar → identicon
   * Ignores useAvatar preference to always use the correct priority for sharing
   * @param {Object} contact - Contact object
   * @param {number} size - Avatar size in pixels
   * @returns {Promise<string>} Avatar HTML
   */
  async getContactAvatarHtmlForShare(contact, size = 40) {
    const address = contact?.address;
    if (!address) return generateIdenticon('', size);

    const makeImg = (url) => `<img src="${url}" class="contact-avatar-img" width="${size}" height="${size}" alt="avatar">`;

    try {
      // Priority 1: Contact's provided avatar
      if (contact?.avatarId) {
        const url = await contactAvatarCache.getBlobUrl(contact.avatarId);
        if (url) return makeImg(url);
      }

      // Priority 2: User-selected avatar for this contact
      if (contact?.mineAvatarId) {
        const url = await contactAvatarCache.getBlobUrl(contact.mineAvatarId);
        if (url) return makeImg(url);
      }
    } catch (err) {
      console.warn('Failed to load avatar, falling back to identicon:', err);
    }

    // Priority 3: Identicon fallback
    return generateIdenticon(address, size);
  }

  /**
   * Renders a section of contacts with a header
   * @param {string} label - Section label
   * @param {Array} contacts - Array of contact objects
   */
  async renderSection(label, contacts) {
    // Add section header
    const header = document.createElement('div');
    header.className = 'share-contacts-section-header';
    header.textContent = label;
    this.contactsList.appendChild(header);

    // Batch avatar generation for better performance
    // Use custom function that follows correct priority: contact avatar → user-selected → identicon
    const avatarPromises = contacts.map(contact => this.getContactAvatarHtmlForShare(contact, 40));
    const avatarHtmlList = await Promise.all(avatarPromises);

    // Render each contact
    contacts.forEach((contact, index) => {
      const row = document.createElement('div');
      row.className = 'share-contact-row';
      row.dataset.address = contact.address;

      const avatarHtml = avatarHtmlList[index];
      const displayName = this.getContactDisplayNameForShare(contact);

      row.innerHTML = `
        <div class="share-contact-avatar">${avatarHtml}</div>
        <div class="share-contact-info">
          <div class="share-contact-name">${escapeHtml(displayName)}</div>
        </div>
        <input type="checkbox" class="share-contact-checkbox" />
      `;

      this.contactsList.appendChild(row);
    });
  }

  /**
   * Handles click on a contact row to toggle selection
   * @param {Event} e - Click event
   */
  handleContactClick(e) {
    const row = e.target.closest('.share-contact-row');
    if (!row) return;

    const checkbox = row.querySelector('.share-contact-checkbox');
    const address = row.dataset.address;

    // Toggle checkbox (unless clicking directly on checkbox, which toggles itself)
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
    }

    // Update selected contacts set
    if (checkbox.checked) {
      this.selectedContacts.add(address);
    } else {
      this.selectedContacts.delete(address);
    }

    // Update All/None button text
    this.updateAllNoneButton();
  }

  /**
   * Updates the All/None button icon based on selection state
   */
  updateAllNoneButton() {
    const checkboxes = this.contactsList.querySelectorAll('.share-contact-checkbox');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    if (allSelected && checkboxes.length > 0) {
      this.allNoneButton.classList.add('all-selected');
      this.allNoneButton.setAttribute('aria-label', 'Clear');
    } else {
      this.allNoneButton.classList.remove('all-selected');
      this.allNoneButton.setAttribute('aria-label', 'Select all');
    }
  }

  /**
   * Toggles between selecting all and none
   */
  toggleAllNone() {
    const checkboxes = this.contactsList.querySelectorAll('.share-contact-checkbox');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
      const row = cb.closest('.share-contact-row');
      const address = row?.dataset.address;
      if (allSelected) {
        cb.checked = false;
        if (address) this.selectedContacts.delete(address);
      } else {
        cb.checked = true;
        if (address) this.selectedContacts.add(address);
      }
    });

    this.updateAllNoneButton();
  }

  /**
   * Handles back/close button click with warning if contacts are selected
   */
  handleClose() {
    if (this.selectedContacts.size > 0 && !this.warningShown) {
      this.warningShown = true;
      showToast('You have contacts selected. Click back again to discard.', 0, 'warning');
      return;
    }
    this.close();
  }

  /**
   * Closes the modal
   */
  close() {
    this.modal.classList.remove('active');
    // Reset warning state so it can be shown again on next open
    this.warningShown = false;
  }

  /**
   * Checks if the modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  /**
   * Gets avatar blob for a contact with priority: contact's provided avatar → user-selected avatar → null
   * @param {Object} contact - Contact object
   * @returns {Promise<Blob|null>} Avatar blob or null if not available
   */
  async getContactAvatarBlobForShare(contact) {
    try {
      // Priority 1: Contact's provided avatar
      if (contact?.avatarId) {
        const blob = await contactAvatarCache.get(contact.avatarId);
        if (blob) return blob;
      }

      // Priority 2: User-selected avatar for this contact
      if (contact?.mineAvatarId) {
        const blob = await contactAvatarCache.get(contact.mineAvatarId);
        if (blob) return blob;
      }
    } catch (err) {
      console.warn('Failed to get avatar blob for VCF:', err);
    }

    // No avatar available
    return null;
  }

  /**
   * Generates VCF content for selected contacts
   * @returns {Promise<string>} VCF file content
   */
  async generateVcfContent() {
    const vcards = [];

    // First card contains X-LIBERDUS-NETID
    vcards.push([
      'BEGIN:VCARD',
      'VERSION:3.0',
      `X-LIBERDUS-NETID:${network.netid || ''}`,
      'END:VCARD'
    ].join('\r\n'));

    // Generate vCard for each selected contact
    for (const address of this.selectedContacts) {
      const contact = myData.contacts[address];
      if (!contact) continue;

      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `X-LIBERDUS-ADDRESS:${contact.address || ''}`,
        `X-LIBERDUS-USERNAME:${contact.username || ''}`
      ];

      // FN - use contact's provided name, then user-assigned name
      const displayName = contact?.senderInfo?.name || contact?.name;
      if (displayName) {
        lines.push(`FN:${displayName}`);
      }

      // PHOTO - base64 of avatar blob
      const avatarBlob = await this.getContactAvatarBlobForShare(contact);
      if (avatarBlob) {
        const base64 = await contactAvatarCache.blobToBase64(avatarBlob);
        if (base64) {
          // Determine image type from blob MIME type
          const imageType = avatarBlob.type === 'image/png' ? 'PNG' : 'JPEG';
          lines.push(`PHOTO;ENCODING=b;TYPE=${imageType}:${base64}`);
        }
      }

      lines.push('END:VCARD');
      vcards.push(lines.join('\r\n'));
    }

    return vcards.join('\r\n');
  }

  /**
   * Generates a filename for the VCF file
   * @returns {string} Filename in format username-YYMMDD-HHMM.vcf
   */
  generateVcfFilename() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const username = myAccount?.username || 'user';
    return `${username}-${yy}${mm}${dd}-${hh}${min}.vcf`;
  }

  /**
   * Handles the Done button click - generates VCF, encrypts, and uploads
   */
  async handleDone() {
    // Safety check: prevent sharing for private accounts
    if (isPrivateAccount()) {
      showToast('Private accounts cannot share contacts', 2000, 'error');
      return;
    }

    if (this.selectedContacts.size === 0) {
      showToast('Please select at least one contact', 2000, 'info');
      return;
    }

    if (this.isUploading) return;
    this.isUploading = true;
    this.doneButton.classList.add('loading');
    this.doneButton.disabled = true;

    try {
      // Generate VCF content
      const vcfContent = await this.generateVcfContent();
      const vcfFilename = this.generateVcfFilename();
      
      // Create blob from VCF content
      const vcfBlob = new Blob([vcfContent], { type: 'text/vcard' });

      // Use a random encryption key for the attachment (matches chat attachments)
      const encKey = generateRandomBytes(32);

      // Encrypt the VCF blob using the random key
      const encryptedBlob = await encryptBlob(vcfBlob, encKey);

      // Upload encrypted file
      const attachmentUrl = await chatModal.uploadEncryptedFile(encryptedBlob, vcfFilename);

      // Add to chatModal's file attachments
      chatModal.fileAttachments.push({
        url: attachmentUrl,
        name: vcfFilename,
        size: vcfBlob.size,
        type: 'text/vcard',
        encKey: bin2base64(encKey)
      });

      // Update attachment preview in chat modal
      chatModal.showAttachmentPreview();

      this.close();
    } catch (err) {
      console.error('Failed to generate/upload VCF:', err);
      showToast('Failed to share contacts', 0, 'error');
    } finally {
      this.isUploading = false;
      this.doneButton.classList.remove('loading');
      this.doneButton.disabled = false;
    }
  }
}

const shareContactsModal = new ShareContactsModal();

/**
 * Import Contacts Modal
 * Allows users to import contacts from a shared VCF file attachment
 */
class ImportContactsModal {
  constructor() {
    this.selectedContacts = new Set();
    this.warningShown = false;
    this.isImporting = false;
    this.parsedContacts = [];
    this.currentAttachment = null;
    this.recipientAddress = null;
  }

  load() {
    this.modal = document.getElementById('importContactsModal');
    this.contactsList = document.getElementById('importContactsList');
    this.emptyState = document.getElementById('importContactsEmptyState');
    this.loadingState = document.getElementById('importContactsLoading');
    this.actionButton = document.getElementById('importContactsActionBtn');
    this.allNoneButton = document.getElementById('importContactsAllNoneBtn');
    this.doneButton = document.getElementById('importContactsDoneBtn');
    this.closeButton = document.getElementById('closeImportContactsModal');

    // Event listeners
    this.closeButton.addEventListener('click', () => this.handleClose());
    this.allNoneButton.addEventListener('click', () => this.toggleAllNone());
    this.doneButton.addEventListener('click', () => this.handleDone());
    this.contactsList.addEventListener('click', (e) => this.handleContactClick(e));
    this.actionButton.addEventListener('click', () => {
      if (this.recipientAddress) {
        this.close();
        friendModal.setAddress(this.recipientAddress);
        friendModal.open();
      }
    });
  }

  /**
   * Opens the import contacts modal with an attachment or local VCF file
   * @param {Object} attachment - The VCF attachment object with url, pqEncSharedKey, selfKey
   *                              OR { vcfContent: string, isLocal: true } for local file uploads
   */
  async open(attachment) {
    const isLocalUpload = attachment?.isLocal === true;

    // Reset state
    this.selectedContacts.clear();
    this.warningShown = false;
    this.isImporting = false;
    this.parsedContacts = [];
    this.currentAttachment = isLocalUpload ? null : attachment;
    this.recipientAddress = isLocalUpload ? null : (attachment?.senderAddress || null);
    this.doneButton.classList.remove('loading');
    this.doneButton.disabled = true;
    this.allNoneButton.classList.remove('all-selected');
    this.allNoneButton.setAttribute('aria-label', 'Select all');
    this.allNoneButton.disabled = false;

    // Clear existing list
    this.contactsList.innerHTML = '';
    this.contactsList.style.display = 'none';
    this.loadingState.style.display = 'none';

    // Hide action button by default
    this.actionButton.style.display = 'none';

    // Show modal
    this.modal.classList.add('active');

    // Check if account is private - show restriction message if so
    if (isPrivateAccount()) {
      // Update empty state message for private account restriction
      const emptyStateChildren = this.emptyState.children;
      if (emptyStateChildren.length >= 3) {
        emptyStateChildren[1].textContent = 'Private accounts cannot import contacts';
        emptyStateChildren[2].textContent = 'Only public accounts can import contacts';
      }
      this.emptyState.style.display = 'block';
      this.doneButton.disabled = true;
      return;
    }

    // Check contact status if recipient address is provided (skip for local uploads - user explicitly chose the file)
    if (!isLocalUpload && this.recipientAddress) {
      const recipient = myData.contacts[this.recipientAddress];
      if (recipient && recipient.friend !== 2) {
        // Recipient is not a connection - show warning
        const emptyStateChildren = this.emptyState.children;
        if (emptyStateChildren.length >= 3) {
          emptyStateChildren[1].textContent = 'Cannot import contacts';
          emptyStateChildren[2].textContent = 'Contacts should only be imported from people you trust. If you trust this user add them as a connection before importing contacts.';
        }
        this.emptyState.style.display = 'block';
        this.doneButton.disabled = true;
        this.allNoneButton.disabled = true;
        // Show button to open Contact Status modal
        this.actionButton.textContent = 'Change Contact Status';
        this.actionButton.style.display = 'block';
        return;
      }
    }

    // For public accounts, proceed with VCF processing
    this.emptyState.style.display = 'none';
    this.loadingState.style.display = 'flex';

    try {
      // Get VCF content - either from local file or download/decrypt from attachment
      const vcfContent = isLocalUpload ? attachment.vcfContent : await this.downloadAndDecryptVcf(attachment);
      
      // Extract and validate network ID from first vCard before parsing all contacts
      const netId = this.extractNetId(vcfContent);
      if (netId && netId !== network.netid) {
        showToast('Network ID mismatch - contacts are from a different network', 0, 'error');
        this.close();
        return;
      }

      // Parse contacts
      const parsedContacts = this.parseVcfContacts(vcfContent);

      // Deduplicate by username (keep first occurrence of each normalized username)
      const seenUsernames = new Set();
      this.parsedContacts = parsedContacts.filter(contact => {
        if (!contact.username) return false;
        
        const normalizedUsername = normalizeUsername(contact.username);
        if (seenUsernames.has(normalizedUsername)) {
          return false; // Skip duplicate
        }
        
        seenUsernames.add(normalizedUsername);
        return true; // Keep first occurrence
      });

      // Hide loading
      this.loadingState.style.display = 'none';

      // Render contacts
      await this.renderContactList();

    } catch (err) {
      console.error('Failed to load VCF:', err);
      showToast('Failed to load contacts file', 0, 'error');
      this.close();
    }
  }

  /**
   * Downloads and decrypts the VCF file
   * @param {Object} attachment - The attachment object
   * @returns {Promise<string>} Decrypted VCF content
   */
  async downloadAndDecryptVcf(attachment) {
    // Download encrypted file
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const encryptedData = new Uint8Array(await response.arrayBuffer());

    // Determine which key to use for decryption (same logic as decryptAttachmentToBlob)
    let dhkey;
    if (attachment.my) {
      // We sent this file - decrypt with selfKey
      if (!attachment.selfKey) throw new Error('Missing selfKey for decrypt');
      const password = myAccount.keys.secret + myAccount.keys.pqSeed;
      const dhkeyHex = decryptData(attachment.selfKey, password, true);
      if (!dhkeyHex) throw new Error('Failed to decrypt selfKey');
      dhkey = hex2bin(dhkeyHex);
    } else {
      // Someone else sent this - decrypt with pqEncSharedKey
      if (!attachment.pqEncSharedKey) throw new Error('Missing pqEncSharedKey for decrypt');
      const ok = await ensureContactKeys(attachment.senderAddress);
      const senderPublicKey = myData.contacts[attachment.senderAddress]?.public;
      if (!ok || !senderPublicKey) throw new Error(`No public key found for sender ${attachment.senderAddress}`);
      
      const pqCipher = (typeof attachment.pqEncSharedKey === 'string') 
        ? base642bin(attachment.pqEncSharedKey) 
        : attachment.pqEncSharedKey;
      dhkey = dhkeyCombined(
        myAccount.keys.secret,
        senderPublicKey,
        myAccount.keys.pqSeed,
        pqCipher
      ).dhkey;
    }

    // Decrypt the file
    const cipherB64 = bin2base64(encryptedData);
    const plainB64 = decryptChacha(dhkey, cipherB64);
    if (!plainB64) {
      throw new Error('Decryption failed');
    }

    // Convert base64 to string
    const plainBin = base642bin(plainB64);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(plainBin);
  }

  /**
   * Extracts network ID from the first vCard in VCF content
   * @param {string} vcfContent - Raw VCF file content
   * @returns {string|null} Network ID or null if not found
   */
  extractNetId(vcfContent) {
    const match = vcfContent.match(/X-LIBERDUS-NETID:(.+)/i);
    return match ? match[1].trim() : null;
  }

  /**
   * Parses VCF content into contact objects
   * @param {string} vcfContent - Raw VCF file content
   * @returns {Array} Array of contact objects
   */
  parseVcfContacts(vcfContent) {
    const vcards = vcfContent.split(/(?=BEGIN:VCARD)/i).filter(v => v.trim());
    const contacts = [];

    for (const vcard of vcards) {
      const contact = {};
      const lines = vcard.split(/\r?\n/);

      for (const line of lines) {
        if (line.startsWith('X-LIBERDUS-ADDRESS:')) {
          contact.address = line.substring('X-LIBERDUS-ADDRESS:'.length).trim();
        } else if (line.startsWith('X-LIBERDUS-USERNAME:')) {
          contact.username = line.substring('X-LIBERDUS-USERNAME:'.length).trim();
        } else if (line.startsWith('FN:')) {
          contact.name = line.substring('FN:'.length).trim();
        } else if (line.startsWith('PHOTO;')) {
          // Parse PHOTO field: PHOTO;ENCODING=b;TYPE=JPEG:base64data
          const photoMatch = line.match(/PHOTO;.*:(.+)/i);
          if (photoMatch) {
            contact.photoBase64 = photoMatch[1];
            // Extract type
            const typeMatch = line.match(/TYPE=(\w+)/i);
            contact.photoType = typeMatch ? typeMatch[1].toLowerCase() : 'jpeg';
          }
        }
      }

      // Only add if we have an address and username (skip the header card with just netId)
      if (contact.address && contact.username) {
        contacts.push(contact);
      }
    }

    return contacts;
  }

  /**
   * Validates a contact on the network by username lookup
   * Also verifies that VCF address matches network-resolved address.
   * @param {Object} parsedContact - Contact object with username and address
   * @returns {Promise<Object>} { success: boolean, networkAddress?: string, error?: string }
   */
  async validateContactOnNetwork(parsedContact) {
    if (!parsedContact.username) {
      return { success: false, error: 'No username provided' };
    }
    if (!parsedContact.address) {
      return { success: false, error: 'No address provided' };
    }

    try {
      const username = normalizeUsername(parsedContact.username);
      const vcfAddress = normalizeAddress(parsedContact.address);
      const usernameBytes = utf82bin(username);
      const usernameHash = hashBytes(usernameBytes);

      // Query network for username
      const addressData = await queryNetwork(`/address/${usernameHash}`);
      
      if (!addressData || !addressData.address) {
        return { success: false, error: 'Username not found on network' };
      }

      const networkAddress = normalizeAddress(addressData.address);

      // Reject tampered VCF entries where username/address pairing doesn't match network.
      if (vcfAddress !== networkAddress) {
        return { success: false, error: 'VCF address does not match network username record' };
      }

      // Verify account exists and ensure it's a public account
      const accountData = await queryNetwork(`/account/${longAddress(networkAddress)}`);
      if (!accountData || !accountData.account) {
        return { success: false, error: 'Account not found on network' };
      }

      // Only public accounts can import, so reject private contacts
      const contactIsPrivate = accountData.account.private === true;
      if (contactIsPrivate) {
        return { 
          success: false, 
          error: 'Cannot import private account' 
        };
      }

      return { success: true, networkAddress, username };
    } catch (error) {
      console.error('Error validating contact on network:', error);
      logsModal.log('❌ Error validating contact on network:', error?.message || String(error));
      return { success: false, error: 'Network error during validation' };
    }
  }

  /**
   * Renders the contact list
   */
  async renderContactList() {
    const myAddress = normalizeAddress(myAccount?.keys?.address || '');

    // Filter out self (contacts are already deduplicated by username)
    const filteredContacts = this.parsedContacts.filter(c => 
      normalizeAddress(c.address) !== myAddress
    );

    if (filteredContacts.length === 0) {
      this.emptyState.style.display = 'block';
      this.contactsList.style.display = 'none';
      this.doneButton.disabled = true;
      return;
    }

    // Separate new and existing contacts
    const newContacts = [];
    const existingContacts = [];

    for (const contact of filteredContacts) {
      const normalizedAddr = normalizeAddress(contact.address);
      if (myData.contacts[normalizedAddr]) {
        existingContacts.push({ ...contact, address: normalizedAddr, isExisting: true });
      } else {
        newContacts.push({ ...contact, address: normalizedAddr, isExisting: false });
      }
    }

    // Sort each group by name
    const sortByName = (a, b) => {
      const nameA = (a.name || a.username || a.address).toLowerCase();
      const nameB = (b.name || b.username || b.address).toLowerCase();
      return nameA.localeCompare(nameB);
    };
    newContacts.sort(sortByName);
    existingContacts.sort(sortByName);

    // Combine: new contacts first, then existing
    const sortedContacts = [...newContacts, ...existingContacts];

    // Generate avatars in parallel
    const avatarPromises = sortedContacts.map(contact => this.getAvatarHtml(contact, 40));
    const avatarHtmlList = await Promise.all(avatarPromises);

    // Render contacts
    this.contactsList.innerHTML = '';
    
    // Add section headers
    if (newContacts.length > 0) {
      const header = document.createElement('div');
      header.className = 'share-contacts-section-header';
      header.textContent = 'New Contacts';
      this.contactsList.appendChild(header);
    }

    let existingHeaderAdded = false;

    sortedContacts.forEach((contact, index) => {
      // Add existing contacts header when we reach them
      if (contact.isExisting && !existingHeaderAdded && existingContacts.length > 0) {
        const header = document.createElement('div');
        header.className = 'share-contacts-section-header';
        header.textContent = 'Already Added';
        this.contactsList.appendChild(header);
        existingHeaderAdded = true;
      }

      const row = document.createElement('div');
      row.className = 'share-contact-row' + (contact.isExisting ? ' existing' : '');
      row.dataset.address = contact.address;

      const avatarHtml = avatarHtmlList[index];
      const displayName = contact.name || contact.username || `${contact.address.slice(0, 8)}…${contact.address.slice(-6)}`;

      row.innerHTML = `
        <div class="share-contact-avatar">${avatarHtml}</div>
        <div class="share-contact-info">
          <div class="share-contact-name">${escapeHtml(displayName)}</div>
        </div>
        ${contact.isExisting 
          ? '<span class="existing-label">Already added</span>' 
          : '<input type="checkbox" class="share-contact-checkbox" />'}
      `;

      this.contactsList.appendChild(row);
    });

    this.contactsList.style.display = 'block';
    this.doneButton.disabled = newContacts.length === 0;
  }

  /**
   * Gets avatar HTML for a parsed contact
   * @param {Object} contact - Parsed contact object
   * @param {number} size - Avatar size
   * @returns {Promise<string>} Avatar HTML
   */
  async getAvatarHtml(contact, size = 40) {
    const makeImg = (url) => `<img src="${url}" class="contact-avatar-img" width="${size}" height="${size}" alt="avatar">`;

    // If contact has photo data from VCF
    if (contact.photoBase64) {
      try {
        const mimeType = contact.photoType === 'png' ? 'image/png' : 'image/jpeg';
        const blob = contactAvatarCache.base64ToBlob(contact.photoBase64, mimeType);
        const url = URL.createObjectURL(blob);
        return makeImg(url);
      } catch (err) {
        console.warn('Failed to create avatar from VCF photo:', err);
      }
    }

    // Fallback to identicon
    return generateIdenticon(contact.address || '', size);
  }

  /**
   * Handles click on a contact row to toggle selection
   * @param {Event} e - Click event
   */
  handleContactClick(e) {
    const row = e.target.closest('.share-contact-row');
    if (!row || row.classList.contains('existing')) return;

    const checkbox = row.querySelector('.share-contact-checkbox');
    if (!checkbox) return;

    const address = row.dataset.address;

    // Toggle checkbox (unless clicking directly on checkbox)
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
    }

    // Update selected contacts set
    if (checkbox.checked) {
      this.selectedContacts.add(address);
    } else {
      this.selectedContacts.delete(address);
    }

    this.updateAllNoneButton();
  }

  /**
   * Updates the All/None button icon based on selection state
   */
  updateAllNoneButton() {
    const checkboxes = this.contactsList.querySelectorAll('.share-contact-row:not(.existing) .share-contact-checkbox');
    const allSelected = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    if (allSelected) {
      this.allNoneButton.classList.add('all-selected');
      this.allNoneButton.setAttribute('aria-label', 'Clear');
    } else {
      this.allNoneButton.classList.remove('all-selected');
      this.allNoneButton.setAttribute('aria-label', 'Select all');
    }
  }

  /**
   * Toggles between selecting all and none
   */
  toggleAllNone() {
    const checkboxes = this.contactsList.querySelectorAll('.share-contact-row:not(.existing) .share-contact-checkbox');
    const allSelected = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
      const row = cb.closest('.share-contact-row');
      const address = row?.dataset.address;
      if (allSelected) {
        cb.checked = false;
        if (address) this.selectedContacts.delete(address);
      } else {
        cb.checked = true;
        if (address) this.selectedContacts.add(address);
      }
    });

    this.updateAllNoneButton();
  }

  /**
   * Handles back/close button click with warning if contacts are selected
   */
  handleClose() {
    if (this.selectedContacts.size > 0 && !this.warningShown) {
      this.warningShown = true;
      showToast('You have contacts selected. Click back again to discard.', 0, 'warning');
      return;
    }
    this.close();
  }

  /**
   * Closes the modal
   */
  close() {
    this.modal.classList.remove('active');
    this.warningShown = false;
    this.parsedContacts = [];
    this.currentAttachment = null;
  }

  /**
   * Checks if the modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  /**
   * Handles the Done button click - imports selected contacts
   */
  async handleDone() {
    if (this.selectedContacts.size === 0) {
      showToast('Please select at least one contact', 2000, 'info');
      return;
    }

    if (this.isImporting) return;
    this.isImporting = true;
    this.doneButton.classList.add('loading');
    this.doneButton.disabled = true;

    try {
      let importedCount = 0;
      let failedCount = 0;
      const failedContacts = [];
      const importedContacts = [];

      // Limit to 20 contacts maximum
      const selectedContactsArray = Array.from(this.selectedContacts);
      const totalSelected = selectedContactsArray.length;
      const contactsToProcess = selectedContactsArray.slice(0, 20);
      const hasMoreThan20 = totalSelected > 20;

      // Parallel validation of selected contacts (limited to 20)
      const validationPromises = contactsToProcess.map(async (address) => {
        const parsedContact = this.parsedContacts.find(c => normalizeAddress(c.address) === address);
        if (!parsedContact) return { parsedContact: null, validation: null };
        
        const validation = await this.validateContactOnNetwork(parsedContact);
        return { parsedContact, validation };
      });

      const results = await Promise.allSettled(validationPromises);

      // Process validation results and create contacts (limited to 20)
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('Validation promise rejected:', result.reason);
          logsModal.log('❌ Validation promise rejected:', result.reason?.message || String(result.reason));
          failedCount++;
          continue;
        }

        const { parsedContact, validation } = result.value;
        if (!parsedContact || !validation) continue;

        if (!validation.success) {
          console.warn(`Failed to validate contact ${parsedContact.username}:`, validation.error);
          logsModal.log(`⚠️ Failed to validate contact ${parsedContact.username}:`, validation.error);
          failedContacts.push({ username: parsedContact.username, error: validation.error });
          failedCount++;
          continue;
        }

        // Use the network address instead of the VCF address
        const networkAddress = validation.networkAddress;

        // Check if contact already exists
        if (myData.contacts[networkAddress]) {
          console.log(`Contact ${parsedContact.username} already exists, skipping`);
          logsModal.log(`ℹ️ Contact ${parsedContact.username} already exists, skipping`);
          continue;
        }

        // Create contact record (incomplete - missing public keys)
        const contactRecord = {
          address: networkAddress,
          username: validation.username,
          messages: [],
          timestamp: 0,
          unread: 0,
          hasAvatar: false,
          toll: 0n,
          tollRequiredToReceive: 1,
          tollRequiredToSend: 1,
          friend: 2, // Friend status
          friendOld: 2,
          tolledDepositToastShown: true,
        };

        // Store imported name in user input name field so it displays in contactList and can be changed by user
        if (parsedContact.name) {
          contactRecord.name = parsedContact.name;
        }

        // Save avatar as user-uploaded so it can be changed or deleted locally
        if (parsedContact.photoBase64) {
          try {
            const mimeType = parsedContact.photoType === 'png' ? 'image/png' : 'image/jpeg';
            const avatarBlob = contactAvatarCache.base64ToBlob(parsedContact.photoBase64, mimeType);
            // Generate ID like user-uploaded avatars for consistency
            const mineId = bin2hex(generateRandomBytes(16));
            await contactAvatarCache.save(mineId, avatarBlob);
            contactRecord.mineAvatarId = mineId;
            contactRecord.hasAvatar = true;
            contactRecord.useAvatar = 'mine';
          } catch (err) {
            console.warn('Failed to save imported avatar:', err);
          }
        }

        // Add to contacts using network address
        myData.contacts[networkAddress] = contactRecord;
        importedContacts.push(parsedContact.username);
        importedCount++;
      }

      saveState();
      
      // Refresh contacts screen if visible
      contactsScreen.updateContactsList();
      
      // Show appropriate success/error message with usernames
      if (importedCount > 0 && failedCount === 0) {
        const successList = importedContacts.join(', ');
        showToast(`Successfully imported: ${successList}`, 3000, 'success');
      } else if (importedCount > 0 && failedCount > 0) {
        const successList = importedContacts.join(', ');
        const failedList = failedContacts.map(c => c.username).join(', ');
        showToast(`Imported: ${successList}\n\nFailed: ${failedList}`, 0, 'warning');
      } else if (failedCount > 0) {
        const failedList = failedContacts.map(c => c.username).join(', ');
        showToast(`Failed to import: ${failedList}`, 0, 'error');
      }

      // Show warning if more than 20 contacts were selected
      if (hasMoreThan20) {
        showToast('Only 20 contacts can be imported at a time. Please import the remaining contacts in another batch.', 0, 'warning');
      }

      this.close();

    } catch (err) {
      console.error('Failed to import contacts:', err);
      logsModal.log('❌ Failed to import contacts:', err?.message || String(err));
      showToast('Failed to import contacts', 0, 'error');
    } finally {
      this.isImporting = false;
      this.doneButton.classList.remove('loading');
      this.doneButton.disabled = false;
    }
  }
}

const importContactsModal = new ImportContactsModal();

// ---- Call scheduling shared helpers (display-only) ----
function getActiveChatContactTimeZone() {
  const addr = chatModal?.address;
  if (!addr) return '';
  const tz = myData?.contacts?.[addr]?.senderInfo?.timezone;
  return typeof tz === 'string' ? tz : '';
}

function roundToMinuteMs(ms) {
  return Math.round(ms / 60000) * 60000;
}

function formatTimeInTimeZone(ms, tz) {
  if (!tz || !ms) return '';
  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    return fmt.format(new Date(ms));
  } catch (e) {
    return '';
  }
}

/**
 * Call Schedule Choice Modal
 * Presents: Call Now | Schedule | Cancel
 */
class CallScheduleChoiceModal {
  constructor() {
    this.modal = null;
    this.nowBtn = null;
    this.scheduleBtn = null;
    this.cancelBtn = null;
    this.closeBtn = null;
    this.recipientTime = null;
    this._recipientTimeInterval = null;
    this.onSelect = null; // function(choice)
  }

  load() {
    this.modal = document.getElementById('callScheduleChoiceModal');
    if (!this.modal) return;
    this.nowBtn = document.getElementById('callScheduleNowBtn');
    this.scheduleBtn = document.getElementById('openCallScheduleDateBtn');
    this.cancelBtn = document.getElementById('cancelCallScheduleChoice');
    this.closeBtn = document.getElementById('closeCallScheduleChoiceModal');
    this.recipientTime = document.getElementById('callScheduleChoiceRecipientTime');

    const onNow = () => this._select('now');
    const onSchedule = () => this._select('schedule');
    const onCancel = () => this._select(null);

    if (this.nowBtn) this.nowBtn.addEventListener('click', onNow);
    if (this.scheduleBtn) this.scheduleBtn.addEventListener('click', onSchedule);
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', onCancel);
    if (this.closeBtn) this.closeBtn.addEventListener('click', onCancel);
  }

  open(onSelect) {
    this.onSelect = onSelect;
    this.modal?.classList.add('active');
    this._startRecipientTimeUpdates();
  }

  _select(value) {
    if (this.modal) this.modal.classList.remove('active');
    this._stopRecipientTimeUpdates();
    const cb = this.onSelect;
    this.onSelect = null;
    if (cb) cb(value);
  }

  _startRecipientTimeUpdates() {
    this._stopRecipientTimeUpdates();
    this._updateRecipientTimeNow();
    this._recipientTimeInterval = setInterval(() => this._updateRecipientTimeNow(), 30000);
  }

  _stopRecipientTimeUpdates() {
    if (this._recipientTimeInterval) {
      clearInterval(this._recipientTimeInterval);
      this._recipientTimeInterval = null;
    }
    if (this.recipientTime) {
      this.recipientTime.textContent = '';
      this.recipientTime.style.display = 'none';
    }
  }

  _updateRecipientTimeNow() {
    if (!this.recipientTime) return;
    const tz = getActiveChatContactTimeZone();
    if (!tz) {
      this.recipientTime.textContent = '';
      this.recipientTime.style.display = 'none';
      return;
    }

    const now = roundToMinuteMs(getCorrectedTimestamp());
    const s = formatTimeInTimeZone(now, tz);
    if (!s) {
      this.recipientTime.textContent = '';
      this.recipientTime.style.display = 'none';
      return;
    }

    this.recipientTime.textContent = `Recipient time: ${s}`;
    this.recipientTime.style.display = '';
  }
}

/**
 * Call Schedule Date Modal
 * Lets user pick date/time and submit
 */
class CallScheduleDateModal {
  constructor() {
    this.modal = null;
    this.form = null;
    this.dateInput = null;
    this.hourSelect = null;
    this.minuteSelect = null;
    this.ampmSelect = null;
    this.recipientTime = null;
    this.submitBtn = null;
    this.cancelBtn = null;
    this.closeBtn = null;
    this.onDone = null; // function(timestamp|null)
    this.DEFAULT_OFFSET_MINUTES = 0;
    this.maxDaysOut = 400;
    this.clockTimer = new ClockTimer('callScheduleCurrentTime');
    this._onSubmit = this._onSubmit.bind(this);
    this._onSubmitBtn = this._onSubmitBtn.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onInputChange = this._onInputChange.bind(this);
  }

  load() {
    this.modal = document.getElementById('callScheduleDateModal');
    if (!this.modal) return;
    this.form = document.getElementById('callScheduleDateForm');
    this.dateInput = document.getElementById('callScheduleDate');
    this.hourSelect = document.getElementById('callScheduleHour');
    this.minuteSelect = document.getElementById('callScheduleMinute');
    this.ampmSelect = document.getElementById('callScheduleAmPm');
    this.recipientTime = document.getElementById('callScheduleConvertedTime');
    this.submitBtn = document.getElementById('confirmCallSchedule');
    this.cancelBtn = document.getElementById('cancelCallScheduleDate');
    this.closeBtn = document.getElementById('closeCallScheduleDateModal');

    if (this.form) this.form.addEventListener('submit', this._onSubmit);
    if (this.submitBtn) this.submitBtn.addEventListener('click', this._onSubmitBtn);
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', this._onCancel);
    if (this.closeBtn) this.closeBtn.addEventListener('click', this._onCancel);

    // Live update of converted time preview (single listener for all inputs)
    if (this.form) this.form.addEventListener('change', this._onInputChange);
  }

  open(onDone) {
    this.onDone = onDone;
    const defaultDate = this._getDefaultDate();
    // Populate hours 1-12 (12-hour format)
    if (this.hourSelect) {
      this.hourSelect.innerHTML = '';
      for (let h = 1; h <= 12; h++) {
        const opt = document.createElement('option');
        opt.value = this._pad2(h);
        opt.textContent = this._pad2(h);
        this.hourSelect.appendChild(opt);
      }
      const hour24 = defaultDate.getHours();
      const hour12 = ((hour24 % 12) === 0) ? 12 : (hour24 % 12);
      this.hourSelect.value = this._pad2(hour12);
    }
    // Set AM/PM
    if (this.ampmSelect) {
      const hour24 = defaultDate.getHours();
      this.ampmSelect.value = hour24 >= 12 ? 'PM' : 'AM';
    }
    // Populate 5-minute list starting with 00, going to 55
    if (this.minuteSelect) {
      this.minuteSelect.innerHTML = '';
      const defaultMinute = defaultDate.getMinutes();
      
      // Always populate 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
      for (let i = 0; i < 12; i++) {
        const m = i * 5;
        const opt = document.createElement('option');
        opt.value = this._pad2(m);
        opt.textContent = this._pad2(m);
        this.minuteSelect.appendChild(opt);
      }
      
      // Pre-select the closest future time (round up to next 5-minute interval)
      const roundedMinute = Math.ceil(defaultMinute / 5) * 5;
      this.minuteSelect.value = this._pad2(roundedMinute % 60);
      
      // Handle hour rollover when minute rounds to 60
      if (roundedMinute === 60 && this.hourSelect && this.ampmSelect) {
        const currentHour12 = parseInt(this.hourSelect.value);
        const isAM = this.ampmSelect.value === 'AM';
        
        if (currentHour12 === 12) {
          this.hourSelect.value = '01';
          this.ampmSelect.value = isAM ? 'PM' : 'AM';
        } else {
          this.hourSelect.value = this._pad2(currentHour12 + 1);
        }
      }
    }
    // Set local date input
    if (this.dateInput) {
      const max = new Date();
      max.setDate(max.getDate() + this.maxDaysOut);
      this.dateInput.max = this._formatDateInput(max);

      this.dateInput.value = this._formatDateInput(defaultDate);
    }
    this.modal?.classList.add('active');
    this.clockTimer.start();

    // Render the initial converted time preview
    this._updateConvertedTimePreview();
  }

  _onSubmit(e) {
    if (e) e.preventDefault();
    this._submitValue();
  }
  _onSubmitBtn(e) {
    if (e) e.preventDefault();
    this._submitValue();
  }
  _onCancel() {
    this._closeWith(null);
  }

  _onInputChange() {
    this._updateConvertedTimePreview();
  }

  _getSelectedCorrectedTimestamp() {
    if (!this.dateInput || !this.hourSelect || !this.minuteSelect || !this.ampmSelect) return 0;
    const dateVal = this.dateInput.value;
    const hourVal = this.hourSelect.value;
    const minuteVal = this.minuteSelect.value;
    const ampmVal = this.ampmSelect.value;
    if (!dateVal || hourVal === '' || minuteVal === '') return 0;

    const parsed = this._parseDateInput(dateVal);
    const hour12 = Number(hourVal);
    const minute = Number(minuteVal);
    if (!parsed || Number.isNaN(hour12) || Number.isNaN(minute)) return 0;

    const hour24 = this._convert12To24(hour12, ampmVal);
    const { year, month, day } = parsed;
    const localMs = new Date(year, month - 1, day, hour24, minute, 0, 0).getTime();
    return localMs + timeSkew;
  }

  _updateConvertedTimePreview() {
    if (!this.recipientTime) return;

    const tz = getActiveChatContactTimeZone();
    const tsRaw = this._getSelectedCorrectedTimestamp();
    // Display-only: stabilize at the chosen minute even if timeSkew includes seconds.
    const ts = tsRaw ? roundToMinuteMs(tsRaw) : 0;

    if (!tz || !ts) {
      this.recipientTime.textContent = '';
      this.recipientTime.style.display = 'none';
      return;
    }

    const s = (() => {
      if (!tz || !ts) return '';
      try {
        const fmt = new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
        return fmt.format(new Date(ts));
      } catch (e) {
        return '';
      }
    })();

    if (!s) {
      this.recipientTime.textContent = '';
      this.recipientTime.style.display = 'none';
      return;
    }

    this.recipientTime.textContent = `Recipient time: ${s}`;
    this.recipientTime.style.display = '';
  }

  _submitValue() {
    if (!this.dateInput || !this.hourSelect || !this.minuteSelect || !this.ampmSelect) return;
    const dateVal = this.dateInput.value;
    const hourVal = this.hourSelect.value;
    const minuteVal = this.minuteSelect.value;
    const ampmVal = this.ampmSelect.value;
    if (!dateVal || hourVal === '' || minuteVal === '') {
      showToast('Please pick a date and time', 0, 'error');
      return;
    }
    const parsed = this._parseDateInput(dateVal);
    const hour12 = Number(hourVal);
    const minute = Number(minuteVal);
    if (!parsed || Number.isNaN(hour12) || Number.isNaN(minute)) {
      showToast('Invalid date/time selected', 0, 'error');
      return;
    }
    const hour24 = this._convert12To24(hour12, ampmVal);
    const { year, month, day } = parsed;
    const localMs = new Date(year, month - 1, day, hour24, minute, 0, 0).getTime();
    const corrected = localMs + timeSkew;
    const nowCorrected = getCorrectedTimestamp();
    const minAllowed = nowCorrected - 5 * 60 * 1000;

    // Max 400 days out
    const d = new Date(nowCorrected);
    d.setDate(d.getDate() + this.maxDaysOut);
    const maxAllowed = d.getTime();

    if (corrected < minAllowed) {
      showToast('Please choose a date or time in the future', 0, 'error');
      return;
    }
    if (corrected > maxAllowed) {
      showToast(`Please choose a date within the next ${this.maxDaysOut} days`, 0, 'error');
      return;
    }
    this._closeWith(corrected);
  }

  // Helpers
  _pad2(n) { return n < 10 ? '0' + n : '' + n; }

  _formatDateInput(d) {
    return `${d.getFullYear()}-${this._pad2(d.getMonth() + 1)}-${this._pad2(d.getDate())}`;
  }

  _roundUpToNextFiveMinutes(ms) {
    const d = new Date(ms);
    d.setSeconds(0, 0);
    const minutes = d.getMinutes();
    const rounded = Math.ceil(minutes / 5) * 5;
    if (rounded === 60) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    } else {
      d.setMinutes(rounded, 0, 0);
    }
    return d.getTime();
  }

  _getDefaultDate() {
    const nowMs = Date.now();
    const offsetMs = this.DEFAULT_OFFSET_MINUTES * 60 * 1000;
    const defaultMs = this._roundUpToNextFiveMinutes(nowMs + offsetMs);
    return new Date(defaultMs);
  }

  _parseDateInput(val) {
    const parts = val.split('-');
    if (parts.length !== 3) return null;
    const [yearStr, monthStr, dayStr] = parts;
    const year = Number(yearStr), month = Number(monthStr), day = Number(dayStr);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
    return { year, month, day };
  }

  _convert12To24(hour12, ampm) {
    if (ampm === 'AM') return hour12 === 12 ? 0 : hour12;
    return hour12 === 12 ? 12 : hour12 + 12;
  }

  _closeWith(value) {
    this.clockTimer.stop();
    if (this.modal) this.modal.classList.remove('active');
    const cb = this.onDone;
    this.onDone = null;

    // Hide converted time preview when closing
    if (this.recipientTime) {
      this.recipientTime.textContent = '';
      this.recipientTime.style.display = 'none';
    }
    if (cb) cb(value);
  }
}

const callScheduleChoiceModal = new CallScheduleChoiceModal();
const callScheduleDateModal = new CallScheduleDateModal();

/**
 * Failed Message Context Menu Class
 * @class
 * @description Handles the failed message context menu
 * @returns {void}
 */
class FailedMessageMenu {
  constructor() {
    this.menu = document.getElementById('failedMessageContextMenu');
    this.currentMessageEl = null;
  }

  /**
   * Loads the failed message context menu event listeners
   * @returns {void}
   */
  load() {
    if (!this.menu) return;

    // Menu option click handler
    this.menu.addEventListener('click', (e) => this.handleMenuAction(e));

    // Hide menu on outside click
    document.addEventListener('click', (e) => {
      if (this.menu.style.display === 'block' && !this.menu.contains(e.target)) {
        this.hide();
      }
    });
  }

  /**
   * Shows the context menu for a failed message
   * @param {Event} event - Click event
   * @param {HTMLElement} messageEl - The message element clicked
   */
  open(event, messageEl) {
    if (!this.menu) return;
    
    event.preventDefault();
    event.stopPropagation();
    this.currentMessageEl = messageEl;

    // Check if this is a video call message and hide retry option
    const isVideoCall = !!messageEl.querySelector('.call-message');
    const retryOption = this.menu.querySelector('[data-action="retry"]');
    
    if (isVideoCall) {
      retryOption.style.display = 'none';
    } else {
      retryOption.style.display = 'flex';
    }

    // Use shared positioning utility
    chatModal.positionContextMenu(this.menu, messageEl);
    this.menu.style.display = 'block';
  }

  /**
   * Hides the context menu
   */
  hide() {
    if (this.menu) {
      this.menu.style.display = 'none';
    }
    this.currentMessageEl = null;
  }

  /**
   * Handles context menu option clicks
   * @param {Event} e - Click event
   */
  handleMenuAction(e) {
    const option = e.target.closest('.context-menu-option');
    if (!option || !this.currentMessageEl) return;
    
    const action = option.dataset.action;
    const messageEl = this.currentMessageEl;
    this.hide();

    switch (action) {
      case 'retry':
        this.handleFailedMessageRetry(messageEl);
        break;
      case 'delete':
        this.handleFailedMessageDelete(messageEl);
        break;
    }
  }

  /**
   * When the user clicks the retry option in the context menu
   * It will fill the chat modal with the message content and txid of the failed message and focus the message input
   * @param {HTMLElement} messageEl - The message element that failed
   * @returns {void}
   */
  handleFailedMessageRetry(messageEl) {
    const txid = messageEl.dataset.txid;
    const voiceEl = messageEl.querySelector('.voice-message');

    // Voice message retry: resend the same voice message (no re-upload)
    if (voiceEl) {
      const voiceUrl = voiceEl.dataset.url || '';
      const duration = Number(voiceEl.dataset.duration || 0);

      if (!txid || !voiceUrl || !duration) {
        console.error('Error preparing voice message retry: Necessary elements or data missing.');
        return;
      }

      // Get message item to retrieve encryption keys
      const contact = myData.contacts[chatModal.address];
      if (!contact || !Array.isArray(contact.messages)) {
        console.error('Error preparing voice message retry: Contact/messages not found.');
        return;
      }
      const messageIndex = contact.messages.findIndex(msg => msg.txid === txid);
      
      if (messageIndex < 0) {
        console.error('Error preparing voice message retry: Message not found.');
        return;
      }

      const message = contact.messages[messageIndex];
      const pqEncSharedKey = message.audioPqEncSharedKey || message.pqEncSharedKey;
      const selfKey = message.audioSelfKey || message.selfKey;

      if (!pqEncSharedKey || !selfKey) {
        console.error('Error preparing voice message retry: Encryption keys not found.');
        return;
      }

      try {
        chatModal.retryOfTxId.value = txid;
        const pqEncSharedKeyBin = base642bin(pqEncSharedKey);
        void chatModal
          .sendVoiceMessageTx(voiceUrl, duration, pqEncSharedKeyBin, selfKey)
          .catch((err) => {
            console.error('Voice message retry failed:', err);
            showToast('Failed to retry voice message', 0, 'error');
          });
      } catch (err) {
        console.error('Voice message retry failed:', err);
        showToast('Failed to retry voice message', 0, 'error');
      }
      return;
    }

    // Text message retry: prefill input and store txid so next send removes failed tx
    const messageContent = messageEl.querySelector('.message-content')?.textContent;
    if (chatModal.messageInput && chatModal.retryOfTxId && messageContent && txid) {
      chatModal.messageInput.value = messageContent;
      chatModal.retryOfTxId.value = txid;
      
      // Trigger input event to ensure all listeners fire (byte counter, draft save, etc.)
      chatModal.messageInput.dispatchEvent(new Event('input'));
      
      // Manually resize textarea after browser has updated layout
      // requestAnimationFrame ensures scrollHeight is accurate
      requestAnimationFrame(() => {
        chatModal.messageInput.style.height = '48px';
        chatModal.messageInput.style.height = Math.min(chatModal.messageInput.scrollHeight, 120) + 'px';
      });
      
      chatModal.toggleSendButtonVisibility();
      chatModal.messageInput.focus();
      return;
    }

    console.error('Error preparing message retry: Necessary elements or data missing.');
  }

  /**
   * When the user clicks the delete option in the context menu
   * It will delete the message from all data stores using removeFailedTx and remove pending tx if exists
   * @param {HTMLElement} messageEl - The message element that failed
   * @returns {void}
   */
  handleFailedMessageDelete(messageEl) {
    const txid = messageEl.dataset.txid;

    if (txid) {
      const currentAddress = chatModal.address;
      removeFailedTx(txid, currentAddress);
      chatModal.appendChatModal();
    } else {
      console.error('Error deleting message: TXID not found.');
    }
  }
}

const failedMessageMenu = new FailedMessageMenu();

/**
 * Voice Recording Modal Class
 * @class
 * @description Handles the voice recording modal functionality
 * @returns {void}
 */
class VoiceRecordingModal {
  constructor() {
    this.mediaRecorder = null;
    this.recordedBlob = null;
    this.recordingStartTime = null;
    this.recordingStopTime = null;
    this.actualDuration = null;
    this.recordingInterval = null;
    this.currentAudio = null;
    this.playbackStartTime = null;
  }

  load() {
    // Get modal elements
    this.modal = document.getElementById('voiceRecordingModal');
    this.startRecordingButton = document.getElementById('startRecordingButton');
    this.stopRecordingButton = document.getElementById('stopRecordingButton');
    this.cancelRecordingButton = document.getElementById('cancelRecordingButton');
    this.cancelVoiceMessageButton = document.getElementById('cancelVoiceMessageButton');
    this.listenVoiceMessageButton = document.getElementById('listenVoiceMessageButton');
    this.sendVoiceMessageButton = document.getElementById('sendVoiceMessageButton');
    this.pauseResumeButton = document.getElementById('pauseResumeButton');
    this.stopListeningButton = document.getElementById('stopListeningButton');
    this.recordingIndicator = document.getElementById('recordingIndicator');
    this.recordingTimer = document.getElementById('recordingTimer');
    this.initialControls = document.getElementById('initialControls');
    this.recordingControls = document.getElementById('recordingControls');
    this.recordedControls = document.getElementById('recordedControls');
    this.listeningControls = document.getElementById('listeningControls');

    this.startRecordingButton.addEventListener('click', () => {
      this.startVoiceRecording();
    });
    this.stopRecordingButton.addEventListener('click', () => {
      this.stopVoiceRecording();
    });
    this.cancelRecordingButton.addEventListener('click', () => {
      this.cancelVoiceRecording();
    });
    this.cancelVoiceMessageButton.addEventListener('click', () => {
      this.cancelVoiceMessage();
    });
    this.listenVoiceMessageButton.addEventListener('click', () => {
      this.listenVoiceMessage();
    });
    this.pauseResumeButton.addEventListener('click', () => {
      this.togglePauseResume();
    });
    this.stopListeningButton.addEventListener('click', () => {
      this.stopListening();
    });
    this.sendVoiceMessageButton.addEventListener('click', () => {
      this.sendVoiceMessage();
    });
    // Close voice recording modal when clicking outside (only in initial state)
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal && this.canCloseModal()) {
        this.close();
      }
    });
  }

  /**
   * Check if the modal can be safely closed
   * Only allow closing when in initial state
   * @returns {boolean}
   */
  canCloseModal() {
    return this.initialControls.style.display !== 'none';
  }

  /**
   * Open the voice recording modal
   * @returns {void}
   */
  open() {
    this.modal.style.display = 'flex';
    this.resetUI();
  }

  /**
   * Close the voice recording modal
   * @returns {void}
   */
  close() {
    this.modal.style.display = 'none';
    this.cleanup();
  }

  /**
   * Reset the voice recording UI to initial state
   * @returns {void}
   */
  resetUI() {
    this.initialControls.style.display = 'flex';
    this.recordingControls.style.display = 'none';
    this.recordedControls.style.display = 'none';
    this.listeningControls.style.display = 'none';
    this.recordingTimer.textContent = '00:00';
    this.recordingIndicator.classList.remove('recording');
  }

  /**
   * Start voice recording
   * @returns {Promise<void>}
   */
  async startVoiceRecording() {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Initialize MediaRecorder
      const options = { 
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      };
      
      // Fallback to other formats if webm/opus is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = ''; // Let browser choose
          }
        }
      }

      this.mediaRecorder = new MediaRecorder(stream, options);
      
      const audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      this.mediaRecorder.onstop = () => {
        this.recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        this.showRecordedControls();
      };
      
      // Start recording
      this.mediaRecorder.start();
      this.recordingStartTime = Date.now();
      
      // Update UI
      this.initialControls.style.display = 'none';
      this.recordingControls.style.display = 'flex';
      this.recordingIndicator.classList.add('recording');
      
      // Start timer
      this.startRecordingTimer();
      
    } catch (error) {
      console.error('Error starting voice recording:', error);
      showToast('Could not access microphone. Please check permissions.', 0, 'error');
    }
  }

  /**
   * Stop voice recording
   * @returns {void}
   */
  stopVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.recordingStopTime = Date.now();
      // Calculate actual recording duration (excluding processing time)
      if (this.recordingStartTime) {
        this.actualDuration = Math.floor((this.recordingStopTime - this.recordingStartTime) / 1000);
      }
      this.stopRecordingTimer();
      this.recordingIndicator.classList.remove('recording');
    }
  }

  /**
   * Start the recording timer
   * @returns {void}
   */
  startRecordingTimer() {
    this.recordingInterval = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const seconds = Math.floor(elapsed / 1000);
      this.recordingTimer.textContent = this.formatDuration(seconds);
      
      // Stop recording after 5 minutes
      if (elapsed >= 5 * 60 * 1000) {
        this.stopVoiceRecording();
        showToast('Maximum recording time reached (5 minutes)', 3000, 'warning');
      }
    }, 1000);
  }

  /**
   * Stop the recording timer
   * @returns {void}
   */
  stopRecordingTimer() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  /**
   * Show recorded controls UI
   * @returns {void}
   */
  showRecordedControls() {
    this.recordingControls.style.display = 'none';
    this.recordedControls.style.display = 'flex';
  }

  /**
   * Cancel voice recording
   * @returns {void}
   */
  cancelVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      // Stop the stream tracks
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
    this.close();
  }

  /**
   * Cancel voice message
   * @returns {void}
   */
  cancelVoiceMessage() {
    this.close();
  }

  /**
   * Listen to recorded voice message
   * @returns {void}
   */
  listenVoiceMessage() {
    if (this.recordedBlob) {
      
      // Show listening controls and hide recorded controls
      this.recordedControls.style.display = 'none';
      this.listeningControls.style.display = 'flex';
      
      // Set initial button text and enable buttons
      this.pauseResumeButton.textContent = 'Pause';
      this.pauseResumeButton.disabled = false;
      this.stopListeningButton.disabled = false;
      
      // Start playback timer
      this.playbackStartTime = Date.now();
      this.recordingTimer.textContent = '00:00'; // Reset to 0:00 when starting
      this.startPlaybackTimer();
      
      const audioUrl = URL.createObjectURL(this.recordedBlob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        // Disable buttons before returning
        this.pauseResumeButton.disabled = true;
        this.stopListeningButton.disabled = true;
        
        // Add a small delay to prevent accidental button clicks
        setTimeout(() => {
          this.stopListening();
        }, 1000);
      };
      
      audio.onerror = (error) => {
        console.error('Error playing voice message:', error);
        showToast('Error playing voice message', 0, 'error');
        URL.revokeObjectURL(audioUrl);
        this.stopListening();
      };
      
      audio.play().catch(error => {
        console.error('Error playing voice message:', error);
        showToast('Error playing voice message', 0, 'error');
        this.stopListening();
      });
    }
  }

  /**
   * Start the playback timer (reuses recordingInterval)
   * @returns {void}
   */
  startPlaybackTimer() {
    this.recordingInterval = setInterval(() => {
      const elapsed = Date.now() - this.playbackStartTime;
      const seconds = Math.floor(elapsed / 1000);
      
      this.recordingTimer.textContent = this.formatDuration(seconds);
    }, 1000);
  }

  /**
   * Toggle pause/resume of voice message playback
   * @returns {void}
   */
  togglePauseResume() {
    if (!this.currentAudio) return;
    
    if (this.currentAudio.paused) {
      // Resume playback
      this.currentAudio.play();
      this.pauseResumeButton.textContent = 'Pause';
      // Resume timer
      this.playbackStartTime = Date.now() - (this.currentAudio.currentTime * 1000);
      this.startPlaybackTimer();
    } else {
      // Pause playback
      this.currentAudio.pause();
      this.pauseResumeButton.textContent = 'Resume';
      // Stop timer
      this.stopRecordingTimer();
    }
  }

  /**
   * Stop listening to voice message
   * @returns {void}
   */
  stopListening() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    // Stop playback timer first (reuses recordingInterval)
    this.stopRecordingTimer();
    
    // Reset timer to show duration immediately
    this.recordingTimer.textContent = this.formatDuration(this.actualDuration || 0);
    
    // Hide listening controls and show recorded controls
    this.listeningControls.style.display = 'none';
    this.recordedControls.style.display = 'flex';
  }

  /**
   * Send voice message
   * @returns {Promise<void>}
   */
  async sendVoiceMessage() {
    if (!this.recordedBlob) return;

    const loadingToastId = showToast('Sending voice message...', 0, 'loading');
    
    this.sendVoiceMessageButton.disabled = true;

    try {
      // Calculate duration
      const duration = this.getRecordingDuration();
      
      // Get recipient's DH key for encryption
      const { dhkey, cipherText: pqEncSharedKey } = await chatModal.getRecipientDhKey(chatModal.address);
      const password = myAccount.keys.secret + myAccount.keys.pqSeed;
      const selfKey = encryptData(bin2hex(dhkey), password, true);

      // Encrypt the audio file similar to attachments
      const audioArrayBuffer = await this.recordedBlob.arrayBuffer();
      const audioData = new Uint8Array(audioArrayBuffer);
      
      // Encrypt the audio data
      const worker = new Worker('encryption.worker.js', { type: 'module' });
      
      const encryptionPromise = new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          if (e.data.error) {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data.cipherBin);
          }
          worker.terminate();
        };
        
        worker.onerror = (error) => {
          reject(error);
          worker.terminate();
        };
      });
      
      // Send encryption job to worker
      worker.postMessage({
        fileBuffer: audioData.buffer,
        dhkey: dhkey
      }, [audioData.buffer]);
      
      const encryptedData = await encryptionPromise;
      
      // Upload encrypted audio file
      const blob = new Blob([new Uint8Array(encryptedData)], { type: 'application/octet-stream' });
      const form = new FormData();
      form.append('file', blob, `voice_message_${Date.now()}.webm`);

      const uploadUrl = network.attachmentServerUrl;
      const response = await fetch(`${uploadUrl}/post`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const { id } = await response.json();
      if (!id) throw new Error('No file ID returned from upload');

      const voiceMessageUrl = `${uploadUrl}/get/${id}`;
      
      // Capture reply state before sending (if user is replying to a message)
      const replyIdVal = chatModal.replyToTxId?.value?.trim?.() || '';
      const replyMsgVal = chatModal.replyToMessage?.value?.trim?.() || '';
      const replyOwnerIsMineVal = chatModal.replyOwnerIsMine?.value === '1';
      
      const replyInfo = replyIdVal ? {
        replyId: replyIdVal,
        replyMessage: replyMsgVal,
        replyOwnerIsMine: replyOwnerIsMineVal
      } : null;
      
      // Send the voice message through chat modal
      await chatModal.sendVoiceMessageTx(voiceMessageUrl, duration, pqEncSharedKey, selfKey, replyInfo);
      
      // Clear reply state after sending
      chatModal.cancelReply();

      this.close();
      
    } catch (error) {
      console.error('Error sending voice message:', error);
      showToast(`Failed to send voice message: ${error.message}`, 0, 'error');
    } finally {
      hideToast(loadingToastId);
      this.sendVoiceMessageButton.disabled = false;
    }
  }

  /**
   * Format duration from seconds to mm:ss
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get recording duration in seconds
   * @returns {number} Duration in seconds
   */
  getRecordingDuration() {
    // Use the actual duration calculated when recording stopped
    // This excludes processing time between stop and send
    return this.actualDuration || 0;
  }

  /**
   * Cleanup voice recording resources
   * @returns {void}
   */
  cleanup() {
    // Stop any ongoing recording
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    // Stop any current audio playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    // Clear timers
    this.stopRecordingTimer();
    
    // Reset state
    this.mediaRecorder = null;
    this.recordedBlob = null;
    this.recordingStartTime = null;
    this.recordingStopTime = null;
    this.actualDuration = null;
  }
}

const voiceRecordingModal = new VoiceRecordingModal();

/**
 * New Chat Modal Class
 * @class
 * @description Handles the new chat modal
 * @returns {void}
 */
class NewChatModal {
  constructor() {
    this.usernameInputCheckTimeout = null;
  }

  // Backend canonical shape: { account: { private: boolean } }
  // If the field is missing entirely (older accounts), default to public (false).
  getIsPrivateFromAccountResponse(accountRes) {
    const isPrivate = accountRes?.account?.private;
    return typeof isPrivate === 'boolean' ? isPrivate : false;
  }

  /**
   * Loads the new chat modal event listeners
   * @returns {void}
   */
  load() {
    this.modal = document.getElementById('newChatModal');
    this.closeNewChatModalButton = document.getElementById('closeNewChatModal');
    this.newChatForm = document.getElementById('newChatForm');
    this.usernameAvailable = document.getElementById('chatRecipientError');
    this.recipientInput = document.getElementById('chatRecipient');
    this.submitButton = document.querySelector('#newChatForm button[type="submit"]');

    this.closeNewChatModalButton.addEventListener('click', this.closeNewChatModal.bind(this));
    this.newChatForm.addEventListener('submit', this.handleNewChat.bind(this));
    this.recipientInput.addEventListener('input', debounce(this.handleUsernameInput.bind(this), 300));

    this.scanButton = document.getElementById('newChatScanQRButton');
    this.uploadButton = document.getElementById('newChatUploadQRButton');
    this.hiddenFileInput = document.getElementById('newChatQRFileInput');
    this.inviteButton = document.getElementById('newChatInviteButton');

    this.scanButton.addEventListener('click', () => this.scanUsernameFromQR());
    this.uploadButton.addEventListener('click', () => this.hiddenFileInput.click());
    this.hiddenFileInput.addEventListener('change', (e) => this.handleQRImageUpload(e.target.files?.[0] || null));
    this.inviteButton.addEventListener('click', () => this.handleInviteClick());
  }

  /**
   * Invoked when the user clicks the new chat button
   * It will open the new chat modal
   * @returns {void}
   */
  openNewChatModal() {
    this.modal.classList.add('active');
    footer.closeNewChatButton();
    this.usernameAvailable.style.display = 'none';
    this.submitButton.disabled = true;
    walletScreen.updateWalletBalances();
    // Delay focus to ensure transition completes (modal transition is 300ms)
    setTimeout(() => {
      this.recipientInput.focus();
    }, 325);
  }

  /**
   * Invoked when the user clicks the close button in the new chat modal
   * It will close the modal and reset the form
   * @returns {void}
   */
  closeNewChatModal() {
    this.modal.classList.remove('active');
    this.newChatForm.reset();
    if (chatsScreen.isActive()) {
      footer.openNewChatButton();
    }
    if (contactsScreen.isActive()) {
      footer.openNewChatButton();
    }
  }

  /**
   * Invoked when the user submits the new chat form
   * It will check if the username is valid, available, or not available
   * @param {Event} event - The event object
   * @returns {void}
   */
  async handleNewChat(event) {
    event.preventDefault();
    const input = this.recipientInput.value.trim();
    let recipientAddress;
    let username;

    this.hideRecipientError();

    // Check if input is an Ethereum address
    if (input.startsWith('0x')) {
      if (!isValidEthereumAddress(input)) {
        this.showRecipientError('Invalid Ethereum address format');
        return;
      }
      // Input is valid Ethereum address, normalize it
      recipientAddress = normalizeAddress(input);
    } else {
      if (input.length < 3) {
        this.showRecipientError('Username too short');
        return;
      }
      username = normalizeUsername(input);
      // Treat as username and lookup address
      const usernameBytes = utf82bin(username);
      const usernameHash = hashBytes(usernameBytes);
      try {
        const data = await queryNetwork(`/address/${usernameHash}`);
        if (!data || !data.address) {
          this.showRecipientError('Username not found');
          return;
        }
        // Normalize address from API if it has 0x prefix or trailing zeros
        recipientAddress = normalizeAddress(data.address);
      } catch (error) {
        console.error('Error looking up username:', error);
        this.showRecipientError('Error looking up username');
        return;
      }
    }

    // Prevent starting chats between private/public account types.
    // Note: username lookup may succeed regardless of type; enforce on submit.
    try {
      const myIsPrivate = !!myData?.account?.private;
      const recipientAccountRes = await queryNetwork(`/account/${longAddress(recipientAddress)}`);

      if (!recipientAccountRes?.account) {
        showToast('Account not found, try again.', 0, 'error');
        return;
      }
      const recipientIsPrivate = recipientAccountRes?.account?.private === true;

      if (recipientIsPrivate !== myIsPrivate) {
        showToast(`${myIsPrivate ? 'Private' : 'Public'} accounts can only chat with other ${myIsPrivate ? 'private' : 'public'} accounts.`, 0, 'error');
        return;
      }
    } catch (error) {
      console.error('Error checking account type:', error);
      showToast('Error checking account type', 0, 'error');
      return;
    }

    // Get or create chat data
    const chatsData = myData;

    // Check if contact exists
    if (!chatsData.contacts[recipientAddress]) {
      // Default to 2 (Acquaintance) so recipient does not need to pay toll.
      // Only create the local contact if the network inject succeeds.
      try {
        const res = await friendModal.postUpdateTollRequired(recipientAddress, 2);
        if (res?.result?.success !== true) {
          return;
        }
      } catch (error) {
        console.error('Error updating toll in create when creating new contact:', error);
        return;
      }

      createNewContact(recipientAddress, username, 2);
      // If the backend ultimately rejects this tx, the pending-tx failure handler
      // reverts `friend` back to `friendOld` so initializing fieldOld to toll required (1).
      chatsData.contacts[recipientAddress].friendOld = 1;
    }
    chatsData.contacts[recipientAddress].username = username;

    // Close new chat modal and open chat modal
    this.closeNewChatModal();
    chatModal.open(recipientAddress);
  }

  // Open camera scanner and fill username from scanned QR
  scanUsernameFromQR() {
    try {
      scanQRModal.fillFunction = (data) => {
        const user = this.parseUsernameFromQRData(data);
        if (user) {
          this.recipientInput.value = normalizeUsername(user);
          this.recipientInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          showToast('QR does not contain a username', 0, 'error');
        }
      };
      scanQRModal.open();
    } catch (e) {
      console.error('Error starting QR scan:', e);
      showToast('Unable to start camera for scanning.', 0, 'error');
    }
  }

  // Handle uploaded image; decode QR and fill username
  async handleQRImageUpload(file) {
    try {
      if (!file) return;
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });
      // Draw to a temporary canvas to get pixel data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxDim = 1024; // avoid huge images
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let decodedText = '';
      try {
        decodedText = qr.decodeQR({ data: imageData.data, width: imageData.width, height: imageData.height });
      } catch (err) {
        console.error('QR decode failed:', err);
        showToast('Could not decode QR from image.', 0, 'error');
        URL.revokeObjectURL(objectUrl);
        this.hiddenFileInput.value = '';
        return;
      }
      URL.revokeObjectURL(objectUrl);

      const user = this.parseUsernameFromQRData(decodedText);
      if (user) {
        this.recipientInput.value = normalizeUsername(user);
        this.recipientInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        showToast('QR does not contain a username.', 0, 'error');
      }
    } catch (e) {
      console.error('Error processing uploaded QR image:', e);
      showToast('Failed to process image.', 0, 'error');
    } finally {
      if (this.hiddenFileInput) this.hiddenFileInput.value = '';
    }
  }

  // Extract username from common QR payloads
  parseUsernameFromQRData(data) {
    if (!data || typeof data !== 'string') return null;
    // Expect strict format: liberdus://<base64(JSON)>
    if (!data.startsWith('liberdus://')) return null;
    try {
      const b64 = data.substring('liberdus://'.length);
      const json = bin2utf8(base642bin(b64));
      const obj = JSON.parse(json);
      const uname = normalizeUsername(String(obj?.u || ''));
      return uname && uname.length >= 3 ? uname : null;
    } catch (e) {
      console.error('Invalid liberdus QR format:', e);
      return null;
    }
  }

  /**
   * Hide error message in the new chat form
   * @returns {void}
   */
  hideRecipientError() {
    this.usernameAvailable.style.display = 'none';
  }

  /**
   * Show error message in the new chat form
   * @param {string} message - The error message to show
   * @returns {void}
   */
  showRecipientError(message) {
    this.usernameAvailable.textContent = message;
    this.usernameAvailable.style.color = '#dc3545'; // Always red for errors
    this.usernameAvailable.style.display = 'inline';
  }

  /**
   * Invoked when the user types in the username input
   * It will check if the username is too short, available, or not available
   * @param {Event} e - The event object
   * @returns {void}
   */
  handleUsernameInput(e) {
    this.usernameAvailable.style.display = 'none';
    this.submitButton.disabled = true;

    const username = normalizeUsername(e.target.value);
    e.target.value = username;

    // Clear previous timeout
    if (this.usernameInputCheckTimeout) {
      clearTimeout(this.usernameInputCheckTimeout);
    }

    // Check if username is too short
    if (username.length < 3) {
      this.usernameAvailable.textContent = 'too short';
      this.usernameAvailable.style.color = '#dc3545';
      this.usernameAvailable.style.display = 'inline';
      return;
    }

    // Check username availability
    this.usernameInputCheckTimeout = setTimeout(async () => {
      const taken = await checkUsernameAvailability(username, myAccount.keys.address);
      if (taken == 'taken') {
        this.usernameAvailable.textContent = 'found';
        this.usernameAvailable.style.color = '#28a745';
        this.usernameAvailable.style.display = 'inline';
        this.submitButton.disabled = false;
      } else if (taken == 'mine' || taken == 'available') {
        this.usernameAvailable.textContent = 'not found';
        this.usernameAvailable.style.color = '#dc3545';
        this.usernameAvailable.style.display = 'inline';
        this.submitButton.disabled = true;
      } else {
        this.usernameAvailable.textContent = 'network error';
        this.usernameAvailable.style.color = '#dc3545';
        this.usernameAvailable.style.display = 'inline';
        this.submitButton.disabled = true;
      }
    }, 1000);
  }

  /**
   * Invoked when the user clicks the Invite button
   * It will open the invite modal without closing newChatModal
   * @returns {void}
   */
  handleInviteClick() {
    inviteModal.open();
  }
}

const newChatModal = new NewChatModal();

// Create Account Modal
class CreateAccountModal {
  constructor() {
    this.checkTimeout = null;
  }

  load() {
    this.modal = document.getElementById('createAccountModal');
    this.form = document.getElementById('createAccountForm');
    this.usernameInput = document.getElementById('newUsername');
    this.privateKeyInput = document.getElementById('newPrivateKey');
    this.privateKeySection = document.getElementById('privateKeySection');
    this.toggleButton = document.getElementById('togglePrivateKeyInput');
    this.backButton = document.getElementById('closeCreateAccountModal');
    this.submitButton = this.form.querySelector('button[type="submit"]');
    this.usernameAvailable = document.getElementById('newUsernameAvailable');
    this.privateKeyError = document.getElementById('newPrivateKeyError');
    this.togglePrivateKeyVisibility = document.getElementById('togglePrivateKeyVisibility');
    this.migrateAccountsSection = document.getElementById('migrateAccountsSection');
    this.migrateAccountsButton = document.getElementById('migrateAccountsButton');
    this.toggleMoreOptions = document.getElementById('toggleMoreOptions');
    this.moreOptionsSection = document.getElementById('moreOptionsSection');
    this.privateAccountCheckbox = document.getElementById('togglePrivateAccount');
    this.privateAccountHelpButton = document.getElementById('privateAccountHelpButton');
    this.privateAccountTemplate = document.getElementById('privateAccountHelpMessageTemplate');

    // Setup event listeners
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.usernameInput.addEventListener('input', (e) => this.handleUsernameInput(e));
    this.toggleButton.addEventListener('change', () => this.handleTogglePrivateKeyInput());
    this.toggleMoreOptions.addEventListener('change', () => this.handleToggleMoreOptions());
    this.backButton.addEventListener('click', () => this.closeWithReload());

    // Add listener for the password visibility toggle
    this.togglePrivateKeyVisibility.addEventListener('click', () => {
      // Toggle the type attribute
      const type = this.privateKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
      this.privateKeyInput.setAttribute('type', type);
      // Toggle the visual state class on the button
      this.togglePrivateKeyVisibility.classList.toggle('toggled-visible');
    });

    // Add listener for the private account help button
    this.privateAccountHelpButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const message = this.getPrivateAccountHelpMessage();
      showToast(message, 0, 'info', true);
    });

    this.migrateAccountsButton.addEventListener('click', async () => await migrateAccountsModal.open());
  }

  open() {
    if (migrateAccountsModal.hasMigratableAccounts()) {
      this.migrateAccountsSection.style.display = 'block';
    } else {
      this.migrateAccountsSection.style.display = 'none';
    }

    this.modal.classList.add('active');
    enterFullscreen();
    // Delay focus to ensure transition completes (modal transition is 300ms)
    setTimeout(() => {
      this.usernameInput.focus();
    }, 325);
  }

  // we still need to keep this since it can be called by other modals
  close() {
    // reload the welcome page so that if accounts were migrated the signin button will be shown
    this.modal.classList.remove('active');
  }

  // this is called by the back button on the create account modal
  closeWithReload() {
    // reload the welcome page so that if accounts were migrated the signin button will be shown
    const newUrl = window.location.href.split('?')[0];
    window.location.replace(newUrl);

  }

  openWithReset() {
    // Clear form fields
    this.usernameInput.value = '';
    this.privateKeyInput.value = '';
    this.usernameAvailable.style.display = 'none';
    this.privateKeyError.style.display = 'none';
    
    // Reset More Options section
    this.toggleMoreOptions.checked = false;
    this.moreOptionsSection.style.display = 'none';
    this.toggleButton.checked = false;
    this.privateKeySection.style.display = 'none';
    this.privateAccountCheckbox.checked = false;
    
    // Open the modal
    this.open();
  }

  /**
   * Get the private account help message HTML
   * @returns {string}
   */
  getPrivateAccountHelpMessage() {
    return this.privateAccountTemplate?.innerHTML || 
      '<strong>What is a Private Account?</strong><br>Private accounts can only interact with other private accounts.';
  }

  /**
   * Check if the create account modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  handleUsernameInput(e) {
    const username = normalizeUsername(e.target.value);
    e.target.value = username;

    // Clear previous timeout
    if (this.checkTimeout) {
      clearTimeout(this.checkTimeout);
    }

    // Reset display
    this.usernameAvailable.style.display = 'none';
    this.submitButton.disabled = true;

    // Check if username is too short
    if (username.length < 3) {
      this.usernameAvailable.textContent = 'too short';
      this.usernameAvailable.style.color = '#dc3545';
      this.usernameAvailable.style.display = 'inline';
      return;
    }

    // Check network availability
    this.checkTimeout = setTimeout(async () => {
      const taken = await checkUsernameAvailability(username);
      if (taken == 'taken') {
        this.usernameAvailable.textContent = 'taken';
        this.usernameAvailable.style.color = '#dc3545';
        this.usernameAvailable.style.display = 'inline';
        this.submitButton.disabled = true;
      } else if (taken == 'available') {
        this.usernameAvailable.textContent = 'available';
        this.usernameAvailable.style.color = '#28a745';
        this.usernameAvailable.style.display = 'inline';
        this.submitButton.disabled = false;
      } else {
        this.usernameAvailable.textContent = 'network error';
        this.usernameAvailable.style.color = '#dc3545';
        this.usernameAvailable.style.display = 'inline';
        this.submitButton.disabled = true;
      }
    }, 1000);
  }

  handleTogglePrivateKeyInput() {
    const isChecked = this.toggleButton.checked;
    this.privateKeySection.style.display = isChecked ? 'block' : 'none';
    this.privateKeyInput.value = '';
    
    if (!isChecked) {
      this.privateKeyError.style.display = 'none';
    }
  }
  
  handleToggleMoreOptions() {
    const isChecked = this.toggleMoreOptions.checked;
    this.moreOptionsSection.style.display = isChecked ? 'block' : 'none';
    
    if (!isChecked) {
      // Reset private key options when more options is unchecked
      this.toggleButton.checked = false;
      // Hide private key section if More Options is unchecked
      this.privateKeySection.style.display = 'none';
      this.privateKeyInput.value = '';
      this.privateKeyError.style.display = 'none';
    }
  }

  validatePrivateKey(key) {
    // Trim whitespace
    key = key.trim();

    // Remove 0x prefix if present
    if (key.startsWith('0x')) {
      key = key.slice(2);
    }

    // Convert to lowercase
    key = key.toLowerCase();

    // Validate hex characters
    const hexRegex = /^[0-9a-f]*$/;
    if (!hexRegex.test(key)) {
      return {
        valid: false,
        message: 'Invalid characters - only 0-9 and a-f allowed',
      };
    }

    // Validate length (64 chars for 32 bytes)
    if (key.length !== 64) {
      return {
        valid: false,
        message: 'Invalid length - must be 64 hex characters',
      };
    }

    return {
      valid: true,
      key: key,
    };
  }

  async handleSubmit(event) {
    // Disable submit button
    this.submitButton.disabled = true;
    // disable migrate accounts button
    this.migrateAccountsButton.disabled = true;
    // Disable input fields, back button, and toggle button
    this.toggleButton.disabled = true;
    this.usernameInput.disabled = true;
    this.privateKeyInput.disabled = true;
    this.backButton.disabled = true;
    this.privateAccountCheckbox.disabled = true;

    event.preventDefault();
    
    // Validate username at submit time after normalization
    const username = normalizeUsername(this.usernameInput.value);
    
    // Check if username is too short after normalization
    if (username.length < 3) {
      this.usernameAvailable.textContent = 'too short';
      this.usernameAvailable.style.color = '#dc3545';
      this.usernameAvailable.style.display = 'inline';
      this.reEnableControls();
      return;
    }
    

    // Get network ID from network.js
    const { netid } = network;

    // Get existing accounts or create new structure
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Ensure netid and usernames objects exist
    if (!existingAccounts.netids[netid]) {
      existingAccounts.netids[netid] = { usernames: {} };
    }

    // Get private key from input or generate new one
    const providedPrivateKey = this.privateKeyInput.value;
    let privateKey, privateKeyHex;

    if (providedPrivateKey) {
      // Validate and normalize private key
      const validation = this.validatePrivateKey(providedPrivateKey);
      if (!validation.valid) {
        this.privateKeyError.textContent = validation.message;
        this.privateKeyError.style.color = '#dc3545';
        this.privateKeyError.style.display = 'inline';
        // Re-enable controls on validation failure
        this.reEnableControls();
        return;
      }

      privateKey = hex2bin(validation.key);
      privateKeyHex = validation.key;
      this.privateKeyError.style.display = 'none';
    } else {
      privateKey = generateRandomPrivateKey();
      privateKeyHex = bin2hex(privateKey);
      this.privateKeyError.style.display = 'none'; // Ensure hidden if generated
    }

    // Generate uncompressed public key
    const publicKey = getPublicKey(privateKey);
    const publicKeyHex = bin2hex(publicKey);
    const pqSeed = bin2hex(generateRandomBytes(64));

    // Generate address from public key
    const address = generateAddress(publicKey);
    const addressHex = bin2hex(address);

    // If a private key was provided, check if the derived address already exists on the network
    if (providedPrivateKey) {
      try {
        const accountCheckAddress = longAddress(addressHex);
        const accountInfo = await queryNetwork(`/account/${accountCheckAddress}`);

        // Check if the query returned data indicating an account exists.
        // This assumes a non-null `accountInfo` with an `account` property means it exists.
        if (accountInfo && accountInfo.account) {
          console.warn('Account already exists for this private key:', accountInfo);
          this.privateKeyError.textContent = 'An account already exists for this private key.';
          this.privateKeyError.style.color = '#dc3545';
          this.privateKeyError.style.display = 'inline';
          // Re-enable controls when account already exists
          this.reEnableControls();
          return; // Stop the account creation process
        } else {
          this.privateKeyError.style.display = 'none';
        }
      } catch (error) {
        console.error('Error checking for existing account:', error);
        this.privateKeyError.textContent = 'Network error checking key. Please try again.';
        this.privateKeyError.style.color = '#dc3545';
        this.privateKeyError.style.display = 'inline';
        // Re-enable controls on network error
        this.reEnableControls();
        return; // Stop process on error
      }
    }

    // Get or create account entry
    const isPrivateAccount = this.privateAccountCheckbox.checked;
    let waitingToastId = showToast('Creating account...', 0, 'loading');
    let res;

    try {
      await getNetworkParams();
      const storedKey = `${username}_${netid}`;
      myData = loadState(storedKey)
      if (myData && myData.account) {
        myAccount = myData.account;
      } else {
        // Create new account entry
        myAccount = {
          netid,
          username,
          chatTimestamp: 0,
          private: isPrivateAccount,
          keys: {
            address: addressHex,
            public: publicKeyHex,
            secret: privateKeyHex,
            type: 'secp256k1',
            pqSeed: pqSeed, // store only the 64 byte seed instead of 32,000 byte public and secret keys
          },
        };
        // create new data record if it doesn't exist
        myData = newDataRecord(myAccount);
      }
      res = await postRegisterAlias(username, myAccount.keys, myAccount.private || false);
    } catch (error) {
      this.reEnableControls();
      if (waitingToastId) hideToast(waitingToastId);
      showToast(`Failed to fetch network parameters, try again later.`, 0, 'error');
      console.error('Failed to fetch network parameters, using defaults:', error);
      return;
    }

    if (res && res.result && res.result.success && res.txid) {
      const txid = res.txid;

      try {
        // Start interval since trying to create account and tx should be in pending
        if (!checkPendingTransactionsIntervalId) {
          checkPendingTransactionsIntervalId = setInterval(checkPendingTransactions, 5000);
        }

        // Wait for the transaction confirmation
        const confirmationDetails = await pendingPromiseService.register(txid);
        if (
          confirmationDetails.username !== username ||
          confirmationDetails.address !== longAddress(myAccount.keys.address)
        ) {
          throw new Error('Confirmation details mismatch.');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (waitingToastId) hideToast(waitingToastId);
//        showToast('Account created successfully!', 3000, 'success');
        this.reEnableControls();
        this.close();
        welcomeScreen.close();
        // TODO: may not need to get set since gets set in `getChats`. Need to check signin flow.
        //getChats.lastCall = getCorrectedTimestamp();
        // Store updated accounts back in localStorage
        existingAccounts.netids[netid].usernames[username] = { address: myAccount.keys.address };
        localStorage.setItem('accounts', stringify(existingAccounts));
        saveState();
        // handleNativeAppSubscription();

        signInModal.open(username);
      } catch (error) {
        if (waitingToastId) hideToast(waitingToastId);
        console.error(`DEBUG: handleCreateAccount error`, JSON.stringify(error, null, 2));
        showToast(`account creation failed: ${error}`, 0, 'error');
        this.reEnableControls();

        // Clear interval
        if (checkPendingTransactionsIntervalId) {
          clearInterval(checkPendingTransactionsIntervalId);
          checkPendingTransactionsIntervalId = null;
        }

        clearMyData();

        // Note: `checkPendingTransactions` will also remove the item from `myData.pending` if it's rejected by the service.
        return;
      }
    } else {
      if (waitingToastId) hideToast(waitingToastId);
      console.error(`DEBUG: handleCreateAccount error in else`, JSON.stringify(res, null, 2));

      // Clear intervals
      if (checkPendingTransactionsIntervalId) {
        clearInterval(checkPendingTransactionsIntervalId);
        checkPendingTransactionsIntervalId = null;
      }
      if (getSystemNoticeIntervalId) {
        clearInterval(getSystemNoticeIntervalId);
        getSystemNoticeIntervalId = null;
      }

      clearMyData();

      // no toast here since injectTx will show it
      this.reEnableControls();
      return;
    }
  }

  reEnableControls() {
    this.submitButton.disabled = false;
    this.toggleButton.disabled = false;
    this.usernameInput.disabled = false;
    this.privateKeyInput.disabled = false;
    this.backButton.disabled = false;
    this.migrateAccountsButton.disabled = false;
    this.privateAccountCheckbox.disabled = false;
  }
}
// Initialize the create account modal
const createAccountModal = new CreateAccountModal();

/**
 * Send Asset Form Modal Class
 * @class
 * @description Handles the send asset form modal
 * @returns {void}
 */
class SendAssetFormModal {
  constructor() {
    this.username = null;
    this.sendAssetFormModalCheckTimeout = null;
    this.foundAddressObject = { address: null };
    this.needTollInfo = false;
    this.tollInfo = {};
    this.memoValidation = {}
  }

  /**
   * Loads the send asset form modal event listeners
   * @returns {void}
   */
  load() {
    this.modal = document.getElementById('sendAssetFormModal');
    this.closeSendAssetFormModalButton = document.getElementById('closeSendAssetFormModal');
    this.sendForm = document.getElementById('sendForm');
    this.usernameInput = document.getElementById('sendToAddress');
    this.amountInput = document.getElementById('sendAmount');
    this.memoInput = document.getElementById('sendMemo');
    this.retryTxIdInput = document.getElementById('retryOfPaymentTxId');
    this.usernameAvailable = document.getElementById('sendToAddressError');
    this.submitButton = document.querySelector('#sendForm button[type="submit"]');
    this.assetSelectDropdown = document.getElementById('sendAsset');
    this.balanceSymbol = document.getElementById('balanceSymbol');
    this.availableBalance = document.getElementById('availableBalance');
    this.toggleBalanceButton = document.getElementById('toggleBalance');
    this.tollMemoSpan = document.getElementById('tollMemo');
    // Add balance element references
    this.balanceAmount = document.getElementById('balanceAmount');
    this.transactionFee = document.getElementById('transactionFee');
    this.balanceWarning = document.getElementById('balanceWarning');
    this.memoLabel = document.querySelector('label[for="sendMemo"]');
    this.memoByteCounter = document.querySelector('.memo-byte-counter');

    // TODO add comment about which send form this is for chat or assets
    this.closeSendAssetFormModalButton.addEventListener('click', this.close.bind(this));
    this.sendForm.addEventListener('submit', this.handleSendFormSubmit.bind(this));
    // TODO: need to add check that it's not a back/delete key
    this.usernameInput.addEventListener('input', async (e) => {
      this.handleSendToAddressInput(e);
    });

    this.availableBalance.addEventListener('click', this.fillAmount.bind(this));
    this.assetSelectDropdown.addEventListener('change', () => {
      // updateSendAddresses();
      this.updateAvailableBalance();
    });
    // amount input listener for normalizing
    this.amountInput.addEventListener('input', () => this.amountInput.value = normalizeUnsignedFloat(this.amountInput.value));
    // amount input listener for real-time balance validation
    this.amountInput.addEventListener('input', this.updateAvailableBalance.bind(this));
    // Add custom validation message for minimum amount
    this.amountInput.addEventListener('invalid', (event) => {
      if (event.target.validity.rangeUnderflow) {
        event.target.setCustomValidity('Value must be at least 1 wei (1×10⁻¹⁸ LIB).');
      }
    });
    this.amountInput.addEventListener('input', (event) => {
      // Clear custom validity message when user types
      event.target.setCustomValidity('');
    });
    // Clear amount field on focus if it contains only "0"
    this.amountInput.addEventListener('focus', this.handleAmountFocus.bind(this));
    // event listener for toggle LIB/USD button
    this.toggleBalanceButton.addEventListener('click', this.handleToggleBalance.bind(this));
    this.memoInput.addEventListener('input', this.handleMemoInputChange.bind(this));

    //QR scanning
    this.scanQRButton = document.getElementById('scanQRButton');
    this.uploadQRButton = document.getElementById('uploadQRButton');
    this.qrFileInput = document.getElementById('qrFileInput');
    this.scanQRButton.addEventListener('click', () => scanQRModal.open());
    this.uploadQRButton.addEventListener('click', () => {this.qrFileInput.click();});
    this.qrFileInput.addEventListener('change', (event) => this.handleQRFileSelect(event, this));
  }

  /**
   * Opens the send asset modal
   * @returns {Promise<void>}
   */
  async open() {
    this.modal.classList.add('active');
    this.memoValidation = {};
    this.memoByteCounter.textContent = '';
    this.memoByteCounter.style.display = 'none';

    // Clear fields when opening the modal
    this.usernameInput.value = '';
    this.amountInput.value = '';
    this.memoInput.value = '';
    this.retryTxIdInput.value = '';
    this.tollMemoSpan.textContent = '';
    this.foundAddressObject.address = null;

    this.usernameAvailable.style.display = 'none';
    this.submitButton.disabled = true;
    scanQRModal.fillFunction = this.fillFromQR.bind(this); // set function to handle filling the payment form from QR data

    if (this.username) {
      this.usernameInput.value = this.username;
      setTimeout(() => {
        this.usernameInput.dispatchEvent(new Event('input'));
      }, 500);
      this.username = null;
    }

    await walletScreen.updateWalletBalances(); // Refresh wallet balances first
    // Get wallet data
    const wallet = myData.wallet;
    // Populate assets dropdown
    this.assetSelectDropdown.innerHTML = wallet.assets
      .map((asset, index) => `<option value="${index}">${asset.name} (${asset.symbol})</option>`)
      .join('');

    // Update addresses for first asset
    this.updateSendAddresses();
  }

  /**
   * Closes the send asset modal
   * @returns {Promise<void>}
   */
  async close() {
    chatsScreen.updateChatList();
    this.modal.classList.remove('active');
    this.sendForm.reset();
    this.username = null;
  }

  /**
   * Invoked when the user types in the username input
   * It will check if the username is too short, available, or not available
   * @param {Event} e - The event object
   * @returns {void}
   */
  async handleSendToAddressInput(e) {
    this.submitButton.disabled = true;

    // Check availability on input changes
    const username = normalizeUsername(e.target.value);
    e.target.value = username;
    const usernameAvailable = this.usernameAvailable;

    // Clear previous timeout
    if (this.sendAssetFormModalCheckTimeout) {
      clearTimeout(this.sendAssetFormModalCheckTimeout);
    }

    this.clearFormInfo();
    this.foundAddressObject.address = null;

    // Check if username is too short
    if (username.length < 3) {
      usernameAvailable.textContent = 'too short';
      usernameAvailable.style.color = '#dc3545';
      usernameAvailable.style.display = 'inline';
      await this.refreshSendButtonDisabledState();
      return;
    }

    // Check network availability
    this.sendAssetFormModalCheckTimeout = setTimeout(async () => {
      const taken = await checkUsernameAvailability(username, myAccount.keys.address, this.foundAddressObject);
      if (taken == 'taken') {
        usernameAvailable.textContent = 'found';
        usernameAvailable.style.color = '#28a745';
        usernameAvailable.style.display = 'inline';
      } else if (taken == 'mine') {
        usernameAvailable.textContent = 'mine';
        usernameAvailable.style.color = '#dc3545';
        usernameAvailable.style.display = 'inline';
      } else if (taken == 'available') {
        usernameAvailable.textContent = 'not found';
        usernameAvailable.style.color = '#dc3545';
        usernameAvailable.style.display = 'inline';
      } else {
        usernameAvailable.textContent = 'network error';
        usernameAvailable.style.color = '#dc3545';
        usernameAvailable.style.display = 'inline';
      }
      // check if found
      if (this.foundAddressObject.address) {
        this.needTollInfo = true;
        await this.validateForm();
      } else {
        await this.refreshSendButtonDisabledState();
      }
    }, 1000);
  }

  async validateForm() {
    if (this.needTollInfo) {
      const myAddr = longAddress(myAccount.keys.address);
      const contactAddr = longAddress(this.foundAddressObject.address);
      const sortedAddresses = [myAddr, contactAddr].sort();
      const chatId = hashBytes(sortedAddresses.join(''));
      const myIndex = sortedAddresses.indexOf(myAddr);
      const toIndex = 1 - myIndex;

      // query
      const tollInfo_ = await queryNetwork(`/messages/${chatId}/toll`);
      // query account for toll set by receiver
      const accountData = await queryNetwork(`/account/${this.foundAddressObject.address}`);
      const queriedToll = accountData?.account?.data?.toll; // type bigint
      const queriedTollUnit = accountData?.account?.data?.tollUnit; // type string
      this.tollInfo = {
        toll: queriedToll,
        tollUnit: queriedTollUnit,
        required: tollInfo_?.toll?.required?.[toIndex] ?? 1, // assume toll is required if not set
      };
      this.needTollInfo = false;
    }

    // memo byte size validation
    const memoText = this.memoInput.value;
    this.memoValidation = this.validateMemoSize(memoText);
    this.updateMemoByteCounter(this.memoValidation);

    if (this.tollInfo.required !== undefined && this.tollInfo.toll !== undefined) {
      // build string to display under memo input. with lib amoutn and (usd amount)
      /* const tollInfoString = `Toll:  */
      this.updateMemoTollUI();
      this.refreshSendButtonDisabledState();
    }
  }

  /**
   * validateMemoSize
   * @param {string} text - The text to validate
   * @returns {object} - The validation object
   */
  validateMemoSize(text) {
    const maxBytes = MAX_MEMO_BYTES;
    const byteSize = new Blob([text]).size;
    return {
      isValid: byteSize <= maxBytes,
      currentBytes: byteSize,
      remainingBytes: maxBytes - byteSize,
      percentage: (byteSize / maxBytes) * 100,
      maxBytes: maxBytes
    };
  }

  updateMemoByteCounter(validation) {
    // Only show counter when at 90% or higher
    if (validation.percentage >= 90) {
      
      if (validation.percentage > 100) {
        this.memoByteCounter.style.color = '#dc3545';
        this.memoByteCounter.textContent = `${validation.currentBytes - validation.maxBytes} bytes - over limit`;
      } else if (validation.percentage >= 90) {
        this.memoByteCounter.style.color = '#ffa726';
        this.memoByteCounter.textContent = `${validation.remainingBytes} bytes - left`;
      }
      this.memoByteCounter.style.display = 'inline';
    } else {
      this.memoByteCounter.style.display = 'none';
    }
  }
  /**
   * updateTollAmountUI
   */
  updateMemoTollUI() {
    this.tollMemoSpan.style.color = 'black';
    let toll = this.tollInfo.toll || 0n;
    const tollUnit = this.tollInfo.tollUnit || 'LIB';
    const decimals = 18;
    const factor = getStabilityFactor();
    const mainValue = parseFloat(big2str(toll, decimals));
    const usd = tollUnit === 'USD' ? mainValue : (mainValue * factor);
    const lib = factor > 0 ? (usd / factor) : NaN;
    const usdString = lib ? `${usd.toFixed(6)} USD (≈ ${lib.toFixed(6)} LIB)` : `${usd.toFixed(6)} USD`;
    let display;
    if (this.tollInfo.required == 1) {
      display = `${usdString}`;
      if (this.memoInput.value.trim() == '') {
        display = '';
      }
    } else if (this.tollInfo.required == 2) {
      this.tollMemoSpan.style.color = 'red';
      display = `blocked`;
    } else {
      // light green used to show success
      this.tollMemoSpan.style.color = '#28a745';
      display = `free; ${usdString}`;
    }
    //display the container
    if (display != '') {
      // want only the word "Toll:" to be black and bold
      display = '<span style="color: black;">Toll:</span> ' + display;
    }
    this.tollMemoSpan.innerHTML = display;
  }

  clearFormInfo() {
    this.tollMemoSpan.textContent = '';
  }

  handleMemoInputChange() {
    if (this.foundAddressObject.address) {
      this.validateForm();
    }
  }

  /**
   * Handles the send form submit
   * @param {Event} event - The event object
   * @returns {void}
   */
  async handleSendFormSubmit(event) {
    event.preventDefault();

    // Get form values
    const assetSymbol = this.assetSelectDropdown.options[this.assetSelectDropdown.selectedIndex].text;
    const amount = this.amountInput.value;
    const memo = this.memoInput.value;
    const confirmButton = sendAssetConfirmModal.confirmSendButton;
    const cancelButton = sendAssetConfirmModal.cancelButton;

    // Ensure recipient account type matches sender (public/private).
    try {
      const recipientRaw = this.foundAddressObject?.address;
      if (!recipientRaw) {
        showToast('Recipient address not resolved; enter a valid username', 0, 'error');
        return;
      }
      const recipientAddress = normalizeAddress(recipientRaw);

      await getNetworkParams();
      const myIsPrivate = !!myData?.account?.private;
      const recipientAccountRes = await queryNetwork(`/account/${longAddress(recipientAddress)}`);
      if (!recipientAccountRes?.account) {
        showToast('Account not found, try again.', 0, 'error');
        return;
      }
      const recipientIsPrivate = recipientAccountRes?.account?.private === true;
      if (recipientIsPrivate !== myIsPrivate) {
        showToast(`${myIsPrivate ? 'Private' : 'Public'} accounts can only send to other ${myIsPrivate ? 'private' : 'public'} accounts.`, 0, 'error');
        return;
      }
    } catch (error) {
      console.error('Error checking account type:', error);
      showToast('Error checking account type', 0, 'error');
      return;
    }

    const stabilityFactor = getStabilityFactor();

    // get `usdAmount` and `libAmount`
    let usdAmount;
    let libAmount;
    const isLib = this.balanceSymbol.textContent === 'LIB';
    if (!isLib) {
      usdAmount = this.amountInput.value;
      libAmount = amount / stabilityFactor;
    } else {
      usdAmount = amount * stabilityFactor;
      libAmount = amount;
    }

    // Update confirmation modal with values
    sendAssetConfirmModal.confirmAmountUSD.textContent = `≈ $${parseFloat(usdAmount).toFixed(6)} USD`;
    sendAssetConfirmModal.confirmRecipient.textContent = this.usernameInput.value;
    sendAssetConfirmModal.confirmAmount.textContent = `${libAmount}`;
    sendAssetConfirmModal.confirmAsset.textContent = assetSymbol;

    // Show/hide memo if present
    const memoGroup = sendAssetConfirmModal.confirmMemoGroup;
    if (memo) {
      sendAssetConfirmModal.confirmMemo.textContent = memo;
      memoGroup.style.display = 'block';
    } else {
      memoGroup.style.display = 'none';
    }

    confirmButton.disabled = false;
    cancelButton.disabled = false;
    sendAssetConfirmModal.open();
  }

  /**
   * Fills the amount input with the available balance
   * @returns {void}
   */
  async fillAmount() {
    await getNetworkParams();
    const asset = myData.wallet.assets[this.assetSelectDropdown.value];
    const feeInWei = getTransactionFeeWei();
    const maxAmount = BigInt(asset.balance) - feeInWei;
    const maxAmountStr = big2str(maxAmount > 0n ? maxAmount : 0n, 18).slice(0, -16);

    // Check if we're in USD mode
    const isUSD = this.balanceSymbol.textContent === 'USD';

    if (isUSD) {
      // Convert to USD before displaying
      const stabilityFactor = getStabilityFactor();
      this.amountInput.value = (parseFloat(maxAmountStr) * stabilityFactor).toString();
    } else {
      // Display in LIB
      this.amountInput.value = maxAmountStr;
    }
    this.amountInput.dispatchEvent(new Event('input'));
  }

  /**
   * Updates the available balance in the send asset modal based on the asset
   * @returns {void}
   */
  async updateAvailableBalance() {
    const walletData = myData.wallet;
    const assetIndex = this.assetSelectDropdown.value;

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
      this.updateBalanceDisplay(null);
      // If no assets, amount validation will likely fail or be irrelevant.
      // Button state should reflect this.
      await this.refreshSendButtonDisabledState();
      return;
    }

    this.updateBalanceDisplay(walletData.assets[assetIndex]);
    await this.refreshSendButtonDisabledState();
  }

  /**
   * Updates the balance display in the send asset modal based on the asset
   * @param {object} asset - The asset to update the balance display for
   * @returns {void}
   */
  async updateBalanceDisplay(asset) {
    if (!asset) {
      this.balanceAmount.textContent = '0.0000';
      this.transactionFee.textContent = '0.00';
      return;
    }

    await getNetworkParams();
    const txFeeInLIB = getTransactionFeeWei();
    const stabilityFactor = getStabilityFactor();

    // Preserve the current toggle state (LIB/USD) instead of overwriting it
    const currentSymbol = this.balanceSymbol.textContent;
    const isCurrentlyUSD = currentSymbol === 'USD';

    // Only set to asset symbol if it's empty (initial state)
    if (!currentSymbol) {
      this.balanceSymbol.textContent = asset.symbol;
    }

    const balanceInLIB = big2str(BigInt(asset.balance), 18).slice(0, -12);
    const feeInLIB = big2str(txFeeInLIB, 18).slice(0, -16);

    this.updateBalanceAndFeeDisplay(balanceInLIB, feeInLIB, isCurrentlyUSD, stabilityFactor);
  }

  /**
   * Updates the send addresses for the first asset
   * @returns {void}
   */
  updateSendAddresses() {
    const walletData = myData.wallet;
    // const assetIndex = document.getElementById('sendAsset').value;

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
      showToast('No addresses available', 0, 'error');
      return;
    }

    // Update available balance display
    this.updateAvailableBalance();
  }

  /**
   * Refreshes the disabled state of the send button based on the username and amount
   * @returns {Promise<void>}
   */
  async refreshSendButtonDisabledState() {
    // If offline, keep button disabled
    if (!isOnline) {
      this.submitButton.disabled = true;
      return;
    }

    // Address is valid if its error/status message is visible and set to 'found'.
    const isAddressConsideredValid =
      this.usernameAvailable.style.display === 'inline' && this.usernameAvailable.textContent === 'found';

    const amount = this.amountInput.value.trim();

    if (amount == '' || parseFloat(amount) == 0) {
      this.balanceWarning.textContent = '';
      this.balanceWarning.style.display = 'none';
      this.submitButton.disabled = true;
      return;
    }

    const assetIndex = this.assetSelectDropdown.value;

    // Check if amount is in USD and convert to LIB for validation
    const isUSD = this.balanceSymbol.textContent === 'USD';
    let amountForValidation = amount;
    if (isUSD && amount) {
      await getNetworkParams();
      const stabilityFactor = getStabilityFactor();
      amountForValidation = parseFloat(amount) / stabilityFactor;
    }

    // convert amount to bigint
    const amountBigInt = bigxnum2big(wei, amountForValidation.toString());

    // returns false if the amount/balance is invalid.
    const isAmountAndBalanceValid = await validateBalance(amountBigInt, assetIndex, this.balanceWarning);

    let isAmountAndTollValid = true;
    if (this.foundAddressObject.address) {
      if (this.amountInput.value.trim() != '') {
        isAmountAndTollValid = this.validateToll(amountBigInt);
      }
    }
    // Enable button only if both conditions are met.
    if (isAddressConsideredValid && isAmountAndBalanceValid && isAmountAndTollValid && this.memoValidation.isValid) {
      this.submitButton.disabled = false;
    } else {
      this.submitButton.disabled = true;
    }
  }

  validateToll(amount) {
    // check if user is required to pay a toll
    if (this.tollInfo.required == 1) {
      if (this.memoInput.value.trim() != '') {
        const factor = getStabilityFactor();
        let amountInLIB = amount;
        let tollInLIB = this.tollInfo.toll;
        if (this.tollInfo.tollUnit !== 'LIB') {
          tollInLIB = bigxnum2big(this.tollInfo.toll, (1.0 / factor).toString());
        }
        if (tollInLIB > amountInLIB) {
          this.balanceWarning.textContent = 'less than toll for memo';
          this.balanceWarning.style.display = 'inline';
          return false;
        }
      }
    }
    if (this.tollInfo.required == 2) {
      return false;
    }
    return true;
  }

  /**
   * This function is called when the user clicks the toggle LIB/USD button.
   * Updates the balance symbol and the send amount to the equivalent value in USD/LIB
   * @param {Event} e - The event object
   * @returns {void}
   */
  async handleToggleBalance(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    this.balanceSymbol.textContent = this.balanceSymbol.textContent === 'LIB' ? 'USD' : 'LIB';

    // check the context value of the button to determine if it's LIB or USD
    const isLib = this.balanceSymbol.textContent === 'LIB';

    // get the scalability factor for LIB/USD conversion
    await getNetworkParams();
    const stabilityFactor = getStabilityFactor();

    // Get the raw values in LIB format
    const asset = myData.wallet.assets[this.assetSelectDropdown.value];
    const txFeeInWei = getTransactionFeeWei();
    const balanceInLIB = big2str(BigInt(asset.balance), 18).slice(0, -12);
    const feeInLIB = big2str(txFeeInWei, 18).slice(0, -16);

    // if isLib is false, convert the sendAmount to USD
    if (!isLib) {
      this.amountInput.value = this.amountInput.value * stabilityFactor;
    } else {
      this.amountInput.value = this.amountInput.value / stabilityFactor;
    }

    this.updateBalanceAndFeeDisplay(balanceInLIB, feeInLIB, !isLib, stabilityFactor);
  }

  /**
   * Handles focus event on amount input field
   * Clears the field if it contains only "0" to improve user experience
   * @param {Event} e - The focus event object
   * @returns {void}
   */
  handleAmountFocus(e) {
    const input = e.target;
    const value = input.value.trim();
    
    // Clear the field if the numeric value is 0
    if (parseFloat(value) === 0) {
      input.value = '';
    }
  }

  /**
   * Updates the display of balance and fee amounts with appropriate formatting
   * @param {string} balanceInLIB - The balance amount in LIB
   * @param {string} feeInLIB - The fee amount in LIB
   * @param {boolean} isUSD - Whether to display in USD format
   * @param {number} stabilityFactor - The factor to convert between LIB and USD
   */
  updateBalanceAndFeeDisplay(balanceInLIB, feeInLIB, isUSD, stabilityFactor) {
    if (isUSD) {
      this.balanceAmount.textContent = '$' + (parseFloat(balanceInLIB) * stabilityFactor).toPrecision(6);
      this.transactionFee.textContent = '$' + (parseFloat(feeInLIB) * stabilityFactor).toPrecision(2);
    } else {
      this.balanceAmount.textContent = balanceInLIB + ' LIB';
      this.transactionFee.textContent = feeInLIB + ' LIB';
    }
  }

  /**
   * Reopens the send asset form modal with the previous values
   * @returns {Promise<void>}
   */
  async reopen() {
    const tempUsername = this.usernameInput?.value;
    const tempAmount = this.amountInput?.value;
    const tempMemo = this.memoInput?.value;
    await this.close();
    this.username = tempUsername;
    await this.open();
    this.amountInput.value = tempAmount;
    this.memoInput.value = tempMemo || '';
  }

  /**
   * Check if the send asset form modal is active
   * @returns {boolean}
   */
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  /**
   * Resets the form fields to empty values
   * @returns {void}
   */
  resetForm(){
    this.sendForm?.reset();
    this.usernameAvailable.textContent = '';
    this.balanceWarning.textContent = '';
  }

  /**   * Handles QR file selection and decoding
   * @param {Event} event - The file input change event
   * @param {Object} targetModal - The modal instance to fill with QR data
   * @returns {Promise<void>}
   * */
  async handleQRFileSelect(event, targetModal) {
    const file = event.target.files[0];
    if (!file) {
      return; // No file selected
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      const img = new Image();
      img.onload = async function () {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          console.error('Could not get 2d context from canvas');
          showToast('Error processing image', 0, 'error');
          event.target.value = ''; // Reset file input
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        const imageData = context.getImageData(0, 0, img.width, img.height);

        try {
          // Use qr.js library for decoding
          const decodedData = qr.decodeQR({
            data: imageData.data,
            width: imageData.width,
            height: imageData.height,
          });

          if (decodedData) {
            if (typeof targetModal.fillFromQR === 'function') {
              targetModal.fillFromQR(decodedData); // Call the provided fill function
            } else {
              console.error('No valid fill function provided for QR file select');
              // Fallback or default behavior if needed, e.g., show generic error
              showToast('Internal error handling QR data', 0, 'error');
            }
          } else {
            // qr.decodeQR might throw an error instead of returning null/undefined
            // This else block might not be reached if errors are always thrown
            console.error('No QR code found in image (qr.js)');
            showToast('No QR code found in image', 0, 'error');
            // Clear the form fields in case of failure to find QR code
            targetModal.resetForm();
          }
        } catch (error) {
          console.error('Error processing QR code image with qr.js:', error);
          // Assume error means no QR code found or decoding failed
          showToast('Could not read QR code from image', 0, 'error');
          // Clear the form fields in case of error
          targetModal.resetForm();

        } finally {
          event.target.value = ''; // Reset the file input value regardless of outcome
        }
      };
      img.onerror = function () {
        console.error('Error loading image');
        showToast('Error loading image file', 0, 'error');
        event.target.value = ''; // Reset the file input value
        // Clear the form fields in case of image loading error
        targetModal.resetForm();
      };
      img.src = e.target.result;
    };

    reader.onerror = function () {
      console.error('Error reading file');
      showToast('Error reading file', 0, 'error');
      event.target.value = ''; // Reset the file input value
    };

    reader.readAsDataURL(file);
  }

  /**
   * Fills the payment form from QR code data
   * @param {string} data - The QR code data to fill the form with
   * @returns {void}
   * */
  async fillFromQR(data) {
    // Explicitly check for the required prefix
    if (!data || !data.startsWith('liberdus://')) {
      console.error("Invalid payment QR code format. Missing 'liberdus://' prefix.", data);
      showToast('Invalid payment QR code format.', 0, 'error');
      // Optionally clear fields or leave them as they were
      this.usernameInput.value = '';
      this.amountInput.value = '';
      this.memoInput.value = '';
      return; // Stop processing if the format is wrong
    }

    // Clear existing fields first
    this.usernameInput.value = '';
    this.amountInput.value = '';
    this.memoInput.value = '';

    try {
      // Remove the prefix and process the base64 data
      const base64Data = data.substring('liberdus://'.length);
      const jsonData = bin2utf8(base642bin(base64Data));
      const paymentData = JSON.parse(jsonData);

      if (paymentData.u) {
        this.usernameInput.value = paymentData.u;
      }
      if (paymentData.d) {
        try {
          const symbol = String(paymentData.d).toUpperCase();
          const current = String(this.balanceSymbol.textContent || 'LIB').toUpperCase();
          if (symbol === 'USD' && current !== 'USD') {
            // call the existing toggle handler to reuse conversion logic
            await this.handleToggleBalance();
          } else if (symbol === 'LIB' && current !== 'LIB') {
            await this.handleToggleBalance();
          }
        } catch (err) {
          console.error('Error toggling balance from QR display unit field', err);
        }
      }
      if (paymentData.a) {
        this.amountInput.value = paymentData.a;
      }
      if (paymentData.m) {
        this.memoInput.value = paymentData.m;
      }

      // Trigger username validation and amount validation
      this.usernameInput.dispatchEvent(new Event('input'));
      this.amountInput.dispatchEvent(new Event('input'));
    } catch (error) {
      console.error('Error parsing payment QR data:', error, data);
      showToast('Failed to parse payment QR data.', 0, 'error');
      // Clear fields on error
      this.usernameInput.value = '';
      this.amountInput.value = '';
      this.memoInput.value = '';
    }
  }  
}

const sendAssetFormModal = new SendAssetFormModal();

class SendAssetConfirmModal {
  constructor() {
    this.timestamp = getCorrectedTimestamp();
  }

  load() {
    this.modal = document.getElementById('sendAssetConfirmModal');
    this.confirmAmount = document.getElementById('confirmAmount');
    this.confirmAmountUSD = document.getElementById('confirmAmountUSD');
    this.confirmAsset = document.getElementById('confirmAsset');
    this.confirmMemo = document.getElementById('confirmMemo');
    this.confirmRecipient = document.getElementById('confirmRecipient');
    this.confirmSendButton = document.getElementById('confirmSendButton');
    this.closeButton = document.getElementById('closeSendAssetConfirmModal');
    this.cancelButton = document.getElementById('cancelSendButton');
    this.confirmMemoGroup = document.getElementById('confirmMemoGroup');

    // Add event listeners for send asset confirmation modal
    this.closeButton.addEventListener('click', this.close.bind(this));
    this.confirmSendButton.addEventListener('click', this.handleSendAsset.bind(this));
    this.cancelButton.addEventListener('click', this.close.bind(this));
  }

  open() {
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }
  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  // The user has filled out the form to send assets to a recipient and clicked the Send button
  // The recipient account may not exist in myData.contacts and might have to be created
  /**
   * Handle the send asset event
   * @param {Event} event - The event object
   * @returns {Promise<void>}- A promise that resolves when the send asset event is handled
   */
  async handleSendAsset(event) {
    event.preventDefault();
    const confirmButton = this.confirmSendButton;
    const cancelButton = this.cancelButton;
    const username = normalizeUsername(sendAssetFormModal.usernameInput.value);

    // if it's your own username disable the send button
    if (username == myAccount.username) {
      confirmButton.disabled = true;
      showToast('You cannot send assets to yourself', 0, 'error');
      return;
    }

    if (getCorrectedTimestamp() - this.timestamp < 2000 || confirmButton.disabled) {
      return;
    }

    confirmButton.disabled = true;
    cancelButton.disabled = true;

    this.timestamp = getCorrectedTimestamp();
    const wallet = myData.wallet;
    const assetIndex = sendAssetFormModal.assetSelectDropdown.value; // TODO include the asset id and symbol in the tx
    const amount = bigxnum2big(wei, sendAssetFormModal.amountInput.value);
    const memoIn = sendAssetFormModal.memoInput.value || '';
    const memo = memoIn.trim();
    const keys = myAccount.keys;
    let toAddress;

    // Validate amount including transaction fee
    if (!(await validateBalance(amount, assetIndex))) {
      await getNetworkParams();
      const txFeeInLIB = getTransactionFeeWei();
      const balance = BigInt(wallet.assets[assetIndex].balance);
      const amountStr = big2str(amount, 18).slice(0, -16);
      const feeStr = big2str(txFeeInLIB, 18).slice(0, -16);
      const balanceStr = big2str(balance, 18).slice(0, -16);
      showToast(`Insufficient balance: ${amountStr} + ${feeStr} (fee) > ${balanceStr} LIB. Go to the wallet to add more LIB`, 0, 'error');
      cancelButton.disabled = false;
      return;
    }

    // Validate username - must be username; address not supported
    if (username.startsWith('0x')) {
      showToast('Address not supported; enter username instead.', 0, 'error');
      cancelButton.disabled = false;
      return;
    }
    if (username.length < 3) {
      showToast('Username too short', 0, 'error');
      cancelButton.disabled = false;
      return;
    }
    try {
      // Look up username on network
      const usernameBytes = utf82bin(username);
      const usernameHash = hashBytes(usernameBytes);
      /*
          const selectedGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
          const response = await fetch(`${selectedGateway.protocol}://${selectedGateway.host}:${selectedGateway.port}/address/${usernameHash}`);
          const data = await response.json();
  */
      const data = await queryNetwork(`/address/${usernameHash}`);
      if (!data || !data.address) {
        showToast('Username not found', 0, 'error');
        cancelButton.disabled = false;
        return;
      }
      toAddress = normalizeAddress(data.address);
    } catch (error) {
      console.error('Error looking up username:', error);
      showToast('Error looking up username', 0, 'error');
      cancelButton.disabled = false;
      return;
    }

    if (!myData.contacts[toAddress]) {
      createNewContact(toAddress, username, 2);
    }

    /* Support sending payments to addresses that do not have
      any EC publicKey or PQ publicKey. If any key is missing then we do not
      include a memo or senderInfo. Thus we should be able to send a 
      payment to any address. We might not ever use this feature though.
    */

    // Ensure recipient keys exist locally; function handles local check and network fetch.
    await ensureContactKeys(toAddress);
    const recipientPubKey = myData.contacts[toAddress]?.public;
    const pqRecPubKey = myData.contacts[toAddress]?.pqPublic;
    let pqEncSharedKey = '';
    let dhkey = '';
    let selfKey = '';
    let sharedKeyMethod = 'none';  // to support sending just payment to any address
    if (recipientPubKey && pqRecPubKey) {
      /*
      // Generate shared secret using ECDH and take first 32 bytes
      let dhkey = ecSharedKey(keys.secret, recipientPubKey);
      const { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey);
      const combined = new Uint8Array(dhkey.length + sharedSecret.length);
      combined.set(dhkey);
      combined.set(sharedSecret, dhkey.length);
      dhkey = deriveDhKey(combined);
      */
      const x = dhkeyCombined(keys.secret, recipientPubKey, pqRecPubKey)
      dhkey = x.dhkey;
      const cipherText = x.cipherText;
      pqEncSharedKey = bin2base64(cipherText);
      sharedKeyMethod = 'pq';
      selfKey = encryptData(bin2hex(dhkey), keys.secret+keys.pqSeed, true)  // used to decrypt our own message
    }

    let encMemo = '';
    if (memo && sharedKeyMethod !== 'none') {
      const memoObj = {
        type: "transfer",
        message: memo
      };
      // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
      // Encrypt message using shared secret
      encMemo = encryptChacha(dhkey, stringify(memoObj));
    }

    // only include the sender info if the recipient is is a friend and has a pqKey
    let encSenderInfo = '';
    let senderInfo = '';
    if (sharedKeyMethod != 'none'){
      const friendLevel = Number(myData.contacts[toAddress]?.friend) || 0;

      // Always include username; include additional info only for full friends
      senderInfo = {
        username: myAccount.username,
      };

      if (friendLevel === 2) {
        senderInfo.name = myData.account.name;
        senderInfo.linkedin = myData.account.linkedin;
        senderInfo.x = myData.account.x;
        // Add avatar info if available
        if (myData.account.avatarId && myData.account.avatarKey) {
          senderInfo.avatarId = myData.account.avatarId;
          senderInfo.avatarKey = myData.account.avatarKey;
        }
        // Add timezone if available
        const tz = getLocalTimeZone();
        if (tz) {
          senderInfo.timezone = tz;
        }
      }

      encSenderInfo = encryptChacha(dhkey, stringify(senderInfo));
    } else {
      senderInfo = { username: myAccount.address };
      encSenderInfo = stringify(senderInfo);
    }
    // Create message payload
    const payload = {
      message: encMemo, // we need to call this field message, so we can use decryptMessage()
      senderInfo: encSenderInfo,
      encrypted: true,
      encryptionMethod: 'xchacha20poly1305',
      pqEncSharedKey: pqEncSharedKey,
      selfKey: selfKey,
      sharedKeyMethod: sharedKeyMethod,
      sent_timestamp: getCorrectedTimestamp(),
    };

    try {
      // Send the transaction using postAssetTransfer
      const response = await postAssetTransfer(toAddress, amount, payload, keys);

      if (!response || !response.result || !response.result.success) {
        const str = response.result.reason;
        const regex = /toll/i;

        if (str.match(regex) || str.match(/at least/i)) {
          await sendAssetFormModal.reopen();
        }
        throw new Error('Transaction failed');
      }

      // hidden input field retryOfTxId value is not an empty string
      if (sendAssetFormModal.retryTxIdInput.value) {
        // remove from myData use txid from hidden field retryOfPaymentTxId
        removeFailedTx(sendAssetFormModal.retryTxIdInput.value, toAddress);

        // clear the field
        failedTransactionModal.txid = '';
        failedTransactionModal.address = '';
        failedTransactionModal.memo = '';
        sendAssetFormModal.retryTxIdInput.value = '';
      }

      /* if (!response || !response.result || !response.result.success) {
              alert('Transaction failed: ' + response.result.reason);
              return;
          } */

      // Create contact if it doesn't exit
      /* if (!myData.contacts[toAddress].messages) {
        const username = document.getElementById('sendToAddress').value;
        createNewContact(toAddress, username, 2);
        // TODO can pass the username to createNewConact and get rid of the following line
        // myData.contacts[toAddress].username = normalizeUsername(recipientInput);
      } */

      // Add transaction to history
      const currentTime = getCorrectedTimestamp();

      const newPayment = {
        txid: response.txid,
        amount: amount,
        sign: -1,
        timestamp: currentTime,
        address: toAddress,
        memo: memo,
        status: 'sent',
      };
      insertSorted(wallet.history, newPayment, 'timestamp');

      // Don't try to update the balance here; the tx might not have gone through; let user refresh the balance from the wallet page
      // Maybe we can set a timer to check on the status of the tx using txid and update the balance if the txid was processed
      /*
          // Update local balance after successful transaction
          fromAddress.balance -= amount;
          walletData.balance = walletData.assets.reduce((total, asset) =>
              total + asset.addresses.reduce((sum, addr) => sum + bigxnum2num(addr.balance, asset.price), 0), 0);
          // Update wallet view and close modal
          updateWalletView();
  */

      // --- Create and Insert Sent Transfer Message into contact.messages ---
      const transferMessage = {
        timestamp: currentTime,
        sent_timestamp: currentTime,
        my: true, // Sent transfer
        message: memo, // Use the memo as the message content
        amount: amount, // Use the BigInt amount
        symbol: 'LIB', // TODO: Use the asset symbol
        txid: response.txid,
        status: 'sent',
      };
      // Insert the transfer message into the contact's message list, maintaining sort order
      insertSorted(myData.contacts[toAddress].messages, transferMessage, 'timestamp');
      // --------------------------------------------------------------

      // --- Update myData.chats to reflect the new message ---
      const existingChatIndex = myData.chats.findIndex((chat) => chat.address === toAddress);
      if (existingChatIndex !== -1) {
        myData.chats.splice(existingChatIndex, 1); // Remove existing entry
      }
      // Create the new chat entry
      const chatUpdate = {
        address: toAddress,
        timestamp: currentTime,
        txid: response.txid,
      };
      // Find insertion point to maintain timestamp order (newest first)
      insertSorted(myData.chats, chatUpdate, 'timestamp');
      // --- End Update myData.chats ---

      // Update the chat modal to show the newly sent transfer message
      // Check if the chat modal for this recipient is currently active
      const inActiveChatWithRecipient = chatModal.address === toAddress && chatModal.isActive();

      if (inActiveChatWithRecipient) {
        chatModal.appendChatModal(); // Re-render the chat modal and highlight the new item
      }

      sendAssetFormModal.close();
      this.close();
      sendAssetFormModal.usernameInput.value = '';
      sendAssetFormModal.amountInput.value = '';
      sendAssetFormModal.memoInput.value = '';
      sendAssetFormModal.usernameAvailable.style.display = 'none';

      // Show history modal after successful transaction
      historyModal.open();
      /*
          const sendToAddressError = document.getElementById('sendToAddressError');
          if (sendToAddressError) {
              sendToAddressError.style.display = 'none';
          }
  */
    } catch (error) {
      console.error('Transaction error:', error);
      //showToast('Transaction failed. Please try again.', 0, 'error');
      cancelButton.disabled = false;
    }
  }
}

const sendAssetConfirmModal = new SendAssetConfirmModal();

class ReceiveModal {
  constructor() {
  }

  load() {
    this.modal = document.getElementById('receiveModal');
    this.assetSelect = document.getElementById('receiveAsset');
    this.amountInput = document.getElementById('receiveAmount');
    this.memoInput = document.getElementById('receiveMemo');
    this.displayAddress = document.getElementById('displayAddress');
    this.qrcodeContainer = document.getElementById('qrcode');
    this.previewElement = document.getElementById('qrDataPreview');
    this.copyButton = document.getElementById('copyAddress');
    this.toggleReceiveBalanceButton = document.getElementById('toggleReceiveBalance');
    this.receiveBalanceSymbol = document.getElementById('receiveBalanceSymbol');
    this.fullAddress = null; // Store full address for copying

    // Create debounced function
    this.debouncedUpdateQRCode = debounce(() => this.updateQRCode(), 300);

    // Modal close
    document.getElementById('closeReceiveModal').addEventListener('click', () => this.close());
    
    // Copy address functionality
    this.copyButton.addEventListener('click', () => this.copyAddress());
    this.displayAddress.addEventListener('click', () => this.copyAddress());
    
    // QR code updates
    this.assetSelect.addEventListener('change', () => this.updateQRCode());
    this.amountInput.addEventListener('input', () => this.amountInput.value = normalizeUnsignedFloat(this.amountInput.value));
    this.amountInput.addEventListener('input', this.debouncedUpdateQRCode);
    this.memoInput.addEventListener('input', this.debouncedUpdateQRCode);
    this.toggleReceiveBalanceButton.addEventListener('click', this.handleToggleBalance.bind(this));
  }

  open() {
    this.modal.classList.add('active');

    // Get wallet data
    const walletData = myData.wallet;

    // Populate assets dropdown
    // Clear existing options
    this.assetSelect.innerHTML = '';

    // Check if wallet assets exist
    if (walletData && walletData.assets && walletData.assets.length > 0) {
      // Add options for each asset
      walletData.assets.forEach((asset, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${asset.name} (${asset.symbol})`;
        this.assetSelect.appendChild(option);
      });
    } else {
      // Add a default option if no assets
      const option = document.createElement('option');
      option.value = 0;
      option.textContent = 'Liberdus (LIB)';
      this.assetSelect.appendChild(option);
    }

    // Clear input fields
    this.amountInput.value = '';
    this.memoInput.value = '';

    this.receiveBalanceSymbol.textContent = 'LIB';


    // Initial update for addresses based on the first asset
    this.updateReceiveAddresses();
  }

  close() {
    this.modal.classList.remove('active');
  }

  updateReceiveAddresses() {
    // Update display address
    this.updateDisplayAddress();
  }

  updateDisplayAddress() {
    // Clear previous QR code
    this.qrcodeContainer.innerHTML = '';

    const address = myAccount.keys.address;
    const addressWithPrefix = address.startsWith('0x') ? address : `0x${address}`;
    
    // Store full address for copying
    this.fullAddress = addressWithPrefix;
    
    // Display full address
    this.displayAddress.textContent = addressWithPrefix;

    // Generate QR code with payment data
    try {
      this.updateQRCode();
    } catch (error) {
      console.error('Error updating QR code:', error);

      // Fallback to basic address QR code if there's an error
      new QRCode(this.qrcodeContainer, {
        text: '0x' + address,
        width: 200,
        height: 200,
      });
      console.warn('Fallback to basic address QR code');
    }
  }

  // Create QR payment data object based on form values
  createQRPaymentData() {
    // Get selected asset
    const assetIndex = parseInt(this.assetSelect.value, 10) || 0;

    // Default asset info in case we can't find the selected asset
    let assetId = 'liberdus';
    let symbol = 'LIB';

    // Try to get the selected asset
    try {
      if (myData && myData.wallet && myData.wallet.assets && myData.wallet.assets.length > 0) {
        const asset = myData.wallet.assets[assetIndex];
        if (asset) {
          assetId = asset.id || 'liberdus';
          symbol = asset.symbol || 'LIB';
        } else {
          console.warn(`Asset not found at index ${assetIndex}, using defaults`);
        }
      } else {
        console.warn('Wallet assets not available, using default asset');
      }
    } catch (error) {
      console.error('Error accessing asset data:', error);
    }

    // Build payment data object
    const paymentData = {
      u: myAccount.username, // username
      i: assetId, // assetId
      s: symbol, // symbol
      d: String(this.receiveBalanceSymbol.textContent || 'LIB').toUpperCase() //display unit
    };

    // Add optional fields if they have values
    const amount = this.amountInput.value.trim();
    if (amount) {
      paymentData.a = amount;
    }

    const memo = this.memoInput.value.trim();
    if (memo) {
      paymentData.m = memo;
    }

    return paymentData;
  }

  // Update QR code with current payment data
  updateQRCode() {
    this.qrcodeContainer.innerHTML = '';
    this.previewElement.style.display = 'none'; // Hide preview/error area initially
    this.previewElement.innerHTML = ''; // Clear any previous error message

    try {
      // Get payment data
      const paymentData = this.createQRPaymentData();

      // Convert to JSON and encode as base64
      const jsonData = JSON.stringify(paymentData);
      const base64Data = bin2base64(utf82bin(jsonData));

      // Create URI with liberdus:// prefix
      const qrText = `liberdus://${base64Data}`;

      const gifBytes = qr.encodeQR(qrText, 'gif', { scale: 4 });
      // Convert the raw bytes to a base64 data URL
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
      const dataUrl = 'data:image/gif;base64,' + base64;
      // Create an image element and set its source to the data URL
      const img = document.createElement('img');
      img.src = dataUrl;
      img.width = 200;
      img.height = 200;
      // Add the image to the container
      this.qrcodeContainer.appendChild(img);

      return qrText;
    } catch (error) {
      console.error('Error in updateQRCode:', error);

      this.qrcodeContainer.innerHTML = ''; // Clear the container before adding fallback QR

      // Fallback to basic username QR code in liberdus:// format
      try {
        // Use short key 'u' for username
        const fallbackData = { u: myAccount.username };
        const fallbackJsonData = JSON.stringify(fallbackData);
        const fallbackBase64Data = btoa(fallbackJsonData);
        const fallbackQrText = `liberdus://${fallbackBase64Data}`;

        const gifBytes = qr.encodeQR(fallbackQrText, 'gif', { scale: 4 });
        // Convert the raw bytes to a base64 data URL
        const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
        const dataUrl = 'data:image/gif;base64,' + base64;
        // Create an image element and set its source to the data URL
        const img = document.createElement('img');
        img.src = dataUrl;
        img.width = 200;
        img.height = 200;
        // Add the image to the container
        this.qrcodeContainer.appendChild(img);

        console.error('Error generating full QR', error);

        // Show error directly in the preview element
        if (this.previewElement) {
          this.previewElement.innerHTML = `<span style="color: red;">Error generating full QR</span><br> Generating QR with only username. <br> Username: ${myAccount.username}`;
          this.previewElement.style.display = 'block'; // Make the error visible
        }
      } catch (fallbackError) {
        console.error('Error generating fallback QR code:', fallbackError);
        this.qrcodeContainer.innerHTML = '<p style="color: red; text-align: center;">Failed to generate QR code.</p>';
      }
    }
  }

  /**
   * Toggle LIB/USD display for the receive amount and update the QR accordingly
   */
  async handleToggleBalance() {
    try {
      this.receiveBalanceSymbol.textContent = this.receiveBalanceSymbol.textContent === 'LIB' ? 'USD' : 'LIB';

      const isLib = this.receiveBalanceSymbol.textContent === 'LIB';

      await getNetworkParams();
      const stabilityFactor = getStabilityFactor();

      if (this.amountInput && this.amountInput.value.trim() !== '') {
        const currentValue = parseFloat(this.amountInput.value);
        if (!isNaN(currentValue)) {
          if (!isLib) {
            // now showing USD, convert LIB -> USD
            this.amountInput.value = (currentValue * stabilityFactor).toString();
          } else {
            // now showing LIB, convert USD -> LIB
            this.amountInput.value = (currentValue / stabilityFactor).toString();
          }
        }
      }

      this.updateQRCode();
    } catch (err) {
      console.error('Error toggling receive balance:', err);
    }
  }

  async copyAddress() {
    // Copy the full address, not the displayed truncated version and toast
    const address = this.fullAddress || this.displayAddress.textContent;
    try {
      await navigator.clipboard.writeText(address);
      showToast('Address copied to clipboard', 2000, 'success');
      this.copyButton.classList.add('success');
      setTimeout(() => {
        this.copyButton.classList.remove('success');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy address', 0, 'error');
    }
  }
}

// initialize the receive modal
const receiveModal = new ReceiveModal();

/**
 * Failed Transaction Modal
 * @class
 * @description A modal for displaying failed transactions and handling the retry and delete actions
 */
class FailedTransactionModal {
  /**
   * Initialize the failed transaction modal
   * @returns {void}
   */
  constructor() {
    this.txid = '';
    this.address = '';
    this.memo = '';
  }

  /**
   * Load the failed transaction modal
   * Add event listeners to the modal
   * @returns {void}
   */
  load() {
    this.modal = document.getElementById('failedTransactionModal');
    this.retryButton = this.modal.querySelector('.retry-button');
    this.deleteButton = this.modal.querySelector('.delete-button');
    this.headerCloseButton = document.getElementById('closeFailedTransactionModal');

    this.retryButton.addEventListener('click', this.handleRetry.bind(this));
    this.deleteButton.addEventListener('click', this.handleDelete.bind(this));
    this.headerCloseButton.addEventListener('click', this.closeAndClearState.bind(this));
    this.modal.addEventListener('click', this.handleBackDropClick.bind(this));
  }

  /**
   * Open the failed transaction modal
   * @param {string} txid - The transaction ID
   * @param {Element} element - The element that triggered the failed transaction
   * @returns {void}
   */
  open(txid, element) {  
    // Get the address and memo from the original failed transfer element
    const address = element?.dataset?.address || chatModal.address;
    const memo =
      element?.querySelector('.transaction-memo')?.textContent || element?.querySelector('.payment-memo')?.textContent;
    //const assetID = element?.dataset?.assetID || ''; // TODO: need to add assetID to `myData.wallet.history` for when we have multiple assets
  
    // Store the address and memo in properties of open
    this.address = address;
    this.memo = memo;
    this.txid = txid;
    //open.assetID = assetID;

    this.modal.classList.add('active');
  }

  /**
   * Close the failed transaction modal
   * @returns {void}
   */
  close() {
    this.modal.classList.remove('active');
  }

  /**
   * Close the failed transaction modal and clear the state
   * @returns {void}
   */
  closeAndClearState() {
    this.close();
    // Clear the stored values when modal is closed
    this.txid = '';
    this.address = '';
    this.memo = '';
    //this.assetID = '';
  }
  
  /**
   * Invoked when the user clicks the retry button in the failed payment modal
   * It will fill the sendAssetFormModal with the payment content and txid of the failed payment in a hidden input field in the sendAssetFormModal
   * @returns {void}
   */
  handleRetry() {
    const retryOfPaymentTxId = sendAssetFormModal.retryTxIdInput;
  
    // close the failed payment modal
    this.close();
  
    if (sendAssetFormModal.modal && retryOfPaymentTxId) {
      sendAssetFormModal.open();
  
      // 1. fill in hidden retryOfPaymentTxId input
      retryOfPaymentTxId.value = this.txid;
  
      // 2. fill in the memo input
      sendAssetFormModal.memoInput.value = this.memo || '';
  
      // 3. fill in the to address input
      // find username in myData.contacts[this.address].senderInfo.username
      // enter as an input to invoke the oninput event
      sendAssetFormModal.usernameInput.value =
        myData.contacts[this.address]?.username || '';
      sendAssetFormModal.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
  
      // 4. fill in the amount input
      // get the amount from myData.wallet.history since we need to the bigint value
      const amount = myData.wallet.history.find((tx) => tx.txid === this.txid)?.amount;
      // convert bigint to string
      const amountStr = big2str(amount, 18);
      sendAssetFormModal.amountInput.value = amountStr;
    }
  }
  
  /**
   * Handle the delete button click
   * @returns {void}
   */
  handleDelete() {
    const originalTxid = this.txid;
  
    if (typeof originalTxid === 'string' && originalTxid) {
      const currentAddress = this.address;
      removeFailedTx(originalTxid, currentAddress);
  
      // refresh current view
      chatModal.refreshCurrentView(this.txid);
  
      this.closeAndClearState();
      //this.assetID = '';
    } else {
      console.error('Error deleting message: TXID not found.');
      this.close();
    }
  }
  
  /**
   * Handle the backdrop click
   * @param {Event} event - The event object
   * @returns {void}
   */
  handleBackDropClick(event) {
    if (event.target === this.modal) {
      this.closeAndClearState();
    }
  }
}

const failedTransactionModal = new FailedTransactionModal();

class BridgeModal {
  constructor() {
    this.direction = 'in'; // 'out' = from Liberdus to external, 'in' = from external to Liberdus
    this.selectedNetwork = null;
  }

  load() {
    this.modal = document.getElementById('bridgeModal');
    this.closeButton = document.getElementById('closeBridgeModal');
    this.form = document.getElementById('bridgeForm');
    this.networkSelect = document.getElementById('bridgeNetwork');
    this.networkSelectGroup = document.querySelector('#bridgeNetwork').closest('.form-group');
    this.directionSelect = document.getElementById('bridgeDirection');
    
    // Add event listeners
    this.closeButton.addEventListener('click', () => this.close());
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.networkSelect.addEventListener('change', () => this.updateSelectedNetwork());
    this.directionSelect.addEventListener('change', () => this.handleDirectionChange());
    
    // Load bridge networks from network.js
    this.populateBridgeNetworks();
  }
  
  populateBridgeNetworks() {
    // Clear existing options
    this.networkSelect.innerHTML = '';
    
    // Check if network.bridges exists
    if (network && network.bridges && Array.isArray(network.bridges)) {
      // Add each bridge network as an option
      network.bridges.forEach((bridge, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = bridge.name;
        this.networkSelect.appendChild(option);
      });
      
      // Set default selected network
      if (network.bridges.length > 0) {
        this.selectedNetwork = network.bridges[0];
      }
    } 
  }
  
  updateSelectedNetwork() {
    const index = parseInt(this.networkSelect.value);
    if (network && network.bridges && network.bridges[index]) {
      this.selectedNetwork = network.bridges[index];
    }
  }
  
  handleDirectionChange() {
    this.direction = this.directionSelect.value;

    // Show network dropdown only for 'out' direction (Liberdus to external network)
    if (this.direction === 'out') {
      this.networkSelectGroup.style.display = 'block';
    } else {
      // Hide network dropdown for 'in' direction (external network to Liberdus)
      this.networkSelectGroup.style.display = 'none';
    }
  }

  open() {
    this.modal.classList.add('active');
    
    // Reset defaults
    this.direction = 'in';
    if (this.directionSelect) {
      this.directionSelect.value = 'in';
    }
    
    // Ensure networks are populated
    this.populateBridgeNetworks();
    
    // Update selected network
    this.updateSelectedNetwork();
    
    // Set initial visibility of network dropdown
    this.handleDirectionChange();
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
  
  handleSubmit(event) {
    event.preventDefault();
    this.direction = this.directionSelect.value;

    if (this.direction === 'out') {
      // From Liberdus to external network
      this.openSendAssetModalToBridge();
    } else {
      // From external network to Liberdus
      this.openBridgePage();
    }
  }

  openSendAssetModalToBridge() {
    if (!this.selectedNetwork) return;
    
    this.close();
    sendAssetFormModal.open();
    sendAssetFormModal.usernameInput.value = this.selectedNetwork.username;
    sendAssetFormModal.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  openBridgePage() {
    const bridgeUrl = network && network.bridgeUrl ? network.bridgeUrl : './bridge';
    window.open(bridgeUrl, '_blank');
  }
}

const bridgeModal = new BridgeModal();

/**
 * Migrate Accounts Modal
 * @class
 * @description A modal for migrating accounts from different networks
 */
class MigrateAccountsModal {
  constructor() { }

  load() {
    this.modal = document.getElementById('migrateAccountsModal');
    this.closeButton = document.getElementById('closeMigrateAccountsModal');
    this.form = document.getElementById('migrateAccountsForm');
    this.accountList = document.getElementById('migrateAccountList');
    this.errorAndInconsistentAccounts = document.getElementById('errorAndInconsistentAccounts');
    this.submitButton = document.getElementById('submitMigrateAccounts');

    this.closeButton.addEventListener('click', () => this.close());
    this.submitButton.addEventListener('click', (event) => this.handleSubmit(event));

    // if no check boxes are checked, disable the submit button
    this.accountList.addEventListener('change', () => {
      this.submitButton.disabled = this.accountList.querySelectorAll('input[type="checkbox"]:checked').length === 0;
    });
  }

  async open() {
    await this.populateAccounts();
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
    this.clearForm();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  /**
   * Populate the accounts list with the accounts that can be migrated
   * @returns {Promise<void>}
   */
  async populateAccounts() {
    const categories = await this.categorizeAccounts();
    this.accountList.innerHTML = '';

    // Render Mine section
    this.renderSection('mine', 'Your Registered Accounts', categories.mine,
      'Accounts already registered to this network');

    // Render Available section  
    this.renderSection('available', 'Unregistered Accounts', categories.available,
      'Accounts available to register');

    // Render Taken section
    this.renderSection('taken', 'Taken', categories.taken,
      'Accounts already taken');

    // Render Error section
    this.renderSection('error', 'Error', categories.error,
      'Error checking username availability');
      
    // Check for inconsistencies and render them
    const inconsistencies = await this.checkAccountsInconsistency();
    this.renderInconsistencies(inconsistencies);
  }

  /**
   * Render a section of the accounts list
   * @param {string} sectionId - The id of the section
   * @param {string} title - The title of the section
   * @param {Array} accounts - The accounts to render
   * @param {string} description - The description of the section
   */
  renderSection(sectionId, title, accounts, description) {
    if (accounts.length === 0) return;

    const section = document.createElement('div');
    section.className = 'migrate-section';
    section.innerHTML = `
      <h3>${title} (${accounts.length})</h3>
      <p class="section-description">${description}</p>
      <div class="account-checkboxes" id="${sectionId}-accounts">
        ${accounts.map(account => `
          <label>
            <input type="checkbox" value="${account.username}" 
                   data-netid="${account.netid}" 
                   data-section="${sectionId}"
                   ${sectionId === ('taken' || 'error') ? 'disabled' : ''}>
            ${account.username}_${account.netid.slice(0, 6)}
          </label>
        `).join('')}
      </div>
    `;
    if (sectionId === 'error') {
      this.errorAndInconsistentAccounts.appendChild(section);
    } else {
      this.accountList.appendChild(section);
    }
  }

  /**
   * Check if there are any accounts that could potentially be migrated
   * @returns {boolean}
   */
  hasMigratableAccounts() {
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const currentNetId = parameters?.networkId;
    if (!accountsObj.netids || !currentNetId) return false;

    // Loop through all netids except current
    for (const netid in accountsObj.netids) {
      // if netid is the current-netid or not in network.netids, skip
      if (netid === currentNetId || !network.netids.includes(netid)) continue;

      const usernamesObj = accountsObj.netids[netid]?.usernames;
      if (!usernamesObj) continue;

      // if there are any usernames, return true
      if (Object.keys(usernamesObj).length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Categorize the accounts into three sections:
   *  - Mine: Accounts where the username maps to our address
   *  - Available: Accounts where the username is available to claim
   *  - Taken: Accounts where the username is already taken
   * @returns {Object}
   */
  async categorizeAccounts() {
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const currentNetId = parameters?.networkId;

    const categories = {
      mine: [],      // username maps to our address
      available: [], // username is available
      taken: [],      // username is taken
      error: []      // error checking username availability
    };

    // Loop through all netids except current
    for (const netid in accountsObj.netids) {
      // if netid is the current netid or not in network.netids, skip
      if (netid === currentNetId || !network.netids.includes(netid)) continue;

      const usernamesObj = accountsObj.netids[netid]?.usernames;
      if (!usernamesObj) continue;

      for (const username in usernamesObj) {
        const address = usernamesObj[username].address;

        // Check availability status
        const availability = await checkUsernameAvailability(username, address);

        const account = { username, netid, address };

        if (availability === 'mine') {
          categories.mine.push(account);
        } else if (availability === 'available') {
          categories.available.push(account);
        } else if (availability === 'taken') {
          categories.taken.push(account);
        } else if (availability === 'error') {
          categories.error.push(account);
        } else {
          console.error("Unknown availability status: ", availability);
        }
      }
    }
    
    // Sort each category
    categories.mine = this.sortAccounts(categories.mine);
    categories.available = this.sortAccounts(categories.available);
    categories.taken = this.sortAccounts(categories.taken);
    categories.error = this.sortAccounts(categories.error);

    return categories;
  }

  // Sort function for accounts - first by netid (using network.netids order), then by username
  sortAccounts = (accounts) => {
    return accounts.sort((a, b) => {
      // First compare by netid order in network.netids
      const netidIndexA = network.netids.indexOf(a.netid);
      const netidIndexB = network.netids.indexOf(b.netid);
      if (netidIndexA !== netidIndexB) {
        return netidIndexA - netidIndexB;
      }
      // Then sort by username alphabetically
      return a.username.localeCompare(b.username);
    });
  };

  async handleSubmit(event) {
    event.preventDefault();

    this.submitButton.disabled = true;
    this.closeButton.disabled = true;
      
    const selectedAccounts = this.accountList.querySelectorAll('input[type="checkbox"]:checked');
  
    const results = {}
    // Start each account processing with 2-second delays between starts
    for (let i = 0; i < selectedAccounts.length; i++) {
      const checkbox = selectedAccounts[i];
      const section = checkbox.dataset.section;
      const username = checkbox.value;
      const netid = checkbox.dataset.netid;
  
      const loadingToastId = showToast('Migrating '+username, 0, 'loading');
      // Start processing this account
      if (section === 'mine') {
        this.migrateAccountData(username, netid, parameters.networkId)
        await new Promise(resolve => setTimeout(resolve, 100));
      } else if (section === 'available') {
        myData = loadState(username+'_'+netid)
        if (myData){ 
          const isPrivate = myData.account?.private || false;
          const res = await postRegisterAlias(username, myData.account.keys, isPrivate)
          if (res !== null){
            res.submittedts = getCorrectedTimestamp()
            res.netid = netid
            results[username] = res;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      hideToast(loadingToastId);
      welcomeScreen.orderButtons();
    }

    // clearing myData, not being used anymore
    clearMyData();

    // loop through the results array and check the status of the pending txid which is in results[username].txid
    // See checkPendingTransactions function for how to check the status of a pending txid
    // update the result element based on the check; if the txid is successfully processed set it to true
    // if the txid check does not give a result in time, set it to false
    // when all results array elements have been resolved exit the loop
    let done = false;
    for(;!done;){
      done = true;
      for (const username in results) {
        if (! results[username]?.txid){ continue; }
        const loadingToastId = showToast('Migrating '+username, 0, 'loading');
        const txid = results[username].txid;
        const submittedts = results[username].submittedts
        const result = await checkPendingTransaction(txid, submittedts); // return true, false or null
        if (result !== null){
          if (result == true){
            this.migrateAccountData(username, results[username].netid, parameters.networkId)
          }
          results[username] = result;
        }
        else{ done = false; }
        await new Promise(resolve => setTimeout(resolve, 1000));
        hideToast(loadingToastId);
      }
    }
    this.populateAccounts();
    this.submitButton.disabled = false;
    this.closeButton.disabled = false;
  }
  
  /**
   * Migrate the account data from one netid to another
   * @param {string} username - The username to migrate
   * @param {string} netid - The netid to migrate from
   * @returns {Promise<void>}
   */
  migrateAccountData(username, netid, newNetId) {
    let fileContent = loadState(username+'_'+netid, true)
  
    // Perform netid substitution
    let substitutionResult = restoreAccountModal.performStringSubstitution(fileContent, {
      oldString: netid,
      newString: newNetId
    });
  
    // Encrypt if needed
    if (lockModal?.encKey) {
      substitutionResult = encryptData(substitutionResult, lockModal.encKey, true);
    }
  
    // Save to new location
    localStorage.setItem(username + '_' + newNetId, substitutionResult);
    
    // Remove old file
    localStorage.removeItem(username + '_' + netid);
  
    // Update accounts registry
    this.updateAccountsRegistry(username, netid, newNetId);
  }


  /**
 * Updates the accounts registry with the given username and netid.
 * @param {Object} accountsObj - The accounts object to update.
 * @param {string} newNetid - The new netid to add the username to.
 * @param {string} username - The username to add to the accounts registry.
 * @param {string} oldNetid - The old netid to remove the username from.
 */
  updateAccountsRegistry(username, oldNetid, newNetid) {
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Ensure new netid exists in registry
    if (!accountsObj.netids[newNetid]) {
      accountsObj.netids[newNetid] = { usernames: {} };
    }

    const accountAddress = accountsObj.netids[oldNetid].usernames[username]?.address;

    if (accountAddress) {
      accountsObj.netids[newNetid].usernames[username] = {
        address: accountAddress
      };
    }
    // Finally remove old account_netid from accountsObj
    if (accountsObj.netids[oldNetid] && accountsObj.netids[oldNetid].usernames) {
      delete accountsObj.netids[oldNetid].usernames[username];
    }

    // Save updated accounts registry
    localStorage.setItem('accounts', stringify(accountsObj));
  }

  clearForm() {
    const checkboxes = this.accountList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    this.submitButton.disabled = true;
  }
  
  /**
   * Check for consistency between accounts registry and actual account data in localStorage
   * @returns {Promise<Object>} An object containing the inconsistencies found
   */
  async checkAccountsInconsistency() {
    const result = {
      missingAccounts: [], // Accounts in accounts object but missing the account entry
      unregisteredAccounts: [] // Accounts not in accounts object but have entries in localStorage
    };
    
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    
    for (const netid in accountsObj.netids) {
      const usernamesObj = accountsObj.netids[netid]?.usernames;
      if (!usernamesObj) continue;
      
      for (const username in usernamesObj) {
        const accountKey = `${username}_${netid}`;
        const accountFile = localStorage.getItem(accountKey);
        
        if (!accountFile) {
          // Found an account in registry but the account file is missing
          result.missingAccounts.push({
            username,
            netid
          });
        }
      }
    }

    const allKeys = Object.keys(localStorage);
    
    // Filter keys that match the pattern username_<64-hex netid>
    const accountFileKeys = allKeys.filter(key => {
      // Skip the 'accounts' key itself
      if (key === 'accounts') return false;
      
      // Only match keys with exactly one underscore and 64 hex chars after underscore
      const match = key.match(/^[^_]+_[0-9a-fA-F]{64}$/);
      if (!match) return false;
      
      return true;
    });
    
    for (const key of accountFileKeys) {
      // Extract username and 64-hex netid ensuring only one underscore is present
      const match = key.match(/^([^_]+)_([0-9a-fA-F]{64})$/);
      if (!match) continue;
      const [, username, netid] = match;
      
      const isRegistered = accountsObj.netids[netid]?.usernames?.[username];
      
      if (!isRegistered) {
        result.unregisteredAccounts.push({
          username,
          netid
        });
      }
    }
    result.missingAccounts = this.sortAccounts(result.missingAccounts);
    result.unregisteredAccounts = this.sortAccounts(result.unregisteredAccounts);

    return result;
  }
  
  /**
   * Render the inconsistencies found in the accounts
   * @param {Object} inconsistencies - The inconsistencies to render
   */
  renderInconsistencies(inconsistencies) {
    const { missingAccounts, unregisteredAccounts } = inconsistencies;
    
    if (missingAccounts.length === 0 && unregisteredAccounts.length === 0) {
      return;
    }
    
    const container = document.createElement('div');
    container.className = 'migrate-inconsistencies';
    container.innerHTML = `<h3>Account Inconsistencies</h3>`;
    
    if (missingAccounts.length > 0) {
      const missingSection = document.createElement('div');
      missingSection.className = 'inconsistency-section';
      missingSection.innerHTML = `
        <h4>Accounts entries without data (${missingAccounts.length})</h4>
        <p class="section-description">In accounts object but missing specific account data.</p>
        <div class="inconsistency-list">
          ${missingAccounts.map(account => `
            <div class="inconsistency-item">
              <span>${account.username}_${account.netid.slice(0, 6)}</span>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(missingSection);
    }
    
    if (unregisteredAccounts.length > 0) {
      const unregisteredSection = document.createElement('div');
      unregisteredSection.className = 'inconsistency-section';
      unregisteredSection.innerHTML = `
        <h4>Accounts missing from Accounts Object (${unregisteredAccounts.length})</h4>
        <p class="section-description">Account data exists but missing from accounts object.</p>
        <div class="inconsistency-list">
          ${unregisteredAccounts.map(account => `
            <div class="inconsistency-item">
              <span>${account.username}_${account.netid.slice(0, 6)}</span>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(unregisteredSection);
    }
    
    this.errorAndInconsistentAccounts.appendChild(container);
  }
}

const migrateAccountsModal = new MigrateAccountsModal();

/**
 * Lock Modal
 * @class
 * @description A modal for locking the app
 */
class LockModal {
  constructor() {
    this.encKey = null;
    this.mode = 'set'; // set, change, or remove
  }

  load() {
    this.modal = document.getElementById('lockModal');
    this.openButton = document.getElementById('openLockModal');
    this.headerCloseButton = document.getElementById('closeLockModal');
    this.lockForm = document.getElementById('lockForm');
    this.oldPasswordInput = this.modal.querySelector('#oldPassword');
    this.oldPasswordLabel = this.modal.querySelector('#oldPasswordLabel');
    this.newPasswordInput = this.modal.querySelector('#newPassword');
    this.newPasswordLabel = this.modal.querySelector('#newPasswordLabel');
    this.confirmNewPasswordInput = this.modal.querySelector('#confirmNewPassword');
    this.confirmNewPasswordLabel = this.modal.querySelector('#confirmNewPasswordLabel');
    this.lockButton = this.modal.querySelector('#lockForm button[type="submit"]');
    this.optionsBox = document.getElementById('lockOptions');
    this.changeButton = document.getElementById('changePasswordButton');
    this.removeButton = document.getElementById('removeLockButton');
    this.formBox = document.getElementById('lockFormContainer');

    this.openButton.addEventListener('click', () => this.open());
    this.headerCloseButton.addEventListener('click', () => this.close());
    this.lockForm.addEventListener('submit', (event) => this.handleSubmit(event));
    // dynamic button state with debounce
    this.debouncedUpdateButtonState = debounce(() => this.updateButtonState(), 100);
    this.newPasswordInput.addEventListener('input', this.debouncedUpdateButtonState);
    this.confirmNewPasswordInput.addEventListener('input', this.debouncedUpdateButtonState);
    this.oldPasswordInput.addEventListener('input', this.debouncedUpdateButtonState);
    this.passwordWarning = this.modal.querySelector('#passwordWarning');
    this.changeButton.addEventListener('click', () => this.pickMode('change'));
    this.removeButton.addEventListener('click', () => this.pickMode('remove'));
  }

  open() {
    const alreadyLocked = Boolean(localStorage?.lock);

    // show or hide the option picker
    this.optionsBox.style.display = alreadyLocked ? 'block' : 'none';
    this.formBox.style.display = alreadyLocked ? 'none' : 'block';

    this.mode = alreadyLocked ? null : 'set';
    this.prepareForm(); 

    // disable the button
    this.lockButton.disabled = true;

    this.clearInputs();

    // show the modal
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  pickMode(mode) {
    this.mode = mode; // 'change' | 'remove'
    this.optionsBox.style.display = 'none';
    this.formBox.style.display = 'block';
    this.prepareForm();
    this.updateButtonState();
  }

  // adjust which fields are visible based on selected mode
  prepareForm() {
    // hide all the fields
    this.oldPasswordInput.style.display        = 'none';
    this.oldPasswordLabel.style.display        = 'none';
    this.newPasswordInput.style.display        = 'none';
    this.newPasswordLabel.style.display        = 'none';
    this.confirmNewPasswordInput.style.display = 'none';
    this.confirmNewPasswordLabel.style.display = 'none';

    // reveal fields based on mode
    if (this.mode === 'remove') {
      // only the current‑password field
      this.oldPasswordInput.style.display = 'block';
      this.oldPasswordLabel.style.display = 'block';
      this.lockButton.textContent = 'Remove Lock';

    } else if (this.mode === 'change') {
      // current + new + confirm
      this.oldPasswordInput.style.display        = 'block';
      this.oldPasswordLabel.style.display        = 'block';
      this.newPasswordInput.style.display        = 'block';
      this.newPasswordLabel.style.display        = 'block';
      this.confirmNewPasswordInput.style.display = 'block';
      this.confirmNewPasswordLabel.style.display = 'block';
      this.lockButton.textContent = 'Save Password';

    } else { // 'set' (no existing lock)
      // new + confirm only
      this.newPasswordInput.style.display        = 'block';
      this.newPasswordLabel.style.display        = 'block';
      this.confirmNewPasswordInput.style.display = 'block';
      this.confirmNewPasswordLabel.style.display = 'block';
      this.lockButton.textContent = 'Save Password';
    }
  }

  async handleSubmit(event) {
    // disable the button
    this.lockButton.disabled = true;
    event.preventDefault();
    
    const newPassword = this.newPasswordInput.value;
    const confirmNewPassword = this.confirmNewPasswordInput.value;
    const oldPassword = this.oldPasswordInput.value;

    // Check if new passwords match first (for non-remove mode)
    if (newPassword !== confirmNewPassword) {
      this.lockButton.disabled = true;
      // Keep button disabled - passwords don't match
      showToast('Passwords do not match. Please try again.', 0, 'error');
      return;
    }

    // loading toast
    let waitingToastId = showToast('Updating password...', 0, 'loading');

    // if old password is visible, check if it is correct
    if (this.oldPasswordInput.style.display !== 'none') {
      // check if old password is empty
      if (oldPassword.length === 0) {
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Please enter your old password.', 0, 'error');
        return;
      }

      // decrypt the old password
      const key = await passwordToKey(oldPassword);
      if (!key) {
        // remove the loading toast
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Invalid password. Please try again.', 0, 'error');
        return;
      }
      if (key !== localStorage.lock) {
        // remove the loading toast
        if (waitingToastId) hideToast(waitingToastId);
        // clear the old password input
        this.oldPasswordInput.value = '';
        showToast('Invalid password. Please try again.', 0, 'error');
        return;
      }
    }

    // if new password is empty, remove the password from localStorage
    // once we are here we know the old password is correct
    if (this.mode === 'remove') {
      try {
        await encryptAllAccounts(oldPassword, newPassword)
        delete localStorage.lock;
        this.encKey = null;
        // remove the loading toast
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Password removed', 2000, 'success');
        this.close();
      } catch (error) {
        console.error('Decryption failed:', error);
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Failed to decrypt accounts. Please try again.', 0, 'error');
      }
      return;
    }
    
    try {
      // encryptData will handle the password hashing internally
      const key = await passwordToKey(newPassword);
      if (!key) {
        // remove the loading toast
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Invalid password. Please try again.', 0, 'error');
        return;
      }


      
      // Save the key in localStorage with a key of "lock"
      localStorage.lock = key;
      this.encKey = await passwordToKey(newPassword+"liberdusData")
      await encryptAllAccounts(oldPassword, newPassword)

      // remove the loading toast
      if (waitingToastId) hideToast(waitingToastId);
      showToast('Password updated', 2000, 'success');

      // clear the inputs
      this.clearInputs();
      
      // Close the modal
      this.close();
    } catch (error) {
      console.error('Encryption failed:', error);
      showToast('Failed to encrypt password. Please try again.', 0, 'error');
      // remove the loading toast
      if (waitingToastId) hideToast(waitingToastId);
    }
  }

  async updateButtonState() {
    const newPassword = this.newPasswordInput.value;
    const confirmPassword = this.confirmNewPasswordInput.value;
    const oldPassword = this.oldPasswordInput.value;
    
    // Check if old password is filled and new password is empty - "Clear password" mode
    // const isOldPasswordVisible = this.oldPasswordInput.style.display !== 'none';
    // const isClearPasswordMode = isOldPasswordVisible && oldPassword.length > 0 && newPassword.length === 0;
    
    let isValid = false;
    let warningMessage = '';

    if (this.mode === 'remove') {
      isValid = oldPassword.length > 0;
    } else { // set or change mode
      // too short
      if (newPassword.length > 0 && newPassword.length < 4) {
        warningMessage = 'too short';
      } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        warningMessage = 'does not match';
      } else if (this.mode === 'change' && newPassword && oldPassword && newPassword === oldPassword) {
        warningMessage = 'same as current';
      }
      isValid = !warningMessage && newPassword.length >= 4 && newPassword === confirmPassword;
      if (this.mode === 'change') {
        isValid = isValid && oldPassword.length > 0;
      }
    }
    
    this.passwordWarning.style.display = 'none';
    
    // Update button state and warnings
    this.lockButton.disabled = !isValid;
    
    if (warningMessage) {
      this.passwordWarning.textContent = warningMessage;
      this.passwordWarning.style.display = 'inline';
    } else {
      this.passwordWarning.style.display = 'none';
    }
  }

  clearInputs() {
    this.oldPasswordInput.value = '';
    this.newPasswordInput.value = '';
    this.confirmNewPasswordInput.value = '';
  }
}
const lockModal = new LockModal();

/**
 * Unlock Modal
 * @class
 * @description A modal for unlocking the app
 */
class UnlockModal {
  constructor() {
    this.locked = true;
    // keep track of what button was pressed to open the unlock modal
    this.openButtonElementUsed = null;
  }

  load() {
    this.modal = document.getElementById('unlockModal');
    this.closeButton = document.getElementById('closeUnlockModal');
    this.unlockForm = document.getElementById('unlockForm');
    this.passwordInput = this.modal.querySelector('#password');
    this.unlockButton = this.modal.querySelector('.btn.btn--primary');

    this.closeButton.addEventListener('click', () => this.close());
    this.unlockForm.addEventListener('submit', (event) => this.handleSubmit(event));
    this.passwordInput.addEventListener('input', () => this.updateButtonState());
  }

  open() {
    this.modal.classList.add('active');
    setTimeout(() => this.updateButtonState(), 100);
  }

  close() {
    this.passwordInput.value = '';
    this.modal.classList.remove('active');
  }

  async handleSubmit(event) {
    // disable the button
    this.unlockButton.disabled = true;

    // loading toast
    let waitingToastId = showToast('Checking password...', 0, 'loading');

    event.preventDefault();
    const password = this.passwordInput.value;
    const key = await passwordToKey(password);
    if (!key) {
      // remove the loading toast
      if (waitingToastId) hideToast(waitingToastId);
      showToast('Invalid password. Please try again.', 0, 'error');
      return;
    }
    if (key === localStorage.lock) {
      // remove the loading toast
      if (waitingToastId) hideToast(waitingToastId);
//      showToast('Unlock successful', 2000, 'success');
      lockModal.encKey = await passwordToKey(password+"liberdusData")
      this.unlock();
      this.close();
      const targetElement = this.openButtonElementUsed;
      this.openButtonElementUsed = null;
      if (targetElement && typeof targetElement.click === 'function' && document.contains(targetElement)) {
        // Defer click to next tick to ensure unlock modal has fully closed
        setTimeout(() => targetElement.click(), 0);
      } else {
        signInModal.open();
      }
    } else {
      if (waitingToastId) hideToast(waitingToastId);
      showToast('Invalid password. Please try again.', 0, 'error');
    }

    // remove the loading toast
    if (waitingToastId) hideToast(waitingToastId);
  }

  updateButtonState() {
    const password = this.passwordInput.value;
    this.unlockButton.disabled = password.length === 0;
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  isLocked() {
    return this.locked;
  }

  lock() {
    this.locked = true;
  }

  unlock() {
    this.locked = false;
  }
}
const unlockModal = new UnlockModal();

class LaunchModal {
  constructor() {

  }

  load() {
    this.modal = document.getElementById('launchModal');
    this.closeButton = document.getElementById('closeLaunchModal');
    this.launchForm = document.getElementById('launchForm');
    this.urlInput = this.modal.querySelector('#url');
    this.launchButton = this.modal.querySelector('button[type="submit"]');
    this.backupButton = this.modal.querySelector('#launchModalBackupButton');
    this.closeButton.addEventListener('click', () => this.close());
    this.launchForm.addEventListener('submit', async (event) => await this.handleSubmit(event));
    this.urlInput.addEventListener('input', () => this.updateButtonState());
    this.backupButton.addEventListener('click', () => backupAccountModal.open());
  }

  open() {
    this.modal.classList.add('active');
    this.urlInput.value = window.location.href.split('?')[0];
    this.updateButtonState();
  }

  close() {
    this.urlInput.value = '';
    this.modal.classList.remove('active');
  }

  async handleSubmit(event) {
    event.preventDefault();
    const url = this.urlInput.value;
    if (!url) {
      showToast('Please enter a URL', 0, 'error');
      return;
    }
    
    // Disable button and show loading state
    this.launchButton.disabled = true;
    this.launchButton.textContent = 'Checking URL...';

    let networkJsUrl;
    
    // Step 1: URL parsing
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname === '' ? '/' : (urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname + '/');
      networkJsUrl = urlObj.origin + path + 'network.js';
    } catch (urlError) {
      showToast(`Invalid URL format: ${urlError.message}`, 0, 'error');
      this.launchButton.disabled = false;
      this.launchButton.textContent = 'Launch';
      return;
    }

    // Step 2: Fetch network.js
    let result;
    try {

      result = await fetch(networkJsUrl,{
        cache: 'reload',
      });
      
      if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${result.statusText}`);
      }
      
    } catch (fetchError) {
      showToast(`Network error: ${fetchError.message}`, 0, 'error');
      this.launchButton.disabled = false;
      this.launchButton.textContent = 'Launch';
      return;
    }

    // Step 3: Parse response text
    let networkJson;
    try {
      networkJson = await result.text();
      
      if (!networkJson || networkJson.length === 0) {
        throw new Error('Empty response received');
      }
    } catch (parseError) {
      showToast(`Response parsing error: ${parseError.message}`, 0, 'error');
      this.launchButton.disabled = false;
      this.launchButton.textContent = 'Launch';
      return;
    }

    // Step 4: Validate required properties
    try {
      const requiredProps = ['network', 'name', 'netid', 'gateways'];
      const missingProps = requiredProps.filter(prop => !networkJson.includes(prop));
    
      if (missingProps.length > 0) {
        throw new Error(`Missing required properties: ${missingProps.join(', ')}`);
      }
      
    } catch (validationError) {
      showToast(`Invalid network configuration: ${validationError.message}`, 0, 'error');
      this.launchButton.disabled = false;
      this.launchButton.textContent = 'Launch';
      return;
    }

    // Step 5: Success - launch the app
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'launch', url }));
      this.close();
    } catch (launchError) {
      showToast(`Launch error: ${launchError.message}`, 0, 'error');
    } finally {
      // Reset button state (this should always happen)
      this.launchButton.disabled = false;
      this.launchButton.textContent = 'Launch';
    }
  }

  updateButtonState() {
    const url = this.urlInput.value;
    this.launchButton.disabled = url.length === 0;
  }
}

const launchModal = new LaunchModal();

/**
 * React Native App
 * @class
 * @description A class for handling communication with the React Native app
 */
class ReactNativeApp {
  constructor() {
    this.isReactNativeWebView = this.checkIfReactNativeWebView();
    this.appVersion = null;
    this.deviceToken = null;
    this.expoPushToken = null;
    this.fcmToken = null;
    this.voipToken = null;
    this.notificationStorageKey = 'notifications';
  }

  load() {
    if (this.isReactNativeWebView) {
      this.captureInitialViewportHeight();

      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'background') {
            this.handleNativeAppSubscribe();
            // if chatModal was opened, save the last message count
            if (chatModal.isActive() && chatModal.address) {
              const contact = myData.contacts[chatModal.address];
              // Set snapshot only once during a hidden session to avoid Android overwriting
              if (chatModal.lastMessageCount === null) {
                chatModal.lastMessageCount = contact?.messages?.length || 0;
              }
            }
            saveState();
          }

          if (data.type === 'foreground') {
            if (myData || myAccount) {
              this.handleNativeAppUnsubscribe();
            }
          }

          if (data.type === 'KEYBOARD_SHOWN') {
            this.detectKeyboardOverlap(data.keyboardHeight);
          }

          if (data.type === 'APP_PARAMS') {
            // Handle app version
            if (data?.data?.appVersion) {
              this.appVersion = data.data.appVersion || `N/A`
              // Update the welcome screen to display the app version
              welcomeScreen.updateAppVersionDisplay(this.appVersion);
              // Update the about modal to display the app version
              aboutModal.updateAppVersionDisplay(this.appVersion);
              // Check if app version needs update
              this.checkAppVersionUpdate();
            }
            // Handle device tokens
            if (data.data.deviceToken) {
              // Store device token for push notifications
              this.deviceToken = data.data.deviceToken;
            }
            if (data.data.expoPushToken) {
              // Store expo push token for push notifications
              this.expoPushToken = data.data.expoPushToken;
            }
            if (data.data.fcmToken) {
              // Store fcm push token for call notifications
              this.fcmToken = data.data.fcmToken;
            }
            if (data.data.voipToken) {
              // Store voip push token for call notifications
              this.voipToken = data.data.voipToken;
            }
            this.handleNativeAppSubscribe();
          }

          if (data.type === 'NEW_NOTIFICATION') {
            this.fetchAllPanelNotifications();
          }

          if (data.type === 'NOTIFICATION_TAPPED') {
            // normalize the address
            const normalizedToAddress = normalizeAddress(data.to);
            
            // Check if user is signed in
            if (!myData || !myAccount) {
              // User is not signed in - save the notification address and open sign-in modal
              this.saveNotificationAddress(normalizedToAddress);
              // If the user clicks on a notification and the app is already on the SignIn modal, 
              // update the display to reflect the new notification
              if (signInModal.isActive()) {
                signInModal.updateNotificationDisplay();
              }
              return;
            }
            
            // User is signed in - check if it's the right account
            const isCurrentAccount = this.isCurrentAccount(normalizedToAddress);
            if (isCurrentAccount) {
              // console.log('🔔 You are signed in to the account that received the message');
            } else {
              // We're signed in to a different account, ask user what to do
              const shouldSignOut = confirm('You received a message for a different account. Would you like to sign out to switch to that account?');
              this.saveNotificationAddress(normalizedToAddress);
              if (shouldSignOut) {
                // Sign out and save the notification address for priority
                menuModal.handleSignOut();
              } else {
                // console.log('User chose to stay signed in - notified account will appear first next time');
              }
            }
          }

          if (data.type === 'ALL_NOTIFICATIONS_IN_PANEL') {
            // Clear notifications for current user when app returns from background
            const currentUserAddress = myAccount?.keys?.address;
            if (currentUserAddress) {
              this.clearNotificationAddress(currentUserAddress);
              this.sendClearNotifications(currentUserAddress);
            }
            
            if (data.notifications && Array.isArray(data.notifications) && data.notifications.length > 0) {
              const { state } = this.getNotificationState();
              const currentTimestamp = state.timestamp || 0;
              let highestTimestamp = currentTimestamp;
              const normalizedCurrentUser = currentUserAddress ? normalizeAddress(currentUserAddress) : null;

              data.notifications.forEach((notification, index) => {
                try {
                  const rawTimestamp = notification?.data?.timestamp;
                  const parsedTimestamp = rawTimestamp ? Date.parse(rawTimestamp) : NaN;
                  const hasValidTimestamp = Number.isFinite(parsedTimestamp);
                  // Skip already-processed notifications if they are older than the current timestamp
                  if (hasValidTimestamp && parsedTimestamp <= currentTimestamp) {
                    return; // Skip already-processed notifications
                  }

                  // Handle scheduled call notifications - extract address from data.to
                  if (notification?.data?.type === 'SCHEDULE_CALL' && notification?.data?.to) {
                    const normalizedToAddress = normalizeAddress(notification.data.to);
                    // Save notification address to show bell in sign-in modal for accounts with notifications
                    if (normalizedToAddress !== normalizedCurrentUser) {
                      this.saveNotificationAddress(normalizedToAddress);
                    }
                  } else {
                  // Extract address from notification body (pattern: "to 0x...")
                  if (notification?.body && typeof notification.body === 'string') {
                    const addressMatch = notification.body.match(/to\s+(\S+)/);
                    if (addressMatch && addressMatch[1]) {
                      const normalizedToAddress = normalizeAddress(addressMatch[1]);
                      
                      // Save notification address to show bell in sign-in modal for accounts with notifications
                      if (normalizedToAddress !== normalizedCurrentUser) {
                        this.saveNotificationAddress(normalizedToAddress);
                      }
                    }
                  }
                  }

                  if (hasValidTimestamp) {
                    highestTimestamp = Math.max(highestTimestamp, parsedTimestamp);
                  }
                } catch (error) {
                  logsModal.log(`📋 Error processing notification ${index}:`, error);
                }
              });

              if (highestTimestamp > currentTimestamp) {
                this.updateNotificationTimestamp(highestTimestamp);
              }

              // If the sign in modal is open, update the display to show new notifications
              if (signInModal.isActive()) {
                signInModal.updateNotificationDisplay();
              }
            }
          }
        } catch (error) {
          logsModal.error('Error parsing message from React Native:', error);
        }
      });
      
      this.fetchAppParams();
      // send message `GetAllPanelNotifications` to React Native when app is opened during DOMContentLoaded
      this.fetchAllPanelNotifications();
      // Check for native app subscription tokens and handle subscription
      this.handleNativeAppSubscribe();
    }
  }

  checkIfReactNativeWebView() {
    return typeof window !== 'undefined' &&
      typeof window.ReactNativeWebView !== 'undefined' &&
      typeof window.ReactNativeWebView.postMessage === 'function';
  }

  postMessage(data) {
    if (this.isReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to post message to React Native:', error);
      }
    }
  }

  // Fetch App Params from React Native
  fetchAppParams() {
    this.postMessage({
      type: 'APP_PARAMS'
    });
  }

  // fetch all panel notifications
  fetchAllPanelNotifications() {
    this.postMessage({
      type: 'GetAllPanelNotifications',
    });
  }

  captureInitialViewportHeight() {
    const currentHeight = window.innerHeight;
    this.postMessage({
        type: 'VIEWPORT_HEIGHT',
        height: currentHeight
    });
  }

  isInputElement(element) {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    const isContentEditable = element.contentEditable === 'true';

    return tagName === 'input' ||
      tagName === 'textarea' ||
      isContentEditable ||
      element.getAttribute('role') === 'textbox';
  }

  detectKeyboardOverlap(keyboardHeight) {
    const input = document.activeElement;
    if (!this.isInputElement(input)) {
      return;
    }

    try {
      const rect = input.getBoundingClientRect();
      const screenHeight = window.screen.height;
      const keyboardTop = screenHeight - keyboardHeight;

      const inputBottom = rect.bottom;
      const inputIsAboveKeyboard = inputBottom < keyboardTop;
      const needsManualHandling = !inputIsAboveKeyboard;

      this.postMessage({
        type: 'KEYBOARD_DETECTION',
        needsManualHandling,
        keyboardHeight,
      });
    } catch (error) {
      console.warn('Error in keyboard detection:', error);
    }
  }

  isCurrentAccount(recipientAddress) {
    if (!myData || !myAccount) return false;
    
    // Check if the current user's address matches the recipient address
    return myData.account.keys.address === recipientAddress;
  }


  getNotificationStorage() {
    let storage = {};

    try {
      const raw = localStorage.getItem(this.notificationStorageKey);
      if (raw) {
        const parsed = parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          storage = parsed;
        }
      }
    } catch (error) {
      logsModal.log('⚠️ Failed to parse notification storage:', error);
      storage = {};
    }

    return storage;
  }

  getNotificationState() {
    const storage = this.getNotificationStorage();
    const netid = network.netid;

    if (!netid) {
      return {
        storage,
        netid: null,
        state: { timestamp: 0, addresses: [] },
      };
    }

    const entry = storage[netid];
    const timestamp = typeof entry?.timestamp === 'number' && Number.isFinite(entry.timestamp) ? entry.timestamp : 0;
    const addresses = Array.isArray(entry?.addresses)
      ? entry.addresses
          .filter(addr => typeof addr === 'string')
          .map(addr => addr.trim())
          .filter(addr => addr.length > 0)
      : [];

    return {
      storage,
      netid,
      state: {
        timestamp,
        addresses,
      },
    };
  }

  commitNotificationState(storage, netid, state) {
    if (!netid) return;

    const safeTimestamp = typeof state.timestamp === 'number' && Number.isFinite(state.timestamp) ? state.timestamp : 0;
    const safeAddresses = Array.isArray(state.addresses)
      ? state.addresses
          .filter(addr => typeof addr === 'string')
          .map(addr => addr.trim())
          .filter(addr => addr.length > 0)
      : [];

    storage[netid] = {
      timestamp: safeTimestamp,
      addresses: safeAddresses,
    };

    try {
      localStorage.setItem(this.notificationStorageKey, JSON.stringify(storage));
    } catch (error) {
      logsModal.log('❌ Error persisting notification storage:', error);
    }
  }

  /**
   * Save the notification address to localStorage array of addresses
   * @param {string} contactAddress - The address of the contact to save
   */
  saveNotificationAddress(contactAddress) {
    if (!contactAddress || typeof contactAddress !== 'string') return;
    
    // Don't save the current user's own address if they're already signed in
    // Notification storage is only for prioritizing accounts in the sign-in modal when user is NOT signed in
    // When user is signed in, they can see notifications in the wallet/chats UI, so no need to store it
    if (this.isCurrentAccount(contactAddress)) {
      // Also clear it if it already exists in storage (cleanup for cases where it was saved before this fix)
      this.clearNotificationAddress(contactAddress);
      return;
    }
    
    try {
      const { storage, netid, state } = this.getNotificationState();
      if (!netid) return;

      if (!state.addresses.includes(contactAddress)) {
        const updatedAddresses = [...state.addresses, contactAddress];
        this.commitNotificationState(storage, netid, {
          timestamp: state.timestamp,
          addresses: updatedAddresses,
        });
      }
    } catch (error) {
      logsModal.log('❌ Error saving notification address:', error);
    }
  }

  /**
   * Clear only selected address from the array
   * @param {string} address - The address to clear
   */
  clearNotificationAddress(address) {
    if (!address || typeof address !== 'string') return;
    
    try {
      const { storage, netid, state } = this.getNotificationState();
      if (!netid) return;

      const updatedAddresses = state.addresses.filter(addr => addr !== address);
      if (updatedAddresses.length !== state.addresses.length) {
        this.commitNotificationState(storage, netid, {
          timestamp: state.timestamp,
          addresses: updatedAddresses,
        });
      }
    } catch (error) {
      logsModal.log('❌ Error clearing notification address:', error);
    }
  }

  // Send navigation bar visibility
  sendNavigationBarVisibility(visible) {
    this.postMessage({
      type: 'NAV_BAR',
      visible
    });
  }

  // Send clear notifications message
  // NOTE: This only clears native app badge notifications, NOT UI notification dots
  sendClearNotifications(address=null) {
    this.postMessage({
      type: 'CLEAR_NOTI',
      address
    });
  }

  /**
   * Safely retrieve notification addresses from localStorage
   * @returns {Array} Array of notification addresses, empty array if none or error
   */
  getNotificationAddresses() {
    try {
      const { state } = this.getNotificationState();
      return [...state.addresses];
    } catch (error) {
      logsModal.log('❌ Failed to retrieve notification addresses:', error);
      return [];
    }
  }

  updateNotificationTimestamp(newTimestamp) {
    if (typeof newTimestamp !== 'number' || !Number.isFinite(newTimestamp)) {
      return;
    }

    try {
      const { storage, netid, state } = this.getNotificationState();
      if (!netid) return;

      if (newTimestamp > state.timestamp) {
        this.commitNotificationState(storage, netid, {
          timestamp: newTimestamp,
          addresses: state.addresses,
        });
      }
    } catch (error) {
      logsModal.log('❌ Error updating notification timestamp:', error);
    }
  }

  /**
   * Handle native app subscription tokens and handle subscription
   * This is used to subscribe to push notifications for the native app
   * @returns {Promise<void>}
   */
  async handleNativeAppSubscribe() {
    // Check if we're online before proceeding
    if (!isOnline) {
      return;
    }

    const deviceToken = this.deviceToken || null;
    const expoPushToken = this.expoPushToken || null;
    const fcmToken = this.fcmToken || null;
    const voipToken = this.voipToken || null;
    
    if (deviceToken && expoPushToken) {      
      try {
        // Get the user's address from localStorage if available
        const { netid } = network;
        const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
        const netidAccounts = existingAccounts.netids[netid];
        
        let addresses = [];
        if (netidAccounts?.usernames) {
          // Get addresses from all stored accounts and convert to long format
          addresses = Object.values(netidAccounts.usernames).map(account => longAddress(account.address));
        }

        if (addresses.length < 1) return;
        
        const payload = {
          deviceToken,
          expoPushToken,
          ...fcmToken && { fcmToken },
          ...voipToken && { voipToken },
          addresses: addresses
        };
        
        // Get the appropriate gateway for this request
        const selectedGateway = getGatewayForRequest();
        if (!selectedGateway) {
          console.error('No gateway available for subscription request');
          showToast('No gateway available', 0, 'error');
          return;
        }

        const SUBSCRIPTION_API = `${selectedGateway.web}/notifier/subscribe`;
        
        const response = await fetch(SUBSCRIPTION_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          /* showToast('Push notifications enabled', 3000, 'success'); */
        } else {
          console.error('Subscription failed:', response.status, response.statusText);
          /* showToast('Failed to enable push notifications', 3000, 'error'); */
        }
      } catch (error) {
        console.error('Error subscribing to push notifications:', error);
        /* showToast('Error enabling push notifications', 3000, 'error'); */
      }
    }
  }

  /**
   * Unsubscribe the native app from push notifications for the current account.
   * If other accounts are on the device, it updates the subscription to only include them.
   * If this is the last account, it fully unsubscribes the device.
   */
  async handleNativeAppUnsubscribe() {
    // Early return if running on Android device in React Native WebView
    if (window.ReactNativeWebView && navigator.userAgent.toLowerCase().includes('android')) {
      return;
    }

    // Check if we're online before proceeding
    if (!isOnline) {
      return;
    }

    const deviceToken = this.deviceToken || null;
    const expoPushToken = this.expoPushToken || null;
    const fcmToken = this.fcmToken || null;
    const voipToken = this.voipToken || null;

    // cannot unsubscribe if no device token is provided
    if (!deviceToken) return;

    if (!myAccount || !myAccount.keys || !myAccount.keys.address) {
      console.warn('handleNativeAppUnsubscribe called without an active account. Aborting.');
      return;
    }

    const currentUserAddress = longAddress(myAccount.keys.address);

    // Get all other stored addresses on this device for the current network.
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];
    let allStoredAddresses = [];
    if (netidAccounts?.usernames) {
      allStoredAddresses = Object.values(netidAccounts.usernames).map(account => longAddress(account.address));
    }

    // Create a list of addresses to keep subscribed, excluding the current user.
    const remainingAddresses = allStoredAddresses.filter(addr => addr !== currentUserAddress);

    let payload;

    if (remainingAddresses.length === 0) {
      // This is the only account. Unsubscribe the device completely.
      payload = {
        deviceToken,
        addresses: [],
      };
    } else {
      // Other accounts remain. Update the subscription to only include them.
      if (!expoPushToken) {
        console.warn('Cannot update subscription for remaining accounts without a pushToken.');
        return;
      }
      payload = {
        deviceToken,
        expoPushToken,
        ...fcmToken && { fcmToken },
        ...voipToken && { voipToken },
        addresses: remainingAddresses,
      };
    }

    const selectedGateway = getGatewayForRequest();
    if (!selectedGateway) {
      console.error('No gateway available for unsubscribe request');
      return;
    }
    const SUBSCRIPTION_API = `${selectedGateway.web}/notifier/subscribe`;

    try {
      const res = await fetch(SUBSCRIPTION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.error('Unsubscribe failed:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error during unsubscribe:', err);
    }
  }
  
  shareInvite(url, text, title) {
    this.postMessage({
      type: 'SHARE_INVITE',
      url,
      text,
      title
    });
  }

  sendScheduledCall(username, timestamp, address){
    this.postMessage({
      type: 'SCHEDULE_CALL',
      username,
      timestamp,
      address
    });
  }
  
  sendCancelScheduledCall(username, timestamp){
    this.postMessage({
      type: 'CANCEL_SCHEDULE_CALL',
      username,
      timestamp
    });
  }

  /**
   * Check if the current app version needs to be updated
   * Compares the native app version with the required version from network.js
   */
  checkAppVersionUpdate() {
    if (!this.appVersion || !network?.app_version) {
      console.warn('❌ Version check skipped – missing data');
      return;
    }

    // Determine platform (iOS or Android)
    const ua = navigator.userAgent.toLowerCase();
    const platform = /android/.test(ua) ? 'android' : (/iphone|ipad|ios/.test(ua) ? 'ios' : 'android');

    const requiredVersion = network.app_version[platform];
    if (!requiredVersion) {
      console.warn('❌ No required version for platform: ' + platform);
      return;
    }

    // Compare versions (format: YYYY.MMDD.HHmm)
    const currentVersion = this.appVersion;
    const isUpdateNeeded = this.compareVersions(currentVersion, requiredVersion) < 0;

    if (isUpdateNeeded) {
      // Show toast notification on welcome page
      this.showUpdateNotification();
    }
  }

  /**
   * Compare two version strings in format YYYY.MMDD.HHmm
   * @param {string} version1 - Current version
   * @param {string} version2 - Required version
   * @returns {number} -1 if version1 is older, 1 if newer, 0 if equal
   */
  compareVersions(version1, version2) {
    // Convert version strings to comparable numbers
    // Format: YYYY.MMDD.HHmm -> YYYYMMDDHHmm
    const v1 = parseInt(version1.replace(/\D/g, ''));
    const v2 = parseInt(version2.replace(/\D/g, ''));
    
    if (v1 < v2) return -1;  // version1 is older
    if (v1 > v2) return 1;   // version1 is newer
    return 0;                // versions are equal
  }

  /**
   * Show update notification toast on the welcome screen
   */
  showUpdateNotification() {
    // Only show notification if we're on the welcome screen
    if (!welcomeScreen.screen || welcomeScreen.screen.style.display === 'none') {
      console.warn('❌ Update toast skipped – welcome not visible');
      return;
    }

    // Use template from index.html if available; fallback to inline HTML
    const tpl = document.getElementById('updateToastTemplate');
    const message = tpl.innerHTML 
    showToast(message, 0, 'info', true);
  }
}

// Initialize and load the app
const reactNativeApp = new ReactNativeApp();

/**
 * Remove failed transaction from the contacts messages, pending, and wallet history
 * @param {string} txid - The transaction ID to remove
 * @param {string} currentAddress - The address of the current contact
 */
function removeFailedTx(txid, currentAddress) {
  // remove pending tx if exists
  const index = myData.pending.findIndex((tx) => tx.txid === txid);
  if (index > -1) {
    myData.pending.splice(index, 1);
  }

  const contact = myData?.contacts?.[currentAddress];
  if (contact && contact.messages) {
    contact.messages = contact.messages.filter((msg) => msg.txid !== txid);
  }
  myData.wallet.history = myData?.wallet?.history?.filter((item) => item.txid !== txid);
}

async function checkPendingTransaction(txid, submittedts){
  const now = getCorrectedTimestamp();
  const duration = (now - submittedts) / 1000   // to make it in seconds
  let endpointPath = `/transaction/${txid}`;
  if (duration > 20){
    endpointPath = `/collector/api/transaction?appReceiptId=${txid}`;
  }
  //console.log(`DEBUG: txid ${txid} endpointPath: ${endpointPath}`);
  const res = await queryNetwork(endpointPath);
  //console.log(`DEBUG: txid ${txid} res: ${JSON.stringify(res)}`);  
  if (duration > 30 && (res.transaction === null || Object.keys(res.transaction).length === 0)) {
    return false;
  }
  if (res?.transaction?.success === true) { return true; }
  if (res?.transaction?.success === false) { return false }
  return null;
}

/**
 * Check pending transactions that are at least 5 seconds old
 * @returns {Promise<void>}
 */
async function checkPendingTransactions() {
  if (!myData || !myAccount) {
    return;
  }

  // initialize the pending array if it is not already initialized
  if (!myData.pending) {
    myData.pending = [];
  }

  if (myData.pending.length === 0) return; // No pending transactions to check

  const startingPendingCount = myData.pending.length;

  const now = getCorrectedTimestamp();
  const eightSecondsAgo = now - 8000;
  const twentySecondsAgo = now - 20000;
  const thirtySecondsAgo = now - 30000;
  // Process each transaction in reverse to safely remove items
  for (let i = myData.pending.length - 1; i >= 0; i--) {
    const pendingTxInfo = myData.pending[i];
    const { txid, type, submittedts } = pendingTxInfo;

    if (submittedts < eightSecondsAgo) {

      let endpointPath = `/transaction/${txid}`;
      if (submittedts < twentySecondsAgo || submittedts < thirtySecondsAgo) {
        endpointPath = `/collector/api/transaction?appReceiptId=${txid}`;
      }
      //console.log(`DEBUG: txid ${txid} endpointPath: ${endpointPath}`);
      const res = await queryNetwork(endpointPath);
      //console.log(`DEBUG: txid ${txid} res: ${JSON.stringify(res)}`);
      if (submittedts < thirtySecondsAgo && (res.transaction === null || Object.keys(res.transaction).length === 0)) {
        console.error(`DEBUG: txid ${txid} timed out, removing completely`);
        // remove the pending tx from the pending array
        myData.pending.splice(i, 1);
        continue;
      }

      if (res?.transaction?.success === true) {
        // comment out to test the pending txs removal logic
        myData.pending.splice(i, 1);

        if (type === 'register') {
          pendingPromiseService.resolve(txid, {
            username: pendingTxInfo.username,
            address: pendingTxInfo.address,
          });
        }

        if (res?.transaction?.type === 'withdraw_stake') {
          const index = myData.wallet.history.findIndex((tx) => tx.txid === txid);
          if (index !== -1) {
            // covert amount to wei
            myData.wallet.history[index].amount = parse(stringify(res.transaction.additionalInfo.totalUnstakeAmount));
          }
        }

        if (type === 'deposit_stake' || type === 'withdraw_stake') {
          // show toast notification with the success message
          showToast(`${type === 'deposit_stake' ? 'Stake' : 'Unstake'} transaction successful`, 5000, 'success');
          // refresh only if validator modal is open
          if (validatorStakingModal.isActive()) {
            validatorStakingModal.close();
            validatorStakingModal.open();
          }
        }

        if (type === 'toll') {
          // log used by e2e tests do not delete
          console.log(`Toll transaction successfully processed!`);
          if (tollModal.isActive()) {
            showToast(`Toll change successful!`, 3000, 'success');
          }
        }

        if (type === 'update_toll_required') {
          // log used by e2e tests do not delete
          console.log(`DEBUG: update_toll_required transaction successfully processed!`);
          myData.contacts[pendingTxInfo.to].friendOld = myData.contacts[pendingTxInfo.to].friend;
        }

        if (type === 'read') {
          console.log(`DEBUG: read transaction successfully processed!`);
        }

        if (type === 'reclaim_toll') {
          console.log(`DEBUG: reclaim_toll transaction successfully processed!`);
        }
      } else if (res?.transaction?.success === false) {
        console.log(`DEBUG: txid ${txid} failed, removing completely`);
        // Check for failure reason in the transaction receipt
        const failureReason = res?.transaction?.reason || 'Transaction failed';
        console.log(`DEBUG: failure reason: ${failureReason}`);

        if (type === 'register') {
          pendingPromiseService.reject(txid, new Error(failureReason));
        } else {
          // Show toast notification with the failure reason
          if (type === 'withdraw_stake') {
            showToast(`Unstake failed: ${failureReason}`, 0, 'error');
          } else if (type === 'deposit_stake') {
            showToast(`Stake failed: ${failureReason}`, 0, 'error');
          } else if (type === 'message') {
            if (chatModal.isActive()) {
              await chatModal.reopen();
            }
          } else if (type === 'transfer') {
            if (sendAssetFormModal.isActive()) {
              await sendAssetFormModal.reopen();
            }
          }
          else if (type === 'toll') {
            showToast(
              `Toll submission failed! Reverting to old toll: ${tollModal.oldToll}. Failure reason: ${failureReason}. `,
              0,
              'error'
            );
            // revert the local myData.settings.toll to the old value
            tollModal.editMyDataToll(tollModal.oldToll, tollModal.currentCurrency);
            // check if the toll modal is open
            if (tollModal.isActive()) {
              // change the tollAmountLIB and tollAmountUSD to the old value
              tollModal.tollAmountLIB = tollModal.oldToll;
              tollModal.tollAmountUSD = tollModal.oldToll;
            }
          } else if (type === 'update_toll_required') {
            showToast(`Update contact status failed: ${failureReason}. Reverting contact to old status.`, 0, 'error');
            const currentFriendStatus = Number(myData.contacts?.[pendingTxInfo.to]?.friend);
            const previousFriendStatus = Number(myData.contacts?.[pendingTxInfo.to]?.friendOld);
            // revert the local myData.contacts[toAddress].friend to the old value
            myData.contacts[pendingTxInfo.to].friend = myData.contacts[pendingTxInfo.to].friendOld;
            // update contact list since friend status was reverted
            await contactsScreen.updateContactsList();
            // Only refresh chats list if the revert enters or exits "blocked"
            if (currentFriendStatus === 0 || previousFriendStatus === 0) {
              await chatsScreen.updateChatList();
            }
          } else if (type === 'read') {
            showToast(`Read transaction failed: ${failureReason}`, 0, 'error');
            // revert the local myData.contacts[toAddress].timestamp to the old value
            myData.contacts[pendingTxInfo.to].timestamp = pendingTxInfo.oldContactTimestamp;
          } else if (type === 'reclaim_toll') {
            if (failureReason !== 'user is trying to reclaim toll but the toll pool is empty') {
              showToast(`Reclaim toll failed: ${failureReason}`, 0, 'error');
            }
          } else {
            // for messages, transfer etc.
            showToast(failureReason, 0, 'error');
          }

          const toAddress = pendingTxInfo.to;
          updateTransactionStatus(txid, toAddress, 'failed', type);
          chatModal.refreshCurrentView(txid);
        }
        // Remove from pending array
        myData.pending.splice(i, 1);

        // refresh the validator modal if this is a withdraw_stake/deposit_stake and validator modal is open
        if (type === 'withdraw_stake' || type === 'deposit_stake') {
          // remove from wallet history
          myData.wallet.history = myData.wallet.history.filter((tx) => tx.txid !== txid);

          if (validatorStakingModal.isActive()) {
            // refresh the validator modal
            validatorStakingModal.close();
            validatorStakingModal.open();
          }
        }
      } else {
        console.log(`DEBUG: tx ${txid} status unknown, waiting for receipt`);
      }
    }
  }
  // if createAccountModal is open, skip balance change
  if (!createAccountModal.isActive()) {
    walletScreen.updateWalletBalances();
  }

  // save state if pending transactions were processed
  if (startingPendingCount !== myData.pending.length) {
    saveState();
  }
}

/**
 * Update status of a transaction in wallet if it is a transfer, and always in contacts messages
 * @param {string} txid - The transaction ID to update
 * @param {string} toAddress - The address of the recipient
 * @param {string} status - The new status to set ('sent', 'failed', etc.)
 * @param {string} type - The type of transaction ('message', 'transfer', etc.)
 */
function updateTransactionStatus(txid, toAddress, status, type) {
  if (!txid || !myData?.contacts) return;

  // Update history items (using forEach instead of map)
  if (type === 'transfer') {
    const txIndex = myData.wallet.history.findIndex((tx) => tx.txid === txid);
    if (txIndex !== -1) {
      myData.wallet.history[txIndex].status = status;
    }
  }

  // now use toAddress to find the contact and change the status of the message
  const contact = myData.contacts[toAddress];
  if (contact) {
    const msgIndex = contact.messages.findIndex((msg) => msg.txid === txid);
    if (msgIndex !== -1) {
      contact.messages[msgIndex].status = status;
    }
  }
}
const pendingPromiseService = (() => {
  const pendingPromises = new Map(); // txid -> { resolve, reject }

  function register(txid) {
    return new Promise((resolve, reject) => {
      pendingPromises.set(txid, { resolve, reject });
    });
  }

  function resolve(txid, data) {
    if (pendingPromises.has(txid)) {
      const promiseControls = pendingPromises.get(txid);
      promiseControls.resolve(data);
      pendingPromises.delete(txid);
    }
  }

  function reject(txid, error) {
    if (pendingPromises.has(txid)) {
      const promiseControls = pendingPromises.get(txid);
      promiseControls.reject(error);
      pendingPromises.delete(txid);
    }
  }

  return { register, resolve, reject };
})();

/*
 * Used to prevent tab from working.
 * @param {Event} e - The event object.
 */
function ignoreTabKey(e) {
  //console.log('DEBUG: ignoring tab key');
  // allow shift+tab to work
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
  }
}

/*
 * Used to prevent shift+tab from working.
 * @param {Event} e - The event object.
 */
function ignoreShiftTabKey(e) {
  // if key is tab and key.shiftKey is true, prevent default
  if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
  }
}

/**
 * Fetches and caches network account data if it's stale or not yet fetched.
 * @returns {Promise<void>} - Resolves when the network account data is updated or not needed
 */
async function getNetworkParams() {
  const now = getCorrectedTimestamp();

  // Check if data is fresh; (this.networkAccountTimeStamp || 0) handles initial undefined state
  if (now - (getNetworkParams.timestamp || 0) < NETWORK_ACCOUNT_UPDATE_INTERVAL_MS) {
    return;
  }

  // If offline, try to use cached parameters
  if (!isOnline) {
    const cachedParams = localStorage.getItem('cachedNetworkParams');
    if (cachedParams) {
      try {
        parameters = parse(cachedParams);
        return;
      } catch (e) {
        console.warn('Failed to parse cached network parameters:', e);
      }
    }
    console.warn('No cached network parameters available (offline)');
    return;
  }

  console.log(`getNetworkParams: Data for account ${NETWORK_ACCOUNT_ID} is stale or missing. Attempting to fetch...`);
  try {
    const fetchedData = await queryNetwork(`/account/${NETWORK_ACCOUNT_ID}`);

    if (fetchedData !== undefined && fetchedData !== null) {
      parameters = fetchedData.account;
      getNetworkParams.timestamp = now;
      
      // Cache all network parameters for offline use
      localStorage.setItem('cachedNetworkParams', stringify(parameters));
      
      // if network id from network.js is not the same as the parameters.current.networkId
      if (network.netid !== parameters.networkId) {
        // treat as offline
        netIdMismatch = true;
        isOnline = false;
        updateUIForConnectivity();
        console.error(`getNetworkParams: Network ID mismatch. Network ID from network.js: ${network.netid}, Network ID from parameters: ${parameters.networkId}`);
        console.log(parameters)
        // show toast notification with the error message
        showToast(`Network ID mismatch. Check network configuration in network.js.`, 0, 'error');
      }
      return;
    } else {
      isOnline = false;
      updateUIForConnectivity();
      console.warn(
        `getNetworkParams: Received null or undefined data from queryNetwork for account ${NETWORK_ACCOUNT_ID}. Cached data (if any) will remain unchanged.`
      );
    }
  } catch (error) {
    isOnline = false;
    updateUIForConnectivity();
    console.error(
      `getNetworkParams: Error fetching network account data for ${NETWORK_ACCOUNT_ID}: Cached data (if any) will remain unchanged.`,
      error
    );
    // Optional: Clear data or reset timestamp to force retry on next call
  }
}
getNetworkParams.timestamp = 0;

async function getSystemNotice() {
  if (!isOnline) {
    return;
  }

  try {
    // First, do a HEAD request to check if the file exists and get its timestamp
    const headResponse = await fetch(`./notice.html?${Math.random()}`, { method: 'HEAD' });
    if (!headResponse.ok) {
      return;
    }

    // Get the Last-Modified header timestamp
    const lastModified = headResponse.headers.get('Last-Modified');
    const fileTimestamp = lastModified ? new Date(lastModified).getTime() : null;
    
    // Check if we need to show the notice based on file modification time
    // If no Last-Modified header, we'll check the content timestamp instead
    if (fileTimestamp && myData.settings.noticets && myData.settings.noticets >= fileTimestamp) {
      return; // File hasn't changed, no need to download
    }

    // Download the file content
    const response = await fetch(`./notice.html?${Math.random()}`);
    if (!response.ok) {
      return;
    }

    const text = await response.text();
    const lines = text.split('\n');

    if (lines.length < 2) {
      return;
    }

    // Find the first line that's not a comment and can be parsed as a timestamp
    let timestampLine = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('<!--') && !line.startsWith('-->')) {
        const parsed = parseInt(line);
        if (!isNaN(parsed)) {
          timestampLine = i;
          break;
        }
      }
    }

    if (timestampLine === null) {
      console.warn('No valid timestamp found in notice file');
      return;
    }

    const timestamp = parseInt(lines[timestampLine]);

    // Check if we need to show the notice
    if (!myData.settings.noticets || myData.settings.noticets < timestamp) {
      // Join remaining lines for the notice message (skip the timestamp line)
      const noticeMessage = lines.slice(timestampLine + 1).join('\n').trim();
      if (noticeMessage) {
        showToast(noticeMessage, 0, 'error');
        // Update the timestamp in settings
        myData.settings.noticets = timestamp;
      }
    }
  } catch (error) {
    console.error('Error processing system notice:', error);
  }
}

function cleanSenderInfo(si) {
  const csi = {};
  if (si.username) {
    csi.username = normalizeUsername(si.username)
  }
  if (si.name) {
    csi.name = normalizeName(si.name)
  }
  if (si.phone) {
    csi.phone = normalizePhone(si.phone)
  }
  if (si.email) {
    csi.email = normalizeEmail(si.email)
  }
  if (si.linkedin) {
    csi.linkedin = normalizeLinkedinUsername(si.linkedin)
  }
  if (si.x) {
    csi.x = normalizeXTwitterUsername(si.x)
  }
  if (si.timezone) {
    const tz = normalizeTimeZone(si.timezone);
    if (tz) {
      csi.timezone = tz;
    }
  }
  if (si.avatarId) {
    csi.avatarId = si.avatarId
  }
  if (si.avatarKey) {
    csi.avatarKey = si.avatarKey
  }
  return csi;
}

function getLocalTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' ? tz : '';
  } catch (e) {
    return '';
  }
}

function normalizeTimeZone(tz) {
  if (typeof tz !== 'string') {
    return '';
  }
  const cleaned = tz.trim();
  if (!cleaned) {
    return '';
  }
  // Keep bounded to avoid storing arbitrarily large strings
  return cleaned.slice(0, 64);
}

function stopLongPoll() {
  if (longPollTimeoutId) {
    clearTimeout(longPollTimeoutId);
    longPollTimeoutId = null;
  }
  if (longPollAbortController) {
    longPollAbortController.abort();
    longPollAbortController = null;
  }
  isLongPolling = false;
}

function longPoll() {
  if (!useLongPolling) {
    return;
  }
  if (!isOnline) {
    console.log('Poll skipped: Not online');
    return;
  }
  if (isLongPolling) {
    return;
  }

  const myAccount = myData?.account;
  // Skip if no valid account
  if (!myAccount?.keys?.address) {
    console.warn('Poll skipped: No valid account');
    return;
  }

  isLongPolling = true;

  try {
    longPoll.start = getCorrectedTimestamp();
    const timestamp = myAccount.chatTimestamp || 0;

    // Create abort controller for this request
    longPollAbortController = new AbortController();

    // call this with a promise that'll resolve with callback longPollResult function with the data
    const longPollPromise = queryNetwork(`/collector/api/poll?account=${longAddress(myAccount.keys.address)}&chatTimestamp=${timestamp}`, longPollAbortController.signal);
    
    // Handle both success and error cases properly
    longPollPromise
      .then(data => longPollResult(data))
      .catch(error => {
        console.error('Chat polling error:', error);
        // Reset polling state and schedule next poll even on error, but with longer delay
        isLongPolling = false;
        longPollAbortController = null;
        longPollTimeoutId = setTimeout(longPoll, 5000);
      });
  } catch (error) {
    const now = new Date().toLocaleTimeString();
    console.error('Synchronous longPoll error:', error);
    if(network.name != 'Testnet'){
//      showToast(`chat poll error: ${error} ${now}`)
    }
    // Reset polling state and schedule next poll even on synchronous error
    isLongPolling = false;
    longPollAbortController = null;
    longPollTimeoutId = setTimeout(longPoll, 5000);
  }
}
longPoll.start = 0;

async function longPollResult(data) {  
  // Reset polling state and clean up abort controller
  isLongPolling = false;
  longPollAbortController = null;
  
  // calculate the time since the last poll
  let nextPoll = 4000 - (getCorrectedTimestamp() - longPoll.start)
  if (nextPoll < 0) {
    nextPoll = 0;
  }
  // schedule the next poll
  longPollTimeoutId = setTimeout(longPoll, nextPoll + 1000);
  
  if (data?.success){
    longPollResult.timestamp = data.chatTimestamp;
    try {
      const gotChats = await chatsScreen.updateChatData();
      if (gotChats > 0) {
        chatsScreen.updateChatList();
      }
    } catch (error) {
      console.error('Chat polling error:', error);
    }
  }
}
longPollResult.timestamp = 0

function getContactDisplayName(contact) {
  return contact?.name || 
         contact?.username || 
         `${contact?.address?.slice(0, 8)}…${contact?.address?.slice(-6)}`;
}

/**
 * Checks if an address matches the network's faucet address
 * @param {string} address - The address to check
 * @returns {boolean} - True if the address matches the faucet address
 */
function isFaucetAddress(address) {
  if (!address || !network.faucetAddress) {
    return false;
  }
  const normalizedAddress = normalizeAddress(address);
  // Support both single string and array of addresses
  const faucetAddresses = Array.isArray(network.faucetAddress) 
    ? network.faucetAddress 
    : [network.faucetAddress];
  return faucetAddresses.some(faucetAddr => 
    normalizeAddress(faucetAddr) === normalizedAddress
  );
}

function isMobile() {
  return /Android|webOS|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if the user is on an Android-like mobile device (excludes iOS)
 * @returns {boolean}
 */
function isAndroidLikeMobileUA() {
  return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if the user is on an iOS device (iPhone or iPad)
 * @returns {boolean}
 */
function isIOS() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  // Check for iOS devices in user agent, or iPadOS 13+ (reports as Mac with touch)
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
  const isIPadOS = /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS;
}

function enterFullscreen() {
  if (isMobile()) {
    if (document.documentElement.requestFullscreen) {
      // on android 15 using chrome without delay caused issues with input field on ChatModal to be positioned below visual viewport
      setTimeout(() => {
        document.documentElement.requestFullscreen();
      }, 100);
    } 
  }
}

function exitFullscreen() {
  if (isMobile()) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function isInFullscreen() {
  return !!document.fullscreenElement;
}

function handleKeyboardFullscreenToggle() {
  if (!isMobile()) {
    return; // Only handle on mobile devices
  }

  const currentHeight = window.innerHeight;
  const heightDifference = initialViewportHeight - currentHeight;
  
  // If viewport height decreased significantly, keyboard is likely open
  if (heightDifference > 150) { // 150px threshold for keyboard detection
    if (isInFullscreen()) {
      setTimeout(() => {
        exitFullscreen();
      }, 0);
    }
  } else if (heightDifference < 50) { // If height increased or stayed similar, keyboard is likely closed
    if (!isInFullscreen()) {
      setTimeout(() => {
        enterFullscreen();
      }, 0);
    }
  }
}

/**
 * LocalStorageMonitor class
 * Handles localStorage monitoring and warnings
 */
class LocalStorageMonitor {
  constructor() {
    this.warningThreshold = 100 * 1024; // 100KB in bytes
    this.CAPACITY_KEY = '_localStorage_total_capacity_';
  }

  /**
   * Initialize the localStorage monitor
   */
  load() {
    this.checkStorageOnStartup();
  }

  /**
   * Check localStorage usage on app startup
   */
  checkStorageOnStartup() {
    try {
      const info = this.getStorageInfo();

      // Log to console
      
      setTimeout(() => {
        console.log('📊 STORAGE CHECK');
        console.log('========================');
        console.log(`📁 localStorage Used: ${info.usageMB}MB (${info.usageBytes} bytes)`);
        console.log(`💾 localStorage Available: ${info.availableMB}MB (${info.availableBytes} bytes)`);
        console.log(`📏 localStorage Total: ${info.totalCapacityMB}MB (${info.totalCapacityBytes} bytes)`);
        console.log(`📊 Usage: ${info.percentageUsed}%`);
        console.log('========================\n');
      }, 1000);

      // Check for low storage warning (less than 100KB available)
      if (info.availableBytes < this.warningThreshold) {
        const warningMessage = `⚠️ Storage Warning: Only ${(info.availableBytes / 1024).toFixed(1)}KB remaining! Consider clearing old data.`;
        console.warn(warningMessage);
        showToast(warningMessage, 8000, 'warning');
      }
    } catch (error) {
      console.error('Error checking localStorage on startup:', error);
    }
  }

  /**
   * Get localStorage information using cached or calculated capacity
   */
  getStorageInfo() {
    const usage = this.getLocalStorageUsage();
    const totalCapacity = this.getCachedOrCalculateCapacity();
    const availableNow = totalCapacity - usage;
    const percentageUsed = ((usage / totalCapacity) * 100).toFixed(2);

    return {
      usageBytes: usage,
      availableBytes: availableNow,
      totalCapacityBytes: totalCapacity,
      totalCapacityMB: (totalCapacity / (1024 * 1024)).toFixed(2),
      usageMB: (usage / (1024 * 1024)).toFixed(2),
      availableMB: (availableNow / (1024 * 1024)).toFixed(2),
      percentageUsed: parseFloat(percentageUsed)
    };
  }

  /**
   * Get cached localStorage capacity or calculate it for the first time
   * @returns {number} Total localStorage capacity in bytes
   */
  getCachedOrCalculateCapacity() {
    const storedCapacity = localStorage.getItem(this.CAPACITY_KEY);
    if (storedCapacity) {
      return parseInt(storedCapacity);
    }
    
    const usage = this.getLocalStorageUsage();
    const available = this.findLocalStorageAvailable(); // Only runs once!
    const totalCapacity = usage + available;
    
    localStorage.setItem(this.CAPACITY_KEY, totalCapacity.toString());
    
    return totalCapacity;
  }

  /**
   * Find available localStorage space using binary search
   * @returns {number} Available localStorage space in bytes (how much MORE can be stored)
   */
  findLocalStorageAvailable() {
    const testKey = '_storage_test_';
    let low = 0;
    let high = 6 * 1024 * 1024; // Start with 6MB (more realistic upper bound)
    let maxCharacters = 0;

    // Clear any existing test data
    localStorage.removeItem(testKey);

    // Binary search for maximum storable characters
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testData = 'x'.repeat(mid);

      try {
        localStorage.setItem(testKey, testData);
        localStorage.removeItem(testKey);
        maxCharacters = mid;
        low = mid + 1;
      } catch (e) {
        high = mid - 1;
      }
    }

    // Verification step - test the found limit
    if (maxCharacters > 0) {
      try {
        const verifyData = 'x'.repeat(maxCharacters);
        localStorage.setItem(testKey, verifyData);
        localStorage.removeItem(testKey);
      } catch (e) {
        // If verification fails, reduce by small amount
        maxCharacters = Math.max(0, maxCharacters - 1024);
      }
    }

    // Convert characters to bytes (UTF-16: 2 bytes per character)
    // Add key length (test key is 13 characters = 26 bytes)
    const keyBytes = testKey.length * 2;
    const maxBytes = (maxCharacters * 2) - keyBytes;

    return Math.max(0, maxBytes);
  }

  /**
   * Get current localStorage usage in bytes
   * @returns {number} Total localStorage usage in bytes
   */
  getLocalStorageUsage() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key) || '';
        total += (key.length + value.length) * 2; // UTF-16 encoding
      }
    } catch (e) {
      console.warn('Error calculating localStorage usage:', e);
    }
    return total;
  }
}

// Create localStorage monitor instance
const localStorageMonitor = new LocalStorageMonitor();

// Contact avatar thumbnail sizing defaults
const CONTACT_AVATAR_MAX_THUMB_SIZE = 128;
const CONTACT_AVATAR_JPEG_QUALITY = 0.85;

/**
 * ContactAvatarCache - Handles IndexedDB storage for contact avatar thumbnails
 */
class ContactAvatarCache {
  constructor() {
    this.dbName = 'liberdus_contact_avatars';
    this.storeName = 'avatars';
    // Bump version to force onupgradeneeded for existing installations
    this.dbVersion = 2;
    this.db = null;
    this.blobUrlCache = new Map();
  }

  /**
   * Load and initialize the contact avatar cache
   * @returns {Promise<void>}
   */
  async load() {
    try {
      await this.init();
    } catch (err) {
      console.warn('Failed to load contact avatar cache:', err);
    }
  }

  /**
   * Initialize IndexedDB database connection
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open contact avatar database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // If an old store exists (keyPath=address) remove it and recreate under 'id'.
        if (db.objectStoreNames.contains(this.storeName)) {
          try {
            db.deleteObjectStore(this.storeName);
          } catch (e) {
            console.warn('Failed to delete existing avatars object store during upgrade:', e);
          }
        }
        // Use avatar id as the primary key for one-image-per-id storage
        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      };
    });
  }

  /**
   * Generate a thumbnail from an image blob (optimized for avatars)
   * @param {Blob} imageBlob - The image blob to create thumbnail from
   * @param {number} maxSize - Maximum dimension in pixels (default: CONTACT_AVATAR_MAX_THUMB_SIZE)
   * @param {number} quality - JPEG quality 0-1 (default: CONTACT_AVATAR_JPEG_QUALITY)
   * @returns {Promise<Blob>} The thumbnail blob
   */
  async generateThumbnail(imageBlob, maxSize = CONTACT_AVATAR_MAX_THUMB_SIZE, quality = CONTACT_AVATAR_JPEG_QUALITY) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const blobUrl = URL.createObjectURL(imageBlob);

      img.onload = () => {
        URL.revokeObjectURL(blobUrl);

        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const outputType = imageBlob.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create avatar thumbnail blob'));
            }
          },
          outputType,
          outputType === 'image/jpeg' ? quality : undefined
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load image for avatar thumbnail generation'));
      };

      img.src = blobUrl;
    });
  }

  /**
   * Save an avatar blob to the avatars store keyed by avatar id.
   * @param {string} id - Avatar id (server-provided or locally-generated)
   * @param {Blob} avatarBlob - The avatar image blob to store
   * @returns {Promise<void>}
   */
  async save(id, avatarBlob) {
    if (!id) throw new Error('avatar id required');
    if (!this.db) await this.init();

    // Revoke any cached object URL for this id
    if (this.blobUrlCache.has(id)) {
      try { URL.revokeObjectURL(this.blobUrlCache.get(id)); } catch (e) {}
      this.blobUrlCache.delete(id);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      const record = {
        id,
        blob: avatarBlob,
        type: avatarBlob?.type || 'image/jpeg',
        size: avatarBlob?.size || 0,
        savedAt: Date.now(),
      };

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => {
        console.warn('Failed to save avatar blob:', putReq.error);
        reject(putReq.error);
      };
    });
  }

  /**
   * Get avatar blob by avatar id.
   * @param {string} id - Avatar id (server-provided or locally-generated)
   * @returns {Promise<Blob|null>} The avatar blob or null if not found
   */
  async get(id) {
    if (!id) return null;
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) return resolve(null);
        return resolve(result.blob || null);
      };

      request.onerror = () => {
        console.warn('Failed to get avatar blob:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a blob URL for an avatar id (cached).
   * @param {string} id - Avatar id (server-provided or locally-generated)
   * @returns {Promise<string|null>} Blob URL or null if not found
   */
  async getBlobUrl(id) {
    if (!id) return null;
    if (this.blobUrlCache.has(id)) return this.blobUrlCache.get(id);
    const blob = await this.get(id);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrlCache.set(id, blobUrl);
      return blobUrl;
    }
    return null;
  }

  /**
   * Delete an avatar record by id.
   * @param {string} id - Avatar id to delete
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!id) return;
    if (!this.db) await this.init();

    // Revoke cached URL for this id
    if (this.blobUrlCache.has(id)) {
      try { URL.revokeObjectURL(this.blobUrlCache.get(id)); } catch (e) {}
      this.blobUrlCache.delete(id);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export all avatars as an object with base64-encoded data
   * @returns {Promise<Object>} Object mapping id to { data: base64, type: mimeType, size }
   */
  async exportAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = async () => {
        const results = request.result || [];
        const avatars = {};
        for (const item of results) {
          if (item && item.id && item.blob) {
            try {
              avatars[item.id] = {
                data: await this.blobToBase64(item.blob),
                type: item.type || 'image/jpeg',
                size: item.size || 0,
              };
            } catch (e) {
              console.warn(`Failed to export avatar id ${item.id}:`, e);
            }
          }
        }
        resolve(avatars);
      };

      request.onerror = () => {
        console.warn('Failed to export avatars:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Import avatars from exported data
   * @param {Object} avatarsData - Object mapping avatar id to { data: base64, type: mimeType }
   * @param {boolean} overwrite - Whether to overwrite existing avatars
   * @returns {Promise<number>} Number of avatars imported
   */
  async importAll(avatarsData, overwrite = false) {
    if (!this.db) await this.init();
    if (!avatarsData || typeof avatarsData !== 'object') return 0;

    let importedCount = 0;
    for (const [id, avatarInfo] of Object.entries(avatarsData)) {
      if (!avatarInfo) continue;
      try {
        if (!overwrite) {
          const existing = await this.get(id);
          if (existing) continue;
        }
        if (avatarInfo.data) {
          const blob = this.base64ToBlob(avatarInfo.data, avatarInfo.type || 'image/jpeg');
          await this.save(id, blob);
          importedCount++;
        }
      } catch (e) {
        console.warn(`Failed to import avatar id ${id}:`, e);
      }
    }

    return importedCount;
  }

  /**
   * Convert a Blob to base64 string
   * @param {Blob} blob - The blob to convert
   * @returns {Promise<string>} Base64 encoded string
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert a base64 string back to Blob
   * @param {string} base64 - Base64 encoded string
   * @param {string} mimeType - MIME type of the blob
   * @returns {Blob} The resulting blob
   */
  base64ToBlob(base64, mimeType = 'image/jpeg') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

const contactAvatarCache = new ContactAvatarCache();

/**
 * ThumbnailCache - Handles IndexedDB storage for image thumbnails
 */
class ThumbnailCache {
  constructor() {
    this.dbName = 'liberdus_thumbnails';
    this.storeName = 'thumbnails';
    this.dbVersion = 1;
    this.db = null;
    this.maxCacheSize = 50 * 1024 * 1024; // 50MB in bytes
  }

  /**
   * Load and initialize the thumbnail cache
   * @returns {Promise<void>}
   */
  async load() {
    try {
      await this.init();
      // Cleanup by size if cache is too large
      const sizeDeletedCount = await this.cleanupBySize();
    } catch (err) {
      console.warn('Failed to load thumbnail cache:', err);
    }
  }

  /**
   * Initialize IndexedDB database connection
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open thumbnail database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'url' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Generate a thumbnail from an image blob
   * @param {Blob} imageBlob - The image blob to create thumbnail from
   * @param {number} maxSize - Maximum dimension in pixels (default: 500)
   * @param {number} quality - JPEG quality 0-1 (default: 0.96)
   * @returns {Promise<Blob>} The thumbnail blob
   */
  async generateThumbnail(imageBlob, maxSize = 500, quality = 0.96) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const blobUrl = URL.createObjectURL(imageBlob);

      img.onload = () => {
        URL.revokeObjectURL(blobUrl);

        // Calculate dimensions maintaining aspect ratio
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        // Create canvas and draw scaled image with high quality rendering
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Enable high-quality image smoothing for better thumbnail quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob (use JPEG for efficiency, PNG if transparency needed)
        const outputType = imageBlob.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          outputType,
          outputType === 'image/jpeg' ? quality : undefined
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load image for thumbnail generation'));
      };

      img.src = blobUrl;
    });
  }

  /**
   * Extract a thumbnail frame from a video file
   * @param {Blob|File} videoFile - The video file to extract thumbnail from
   * @param {number} timeInSeconds - Time in seconds to extract frame from (default: 0.5)
   * @param {number} maxSize - Maximum dimension in pixels (default: 500)
   * @param {number} quality - JPEG quality 0-1 (default: 0.9)
   * @returns {Promise<Blob>} The thumbnail blob as JPEG
   */
  async extractVideoThumbnail(videoFile, timeInSeconds = 0.5, maxSize = 500, quality = 0.9) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const objectURL = URL.createObjectURL(videoFile);
      video.src = objectURL;

      video.onloadedmetadata = () => {
        // Seek to specified time (default 0.5s) but don't go past end
        const seekTime = Math.min(timeInSeconds, Math.max(0, video.duration - 0.1));
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        // Calculate thumbnail dimensions maintaining aspect ratio
        const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
        const thumbWidth = Math.floor(video.videoWidth * scale);
        const thumbHeight = Math.floor(video.videoHeight * scale);

        // Create canvas for thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = thumbWidth;
        canvas.height = thumbHeight;
        const ctx = canvas.getContext('2d');
        
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw video frame onto canvas (scaled)
        ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);

        // Convert to JPEG blob
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectURL);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create video thumbnail blob'));
          }
        }, 'image/jpeg', quality);
      };

      video.onerror = (error) => {
        URL.revokeObjectURL(objectURL);
        reject(new Error('Failed to load video for thumbnail extraction: ' + (error.message || 'Unknown error')));
      };

      video.load();
    });
  }

  /**
   * Get the current total size of all cached thumbnails
   * @returns {Promise<number>} Total size in bytes
   */
  async getCacheSize() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result;
        const totalSize = results.reduce((sum, item) => {
          return sum + (item.thumbnail ? item.thumbnail.size : 0);
        }, 0);
        resolve(totalSize);
      };

      request.onerror = () => {
        console.warn('Failed to get cache size:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Remove oldest thumbnails until cache size is under limit
   * @returns {Promise<number>} Number of thumbnails removed
   */
  async cleanupBySize() {
    if (!this.db) {
      await this.init();
    }

    const currentSize = await this.getCacheSize();
    // Target 90% of max to leave headroom and avoid frequent cleanups
    const targetSize = this.maxCacheSize * 0.9;
    
    if (currentSize <= targetSize) {
      return 0;
    }

    const sizeToRemove = currentSize - targetSize;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('cachedAt');
      const request = index.openCursor(null, 'next'); // Oldest first

      let deletedCount = 0;
      let removedSize = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && removedSize < sizeToRemove) {
          const item = cursor.value;
          const itemSize = item.thumbnail ? item.thumbnail.size : 0;
          
          cursor.delete();
          deletedCount++;
          removedSize += itemSize;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.warn('Failed to cleanup thumbnails by size:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Save a thumbnail to IndexedDB
   * @param {string} attachmentUrl - The attachment URL (used as key)
   * @param {Blob} thumbnailBlob - The thumbnail blob to store
   * @param {string} originalType - Original MIME type
   * @returns {Promise<void>}
   */
  async save(attachmentUrl, thumbnailBlob, originalType) {
    if (!this.db) {
      await this.init();
    }

    // Check if adding this thumbnail would exceed size limit
    const currentSize = await this.getCacheSize();
    const newThumbnailSize = thumbnailBlob.size;
    
    // If adding this thumbnail would exceed limit, cleanup first
    if (currentSize + newThumbnailSize > this.maxCacheSize) {
      await this.cleanupBySize();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      const data = {
        url: attachmentUrl,
        thumbnail: thumbnailBlob,
        originalType: originalType,
        cachedAt: Date.now()
      };

      const request = store.put(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.warn('Failed to save thumbnail:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retrieve a cached thumbnail from IndexedDB
   * @param {string} attachmentUrl - The attachment URL
   * @returns {Promise<Blob|null>} The thumbnail blob or null if not found
   */
  async get(attachmentUrl) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(attachmentUrl);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.thumbnail) {
          resolve(result.thumbnail);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.warn('Failed to get thumbnail:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a cached thumbnail from IndexedDB
   * @param {string} attachmentUrl - The attachment URL (key)
   * @returns {Promise<void>}
   */
  async delete(attachmentUrl) {
    if (!attachmentUrl) return;
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(attachmentUrl);

      request.onsuccess = () => resolve();

      request.onerror = () => {
        console.warn('Failed to delete thumbnail:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Export all thumbnails as an object with base64-encoded data
   * @returns {Promise<Object>} Object mapping url to { data: base64, type: mimeType, originalType: string }
   */
  async exportAll() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = async () => {
        const results = request.result;
        const thumbnails = {};

        for (const item of results) {
          if (item.url && item.thumbnail) {
            try {
              // Convert blob to base64
              const base64 = await this.blobToBase64(item.thumbnail);
              thumbnails[item.url] = {
                data: base64,
                type: item.thumbnail.type || 'image/jpeg',
                originalType: item.originalType || 'image/jpeg'
              };
            } catch (e) {
              console.warn(`Failed to export thumbnail for ${item.url}:`, e);
            }
          }
        }

        resolve(thumbnails);
      };

      request.onerror = () => {
        console.warn('Failed to export thumbnails:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Import thumbnails from exported data
   * @param {Object} thumbnailsData - Object mapping url to { data: base64, type: mimeType, originalType: string }
   * @param {boolean} overwrite - Whether to overwrite existing thumbnails
   * @returns {Promise<number>} Number of thumbnails imported
   */
  async importAll(thumbnailsData, overwrite = false) {
    if (!this.db) {
      await this.init();
    }

    if (!thumbnailsData || typeof thumbnailsData !== 'object') {
      return 0;
    }

    let importedCount = 0;

    for (const [url, thumbInfo] of Object.entries(thumbnailsData)) {
      if (!thumbInfo || !thumbInfo.data) continue;

      try {
        // Check if thumbnail already exists
        if (!overwrite) {
          const existing = await this.get(url);
          if (existing) continue;
        }

        // Convert base64 back to blob
        const blob = this.base64ToBlob(thumbInfo.data, thumbInfo.type || 'image/jpeg');
        await this.save(url, blob, thumbInfo.originalType || thumbInfo.type || 'image/jpeg');
        importedCount++;
      } catch (e) {
        console.warn(`Failed to import thumbnail for ${url}:`, e);
      }
    }

    return importedCount;
  }

  /**
   * Convert a Blob to base64 string
   * @param {Blob} blob - The blob to convert
   * @returns {Promise<string>} Base64 encoded string
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert a base64 string back to Blob
   * @param {string} base64 - Base64 encoded string
   * @param {string} mimeType - MIME type of the blob
   * @returns {Blob} The resulting blob
   */
  base64ToBlob(base64, mimeType = 'image/jpeg') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

const thumbnailCache = new ThumbnailCache();

/**
 * Get HTML for a contact avatar (cached blob if available, otherwise identicon)
 * @param {object|string} contactOrAddress - Contact object or address string
 * @param {number} size - Desired avatar size
 * @returns {Promise<string>} HTML string for avatar image/svg
 */
async function getContactAvatarHtml(contactOrAddress, size = 50) {
  const address = typeof contactOrAddress === 'string'
    ? normalizeAddress(contactOrAddress)
    : normalizeAddress(contactOrAddress?.address);

  // Helper to return img HTML when blobUrl available
  const makeImg = (url) => `<img src="${url}" class="contact-avatar-img" width="${size}" height="${size}" alt="avatar">`;
  
  const contactObj = typeof contactOrAddress === 'object' && contactOrAddress !== null
    ? contactOrAddress
    : myData?.contacts?.[address] || {};

  // If the requested avatar is for the current user, always return the
  // account avatar if present, otherwise identicon. We do not consult or
  // persist a `useAvatar` preference for the account anymore.
  if (address && myAccount?.keys?.address && normalizeAddress(myAccount.keys.address) === address) {
    try {
      const aid = myData?.account?.avatarId;
      if (aid) {
        const url = await contactAvatarCache.getBlobUrl(aid);
        if (url) return makeImg(url);
      }
    } catch (e) {
      console.warn('Failed to load account avatar, falling back to identicon:', e);
    }
    return generateIdenticon(address, size);
  }

  // useAvatar preference: 'contact' | 'mine' | 'identicon'
  const usePref = contactObj.useAvatar || myData?.contacts?.[address]?.useAvatar || null;

  if (address) {
    try {
      if (usePref === 'identicon') return generateIdenticon(address, size);

      // Determine available avatar ids from contact or account
      const contact = typeof contactOrAddress === 'object' && contactOrAddress !== null
        ? contactOrAddress
        : myData?.contacts?.[address] || null;

      if (usePref === 'mine') {
        // Prefer the user's uploaded avatar for this contact; fall back to contact avatar.
        // Only use the account avatar when the contact is the current user.
        let id = contact?.mineAvatarId || contact?.avatarId;
        if (!id && address && myData?.account?.address && normalizeAddress(myData.account.address) === address) {
          id = myData?.account?.avatarId;
        }
        if (id) {
          const url = await contactAvatarCache.getBlobUrl(id);
          if (url) return makeImg(url);
        }
      } else if (usePref === 'contact') {
        const id = contact?.avatarId || null;
        if (id) {
          const url = await contactAvatarCache.getBlobUrl(id);
          if (url) return makeImg(url);
        }
      } else {
        // No explicit preference: prefer contact avatar, then user-uploaded avatar.
        // Do NOT fall back to the account's avatar here — that previously caused
        // unrelated contacts with no images to show the user's own avatar.
        let id = contact?.avatarId;
        if (id) {
          let url = await contactAvatarCache.getBlobUrl(id);
          if (url) return makeImg(url);
        }
        id = contact?.mineAvatarId;
        if (id) {
          let url = await contactAvatarCache.getBlobUrl(id);
          if (url) return makeImg(url);
        }
      }
    } catch (err) {
      console.warn('Failed to load avatar, falling back to identicon:', err);
    }

    return generateIdenticon(address, size);
  }

  return generateIdenticon('', size);
}

/**
 * Encrypt a blob using ChaCha20-Poly1305 via Web Worker
 * @param {Blob} blob - The blob to encrypt
 * @param {Uint8Array} key - The encryption key
 * @returns {Promise<Blob>} The encrypted blob
 */
async function encryptBlob(blob, key) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('encryption.worker.js', { type: 'module' });
    worker.postMessage({ action: 'encryptBlob', blob, key });
    worker.onmessage = (e) => {
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.blob);
      }
      worker.terminate();
    };
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
  });
}

/**
 * Download and decrypt an avatar from the attachment server
 * @param {string} url - The download URL
 * @param {string} key - The decryption key (base64)
 * @returns {Promise<Blob>} The decrypted avatar blob
 */
async function downloadAndDecryptAvatar(url, key) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download avatar: ${response.status}`);
    }
    // Download bytes, convert to base64 (encryptChacha/ decryptChacha use base64 strings)
    const cipherBin = new Uint8Array(await response.arrayBuffer());
    const cipherB64 = bin2base64(cipherBin);

    // key is stored as base64 in account; convert to binary key for decryptChacha
    const keyBin = base642bin(key);

    // decryptChacha expects (keyUint8Array, cipherBase64) and returns plaintext base64
    const plainB64 = decryptChacha(keyBin, cipherB64);
    if (!plainB64) throw new Error('decryptChacha returned null');

    const clearBin = base642bin(plainB64);
    return new Blob([clearBin], { type: 'image/jpeg' });
  } catch (error) {
    console.warn('Error downloading/decrypting avatar:', error);
    throw error;
  }
}

function getStabilityFactor() {
  return parseFloat(parameters.current.stabilityFactorStr);
}

// returns transaction fee in wei
function getTransactionFeeWei() {
  return EthNum.toWei(EthNum.div(parameters.current.transactionFeeUsdStr, parameters.current.stabilityFactorStr)) || 1n * wei;
}


function handleBrowserBackButton(event) {
  history.pushState({state:1}, '', '.');

  const topModal = findTopModal();
  
  if (topModal) {
    const modalId = topModal.id;
    const modalInstance = window[modalId];
    
    const closed = closeTopModal(topModal)
    if (closed){
      return true;
    }
  }
  return false;
}

function findTopModal() {
  const activeModals = document.querySelectorAll('.modal.active');
  if (activeModals.length === 0) return null;
  const topModal = activeModals[activeModals.length - 1];
  return topModal;
}

function closeTopModal(topModal){
  const modalId = topModal.id;
  switch (modalId) {
    case 'chatModal':
      chatModal.close();
      break;
    case 'menuModal':
      menuModal.close();
      break;
    case 'daoModal':
      daoModal.close();
      break;
    case 'addProposalModal':
      addProposalModal.close();
      break;
    case 'proposalInfoModal':
      proposalInfoModal.close();
      break;
    case 'settingsModal':
      settingsModal.close();
      break;
    case 'sendAssetFormModal':
      sendAssetFormModal.close();
      break;
    case 'historyModal':
      historyModal.close();
      break;
    case 'scanQRModal':
      scanQRModal.close();
      break;
    case 'newChatModal':
      newChatModal.close();
      break;
    case 'createAccountModal':
      createAccountModal.close();
      break;
    case 'backupAccountModal':
      backupAccountModal.close();
      break;
    case 'restoreAccountModal':
      restoreAccountModal.close();
      break;
    case 'tollModal':
      tollModal.close();
      break;
    case 'inviteModal':
      inviteModal.close();
      break;
    case 'aboutModal':
      aboutModal.close();
      break;
    case 'helpModal':
      helpModal.close();
      break;
    case 'farmModal':
      farmModal.close();
      break;
    case 'logsModal':
      logsModal.close();
      break;
    case 'myProfileModal':
      myProfileModal.close();
      break;
    case 'validatorStakingModal':
      validatorStakingModal.close();
      break;
    case 'stakeValidatorModal':
      stakeValidatorModal.close();
      break;
    case 'contactInfoModal':
      contactInfoModal.close();
      break;
    case 'friendModal':
      friendModal.close();
      break;
    case 'editContactModal':
      editContactModal.close();
      break;
    case 'searchMessagesModal':
      searchMessagesModal.close();
      break;
    case 'searchContactsModal':
      searchContactsModal.close();
      break;
    case 'receiveModal':
      receiveModal.close();
      break;
    case 'sendAssetConfirmModal':
      sendAssetConfirmModal.close();
      break;
    case 'failedTransactionModal':
      failedTransactionModal.close();
      break;
    case 'bridgeModal':
      bridgeModal.close();
      break;
    case 'migrateAccountsModal':
      migrateAccountsModal.close();
      break;
    case 'lockModal':
      lockModal.close();
      break;
    case 'unlockModal':
      unlockModal.close();
      break;
    case 'launchModal':
      launchModal.close();
      break;
    case 'updateWarningModal':
      updateWarningModal.close();
      break;
    case 'removeAccountModal':
      removeAccountModal.close();
      break;
    default:
      console.warn('Unknown modal:', modalId);
      return false;
  }
  return true; // means we closed a modal
}
