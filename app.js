// Check if there is a newer version and load that using a new random url to avoid cache hits
//   Versions should be YYYY.MM.DD.HH.mm like 2025.01.25.10.05
const version = 't'; // Also increment this when you increment version.html
let myVersion = '0';
async function checkVersion() {
  myVersion = localStorage.getItem('version') || '0';
  let newVersion;
  try {
    const response = await fetch(`version.html?${getCorrectedTimestamp()}`);
    if (!response.ok) throw new Error('Version check failed');
    newVersion = await response.text();
  } catch (error) {
    console.error('Version check failed:', error);
    showToast('Version check failed. Your Internet connection may be down.', 0, 'error');
    // Only trigger offline UI if it's a network error
    if (!navigator.onLine || error instanceof TypeError) {
      isOnline = false;
      updateUIForConnectivity();
      markConnectivityDependentElements();
      console.log(`DEBUG: about to invoke showToast in checkVersion`);
    }
    newVersion = myVersion; // Allow continuing with the old version
  }
  //console.log('myVersion < newVersion then reload', myVersion, newVersion)
  console.log(parseInt(myVersion.replace(/\D/g, '')), parseInt(newVersion.replace(/\D/g, '')));
  if (parseInt(myVersion.replace(/\D/g, '')) != parseInt(newVersion.replace(/\D/g, ''))) {
    if (parseInt(myVersion.replace(/\D/g, '')) > 0) {
      alert('Updating to new version: ' + newVersion + ' ' + version);
    }
    localStorage.setItem('version', newVersion); // Save new version
    forceReload([
      './',
      'index.html',
      'styles.css',
      'app.js',
      'lib.js',
      'network.js',
      'offline.html',
    ]);
    const newUrl = window.location.href;
    //console.log('reloading', newUrl)
    window.location.replace(newUrl);
  }
}

