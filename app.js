// Check if there is a newer version and load that using a new random url to avoid cache hits
//   Versions should be YYYY.MM.DD.HH.mm like 2025.01.25.10.05
const version = 't'; // Also increment this when you increment version.html
let myVersion = '0';
async function checkVersion() {
  myVersion = localStorage.getItem('version') || '0';
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
    showToast('Version check failed. Your Internet connection may be down.', 0, 'error', false, 'version-check-failed');
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
    alert('Updating to new version: ' + newVersion + ' ' + version);
    localStorage.setItem('version', newVersion); // Save new version
    const newUrl = window.location.href.split('?')[0];

    logsModal.log(`Updated to version: ${newVersion}`)
    await forceReload([
      newUrl,
      'styles.css',
      'app.js',
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

let checkPendingTransactionsIntervalId = null;
let getSystemNoticeIntervalId = null;
//let checkConnectivityIntervalId = null;

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
    return 'available';
  } catch (error) {
    console.log('Error checking username:', error);
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
      toll: parameters?.current?.defaultToll || 1n * wei,
      tollUnit: parameters?.current?.defaultTollUnit || 'LIB',
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

// Load saved account data and update chat list on page load
document.addEventListener('DOMContentLoaded', async () => {
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

  // Settings Modal
  settingsModal.load();

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

  // Voice Recording Modal
  voiceRecordingModal.load();

  // Call Invite Modal
  callInviteModal.load();

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
  console.log('in handleVisibilityChange', document.visibilityState);

  if (document.visibilityState === 'hidden') {
    reactNativeApp.handleNativeAppSubscribe();
    // if chatModal was opened, save the last message count
    if (chatModal.isActive() && chatModal.address) {
      const contact = myData.contacts[chatModal.address];
      chatModal.lastMessageCount = contact?.messages?.length || 0;
    }
    // save state when app is put into background
    saveState();
  } else if (document.visibilityState === 'visible') {
    if (myAccount) {
      reactNativeApp.handleNativeAppUnsubscribe();
    }
    // if chatModal was opened, check if message count changed while hidden
    if (chatModal.isActive() && chatModal.address) {
      const contact = myData.contacts[chatModal.address];
      const currentCount = contact?.messages?.length || 0;
      if (currentCount !== chatModal.lastMessageCount) {
        chatModal.appendChatModal(true);
      }
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

function loadState(account, noparse=false){
  let data = localStorage.getItem(account);
  if (!data) { return null; }
  if (localStorage.lock && lockModal.encKey) {
    data = decryptData(data, lockModal.encKey, true)
  }
  if (noparse) return data;
  return parse(data);
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
  }

  open() {
    this.screen.style.display = 'flex';
    // Show the navigation bar on the native app
    reactNativeApp.sendNavigationBarVisibility(true);
  }

  close() {
    this.screen.style.display = 'none';
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
    this.launchButton = document.getElementById('welcomeOpenLaunch');
    this.lockButton = document.getElementById('welcomeOpenLockModal');
    this.updateButton = document.getElementById('welcomeOpenUpdate');
    

    this.backupButton.addEventListener('click', () => backupAccountModal.open());
    this.restoreButton.addEventListener('click', () => restoreAccountModal.open());
    this.removeButton.addEventListener('click', () => removeAccountsModal.open());
    this.migrateButton.addEventListener('click', () => migrateAccountsModal.open());
    this.lockButton.addEventListener('click', () => lockModal.open());

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
    this.logoLink = this.header.querySelector('.logo-link');
    this.menuButton = document.getElementById('toggleMenu');
    this.settingsButton = document.getElementById('toggleSettings');

    this.logoLink.addEventListener('keydown', ignoreShiftTabKey); // add event listener for first-item to prevent shift+tab
    this.menuButton.addEventListener('click', () => menuModal.open());
    this.settingsButton.addEventListener('click', () => settingsModal.open());
    
    // Add click event for username display to open myInfoModal
    this.text.addEventListener('click', () => {
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
        appName.textContent = `${myAccount.username}`;
      } else {
        appName.textContent = '';
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
        showToast(`Failed to switch to ${view} view`, 0, 'error', false, `switch-view-failed-${view}`);
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
  updateChatList() {
    const chatList = this.chatList;
    const contacts = myData.contacts;
    const chats = myData.chats;
    if (chats.length === 0) {
      chatList.querySelector('.empty-state').style.display = 'block';
      return;
    }

    console.log('chats.length', JSON.stringify(chats.length));

    // Clear existing chat items before adding new ones
    chatList.innerHTML = '';

    const chatElements =
      chats.map((chat) => {
        const identicon = generateIdenticon(chat.address);
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
            previewHTML += ` <span class="memo-preview"> | ${truncateMessage(escapeHtml(latestActivity.message), 50)}</span>`;
          }
        } else if (latestActivity.type === 'call') {
          previewHTML = `<span><i>Join call</i></span>`;
        } else if (latestActivity.type === 'vm') {
          previewHTML = `<span><i>Voice message</i></span>`;
        } else if ((!latestActivity.message || String(latestActivity.message).trim() === '') && latestActivity.xattach) {
          previewHTML = `<span><i>Attachment</i></span>`;
        } else if (latestActivity.xattach && latestActivity.message && String(latestActivity.message).trim() !== '') {
          previewHTML = `<span><i>Attachment</i></span> <span class="memo-preview"> | ${truncateMessage(escapeHtml(latestActivity.message), 40)}</span>`;
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
      this.contactsList.querySelector('.empty-state').style.display = 'block';
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
      const identicon = generateIdenticon(contact.address);
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
      this.assetsList.querySelector('.empty-state').style.display = 'block';
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
          console.log('balance', data);
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
      showToast(`Error fetching balance. Try again later.`, 0, 'error', false, 'balance-fetch-error');
      console.error('Failed to get balance for some addresses');
    }

    // Update total wallet balance
    myData.wallet.networth = totalWalletNetworth;
    myData.wallet.timestamp = now;
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
    this.inviteButton = document.getElementById('openInvite');
    this.inviteButton.addEventListener('click', () => inviteModal.open());
    this.explorerButton = document.getElementById('openExplorer');
    this.explorerButton.addEventListener('click', () => {window.open('./explorer', '_blank');});
    this.networkButton = document.getElementById('openMonitor');
    this.networkButton.addEventListener('click', () => {window.open('./network', '_blank');});
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
    
    
    // Show launch button if ReactNativeWebView is available
    if (window?.ReactNativeWebView) {
      this.launchButton = document.getElementById('openLaunchUrl');
      this.launchButton.addEventListener('click', () => launchModal.open());
      this.launchButton.style.display = 'block';
    }
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
    reactNativeApp.sendClearNotifications();
    await checkVersion();

    // checkVersion() may update online status
    if (isOnline) {
      const newUrl = window.location.href.split('?')[0];
      window.location.replace(newUrl);
    }
  }
}

const menuModal = new MenuModal();

class SettingsModal {
  constructor() { }

  load() {
    this.modal = document.getElementById('settingsModal');
    this.closeButton = document.getElementById('closeSettings');
    this.closeButton.addEventListener('click', () => this.close());
    
    this.callsButton = document.getElementById('openCallsModal');
    this.callsButton.addEventListener('click', () => callsModal.open());
    
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
    
    this.signOutButton = document.getElementById('handleSignOutSettings');
    this.signOutButton.addEventListener('click', async () => await menuModal.handleSignOut());
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
}

const settingsModal = new SettingsModal();

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
  c.friendOld = friendStatus;
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
          console.log('QR Code detected:', decodedText);
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
    console.log('Raw QR Data Scanned');
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

    // Get the notified addresses and sort usernames to prioritize them
    const notifiedAddresses = reactNativeApp ? reactNativeApp.getNotificationAddresses() : [];
    const notifiedAddressSet = new Set(Array.isArray(notifiedAddresses) ? notifiedAddresses : []);
    let sortedUsernames = [...usernames];
    const notifiedUsernameSet = new Set();
    
    // if there are notified addresses, partition the usernames (stable) so notified come first
    if (notifiedAddresses.length > 0) {
      const notifiedUsernames = [];
      const otherUsernames = [];
      for (const username of sortedUsernames) {
        const address = netidAccounts?.usernames?.[username]?.address;
        const isNotified = Boolean(address && notifiedAddressSet.has(address));
        if (isNotified) {
          notifiedUsernames.push(username);
          notifiedUsernameSet.add(username);
        } else {
          otherUsernames.push(username);
        }
      }
      sortedUsernames = [...notifiedUsernames, ...otherUsernames];
    }

    // Populate select with sorted usernames and add an emoji to the username if it owns a notified address
    this.usernameSelect.innerHTML = `
      <option value="" disabled selected hidden>Select an account</option>
      ${sortedUsernames.map((username) => {
        const isNotifiedAccount = notifiedUsernameSet.has(username);
        const dotIndicator = isNotifiedAccount ? ' 🔔' : '';
        return `<option value="${username}">${username}${dotIndicator}</option>`;
      }).join('')}
    `;

    // Restore the previously selected username if it exists
    if (selectedUsername && usernames.includes(selectedUsername)) {
      this.usernameSelect.value = selectedUsername;
    }

    return { usernames, netidAccounts, sortedUsernames };
  }

  async open(preselectedUsername_) {
    this.preselectedUsername = preselectedUsername_;

    // First show the modal so we can properly close it if needed
    this.modal.classList.add('active');

    // Update username select and get usernames
    const { usernames } = this.updateUsernameSelect();

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
    }, 100);
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
      console.log('Account data not found');
      return;
    }
    myAccount = myData.account;
    logsModal.log(`SignIn as ${username}_${netid}`)

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

    reactNativeApp.handleNativeAppUnsubscribe();
    reactNativeApp.sendNavigationBarVisibility(false);

    // Close modal and proceed to app
    this.close();
    welcomeScreen.close();
    
    // Clear notification address only if signing into account that owns the notification address and only remove that account from the array 
    if (reactNativeApp) {
      const notifiedAddresses = reactNativeApp.getNotificationAddresses();
      if (notifiedAddresses.length > 0) {
        // remove address if it's in the array
        reactNativeApp.clearNotificationAddress(myAccount.keys.address);
      }
    }
    
    // Log storage information after successful sign-in
    try {
      const storageInfo = localStorageMonitor.getStorageInfo();
      logsModal.log(`💾 Storage Status: ${storageInfo.usageMB}MB used, ${storageInfo.availableMB}MB available (${storageInfo.percentageUsed}% used)`);
    } catch (error) {
      logsModal.log('⚠️ Could not retrieve storage information');
    }
    
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
    this.subtitleDiv = this.avatarSection.querySelector('.subtitle');

    this.backButton.addEventListener('click', () => this.close());
    this.editButton.addEventListener('click', () => myProfileModal.open());
  }

  async updateMyInfo() {
    if (!myAccount) return;

    const identicon = generateIdenticon(myAccount.keys.address, 96);

    this.avatarDiv.innerHTML = identicon;
    this.nameDiv.textContent = myAccount.username;
    this.subtitleDiv.textContent = myAccount.keys.address;

    const { account = {} } = myData ?? {};
    const fields = {
      name:      { id: 'myInfoName',      label: 'Name' },
      email:     { id: 'myInfoEmail',     label: 'Email',    href: v => `mailto:${v}` },
      phone:     { id: 'myInfoPhone',     label: 'Phone' },
      linkedin:  { id: 'myInfoLinkedin',  label: 'LinkedIn', href: v => `https://linkedin.com/in/${v}` },
      x:         { id: 'myInfoX',         label: 'X',        href: v => `https://x.com/${v}` },
    };

    // Cache DOM elements once
    const elements = Object.fromEntries(
      Object.values(fields).map(({ id }) => [id, document.getElementById(id)])
    );

    for (const [key, cfg] of Object.entries(fields)) {
      const el = elements[cfg.id];
      if (!el) continue; // skip if element not found
      const container =
        key === 'email' || key === 'linkedin' || key === 'x'
          ? el.parentElement.parentElement // label + anchor live two levels up
          : el.parentElement;

      const val = account[key] ?? ''; // empty string if undefined / null
      const empty = !val;

      // Show / hide container with inline style (per your constraint)
      container.style.display = empty ? 'none' : 'block';
      if (empty) continue;

      el.textContent = val;
      if (cfg.href) el.href = cfg.href(val);
    }
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
}

// Create a singleton instance
const myInfoModal = new MyInfoModal();

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
    const identicon = generateIdenticon(displayInfo.address, 96);

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
    this.lastChangeTimeStamp = 0; // track the last time the friend status was changed
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

    // Initialize submit button state
    this.updateSubmitButtonState();

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
    const chatId_ = hashBytes([fromAddr, toAddr].sort().join(''));
    console.log('DEBUG 1:chatId_', chatId_);

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
   * 0 = blocked, 1 = Other, 2 = Acquaintance, 3 = Friend
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async handleFriendSubmit(event) {
    event.preventDefault();
    this.submitButton.disabled = true;
    const contact = myData.contacts[this.currentContactAddress];
    const selectedStatus = this.friendForm.querySelector('input[name="friendStatus"]:checked')?.value;

    if (selectedStatus == null || Number(selectedStatus) === contact.friend) {
      this.submitButton.disabled = true;
      console.log('No change in friend status or no status selected.');
      return;
    }

    if ([2,3].includes(contact.friend) && [2,3].includes(Number(selectedStatus))){
      console.log('no need to post a change to the network since toll required would be 0 for both cases')
    }
    else{
      try {
        // send transaction to update chat toll
        const res = await this.postUpdateTollRequired(this.currentContactAddress, Number(selectedStatus));
        if (res?.result?.success !== true) {
          console.log(
            `[handleFriendSubmit] update_toll_required transaction failed: ${res?.result?.reason}. Did not update contact status.`
          );
          showToast('Failed to update friend status. Please try again.', 0, 'error', false, 'update-friend-status-failed');
          return;
        }
      } catch (error) {
        console.error('Error sending transaction to update chat toll:', error);
        showToast('Failed to update friend status. Please try again.', 0, 'error', false, 'update-friend-status-failed');
        return;
      }
    }
    // store the old friend status
    contact.friendOld = contact.friend;

    // Update friend status based on selected value
    contact.friend = Number(selectedStatus);

    this.lastChangeTimeStamp = Date.now();

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

    // Update the friend button
    this.updateFriendButton(contact, 'addFriendButtonContactInfo');
    this.updateFriendButton(contact, 'addFriendButtonChat');

    // Update the contact list
    await contactsScreen.updateContactsList();

    // Close the friend modal
    this.closeFriendModal();
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
    button.classList.remove('status-0', 'status-1', 'status-2', 'status-3');
    // Add the current status class
    button.classList.add(`status-${contact.friend}`);
  }

  // Update the submit button's enabled state based on current and selected status
  updateSubmitButtonState() {
    const contact = myData?.contacts?.[this.currentContactAddress];
    if (!contact) {
      this.submitButton.disabled = true;
      return;
    }

    // If there's already a pending tx (friend != friendOld) keep disabled
    if (contact.friend !== contact.friendOld) {
      const SIXTY_SECONDS = 60 * 1000;
      // if the last change was more than 60 seconds ago, reset the friend status so user does not get stuck
      if (this.lastChangeTimeStamp < (Date.now - SIXTY_SECONDS)) {
        contact.friend = contact.friendOld
      } else {
        this.submitButton.disabled = true;
        showToast('You have a pending transaction to update the friend status. Come back to this page later.', 0, 'error', false, 'pending-friend-status-tx');
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
    if (providedName === 'Not provided' || !providedName || providedName.trim() === '') {
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
      console.log(`Not opening chatModal for failed transaction`);
      
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
  }

  /**
   * Closes the calls modal
   * @returns {void}
   */
  close() {
    this.clockTimer.stop();
    this.modal.classList.remove('active');
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
      showToast(`Call scheduled for ${chatModal.formatLocalDateTime(callGroup.callTime)}`, 2500, 'info', false, `call-scheduled-${callGroup.callTime}`);
      return;
    }
    if (!callGroup.callUrl) {
      showToast('Call link not found', 0, 'error', false, 'call-link-not-found');
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

    groupCallParticipantsModal.open(callGroup, li);
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
      
      fragment.appendChild(li);
    });
    // remove previous items and append new items
    if (existingItems.length) existingItems.forEach((el) => el.remove());
    list.appendChild(fragment);
  }
}

const callsModal = new CallsModal();

class GroupCallParticipantsModal {
  constructor() {
    this.modal = null;
    this.participantsList = null;
    this.closeButton = null;
    this.currentCallGroup = null;
    this.currentListItem = null;
    this._onParticipantClick = this._onParticipantClick.bind(this);
    this._onJoinClick = this._onJoinClick.bind(this);
    this._onCancel = this._onCancel.bind(this);
  }

  load() {
    this.modal = document.getElementById('groupCallParticipantsModal');
    if (!this.modal) return;
    this.participantsList = document.getElementById('groupCallParticipantsList');
    this.closeButton = document.getElementById('closeGroupCallParticipantsModal');

    [this.participantsList, this.closeButton]
      .forEach((el, i) => {
        if (el) el.addEventListener('click', [this._onParticipantClick, this._onJoinClick, this._onCancel, this._onCancel][i]);
      });
  }

  open(callGroup, listItem) {
    this.currentCallGroup = callGroup;
    this.currentListItem = listItem;
    
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

  _onParticipantClick(e) {
    const participantItem = e.target.closest('.participant-item');
    if (!participantItem) return;
    
    const address = participantItem.getAttribute('data-address');
    if (address) {
      // Directly open the chat modal for the selected participant
      chatModal.open(address);
      this.close();
    }
  }

  _onJoinClick() {
    // Directly call the join function from callsModal
    if (this.currentListItem) {
      callsModal.handleJoinClick(this.currentListItem);
    }
    this.close();
  }

  _onCancel() {
    this.close();
  }

  close() {
    this.modal?.classList.remove('active');
    this.currentCallGroup = null;
    this.currentListItem = null;
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
    showToast('queryNetwork: not online', 0, 'error', false, 'network-not-online')
    //alert('not online')
    return null;
  }
  const selectedGateway = getGatewayForRequest();
  if (!selectedGateway) {
    console.error('No gateway available for network query');
    showToast('queryNetwork: no gateway', 0, 'error', false, 'network-no-gateway')
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
    showToast(`queryNetwork: error: ${error}`, 0, 'error')
    return null;
  }
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
  let timestamp = myAccount.chatTimestamp || 0;
  //    const timestamp = myData.contacts[keys.address]?.messages?.at(-1).timestamp || 0

  if (timestamp > longPollResult.timestamp){ timestamp = longPollResult.timestamp }

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
        if (mine) console.warn('txid in processChats is', txidHex)
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
          const payload = tx.xmessage; // changed to use .message
          if (useTxTimestamp){ 
            payload.sent_timestamp = tx.timestamp;
          }
          if (mine){
            console.warn('my message tx', tx)
          }
          else if (payload.encrypted) {
            await ensureContactKeys(from);
            if (!myData.contacts[from]?.public) {
              console.log(`no public key found for sender ${sender}`);
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
                  
                  if (messageToDelete) {
                    // Only allow deletion if the sender of this delete tx is the same who sent the original message
                    // (normalize addresses for comparison)
                    const originalSender = normalizeAddress(tx.from);
                    
                    if (!messageToDelete.my && originalSender === from) {
                      // This is a message received from sender, who is now deleting it - valid
                      console.log(`Deleting message ${txidToDelete} as requested by sender`);
                      
                      // Mark the message as deleted
                      messageToDelete.deleted = 1;
                      messageToDelete.message = "Deleted by sender";
                      
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
                      console.log(`Deleting our message ${txidToDelete} as requested by us`);
                      
                      // Mark the message as deleted
                      messageToDelete.deleted = 1;
                      messageToDelete.message = "Deleted for all";
                      
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
                    
                    if (chatModal.isActive() && chatModal.address === from) {
                      chatModal.appendChatModal();
                    }
                    // Don't process this message further - it's just a control message
                    continue;
                  }
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
                  if (reactNativeApp.isReactNativeWebView) {
                    // If callTime is greater than the current time, send it to the native app
                    if (payload.callTime && payload.callTime > Date.now()) {
                      reactNativeApp.sendScheduledCall(contact.username, payload.callTime)
                    }
                  }
                } else if (parsedMessage.type === 'vm') {
                  // Voice message format processing
                  payload.message = ''; // Voice messages don't have text
                  payload.url = parsedMessage.url;
                  payload.duration = parsedMessage.duration;
                  payload.type = 'vm';
                } else if (parsedMessage.type === 'message') {
                  // Regular message format processing
                  payload.message = parsedMessage.message;
                  
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
          const payload = tx.xmemo;
          if (useTxTimestamp){ 
            payload.sent_timestamp = tx.timestamp;
          }
          if (mine) {
            const txx = parse(stringify(tx))
            console.warn('my transfer tx', txx)
          }
          else if (payload.encrypted) {
            await ensureContactKeys(from);
            if (!myData.contacts[from]?.public) {
              console.log(`no public key found for sender ${sender}`);
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
        if (!inActiveChatWithSender) {
          if (!chatsScreen.isActive()) {
            footer.chatButton.classList.add('has-notification');
          }
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
          if (!chatsScreen.isActive()) {
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
        pendingTxData.to = normalizeAddress(tx.to);
      } else if (tx.type === 'read') {
        pendingTxData.oldContactTimestamp = tx.oldContactTimestamp;
      } else if (tx.type === 'message' || tx.type === 'transfer') {
        pendingTxData.to = normalizeAddress(tx.to);
      } else if (tx.type === 'deposit_stake' || tx.type === 'withdraw_stake') {
        pendingTxData.to = tx.nominee; // Store 64-character address as-is for stake transactions
      }
      myData.pending.push(pendingTxData);
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
console.warn('tx is', txo)
  txo = parse(txo)
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

      contact.messages.forEach((message) => {
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
      const identicon = generateIdenticon(result.contactAddress);

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
      const identicon = generateIdenticon(contact.address);

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
    username: contact.username || contact.address.slice(0, 8) + '…' + contact.address.slice(-6),
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
function showToast(message, duration = 2000, type = 'default', isHTML = false, deduplicateKey = null) {
  const toastContainer = document.getElementById('toastContainer');
  
  // Check for duplicate toasts if deduplicateKey is provided
  if (deduplicateKey) {
    const existingToast = document.querySelector(`[data-deduplicate-key="${deduplicateKey}"]`);
    if (existingToast) {
      // Toast with this key already exists, don't create another one
      return existingToast.id;
    }
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
  
  // Add deduplication key if provided
  if (deduplicateKey) {
    toast.setAttribute('data-deduplicate-key', deduplicateKey);
  }

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
    } else if (duration <= 0) {
      // Sticky non-error toast (e.g., info) with close button
      toast.style.pointerEvents = 'auto';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close-btn';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '&times;';
      toast.appendChild(closeBtn);

      toast.onclick = () => {
        hideToast(toastId);
      };
    } else {
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
    await getNetworkParams();
    if (!isOnline) return;
    console.log('Just came back online.');
    // We just came back online
    updateUIForConnectivity();
    showToast("You're back online!", 3000, 'online');
    // Force update data with reconnection handling
    if (myAccount && myAccount.keys) {
      // restart long polling
      if (useLongPolling) {
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
    '#toggleBalance',

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
    '#faucetButton',

    // tollModal
    '#saveNewTollButton',

    //inviteModal
    '#inviteForm button[type="submit"]',

    //unstakeModal
    '#submitUnstake',

    // Call schedule modals
    '#callScheduleNowBtn',
    '#openCallScheduleDateBtn',
    '#confirmCallSchedule',

    // Message context menu (disable all except 'Delete for me' and 'Copy' and 'Join')
    '.message-context-menu .context-menu-option:not([data-action="delete"]):not([data-action="copy"]):not([data-action="join"])',
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
    showToast('This action requires an internet connection', 0, 'error', false, 'action-requires-internet');
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
    showToast("No gateway server available; edit network.js file", 0, "error", false, "no-gateway-server")
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
        showToast('No account selected for removal', 0, 'error', false, 'no-account-selected-removal');
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

  getAllAccountsData() {
    const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const result = [];
    // Walk accounts registry to get username + netid list and derive counts
    for (const netid in accountsObj.netids) {
      const usernamesObj = accountsObj.netids[netid]?.usernames || {};
      for (const username in usernamesObj) {
        const key = `${username}_${netid}`;
        const state = loadState(key); // decrypted & parsed
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
            console.warn('Error counting contacts/messages for', key, e);
          }
        }
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
      
      // Check if this account is already in our result list
      const already = result.find(r => r.username === username && r.netid === netid);
      if (already) continue;
      
      // Check if this account is registered in the accounts object
      const isRegistered = accountsObj.netids[netid]?.usernames?.[username];
      if (isRegistered) continue;
      let state = null;
      try{
        state = loadState(storageKey);
      } catch (e) {
        console.warn('Error loading orphan account', storageKey, e);
        result.push({ username, netid, contactsCount: -1, messagesCount: -1, orphan: true });
        continue;
      }
      let contactsCount = 0; let messagesCount = 0;
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
          console.warn('Error counting orphan account', storageKey, e);
        }
      }
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
        label.innerHTML = `
          <input type="checkbox" data-username="${acc.username}" data-netid="${acc.netid}" />
          <span class="remove-account-username">${acc.username}</span>
          <span class="remove-account-stats">${acc.contactsCount} contacts, ${acc.messagesCount} messages${acc.orphan ? ' (orphan)' : ''}</span>
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
  constructor() {}

  load() {
    // called when the DOM is loaded; can setup event handlers here
    this.modal = document.getElementById('backupModal');
    this.passwordInput = document.getElementById('backupPassword');
    this.passwordWarning = document.getElementById('backupPasswordWarning');
    this.passwordConfirmInput = document.getElementById('backupPasswordConfirm');
    this.passwordConfirmWarning = document.getElementById('backupPasswordConfirmWarning');
    this.submitButton = document.getElementById('backupForm').querySelector('button[type="submit"]');
    this.backupAllAccountsCheckbox = document.getElementById('backupAllAccounts');
    this.backupAllAccountsGroup = document.getElementById('backupAllAccountsGroup');
    
    document.getElementById('closeBackupForm').addEventListener('click', () => this.close());
    document.getElementById('backupForm').addEventListener('submit', (event) => {
      this.handleSubmit(event);
    });
    
    // Add password validation on input with debounce
    this.debouncedUpdateButtonState = debounce(() => this.updateButtonState(), 250);
    this.passwordInput.addEventListener('input', this.debouncedUpdateButtonState);
    this.passwordConfirmInput.addEventListener('input', this.debouncedUpdateButtonState);
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

    // Determine which backup method to use
    if (myData && !this.backupAllAccountsCheckbox.checked) {
      // User is signed in and wants to backup only current account
      await this.handleSubmitOne(event);
    } else {
      // User wants to backup all accounts (either not signed in or checkbox checked)
      await this.handleSubmitAll(event);
    }
  }

  /**
   * Handle the submission of a single account backup.
   * @param {Event} event - The event object.
   */
  async handleSubmitOne(event) {
    event.preventDefault();
    saveState();

    // Disable button to prevent multiple submissions
    this.submitButton.disabled = true;

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

    const jsonData = stringify(backupObj, null, 2);

    try {
      // Encrypt data if password is provided
      const finalData = password ? encryptData(jsonData, password) : jsonData;

      // Create and trigger download
      const blob = new Blob([finalData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = this.generateBackupFilename(myAccount.username);
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
    } catch (error) {
      console.error('Encryption failed:', error);
      showToast('Failed to encrypt data. Please try again.', 0, 'error', false, 'encrypt-data-failed');
      // Re-enable button so user can try again
      this.updateButtonState();
    }
  }

  /**
   * Handle the submission of a backup for all accounts.
   * @param {Event} event - The event object.
   */
  async handleSubmitAll(event) {
    event.preventDefault();

    // Disable button to prevent multiple submissions
    this.submitButton.disabled = true;

    const password = this.passwordInput.value;
    const myLocalStore = this.copyLocalStorageToObject();
//    console.log(myLocalStore);
    const jsonData = stringify(myLocalStore, null, 2);

    try {
      // Encrypt data if password is provided
      const finalData = password ? encryptData(jsonData, password) : jsonData;

      // Create and trigger download
      const blob = new Blob([finalData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = this.generateBackupFilename();
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
    } catch (error) {
      console.error('Encryption failed:', error);
      showToast('Failed to encrypt data. Please try again.', 0, 'error', false, 'encrypt-data-failed');
      // Re-enable button so user can try again
      this.updateButtonState();
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
    
    // Password is optional, but if provided, it must be at least 4 characters
    let isValid = true;
    
    // Validate password length
    if (password.length > 0 && password.length < 4) {
      isValid = false;
      this.passwordWarning.style.display = 'inline';
    } else {
      this.passwordWarning.style.display = 'none';
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
    this.overwriteAccountsCheckbox = document.getElementById('overwriteAccountsCheckbox');
    this.backupAccountLockGroup = document.getElementById('backupAccountLockGroup');
    this.backupAccountLock = document.getElementById('backupAccountLock');
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
    // reset any backup lock UI
    this.backupAccountLockGroup.style.display = 'none';
    this.backupAccountLock.value = '';

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
      // If the backup file contains a top-level lock field (accounts were locked in backup)
      if (data.lock) {
        // Show password input so user can provide password needed to unlock accounts
        this.backupAccountLockGroup.style.display = 'block';
      } else {
        this.backupAccountLockGroup.style.display = 'none';
        this.backupAccountLock.value = '';
      }
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

  /**
   * Merge accounts from a parsed backup object into localStorage without removing any existing unrelated keys.
   * @param {Object} backupData Parsed JSON object produced from the backup file contents.
   * @returns {number|false} Number of accounts stored, or false if the merge was aborted.
   */
  async mergeBackupAccountsToLocal(backupData) {
    const overwrite = this.overwriteAccountsCheckbox?.checked;

    // If backup has a lock, require backup password
    let backupEncKey = null;
    if (backupData.lock) {
      const password = this.backupAccountLock.value || '';
      if (!password) {
        showToast('Backup password required to unlock accounts in the backup file', 0, 'error', false, 'backup-password-required');
        return false;
      }
      backupEncKey = await passwordToKey(password + 'liberdusData');
      if (!backupEncKey) {
        showToast('Invalid backup password', 0, 'error', false, 'invalid-backup-password');
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


    // Helper to extract address from parsed account data
    const extractAddress = (maybeJson) => {
      try {
        const obj = typeof maybeJson === 'string' ? parse(maybeJson) : maybeJson;
        return obj?.account?.keys?.address || '';
      } catch (e) {
        return '';
      }
    };

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

      // If backupData.lock equals localStorage.lock, we can copy directly
      if (backupData.lock && localStorage.lock && backupData.lock === localStorage.lock) {
        // Direct copy
        localStorage.setItem(localKey, value);
        restoredCount++;
      } else {
        // Need to decrypt with backupEncKey if available
        let decrypted = value;
        if (backupData.lock) {
            if (!backupEncKey) {
              showToast('Backup Account password required to unlock accounts in the backup file', 0, 'error', false, 'backup-account-password-required');
              return false;
            }
          try {
            const maybe = decryptData(value, backupEncKey, true);
            if (maybe != null) decrypted = maybe;
            else {
              // failed to decrypt
              showToast(`Failed to decrypt account ${username} on ${netid}. Skipping.`, 0, 'error');
              continue;
            }
          } catch (e) {
            showToast(`Failed to decrypt account ${username} on ${netid}. Skipping.`, 0, 'error');
            continue;
          }
        }

        // Now re-encrypt with local lock if localStorage.lock exists
        let finalValue = decrypted;
          if (localStorage.lock) {
          if (!lockModal?.encKey) {
            showToast('Local lock is set but unlock state is missing. Please unlock before importing.', 0, 'error', false, 'local-lock-missing-unlock');
            return false;
          }
          try {
            finalValue = encryptData(decrypted, lockModal.encKey, true);
          } catch (e) {
            showToast(`Failed to re-encrypt account ${username} on ${netid}. Skipping.`, 0, 'error');
            continue;
          }
        }

        // Finally store the account entry
          localStorage.setItem(localKey, finalValue);
          restoredCount++;

        // Update accounts registry address if possible
        const address = extractAddress(decrypted);
        if (address) {
          const accountsObj = parse(localStorage.getItem('accounts') || '{"netids":{}}');
          if (!accountsObj.netids[netid]) accountsObj.netids[netid] = { usernames: {} };
          accountsObj.netids[netid].usernames[username] = { address };
          localStorage.setItem('accounts', stringify(accountsObj));
        }
      }
    }

    return restoredCount;
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
          showToast('Password required for encrypted data', 0, 'error', false, 'password-required-encrypted-data');
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
      let backupData = parse(fileContent);

        // Instead of clearing localStorage, we'll merge accounts from backup into localStorage
        // Ask for confirmation (previous behavior warned about clearing; keep a similar warning)
        const confirmed = confirm('⚠️ WARNING: This will import all accounts from the backup file.\n\nExisting local accounts will not be removed. If "Overwrite existing accounts" is checked, accounts with the same username and netid will be replaced.\n\nIt is recommended to backup your current data before proceeding.\n\nDo you want to continue with the restore?');

        if (!confirmed) {
          showToast('Restore cancelled by user', 2000, 'info');
          return;
        }

        // backwards compatibility for old single account export
        if(typeof backupData === 'object' && 'account' in backupData) {
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
        this.clearForm();
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

    // Fetch network parameters to get minToll
    this.minToll = parameters?.current?.minToll || 1n * wei; // Default to 1 LIB if not set

    this.updateTollDisplay(toll, tollUnit);

    this.currentCurrency = 'USD';
    if (this.tollCurrencySymbol) this.tollCurrencySymbol.textContent = 'USD';
    this.newTollAmountInputElement.value = ''; // Clear input field
    this.warningMessageElement.textContent = '';
    this.warningMessageElement.classList.remove('show');
    this.saveButton.disabled = true;

    // Update min toll display under input (USD)
    const scalabilityFactor = getStabilityFactor();
    const minTollUSD = bigxnum2big(this.minToll, scalabilityFactor.toString());
    this.minTollDisplay.textContent = `Minimum toll: ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD`;
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
      showToast('Invalid toll amount entered.', 0, 'error', false, 'invalid-toll-amount');
      return;
    }

    const newToll = bigxnum2big(wei, this.newTollAmountInputElement.value);

    // Check if the toll is non-zero but less than minimum
    if (newToll > 0n) {
      if (this.currentCurrency === 'LIB' && newToll < this.minToll) {
        showToast(`Toll must be at least ${parseFloat(big2str(this.minToll, 18)).toFixed(6)} LIB or 0 LIB`, 0, 'error', false, 'toll-too-low-lib');
        return;
      }
      if (this.currentCurrency === 'USD') {
        const scalabilityFactor = getStabilityFactor();
        const newTollLIB = bigxnum2big(newToll, (1 / scalabilityFactor).toString());
        if (newTollLIB < this.minToll) {
          const minTollUSD = bigxnum2big(this.minToll, scalabilityFactor.toString());
          showToast(`Toll must be at least ${parseFloat(big2str(minTollUSD, 18)).toFixed(4)} USD or 0 USD`, 0, 'error', false, 'toll-too-low-usd');
          return;
        }
      }
    }

    // Add maximum toll validation
    if (this.currentCurrency === 'LIB') {
      if (newTollValue > MAX_TOLL) {
        showToast(`Toll cannot exceed ${MAX_TOLL} LIB`, 0, 'error', false, 'toll-too-high-lib');
        return;
      }
    } else {
      // For USD, convert the max toll to USD for comparison
      const scalabilityFactor = getStabilityFactor();
      const maxTollUSD = MAX_TOLL * scalabilityFactor;
      if (newTollValue > maxTollUSD) {
        showToast(`Toll cannot exceed ${maxTollUSD.toFixed(2)} USD`, 0, 'error', false, 'toll-too-high-usd');
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
    const scalabilityFactor = getStabilityFactor();
    let tollValueUSD = '';
    let tollValueLIB = '';

    if (tollUnit == 'LIB') {
      const libFloat = parseFloat(big2str(toll, 18));
      tollValueUSD = (libFloat * scalabilityFactor).toString();
      tollValueLIB = libFloat.toString();
    } else {
      const usdFloat = parseFloat(big2str(toll, 18));
      tollValueUSD = usdFloat.toString();
      tollValueLIB = (usdFloat / scalabilityFactor).toString();
    }

    const usdDisplay = parseFloat(tollValueUSD).toFixed(6);
    const libDisplay = scalabilityFactor > 0 ? parseFloat(tollValueLIB).toFixed(6) : 'N/A';

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
      const scalabilityFactor = getStabilityFactor();
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
      showToast('Please enter a message to share', 0, 'error', false, 'message-required-to-share');
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
      showToast('Could not share invitation. Try copying manually.', 0, 'error', false, 'could-not-share-invitation');
    }
  }

  async shareLiberdusInvite(overrideText) {
    const url = "https://liberdus.com/download";
    const title = "Join me on Liberdus";
    const defaultText = `Message ${myAccount.username} on Liberdus! ${this.inviteURL}`;
    const text = (typeof overrideText === 'string' && overrideText.trim().length) ? overrideText.trim() : defaultText;

    // 1) Check if running in React Native WebView
    if (reactNativeApp.isReactNativeWebView) {
      try {
        reactNativeApp.shareInvite(url, text, title);
        return; // success
      } catch (err) {
        // fall through to native share or clipboard on errors
      }
    }

    // 2) Try native share sheet
    if (navigator.share) {
      try {
        await navigator.share({ url, text, title });
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
      await navigator.clipboard.writeText(text);
      showToast("Invite copied to clipboard!", 3000, "success");
    } catch {
      showToast("Could not copy invite link.", 0, "error", false, "could-not-copy-invite-link");
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
    this.checkForUpdatesBtn = document.getElementById('checkForUpdatesBtn');

    // Set up event listeners
    this.closeButton.addEventListener('click', () => this.close());

    // Only show "Check for Updates" button if user is in React Native app
    if (window.ReactNativeWebView) {
      this.checkForUpdatesBtn.style.display = 'inline-block';
      this.checkForUpdatesBtn.addEventListener('click', () => this.openStore());
    } else {
      this.checkForUpdatesBtn.style.display = 'none';
    }

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

  openStore() {
    // This method only runs when user is in React Native app
    const userAgent = navigator.userAgent.toLowerCase();
    let storeUrl;

    if (userAgent.includes('android')) {
      storeUrl = 'https://play.google.com/store/apps/details?id=com.jairaj.liberdus';
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ios')) {
      storeUrl = 'https://testflight.apple.com/join/zSRCWyxy';
    } else {
      storeUrl = 'https://play.google.com/store/apps/details?id=com.jairaj.liberdus';
    }

    // Show update warning modal
    updateWarningModal.open(storeUrl);
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
  }

  open(storeUrl) {
    // Store the URL for later use
    this.storeUrl = storeUrl;
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
    this.email = document.getElementById('email');
    this.phone = document.getElementById('phone');
    this.linkedin = document.getElementById('linkedin');
    this.x = document.getElementById('x');
    this.accountForm = document.getElementById('accountForm');
    this.submitButton = document.querySelector('#accountForm .btn.btn--primary');

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
      showToast('Could not find nominated validator.', 0, 'error', false, 'could-not-find-nominated-validator');
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
        showToast(`Unstake unavailable (validator active).`, 0, 'error', false, 'unstake-unavailable-validator-active');
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
      showToast('Unstake transaction failed. Network or server error.', 0, 'error', false, 'unstake-tx-failed');
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
      showToast('Please fill in all fields.', 0, 'error', false, 'please-fill-all-fields');
      this.submitButton.disabled = false;
      return;
    }

    let amount_in_wei;
    try {
      amount_in_wei = bigxnum2big(wei, amountStr);
    } catch (error) {
      showToast('Invalid amount entered.', 0, 'error', false, 'invalid-amount-entered');
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
      showToast('Stake transaction failed. See console for details.', 0, 'error', false, 'stake-tx-failed');
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
    console.log('Filling stake address from QR data:', data);

    // Directly set the value of the stakeNodeAddress input field
    if (this.nodeAddressInput) {
      this.nodeAddressInput.value = data;
      this.nodeAddressInput.dispatchEvent(new Event('input'));
    } else {
      console.error('Stake node address input field not found!');
      showToast('Could not find stake address field.', 0, 'error', false, 'could-not-find-stake-address-field');
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
        nodeAddress: this.nodeAddressInput.value.trim(),
        userAddress: longAddress(myAccount.keys.address),
        username: myAccount.username,
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
    this.lastMessageCount = 0;

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
    this.editButton = document.getElementById('chatEditButton');
    this.callButton = document.getElementById('chatCallButton');
    this.sendMoneyButton = document.getElementById('chatSendMoneyButton');
    this.retryOfTxId = document.getElementById('retryOfTxId');
    this.messageInput = document.querySelector('.message-input');
    this.chatSendMoneyButton = document.getElementById('chatSendMoneyButton');
    this.messageByteCounter = document.querySelector('.message-byte-counter');
    this.tollTemplate = document.getElementById('tollInfoMessageTemplate');
    this.messagesContainer = document.querySelector('.messages-container');
    this.addFriendButtonChat = document.getElementById('addFriendButtonChat');
    this.addAttachmentButton = document.getElementById('addAttachmentButton');
    this.chatFileInput = document.getElementById('chatFileInput');

    // Voice recording elements
    this.voiceRecordButton = document.getElementById('voiceRecordButton');
    

    // this.voiceRecordingModal = new VoiceRecordingModal(this);
    // this.voiceRecordingModal.init();


    // Initialize context menu
    this.contextMenu = document.getElementById('messageContextMenu');
    
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
    
    // Close context menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.closeContextMenu();
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
    });

    // Add viewport resize listener for keyboard detection
    window.addEventListener('resize', () => {
      const currentHeight = window.innerHeight;
      const heightDifference = this.initialViewportHeight - currentHeight;
      
      // If viewport height decreased significantly, keyboard is likely open
      if (heightDifference > 150) { // 150px threshold for keyboard detection
        this.isKeyboardVisible = true;
        console.log('⌨️ Keyboard detected as open (viewport height decreased by', heightDifference, 'px)');
      } else if (heightDifference < 50) { // If height increased or stayed similar, keyboard is likely closed
        this.isKeyboardVisible = false;
        /* console.log('⌨️ Keyboard detected as closed (viewport height difference:', heightDifference, 'px)'); */
      }
    });

    // Add focus event listener for message input to handle scrolling
    this.messageInput.addEventListener('focus', () => {
      if (this.messagesContainer) {
        // Check if we're already at the bottom (within 50px threshold)
        const isAtBottom =
          this.messagesContainer.scrollHeight - this.messagesContainer.scrollTop - this.messagesContainer.clientHeight <= 50;
        if (isAtBottom) {
          // Wait for keyboard to appear and viewport to adjust
          setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            this.messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); // To provide smoother, more reliable scrolling on mobile.
          }, 500); // Increased delay to ensure keyboard is fully shown
        }
      }
    });

    this.chatSendMoneyButton.addEventListener('click', () => {
      sendAssetFormModal.username = this.chatSendMoneyButton.dataset.username;
      sendAssetFormModal.open();
    });

    this.callButton.addEventListener('click', () => {
      this.handleCallUser();
    });

    this.addFriendButtonChat.addEventListener('click', () => {
      if (!friendModal.getCurrentContactAddress()) return;
      friendModal.open();
    });

    if (this.addAttachmentButton) {
      this.addAttachmentButton.addEventListener('click', () => {
        this.triggerFileSelection();
      });
    }

    if (this.chatFileInput) {
      this.chatFileInput.addEventListener('change', (e) => {
        this.handleFileAttachment(e);
      });
    }

    // Voice recording event listeners
    if (this.voiceRecordButton) {
      this.voiceRecordButton.addEventListener('click', () => {
        voiceRecordingModal.open();
      });
    }

    this.messagesList.addEventListener('click', async (e) => {
      const row = e.target.closest('.attachment-row');
      if (!row) return;
      e.preventDefault();

      // Concurent download prevention
      if (this.attachmentDownloadInProgress) return;

      this.attachmentDownloadInProgress = true;

      const idx  = Number(row.dataset.msgIdx);
      const item = myData.contacts[this.address].messages[idx];

      try {
        await this.handleAttachmentDownload(item, row);
      } finally {
        this.attachmentDownloadInProgress = false;
      }
    });

    // Voice message play button event delegation
    this.messagesList.addEventListener('click', (e) => {
      const playButton = e.target.closest('.voice-message-play-button');
      if (playButton) {
        e.preventDefault();
        this.playVoiceMessage(playButton);
      }
    });


    // Make toll info clickable: show sticky info toast and refresh toll in background
    const tollContainer = this.modal.querySelector('.toll-container');
    if (tollContainer) {
      tollContainer.style.cursor = 'pointer';
      tollContainer.addEventListener('click', () => {
        const message = this.getTollInfoMessage();
        showToast(message, 0, 'toll', true, 'toll-info-modal');
      });
    }

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

    // Add data attributes to store the username and address
    this.sendMoneyButton.dataset.username = contact.username || address;

    this.modalAvatar.innerHTML = generateIdenticon(contact.address, 40);

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

    // clear file attachments
    this.fileAttachments = [];
    this.showAttachmentPreview(); // Hide preview

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
    if (isOnline) {
      const needsToSendReadTx = this.needsToSend();
      console.log(`[close] needsToSendReadTx: ${needsToSendReadTx}`);
      // if newestRecevied message does not have an amount property and user has not responded, then send a read transaction
      if (needsToSendReadTx) {
        this.sendReadTransaction(this.address);
      }
      
      this.sendReclaimTollTransaction(this.address);
    } else {
      showToast('Offline: toll not processed', 0, 'error', false, 'offline-toll-not-processed');
    }

    // Save any unsaved draft before closing
    this.debouncedSaveDraft(this.messageInput.value);

    // Cancel all ongoing file operations
    this.cancelAllOperations();

    // clear file attachments
    this.fileAttachments = [];
    this.showAttachmentPreview(); // clear listeners

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
      chatId: hashBytes([longAddress(myData.account.keys.address), longAddress(contactAddress)].sort().join('')),
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

    // if user is blocked, don't send message, show toast
    if (myData.contacts[this.address].tollRequiredToSend == 2) {
      showToast('You are blocked by this user', 0, 'error', false, 'user-blocked');
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

      const amount = this.tollRequiredToSend ? this.toll : 0n;
      const sufficientBalance = await validateBalance(amount);
      if (!sufficientBalance) {
        showToast('Insufficient balance for toll and fee', 0, 'error', false, 'insufficient-balance-toll');
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
        showToast('Keys not found for sender address', 0, 'error', false, 'keys-not-found-sender');
        return;
      }

      // Ensure recipient's keys are available
      const keysOk = await ensureContactKeys(currentAddress);
      let recipientPubKey = myData.contacts[currentAddress]?.public;
      let pqRecPubKey = myData.contacts[currentAddress]?.pqPublic;
      if (!keysOk || !recipientPubKey || !pqRecPubKey) {
        console.log(`no public/PQ key found for recipient ${currentAddress}`);
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
        // Convert message to new JSON format with type and optional attachments
        messageObj = {
          type: 'message',
          message: message
        };
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
      await signObj(chatMessageObj, keys);
      const txid = getTxid(chatMessageObj)
console.warn('in send message', txid)

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
        insertSorted(chatsData.contacts[currentAddress].messages, newMessage, 'timestamp');
      }

      // clear file attachments and remove preview
      if (this.fileAttachments && this.fileAttachments.length > 0) {
        this.fileAttachments = [];
        this.showAttachmentPreview();
      }

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

      // Call debounced save directly with empty string
      this.debouncedSaveDraft('');
      contact.draft = '';

      // Update the chat modal UI immediately
      if (!isEdit) this.appendChatModal(); // This should now display the 'sending' message

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
        if (!isEdit) {
          updateTransactionStatus(txid, currentAddress, 'failed', 'message');
          this.appendChatModal();
        } else {
          showToast('Edit failed to send', 0, 'error', false, 'edit-failed-send');
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
      showToast('Failed to send message. Please try again.', 0, 'error', false, 'message-send-failed');
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
      this.messageByteCounter.style.display = 'none';
      // Clear any saved draft
      if (typeof this.debouncedSaveDraft === 'function') {
        this.debouncedSaveDraft('');
      }
      // Hide cancel button
      this.cancelEditButton.style.display = 'none';
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
    // Last time user previously had this chat open (used to mark newly edited messages)
    const lastReadTs = contact.lastChatOpenTs || 0;

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
          // --- Render Attachments if present ---
          let attachmentsHTML = '';
          if (item.xattach && Array.isArray(item.xattach) && item.xattach.length > 0) {
            attachmentsHTML = item.xattach.map(att => {
              const emoji = this.getFileEmoji(att.type || '', att.name || '');
              const fileUrl = att.url || '#';
              const fileName = att.name || 'Attachment';
              const fileSize = att.size ? this.formatFileSize(att.size) : '';
              const fileType = att.type ? att.type.split('/').pop().toUpperCase() : '';
              return `
                <div class="attachment-row" style="display: flex; align-items: center; background: #f5f5f7; border-radius: 12px; padding: 10px 12px; margin-bottom: 6px;"
                  data-url="${fileUrl}"
                  data-name="${encodeURIComponent(fileName)}"
                  data-type="${att.type || ''}"
                  data-pqEncSharedKey="${att.pqEncSharedKey || ''}"
                  data-selfKey="${att.selfKey || ''}"
                  data-msg-idx="${i}"
                >
                  <span style="font-size: 2.2em; margin-right: 14px;">${emoji}</span>
                  <div style="min-width:0;">
                    <span class="attachment-label" style="font-weight:500;color:#222;word-break:break-all;">
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
              // Build scheduled label if in the future
              const callTimeMs = item.callTime || 0;
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
            } else {
              // Regular message rendering
              messageTextHTML = `<div class="message-content" style="white-space: pre-wrap; margin-top: ${attachmentsHTML ? '2px' : '0'};">${linkifyUrls(item.message)}</div>`;
            }
          }
          
          // Check for voice message
          if (item.type === 'vm') {
            const duration = this.formatDuration(item.duration);
            // Use audio encryption keys for playback, fall back to message encryption keys if not available
            const audioEncKey = item.audioPqEncSharedKey || item.pqEncSharedKey || '';
            const audioSelfKey = item.audioSelfKey || item.selfKey || '';
            messageTextHTML = `
              <div class="voice-message" data-voice-url="${item.url || ''}" data-pqEncSharedKey="${audioEncKey}" data-selfKey="${audioSelfKey}" data-msg-idx="${i}" data-duration="${item.duration || 0}">
                <div class="voice-message-controls" style="display:flex;align-items:center;gap:10px;">
                  <button class="voice-message-play-button" aria-label="Play voice message" style="flex:0 0 auto;">
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                  <div class="voice-message-info" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                      <div class="voice-message-text" style="font-weight:500;">Voice message</div>
                      <div class="voice-message-time-display" style="font-size:0.85em;white-space:nowrap;">0:00 / ${duration}</div>
                    </div>
                    <input type="range" class="voice-message-seek" min="0" max="${item.duration || 0}" value="0" step="1" aria-label="Seek voice message" style="width:100%;cursor:pointer;">
                  </div>
                </div>
              </div>`;
          }
          
          const callTimeAttribute = item.type === 'call' && item.callTime ? `data-call-time="${item.callTime}"` : '';
      const showEditedDot = !item.my && item.edited && item.edited_timestamp && item.edited_timestamp > lastReadTs && !item.deleted;
      messageHTML = `
            <div class="message ${messageClass}" ${timestampAttribute} ${txidAttribute} ${statusAttribute} ${callTimeAttribute}>
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
      showToast('You can only attach up to 5 files.', 0, 'error', false, 'too-many-files');
      event.target.value = ''; // Reset file input
      return;
    }

    // File size limit (e.g., 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      showToast('File size too large. Maximum size is 10MB.', 0, 'error', false, 'file-too-large');
      event.target.value = ''; // Reset file input
      return;
    }

    let loadingToastId;
    try {
      this.isEncrypting = true;
      this.sendButton.disabled = true; // Disable send button during encryption
      this.addAttachmentButton.disabled = true;
      loadingToastId = showToast(`Attaching file...`, 0, 'loading');
      const { dhkey, cipherText: pqEncSharedKey } = await this.getRecipientDhKey(this.address);
      const password = myAccount.keys.secret + myAccount.keys.pqSeed;
      const selfKey = encryptData(bin2hex(dhkey), password, true)

      const worker = new Worker('encryption.worker.js', { type: 'module' });
      worker.onmessage = async (e) => {
        this.isEncrypting = false;
        if (e.data.error) {
          hideToast(loadingToastId);
          showToast(e.data.error, 0, 'error');
          this.sendButton.disabled = false; // Re-enable send button
          this.addAttachmentButton.disabled = false;
        } else {
          // Encryption successful
          // upload to get url here 

          const bytes = new Uint8Array(e.data.cipherBin);
          const blob = new Blob([bytes], { type: 'application/octet-stream' });

          const form = new FormData();
          form.append('file', blob, file.name);

          // TODO: move to network.js
          const uploadUrl = 'https://inv.liberdus.com:2083';

          try {
            const response = await fetch(`${uploadUrl}/post`, {
              method: 'POST',
              body: form,
              signal: this.abortController.signal
            });
            if (!response.ok) throw new Error(`upload failed ${response.status}`);

            const { id } = await response.json();
            if (!id) throw new Error('No file ID returned from upload');

            this.fileAttachments.push({
              url: `${uploadUrl}/get/${id}`,
              name: file.name,
              size: file.size,
              type: file.type,
              pqEncSharedKey: bin2base64(pqEncSharedKey),
              selfKey
            });
            hideToast(loadingToastId);
            this.showAttachmentPreview(file);
            this.sendButton.disabled = false; // Re-enable send button
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
            this.sendButton.disabled = false;
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
        this.sendButton.disabled = false; // Re-enable send button
        this.addAttachmentButton.disabled = false;
        worker.terminate();
      };
      
      // read the file and send it to the worker for encryption
      const reader = new FileReader();
      reader.onload = async (e) => {
        worker.postMessage({ fileBuffer: e.target.result, dhkey }, [e.target.result]);
      };
      reader.readAsArrayBuffer(file);
      
    } catch (error) {
      console.error('Error handling file attachment:', error);
      
      // Hide loading toast if it was an abort error
      if (error.name === 'AbortError') {
        hideToast(loadingToastId);
      } else {
        showToast('Error processing file attachment', 0, 'error', false, 'file-processing-error');
      }
      
      // Re-enable buttons
      this.sendButton.disabled = false;
      this.addAttachmentButton.disabled = false;
      this.isEncrypting = false;
    } finally {
      event.target.value = ''; // Reset the file input value
    }
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
      return;
    }
  
    const attachmentItems = this.fileAttachments.map((attachment, index) => `
      <div class="attachment-item">
        <span class="attachment-icon">📎</span>
        <span class="attachment-name">${attachment.name}</span>
        <button class="remove-attachment" data-index="${index}">×</button>
      </div>
    `).join('');
  
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
   * Removes a specific attached file
   * @param {number} index - Index of file to remove
   * @returns {void}
   */
  removeAttachment(index) {
    if (this.fileAttachments && index >= 0 && index < this.fileAttachments.length) {
      const removedFile = this.fileAttachments.splice(index, 1)[0];
      this.showAttachmentPreview(); // Refresh the preview
      showToast(`"${removedFile.name}" removed`, 2000, 'info');
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
   * Returns an appropriate emoji based on file type and name
   * @param {string} type - MIME type of the file
   * @param {string} name - Name of the file
   * @returns {string} Emoji representing the file type
   */
  getFileEmoji(type, name) {
    if (type && type.startsWith('image/')) return '🖼️';
    if (type && type.startsWith('audio/')) return '🎵';
    if (type && type.startsWith('video/')) return '🎬';
    if ((type === 'application/pdf') || (name && name.toLowerCase().endsWith('.pdf'))) return '📄';
    if (type && type.startsWith('text/')) return '📄';
    return '📎';
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
    
    return viewableTypes.some(type => mimeType.startsWith(type));
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

  async handleAttachmentDownload(item, linkEl) {
    let loadingToastId;
    try {
      loadingToastId = showToast(`Decrypting attachment...`, 0, 'loading');
      // 1. Derive a fresh 32‑byte dhkey
      let dhkey;
      if (item.my) {
        // you were the sender ⇒ run encapsulation side again
        const selfKey = linkEl.dataset.selfkey;
        const password = myAccount.keys.secret + myAccount.keys.pqSeed;
        dhkey = hex2bin(decryptData(selfKey, password, true));
      } else {
        // you are the receiver ⇒ use fields stashed on the item
        const ok = await ensureContactKeys(this.address);
        const senderPublicKey = myData.contacts[this.address]?.public;
        if (!ok || !senderPublicKey) throw new Error(`No public key found for sender ${this.address}`);
        const pqEncSharedKey = linkEl.dataset.pqencsharedkey;
        dhkey = dhkeyCombined(
          myAccount.keys.secret,
          senderPublicKey,
          myAccount.keys.pqSeed,
          pqEncSharedKey
        ).dhkey;
      }

      // 2. Download encrypted bytes
      const res = await fetch(linkEl.dataset.url, {
        signal: this.abortController.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cipherBin = new Uint8Array(await res.arrayBuffer());

      // 3. bin → base64 → decrypt → clear Uint8Array
      const cipherB64 = bin2base64(cipherBin);
      const plainB64  = decryptChacha(dhkey, cipherB64);
      if (!plainB64) throw new Error('decryptChacha returned null');
      const clearBin  = base642bin(plainB64);

      // 4. Blob + download
      const blob    = new Blob([clearBin], { type: linkEl.dataset.type || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const filename = decodeURIComponent(linkEl.dataset.name || 'download');

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
            
            if (newTab) {
              console.log('opened in new tab');
            } else {
              console.log('failed to open in new tab');
            }
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
      
      // Hide loading toast if it was an abort error
      if (err.name === 'AbortError') {
        hideToast(loadingToastId);
      } else {
        showToast(`Decryption failed.`, 0, 'error', false, 'message-decryption-failed');
      }
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
   * Handles message click events
   * @param {Event} e - Click event
   */
  handleMessageClick(e) {
    if (e.target.closest('.attachment-row')) return;
    if (e.target.closest('.voice-message-play-button')) return;
    if (e.target.closest('.voice-message-seek')) return;

    // Check if keyboard is open - if so, don't show context menu
    if (this.isKeyboardOpen()) {
      console.log('⌨️ Keyboard is open, preventing context menu');
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
    
    this.currentContextMessage = messageEl;
    
    // Show/hide "Delete for all" option based on whether the message is from the current user
    const isMine = messageEl.classList.contains('sent');
    const deleteForAllOption = this.contextMenu.querySelector('[data-action="delete-for-all"]');
    if (deleteForAllOption) {
      deleteForAllOption.style.display = isMine ? 'flex' : 'none';
    }

    // If this is a call message, show call-specific options and hide copy
    const isCall = !!messageEl.querySelector('.call-message');
    const isVoice = !!messageEl.querySelector('.voice-message');
    const copyOption = this.contextMenu.querySelector('[data-action="copy"]');
    const joinOption = this.contextMenu.querySelector('[data-action="join"]');
    const inviteOption = this.contextMenu.querySelector('[data-action="call-invite"]');
    const editResendOption = this.contextMenu.querySelector('[data-action="edit-resend"]');
    const editOption = this.contextMenu.querySelector('[data-action="edit"]');
    const isFailedPayment = messageEl.dataset.status === 'failed' && messageEl.classList.contains('payment-info');
    // For failed payment messages, hide copy and delete-for-all regardless of sender
    if (isFailedPayment) {
      if (copyOption) copyOption.style.display = 'none';
      if (deleteForAllOption) deleteForAllOption.style.display = 'none';
    }
    if (isCall) {
      if (copyOption) copyOption.style.display = 'none';
      if (joinOption) joinOption.style.display = 'flex';
      if (inviteOption) inviteOption.style.display = 'flex';
      if (editResendOption) editResendOption.style.display = 'none';
      if (editOption) editOption.style.display = 'none';
    } else if (isVoice) {
      if (copyOption) copyOption.style.display = 'none';
    } else {
      if (copyOption) copyOption.style.display = 'flex';
      if (joinOption) joinOption.style.display = 'none';
      if (inviteOption) inviteOption.style.display = 'none';
      if (editResendOption) editResendOption.style.display = isFailedPayment ? 'flex' : 'none';
      // Determine if edit should be shown
      if (editOption) {
        // Conditions: own plain message OR own payment with memo text, not deleted/failed/voice, within 15 minutes
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
    
    this.positionContextMenu(this.contextMenu, messageEl);
    this.contextMenu.style.display = 'block';
  }

  /**
   * Utility function to position context menus based on available space
   * @param {HTMLElement} menu - The context menu element
   * @param {HTMLElement} messageEl - The message element to position relative to
   */
  positionContextMenu(menu, messageEl) {
    const rect = messageEl.getBoundingClientRect();
    const container = messageEl.closest('.messages-container');
    const containerRect = container?.getBoundingClientRect() || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    
    const menuWidth = 200;
    const menuHeight = 100;
    
    // Center horizontally, clamp to container
    let left = Math.max(containerRect.left + 10, 
                        Math.min(containerRect.right - menuWidth - 10, 
                                 rect.left + rect.width/2 - menuWidth/2));
    
    // Prefer below, fallback to above, clamp to container
    let top = rect.bottom + 10;
    if (top + menuHeight > containerRect.bottom) {
      top = Math.max(containerRect.top + 10, rect.top - menuHeight - 10);
    }
    
    Object.assign(menu.style, { left: `${left}px`, top: `${top}px` });
  }

  /**
   * Closes the context menu
   */
  closeContextMenu() {
    if (!this.contextMenu) return;
    this.contextMenu.style.display = 'none';
    this.currentContextMessage = null;
  }

  /**
   * Handles context menu option selection
   * @param {string} action - The action to perform
   */
  handleContextMenuAction(action) {
    const messageEl = this.currentContextMessage;
    if (!messageEl) return;
    
    switch (action) {
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
      const txid = messageEl.dataset.txid;
      const timestamp = parseInt(messageEl.dataset.messageTimestamp || '0', 10);
      if (!txid) return;
      // Enforce edit window in case UI got out of sync
      if (timestamp && (Date.now() - timestamp) > EDIT_WINDOW_MS) {
        return showToast('Edit window expired', 3000, 'info');
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
      // Focus input and move caret to end
      this.messageInput.focus();
      this.messageInput.selectionStart = this.messageInput.selectionEnd = this.messageInput.value.length;
    } catch (err) {
      console.error('startEditMessage error', err);
    }
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
      // Remove attachments if any
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
      showToast('Failed to delete message', 0, 'error', false, 'delete-message-failed');
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
        return showToast('You can only delete your own messages for all', 0, 'error', false, 'can-only-delete-own-messages');
      }

      // Create and send a "delete" message
      const keys = myAccount.keys;
      if (!keys) {
        showToast('Keys not found', 0, 'error', false, 'keys-not-found-delete');
        return;
      }

      // Ensure recipient keys are available
      const ok = await ensureContactKeys(this.address);
      const recipientPubKey = myData.contacts[this.address]?.public;
      const pqRecPubKey = myData.contacts[this.address]?.pqPublic;
      if (!ok || !recipientPubKey || !pqRecPubKey) {
        console.log(`No public/PQ key found for recipient ${this.address}`);
        showToast('Failed to get recipient key', 0, 'error', false, 'failed-to-get-recipient-key-delete');
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
      let tollInLib = myData.contacts[this.address].tollRequiredToSend == 0 ? 0n : this.toll;
      const deleteMessageObj = await this.createChatMessage(this.address, payload, tollInLib, keys);
      await signObj(deleteMessageObj, keys);
      const deleteTxid = getTxid(deleteMessageObj);

      // Send the delete transaction
      const response = await injectTx(deleteMessageObj, deleteTxid);

      if (!response || !response.result || !response.result.success) {
        console.log('Delete message failed to send', response);
        return showToast('Failed to delete message: ' + (response?.result?.reason || 'Unknown error'), 0, 'error');
      }

      showToast('Delete request sent', 3000, 'success');
      
      // Note: We don't do optimistic UI updates for delete-for-all
      // The message will be deleted when we process the delete tx from the network
      
    } catch (error) {
      console.error('Delete for all error:', error);
      showToast('Failed to delete message. Please try again.', 0, 'error', false, 'delete-message-retry-failed');
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
      text = `${usdValue.toFixed(6)} USD (≈ ${libValue.toFixed(6)} LIB)`;
    }

    let libWei;
    if (tollUnit === 'USD' && factorValid && !isNaN(usdValue)) {
      libWei = bigxnum2big(wei, (usdValue / factor).toString());
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
    tollValue.style.color = 'black';
    const contact = myData.contacts[address] || {};
    const isOffline = !isOnline;

    // If offline and no cached toll, show a clear offline status and exit
    if (isOffline && (contact.toll === undefined || contact.toll === null)) {
      tollValue.style.color = 'black';
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
      display = `${usdString}`;
    } else if (contact.tollRequiredToSend == 2) {
      tollValue.style.color = 'red';
      display = `blocked`;
    } else {
      // light green used to show success
      tollValue.style.color = '#28a745';
      display = `free; ${usdString}`;
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
      console.log(`Returning early since queried toll value is the same as the toll field in localStorage`);
      // return early
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
          showToast('You are blocked by this user', 0, 'error', false, 'user-blocked');
        } else {
          showToast(
            `You can only call people who have added you as a friend or connection. Ask ${username} to add you as a friend or connection`,
            0,
            'info',
            false,
            'call-permission-required'
          );
        }
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
      
      // Open immediately only if call is now
      if (chosenCallTime === 0) {
        window.open(callUrl+`${callUrlParams}"${myAccount.username}"`, '_blank');
      }
      
      // Send a call message to the contact with callTime (0 or future timestamp)
      await this.sendCallMessage(callUrl, chosenCallTime);
      
      if (chosenCallTime && chosenCallTime > 0) {
        const when = new Date(chosenCallTime - timeSkew); // convert back to local wall-clock for display
        showToast(`Call scheduled for ${when.toLocaleString()}`, 3000, 'success');
      }
      
    } catch (error) {
      console.error('Error handling call user:', error);
      showToast('Failed to start call. Please try again.', 0, 'error', false, 'call-start-failed');
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
      showToast('You are blocked by this user', 0, 'error', false, 'user-blocked');
      return;
    }

    try {
      // Get current chat data
      const chatsData = myData;
      const currentAddress = this.address;
      if (!currentAddress) return;

      // Check if trying to message self
      if (currentAddress === myAccount.address) {
        return;
      }

      // Get sender's keys from wallet
      const keys = myAccount.keys;
      if (!keys) {
        showToast('Keys not found for sender address', 0, 'error', false, 'keys-not-found-sender');
        return;
      }

      // Ensure recipient keys are available
      const ok = await ensureContactKeys(currentAddress);
      const recipientPubKey = myData.contacts[currentAddress]?.public;
      const pqRecPubKey = myData.contacts[currentAddress]?.pqPublic;
      if (!ok || !recipientPubKey || !pqRecPubKey) {
        console.log(`no public/PQ key found for recipient ${currentAddress}`);
        showToast('Failed to get recipient key', 0, 'error', false, 'failed-to-get-recipient-key-call');
        return;
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

      // Add additional info only if recipient is a friend
      if (contact && contact?.friend && contact?.friend >= 3) {
        senderInfo.name = myData.account.name;
        senderInfo.email = myData.account.email;
        senderInfo.phone = myData.account.phone;
        senderInfo.linkedin = myData.account.linkedin;
        senderInfo.x = myData.account.x;
      }

      // Always encrypt and send senderInfo
      payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

      // Create and send the call message transaction
      let tollInLib = myData.contacts[currentAddress].tollRequiredToSend == 0 ? 0n : this.toll;
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
        console.log('call message failed to send', response);
        updateTransactionStatus(txid, currentAddress, 'failed', 'message');
        this.appendChatModal();
      }
      
    } catch (error) {
      console.error('Call message error:', error);
      showToast('Failed to send call invitation. Please try again.', 0, 'error', false, 'failed-to-send-call-invitation');
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
  async sendVoiceMessageTx(voiceMessageUrl, duration, audioPqEncSharedKey, audioSelfKey) {
    // Create voice message object
    const messageObj = {
      type: 'vm',
      url: voiceMessageUrl,
      duration: duration
    };

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

    if (contact && contact?.friend && contact?.friend >= 3) {
      senderInfo.name = myData.account.name;
      senderInfo.email = myData.account.email;
      senderInfo.phone = myData.account.phone;
      senderInfo.linkedin = myData.account.linkedin;
      senderInfo.x = myData.account.x;
    }

    payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

    // Calculate toll
    let tollInLib = myData.contacts[this.address].tollRequiredToSend == 0 ? 0n : this.toll;

    // Create and send transaction
    const chatMessageObj = await this.createChatMessage(this.address, payload, tollInLib, myAccount.keys);
    await signObj(chatMessageObj, myAccount.keys);
    const txid = getTxid(chatMessageObj);

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

    // Send to network
    try {
      await injectTx(chatMessageObj, txid);
      newMessage.status = 'sent';
    } catch (error) {
      console.error('Failed to send voice message to network:', error);
      newMessage.status = 'failed';
      showToast('Voice message failed to send', 0, 'error', false, 'voice-message-failed-to-send');
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
        buttonElement.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        `;
      } else {
        // Pause playback
        existingAudio.pause();
        buttonElement.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
      }
      return;
    }

    const voiceUrl = voiceMessageElement.dataset.voiceUrl;
    const pqEncSharedKey = voiceMessageElement.dataset.pqencsharedkey;
    const selfKey = voiceMessageElement.dataset.selfkey;
    const msgIdx = voiceMessageElement.dataset.msgIdx;

    if (!voiceUrl) {
      showToast('Voice message URL not found', 0, 'error', false, 'voice-message-url-not-found');
      return;
    }

    try {
      // Check if it's our own message or received message
      const message = myData.contacts[this.address].messages[msgIdx];
      const isMyMessage = message.my;

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
      const seekEl = voiceMessageElement.querySelector('.voice-message-seek');
      const timeDisplayElement = voiceMessageElement.querySelector('.voice-message-time-display');
      const totalDurationSeconds = message.duration || Math.floor(audio.duration) || 0;
      if (seekEl) {
        // Ensure max reflects known duration; fall back to audio.metadata once loaded
        seekEl.max = totalDurationSeconds;
      }
      // If user set a seek position before playback, honor it after metadata loads
      audio.addEventListener('loadedmetadata', () => {
        const metaDuration = Math.floor(audio.duration) || totalDurationSeconds;
        if (seekEl) {
          seekEl.max = metaDuration;
          const preVal = Number(seekEl.value || 0);
          if (preVal > 0 && preVal < metaDuration) {
            try { audio.currentTime = preVal; } catch (e) { /* ignore */ }
          } else if (voiceMessageElement.pendingSeekTime !== undefined) {
            const pst = voiceMessageElement.pendingSeekTime;
            if (pst >= 0 && pst < metaDuration) {
              try { audio.currentTime = pst; } catch (e) { /* ignore */ }
            }
            delete voiceMessageElement.pendingSeekTime;
          }
        }
      }, { once: true });
      
      // Update UI to show playing state and enable button for pause functionality
      buttonElement.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
      buttonElement.disabled = false; // Enable button for pause functionality
      
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
          if (timeDisplayElement) {
            const currentTime = this.formatDuration(newTime);
            const totalTime = this.formatDuration(totalDurationSeconds);
            timeDisplayElement.textContent = `${currentTime} / ${totalTime}`;
          }
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
        // Reset UI
        buttonElement.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
        buttonElement.disabled = false;
        if (timeDisplayElement) {
          // Get the original duration from the voice message data
          const originalDuration = this.formatDuration(totalDurationSeconds);
          timeDisplayElement.textContent = `0:00 / ${originalDuration}`;
        }
        if (seekEl) seekEl.value = 0;
        // Clean up audio element and URL
        delete voiceMessageElement.audioElement;
        URL.revokeObjectURL(voiceMessageElement.audioUrl);
        delete voiceMessageElement.audioUrl;
      };
      
      audio.onerror = (error) => {
        console.error('Error playing voice message:', error);
        showToast('Error playing voice message', 0, 'error', false, 'error-playing-voice-message');
        buttonElement.disabled = false;
        if (seekEl) seekEl.value = 0;
        // Clean up on error
        delete voiceMessageElement.audioElement;
        if (voiceMessageElement.audioUrl) {
          URL.revokeObjectURL(voiceMessageElement.audioUrl);
          delete voiceMessageElement.audioUrl;
        }
      };
      
      // Start playing
      await audio.play();
      
    } catch (error) {
      console.error('Error playing voice message:', error);
      showToast(`Error playing voice message: ${error.message}`, 0, 'error');
      buttonElement.disabled = false;
    }
  }

  // ---- Call scheduling helpers ----
  isFutureCall(ts) {
    return typeof ts === 'number' && ts > getCorrectedTimestamp();
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
    this.template = document.getElementById('callInviteContactTemplate');
    this.inviteCounter = document.getElementById('callInviteCounter');
    this.inviteSendButton = document.getElementById('callInviteSendBtn');
    this.cancelButton = document.getElementById('callInviteCancelBtn');
    this.closeButton = document.getElementById('closeCallInviteModal');

    this.contactsList.addEventListener('change', this.updateCounter.bind(this));
    this.inviteSendButton.addEventListener('click', this.sendInvites.bind(this));
    this.cancelButton.addEventListener('click', () => {
      console.log('Invite modal cancelled');
      this.close();
    });
    this.closeButton.addEventListener('click', this.close.bind(this));
  }

  /**
   * Opens the invite modal and populates contact list.
   * @param {HTMLElement} messageEl
   */
  open(messageEl) {
    this.messageEl = messageEl;

    this.contactsList.innerHTML = '';
    this.modal.classList.add('active');

    // Build contacts list (exclude the current chat participant and self) and group by status
    const allContacts = Object.values(myData.contacts || {})
      .filter(c => c.address !== chatModal.address && c.address !== myAccount.address)
      .map(c => ({
        address: c.address,
        username: c.username || c.address,
        friend: c.friend || 1
      }));

    // Group contacts by friend status: friends (3), acquaintances (2), others (1), blocked (0)
    const groups = {
      friends: allContacts.filter(c => c.friend === 3).sort((a,b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase())),
      acquaintances: allContacts.filter(c => c.friend === 2).sort((a,b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase())),
      others: allContacts.filter(c => ![2,3,0].includes(c.friend)).sort((a,b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase())),
    };

    const sectionMeta = [
      { key: 'friends', label: 'Friends' },
      { key: 'acquaintances', label: 'Connections' },
      { key: 'others', label: 'Tolled' },
    ];

    for (const { key, label } of sectionMeta) {
      const list = groups[key];
      if (!list || list.length === 0) continue;
      const header = document.createElement('div');
      header.className = 'call-invite-section-header';
      header.textContent = label;
      this.contactsList.appendChild(header);

      for (const contact of list) {
        const clone = this.template.content ? this.template.content.cloneNode(true) : null;
        if (!clone) continue;
        const row = clone.querySelector('.call-invite-contact-row');
        const checkbox = clone.querySelector('.call-invite-contact-checkbox');
        const nameSpan = clone.querySelector('.call-invite-contact-name');
        if (row) row.dataset.address = contact.address || '';
        if (checkbox) {
          checkbox.value = contact.address || '';
          checkbox.id = `invite_cb_${(contact.address||'').replace(/[^a-zA-Z0-9]/g,'')}`;
        }
        if (nameSpan) nameSpan.textContent = contact.username || contact.address || 'Unknown';
        const labelEl = clone.querySelector('.call-invite-contact-label');
        if (labelEl && checkbox) {
            labelEl.addEventListener('click', (ev) => {
              // If the checkbox is disabled (max reached), do nothing
              if (checkbox.disabled) return;
              if (ev.target === checkbox) return;
              ev.preventDefault();
              checkbox.checked = !checkbox.checked;
              this.updateCounter();
            });
        }
        this.contactsList.appendChild(clone);
      }
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

  updateCounter() {
    const selected = this.contactsList.querySelectorAll('.call-invite-contact-checkbox:checked').length;
    this.inviteCounter.textContent = `${selected} selected (max 10)`;
    this.inviteSendButton.disabled = selected === 0;
    // enforce max 10: disable unchecked boxes when limit reached
    const unchecked = Array.from(this.contactsList.querySelectorAll('.call-invite-contact-checkbox:not(:checked)'));
    if (selected >= 10) {
      unchecked.forEach(cb => cb.disabled = true);
    } else {
      unchecked.forEach(cb => cb.disabled = false);
    }
  }

  async sendInvites() {
    const selectedBoxes = Array.from(this.contactsList.querySelectorAll('.call-invite-contact-checkbox:checked'));
    const addresses = selectedBoxes.map(cb => cb.value).slice(0,10);
    // get call link from original message
    const msgCallLink = this.messageEl.querySelector('.call-message a')?.href;
    if (!msgCallLink) return showToast('Call link not found', 2000, 'error');
    let msgCallTime = Number(this.messageEl.getAttribute('data-call-time')) || 0;
    this.inviteSendButton.disabled = true;
    this.inviteSendButton.textContent = 'Sending...';

    try {
      for (const addr of addresses) {
        const keys = myAccount.keys;
        if (!keys) {
          showToast('Keys not found', 0, 'error', false, 'keys-not-found-call-invite');
          break;
        }

        const payload = { type: 'call', url: msgCallLink, callTime: msgCallTime };
        console.log('payload', payload);

        let messagePayload = {}
        const contact = myData.contacts[addr];
        const ok = await ensureContactKeys(addr);
        if (!ok) {
          showToast(`Skipping ${contact.username || addr} (cannot get public key)`, 2000, 'warning');
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
        const tollRequiredToSend = chatIdAccount.toll?.required?.[toIndex] ?? 1;
        let toll = 0n;
        if (tollRequiredToSend === 1) {
          const contactData = await queryNetwork(`/account/${longAddress(addr)}`);
          if (!contactData || !contactData.account) {
            showToast(`Skipping ${contact.username || addr} (account not found)`, 2000, 'warning');
            continue;
          }
          const tollUnit = contactData.account?.data?.tollUnit || 'LIB';
          const factor = getStabilityFactor();
          if (tollUnit === 'USD') {
            // Convert toll to LIB
            toll = bigxnum2big(contactData.account.data.toll, (1.0 / factor).toString());
          } else {
            toll = contactData.account.data.toll;
          }
        }

        const messageObj = await chatModal.createChatMessage(addr, messagePayload, toll, keys);
        // set callType to true if callTime is within 5 minutes of now or after callTime
        if (payload?.callTime <= getCorrectedTimestamp() + 5 * 60 * 1000) {
          messageObj.callType = true
        }
        await signObj(messageObj, keys);
        const txid = getTxid(messageObj);
        await injectTx(messageObj, txid);

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
          console.log('call message failed to send', response);
          updateTransactionStatus(txid, addr, 'failed', 'message');
          if (chatModal.isActive() && chatModal.address === addr) {
            chatModal.appendChatModal();
          }
        }
        showToast(`Call invite sent to ${contact.username || addr}`, 3000, 'success');
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
    this.onSelect = null; // function(choice)
  }

  load() {
    this.modal = document.getElementById('callScheduleChoiceModal');
    if (!this.modal) return;
    this.nowBtn = document.getElementById('callScheduleNowBtn');
    this.scheduleBtn = document.getElementById('openCallScheduleDateBtn');
    this.cancelBtn = document.getElementById('cancelCallScheduleChoice');
    this.closeBtn = document.getElementById('closeCallScheduleChoiceModal');

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
  }

  _select(value) {
    if (this.modal) this.modal.classList.remove('active');
    const cb = this.onSelect;
    this.onSelect = null;
    if (cb) cb(value);
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
    this.submitBtn = null;
    this.cancelBtn = null;
    this.closeBtn = null;
    this.onDone = null; // function(timestamp|null)
    this.DEFAULT_OFFSET_MINUTES = 0;
    this.clockTimer = new ClockTimer('callScheduleCurrentTime');
    this._onSubmit = this._onSubmit.bind(this);
    this._onSubmitBtn = this._onSubmitBtn.bind(this);
    this._onCancel = this._onCancel.bind(this);
  }

  load() {
    this.modal = document.getElementById('callScheduleDateModal');
    if (!this.modal) return;
    this.form = document.getElementById('callScheduleDateForm');
    this.dateInput = document.getElementById('callScheduleDate');
    this.hourSelect = document.getElementById('callScheduleHour');
    this.minuteSelect = document.getElementById('callScheduleMinute');
    this.ampmSelect = document.getElementById('callScheduleAmPm');
    this.submitBtn = document.getElementById('confirmCallSchedule');
    this.cancelBtn = document.getElementById('cancelCallScheduleDate');
    this.closeBtn = document.getElementById('closeCallScheduleDateModal');

    if (this.form) this.form.addEventListener('submit', this._onSubmit);
    if (this.submitBtn) this.submitBtn.addEventListener('click', this._onSubmitBtn);
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', this._onCancel);
    if (this.closeBtn) this.closeBtn.addEventListener('click', this._onCancel);
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
      this.dateInput.value = this._formatDateInput(defaultDate);
    }
    this.modal?.classList.add('active');
    this.clockTimer.start();
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

  _submitValue() {
    if (!this.dateInput || !this.hourSelect || !this.minuteSelect || !this.ampmSelect) return;
    const dateVal = this.dateInput.value;
    const hourVal = this.hourSelect.value;
    const minuteVal = this.minuteSelect.value;
    const ampmVal = this.ampmSelect.value;
    if (!dateVal || hourVal === '' || minuteVal === '') {
      showToast('Please pick a date and time', 0, 'error', false, 'please-pick-a-date-and-time');
      return;
    }
    const parsed = this._parseDateInput(dateVal);
    const hour12 = Number(hourVal);
    const minute = Number(minuteVal);
    if (!parsed || Number.isNaN(hour12) || Number.isNaN(minute)) {
      showToast('Invalid date/time selected', 0, 'error', false, 'invalid-date-time-selected');
      return;
    }
    const hour24 = this._convert12To24(hour12, ampmVal);
    const { year, month, day } = parsed;
    const localMs = new Date(year, month - 1, day, hour24, minute, 0, 0).getTime();
    const corrected = localMs + timeSkew;
    const nowCorrected = getCorrectedTimestamp();
    const minAllowed = nowCorrected - 5 * 60 * 1000;
    if (corrected < minAllowed) {
      showToast('Please choose a date or time in the future', 0, 'error', false, 'call-schedule-date-modal-future-time');
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
    const messageContent = messageEl.querySelector('.message-content')?.textContent;
    const txid = messageEl.dataset.txid;

    if (chatModal.messageInput && chatModal.retryOfTxId && messageContent && txid) {
      chatModal.messageInput.value = messageContent;
      chatModal.retryOfTxId.value = txid;
      chatModal.messageInput.focus();
    } else {
      console.error('Error preparing message retry: Necessary elements or data missing.');
    }
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
    console.log('Opening voice recording modal');
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
      showToast('Could not access microphone. Please check permissions.', 0, 'error', false, 'microphone-permission-error');
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
        showToast('Error playing voice message', 0, 'error', false, 'error-playing-voice-message');
        URL.revokeObjectURL(audioUrl);
        this.stopListening();
      };
      
      audio.play().catch(error => {
        console.error('Error playing voice message:', error);
        showToast('Error playing voice message', 0, 'error', false, 'error-playing-voice-message');
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

      const uploadUrl = 'https://inv.liberdus.com:2083';
      const response = await fetch(`${uploadUrl}/post`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const { id } = await response.json();
      if (!id) throw new Error('No file ID returned from upload');

      const voiceMessageUrl = `${uploadUrl}/get/${id}`;
      
      // Send the voice message through chat modal
      await chatModal.sendVoiceMessageTx(voiceMessageUrl, duration, pqEncSharedKey, selfKey);

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
    footer.closeNewChatButton();
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
    this.toggleMoreOptions = document.getElementById('toggleMoreOptions');
    this.moreOptionsSection = document.getElementById('moreOptionsSection');

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
      showToast(`Failed to fetch network parameters, try again later.`, 0, 'error', false, 'failed-to-fetch-network-parameters');
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
        console.log(`DEBUG: handleCreateAccount error`, JSON.stringify(error, null, 2));
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

    await getNetworkParams();
    const scalabilityFactor = getStabilityFactor();

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
    const feeInWei = getTransactionFeeWei();
    const maxAmount = BigInt(asset.balance) - feeInWei;
    const maxAmountStr = big2str(maxAmount > 0n ? maxAmount : 0n, 18).slice(0, -16);

    // Check if we're in USD mode
    const isUSD = this.balanceSymbol.textContent === 'USD';

    if (isUSD) {
      // Convert to USD before displaying
      const scalabilityFactor = getStabilityFactor();
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
    const txFeeInLIB = getTransactionFeeWei();
    const scalabilityFactor = getStabilityFactor();

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
      showToast('No addresses available', 0, 'error', false, 'no-addresses-available');
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
      const scalabilityFactor = getStabilityFactor();
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
        const factor = getStabilityFactor();
        let amountInLIB = amount;
        let tollInLIB = this.tollInfo.toll;
        if (this.tollInfo.tollUnit !== 'LIB') {
          tollInLIB = bigxnum2big(this.tollInfo.toll, (1.0 / factor).toString());
        }
        console.log(
          `toll > amount  ${big2str(tollInLIB, 8)} > ${big2str(amountInLIB, 8)} : ${tollInLIB > amountInLIB}`
        );
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
    const scalabilityFactor = getStabilityFactor();

    // Get the raw values in LIB format
    const asset = myData.wallet.assets[this.assetSelectDropdown.value];
    const txFeeInWei = getTransactionFeeWei();
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
          showToast('Error processing image', 0, 'error', false, 'error-processing-image');
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
              showToast('Internal error handling QR data', 0, 'error', false, 'internal-error-handling-qr-data');
            }
          } else {
            // qr.decodeQR might throw an error instead of returning null/undefined
            // This else block might not be reached if errors are always thrown
            console.error('No QR code found in image (qr.js)');
            showToast('No QR code found in image', 0, 'error', false, 'no-qr-code-found-in-image');
            // Clear the form fields in case of failure to find QR code
            targetModal.resetForm();
          }
        } catch (error) {
          console.error('Error processing QR code image with qr.js:', error);
          // Assume error means no QR code found or decoding failed
          showToast('Could not read QR code from image', 0, 'error', false, 'could-not-read-qr-code-from-image');
          // Clear the form fields in case of error
          targetModal.resetForm();

        } finally {
          event.target.value = ''; // Reset the file input value regardless of outcome
        }
      };
      img.onerror = function () {
        console.error('Error loading image');
        showToast('Error loading image file', 0, 'error', false, 'error-loading-image-file');
        event.target.value = ''; // Reset the file input value
        // Clear the form fields in case of image loading error
        targetModal.resetForm();
      };
      img.src = e.target.result;
    };

    reader.onerror = function () {
      console.error('Error reading file');
      showToast('Error reading file', 0, 'error', false, 'error-reading-file');
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
    console.log('Attempting to fill payment form from QR:', data);

    // Explicitly check for the required prefix
    if (!data || !data.startsWith('liberdus://')) {
      console.error("Invalid payment QR code format. Missing 'liberdus://' prefix.", data);
      showToast('Invalid payment QR code format.', 0, 'error', false, 'invalid-payment-qr-format');
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
      showToast('Failed to parse payment QR data.', 0, 'error', false, 'failed-to-parse-payment-qr-data');
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
      showToast('You cannot send assets to yourself', 0, 'error', false, 'you-cannot-send-assets-to-yourself');
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
      showToast(`Insufficient balance: ${amountStr} + ${feeStr} (fee) > ${balanceStr} LIB`, 0, 'error', false, `insufficient-balance-${amountStr}-${feeStr}-${balanceStr}`);
      cancelButton.disabled = false;
      return;
    }

    // Validate username - must be username; address not supported
    if (username.startsWith('0x')) {
      showToast('Address not supported; enter username instead.', 0, 'error', false, 'address-not-supported-enter-username-instead');
      cancelButton.disabled = false;
      return;
    }
    if (username.length < 3) {
      showToast('Username too short', 0, 'error', false, 'username-too-short');
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
        showToast('Username not found', 0, 'error', false, 'username-not-found');
        cancelButton.disabled = false;
        return;
      }
      toAddress = normalizeAddress(data.address);
    } catch (error) {
      console.error('Error looking up username:', error);
      showToast('Error looking up username', 0, 'error', false, 'error-looking-up-username');
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
      if (myData.contacts[toAddress]?.friend === 3) {
        // Create sender info object
        senderInfo = {
          username: myAccount.username,
          name: myData.account.name,
          email: myData.account.email,
          phone: myData.account.phone,
          linkedin: myData.account.linkedin,
          x: myData.account.x,
        };
      } else {
        senderInfo = {
          username: myAccount.username,
        };
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

  /**
   * Toggle LIB/USD display for the receive amount and update the QR accordingly
   */
  async handleToggleBalance() {
    try {
      this.receiveBalanceSymbol.textContent = this.receiveBalanceSymbol.textContent === 'LIB' ? 'USD' : 'LIB';

      const isLib = this.receiveBalanceSymbol.textContent === 'LIB';

      await getNetworkParams();
      const scalabilityFactor = getStabilityFactor();

      if (this.amountInput && this.amountInput.value.trim() !== '') {
        const currentValue = parseFloat(this.amountInput.value);
        if (!isNaN(currentValue)) {
          if (!isLib) {
            // now showing USD, convert LIB -> USD
            this.amountInput.value = (currentValue * scalabilityFactor).toString();
          } else {
            // now showing LIB, convert USD -> LIB
            this.amountInput.value = (currentValue / scalabilityFactor).toString();
          }
        }
      }

      this.updateQRCode();
    } catch (err) {
      console.error('Error toggling receive balance:', err);
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
    console.log('handleSubmit');

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
      console.log('processing account: ', username, netid, section);  
      // Start processing this account
      if (section === 'mine') {
        this.migrateAccountData(username, netid, parameters.networkId)
        await new Promise(resolve => setTimeout(resolve, 100));
      } else if (section === 'available') {
        myData = loadState(username+'_'+netid)
        if (myData){ 
          const res = await postRegisterAlias(username, myData.account.keys)
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
console.log('migrating ',username,'checking txid', txid)
        const result = await checkPendingTransaction(txid, submittedts); // return true, false or null
console.log('    result is',result)
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
    console.log(`Updated accounts registry for ${username}: removed from ${oldNetid}, added to ${newNetid}`);
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
      showToast('Passwords do not match. Please try again.', 0, 'error', false, 'passwords-do-not-match');
      return;
    }

    // loading toast
    let waitingToastId = showToast('Updating password...', 0, 'loading');

    // if old password is visible, check if it is correct
    if (this.oldPasswordInput.style.display !== 'none') {
      // check if old password is empty
      if (oldPassword.length === 0) {
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Please enter your old password.', 0, 'error', false, 'please-enter-your-old-password');
        return;
      }

      // decrypt the old password
      const key = await passwordToKey(oldPassword);
      if (!key) {
        // remove the loading toast
        if (waitingToastId) hideToast(waitingToastId);
        showToast('Invalid password. Please try again.', 0, 'error', false, 'invalid-password');
        return;
      }
      if (key !== localStorage.lock) {
        // remove the loading toast
        if (waitingToastId) hideToast(waitingToastId);
        // clear the old password input
        this.oldPasswordInput.value = '';
        showToast('Invalid password. Please try again.', 0, 'error', false, 'invalid-password');
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
        showToast('Invalid password. Please try again.', 0, 'error', false, 'invalid-password');
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
      showToast('Failed to encrypt password. Please try again.', 0, 'error', false, 'failed-to-encrypt-password');
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
      showToast('Invalid password. Please try again.', 0, 'error', false, 'invalid-password');
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
      showToast('Invalid password. Please try again.', 0, 'error', false, 'invalid-password');
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
      showToast('Please enter a URL', 0, 'error', false, 'please-enter-a-url');
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
  }

  load() {
    if (this.isReactNativeWebView) {
      console.log('🌐 Initializing React Native WebView Communication');
      this.captureInitialViewportHeight();

      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'background') {
            this.handleNativeAppSubscribe();
            // if chatModal was opened, save the last message count
            if (chatModal.isActive() && chatModal.address) {
              const contact = myData.contacts[chatModal.address];
              chatModal.lastMessageCount = contact?.messages?.length || 0;
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
              console.log('🔔 You are signed in to the account that received the message');
            } else {
              // We're signed in to a different account, ask user what to do
              const shouldSignOut = confirm('You received a message for a different account. Would you like to sign out to switch to that account?');
              this.saveNotificationAddress(normalizedToAddress);
              if (shouldSignOut) {
                // Sign out and save the notification address for priority
                menuModal.handleSignOut();
              } else {
                console.log('User chose to stay signed in - notified account will appear first next time');
              }
            }
          }

          if (data.type === 'ALL_NOTIFICATIONS_IN_PANEL') {
            if (data.notifications && Array.isArray(data.notifications) && data.notifications.length > 0) {
              let processedCount = 0;
              data.notifications.forEach((notification, index) => {
                try {
                  // Extract address from notification body text
                  if (notification?.body && typeof notification.body === 'string') {
                    // Look for pattern "to 0x..." in the body
                    // expecting to just return one address
                    const addressMatch = notification.body.match(/to\s+(\S+)/);
                    if (addressMatch && addressMatch[1]) {
                      const normalizedToAddress = normalizeAddress(addressMatch[1]);
                      this.saveNotificationAddress(normalizedToAddress);
                      processedCount++;
                    }
                  }
                } catch (error) {
                  console.warn(`📋 Error processing notification ${index}:`, error);
                }
              });
              // If the sign in modal is open, update the display to show new notifications
              if (signInModal.isActive()) {
                signInModal.updateNotificationDisplay();
              }
            } else {
              console.log('📋 No valid notifications received');
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
    console.log('📏 Capturing initial viewport height:', currentHeight);
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

      console.log('⌨️ Native keyboard detection:', {
        keyboardHeight,
        inputBottom,
        keyboardTop,
        needsManualHandling
      });

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

  /**
   * Save the notification address to localStorage array of addresses
   * @param {string} contactAddress - The address of the contact to save
   */
  saveNotificationAddress(contactAddress) {
    if (!contactAddress || typeof contactAddress !== 'string') return;
    
    try {
      const addresses = this.getNotificationAddresses();
      if (!addresses.includes(contactAddress)) {
        addresses.push(contactAddress);
        localStorage.setItem('lastNotificationAddresses', JSON.stringify(addresses));
        console.log(`✅ Saved notification address: ${contactAddress}`);
      }
    } catch (error) {
      console.error('❌ Error saving notification address:', error);
    }
  }

  /**
   * Clear only selected address from the array
   * @param {string} address - The address to clear
   */
  clearNotificationAddress(address) {
    if (!address || typeof address !== 'string') return;
    
    try {
      const addresses = this.getNotificationAddresses();
      const index = addresses.indexOf(address);
      if (index !== -1) {
        addresses.splice(index, 1);
        localStorage.setItem('lastNotificationAddresses', JSON.stringify(addresses));
        console.log(`✅ Cleared notification address: ${address}`);
      }
    } catch (error) {
      console.error('❌ Error clearing notification address:', error);
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
  sendClearNotifications() {
    this.postMessage({
      type: 'CLEAR_NOTI'
    });
  }

  /**
   * Safely retrieve notification addresses from localStorage
   * @returns {Array} Array of notification addresses, empty array if none or error
   */
  getNotificationAddresses() {
    try {
      const stored = localStorage.getItem('lastNotificationAddresses');
      if (!stored) return [];
      
      const parsed = parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('⚠️ Failed to parse notification addresses:', error);
      return [];
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
      console.log('handleNativeAppSubscribe: Device is offline, skipping subscription');
      return;
    }

    const deviceToken = this.deviceToken || null;
    const expoPushToken = this.expoPushToken || null;
    const fcmToken = this.fcmToken || null;
    const voipToken = this.voipToken || null;
    
    if (deviceToken && expoPushToken) {
      console.log('Native app subscription tokens detected:', { deviceToken, expoPushToken, fcmToken, voipToken });
      
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
          showToast('No gateway available', 0, 'error', false, 'no-gateway-available');
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

  /**
   * Unsubscribe the native app from push notifications for the current account.
   * If other accounts are on the device, it updates the subscription to only include them.
   * If this is the last account, it fully unsubscribes the device.
   */
  async handleNativeAppUnsubscribe() {
    // Early return if running on Android device in React Native WebView
    if (window.ReactNativeWebView && navigator.userAgent.toLowerCase().includes('android')) {
      console.log('handleNativeAppUnsubscribe: Skipping unsubscribe on Android device');
      return;
    }

    // Check if we're online before proceeding
    if (!isOnline) {
      console.log('handleNativeAppUnsubscribe: Device is offline, skipping unsubscribe');
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

  sendScheduledCall(username, timestamp){
    this.postMessage({
      type: 'SCHEDULE_CALL',
      username,
      timestamp
    });
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

async function checkPendingTransaction(txid, submittedts){
  const now = getCorrectedTimestamp();
  const duration = (now - submittedts) / 1000   // to make it in seconds
console.log('timestamp is', submittedts, 'duration is', duration)
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
    console.log('DEBUG: user is not logged in');
    return;
  }

  // initialize the pending array if it is not already initialized
  if (!myData.pending) {
    myData.pending = [];
  }

  if (myData.pending.length === 0) return; // No pending transactions to check

  const startingPendingCount = myData.pending.length;

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
          if (tollModal.isActive()) {
            showToast(`Toll change successful!`, 3000, 'success');
          }
        }

        if (type === 'update_toll_required') {
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
            myData.contacts[pendingTxInfo.to].friend = myData.contacts[pendingTxInfo.to].friendOld;
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
        showToast(`Network ID mismatch. Check network configuration in network.js.`, 0, 'error', false, 'network-id-mismatch');
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
    console.log('🔧 Loading localStorage monitor...');
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
      } else {
        console.log(`✅ Storage OK: ${(info.availableBytes / 1024).toFixed(1)}KB available`);
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
      console.log('✅ Using stored localStorage capacity:', storedCapacity);
      return parseInt(storedCapacity);
    }
    
    console.log('🔄 Calculating localStorage capacity for first time...');
    const usage = this.getLocalStorageUsage();
    const available = this.findLocalStorageAvailable(); // Only runs once!
    const totalCapacity = usage + available;
    
    localStorage.setItem(this.CAPACITY_KEY, totalCapacity.toString());
    console.log('💾 Stored localStorage capacity for future use:', totalCapacity);
    
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

function getStabilityFactor() {
  return parseFloat(parameters.current.stabilityFactorStr);
}

// returns transaction fee in wei
function getTransactionFeeWei() {
  return EthNum.toWei(EthNum.div(parameters.current.transactionFeeUsdStr, parameters.current.stabilityFactorStr)) || 1n * wei;
}


function handleBrowserBackButton(event) {
  console.log('in popstate')
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
  console.log('trying to close', modalId)
  switch (modalId) {
    case 'chatModal':
      chatModal.close();
      break;
    case 'menuModal':
      menuModal.close();
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
      console.log('Unknown modal:', modalId);
      return false;
  }
  return true; // means we closed a modal
}