// Usage examples:
/*
// These will all work:
forceReload([
    'images/logo.png',           // Relative to current path
    '/styles/main.css',          // Relative to domain root
    '../scripts/app.js',         // Parent directory
    './data/config.json',        // Same directory
    'https://api.example.com/data'  // Absolute URL
]);
*/
async function forceReload(urls) {
  try {
    // Convert relative URLs to absolute
    const absoluteUrls = urls.map((url) => {
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        return url;
      }
      // If it starts with /, it's relative to domain root
      if (url.startsWith('/')) {
        return `${window.location.origin}${url}`;
      }
      // Otherwise, it's relative to current path
      const base = `${window.location.origin}${window.location.pathname}`;
      return new URL(url, base).href;
    });
    // Remove from all browser caches
    if (window.caches) {
      const cacheKeys = await caches.keys();
      for (const cacheKey of cacheKeys) {
        const cache = await caches.open(cacheKey);
        for (const url of absoluteUrls) {
          await cache.delete(url);
        }
      }
    }
    // Fetch with cache-busting headers
    const fetchPromises = absoluteUrls.map((url) =>
      fetch(url, {
        cache: 'reload',
        headers: {
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

// Import crypto functions from crypto.js
import {
  encryptChacha,
  encryptData,
  decryptData,
  decryptMessage,
  ecSharedKey,
  pqSharedKey,
  ethHashMessage,
  hashBytes,
  deriveDhKey,
  generateRandomPrivateKey,
  getPublicKey,
  signMessage,
  generatePQKeys,
  generateRandomBytes,
  generateAddress,
  passwordToKey,
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
} from './lib.js';

const weiDigits = 18;
const wei = 10n ** BigInt(weiDigits);
const pollIntervalNormal = 30000; // in millisconds
const pollIntervalChatting = 5000; // in millseconds
//network.monitor.url = "http://test.liberdus.com:3000"    // URL of the monitor server
//network.explorer.url = "http://test.liberdus.com:6001"   // URL of the chain explorer
const MAX_MEMO_BYTES = 1000; // 1000 bytes for memos
const MAX_CHAT_MESSAGE_BYTES = 1000; // 1000 bytes for chat messages
const BRIDGE_USERNAME = 'liberdusbridge';

let myData = null;
let myAccount = null; // this is set to myData.account for convience
let timeSkew = 0;
let useLongPolling = true;

let checkPendingTransactionsIntervalId = null;
let getSystemNoticeIntervalId = null;
//let checkConnectivityIntervalId = null;

// Used in getNetworkParams function
const NETWORK_ACCOUNT_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const NETWORK_ACCOUNT_ID = '0000000000000000000000000000000000000000000000000000000000000000';
const MAX_TOLL = 1_000_000; // 1M limit

// TODO - get the parameters from the network
// mock network parameters
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
 * @returns 'mine' if the username is available and the address matches, 'taken' if the username is taken, 'available' if the username is available but the address does not match, 'error' if there is an error
 */
async function checkUsernameAvailability(username, address, foundAddressObject) {
  if (foundAddressObject) {
    foundAddressObject.address = null;
  }
  // First check if we're offline
  if (!isOnline) {
    console.log('Checking username availability offline');
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
      console.log('Username found locally and matches address');
      return 'mine';
    }

    // If we have the username but address doesn't match
    if (netidAccounts?.usernames && netidAccounts.usernames[username]) {
      console.log('Username found locally but address does not match');
      if (foundAddressObject) {
        foundAddressObject.address = netidAccounts.usernames[username].address;
      }
      return 'taken';
    }

    // Username not found locally
    console.log('Username not found locally');
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
    const response = await fetch(
//      `${selectedGateway.protocol}://${selectedGateway.host}:${selectedGateway.port}/address/${usernameHash}`
      `${selectedGateway.web}/address/${usernameHash}`
    );
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
    return 'available';
  } catch (error) {
    console.log('Error checking username:', error);
    return 'error2';
  }
}

function getAvailableUsernames() {
  const { netid } = network;
  const accounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
  const netidAccounts = accounts.netids[netid];
  if (!netidAccounts || !netidAccounts.usernames) return [];
  return Object.keys(netidAccounts.usernames);
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
            // TODO remove addresses and only the address in myData.account.keys.address
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
      toll: parameters?.current?.defaultToll || 1n * wei,
      tollUnit: parameters?.current?.defaultTollUnit || 'LIB',
      noticets: 0,
    },
  };

  return myData;
}

/**
 * Handle native app subscription tokens and handle subscription
 * This is used to subscribe to push notifications for the native app
 * @returns {Promise<void>}
 */
async function handleNativeAppSubscription() {
  const urlParams = new URLSearchParams(window.location.search);
  const deviceToken = urlParams.get('device_token');
  const pushToken = urlParams.get('push_token');
  
  if (deviceToken && pushToken) {
    console.log('Native app subscription tokens detected:', { deviceToken, pushToken });
    
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
      
      const payload = {
        deviceToken,
        expoPushToken: pushToken,
        addresses: addresses
      };
      
      // Get the appropriate gateway for this request
      const selectedGateway = getGatewayForRequest();
      if (!selectedGateway) {
        console.error('No gateway available for subscription request');
        showToast('No gateway available', 3000, 'error');
        return;
      }
      
      const SUBSCRIPTION_API = `${selectedGateway.web}/notifier/subscribe`;

      console.log('payload', payload);
      console.log('SUBSCRIPTION_API', SUBSCRIPTION_API);
      
      const response = await fetch(SUBSCRIPTION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Subscription successful:', result);
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

// Load saved account data and update chat list on page load
document.addEventListener('DOMContentLoaded', async () => {
  await checkVersion(); // version needs to be checked before anything else happens
  timeDifference(); // Calculate and log time difference early

  setupConnectivityDetection();

  // Check for native app subscription tokens and handle subscription
  handleNativeAppSubscription();

  // Unlock Modal
  unlockModal.load();

  // Sign In Modal
  signInModal.load();

  // Welcome Screen
  welcomeScreen.load()

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
  aboutModal.load();
  helpModal.load();

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

  // Export Form Modal
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
  failedMessageModal.load();

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

  // Failed Transaction Modal
  failedTransactionModal.load();
  
  // Friend Modal
  friendModal.load();

  // Bridge Modal
  bridgeModal.load();

  // Migrate Accounts Modal
  migrateAccountsModal.load();

  // Lock Modal
  lockModal.load();

  // add event listener for back-button presses to prevent shift+tab
  document.querySelectorAll('.back-button').forEach((button) => {
    button.addEventListener('keydown', ignoreShiftTabKey);
  });
  // add event listener for last-item to prevent tab
  document.querySelectorAll('.last-item').forEach((item) => {
    item.addEventListener('keydown', ignoreTabKey);
  });

  getNetworkParams();

  welcomeScreen.lastItem.focus();

  // Deprecated - do not want to encourage or confuse users with this feature since on IOS uses seperate local storage
  //setupAddToHomeScreen();
});

/* this is no longer used; using handleBeforeUnload instead
function handleUnload() {
  console.log('in handleUnload');
  if (menuModal.isSignoutExit) {
    return;
  } // User selected to Signout; state was already saved
}
*/

// Add unload handler to save myData
function handleBeforeUnload(e) {
  if (menuModal.isSignoutExit){
    return;
  }
  if (myData){
    e.preventDefault();
    saveState();    // This save might not work if the amount of data to save is large and user quickly clicks on Leave button
  }
}

// This is for installed apps where we can't stop the back button; just save the state
async function handleVisibilityChange() {
  console.log('in handleVisibilityChange', document.visibilityState);
  if (!myAccount) {
    return;
  }

  if (document.visibilityState === 'hidden') {
    // if chatModal was opened, save the last message count
    if (chatModal.isActive() && chatModal.address) {
      const contact = myData.contacts[chatModal.address];
      chatModal.lastMessageCount = contact?.messages?.length || 0;
    }
  } else if (document.visibilityState === 'visible') {
    // if chatModal was opened, check if message count changed while hidden
    if (chatModal.isActive() && chatModal.address) {
      const contact = myData.contacts[chatModal.address];
      const currentCount = contact?.messages?.length || 0;
      if (currentCount !== chatModal.lastMessageCount) {
        chatModal.appendChatModal(true);
      }
    }
  }
}

async function encryptAllAccounts(oldPassword, newPassword) {
  const oldEncKey = !oldPassword ? null : await passwordToKey(oldPassword+'liberdusData');
  const newEncKey = !newPassword ? null : await passwordToKey(newPassword+'liberdusData');
  // Get all accounts from localStorage
  const accountsObj = parse(localStorage.getItem('accounts') || 'null');
  if (!accountsObj.netids) return;

  console.log('looping through all netids')
  for (const netid in accountsObj.netids) {
    const usernamesObj = accountsObj.netids[netid]?.usernames;
    if (!usernamesObj) continue;
    console.log('looping through all accounts for '+netid)
    for (const username in usernamesObj) {
      const key = `${username}_${netid}`;
      let data = localStorage.getItem(key);
      if (!data) continue;
      console.log('about to reencrypt '+key)

      // If oldEncKey is set, decrypt; otherwise, treat as plaintext
      if (oldEncKey) {
        try {
          data = decryptData(data, oldEncKey, true);
        } catch (e) {
          console.error(`Failed to decrypt data for ${key}:`, e);
          continue;
        }
      }

      /*
      // If data is still not an object, parse it
      let parsedData;
      try {
        parsedData = typeof data === 'string' ? parse(data) : data;
      } catch (e) {
        console.error(`Failed to parse data for ${key}:`, e);
        continue;
      }

      // Stringify for storage
      let newData = stringify(parsedData);
      */
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
  console.log('in saveState');
  if (myData && myAccount && myAccount.username && myAccount.netid) {
    console.log('saving state');
    let data = stringify(myData)
    if (localStorage.lock && lockModal.encKey){  // Consider what happens if localStorage.lock was manually deleted
      data = encryptData(data, lockModal.encKey, true)
    }
    localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, data);
  }
}

function loadState(account){
  let data = localStorage.getItem(account);
  if (!data) { return null; }
  if (localStorage.lock && lockModal.encKey) {
    data = decryptData(data, lockModal.encKey, true)
  }
  return parse(data);
}


class WelcomeScreen {
  constructor() {}

  load() {
    this.screen = document.getElementById('welcomeScreen');
    this.signInButton = document.getElementById('signInButton');
    this.createAccountButton = document.getElementById('createAccountButton');
    this.importAccountButton = document.getElementById('importAccountButton');
    this.welcomeButtons = document.querySelector('.welcome-buttons');
    this.logoLink = this.screen.querySelector('.logo-link');
    this.logoLink.addEventListener('keydown', ignoreShiftTabKey);  // add event listener for first-item to prevent shift+tab
    this.versionDisplay = document.getElementById('versionDisplay');
    this.networkNameDisplay = document.getElementById('networkNameDisplay');
    this.lastItem = document.getElementById('welcomeScreenLastItem');
    this.openBackupModalButton = document.getElementById('openBackupModalButton');
    
    
    this.versionDisplay.textContent = myVersion + ' ' + version;
    this.networkNameDisplay.textContent = network.name;
    
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
    this.importAccountButton.addEventListener('click', () => restoreAccountModal.open());

    this.orderButtons();
  }

  open() {
    this.screen.style.display = 'flex';
  }

  close() {
    this.screen.style.display = 'none';
  }

  isActive() {
    return this.screen.style.display === 'flex';
  }

  orderButtons() {
    // Check for existing accounts and arrange welcome buttons
    const usernames = getAvailableUsernames();
    const hasAccounts = usernames.length > 0;
    // Reorder buttons based on accounts existence
    if (hasAccounts) {
      this.welcomeButtons.innerHTML = ''; // Clear existing order
      this.signInButton.classList.remove('hidden');
      this.createAccountButton.classList.remove('hidden');
      this.importAccountButton.classList.remove('hidden');
      this.welcomeButtons.appendChild(this.signInButton);
      this.welcomeButtons.appendChild(this.createAccountButton);
      this.welcomeButtons.appendChild(this.importAccountButton);
      this.signInButton.classList.add('primary-button');
      this.signInButton.classList.remove('secondary-button');
      this.openBackupModalButton.classList.remove('hidden');
      this.welcomeButtons.appendChild(this.openBackupModalButton);
    } else {
      this.welcomeButtons.innerHTML = ''; // Clear existing order
      this.createAccountButton.classList.remove('hidden');
      this.importAccountButton.classList.remove('hidden');
      this.welcomeButtons.appendChild(this.createAccountButton);
      this.welcomeButtons.appendChild(this.importAccountButton);
      this.createAccountButton.classList.add('primary-button');
      this.createAccountButton.classList.remove('secondary-button');
      this.openBackupModalButton.classList.remove('hidden');
      this.welcomeButtons.appendChild(this.openBackupModalButton);
    }
  }
}

const welcomeScreen = new WelcomeScreen

class Header {
  constructor() {}

  load() {
    this.header = document.getElementById('header');
    this.text = this.header.querySelector('.app-name');
    this.logoLink = this.header.querySelector('.logo-link');
    this.menuButton = document.getElementById('toggleMenu');

    this.logoLink.addEventListener('keydown', ignoreShiftTabKey); // add event listener for first-item to prevent shift+tab
    this.menuButton.addEventListener('click', () => menuModal.open());
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

  async switchView(view) {
    // Store the current view for potential rollback
    const previousView = document.querySelector('.app-screen.active')?.id?.replace('Screen', '') || 'chats';
    const previousButton = document.querySelector('.nav-button.active');
  
    try {
      // Hide all screens
      chatsScreen.close();
      contactsScreen.close();
      walletScreen.close();
  
      // Show selected screen
      document.getElementById(`${view}Screen`).classList.add('active');
  
      // Update nav buttons - remove active class from all
      this.chatButton.classList.remove('active');
      this.contactsButton.classList.remove('active');
      this.walletButton.classList.remove('active');
  
      // Add active class to selected button
      if (view === 'chats') {
        this.chatButton.classList.add('active');
      } else if (view === 'contacts') {
        this.contactsButton.classList.add('active');
      } else if (view === 'wallet') {
        this.walletButton.classList.add('active');
      }
  
      // Show header and footer
      header.open();
      footer.open();
  
      // Update header with username if signed in
      const appName = document.querySelector('.app-name');
      if (myAccount && myAccount.username) {
        appName.textContent = `${myAccount.username}`;
      } else {
        appName.textContent = '';
      }
  
      // Show/hide new chat button
      if (view === 'chats' || view === 'contacts') {
        this.newChatButton.classList.add('visible');
      } else {
        this.newChatButton.classList.remove('visible');
      }
  
      // Update lists when switching views
      if (view === 'chats') {
        this.chatButton.classList.remove('has-notification');
        // TODO: maybe need to invoke updateChatData here?
        await chatsScreen.updateChatList();
  
        // focus onto last-item in the footer
        if (footer.lastItem) {
          footer.lastItem.focus();
        }
      } else if (view === 'contacts') {
        await contactsScreen.updateContactsList();
      } else if (view === 'wallet') {
        this.walletButton.classList.remove('has-notification');
        await walletScreen.updateWalletView();
      }
    } catch (error) {
      console.error(`Error switching to ${view} view:`, error);
  
      // Restore previous view if there was an error
      if (previousView && previousButton) {
        console.log(`Restoring previous view: ${previousView}`);
  
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
        showToast(`Failed to switch to ${view} view`, 3000, 'error');
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
    //const chatsData = myData
    const contacts = myData.contacts;
    const chats = myData.chats;
    if (chats.length === 0) {
      chatList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">Click the + button to start a chat</div>
                <div>Your conversations will appear here</div>
            </div>`;
      return;
    }

    console.log('chats.length', JSON.stringify(chats.length));

    // Clear existing chat items before adding new ones
    chatList.innerHTML = '';

    const chatElements = await Promise.all(
      chats.map(async (chat) => {
        const identicon = await generateIdenticon(chat.address);
        const contact = contacts[chat.address];

        // If contact doesn't exist, skip this chat item
        if (!contact) return null;

        const latestActivity = contact.messages && contact.messages.length > 0 ? contact.messages[0] : null;

        // If there's no latest activity (no messages), skip this chat item
        if (!latestActivity) return null;

        let previewHTML = ''; // Default
        const latestItemTimestamp = latestActivity.timestamp;

        // Check if the latest activity is a payment/transfer message
        if (typeof latestActivity.amount === 'bigint') {
          // Latest item is a payment/transfer
          const amountStr = parseFloat(big2str(latestActivity.amount, 18)).toFixed(6);
          const amountDisplay = `${amountStr} ${latestActivity.symbol || 'LIB'}`;
          const directionText = latestActivity.my ? '-' : '+';
          // Create payment preview text
          previewHTML = `<span class="payment-preview">${directionText} ${amountDisplay}</span>`;
          // Optionally add memo preview
          if (latestActivity.message) {
            // Memo is stored in the 'message' field for transfers
            previewHTML += ` <span class="memo-preview"> | ${truncateMessage(escapeHtml(latestActivity.message), 25)}</span>`;
          }
        } else {
          // Latest item is a regular message
          const messageText = escapeHtml(latestActivity.message);
          // Add "You:" prefix for sent messages
          const prefix = latestActivity.my ? 'You: ' : '';
          previewHTML = `${prefix}${truncateMessage(messageText, 50)}`; // Truncate for preview
        }

        // Use the determined latest timestamp for display
        const timeDisplay = formatTime(latestItemTimestamp);
        const contactName = getContactDisplayName(contact);

        // Create the list item element
        const li = document.createElement('li');
        li.classList.add('chat-item');

        // Set its inner HTML
        li.innerHTML = `
            <div class="chat-avatar">${identicon}</div>
            <div class="chat-content">
                <div class="chat-header">
                    <div class="chat-name">${escapeHtml(contactName)}</div>
                    <div class="chat-time">${timeDisplay} <span class="chat-time-chevron"></span></div>
                </div>
                <div class="chat-message">
                    ${contact.unread ? `<span class="chat-unread">${contact.unread}</span>` : ''}
                    ${previewHTML}
                </div>
            </div>
        `;

        // Add the onclick handler directly to the element
        li.onclick = () => chatModal.open(chat.address);

        return li; // Return the created DOM element
      })
    );

    // Append the created (and non-null) list item elements to the chatList
    chatElements.forEach((element) => {
      if (element) {
        // Only append if the element is not null
        chatList.appendChild(element);
      }
    });
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
      this.contactsList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Contacts Yet</div>
                <div>Your contacts will appear here</div>
            </div>`;
      return;
    }

    // Convert contacts object to array and sort
    const contactsArray = Object.values(contacts);

    // Split into status groups in a single pass
    const statusGroups = contactsArray.reduce(
      (acc, contact) => {
        // 0 = blocked, 1 = Other, 2 = Acquaintance, 3 = Friend
        switch (contact.friend) {
          case 0:
            acc.blocked.push(contact);
            break;
          case 2:
            acc.acquaintances.push(contact);
            break;
          case 3:
            acc.friends.push(contact);
            break;
          default:
            acc.others.push(contact);
        }
        return acc;
      },
      { others: [], acquaintances: [], friends: [], blocked: [] }
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
      { key: 'friends', label: 'Friends', itemClass: 'chat-item' },
      { key: 'acquaintances', label: 'Connections', itemClass: 'chat-item' },
      { key: 'others', label: 'Tolled', itemClass: 'chat-item' },
      { key: 'blocked', label: 'Blocked', itemClass: 'chat-item blocked' },
    ];

    // Helper to render a contact item
    const renderContactItem = async (contact, itemClass) => {
      const identicon = await generateIdenticon(contact.address);
      const contactName = getContactDisplayName(contact);
      return `
            <li class="${itemClass}">
                <div class="chat-avatar">${identicon}</div>
                <div class="chat-content">
                    <div class="chat-header">
                        <div class="chat-name">${contactName}</div>
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


class MenuModal {
  constructor() {
    this.isSignoutExit = false;
  }

  load() {
    this.modal = document.getElementById('menuModal');
    this.closeButton = document.getElementById('closeMenu');
    this.closeButton.addEventListener('click', () => this.close());
    this.profileButton = document.getElementById('openAccountForm');
    this.profileButton.addEventListener('click', () => myProfileModal.open());
    this.tollButton = document.getElementById('openToll');
    this.tollButton.addEventListener('click', () => tollModal.open());
    this.backupButton = document.getElementById('openExportForm');
    this.backupButton.addEventListener('click', () => backupAccountModal.open());
    this.validatorButton = document.getElementById('openValidator');
    this.validatorButton.addEventListener('click', () => validatorStakingModal.open());
    this.inviteButton = document.getElementById('openInvite');
    this.inviteButton.addEventListener('click', () => inviteModal.open());
    this.explorerButton = document.getElementById('openExplorer');
    this.explorerButton.addEventListener('click', () => {window.open('./explorer', '_blank');});
    this.networkButton = document.getElementById('openMonitor');
    this.networkButton.addEventListener('click', () => {window.open('./network', '_blank');});
    this.removeButton = document.getElementById('openRemoveAccount');
    this.removeButton.addEventListener('click', () => removeAccountModal.open());
    this.helpButton = document.getElementById('openHelp');
    this.helpButton.addEventListener('click', () => helpModal.open());
    this.aboutButton = document.getElementById('openAbout');
    this.aboutButton.addEventListener('click', () => aboutModal.open());
    this.signOutButton = document.getElementById('handleSignOut');
    this.signOutButton.addEventListener('click', async () => await this.handleSignOut());
    this.backupButton = document.getElementById('openBackupModalButton');
    this.backupButton.addEventListener('click', () => backupAccountModal.open());
    this.bridgeButton = document.getElementById('openBridge');
    this.bridgeButton.addEventListener('click', () => bridgeModal.open());
  }

  open() {
    this.modal.classList.add('active');
    enterFullscreen();
  }

  close() {
    this.modal.classList.remove('active');
    enterFullscreen();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
  
  async handleSignOut() {
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
    // Stop camera if it's running
    if (typeof scanQRModal !== 'undefined' && scanQRModal.camera.scanInterval) {
      scanQRModal.stopCamera();
    }

    // Remove event listeners for beforeunload and visibilitychange
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Lock the app
    unlockModal.lock();

    // Close all modals
    menuModal.close();
    myProfileModal.close();

    // Hide header and footer
    header.close();
    footer.close();
    footer.newChatButton.classList.remove('visible');

    // Reset header text
    header.setText('Liberdus');

    // Hide all app screens
    document.querySelectorAll('.app-screen').forEach((screen) => {
      screen.classList.remove('active');
    });

    // Show welcome screen
    welcomeScreen.open();


    // Save myData to localStorage if it exists
    saveState();


    // Add offline fallback
    if (!navigator.onLine) {
      // Just reset the UI state without clearing storage
      return;
    }

    // Only reload if online
    window.location.reload();
  }
}

const menuModal = new MenuModal();

class WalletScreen {
  constructor() {

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

    this.openSendAssetFormModalButton.addEventListener('click', () => {
      sendAssetFormModal.open();
    });
    this.openReceiveModalButton.addEventListener('click', () => {
      receiveModal.open();
    });
    this.openHistoryModalButton.addEventListener('click', () => {
      historyModal.open();
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

      // await updateWalletBalances();
      this.updateWalletView();
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

  // Update wallet view; refresh wallet
  async updateWalletView() {
    const walletData = myData.wallet;

    await this.updateWalletBalances();

    // Update total networth
    this.totalBalance.textContent = (walletData.networth || 0).toFixed(2);

    if (!Array.isArray(walletData.assets) || walletData.assets.length === 0) {
      this.assetsList.innerHTML = `
              <div class="empty-state">
                  <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                  <div style="font-weight: bold; margin-bottom: 0.5rem">No Assets Yet</div>
                  <div>Your assets will appear here</div>
              </div>`;
      return;
    }

    this.assetsList.innerHTML = walletData.assets
      .map((asset) => {
        console.log('asset balance', asset, asset.balance);
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

    // TODO - first update the asset prices from a public API

    let totalWalletNetworth = 0.0;

    // Update balances for each asset and address
    for (const asset of myData.wallet.assets) {
      let assetTotalBalance = 0n;

      // Get balance for each address in the asset
      for (const addr of asset.addresses) {
        try {
          const address = longAddress(addr.address);
          const data = await queryNetwork(`/account/${address}/balance`);
          console.log('balance', data);
          // Update address balance
          addr.balance = data.balance || 0n;

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

    // Update total wallet balance
    myData.wallet.networth = totalWalletNetworth;
    myData.wallet.timestamp = now;
  }
}

const walletScreen = new WalletScreen();

/**
 * createNewContact
 * @param {string} addr - the address of the contact
 * @param {string} username - the username of the contact
 * @param {number = 1} friendStatus - the friend status of the contact, default is 1
 * @returns {void}
 */
function createNewContact(addr, username, friendStatus = 1) {
  const address = normalizeAddress(addr);
  if (myData.contacts[address]) {
    return;
  } // already exists
  const c = (myData.contacts[address] = {});
  c.address = address;
  if (username) {
    c.username = normalizeUsername(username);
  }
  c.messages = [];
  c.timestamp = 0;
  c.unread = 0;
  c.toll = 0n;
  c.tollRequiredToReceive = 1;
  c.tollRequiredToSend = 1;
  c.friend = friendStatus;
}

/**
 * updateTollAmountUI updates the toll amount UI for a given contact
 * sets chatModal.toll and chatModal.tollUnit to the bigint toll and string tollUnit of the contact
 * @param {string} address - the address of the contact
 * @returns {void}
 */
function updateTollAmountUI(address) {
  const tollValue = document.getElementById('tollValue');
  tollValue.style.color = 'black';
  const contact = myData.contacts[address];
  let toll = contact.toll || 0n;
  const tollUnit = contact.tollUnit || 'LIB';
  const decimals = 18;
  const mainIsUSD = tollUnit === 'USD';
  const mainValue = parseFloat(big2str(toll, decimals));
  // Conversion factor (USD/LIB)
  const scaleMul = parameters.current.stabilityScaleMul || 1;
  const scaleDiv = parameters.current.stabilityScaleDiv || 1;
  const factor = scaleDiv !== 0 ? scaleMul / scaleDiv : 1;
  let mainString, otherString;
  if (mainIsUSD) {
    toll = bigxnum2big(toll, (1.0 / factor).toString());
    mainString = mainValue.toFixed(6) + ' USD';
    const libValue = mainValue / factor;
    otherString = libValue.toFixed(6) + ' LIB';
  } else {
    mainString = mainValue.toFixed(6) + ' LIB';
    const usdValue = mainValue * factor;
    otherString = usdValue.toFixed(6) + ' USD';
  }
  let display;
  if (contact.tollRequiredToSend == 1) {
    display = `${mainString} = ${otherString}`;
  } else if (contact.tollRequiredToSend == 2) {
    tollValue.style.color = 'red';
    display = `blocked`;
  } else {
    // light green used to show success
    tollValue.style.color = '#28a745';
    display = `free; ${mainString} = ${otherString}`;
  }
  tollValue.textContent = display;

  chatModal.toll = toll;
  chatModal.tollUnit = tollUnit;
}

/**
 * updateTollRequired queries contact object and updates the tollRequiredByMe and tollRequiredByOther fields
 * @param {string} address - the address of the contact
 * @returns {void}
 */
async function updateTollRequired(address) {
  const myAddr = longAddress(myAccount.keys.address);
  const contactAddr = longAddress(address);
  // use `hashBytes([fromAddr, toAddr].sort().join``)` to get the hash of the sorted addresses and have variable to keep track fromAddr which will be the current users order in the array
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

    if (chatModal.isActive() && chatModal.address === address) {
      updateTollAmountUI(address);
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
async function updateTollValue(address) {
  // query the contact's toll field from the network
  const contactAccountData = await queryNetwork(`/account/${longAddress(address)}`);
  const queriedToll = contactAccountData?.account?.data?.toll; // type bigint
  const queriedTollUnit = contactAccountData?.account?.data?.tollUnit; // type string */

  // update the toll value in the UI if the queried toll value is different from the toll value or toll unit in localStorage
  if (myData.contacts[address].toll != queriedToll || myData.contacts[address].tollUnit != queriedTollUnit) {
    myData.contacts[address].toll = queriedToll;
    myData.contacts[address].tollUnit = queriedTollUnit;
    // if correct modal is open for this address, update the toll value
    if (chatModal.isActive() && chatModal.address === address) {
      updateTollAmountUI(address);
    }
  } else {
    console.log(`Returning early since queried toll value is the same as the toll field in localStorage`);
    // return early
    return;
  }
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

      // Hide previous results
      // resultContainer.classList.add('hidden');

      // statusMessage.textContent = 'Accessing camera...';
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
            throw new Error(
              'Camera access was denied. Please check your browser settings and grant permission to use the camera.'
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
        // toggleButton.textContent = 'Stop Camera';

        // Start scanning for QR codes
        // Use interval instead of requestAnimationFrame for better control over scan frequency
        this.camera.scanInterval = setInterval(() => this.readQRCode(), 100); // scan every 100ms (10 times per second)

        // statusMessage.textContent = 'Camera active. Point at a QR code.';
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
      showToast(error.message || 'Failed to access camera. Please check your permissions and try again.', 5000, 'error');

      // Re-throw the error if you need to handle it further up
      throw error;
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
          console.log('QR Code detected:', decodedText);
          this.handleSuccessfulScan(decodedText);
        }
      } catch (error) {
        // qr.decodeQR throws error if not found or on error
        //console.log('QR scanning error or not found:', error); // Optional: Log if needed
      }
    }
  }

  handleSuccessfulScan(data) {
    // const scanHighlight = document.getElementById('scan-highlight');
    // Stop scanning
    if (this.camera.scanInterval) {
      clearInterval(this.camera.scanInterval);
      this.camera.scanInterval = null;
    }

    this.camera.scanning = false;

    // Stop the camera
    this.stopCamera();

    /*
      // Show highlight effect
      scanHighlight.classList.add('active');
      setTimeout(() => {
          scanHighlight.classList.remove('active');
      }, 500);
  */

    // Display the result
    //    qrResult.textContent = data;
    //    resultContainer.classList.remove('hidden');
    console.log('Raw QR Data Scanned:', data);
    if (this.fillFunction) {
      // Call the assigned fill function (e.g., fillPaymentFromQR or fillStakeAddressFromQR)
      this.fillFunction(data);
    }

    this.close();

    // Update status
    //    statusMessage.textContent = 'QR code detected! Camera stopped.';
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
    if (balanceWarning) balanceWarning.style.display = 'block';
    balanceWarning.textContent = 'Amount cannot be negative';
    return false;
  }

  await getNetworkParams();
  const asset = myData.wallet.assets[assetIndex];
  const feeInWei = parameters.current.transactionFee || 1n * wei;
  const totalRequired = amount + feeInWei;
  const hasInsufficientBalance = BigInt(asset.balance) < totalRequired;

  if (balanceWarning) {
    if (hasInsufficientBalance) {
      balanceWarning.textContent = `Insufficient balance (including ${big2str(feeInWei, 18).slice(0, -16)} LIB fee)`;
      balanceWarning.style.display = 'block';
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

  async open(preselectedUsername_) {
    // Get existing accounts
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];
    const usernames = netidAccounts?.usernames ? Object.keys(netidAccounts.usernames) : [];
    this.preselectedUsername = preselectedUsername_;

    // First show the modal so we can properly close it if needed
    this.modal.classList.add('active');

    // If no accounts exist, close modal and open Create Account modal
    if (usernames.length === 0) {
      this.close();
      createAccountModal.open();
      return;
    }

    // Populate select with usernames
    this.usernameSelect.innerHTML = `
      <option value="" disabled selected hidden>Select an account</option>
      ${usernames.map((username) => `<option value="${username}">${username}</option>`).join('')}
    `;

    // If a username should be auto-selected (either preselect or only one account), do it
    const autoSelect = preselectedUsername_ && usernames.includes(preselectedUsername_) ? preselectedUsername_ : null;
    if (autoSelect) {
      this.usernameSelect.value = autoSelect;
      await this.handleUsernameChange();
      if (this.notFoundMessage.textContent === 'not found') {
        // remove not found and make button available
        this.notFoundMessage.textContent = '';
        this.notFoundMessage.style.display = 'none';
        this.submitButton.style.display = 'inline';
        this.submitButton.disabled = false;
        this.submitButton.textContent = 'Sign In';
        this.removeButton.style.display = 'none';
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
    this.submitButton.disabled = true; // Keep button disabled until an account is selected
    this.submitButton.textContent = 'Sign In';
    this.submitButton.style.display = 'inline';
    this.removeButton.style.display = 'none';
    this.notFoundMessage.style.display = 'none';

    // set timeout to focus on the last item so shift+tab and tab prevention works
    setTimeout(() => {
      this.signInModalLastItem.focus();
    }, 100);
  }

  close() {
    // clear signInModal input fields
    this.usernameSelect.value = '';
    this.submitButton.disabled = true;
    this.submitButton.textContent = 'Sign In';
    this.submitButton.style.display = 'inline';
    this.removeButton.style.display = 'none';
    this.notFoundMessage.style.display = 'none';
    
    this.modal.classList.remove('active');
    this.preselectedUsername = null;
  }

  async handleSignIn(event) {
    if (event) {
      event.preventDefault();
    }

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
      console.log('Account data not found');
      return;
    }
    myAccount = myData.account;

    /* requestNotificationPermission(); */
    if (useLongPolling) {
      setTimeout(longPoll(), 10);
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
    document.addEventListener('visibilitychange', async () => await handleVisibilityChange()); // Keep as document
    
    // Close modal and proceed to app
    this.close();
    welcomeScreen.close();
    await footer.switchView('chats'); // Default view
  }

  async handleUsernameChange() {
    console.log('in handleUsernameChange');
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
    //        const address = netidAccounts.usernames[username].keys.address;
    const address = netidAccounts.usernames[username].address;
    const availability = await checkUsernameAvailability(username, address);
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
      this.submitButton.disabled = false;
      this.submitButton.textContent = 'Sign In';
      this.submitButton.style.display = 'inline';
      this.removeButton.style.display = 'none';
      this.notFoundMessage.style.display = 'none';
    } else if (availability === 'taken') {
      this.submitButton.style.display = 'none';
      this.removeButton.style.display = 'inline';
      this.notFoundMessage.textContent = 'taken';
      this.notFoundMessage.style.display = 'inline';
    } else if (availability === 'available') {
      this.submitButton.disabled = false;
      this.submitButton.textContent = 'Recreate';
      this.submitButton.style.display = 'inline';
      this.removeButton.style.display = 'inline';
      this.notFoundMessage.textContent = 'not found';
      this.notFoundMessage.style.display = 'inline';
    } else {
      this.submitButton.disabled = true;
      this.submitButton.textContent = 'Sign In';
      this.submitButton.style.display = 'none';
      this.removeButton.style.display = 'none';
      this.notFoundMessage.textContent = 'network error';
      this.notFoundMessage.style.display = 'inline';
    }
  }

  async handleRemoveAccount() {
    removeAccountModal.confirmSubmit();
  }
}

// create a singleton instance of the SignInModal
const signInModal = new SignInModal();

// Contact Info Modal Management
class ContactInfoModal {
  constructor() {
    this.currentContactAddress = null;
    this.needsContactListUpdate = false; // track if we need to update the contact list
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
    this.subtitleDiv = this.avatarSection.querySelector('.subtitle');
    this.usernameDiv = document.getElementById('contactInfoUsername');

    // Back button
    this.backButton.addEventListener('click', () => this.close());

    this.nameEditButton.addEventListener('click', () => editContactModal.open());

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
  }

  // Update contact info values
  async updateContactInfo(displayInfo) {
    // Generate identicon for the contact
    const identicon = await generateIdenticon(displayInfo.address, 96);

    // Update the avatar section
    this.avatarDiv.innerHTML = identicon;
    this.nameDiv.textContent = displayInfo.name !== 'Not Entered' ? displayInfo.name : displayInfo.username;
    this.subtitleDiv.textContent = displayInfo.address;

    const fields = {
      Username: 'contactInfoUsername',
      Name: 'contactInfoName',
      ProvidedName: 'contactInfoProvidedName',
      Email: 'contactInfoEmail',
      Phone: 'contactInfoPhone',
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

      // Show the container and set the value
      container.style.display = 'block';
      
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
      }
    });
  }

  // Set up chat button functionality
  setupChatButton(displayInfo) {
    if (displayInfo.address) {
      this.chatButton.style.display = 'block';
    } else {
      this.chatButton.style.display = 'none';
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
 * Frontend: 0 = blocked, 1 = Other, 2 = Acquaintance, 3 = Friend
 * Backend: 1 = toll required, 0 = toll not required, 2 = blocked
 * 
 * @description Modal for setting the friend status for a contact
 * @class FriendModal
 */
class FriendModal {
  constructor() {
    this.currentContactAddress = null;
    this.needsContactListUpdate = false; // track if we need to update the contact list
  }

  load() {
    this.modal = document.getElementById('friendModal');
    this.friendForm = document.getElementById('friendForm');

    // Friend modal form submission
    this.friendForm.addEventListener('submit', (event) => this.handleFriendSubmit(event));

    // Friend modal close button
    this.modal.querySelector('.back-button').addEventListener('click', () => this.closeFriendModal());
  }

  // Open the friend modal
  open() {
    const contact = myData.contacts[this.currentContactAddress];
    if (!contact) return;

    // Set the current friend status
    const status = contact?.friend.toString();
    const radio = this.friendForm.querySelector(`input[value="${status}"]`);
    if (radio) radio.checked = true;

    this.modal.classList.add('active');
  }

  // Close the friend modal
  closeFriendModal() {
    this.modal.classList.remove('active');
  }

  async postUpdateTollRequired(address, friend) {
    // 0 = blocked, 1 = Other, 2 = Acquaintance, 3 = Friend
    // required = 1 if toll required, 0 if not and 2 to block other party
    const requiredNum = friend === 3 || friend === 2 ? 0 : friend === 1 ? 1 : friend === 0 ? 2 : 1;
    const fromAddr = longAddress(myAccount.keys.address);
    const toAddr = longAddress(address);
    const chatId_ = hashBytes([fromAddr, toAddr].sort().join``);
    console.log('DEBUG 1:chatId_', chatId_);

    const tx = {
      from: fromAddr,
      to: toAddr,
      chatId: chatId_,
      required: requiredNum,
      type: 'update_toll_required',
      timestamp: getCorrectedTimestamp(),
      friend: friend,
      networkId: network.netid,
    };
    const txid = await signObj(tx, myAccount.keys);
    const res = await injectTx(tx, txid);
    return res;
  }

  /**
   * Handle friend form submission
   * 0 = blocked, 1 = Other, 2 = Acquaintance, 3 = Friend
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async handleFriendSubmit(event) {
    event.preventDefault();

    if (!this.currentContactAddress) return;

    const contact = myData.contacts[this.currentContactAddress];
    if (!contact) return;

    const selectedStatus = this.friendForm.querySelector('input[name="friendStatus"]:checked')?.value;
    if (!selectedStatus) return;

    // send transaction to update chat toll
    const res = await this.postUpdateTollRequired(this.currentContactAddress, Number(selectedStatus));
    if (res?.result?.success === false) {
      console.log(
        `[handleFriendSubmit] update_toll_required transaction failed: ${res?.result?.reason}. Did not update contact status.`
      );
      return;
    }

    // Update friend status based on selected value
    contact.friend = Number(selectedStatus);

    // Show appropriate toast message depending value 0,1,2,3
    showToast(
      contact.friend === 0
        ? 'Blocked'
        : contact.friend === 1
          ? 'Added as Tolled'
          : contact.friend === 2
            ? 'Added as Connection'
            : contact.friend === 3
              ? 'Added as Friend'
              : 'Error updating friend status'
    );

    // Mark that we need to update the contact list
    this.needsContactListUpdate = true;

    // TODO - do we really need to saveState here
    // Save state
//    saveState();

    // Update the friend button
    this.updateFriendButton(contact, 'addFriendButtonContactInfo');
    this.updateFriendButton(contact, 'addFriendButtonChat');

    // Update the contact list
    await contactsScreen.updateContactsList();

    // Close the friend modal
    this.closeFriendModal();
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
    button.classList.remove('status-0', 'status-1', 'status-2', 'status-3');
    // Add the current status class
    button.classList.add(`status-${contact.friend}`);
  }

  // get the current contact address
  getCurrentContactAddress() {
    return this.currentContactAddress || false;
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
    this.nameActionButton = this.nameInput.parentElement.querySelector('.field-action-button');
    this.providedNameContainer = document.getElementById('editContactProvidedNameContainer');
    this.backButton = document.getElementById('closeEditContactModal');

    // Setup event listeners
    this.nameInput.addEventListener('input', (e) => this.handleNameInput(e));
    this.nameInput.addEventListener('blur', () => this.handleNameBlur());
    this.nameInput.addEventListener('keydown', (e) => this.handleNameKeydown(e));
    this.nameActionButton.addEventListener('click', () => this.handleNameButton());
    this.providedNameContainer.addEventListener('click', () => this.handleProvidedNameClick());
    this.backButton.addEventListener('click', () => this.close());
  }

  open() {
    // Get the avatar section elements
    const avatarSection = document.querySelector('#editContactModal .contact-avatar-section');
    const avatarDiv = avatarSection.querySelector('.avatar');
    const nameDiv = avatarSection.querySelector('.name');
    const subtitleDiv = avatarSection.querySelector('.subtitle');
    const identicon = document.getElementById('contactInfoAvatar').innerHTML;

    // Update the avatar section
    avatarDiv.innerHTML = identicon;
    // update the name and subtitle
    nameDiv.textContent = contactInfoModal.usernameDiv.textContent;
    subtitleDiv.textContent = contactInfoModal.subtitleDiv.textContent;

    // update the provided name
    const providedNameDiv = this.providedNameContainer.querySelector('.contact-info-value');

    // if the textContent is 'Not provided', set it to an empty string
    const providedName = document.getElementById('contactInfoProvidedName').textContent;
    if (providedName === 'Not provided') {
      this.providedNameContainer.style.display = 'none';
    } else {
      providedNameDiv.textContent = providedName;
      this.providedNameContainer.style.display = 'block';
    }

    // Get the original name from the contact info display
    const contactNameDisplay = document.getElementById('contactInfoName');
    let originalName = contactNameDisplay.textContent;
    if (originalName === 'Not Entered') {
      originalName = '';
    }

    // Set up the input field with the original name
    this.nameInput.value = originalName;

    // field-action-button should be clear
    this.nameActionButton.className = 'field-action-button clear';

    // Get the current contact info from the contact info modal
    this.currentContactAddress = contactInfoModal.currentContactAddress;
    if (!this.currentContactAddress || !myData.contacts[this.currentContactAddress]) {
      console.error('No current contact found');
      return;
    }

    // Show the edit contact modal
    this.modal.classList.add('active');

    // Create a handler function to focus the input after the modal transition
    const editContactFocusHandler = () => {
      // add slight delay and focus on the the very right of the input
      setTimeout(() => {
        this.nameInput.focus();
        // Set cursor position to the end of the input content
        this.nameInput.setSelectionRange(this.nameInput.value.length, this.nameInput.value.length);
      }, 200);
      this.modal.removeEventListener('transitionend', editContactFocusHandler);
    };

    // Add the event listener
    this.modal.addEventListener('transitionend', editContactFocusHandler);
  }

  close() {
    this.modal.classList.remove('active');
    this.currentContactAddress = null;
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

    // if already 'add' class, return early
    if (this.nameActionButton.classList.contains('add')) {
      return;
    }

    this.nameActionButton.className = 'field-action-button add';
    this.nameActionButton.setAttribute('aria-label', 'Save');
  }

  handleNameBlur() {
    // normalize the input using normalizeName
    const normalizedName = normalizeName(this.nameInput.value, true);
    this.nameInput.value = normalizedName;
  }

  handleNameButton() {
    if (this.nameActionButton.classList.contains('clear')) {
      this.nameInput.value = '';
      // Always show save button after clearing
      this.nameActionButton.className = 'field-action-button add';
      this.nameActionButton.setAttribute('aria-label', 'Save');
      this.nameInput.focus();
    } else {
      this.handleSave();
    }
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
    const contact = myData.contacts[this.currentContactAddress];
    if (contact) {
      contact.name = newName;
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
  }

  close() {
    this.modal.classList.remove('active');
    walletScreen.openHistoryModalButton.classList.remove('has-notification');
    footer.walletButton.classList.remove('has-notification');
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

  async updateTransactionHistory() {
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
    this.transactionList.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 2rem; margin-bottom: 1rem"></div>
        <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
        <div>Your transaction history will appear here</div>
      </div>`;
  }

  async handleAssetChange() {
    await this.updateTransactionHistory();
  }

  handleItemClick(event) {
    const item = event.target.closest('.transaction-item');
    
    if (!item) return;
    
    if (item.dataset.status === 'failed') {
      console.log(`Not opening chatModal for failed transaction`);
      
      if (event.target.closest('.transaction-item')) {
        failedTransactionModal.open(item.dataset.txid, item);
      }
      return;
    }
    
    const memo = item.querySelector('.transaction-memo')?.textContent;
    if (memo === 'stake' || memo === 'unstake') {
      validatorStakingModal.open();
      return;
    }
    
    const address = item.dataset.address;
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
  async refresh() {
    if (this.isActive()) {
      await this.updateTransactionHistory();
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
        // asset.lastPriceUpdate = now;
        // myData.wallet.assets[i] = asset; // Update the asset in the array
        myData.wallet.priceTimestamp = now;
        console.log(`Updated price of ${asset.symbol} to ${asset.price}`);
        console.log(JSON.stringify(data, null, 4));
      } else {
        console.warn(`No price data found for ${asset.symbol} from API`);
      }
    } catch (error) {
      console.error(`Failed to update price for ${asset.symbol}`, error);
    }
  }
}

async function queryNetwork(url) {
  //console.log('queryNetwork', url)
  if (!isOnline) {
    //TODO: show user we are not online
    console.warn('not online');
    //alert('not online')
    return null;
  }
  const selectedGateway = getGatewayForRequest();
  if (!selectedGateway) {
    console.error('No gateway available for network query');
    return null;
  }

  try {
    const response = await fetch(`${selectedGateway.web}${url}`);
    console.log('query', `${selectedGateway.web}${url}`);
    const data = parse(await response.text());
    console.log('response', data);
    return data;
  } catch (error) {
    console.error(`queryNetwork ERROR: ${error}`);
    return null;
  }
}

async function pollChatInterval(milliseconds) {
  pollChats.nextPoll = milliseconds;
  pollChats();
}

// Called every 30 seconds if we are online and not subscribed to WebSocket
async function pollChats() {
  // Step 3: Poll if we are not subscribed to WebSocket
  if (!useLongPolling) {
    // Skip if no valid account
    if (!myAccount?.keys?.address) {
      console.log('Poll skipped: No valid account');
      return;
    }

    try {
      const gotChats = await chatsScreen.updateChatData();
      if (gotChats > 0) {
        await chatsScreen.updateChatList();
      }

      if (walletScreen.isActive()) {
        await walletScreen.updateWalletView();
      }
    } catch (error) {
      console.error('Chat polling error:', error);
    }

    scheduleNextPoll();
  } else if (window.chatUpdateTimer) {
    // Clear polling if WebSocket is subscribed
    clearTimeout(window.chatUpdateTimer);
    window.chatUpdateTimer = null;
    console.log('Poll status: Stopped - using long polling');
  }

  // Step 4: Log final status
  const pollStatus = {
    useLongPolling: useLongPolling,
    accountValid: Boolean(myAccount?.keys?.address),
    pollingStatus: window.chatUpdateTimer ? 'polling' : 'not polling',
  };
  console.log('Poll Status:', JSON.stringify(pollStatus, null, 2));
}

// Helper function to schedule next poll
function scheduleNextPoll() {
  if (window.chatUpdateTimer) {
    clearTimeout(window.chatUpdateTimer);
  }

  const interval = pollChats.nextPoll || pollIntervalNormal;
  const now = getCorrectedTimestamp();
  console.log(
    'Poll schedule:',
    JSON.stringify(
      {
        timestamp: now,
        nextPollIn: `${interval}ms`,
        reason: 'WebSocket not subscribed',
      },
      null,
      2
    )
  );

  window.chatUpdateTimer = setTimeout(pollChats, interval);
}

async function getChats(keys, retry = 1) {
  // needs to return the number of chats that need to be processed
  console.log(`getChats retry ${retry}`);
  //console.log('keys', keys)
  if (!keys) {
    console.log('no keys in getChats');
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
  const timestamp = myAccount.chatTimestamp || 0;
  //    const timestamp = myData.contacts[keys.address]?.messages?.at(-1).timestamp || 0

  const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/${timestamp}`); // TODO get this working
  //    const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/0`) // TODO stop using this
  let chatCount = senders?.chats ? Object.keys(senders.chats).length : 0; // Handle null/undefined senders.chats
  console.log(
    'getChats senders',
    timestamp === undefined ? 'undefined' : JSON.stringify(timestamp),
    chatCount === undefined ? 'undefined' : JSON.stringify(chatCount),
    senders === undefined ? 'undefined' : JSON.stringify(senders)
  );
  if (senders && senders.chats && chatCount) {
    // TODO check if above is working
    await processChats(senders.chats, keys);
  } else {
    console.error('getChats: no senders found')
  }
  if (chatModal.address) {
    // clear the unread count of address for open chat modal
    myData.contacts[chatModal.address].unread = 0;
  }
  return chatCount;
}
getChats.lastCall = 0;

// play sound if true or false parameter
function playChatSound(shouldPlay) {
  if (shouldPlay) {
    const notificationAudio = document.getElementById('notificationSound');
    if (notificationAudio) {
      notificationAudio.play().catch((error) => {
        console.warn('Notification sound playback failed:', error);
      });
    }
  }
}

function playTransferSound(shouldPlay) {
  if (shouldPlay) {
    const notificationAudio = document.getElementById('transferSound');
    if (notificationAudio) {
      notificationAudio.play().catch((error) => {
        console.warn('Notification sound playback failed:', error);
      });
    }
  }
}

// Actually payments also appear in the chats, so we can add these to
async function processChats(chats, keys) {
  let newTimestamp = 0;
  const timestamp = myAccount.chatTimestamp || 0;
  const messageQueryTimestamp = Math.max(0, timestamp);

  for (let sender in chats) {
    // Fetch messages using the adjusted timestamp
    const res = await queryNetwork(`/messages/${chats[sender]}/${messageQueryTimestamp}`);
    console.log('processChats sender', sender, 'fetching since', messageQueryTimestamp);
    if (res && res.messages) {
      const from = normalizeAddress(sender);
      if (!myData.contacts[from]) {
        createNewContact(from);
      }
      const contact = myData.contacts[from];
      //            contact.address = from        // not needed since createNewContact does this
      let added = 0;
      let hasNewTransfer = false;

      // This check determines if we're currently chatting with the sender
      // We ONLY want to avoid notifications if we're actively viewing this exact chat
      const inActiveChatWithSender =
        chatModal.address === from && chatModal.isActive();

      for (let i in res.messages) {
        const tx = res.messages[i]; // the messages are actually the whole tx
        //console.log('message tx is')
        //console.log(JSON.stringify(message, null, 4))
        newTimestamp = tx.timestamp > newTimestamp ? tx.timestamp : newTimestamp;
        if (tx.type == 'message') {
          if (tx.from == longAddress(keys.address)) {
            continue;
          } // skip if the message is from us
          const payload = tx.xmessage; // changed to use .message
          if (payload.encrypted) {
            let senderPublic = myData.contacts[from]?.public;
            if (!senderPublic) {
              const senderInfo = await queryNetwork(`/account/${longAddress(from)}`);
              // TODO for security, make sure hash of public key is same as from address; needs to be in other similar situations
              //console.log('senderInfo.account', senderInfo.account)
              if (!senderInfo?.account?.publicKey) {
                console.log(`no public key found for sender ${sender}`);
                continue;
              }
              senderPublic = senderInfo.account.publicKey;
              if (myData.contacts[from]) {
                myData.contacts[from].public = senderPublic;
              }
            }
            payload.public = senderPublic;
          }
          //console.log("payload", payload)
          decryptMessage(payload, keys); // modifies the payload object
          if (payload.senderInfo) {
            contact.senderInfo = cleanSenderInfo(payload.senderInfo)
            delete payload.senderInfo;
            if (!contact.username && contact.senderInfo.username) {
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
              if(contact.username) {
                // if we already have the username, we can use it
                contact.senderInfo.username = contact.username;
              } else {
                console.error(`Username not provided in senderInfo.`)
                continue
              }
            }
          }
          //  skip if this tx was processed before and is already in contact.messages;
          //    messages are the same if the messages[x].sent_timestamp is the same as the tx.timestamp,
          //    and messages[x].my is false and messages[x].message == payload.message
          let alreadyExists = false;
          for (const existingMessage of contact.messages) {
            if (
              existingMessage.sent_timestamp === payload.sent_timestamp &&
              existingMessage.message === payload.message &&
              existingMessage.my === false
            ) {
              alreadyExists = true;
              break;
            }
          }
          if (alreadyExists) {
            //console.log(`Skipping already existing message: ${payload.sent_timestamp}`);
            continue; // Skip to the next message
          }

          //console.log('contact.message', contact.messages)
          payload.my = false;
          payload.timestamp = payload.sent_timestamp;
          payload.txid = getTxid(tx);
          delete payload.pqEncSharedKey; 
          insertSorted(contact.messages, payload, 'timestamp');
          // if we are not in the chatModal of who sent it, playChatSound or if device visibility is hidden play sound
          if (!inActiveChatWithSender || document.visibilityState === 'hidden') {
            playChatSound(true);
          }
          added += 1;
        } else if (tx.type == 'transfer') {
          //console.log('transfer tx is')
          //console.log(JSON.stringify(message, null, 4))
          if (tx.from == longAddress(keys.address)) {
            continue;
          } // skip if the message is from us
          const payload = tx.xmemo;
          if (payload.encrypted) {
            let senderPublic = myData.contacts[from]?.public;
            if (!senderPublic) {
              const senderInfo = await queryNetwork(`/account/${longAddress(from)}`);
              //console.log('senderInfo.account', senderInfo.account)
              if (!senderInfo?.account?.publicKey) {
                console.log(`no public key found for sender ${sender}`);
                continue;
              }
              senderPublic = senderInfo.account.publicKey;
              if (myData.contacts[from]) {
                myData.contacts[from].public = senderPublic;
              }
            }
            payload.public = senderPublic;
          }
          //console.log("payload", payload)
          decryptMessage(payload, keys); // modifies the payload object
          delete payload.pqEncSharedKey;
          if (payload.senderInfo) {
            contact.senderInfo = cleanSenderInfo(payload.senderInfo);
            delete payload.senderInfo;
            if (!contact.username && contact.senderInfo.username) {
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
              if(contact.username) {
                // if we already have the username, we can use it
                contact.senderInfo.username = contact.username;
              } else {
                console.error(`Username not provided in senderInfo.`)
                continue
              }
            }
          }
          // compute the transaction id (txid)
          /*
          delete tx.sign;
          const jstr = stringify(tx);
          const jstrBytes = utf82bin(jstr);
          const txidHex = hashBytes(jstrBytes);
          */
          const txidHex = getTxid(tx);

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
            sign: 1,
            timestamp: payload.sent_timestamp,
            address: from,
            memo: payload.message,
          };
          insertSorted(history, newPayment, 'timestamp');
          // TODO: redundant but keep for now
          //  sort history array based on timestamp field in descending order
          //history.sort((a, b) => b.timestamp - a.timestamp);

          // Mark that we have a new transfer for toast notification
          hasNewTransfer = true;

          // --- Create and Insert Transfer Message into contact.messages ---
          const transferMessage = {
            timestamp: payload.sent_timestamp,
            sent_timestamp: payload.sent_timestamp,
            my: false, // Received transfer
            message: payload.message, // Use the memo as the message content
            amount: parse(stringify(tx.amount)), // Ensure amount is stored as BigInt
            symbol: 'LIB', // TODO: get the symbol from the asset
            txid: txidHex,
          };
          // Insert the transfer message into the contact's message list, maintaining sort order
          insertSorted(contact.messages, transferMessage, 'timestamp');
          // --------------------------------------------------------------

          added += 1;

          // Update wallet view if it's active
          if (walletScreen.isActive()) {
            walletScreen.updateWalletView();
          }
          // update history modal if it's active
          historyModal.refresh();

          // Always play transfer sound for new transfers
          playTransferSound(true);
          // is chatModal of sender address is active
          if (inActiveChatWithSender && document.visibilityState === 'visible') {
            // add the transfer tx to the chatModal
            chatModal.appendChatModal(true);
          }
        }
      }
      // If messages were added to contact.messages, update myData.chats
      if (added > 0) {
        // Get the most recent message (index 0 because it's sorted descending)
        const latestMessage = contact.messages[0];

        // Create chat object with only guaranteed fields
        const chatUpdate = {
          address: from,
          timestamp: latestMessage.timestamp,
        };

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

        // Remove existing chat for this contact if it exists
        const existingChatIndex = myData.chats.findIndex((chat) => chat.address === from);
        if (existingChatIndex !== -1) {
          myData.chats.splice(existingChatIndex, 1);
        }

        // Find insertion point to maintain timestamp order (newest first)
        const insertIndex = myData.chats.findIndex((chat) => chat.timestamp < chatUpdate.timestamp);

        if (insertIndex === -1) {
          // If no earlier timestamp found, append to end
          myData.chats.push(chatUpdate);
        } else {
          // Insert at correct position to maintain order
          myData.chats.splice(insertIndex, 0, chatUpdate);
        }

        // Only suppress notification if we're ACTIVELY viewing this chat and if not a transfer
        if (!inActiveChatWithSender && !hasNewTransfer) {
          if (!chatsScreen.isActive()) {
            footer.chatButton.classList.add('has-notification');
          }
        }
      }

      // Show transfer notification even if no messages were added
      if (hasNewTransfer) {
        // Add notification indicator to Wallet tab if we're not on it
        if (!walletScreen.isActive()) {
          footer.walletButton.classList.add('has-notification');
        }
        // Add notification to openHistoryModal wallet-action-button
        walletScreen.openHistoryModalButton.classList.add('has-notification');
      }
    }
  }

  // Update the global timestamp AFTER processing all senders
  if (newTimestamp > 0) {
    // Update the timestamp
    myAccount.chatTimestamp = newTimestamp;
    console.log('Updated global chat timestamp to', newTimestamp);
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
    console.log('Error checking username:', error);
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
    chatId: hashBytes([fromAddr, toAddr].sort().join``),
    // TODO backend is not allowing memo > 140 characters; by pass using xmemo; we might have to check the total tx size instead
    // memo: stringify(memo),
    xmemo: memo,
    timestamp: getCorrectedTimestamp(),
    fee: parameters.current.transactionFee || 1n * wei, // This is not used by the backend
    networkId: network.netid,
  };

  const txid = await signObj(tx, keys);
  const res = await injectTx(tx, txid);
  return res;
}

// TODO - backend - when account is being registered, ensure that loserCase(alias)=alias and hash(alias)==aliasHash
async function postRegisterAlias(alias, keys) {
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
    console.log('DEBUG: injectTx response', response);
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
        pendingTxData.friend = tx.friend;
      } else if (tx.type === 'read') {
        pendingTxData.oldContactTimestamp = tx.oldContactTimestamp;
      } else if (
        tx.type === 'message' ||
        tx.type === 'transfer' ||
        tx.type === 'deposit_stake' ||
        tx.type === 'withdraw_stake'
      ) {
        pendingTxData.to = normalizeAddress(tx.to);
      }
      myData.pending.push(pendingTxData);
    } else {
      showToast('Error injecting transaction: ' + data?.result?.reason, 0, 'error');
      console.error('Error injecting transaction:', data?.result?.reason);
      if (data?.result?.reason?.includes('timestamp out of range')) {
        console.error('Timestamp out of range, updating timestamp');
        timeDifference()
        showToast('Try again.', 0, 'error');
      }
    }

    return data;
  } catch (error) {
    showToast('Error injecting transaction: ' + error, 0, 'error');
    console.error('Error injecting transaction:', error);
    return null;
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
  let txo = tx;
  if (typeof(tx) === "string"){
    txo = parse(tx)
  }
  delete txo.sign;
  const jstr = stringify(txo);
  const jstrBytes = utf82bin(jstr);
  const txidHex = hashBytes(jstrBytes);
  return txidHex;
}

class SearchMessagesModal {
  constructor() {}

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
    this.searchInput.focus();
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

      contact.messages.forEach((message, index) => {
        if (message.message.toLowerCase().includes(searchLower)) {
          // Highlight matching text
          const messageText = escapeHtml(message.message);
          const highlightedText = messageText.replace(new RegExp(searchText, 'gi'), (match) => `<mark>${match}</mark>`);
          const displayedName = getContactDisplayName(contact);
          results.push({
            contactAddress: address,
            username: displayedName,
            messageId: message.txid,
            message: message, // Pass the entire message object
            timestamp: message.timestamp,
            preview: truncateMessage(highlightedText, 100),
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
    resultsContainer.innerHTML = `
          <div class="empty-state">
              <div class="empty-state-message">${message}</div>
          </div>
      `;
  }

  handleSearchResultClick(result) {
    try {
      // Close search modal
      this.close();

      // Switch to chats view if not already there
      footer.switchView('chats');

      // Open the chat with this contact
      chatModal.open(result.contactAddress);

      // Scroll to and highlight the message
      // could move this into chat modal class as scrollToMessage
      setTimeout(() => {
        const messageSelector = `[data-txid="${result.messageId}"]`;
        const messageElement = document.querySelector(messageSelector);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('highlighted');
          setTimeout(() => messageElement.classList.remove('highlighted'), 2000);
        } else {
          console.error('Message element not found for selector:', messageSelector);
          // Could add a toast notification here
        }
      }, 300);
    } catch (error) {
      console.error('Error handling search result:', error);
      // Could add error notification here
    }
  }

  displaySearchResults(results) {
    // Create a ul element to properly contain the list items
    const resultsList = document.createElement('ul');
    resultsList.className = 'chat-list';

    results.forEach(async (result) => {
      const resultElement = document.createElement('li');
      resultElement.className = 'chat-item search-result-item';

      // Generate identicon for the contact
      const identicon = await generateIdenticon(result.contactAddress);

      // Format message preview with "You:" prefix if it's a sent message
      // make this textContent?
      const messagePreview = result.my ? `You: ${result.preview}` : `${result.preview}`;

      resultElement.innerHTML = `
              <div class="chat-avatar">
                  ${identicon}
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

      resultElement.addEventListener('click', (event) => {
        event.stopImmediatePropagation(); // Stop all other listeners and bubbling immediately
        // clear search input and clear results
        document.getElementById('messageSearch').value = '';
        document.getElementById('searchResults').innerHTML = '';
        this.handleSearchResultClick(result);
      });

      resultsList.appendChild(resultElement);
    });

    // Clear and append the new list
    this.searchResults.innerHTML = '';
    this.searchResults.appendChild(resultsList);
  }

  handleMessageSearchInput(e) {
    // debounced search
    const debouncedSearch = debounce(
      (searchText) => {
        const trimmedText = searchText.trim();

        if (!trimmedText) {
          this.searchResults.innerHTML = '';
          return;
        }

        const results = this.searchMessages(trimmedText);
        if (results.length === 0) {
          this.displayEmptyState('searchResults', 'No messages found');
        } else {
          this.displaySearchResults(results);
        }
      },
      (searchText) => (searchText.length === 1 ? 600 : 300)
    );

    debouncedSearch(e.target.value);
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
        (searchText) => (searchText.length === 1 ? 600 : 300)
      )
    );
  }

  open() {
    this.modal.classList.add('active');
    this.searchInput.focus();
  }

  close() {
    this.modal.classList.remove('active');
    this.searchInput.value = '';
    this.resultsContainer.innerHTML = '';
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  searchContacts(searchText) {
    if (!searchText || !myData?.contacts) return [];

    const results = [];
    const searchLower = searchText.toLowerCase();

    // Search through all contacts
    Object.entries(myData.contacts).forEach(([address, contact]) => {
      // Fields to search through
      const searchFields = [
        contact.username,
        contact.name,
        contact.email,
        contact.phone,
        contact.linkedin,
        contact.x,
      ].filter(Boolean); // Remove null/undefined values

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

  displayContactResults(results, searchText) {
    this.resultsContainer.innerHTML = '';

    results.forEach(async (contact) => {
      const contactElement = document.createElement('div');
      contactElement.className = 'chat-item contact-item';

      // Generate identicon for the contact
      const identicon = await generateIdenticon(contact.address);

      // Determine which field matched for display
      const matchedField = [
        { field: 'username', value: contact.username },
        { field: 'name', value: contact.name },
        { field: 'email', value: contact.email },
        { field: 'phone', value: contact.phone },
        { field: 'linkedin', value: contact.linkedin },
        { field: 'x', value: contact.x },
      ].find((f) => f.value && f.value.toLowerCase().includes(searchText.toLowerCase()));

      // Create match preview with label and highlighted matched value
      const matchPreview = matchedField
        ? `${matchedField.field}: ${matchedField.value.replace(
            new RegExp(searchText, 'gi'),
            (match) => `<mark>${match}</mark>`
          )}`
        : '';
      const displayedName = getContactDisplayName(contact);

      contactElement.innerHTML = `
              <div class="chat-avatar">
                  ${identicon}
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
    username: contact.username || contact.address.slice(0, 8) + '...' + contact.address.slice(-6),
    name: contact.name || 'Not Entered',
    providedname: contact.senderInfo?.name || 'Not provided',
    email: contact.senderInfo?.email || 'Not provided',
    phone: contact.senderInfo?.phone || 'Not provided',
    linkedin: contact.senderInfo?.linkedin || 'Not provided',
    x: contact.senderInfo?.x || 'Not provided',
    address: contact.address,
  };
}

// Add this function before the ContactInfoModal class
function showToast(message, duration = 2000, type = 'default') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Generate a unique ID for this toast
  const toastId = 'toast-' + getCorrectedTimestamp() + '-' + Math.floor(Math.random() * 1000);
  toast.id = toastId;

  toastContainer.appendChild(toast);

  // Force reflow to enable transition
  toast.offsetHeight;

  // Show with a slight delay to ensure rendering
  setTimeout(() => {
    toast.classList.add('show');
    // For error toasts, keep it up until the user clicks somewhere to make it go away
    if (type === 'error') {
      // Add a close button to error toasts
      toast.style.pointerEvents = 'auto';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close-btn';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '&times;';
      toast.appendChild(closeBtn);

      // Make the whole toast clickable
      toast.onclick = () => {
        hideToast(toastId);
      };
    } else if (duration > 0) {
      setTimeout(() => {
        hideToast(toastId);
      }, duration);
    }
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
    console.log('Just came back online.');
    // We just came back online
    updateUIForConnectivity();
    showToast("You're back online!", 3000, 'online');
    // Force update data with reconnection handling
    if (myAccount && myAccount.keys) {
      try {
        // Update chats with reconnection handling
        const gotChats = await chatsScreen.updateChatData();
        if (gotChats > 0) {
          await chatsScreen.updateChatList();
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

    // Wallet related
    '#refreshBalance',
    '#sendForm button[type="submit"]',

    // Send asset related
    '#sendAssetForm button[type="submit"]',

    // Add friend related
    '#friendForm button[type="submit"]',

    // Contact related
    '#chatRecipient',
    '#chatAddFriendButton',
    '#addFriendButton',

    // Profile related
    '#accountForm button[type="submit"]',
    '#createAccountForm button[type="submit"]',
    '#importForm button[type="submit"]',

    // submitFeedback button
    '#submitFeedback',

    // stakeModal
    '#submitStake',

    // tollModal
    '#saveNewTollButton',

    //inviteModal
    '#inviteForm button[type="submit"]',
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
    if (!isOnline || netIdMismatch) {
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
}

// Prevent form submissions when offline
function preventOfflineSubmit(event) {
  if (!isOnline) {
    event.preventDefault();
    showToast('This action requires an internet connection', 3000, 'error');
  }
}

// Add global isOnline variable at the top with other globals
let isOnline = navigator.onLine; // Will be updated by connectivity checks
let netIdMismatch = false; // Will be updated by checkConnectivity

// Add checkConnectivity function before setupConnectivityDetection
async function checkConnectivity() {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;

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
    document.getElementById('confirmRemoveAccount').addEventListener('click', () => this.submit());
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
    myData = null; // need to delete this so that the reload does not save the data into localStore again
    window.location.reload();
  }

  confirmSubmit() {
    const usernameSelect = document.getElementById('username');
    const username = usernameSelect.value;
    if (!username) return;
    const confirmed = confirm(`Are you sure you want to remove account "${username}"?`);
    if (!confirmed) return;
    this.submit(username);
  }

  signout() {
    // called when user is logging out
  }
}
const removeAccountModal = new RemoveAccountModal();

class BackupAccountModal {
  constructor() {}

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('exportModal');
    document.getElementById('closeExportForm').addEventListener('click', () => this.close());
    document.getElementById('exportForm').addEventListener('submit', (event) => {
      if (myData) {
        this.handleSubmitOne(event);
      } else {
        this.handleSubmitAll(event);
      }
    });
  }

  open() {
    // called when the modal needs to be opened
    this.modal.classList.add('active');
  }

  close() {
    // called when the modal needs to be closed
    this.modal.classList.remove('active');
  }

  /**
   * Generate a backup filename based on the current date and time.
   * @param {string} username - The username to include in the filename.
   * @returns {string} The generated filename.
   */
  generateBackupFilename(username = null) {
    // Generate timestamp with hour and minute
    const now = getCorrectedTimestamp();
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
   * Handle the submission of a single account backup.
   * @param {Event} event - The event object.
   */
  async handleSubmitOne(event) {
    event.preventDefault();

    const password = document.getElementById('exportPassword').value;
    const jsonData = stringify(myData, null, 2);

    try {
      // Encrypt data if password is provided
      const finalData = password ? encryptData(jsonData, password) : jsonData;

      // Create and trigger download
      const blob = new Blob([finalData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.generateBackupFilename(myAccount.username);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Close export modal
      this.close();
    } catch (error) {
      console.error('Encryption failed:', error);
      showToast('Failed to encrypt data. Please try again.', 0, 'error');
    }
  }

  /**
   * Handle the submission of a backup for all accounts.
   * @param {Event} event - The event object.
   */
  async handleSubmitAll(event) {
    event.preventDefault();

    const password = document.getElementById('exportPassword').value;
    const myLocalStore = this.copyLocalStorageToObject();
//    console.log(myLocalStore);
    const jsonData = stringify(myLocalStore, null, 2);

    try {
      // Encrypt data if password is provided
      const finalData = password ? encryptData(jsonData, password) : jsonData;

      // Create and trigger download
      const blob = new Blob([finalData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.generateBackupFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Close export modal
      this.close();
    } catch (error) {
      console.error('Encryption failed:', error);
      showToast('Failed to encrypt data. Please try again.', 0, 'error');
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
}
const backupAccountModal = new BackupAccountModal();

class RestoreAccountModal {
  constructor() {
    this.developerOptionsEnabled = false;
    this.netids = []; // Will be populated from network.js
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
    this.developerOptionsSection = document.getElementById('developerOptionsSection');

    this.closeImportForm.addEventListener('click', () => this.close());
    this.importForm.addEventListener('submit', (event) => this.handleSubmit(event));
    
    // Add new event listeners for developer options
    this.developerOptionsToggle.addEventListener('change', (e) => this.toggleDeveloperOptions(e));
    // setup mutual exclusion for the developer options
    this.setupMutualExclusion(this.oldStringSelect, this.oldStringCustom);
    this.setupMutualExclusion(this.newStringSelect, this.newStringCustom);
    
    // Add listeners to extract netids from selected file
    this.fileInput.addEventListener('change', () => this.extractNetidsFromFile());
    this.passwordInput.addEventListener('input', debounce(() => this.extractNetidsFromFile(), 500));
    
    // Populate netid dropdowns
    this.populateNetidDropdowns();
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
    // have developer options toggle unchecked and clear any previous inputs
    this.clearForm();

    // called when the modal needs to be opened
    this.modal.classList.add('active');
  }

  close() {
    // called when the modal needs to be closed
    this.modal.classList.remove('active');
    this.clearForm();
  }

  // toggle the developer options section
  toggleDeveloperOptions(event) {
    this.developerOptionsEnabled = event.target.checked;
    this.developerOptionsSection.style.display = this.developerOptionsEnabled ? 'block' : 'none';
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

  // extract netids from selected file and add to dropdowns
  async extractNetidsFromFile() {
    const file = this.fileInput.files[0];
    if (!file) return;

    console.log('extractNetidsFromFile');

    try {
      let content = await file.text();
      // Try to decrypt if encrypted
      if (!content.match('{')) {
        console.log('decrypting file');
        const password = this.passwordInput.value.trim();
        if (!password) return;
        try {
          content = decryptData(content, password);
        } catch { return; } // Invalid password, skip silently
      }

      const data = parse(content);
      const netids = new Set();

      // Extract netids only from localStorage keys (username_netid format)
      Object.keys(data).forEach(key => {
        if (key.includes('_') && key !== 'accounts' && key !== 'version') {
          const parts = key.split('_');
          if (parts.length >= 2) {
            const possibleNetid = parts[parts.length - 1]; // Get part after last underscore
            if (possibleNetid.length === 64 && /^[a-f0-9]+$/.test(possibleNetid)) {
              netids.add(possibleNetid);
            }
          }
        }
      });

      // Add new netids to dropdowns
      const existing = Array.from(this.oldStringSelect.options).map(opt => opt.value);
      [...netids].filter(netid => !existing.includes(netid)).forEach(netid => {
        const label = `${netid} (from file)`;
        this.oldStringSelect.add(new Option(label, netid));
        this.newStringSelect.add(new Option(label, netid));
      });

      if (netids.size > 0) console.log(`Found ${netids.size} netids from file`);
    } catch { /* Ignore file/parse errors */ }
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

  async handleSubmit(event) {
    event.preventDefault();

    try {
      // Read the file
      const file = this.fileInput.files[0];
      let fileContent = await file.text();
      const isNotEncryptedData = fileContent.match('{');

      // Check if data is encrypted and decrypt if necessary
      if (!isNotEncryptedData) {
        if (!this.passwordInput.value.trim()) {
          showToast('Password required for encrypted data', 3000, 'error');
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
        console.log(`Applied substitution: ${substitution.oldString} → ${substitution.newString}`);
      }

      // We first parse to jsonData so that if the parse does not work we don't destroy myData
      myData = parse(fileContent);

      // if myData has a version key then we assume all accounts were backed up and being restored
      if (myData.version) {
        // Warn user about global restore and ask for confirmation
        const confirmed = confirm('⚠️ WARNING: This will restore all accounts and clear existing data.\n\nIt is recommended to backup your current data before proceeding.\n\nDo you want to continue with the restore?');
        
        if (!confirmed) {
          showToast('Restore cancelled by user', 2000, 'info');
          return;
        }
        
        localStorage.clear();
        this.copyObjectToLocalStorage(myData);
      }
      // we are restoring only one account
      else {
        // also need to set myAccount
        const acc = myData.account; // this could have other things which are not needed
        myAccount = {
          netid: acc.netid,
          username: acc.username,
          keys: {
            address: acc.keys.address,
            public: acc.keys.public,
            secret: acc.keys.secret,
            type: acc.keys.type,
          },
        };
        // Get existing accounts or create new structure
        const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
        // Ensure netid exists
        if (!existingAccounts.netids[myAccount.netid]) {
          existingAccounts.netids[myAccount.netid] = { usernames: {} };
        }
        // Store updated accounts back in localStorage
        existingAccounts.netids[myAccount.netid].usernames[myAccount.username] = {
          address: myAccount.keys.address,
        };
        localStorage.setItem('accounts', stringify(existingAccounts));

        // Store the localStore entry for username_netid
        localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));
      }

      // Show success message using toast
      showToast('Account restored successfully!', 2000, 'success');

      // Reset form and close modal after delay
      setTimeout(() => {
        this.close();
        myData = null // since we already saved to localStore, we want to make sure beforeunload calling saveState does not also save
        window.location.reload(); // need to go through Sign In to make sure imported account exists on network
        this.clearForm();
      }, 2000);
    } catch (error) {
      showToast(error.message || 'Import failed. Please check file and password.', 3000, 'error');
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
    // hide the developer options section
    this.developerOptionsSection.style.display = 'none';
    // reset dropdowns to original state
    this.oldStringSelect.length = 1;
    this.newStringSelect.length = 1;
    this.populateNetidDropdowns();
  }

  copyObjectToLocalStorage(obj) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        localStorage.setItem(key, obj[key]);
      }
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
    this.newTollAmountInputElement = document.getElementById('newTollAmountInput');
    this.toggleTollCurrencyElement = document.getElementById('toggleTollCurrency');
    this.warningMessageElement = document.getElementById('tollWarningMessage');
    this.saveButton = document.getElementById('saveNewTollButton');
    this.closeButton = document.getElementById('closeTollModal');
    this.tollForm = document.getElementById('tollForm');
    this.tollCurrencySymbol = document.getElementById('tollCurrencySymbol');

    this.tollForm.addEventListener('submit', (event) => this.saveAndPostNewToll(event));
    this.closeButton.addEventListener('click', () => this.close());
    this.toggleTollCurrencyElement.addEventListener('click', (event) => this.handleToggleTollCurrency(event));
    this.newTollAmountInputElement.addEventListener('input', () => this.newTollAmountInputElement.value = normalizeUnsignedFloat(this.newTollAmountInputElement.value));
    this.newTollAmountInputElement.addEventListener('input', () => this.updateSaveButtonState());
  }

  open() {
    this.modal.classList.add('active');
    // set currentTollValue to the toll value in wei
    const toll = myData.settings.toll || 0n;
    const tollUnit = myData.settings.tollUnit || 'LIB';

    // Fetch network parameters to get minToll
    this.minToll = parameters?.current?.minToll || 1n * wei; // Default to 1 LIB if not set

    this.updateTollDisplay(toll, tollUnit);

    this.currentCurrency = tollUnit;
    this.tollCurrencySymbol.textContent = this.currentCurrency;
    this.newTollAmountInputElement.value = ''; // Clear input field
    this.warningMessageElement.textContent = '';
    this.warningMessageElement.style.display = 'none';
    this.saveButton.disabled = true;

    // Update min toll display under input
    const minTollValue = parseFloat(big2str(this.minToll, 18)).toFixed(6); // Show 6 decimal places
    this.minTollDisplay.textContent = `Minimum toll: ${minTollValue} LIB`;
  }

  close() {
    this.modal.classList.remove('active');
  }

  /**
   * Handle the toggle of the toll currency
   * @param {Event} event - The event object
   * @returns {void}
   */
  async handleToggleTollCurrency(event) {
    event.preventDefault();

    this.currentCurrency = this.currentCurrency === 'LIB' ? 'USD' : 'LIB';
    this.tollCurrencySymbol.textContent = this.currentCurrency;

    const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
    if (this.newTollAmountInputElement.value !== '') {
      const currentValue = parseFloat(this.newTollAmountInputElement.value);
      const convertedValue =
        this.currentCurrency === 'USD' ? currentValue * scalabilityFactor : currentValue / scalabilityFactor;
      this.newTollAmountInputElement.value = convertedValue.toString();
    }

    // Update min toll display with converted value
    if (this.currentCurrency === 'USD') {
      const minTollUSD = bigxnum2big(this.minToll, scalabilityFactor.toString());
      this.minTollDisplay.textContent = `Minimum toll: ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD`; // Show 4 decimal places for USD
    } else {
      this.minTollDisplay.textContent = `Minimum toll: ${parseFloat(big2str(this.minToll, 18)).toFixed(6)} LIB`; // Show 6 decimal places for LIB
    }
    this.updateSaveButtonState();
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
        const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
        const newTollLIB = bigxnum2big(newToll, (1 / scalabilityFactor).toString());
        if (newTollLIB < this.minToll) {
          const minTollUSD = bigxnum2big(this.minToll, scalabilityFactor.toString());
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
      const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
      const maxTollUSD = MAX_TOLL * scalabilityFactor;
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
    const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
    let tollValueLib = '';
    let tollValueUSD = '';

    if (tollUnit == 'LIB') {
      tollValueLib = big2str(toll, 18);
      tollValueUSD = (parseFloat(big2str(toll, 18)) * scalabilityFactor).toString();
    } else {
      tollValueUSD = big2str(toll, 18);
      tollValueLib = (parseFloat(big2str(toll, 18)) / scalabilityFactor).toString();
    }

    tollValueLib = parseFloat(tollValueLib).toString();
    tollValueUSD = parseFloat(tollValueUSD).toString();

    document.getElementById('tollAmountLIB').textContent = tollValueLib + ' LIB';
    document.getElementById('tollAmountUSD').textContent = tollValueUSD + ' USD';
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
      const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
      const newTollLIB = bigxnum2big(newToll, (1 / scalabilityFactor).toString());
      if (newTollLIB < this.minToll) {
        const minTollUSD = bigxnum2big(this.minToll, scalabilityFactor.toString());
        return `Toll must be at least ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD or 0 USD`;
      }
    }

    return null;
  }

  /**
   * Updates the save button state and warning message based on input validation
   */
  updateSaveButtonState() {
    const warningMessage = this.getWarningMessage();
    const isValid = !warningMessage;

    // Update save button state
    this.saveButton.disabled = !isValid;

    // Additional check: disable if the new toll is the same as the current toll
    if (isValid) {
      const newTollValue = parseFloat(this.newTollAmountInputElement.value);
      const newTollBigInt = bigxnum2big(wei, this.newTollAmountInputElement.value);
      const currentToll = myData.settings.toll;
      const currentTollUnit = myData.settings.tollUnit;

      if (!isNaN(newTollValue)) {
        if (currentTollUnit === this.currentCurrency) {
          if (newTollBigInt === currentToll) {
            this.saveButton.disabled = true;
          }
        } 
      }
    }

    // Update warning message
    if (warningMessage) {
      this.warningMessageElement.textContent = warningMessage;
      this.warningMessageElement.style.display = 'block';
    } else {
      this.warningMessageElement.textContent = '';
      this.warningMessageElement.style.display = 'none';
    }
  }
}

const tollModal = new TollModal();

// Invite Modal
class InviteModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('inviteModal');
    this.inviteEmailInput = document.getElementById('inviteEmail');
    this.invitePhoneInput = document.getElementById('invitePhone');
    this.submitButton = document.querySelector('#inviteForm button[type="submit"]');
    this.closeButton = document.getElementById('closeInviteModal');
    this.inviteForm = document.getElementById('inviteForm');

    this.closeButton.addEventListener('click', () => this.close());
    this.inviteForm.addEventListener('submit', (event) => this.handleSubmit(event));

    // input event listeners for email and phone fields
    this.inviteEmailInput.addEventListener('input', () => this.inviteEmailInput.value = normalizeEmail(this.inviteEmailInput.value));
    this.inviteEmailInput.addEventListener('input', () => this.validateInputs());
    this.invitePhoneInput.addEventListener('input', () => this.invitePhoneInput.value = normalizePhone(this.invitePhoneInput.value));
    this.invitePhoneInput.addEventListener('blur', () => this.invitePhoneInput.value = normalizePhone(this.invitePhoneInput.value, true));
    this.invitePhoneInput.addEventListener('input', () => this.validateInputs());
  }

  validateInputs() {
    const email = this.inviteEmailInput.value.trim();
    const phone = this.invitePhoneInput.value.trim();
    if (email || phone) {
      this.submitButton.disabled = false;
    } else {
      this.submitButton.disabled = true;
    }
  }

  open() {
    // Clear any previous values
    this.inviteEmailInput.value = '';
    this.invitePhoneInput.value = '';
    this.validateInputs(); // Set initial button state
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  async handleSubmit(event) {
    event.preventDefault();

    const email = this.inviteEmailInput.value.trim();
    const phone = this.invitePhoneInput.value.trim();

    if (!email && !phone) {
      showToast('Please enter either an email or phone number', 3000, 'error');
      // Ensure button is disabled again if somehow submitted while empty
      this.submitButton.disabled = true;
      return;
    }

    try {
        const response = await fetch('https://inv.liberdus.com:2053/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: myAccount.username,
          email: email || undefined,
          phone: phone || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Invitation sent successfully!', 3000, 'success');
        this.close();
      } else {
        showToast(data.error || 'Failed to send invitation', 3000, 'error');
      }
    } catch (error) {
      showToast('Failed to send invitation. Please try again.', 3000, 'error');
    }
  }
}
const inviteModal = new InviteModal();

class AboutModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('aboutModal');
    this.closeButton = document.getElementById('closeAboutModal');
    this.versionDisplay = document.getElementById('versionDisplayAbout');
    this.networkName = document.getElementById('networkNameAbout');
    this.netId = document.getElementById('netIdAbout');

    // Set up event listeners
    this.closeButton.addEventListener('click', () => this.close());

    // Set version and network information once during initialization
    this.versionDisplay.textContent = myVersion + ' ' + version;
    this.networkName.textContent = network.name;
    this.netId.textContent = network.netid;
  }

  open() {
    // Show the modal
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }
}
const aboutModal = new AboutModal();

class HelpModal {
  constructor() {}

  load() {
    this.modal = document.getElementById('helpModal');
    this.closeButton = document.getElementById('closeHelpModal');
    this.submitFeedbackButton = document.getElementById('submitFeedback');

    this.closeButton.addEventListener('click', () => this.close());
    this.submitFeedbackButton.addEventListener('click', () => {
      window.open('https://github.com/liberdus/web-client-v2/issues', '_blank');
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

class MyProfileModal {
  constructor() {}

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('accountModal');
    this.closeButton = document.getElementById('closeAccountForm');
    this.name = document.getElementById('name');
    this.email = document.getElementById('email');
    this.phone = document.getElementById('phone');
    this.linkedin = document.getElementById('linkedin');
    this.x = document.getElementById('x');
    this.accountForm = document.getElementById('accountForm');
    this.submitButton = document.querySelector('#accountForm .update-button');

    this.closeButton.addEventListener('click', () => this.close());
    this.accountForm.addEventListener('submit', (event) => this.handleSubmit(event));
    

    // Add input event listeners for validation
    this.name.addEventListener('input', (e) => this.handleNameInput(e));
    this.name.addEventListener('blur', (e) => this.handleNameBlur(e));
    this.phone.addEventListener('input', (e) => this.handlePhoneInput(e));
    this.phone.addEventListener('blur', (e) => this.handlePhoneBlur(e));
    this.email.addEventListener('input', (e) => this.handleEmailInput(e));
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

  handlePhoneInput(e) {
    // Allow only numbers, spaces, dashes, and parentheses
//    const normalized = e.target.value.replace(/[^\d\s\-()]/g, '');
    const normalized = normalizePhone(e.target.value);
    e.target.value = normalized;
  }

  handleEmailInput(e) {
    const normalized = normalizeEmail(e.target.value);
    e.target.value = normalized;
  }

  handlePhoneBlur(e) {
    const normalized = normalizePhone(e.target.value, true);
    e.target.value = normalized;
  }

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
      this.email.value = myData.account.email || '';
      this.phone.value = myData.account.phone || '';
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
      email: this.email.value.trim(),
      phone: this.phone.value.trim(),
      linkedin: this.linkedin.value.trim(),
      x: this.x.value.trim(),
    };

    // Save to myData.account
    myData.account = { ...myData.account, ...formData };

    showToast('Profile updated successfully', 2000, 'success');
    // disable the close button and submit button
    this.closeButton.disabled = true;
    this.submitButton.disabled = true;

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
  constructor() {}

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

    // Display elements
    this.totalStakeElement = document.getElementById('validator-total-stake');
    this.totalStakeUsdElement = document.getElementById('validator-total-stake-usd');
    this.userStakeLibElement = document.getElementById('validator-user-stake-lib');
    this.userStakeUsdElement = document.getElementById('validator-user-stake-usd');
    this.nomineeLabelElement = document.getElementById('validator-nominee-label');
    this.nomineeValueElement = document.getElementById('validator-nominee');

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
    // Ensure stake items are visible by default
    this.userStakeLibElement.style.display = 'flex';
    this.userStakeUsdElement.style.display = 'flex';
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

      const [userAccountData, networkAccountData] = await Promise.all([
        userAddress ? queryNetwork(`/account/${longAddress(userAddress)}`) : Promise.resolve(null), // Fetch User Data if available
        queryNetwork('/account/0000000000000000000000000000000000000000000000000000000000000000'), // Fetch Network Data
        walletScreen.updateWalletBalances(),
      ]);

      // Extract Raw Data (API values are now actual BigInt objects or other types)
      nominee = userAccountData?.account?.operatorAccountInfo?.nominee; // string
      const userStakedBaseUnits = userAccountData?.account?.operatorAccountInfo?.stake; // BigInt object

      const stakeRequiredUsd = networkAccountData?.account?.current?.stakeRequiredUsd; // BigInt object
      const stabilityScaleMul = networkAccountData?.account?.current?.stabilityScaleMul; // number
      const stabilityScaleDiv = networkAccountData?.account?.current?.stabilityScaleDiv; // number

      const marketPrice = await getMarketPrice(); // number or null

      // Calculate Derived Values
      let stabilityFactor = null;
      if (stabilityScaleMul != null && stabilityScaleDiv != null && Number(stabilityScaleDiv) !== 0) {
        stabilityFactor = Number(stabilityScaleMul) / Number(stabilityScaleDiv);
      }

      let stakeAmountLibBaseUnits = null; // This will be a BigInt object or null
      if (
        stakeRequiredUsd != null &&
        typeof stakeRequiredUsd === 'bigint' &&
        stabilityScaleMul != null &&
        typeof stabilityScaleMul === 'number' &&
        stabilityScaleDiv != null &&
        typeof stabilityScaleDiv === 'number' &&
        stabilityScaleDiv !== 0
      ) {
        try {
          // No need to parse stakeRequiredUsd from string, it's already a BigInt
          const scaleMulBigInt = BigInt(stabilityScaleMul);
          const scaleDivBigInt = BigInt(stabilityScaleDiv);
          if (scaleMulBigInt !== 0n) {
            stakeAmountLibBaseUnits = (stakeRequiredUsd * scaleDivBigInt) / scaleMulBigInt;
          } else {
            console.warn('Stability scale multiplier is zero, cannot calculate LIB stake amount.');
          }
        } catch (e) {
          console.error('Error calculating stakeAmountLibBaseUnits with BigInt:', e, {
            stabilityScaleMul,
            stabilityScaleDiv,
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
        this.nomineeLabelElement.textContent = 'No Nominated Validator';
        this.nomineeValueElement.textContent = ''; // Ensure value is empty
        this.userStakeLibElement.style.display = 'none'; // Hide LIB stake item
        this.userStakeUsdElement.style.display = 'none'; // Hide USD stake item
      } else {
        // Case: Nominee Exists

        // userStakedBaseUnits is a BigInt object or null/undefined. Pass its string representation.
        const displayUserStakedLib = userStakedBaseUnits != null ? big2str(userStakedBaseUnits, 18).slice(0, 6) : 'N/A';
        const displayUserStakedUsd = userStakedUsd != null ? '$' + userStakedUsd.toFixed(6) : 'N/A';

        this.nomineeLabelElement.textContent = 'Nominated Validator:';
        this.nomineeValueElement.textContent = nominee;
        this.userStakeLibElement.textContent = displayUserStakedLib;
        this.userStakeUsdElement.textContent = displayUserStakedUsd;
        // Ensure items are visible (using flex as defined in CSS) - redundant due to reset, but safe
        this.userStakeLibElement.style.display = 'flex';
        this.userStakeUsdElement.style.display = 'flex';
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
      // Set final state of unstake button based on whether a nominee was found
      this.unstakeButton.disabled = !nominee;

      if (currentPendingTx) {
        this.unstakeButton.disabled = true;
        this.stakeButton.disabled = true;
      }
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  async handleUnstake() {
    // Attempt to read nominee from the DOM element populated by openValidatorModal
    const nominee = this.nomineeValueElement.textContent.trim();

    // Check if we successfully retrieved a nominee address from the DOM
    if (!nominee || nominee.length < 10) {
      // Add a basic sanity check for length
      showToast('Could not find nominated validator.', 4000, 'error');
      console.warn('ValidatorStakingModal: Nominee not found or invalid in DOM element #validator-nominee.');
      return;
    }

    // Check if the validator is active
    const activityCheck = await this.checkValidatorActivity(nominee);
    if (activityCheck.isActive) {
      showToast('Cannot unstake from an active validator.', 5000, 'error');
      console.warn(`ValidatorStakingModal: Validator ${nominee} is active.`);
      return;
    } else if (activityCheck.error) {
      showToast(`Error checking validator status: ${activityCheck.error}`, 5000, 'error');
      return;
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
          memo: 'unstake',
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
      showToast('Unstake transaction failed. Network or server error.', 5000, 'error');
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
    this.amountWarning = document.getElementById('stakeAmountWarning');
    this.nodeAddressWarning = document.getElementById('stakeNodeAddressWarning');
    this.scanStakeQRButton = document.getElementById('scanStakeQRButton');
    this.uploadStakeQRButton = document.getElementById('uploadStakeQRButton');
    this.stakeQRFileInput = document.getElementById('stakeQrFileInput');

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

    // Add listener for opening the modal
    document.getElementById('openStakeModal').addEventListener('click', () => this.open());
  }

  open() {
    this.modal.classList.add('active');

    // Set the correct fill function for the staking context
    scanQRModal.fillFunction = this.fillFromQR.bind(this);

    // Display Available Balance
    const libAsset = myData.wallet.assets.find((asset) => asset.symbol === 'LIB');
    if (this.balanceDisplay && libAsset) {
      const formattedBalance = big2str(BigInt(libAsset.balance), 18).slice(0, -12);
      this.balanceDisplay.textContent = `Available: ${formattedBalance} ${libAsset.symbol}`;
    } else if (this.balanceDisplay) {
      this.balanceDisplay.textContent = 'Available: 0.000000 LIB';
    }

    // Check for nominee address from validator modal
    const nominee = document.getElementById('validator-nominee')?.textContent?.trim();
    const isNominee = !!nominee;

    // Set node address and UI state based on nominee
    this.nodeAddressInput.value = isNominee ? nominee : '';
    this.nodeAddressGroup.style.display = isNominee ? 'none' : 'block';
    this.submitButton.textContent = isNominee ? 'Add Stake' : 'Submit Stake';

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
    // TODO: clear input fields
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.submitButton.disabled = true;

    const nodeAddress = this.nodeAddressInput.value.trim();
    const amountStr = this.amountInput.value.trim();

    // Basic Validation
    if (!nodeAddress || !amountStr) {
      showToast('Please fill in all fields.', 3000, 'error');
      this.submitButton.disabled = false;
      return;
    }

    let amount_in_wei;
    try {
      amount_in_wei = bigxnum2big(wei, amountStr);
    } catch (error) {
      showToast('Invalid amount entered.', 3000, 'error');
      this.submitButton.disabled = false;
      return;
    }

    try {
      this.backButton.disabled = true;

      const response = await this.postStake(nodeAddress, amount_in_wei, myAccount.keys);
      console.log('Stake Response:', response);

      if (response && response.result && response.result.success) {
        myData.wallet.history.unshift({
          nominee: nodeAddress,
          amount: amount_in_wei,
          memo: 'stake',
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
      showToast('Stake transaction failed. See console for details.', 5000, 'error');
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

    // Check 1: Empty Fields
    if (!amountStr || !nodeAddress) {
      return;
    }

    // Check 1.5: Node Address Format (64 hex chars)
    const addressRegex = /^[0-9a-fA-F]{64}$/;
    if (!addressRegex.test(nodeAddress)) {
      this.nodeAddressWarning.textContent = 'Invalid node address format (must be 64 hex characters).';
      this.nodeAddressWarning.style.display = 'block';
      this.amountWarning.style.display = 'none';
      this.amountWarning.textContent = '';
      return;
    } else {
      this.nodeAddressWarning.style.display = 'none';
      this.nodeAddressWarning.textContent = '';
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
      this.amountWarning.textContent = `Amount must be at least ${minStakeFormatted} LIB.`;
      this.amountWarning.style.display = 'block';
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
  fillFromQR(data) {
    console.log('Filling stake address from QR data:', data);

    // Directly set the value of the stakeNodeAddress input field
    if (this.nodeAddressInput) {
      this.nodeAddressInput.value = data;
      this.nodeAddressInput.dispatchEvent(new Event('input'));
    } else {
      console.error('Stake node address input field not found!');
      showToast('Could not find stake address field.', 3000, 'error');
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
  }
}
const stakeValidatorModal = new StakeValidatorModal();

class ChatModal {
  constructor() {
    this.newestReceivedMessage = null;
    this.newestSentMessage = null;
    this.lastMessageCount = 0;

    // used by updateTollValue and updateTollRequired
    this.toll = null;
    this.tollUnit = null;
    this.address = null;
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
    this.modalAvatar = this.modal.querySelector('.modal-avatar');
    this.modalTitle = this.modal.querySelector('.modal-title');
    this.editButton = document.getElementById('chatEditButton');
    this.sendMoneyButton = document.getElementById('chatSendMoneyButton');
    this.retryOfTxId = document.getElementById('retryOfTxId');
    this.messageInput = document.querySelector('.message-input');
    this.chatSendMoneyButton = document.getElementById('chatSendMoneyButton');
    this.messageByteCounter = document.querySelector('.message-byte-counter');
    this.messagesContainer = document.querySelector('.messages-container');
    this.addFriendButtonChat = document.getElementById('addFriendButtonChat');

    // Add message click-to-copy handler
    this.messagesList.addEventListener('click', this.handleClickToCopy.bind(this));
    this.sendButton.addEventListener('click', this.handleSendMessage.bind(this));
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
    });

    // Add focus event listener for message input to handle scrolling
    this.messageInput.addEventListener('focus', function () {
      if (this.messagesContainer) {
        // Check if we're already at the bottom (within 50px threshold)
        const isAtBottom =
          this.messagesContainer.scrollHeight - this.messagesContainer.scrollTop - this.messagesContainer.clientHeight <= 50;
        if (isAtBottom) {
          // Wait for keyboard to appear and viewport to adjust
          setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
          }, 300); // Increased delay to ensure keyboard is fully shown
        }
      }
    });

    this.chatSendMoneyButton.addEventListener('click', () => {
      sendAssetFormModal.username = this.chatSendMoneyButton.dataset.username;
      sendAssetFormModal.open();
    });

    this.addFriendButtonChat.addEventListener('click', () => {
      if (!friendModal.getCurrentContactAddress()) return;
      friendModal.open();
    });
  }

  /**
   * Opens the chat modal for the given address.
   * @param {string} address - The address of the contact to open the chat modal for.
   * @returns {Promise<void>}
   */
  async open(address) {
    // clear message input
    this.messageInput.value = '';
    this.messageInput.style.height = '48px';
    this.messageByteCounter.style.display = 'none';

    friendModal.setAddress(address);
    footer.newChatButton.classList.remove('visible');
    const contact = myData.contacts[address];
    friendModal.updateFriendButton(contact, 'addFriendButtonChat');
    // Set user info
    this.modalTitle.textContent = getContactDisplayName(contact);

    walletScreen.updateWalletBalances();

    // update the toll value. Will not await this and it'll update the toll value while the modal is open.
    updateTollValue(address);

    // update local contact object with the toll required to send and receive
    updateTollRequired(address);

    // clear hidden txid input
    this.retryOfTxId.value = '';

    updateTollAmountUI(address);

    // Add data attributes to store the username and address
    this.sendMoneyButton.dataset.username = contact.username || address;

    generateIdenticon(contact.address, 40).then((identicon) => {
      this.modalAvatar.innerHTML = identicon;
    });

    // Clear previous messages from the UI
    this.messagesList.innerHTML = '';

    // Scroll to bottom (initial scroll for empty list, appendChatModal will scroll later)
    setTimeout(() => {
      this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
    }, 100);

    // Add click handler for username to show contact info
    // TODO: create event listener instead of onclick here
    const userInfo = this.modal.querySelector('.chat-user-info');
    userInfo.onclick = () => {
      const contact = myData.contacts[address];
      if (contact) {
        contactInfoModal.open(createDisplayInfo(contact));
      }
    };

    // Add click handler for edit button
    // TODO: create event listener instead of onclick here
    this.editButton.onclick = () => {
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

    // Setup state for appendChatModal and perform initial render
    this.address = address;
    this.appendChatModal(false); // Call appendChatModal to render messages, ensure highlight=false
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
    const needsToSendReadTx = this.needsToSend();
    console.log(`[close] needsToSendReadTx: ${needsToSendReadTx}`);
    // if newestRecevied message does not have an amount property and user has not responded, then send a read transaction
    if (needsToSendReadTx) {
      this.sendReadTransaction(this.address);
    }

    this.sendReclaimTollTransaction(this.address);

    // Save any unsaved draft before closing
    this.debouncedSaveDraft(this.messageInput.value);

    this.modal.classList.remove('active');
    if (chatsScreen.isActive()) {
      chatsScreen.updateChatList();
      footer.newChatButton.classList.add('visible');
    }
    if (contactsScreen.isActive()) {
      contactsScreen.updateContactsList();
      footer.newChatButton.classList.add('visible');
    }
    this.address = null;
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
    console.log(`[sendReclaimTollTransaction] entering function`);
    await getNetworkParams();
    const currentTime = getCorrectedTimestamp();
    const networkTollTimeoutInMs = parameters.current.tollTimeout; 
    const timeSinceNewestSentMessage = currentTime - this.newestSentMessage?.timestamp;
    if (!this.newestSentMessage || timeSinceNewestSentMessage < networkTollTimeoutInMs) {
      console.log(
        `[sendReclaimTollTransaction] timeSinceNewestSentMessage ${timeSinceNewestSentMessage}ms is less than networkTollTimeoutInMs ${networkTollTimeoutInMs}ms, skipping reclaim toll transaction`
      );
      return;
    }
    const canReclaimToll = await this.canSenderReclaimToll(contactAddress);
    if (!canReclaimToll) {
      console.log(
        `[sendReclaimTollTransaction] does not have a value not 0 in payOnReplay or payOnRead, skipping reclaim toll transaction`
      );
      return;
    }

    const tx = {
      type: 'reclaim_toll',
      from: longAddress(myData.account.keys.address),
      to: longAddress(contactAddress),
      chatId: hashBytes([longAddress(myData.account.keys.address), longAddress(contactAddress)].sort().join``),
      timestamp: getCorrectedTimestamp(),
      networkId: network.netid,
    };
    const txid = await signObj(tx, myAccount.keys);
    const response = await injectTx(tx, txid);
    if (!response || !response.result || !response.result.success) {
      console.warn('reclaim toll transaction failed to send', response);
    } else {
      console.log('reclaim toll transaction sent successfully');
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
    const chatId = hashBytes(sortedAddresses.join``);
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
    console.log(`[sendReadTransaction] entering function`);
    const contact = myData.contacts[contactAddress];

    console.log(`[sendReadTransaction] injecting read transaction`);
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
      chatId: hashBytes([longAddress(myData.account.keys.address), longAddress(contactAddress)].sort().join``),
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

    // if user is blocked, don't send message, show toast
    if (myData.contacts[this.address].tollRequiredToSend == 2) {
      showToast('You are blocked by this user', 0, 'error');
      this.sendButton.disabled = false;
      return;
    }

    try {
      this.messageInput.focus(); // Add focus back to keep keyboard open

      const message = this.messageInput.value.trim();
      if (!message) {
        this.sendButton.disabled = false;
        return;
      }

      const amount = this.tollRequiredToSend ? this.toll : 0n;
      const sufficientBalance = await validateBalance(amount);
      if (!sufficientBalance) {
        showToast('Insufficient balance for toll and fee', 0, 'error');
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

      ///yyy
      // Get recipient's public key from contacts
      let recipientPubKey = myData.contacts[currentAddress]?.public;
      let pqRecPubKey = myData.contacts[currentAddress]?.pqPublic;
      if (!recipientPubKey || !pqRecPubKey) {
        const recipientInfo = await queryNetwork(`/account/${longAddress(currentAddress)}`);
        if (!recipientInfo?.account?.publicKey) {
          console.log(`no public key found for recipient ${currentAddress}`);
          return;
        }
        recipientPubKey = recipientInfo.account.publicKey;
        myData.contacts[currentAddress].public = recipientPubKey;
        pqRecPubKey = recipientInfo.account.pqPublicKey;
        myData.contacts[currentAddress].pqPublic = pqRecPubKey;
      }

      // Generate shared secret using ECDH and take first 32 bytes
      let dhkey = ecSharedKey(keys.secret, recipientPubKey);
      const { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey);
      const combined = new Uint8Array(dhkey.length + sharedSecret.length);
      combined.set(dhkey);
      combined.set(sharedSecret, dhkey.length);
      dhkey = deriveDhKey(combined);

      // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
      // Encrypt message using shared secret
      const encMessage = encryptChacha(dhkey, message);

      // Create message payload
      const payload = {
        message: encMessage,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: bin2base64(cipherText),
        sent_timestamp: getCorrectedTimestamp(),
      };

      // Always include username, but only include other info if recipient is a friend
      const contact = myData.contacts[currentAddress];
      // Create basic sender info with just username
      const senderInfo = {
        username: myAccount.username,
      };

      // Add additional info only if recipient is a friend
      if (contact && contact?.friend && contact?.friend >= 3) {
        // Add more personal details for friends
        senderInfo.name = myData.account.name;
        senderInfo.email = myData.account.email;
        senderInfo.phone = myData.account.phone;
        senderInfo.linkedin = myData.account.linkedin;
        senderInfo.x = myData.account.x;
      }

      // Always encrypt and send senderInfo (which will contain at least the username)
      payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

      // can create a function to query the account and get the receivers toll they've set
      // TODO: will need to query network and receiver account where we validate
      // TODO: decided to query everytime we do chatModal.open and save as global variable. We don't need to clear it but we can clear it when closing the modal but should get reset when opening the modal again anyway
      let tollInLib =
        myData.contacts[currentAddress].tollRequiredToSend == 0 ? 0n : this.toll

      const chatMessageObj = await this.createChatMessage(currentAddress, payload, tollInLib, keys);
      const txid = await signObj(chatMessageObj, keys);

      // if there a hidden txid input, get the value to be used to delete that txid from relevant data stores
      const retryTxId = this.retryOfTxId.value;
      if (retryTxId) {
        removeFailedTx(retryTxId, currentAddress);
        this.retryOfTxId.value = '';
        failedMessageModal.handleFailedMessageData.txid = '';
        failedMessageModal.handleFailedMessageData.handleFailedMessage = '';
      }

      // --- Optimistic UI Update ---
      // Create new message object for local display immediately
      const newMessage = {
        message,
        timestamp: payload.sent_timestamp,
        sent_timestamp: payload.sent_timestamp,
        my: true,
        txid: txid,
        status: 'sent',
      };
      insertSorted(chatsData.contacts[currentAddress].messages, newMessage, 'timestamp');

      // Update or add to chats list, maintaining chronological order
      const chatUpdate = {
        address: currentAddress,
        timestamp: newMessage.sent_timestamp,
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

      // Call debounced save directly with empty string
      this.debouncedSaveDraft('');
      contact.draft = '';

      // Update the chat modal UI immediately
      this.appendChatModal(); // This should now display the 'sending' message

      // Scroll to bottom of chat modal
      this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
      // --- End Optimistic UI Update ---

      //console.log('payload is', payload)
      // Send the message transaction using createChatMessage with default toll of 1
      const response = await injectTx(chatMessageObj, txid);

      if (!response || !response.result || !response.result.success) {
        console.log('message failed to send', response);
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
        updateTransactionStatus(txid, currentAddress, 'failed', 'message');
        this.appendChatModal();

        // Remove from pending transactions as injectTx itself indicated failure
        /* if (myData && myData.pending) {
                    myData.pending = myData.pending.filter(pTx => pTx.txid !== txid);
                } */
      } else {
        // Message sent successfully (or at least accepted by gateway)
        // The optimistic UI update for 'sent' status is already handled before injectTx.
        // No specific action needed here for success as the UI already reflects 'sent'.
      }
    } catch (error) {
      console.error('Message error:', error);
      showToast('Failed to send message. Please try again.', 0, 'error');
    } finally {
      this.sendButton.disabled = false; // Re-enable the button
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
      chatId: hashBytes([fromAddr, toAddr].sort().join``),
      message: 'x',
      xmessage: payload,
      timestamp: getCorrectedTimestamp(),
      fee: parameters.current.transactionFee || 1n * wei, // This is not used by the backend
      networkId: network.netid,
    };
    return tx;
  }

  /**
   * Appends the chat modal to the DOM
   * @param {boolean} highlightNewMessage - Whether to highlight the newest message
   * @returns {void}
   */
  appendChatModal(highlightNewMessage = false) {
    const currentAddress = this.address; // Use a local constant
    console.log('appendChatModal running for address:', currentAddress, 'Highlight:', highlightNewMessage);
    if (!currentAddress) {
      return;
    }

    const contact = myData.contacts[currentAddress];
    if (!contact || !contact.messages) {
      console.log('No contact or messages found for address:', this.address);
      return;
    }
    const messages = contact.messages; // Already sorted descending

    if (!this.modal) return;
    if (!this.messagesList) return;

    // --- 1. Identify the actual newest received message data item ---
    // Since messages are sorted descending (newest first), the first item with my: false is the newest received.
    const newestReceivedItem = messages.find((item) => !item.my);
    console.log('appendChatModal: Identified newestReceivedItem data:', newestReceivedItem);
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
        messageHTML = `
                    <div class="message ${messageClass} payment-info" ${timestampAttribute} ${txidAttribute} ${statusAttribute}>
                        <div class="payment-header">
                            <span class="payment-direction">${directionText}</span>
                            <span class="payment-amount">${amountDisplay}</span>
                        </div>
                        ${itemMemo ? `<div class="payment-memo">${linkifyUrls(itemMemo)}</div>` : ''}
                        <div class="message-time">${timeString}</div>
                    </div>
                `;
      } else {
        // --- Render Chat Message ---
        const messageClass = item.my ? 'sent' : 'received'; // Use item.my directly
        messageHTML = `
                    <div class="message ${messageClass}" ${timestampAttribute} ${txidAttribute} ${statusAttribute}>
                        <div class="message-content" style="white-space: pre-wrap">${linkifyUrls(item.message)}</div>
                        <div class="message-time">${timeString}</div>
                    </div>
                `;
      }

      // 4. Append the constructed HTML
      // Insert at the end of the list to maintain correct chronological order
      this.messagesList.insertAdjacentHTML('beforeend', messageHTML);
      // The newest received element will be found after the loop completes
    }

    // --- 5. Find the corresponding DOM element after rendering ---
    // This happens inside the setTimeout to ensure elements are in the DOM

    // 6. Delayed Scrolling & Highlighting Logic (after loop)
    setTimeout(() => {
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
   * Invoked when the user clicks on a message to copy the content
   * It will copy the content to the clipboard
   * @param {Event} e - The event object
   * @returns {void}
   */
  async handleClickToCopy(e) {
    // Check if the click was on a link - if so, don't copy
    if (e.target.tagName === 'A' || e.target.closest('a')) {
      return;
    }
    
    const messageEl = e.target.closest('.message');
    if (!messageEl) return;

    // Prevent copying if the message has failed and not `payment-info`
    if (messageEl.dataset.status === 'failed') {
      console.log('Copy prevented for failed message.');

      // If the message is not a payment message, show the failed message modal
      if (!messageEl.classList.contains('payment-info')) {
        failedMessageModal.handleFailedMessageClick(messageEl);
      }

      // If the message is a payment message, show the failed history item modal
      if (messageEl.classList.contains('payment-info')) {
        failedTransactionModal.open(messageEl.dataset.txid, messageEl);
      }

      // TODO: if message is a payment open sendAssetFormModal and fill with information in the payment message?

      return;
    }

    let textToCopy = null;
    let contentType = 'Text'; // Default content type for toast

    // Check if it's a payment message
    if (messageEl.classList.contains('payment-info')) {
      const paymentMemoEl = messageEl.querySelector('.payment-memo');
      if (paymentMemoEl) {
        textToCopy = paymentMemoEl.textContent;
        contentType = 'Memo'; // Update type for toast
      } else {
        // No memo element found in this payment block
        showToast('No memo to copy', 2000, 'info');
        return;
      }
    } else {
      // It's a regular chat message
      const messageContentEl = messageEl.querySelector('.message-content');
      if (messageContentEl) {
        textToCopy = messageContentEl.textContent;
        contentType = 'Message'; // Update type for toast
      } else {
        // Should not happen for regular messages, but handle gracefully
        showToast('No content to copy', 2000, 'info');
        return;
      }
    }

    // Proceed with copying if text was found
    if (textToCopy && textToCopy.trim()) {
      try {
        await navigator.clipboard.writeText(textToCopy.trim());
        showToast(`${contentType} copied to clipboard`, 2000, 'success');
      } catch (err) {
        console.error('Failed to copy:', err);
        showToast(`Failed to copy ${contentType.toLowerCase()}`, 2000, 'error');
      }
    } else if (contentType === 'Memo') {
      // Explicitly handle the case where memo exists but is empty/whitespace
      showToast('Memo is empty', 2000, 'info');
    }
    // No need for an else here, cases with no element are handled above
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
      console.log('DEBUG: Refreshing transaction history modal due to transaction failure.');
      historyModal.refresh();
    }
    // 2. Refresh Chat Modal if active AND the failed txid's message is currently rendered
    if (this.isActive() && txid && messagesList) {
      // Check if an element with the specific data-txid exists within the message list
      const messageElement = messagesList.querySelector(`[data-txid="${txid}"]`);

      if (messageElement) {
        // If the element exists, the failed message is visible in the open chat. Refresh the modal.
        console.log(`DEBUG: Refreshing active chat modal because failed txid ${txid} was found in the view.`);
        this.appendChatModal(); // This will redraw the messages based on the updated data (where the failed tx is removed)
      } else {
        // The failed txid doesn't correspond to a visible message in the *currently open* chat modal. No UI refresh needed for the modal itself.
        console.log(
          `DEBUG: Skipping chat modal refresh. Failed txid ${txid} not found in the active modal's message list.`
        );
      }
    }
    // 3. Refresh Chat List if active
    if (chatsScreen.isActive()) {
      console.log('DEBUG: Refreshing chat list view due to transaction failure.');
      chatsScreen.updateChatList();
    }
    // No other active view to refresh in this context
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
    }
  }

  /**
   * Loads a draft message for the current contact if one exists
   */
  loadDraft(address) {
    // Always clear the input first
    this.messageInput.value = '';
    this.messageInput.style.height = '48px';

    // Load draft if exists
    const contact = myData.contacts[address];
    if (contact?.draft) {
      this.messageInput.value = contact.draft;
      // Trigger resize
      this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
      // trigger input event to update the byte counter
      this.messageInput.dispatchEvent(new Event('input'));
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
        this.sendButton.disabled = false;
      }
      this.messageByteCounter.style.display = 'block';
    } else {
      this.messageByteCounter.style.display = 'none';
      this.sendButton.disabled = false;
    }
  }
}

const chatModal = new ChatModal();

/**
 * Failed Message Modal Class
 * @class
 * @description Handles the failed message modal
 * @returns {void}
 */
class FailedMessageModal {
  constructor() {
    this.handleFailedMessageData = {
      handleFailedMessage: '',
      txid: '',
    };
  }

  /**
   * Loads the failed message modal event listeners
   * @returns {void}
   */
  load() {
    this.modal = document.getElementById('failedMessageModal');
    this.retryButton = this.modal.querySelector('.retry-button');
    this.deleteButton = this.modal.querySelector('.delete-button');
    this.closeButton = document.getElementById('closeFailedMessageModal');

    this.retryButton.addEventListener('click', this.handleFailedMessageRetry.bind(this));
    this.deleteButton.addEventListener('click', this.handleFailedMessageDelete.bind(this));
    this.closeButton.addEventListener('click', this.closeFailedMessageModalAndClearState.bind(this));
    this.modal.addEventListener('click', this.handleFailedMessageBackdropClick.bind(this));
  }

  /**
   * When user clicks on a failed message this will show the failed message modal with retry, delete (delete from all data stores), and close buttons
   * It will also store the message content and txid in the handleSendMessage object containing the handleFailedMessage and txid properties
   * @param {Element} messageEl - The message element that failed
   * @returns {void}
   */
  handleFailedMessageClick(messageEl) {
    // Get the message content and txid from the original failed message element
    const messageContent = messageEl.querySelector('.message-content').textContent;
    const originalTxid = messageEl.dataset.txid;

    // Store content and txid in properties of handleSendMessage
    this.handleFailedMessageData.handleFailedMessage = messageContent;
    this.handleFailedMessageData.txid = originalTxid;

    // Show the modal
    if (this.modal) {
      this.modal.classList.add('active');
    }
  }

  /**
   * When the user clicks the retry button in the failed message modal
   * It will fill the chat modal with the message content and txid of the failed message and focus the message input
   * @returns {void}
   */
  handleFailedMessageRetry() {
    // Use the values stored when handleFailedMessage was called
    const messageToRetry = this.handleFailedMessageData.handleFailedMessage;
    const originalTxid = this.handleFailedMessageData.txid;

    if (
      chatModal.messageInput &&
      chatModal.retryOfTxId &&
      typeof messageToRetry === 'string' &&
      typeof originalTxid === 'string'
    ) {
      chatModal.messageInput.value = messageToRetry;
      chatModal.retryOfTxId.value = originalTxid;

      this.closeFailedMessageModalAndClearState();
      chatModal.messageInput.focus();
    } else {
      console.error('Error preparing message retry: Necessary elements or data missing.');
      this.closeFailedMessageModalAndClearState();
    }
  }

  /**
   * When the user clicks the delete button in the failed message modal
   * It will delete the message from all data stores using removeFailedTx and remove pending tx if exists
   * @returns {void}
   */
  handleFailedMessageDelete() {
    const originalTxid = this.handleFailedMessageData.txid;

    if (typeof originalTxid === 'string' && originalTxid) {
      const currentAddress = chatModal.address;
      removeFailedTx(originalTxid, currentAddress);

      this.closeFailedMessageModalAndClearState();

      // refresh current chatModal
      chatModal.appendChatModal();
    } else {
      console.error('Error deleting message: TXID not found.');
      this.closeFailedMessageModalAndClearState();
    }
  }

  /**
   * Invoked when the user clicks the close button in the failed message modal
   * It will close the modal and clear the stored values
   * @returns {void}
   */
  closeFailedMessageModalAndClearState() {
    this.modal.classList.remove('active');
    // Clear the stored values when modal is closed
    this.handleFailedMessageData.handleFailedMessage = '';
    this.handleFailedMessageData.txid = '';
  }

  /**
   * Invoked when the user clicks the backdrop in the failed message modal
   * It will close the modal and clear the stored values
   * @param {Event} event - The event object
   * @returns {void}
   */
  handleFailedMessageBackdropClick(event) {
    if (event.target === this.modal) {
      this.closeFailedMessageModalAndClearState();
    }
  }
}

const failedMessageModal = new FailedMessageModal();

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
  }

  /**
   * Invoked when the user clicks the new chat button
   * It will open the new chat modal
   * @returns {void}
   */
  openNewChatModal() {
    this.modal.classList.add('active');
    footer.newChatButton.classList.remove('visible');
    this.usernameAvailable.style.display = 'none';
    this.submitButton.disabled = true;

    // Create the handler function
    const focusHandler = () => {
      this.recipientInput.focus();
      this.modal.removeEventListener('transitionend', focusHandler);
    };

    // Add the event listener
    // TODO: move focusHandler out and move event listener to load()
    this.modal.addEventListener('transitionend', focusHandler);
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
      footer.newChatButton.classList.add('visible');
    }
    if (contactsScreen.isActive()) {
      footer.newChatButton.classList.add('visible');
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
        console.log('Error looking up username:', error);
        this.showRecipientError('Error looking up username');
        return;
      }
    }

    // Get or create chat data
    const chatsData = myData;

    // Check if contact exists
    if (!chatsData.contacts[recipientAddress]) {
      createNewContact(recipientAddress, username, 2);
      // default to 2 (Acquaintance) so recipient does not need to pay toll
      friendModal.postUpdateTollRequired(recipientAddress, 2);
    }
    chatsData.contacts[recipientAddress].username = username;

    // Close new chat modal and open chat modal
    this.closeNewChatModal();
    chatModal.open(recipientAddress);
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

    // Setup event listeners
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.usernameInput.addEventListener('input', (e) => this.handleUsernameInput(e));
    this.toggleButton.addEventListener('change', () => this.handleTogglePrivateKeyInput());
    this.backButton.addEventListener('click', () => this.close());

    // Add listener for the password visibility toggle
    this.togglePrivateKeyVisibility.addEventListener('click', () => {
      // Toggle the type attribute
      const type = this.privateKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
      this.privateKeyInput.setAttribute('type', type);
      // Toggle the visual state class on the button
      this.togglePrivateKeyVisibility.classList.toggle('toggled-visible');
    });

    this.migrateAccountsButton.addEventListener('click', async () => await migrateAccountsModal.open());
  }

  open() {
    const accounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const networkId = parameters.networkId; // Use consistent casing

    // Add safety check for usernames existence
    const mismatchedNetids = Object.keys(accounts.netids).filter(netid => 
      netid !== networkId && 
      accounts.netids[netid].usernames && 
      Object.keys(accounts.netids[netid].usernames).length > 0
    );

    if (mismatchedNetids.length > 0) {
      this.migrateAccountsSection.style.display = 'block';
    } else {
      this.migrateAccountsSection.style.display = 'none';
    }

    this.modal.classList.add('active');
    enterFullscreen();
  }

  close() {
    this.modal.classList.remove('active');
  }

  openWithReset() {
    // Clear form fields
    this.usernameInput.value = '';
    this.privateKeyInput.value = '';
    this.usernameAvailable.style.display = 'none';
    this.privateKeyError.style.display = 'none';
    
    // Open the modal
    this.open();
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
    // Disable input fields, back button, and toggle button
    this.toggleButton.disabled = true;
    this.usernameInput.disabled = true;
    this.privateKeyInput.disabled = true;
    this.backButton.disabled = true;

    event.preventDefault();
    const username = normalizeUsername(this.usernameInput.value);

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
        console.log(`Checking network for existing account at address: ${accountCheckAddress}`);
        const accountInfo = await queryNetwork(`/account/${accountCheckAddress}`);

        // Check if the query returned data indicating an account exists.
        // This assumes a non-null `accountInfo` with an `account` property means it exists.
        if (accountInfo && accountInfo.account) {
          console.log('Account already exists for this private key:', accountInfo);
          this.privateKeyError.textContent = 'An account already exists for this private key.';
          this.privateKeyError.style.color = '#dc3545';
          this.privateKeyError.style.display = 'inline';
          // Re-enable controls when account already exists
          this.reEnableControls();
          return; // Stop the account creation process
        } else {
          console.log('No existing account found for this private key.');
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

    // Create new account entry
    myAccount = {
      netid,
      username,
      chatTimestamp: 0,
      keys: {
        address: addressHex,
        public: publicKeyHex,
        secret: privateKeyHex,
        type: 'secp256k1',
        pqSeed: pqSeed, // store only the 64 byte seed instead of 32,000 byte public and secret keys
      },
    };
    let waitingToastId = showToast('Creating account...', 0, 'loading');
    let res;

    try {
      await getNetworkParams();
      const storedKey = `${username}_${netid}`;
      myData = loadState(storedKey)
      if (myData) {
        myAccount = myData.account;
      } else {
        // create new data record if it doesn't exist
        myData = newDataRecord(myAccount);
      }
      res = await postRegisterAlias(username, myAccount.keys);
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

        signInModal.open(username);
      } catch (error) {
        if (waitingToastId) hideToast(waitingToastId);
        console.log(`DEBUG: handleCreateAccount error`, JSON.stringify(error, null, 2));
        showToast(`account creation failed: ${error}`, 0, 'error');
        this.reEnableControls();

        // Clear interval
        if (checkPendingTransactionsIntervalId) {
          clearInterval(checkPendingTransactionsIntervalId);
          checkPendingTransactionsIntervalId = null;
        }

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
    await chatsScreen.updateChatList();
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
    const mainIsUSD = tollUnit === 'USD';
    const mainValue = parseFloat(big2str(toll, decimals));
    // Conversion factor (USD/LIB)
    const scaleMul = parameters.current.stabilityScaleMul || 1;
    const scaleDiv = parameters.current.stabilityScaleDiv || 1;
    const factor = scaleDiv !== 0 ? scaleMul / scaleDiv : 1;
    let mainString, otherString;
    if (mainIsUSD) {
      toll = bigxnum2big(toll, (1.0 / factor).toString());
      mainString = mainValue.toFixed(6) + ' USD';
      const libValue = mainValue / factor;
      otherString = libValue.toFixed(6) + ' LIB';
    } else {
      mainString = mainValue.toFixed(6) + ' LIB';
      const usdValue = mainValue * factor;
      otherString = usdValue.toFixed(6) + ' USD';
    }
    let display;
    if (this.tollInfo.required == 1) {
      display = `${mainString} = ${otherString}`;
      if (this.memoInput.value.trim() == '') {
        display = '';
      }
    } else if (this.tollInfo.required == 2) {
      this.tollMemoSpan.style.color = 'red';
      display = `blocked`;
    } else {
      // light green used to show success
      this.tollMemoSpan.style.color = '#28a745';
      display = `free; ${mainString} = ${otherString}`;
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

    await getNetworkParams();
    const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;

    // get `usdAmount` and `libAmount`
    let usdAmount;
    let libAmount;
    const isLib = this.balanceSymbol.textContent === 'LIB';
    if (!isLib) {
      usdAmount = this.amountInput.value;
      libAmount = amount / scalabilityFactor;
    } else {
      usdAmount = amount * scalabilityFactor;
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
    const feeInWei = parameters.current.transactionFee || 1n * wei;
    const maxAmount = BigInt(asset.balance) - feeInWei;
    const maxAmountStr = big2str(maxAmount > 0n ? maxAmount : 0n, 18).slice(0, -16);

    // Check if we're in USD mode
    const isUSD = this.balanceSymbol.textContent === 'USD';

    if (isUSD) {
      const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
      // Convert to USD before displaying
      this.amountInput.value = (parseFloat(maxAmountStr) * scalabilityFactor).toString();
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
    const txFeeInLIB = parameters.current.transactionFee || 1n * wei;
    const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;

    // Preserve the current toggle state (LIB/USD) instead of overwriting it
    const currentSymbol = this.balanceSymbol.textContent;
    const isCurrentlyUSD = currentSymbol === 'USD';

    // Only set to asset symbol if it's empty (initial state)
    if (!currentSymbol) {
      this.balanceSymbol.textContent = asset.symbol;
    }

    const balanceInLIB = big2str(BigInt(asset.balance), 18).slice(0, -12);
    const feeInLIB = big2str(txFeeInLIB, 18).slice(0, -16);

    this.updateBalanceAndFeeDisplay(balanceInLIB, feeInLIB, isCurrentlyUSD, scalabilityFactor);
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
      const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
      amountForValidation = parseFloat(amount) / scalabilityFactor;
    }

    // convert amount to bigint
    const amountBigInt = bigxnum2big(wei, amountForValidation.toString());

    // returns false if the amount/balance is invalid.
    const isAmountAndBalanceValid = await validateBalance(amountBigInt, assetIndex, this.balanceWarning);

    let isAmountAndTollValid = true;
    if (this.foundAddressObject.address) {
      if (this.amountInput.value.trim() != '') {
        isAmountAndTollValid = this.validateToll(amountBigInt);
        console.log('ismountAndTollValid ' + isAmountAndTollValid);
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
        console.log('checking if toll > amount');
        const scaleMul = parameters.current.stabilityScaleMul || 1;
        const scaleDiv = parameters.current.stabilityScaleDiv || 1;
        const factor = scaleDiv !== 0 ? scaleMul / scaleDiv : 1;
        let amountInLIB = amount;
        let tollInLIB = this.tollInfo.toll;
        if (this.tollInfo.tollUnit !== 'LIB') {
          tollInLIB = bigxnum2big(this.tollInfo.toll, (1.0 / factor).toString());
        }
        console.log(
          `toll > amount  ${big2str(tollInLIB, 8)} > ${big2str(amountInLIB, 8)} : ${tollInLIB > amountInLIB}`
        );
        if (tollInLIB > amountInLIB) {
          this.balanceWarning.textContent = 'Amount is less than toll for memo.';
          this.balanceWarning.style.display = 'block';
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
    e.preventDefault();
    this.balanceSymbol.textContent = this.balanceSymbol.textContent === 'LIB' ? 'USD' : 'LIB';

    // check the context value of the button to determine if it's LIB or USD
    const isLib = this.balanceSymbol.textContent === 'LIB';

    // get the scalability factor for LIB/USD conversion
    await getNetworkParams();
    const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;

    // Get the raw values in LIB format
    const asset = myData.wallet.assets[this.assetSelectDropdown.value];
    const txFeeInWei = parameters.current.transactionFee || 1n * wei;
    const balanceInLIB = big2str(BigInt(asset.balance), 18).slice(0, -12);
    const feeInLIB = big2str(txFeeInWei, 18).slice(0, -16);

    // if isLib is false, convert the sendAmount to USD
    if (!isLib) {
      this.amountInput.value = this.amountInput.value * scalabilityFactor;
    } else {
      this.amountInput.value = this.amountInput.value / scalabilityFactor;
    }

    this.updateBalanceAndFeeDisplay(balanceInLIB, feeInLIB, !isLib, scalabilityFactor);
  }

  /**
   * Updates the display of balance and fee amounts with appropriate formatting
   * @param {string} balanceInLIB - The balance amount in LIB
   * @param {string} feeInLIB - The fee amount in LIB
   * @param {boolean} isUSD - Whether to display in USD format
   * @param {number} scalabilityFactor - The factor to convert between LIB and USD
   */
  updateBalanceAndFeeDisplay(balanceInLIB, feeInLIB, isUSD, scalabilityFactor) {
    if (isUSD) {
      this.balanceAmount.textContent = '$' + (parseFloat(balanceInLIB) * scalabilityFactor).toPrecision(6);
      this.transactionFee.textContent = '$' + (parseFloat(feeInLIB) * scalabilityFactor).toPrecision(2);
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
          showToast('Error processing image', 3000, 'error');
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
              showToast('Internal error handling QR data', 3000, 'error');
            }
          } else {
            // qr.decodeQR might throw an error instead of returning null/undefined
            // This else block might not be reached if errors are always thrown
            console.error('No QR code found in image (qr.js)');
            showToast('No QR code found in image', 3000, 'error');
            // Clear the form fields in case of failure to find QR code
            targetModal.resetForm();
          }
        } catch (error) {
          console.error('Error processing QR code image with qr.js:', error);
          // Assume error means no QR code found or decoding failed
          showToast('Could not read QR code from image', 3000, 'error');
          // Clear the form fields in case of error
          targetModal.resetForm();

        } finally {
          event.target.value = ''; // Reset the file input value regardless of outcome
        }
      };
      img.onerror = function () {
        console.error('Error loading image');
        showToast('Error loading image file', 3000, 'error');
        event.target.value = ''; // Reset the file input value
        // Clear the form fields in case of image loading error
        targetModal.resetForm();
      };
      img.src = e.target.result;
    };

    reader.onerror = function () {
      console.error('Error reading file');
      showToast('Error reading file', 3000, 'error');
      event.target.value = ''; // Reset the file input value
    };

    reader.readAsDataURL(file);
  }

  /**
   * Fills the payment form from QR code data
   * @param {string} data - The QR code data to fill the form with
   * @returns {void}
   * */
  fillFromQR(data) {
    console.log('Attempting to fill payment form from QR:', data);

    // Explicitly check for the required prefix
    if (!data || !data.startsWith('liberdus://')) {
      console.error("Invalid payment QR code format. Missing 'liberdus://' prefix.", data);
      showToast('Invalid payment QR code format.', 3000, 'error');
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

      console.log('Read payment data:', JSON.stringify(paymentData, null, 2));

      if (paymentData.u) {
        this.usernameInput.value = paymentData.u;
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
      showToast('Failed to parse payment QR data.', 3000, 'error');
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
      showToast('You cannot send assets to yourself', 3000, 'error');
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
      const txFeeInLIB = parameters.current.transactionFee || 1n * wei;
      const balance = BigInt(wallet.assets[assetIndex].balance);
      const amountStr = big2str(amount, 18).slice(0, -16);
      const feeStr = big2str(txFeeInLIB, 18).slice(0, -16);
      const balanceStr = big2str(balance, 18).slice(0, -16);
      showToast(`Insufficient balance: ${amountStr} + ${feeStr} (fee) > ${balanceStr} LIB`, 0, 'error');
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

    // Get recipient's public key from contacts
    let recipientPubKey = myData.contacts[toAddress]?.public;
    let pqRecPubKey = myData.contacts[toAddress]?.pqPublic;
    let pqEncSharedKey = '';
    if (!recipientPubKey || !pqRecPubKey) {
      const recipientInfo = await queryNetwork(`/account/${longAddress(toAddress)}`);
      if (!recipientInfo?.account?.publicKey) {
        console.log(`no public key found for recipient ${toAddress}`);
        cancelButton.disabled = false;
        return;
      }
      if (recipientInfo.account.publicKey) {
        recipientPubKey = recipientInfo.account.publicKey;
        myData.contacts[toAddress].public = recipientPubKey;
      }
      if (recipientInfo.account.pqPublicKey) {
        pqRecPubKey = recipientInfo.account.pqPublicKey;
        myData.contacts[toAddress].pqPublic = pqRecPubKey;
      }
    }
    let dhkey = '';
    let sharedKeyMethod = 'none';
    if (recipientPubKey) {
      dhkey = ecSharedKey(keys.secret, recipientPubKey);
      sharedKeyMethod = 'ec';
      if (pqRecPubKey) {
        // Generate shared secret using ECDH and take first 32 bytes
        const { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey);
        const combined = new Uint8Array(dhkey.length + sharedSecret.length);
        combined.set(dhkey);
        combined.set(sharedSecret, dhkey.length);
        dhkey = deriveDhKey(combined);
        pqEncSharedKey = bin2base64(cipherText);
        sharedKeyMethod = 'pq';
      }
    }

    let encMemo = '';
    if (memo && sharedKeyMethod !== 'none') {
      // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
      // Encrypt message using shared secret
      encMemo = encryptChacha(dhkey, memo);
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

    // only include the sender info if the recipient is is a friend and has a pqKey
    let encSenderInfo = '';
    let senderInfo = '';
    if (pqRecPubKey && myData.contacts[toAddress]?.friend === 3) {
      // Create sender info object
      senderInfo = {
        username: myAccount.username,
        name: myData.account.name,
        email: myData.account.email,
        phone: myData.account.phone,
        linkedin: myData.account.linkedin,
        x: myData.account.x,
      };
    } else if (recipientPubKey) {
      senderInfo = {
        username: myAccount.username,
      };
    } else {
      senderInfo = { username: myAccount.address };
    }
    if (sharedKeyMethod !== 'none') {
      encSenderInfo = encryptChacha(dhkey, stringify(senderInfo));
    } else {
      encSenderInfo = stringify(senderInfo);
    }
    // Create message payload
    const payload = {
      message: encMemo, // we need to call this field message, so we can use decryptMessage()
      senderInfo: encSenderInfo,
      encrypted: true,
      encryptionMethod: 'xchacha20poly1305',
      pqEncSharedKey: pqEncSharedKey,
      sharedKeyMethod: sharedKeyMethod,
      sent_timestamp: getCorrectedTimestamp(),
    };

    try {
      console.log('payload is', payload);
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

    // Create debounced function
    this.debouncedUpdateQRCode = debounce(() => this.updateQRCode(), 300);

    // Modal close
    document.getElementById('closeReceiveModal').addEventListener('click', () => this.close());
    
    // Copy address
    this.copyButton.addEventListener('click', () => this.copyAddress());
    
    // QR code updates
    this.assetSelect.addEventListener('change', () => this.updateQRCode());
    this.amountInput.addEventListener('input', () => this.amountInput.value = normalizeUnsignedFloat(this.amountInput.value));
    this.amountInput.addEventListener('input', this.debouncedUpdateQRCode);
    this.memoInput.addEventListener('input', this.debouncedUpdateQRCode);
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
      console.log(`Populated ${walletData.assets.length} assets in dropdown`);
    } else {
      // Add a default option if no assets
      const option = document.createElement('option');
      option.value = 0;
      option.textContent = 'Liberdus (LIB)';
      this.assetSelect.appendChild(option);
      console.log('No wallet assets found, using default');
    }

    // Clear input fields
    this.amountInput.value = '';
    this.memoInput.value = '';

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
    this.displayAddress.textContent = '0x' + address;

    // Generate QR code with payment data
    try {
      this.updateQRCode();
      console.log('QR code updated with payment data');
    } catch (error) {
      console.error('Error updating QR code:', error);

      // Fallback to basic address QR code if there's an error
      new QRCode(this.qrcodeContainer, {
        text: '0x' + address,
        width: 200,
        height: 200,
      });
      console.log('Fallback to basic address QR code');
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
          console.log(`Selected asset: ${asset.name} (${symbol})`);
        } else {
          console.log(`Asset not found at index ${assetIndex}, using defaults`);
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
      console.log('Created payment data:', JSON.stringify(paymentData, null, 2));

      // Convert to JSON and encode as base64
      const jsonData = JSON.stringify(paymentData);
      const base64Data = bin2base64(utf82bin(jsonData));

      // Create URI with liberdus:// prefix
      const qrText = `liberdus://${base64Data}`;
      console.log('QR code text length:', qrText.length);
      console.log('QR code text (first 100 chars):', qrText.substring(0, 100) + (qrText.length > 100 ? '...' : ''));

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

        console.log('Fallback QR code generated with username URI');
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

  async copyAddress() {
    const address = this.displayAddress.textContent;
    try {
      await navigator.clipboard.writeText(address);
      this.copyButton.classList.add('success');
      setTimeout(() => {
        this.copyButton.classList.remove('success');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
    console.log('open', txid);
  
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
  
    console.log(`this.address: ${this.address}`);
    console.log(`this.memo: ${this.memo}`);
    console.log(`this.txid: ${this.txid}`);
    //console.log(`open.assetID: ${open.assetID}`)
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
        myData.contacts[this.address]?.senderInfo?.username || this.address || '';
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
  constructor() {}

  load() {
    this.modal = document.getElementById('bridgeModal');
    this.closeButton = document.getElementById('closeBridgeModal');
    this.bridgeToPolygonButton = document.getElementById('bridgeToPolygon');
    this.bridgeFromPolygonButton = document.getElementById('bridgeFromPolygon');

    this.closeButton.addEventListener('click', () => this.close());
    this.bridgeFromPolygonButton.addEventListener('click', () => {window.open('./bridge', '_blank');});
    this.bridgeToPolygonButton.addEventListener('click', () => this.openSendAssetModalToBridge());
  }

  open() {
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  openSendAssetModalToBridge() {
    this.close();
    sendAssetFormModal.open();
    sendAssetFormModal.usernameInput.value = BRIDGE_USERNAME;
    sendAssetFormModal.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
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
    this.submitButton = this.form.querySelector('button[type="submit"]');

    this.closeButton.addEventListener('click', () => this.close());
    this.form.addEventListener('submit', (event) => this.handleSubmit(event));

    // if no check boxes are checked, disable the submit button
    this.form.addEventListener('change', () => {
      this.submitButton.disabled = this.form.querySelectorAll('input[type="checkbox"]:checked').length === 0;
    });
  }

  async open() {
    console.log('open migrate accounts modal');
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
   * Populate the account select with checkboxes for each account in accounts.netids[mismatchedNetid].usernames
   * @returns {void}
   */
  async populateAccounts() {
    console.log('populate accounts');
    // an array of objects with { username, netid }
    const mismatchedAccounts = await this.migratableAccounts();

    // Clear existing options
    this.accountList.innerHTML = '';

    if (mismatchedAccounts.length === 0) {
      this.accountList.innerHTML = '<p>No accounts need migration</p>';
      return;
    }

    // For each in the array, create a checkbox and label with username_netid
    mismatchedAccounts.forEach(account => {
      console.log('account', account);
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.value = account.username;
      checkbox.netid = account.netid;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(account.username + '_' + account.netid.slice(0, 6)));
      this.accountList.appendChild(label);
    });
  }

  /**
   * Returns an array of migratable accounts from localStorage.
   * Each object has { username, netid } for accounts that can be migrated to the current network.
   * Rules:
   *  - Only accounts from netids different from the current network (parameters.networkId or network.netid)
   *  - If the username+address is already present on this network, skip
   *  - If the username is not available to us on this network (checkUsernameAvailability !== 'mine'), skip
   */
  async migratableAccounts() {
    // Get all accounts from localStorage
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    // Determine the current network id (prefer parameters.networkId, fallback to network.netid)
    const currentNetId = parameters?.networkId;
    if (!accountsObj.netids || !currentNetId) return [];

    const migratable = [];
    const currentNetUsernames = (accountsObj.netids[currentNetId] && accountsObj.netids[currentNetId].usernames) || {};

    // Loop through all netids except the current one
    for (const netid in accountsObj.netids) {
      if (netid === currentNetId) continue;
      const usernamesObj = accountsObj.netids[netid]?.usernames;
      if (!usernamesObj) continue;
      for (const username in usernamesObj) {
        const address = usernamesObj[username].address;
        // If username+address is already present on this network, skip
        if (
          currentNetUsernames[username] &&
          normalizeAddress(currentNetUsernames[username].address) === normalizeAddress(address)
        ) {
          continue;
        }
        // Check if the username is available to us on this network
        // (If not, skip)
        // Note: checkUsernameAvailability returns 'mine' if available to us
        // We must await this as it may be async
        const result = await checkUsernameAvailability(username, address);
        if (result !== 'mine') continue;
        migratable.push({ username, netid });
      }
    }
    return migratable;
  }

  async handleSubmit(event) {
    event.preventDefault();
    console.log('handleSubmit');
    const selectedAccounts = this.accountList.querySelectorAll('input[type="checkbox"]:checked');
    console.log('selectedAccounts', selectedAccounts);
    // remove from accounts.netids[netid].usernames[username]
    selectedAccounts.forEach(account => {
      const netid = account.netid;
      const username = account.value;

      // then perform netid substitution in all files in the app
      // get the file content
      let fileContent = localStorage.getItem(username + '_' + netid);
      if (fileContent) {
        // if fileContent doesnt include { then we need to decrypt it
        if (lockModal?.encKey) {
          console.log('decrypting fileContent');
          fileContent = decryptData(fileContent, lockModal.encKey, true);
        }

        if (!fileContent) {
          console.log('fileContent is empty, skipping');
          return;
        }

        // perform netid substitution in the file content
        let substitutionResult = restoreAccountModal.performStringSubstitution(fileContent, {
          oldString: netid,
          newString: parameters.networkId
        });
        // if lockModal.encKey is set, encrypt the substitutionResult
        if (lockModal?.encKey) {
          substitutionResult = encryptData(substitutionResult, lockModal.encKey, true);
        }
        // save the file content to localStorage
        localStorage.setItem(username + '_' + parameters.networkId, substitutionResult);
        // remove the file from localStorage
        localStorage.removeItem(username + '_' + netid);

        // update the accounts registry
        this.updateAccountsRegistry(username, netid, parameters.networkId);
      }
    });

    // show toast for success 2 seconds
    showToast('Accounts migrated successfully', 2000, 'success');

    // sleep for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // reload the page
    window.location.reload();
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
    console.log(`Updated accounts registry for ${username}: removed from ${oldNetid}, added to ${newNetid}`);
  }

  clearForm() {
    const checkboxes = this.accountList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    this.submitButton.disabled = true;
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
  }

  load() {
    this.modal = document.getElementById('lockModal');
    this.openButton = document.getElementById('openLockModal');
    this.headerCloseButton = document.getElementById('closeLockModal');
    this.lockForm = document.getElementById('lockForm');
    this.oldPasswordInput = this.modal.querySelector('#oldPassword');
    this.oldPasswordLabel = this.modal.querySelector('#oldPasswordLabel');
    this.newPasswordInput = this.modal.querySelector('#newPassword');
    this.confirmNewPasswordInput = this.modal.querySelector('#confirmNewPassword');
    this.lockButton = this.modal.querySelector('.update-button');

    this.openButton.addEventListener('click', () => this.open());
    this.headerCloseButton.addEventListener('click', () => this.close());
    this.lockForm.addEventListener('submit', (event) => this.handleSubmit(event));
    // dynamic button state
    this.newPasswordInput.addEventListener('input', () => debounce(this.updateButtonState(), 250));
    this.confirmNewPasswordInput.addEventListener('input', () => debounce(this.updateButtonState(), 250));
    this.oldPasswordInput.addEventListener('input', () => debounce(this.updateButtonState(), 250));
    this.passwordWarning = this.modal.querySelector('#passwordWarning');
  }

  open() {
    // if localStorage.lock exists, then show the old password input
    if (localStorage?.lock) {
      this.oldPasswordInput.style.display = 'block';
      this.oldPasswordLabel.style.display = 'block';
      this.newPasswordInput.placeholder = 'Leave blank to remove password';
    } else {
      this.oldPasswordInput.style.display = 'none';
      this.oldPasswordLabel.style.display = 'none';
      this.newPasswordInput.placeholder = '';
      this.lockButton.textContent = 'Save Password';
    }

    // disable the button
    this.lockButton.disabled = true;

    this.clearInputs();

    // show the modal
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  async handleSubmit(event) {
    // disable the button
    this.lockButton.disabled = true;

    // loading toast
    let waitingToastId = showToast('Updating password...', 0, 'loading');
    
    event.preventDefault();
    
    const newPassword = this.newPasswordInput.value;
    const confirmNewPassword = this.confirmNewPasswordInput.value;
    const oldPassword = this.oldPasswordInput.value;

    // if old password is visible, check if it is correct
    if (this.oldPasswordInput.style.display !== 'none') {
      // check if old password is empty
      if (oldPassword.length === 0) {
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
    if (newPassword.length === 0) {
      await encryptAllAccounts(oldPassword, newPassword)
      delete localStorage.lock;
      this.encKey = null;
      // remove the loading toast
      if (waitingToastId) hideToast(waitingToastId);
      showToast('Password removed', 2000, 'success');
      this.close();
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast('Passwords do not match. Please try again.', 0, 'error');
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
    const isOldPasswordVisible = this.oldPasswordInput.style.display !== 'none';
    const isClearPasswordMode = isOldPasswordVisible && oldPassword.length > 0 && newPassword.length === 0;
    
    let isValid = false;
    
    if (isClearPasswordMode) {
      // In clear password mode, only old password needs to be filled
      isValid = true;
      this.lockButton.textContent = 'Remove Password';
      
      // Set placeholder based on confirm password state
      if (confirmPassword.length > 0) {
        this.newPasswordInput.placeholder = '';
      } else {
        this.newPasswordInput.placeholder = 'Leave blank to remove password';
      }
    } else {
      // Regular password set/update mode
      isValid = newPassword.length > 0 && confirmPassword.length > 0;
      
      // If old password field is visible, it must be filled
      if (isOldPasswordVisible) {
        isValid = isValid && oldPassword.length > 0;
      }
      this.lockButton.textContent = 'Save Password';
      this.newPasswordInput.placeholder = '';
    }
    
    // Validate password requirements and set appropriate warnings
    let warningMessage = '';
    
    if (!isClearPasswordMode) {
      // Check if password is at least 4 characters
      if (newPassword.length > 0 && newPassword.length < 4) {
        isValid = false;
        warningMessage = 'Password must be at least 4 characters.';
      }
      // Check if passwords match
      else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        isValid = false;
        warningMessage = 'Password confirmation does not match.';
      }
      // Check if new password is same as old password
      else if (newPassword && oldPassword && newPassword === oldPassword) {
        isValid = false;
        warningMessage = 'New password cannot be the same as the old password.';
      }
    }
    
    // Update button state and warnings
    this.lockButton.disabled = !isValid;
    
    if (warningMessage) {
      this.passwordWarning.textContent = warningMessage;
      this.passwordWarning.style.display = 'block';
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
    this.unlockButton = this.modal.querySelector('.update-button');

    this.closeButton.addEventListener('click', () => this.close());
    this.unlockForm.addEventListener('submit', (event) => this.handleSubmit(event));
    this.passwordInput.addEventListener('input', () => this.updateButtonState());
  }

  open() {
    this.modal.classList.add('active');
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
      if (this.openButtonElementUsed === welcomeScreen.createAccountButton) {
        createAccountModal.openWithReset();
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

/**
 * Remove failed transaction from the contacts messages, pending, and wallet history
 * @param {string} txid - The transaction ID to remove
 * @param {string} currentAddress - The address of the current contact
 */
function removeFailedTx(txid, currentAddress) {
  console.log(`DEBUG: Removing failed/timed-out txid ${txid} from all stores`);

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

/**
 * Check pending transactions that are at least 5 seconds old
 * @returns {Promise<void>}
 */
async function checkPendingTransactions() {
  if (!myData || !myAccount) {
    console.log('DEBUG: user is not logged in');
    return;
  }

  // initialize the pending array if it is not already initialized
  if (!myData.pending) {
    myData.pending = [];
  }

  if (myData.pending.length === 0) return; // No pending transactions to check

  console.log(`checking pending transactions (${myData.pending.length})`);
  const now = getCorrectedTimestamp();
  const eightSecondsAgo = now - 8000;
  const twentySecondsAgo = now - 20000;
  const thirtySecondsAgo = now - 30000;
  // Process each transaction in reverse to safely remove items
  for (let i = myData.pending.length - 1; i >= 0; i--) {
    const pendingTxInfo = myData.pending[i];
    const { txid, type, submittedts } = pendingTxInfo;

    if (submittedts < eightSecondsAgo) {
      console.log(`DEBUG: txid ${txid} is older than 8 seconds, checking receipt`);

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
          } else {
            console.log(`DEBUG: txid ${txid} not found in wallet history`);
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
          console.log(`Toll transaction successfully processed!`);
        }

        if (type === 'update_toll_required') {
          console.log(`DEBUG: update_toll_required transaction successfully processed!`);
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
            tollModal.editMyDataToll(tollModal.oldToll);
            // check if the toll modal is open
            if (tollModal.isActive()) {
              // change the tollAmountLIB and tollAmountUSD to the old value
              tollModal.tollAmountLIB = tollModal.oldToll;
              tollModal.tollAmountUSD = tollModal.oldToll;
            }
          } else if (type === 'update_toll_required') {
            showToast(`Update contact status failed: ${failureReason}. Reverting contact to old status.`, 0, 'error');
            // revert the local myData.contacts[toAddress].friend to the old value
            myData.contacts[pendingTxInfo.to].friend = pendingTxInfo.friend;
          } else if (type === 'read') {
            showToast(`Read transaction failed: ${failureReason}`, 0, 'error');
            // revert the local myData.contacts[toAddress].timestamp to the old value
            myData.contacts[pendingTxInfo.to].timestamp = pendingTxInfo.oldContactTimestamp;
          } else if (type === 'reclaim_toll') {
            showToast(`Reclaim toll failed: ${failureReason}`, 0, 'error');
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
      console.log(`DEBUG: resolving txid ${txid} with data ${data}`);
      const promiseControls = pendingPromises.get(txid);
      promiseControls.resolve(data);
      pendingPromises.delete(txid);
    }
  }

  function reject(txid, error) {
    if (pendingPromises.has(txid)) {
      console.log(`DEBUG: rejecting txid ${txid} with error ${error}`);
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
  console.log('DEBUG: ignoring shift+tab key');
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

  console.log(`getNetworkParams: Data for account ${NETWORK_ACCOUNT_ID} is stale or missing. Attempting to fetch...`);
  try {
    const fetchedData = await queryNetwork(`/account/${NETWORK_ACCOUNT_ID}`);

    if (fetchedData !== undefined && fetchedData !== null) {
      parameters = fetchedData.account;
      getNetworkParams.timestamp = now;
      // if network id from network.js is not the same as the parameters.current.networkId
      if (network.netid !== parameters.networkId) {
        // treat as offline
        netIdMismatch = true;
        updateUIForConnectivity();
        console.error(`getNetworkParams: Network ID mismatch. Network ID from network.js: ${network.netid}, Network ID from parameters: ${parameters.networkId}`);
        console.log(parameters)
        // show toast notification with the error message
        showToast(`Network ID mismatch. Check network configuration in network.js.`, 0, 'error');
      }
      return;
    } else {
      console.warn(
        `getNetworkParams: Received null or undefined data from queryNetwork for account ${NETWORK_ACCOUNT_ID}. Cached data (if any) will remain unchanged.`
      );
    }
  } catch (error) {
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
    console.log('getSystemNotice skipped: Not online');
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

    const timestamp = parseInt(lines[0]);
    if (isNaN(timestamp)) {
      console.warn('Invalid timestamp in notice file');
      return;
    }

    // Check if we need to show the notice
    if (!myData.settings.noticets || myData.settings.noticets < timestamp) {
      // Join remaining lines for the notice message
      const noticeMessage = lines.slice(1).join('\n').trim();
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
  return csi;
}

function longPoll() {
  if (!isOnline) {
    console.log('Poll skipped: Not online');
    return;
  }

  const myAccount = myData?.account;
  // Skip if no valid account
  if (!myAccount?.keys?.address) {
    console.log('Poll skipped: No valid account');
    return;
  }

  try {
    longPoll.start = getCorrectedTimestamp();
    const timestamp = myAccount.chatTimestamp || 0;

    // call this with a promise that'll resolve with callback longPollResult function with the data
    const longPollPromise = queryNetwork(`/collector/api/poll?account=${longAddress(myAccount.keys.address)}&chatTimestamp=${timestamp}`);
    console.log(`longPoll started with account=${longAddress(myAccount.keys.address)} chatTimestamp=${timestamp}`);
    // if there's an issue, reject the promise
    longPollPromise.catch(error => {
      console.error('Chat polling error:', error);
      // reject the promise
      longPollPromise.reject(error);
    });

    // if the promise is resolved, call the longPollResult function with the data
    longPollPromise.then(data => longPollResult(data));
  } catch (error) {
    console.error('Chat polling error:', error);
  }
}
longPoll.start = 0;

async function longPollResult(data) {
  console.log('longpoll data', data)
  // calculate the time since the last poll
  let nextPoll = 4000 - (getCorrectedTimestamp() - longPoll.start)
  if (nextPoll < 0) {
    nextPoll = 0;
  }
  // schedule the next poll
  setTimeout(longPoll, nextPoll + 1000);
  if (data?.success){
    try {
      const gotChats = await chatsScreen.updateChatData();
      if (gotChats > 0) {
        await chatsScreen.updateChatList();
      }
    } catch (error) {
      console.error('Chat polling error:', error);
    }
  }
}

function getContactDisplayName(contact) {
  return contact?.name || 
         contact?.username || 
         `${contact?.address?.slice(0, 8)}...${contact?.address?.slice(-6)}`;
}

function isMobile() {
  return /Android|webOS|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function enterFullscreen() {
  if (isMobile()) {
  console.log('in enterFullscreen');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } 
  }
}