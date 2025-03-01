// Check if there is a newer version and load that using a new random url to avoid cache hits
//   Versions should be YYYY.MM.DD.HH.mm like 2025.01.25.10.05
const version = 'u'   // Also increment this when you increment version.html
let myVersion = '0'
async function checkVersion(){
    myVersion = localStorage.getItem('version') || '0';
    let newVersion;
    try {
        const response = await fetch(`version.html?${Date.now()}`);
        if (!response.ok) throw new Error('Version check failed');
        newVersion = await response.text();
    } catch (error) {
        console.error('Version check failed:', error);
        alert('Version check failed. You are offline.')
        // Only trigger offline UI if it's a network error
        if (!navigator.onLine || error instanceof TypeError) {
            isOnline = false;
            updateUIForConnectivity();
            markConnectivityDependentElements();
            console.log(`DEBUG: about to invoke showToast in checkVersion`)
        }
        newVersion = myVersion  // Allow continuing with the old version
    }
//console.log('myVersion < newVersion then reload', myVersion, newVersion)
console.log(parseInt(myVersion.replace(/\D/g, '')), parseInt(newVersion.replace(/\D/g, '')))
    if (parseInt(myVersion.replace(/\D/g, '')) < parseInt(newVersion.replace(/\D/g, ''))) {
        if (parseInt(myVersion.replace(/\D/g, '')) > 0){
            alert('Updating to new version: ' + newVersion)
        }
        localStorage.setItem('version', newVersion); // Save new version
        forceReload(['index.html','styles.css','app.js','lib.js', 'network.js'])
        const newUrl = window.location.href
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
        const absoluteUrls = urls.map(url => {
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
        const fetchPromises = absoluteUrls.map(url => 
            fetch(url, {
                cache: 'reload',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            })
        );
        const results = await Promise.all(fetchPromises);
        return results;
    } catch (error) {
        console.error('Force reload failed:', error);
        throw error;
    }
}

// https://github.com/paulmillr/noble-post-quantum
// https://github.com/paulmillr/noble-post-quantum/releases
import { ml_kem1024, randomBytes } from './noble-post-quantum.js';

// https://github.com/paulmillr/noble-secp256k1
// https://github.com/paulmillr/noble-secp256k1/raw/refs/heads/main/index.js
import * as secp from './noble-secp256k1.js'; 

// https://github.com/adraffy/keccak.js
// https://github.com/adraffy/keccak.js/blob/main/src/keccak256.js
//   permute.js and utils.js were copied into keccak256.js instead of being imported
import keccak256 from './keccak256.js';

// https://github.com/dcposch/blakejs
// https://github.com/dcposch/blakejs/blob/master/blake2b.js
//   some functions from util.js were copied into blake2b.js
import blake from './blake2b.js';

// https://github.com/shardus/lib-crypto-web/blob/main/utils/stringify.js
// Needed to stringify and parse bigints; also deterministic stringify
//   modified to use export
import { stringify, parse } from './stringify-shardus.js';

// We want to use encryption that we can see the source code for; don't use the native browser encryption
// https://github.com/paulmillr/noble-ciphers/releases
// https://github.com/paulmillr/noble-ciphers/releases/download/1.2.0/noble-ciphers.js
import { cbc, xchacha20poly1305 } from './noble-ciphers.js';

// Put standalone conversion function in lib.js
import { normalizeUsername, generateIdenticon, formatTime, 
    isValidEthereumAddress, 
    normalizeAddress, longAddress, utf82bin, bin2utf8, hex2big, bigxnum2big,
    big2str, base642bin, bin2base64, hex2bin, bin2hex,
} from './lib.js';

// Import database functions
import { STORES, saveData, getData, getAllData } from './db.js';

// Local version function to replace addVersionToData
function addVersion(data) {
    return {
        ...data,
        version: Date.now(),
        lastUpdated: Date.now()
    };
}

const myHashKey = hex2bin('69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc')
const weiDigits = 18; 
const wei = 10n**BigInt(weiDigits)
const pollIntervalNormal = 30000 // in millisconds
const pollIntervalChatting = 5000  // in millseconds
//network.monitor.url = "http://test.liberdus.com:3000"    // URL of the monitor server
//network.explorer.url = "http://test.liberdus.com:6001"   // URL of the chain explorer


let myData = null
let myAccount = null        // this is set to myData.account for convience

// TODO - get the parameters from the network
// mock network parameters
let parameters = {
    current: {
        transactionFee: 1
    }
}

async function checkOnlineStatus() {
    try {
        const url = new URL(window.location.origin);
        url.searchParams.set('rand', Math.random());
        const response = await fetch(url.toString(), { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

async function checkUsernameAvailability(username, address) {
    // Get random gateway
    const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
    const usernameBytes = utf82bin(normalizeUsername(username))
    const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32)
    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/address/${usernameHash}`);
        const data = await response.json();
        if (data && data.address){
            if (address && normalizeAddress(data.address) === normalizeAddress(address)) {
                return 'mine';
            }
            return 'taken'
        }
        if (!data){
            return 'error'
        }
        return 'available'
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

// This is for the sign in button on the welcome page
function openSignInModal() {
    // Get existing accounts
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];
    const usernames = netidAccounts?.usernames ? Object.keys(netidAccounts.usernames) : [];

    // First show the modal so we can properly close it if needed
    document.getElementById('signInModal').classList.add('active');

    // If no accounts exist, close modal and open Create Account modal
    if (usernames.length === 0) {
        closeSignInModal();
        openCreateAccountModal();
        return;
    }

    // Multiple accounts exist, show modal with select dropdown
    const usernameSelect = document.getElementById('username');
    const submitButton = document.querySelector('#signInForm button[type="submit"]');
    
    // Populate select with usernames
    usernameSelect.innerHTML = `
        <option value="">Select an account</option>
        ${usernames.map(username => `<option value="${username}">${username}</option>`).join('')}
    `;
    
    
    // Enable submit button when an account is selected
    usernameSelect.addEventListener('change', async () => {
        const username = usernameSelect.value;
        const notFoundMessage = document.getElementById('usernameNotFound');
        const options = usernameSelect.options;
        if (!username) {
            submitButton.disabled = true;
            notFoundMessage.style.display = 'none';
            return;
        }
//        const address = netidAccounts.usernames[username].keys.address;
        const address = netidAccounts.usernames[username].address;
        const availability = await checkUsernameAvailability(username, address);
//console.log('usernames.length', usernames.length);
//console.log('availability', availability);
        const removeButton = document.getElementById('removeAccountButton');
        if (usernames.length === 1 && availability === 'mine') {
//            myAccount = netidAccounts.usernames[username];
            myData = parse(localStorage.getItem(`${username}_${netid}`));
            if (!myData) { console.log('Account data not found'); return }
            myAccount = myData.account
            closeSignInModal();
            document.getElementById('welcomeScreen').style.display = 'none';
            switchView('chats');
            return;
        } else if (availability === 'mine') {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign In';
            submitButton.style.display = 'inline';
            removeButton.style.display = 'none';
            notFoundMessage.style.display = 'none';
        } else if (availability === 'taken') {
            submitButton.style.display = 'none';
            removeButton.style.display = 'inline';
            notFoundMessage.textContent = 'taken';
            notFoundMessage.style.display = 'inline';
        } else if (availability === 'available') {
            submitButton.disabled = false;
            submitButton.textContent = 'Recreate';
            submitButton.style.display = 'inline';
            removeButton.style.display = 'inline';
            notFoundMessage.textContent = 'not found';
            notFoundMessage.style.display = 'inline';
        } else {
            submitButton.disabled = true;
            submitButton.textContent = 'Sign In';
            submitButton.style.display = 'none';
            removeButton.style.display = 'none';
            notFoundMessage.textContent = 'network error';
            notFoundMessage.style.display = 'inline';
        }
    });
    // TODO move the removeButton stuff to its own handleRemoveButton function; it does not belong here
    // Add event listener for remove account button
    const removeButton = document.getElementById('removeAccountButton');
    removeButton.addEventListener('click', async () => {
        const username = usernameSelect.value;
        if (!username) return;
        const confirmed = confirm(`Are you sure you want to remove account "${username}"?`);
        if (!confirmed) return;

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
        window.location.reload();
    });
    // Initially disable submit button
    submitButton.disabled = true;
    // If only one account exists, select it and trigger change event
    if (usernames.length === 1) {
        usernameSelect.value = usernames[0];
        usernameSelect.dispatchEvent(new Event('change'));
        return;
    }   
}

function closeSignInModal() {
    document.getElementById('signInModal').classList.remove('active');
}

function openCreateAccountModal() {
    document.getElementById('createAccountModal').classList.add('active');
    const usernameInput = document.getElementById('newUsername');
    
    // Check availability on input changes
    let checkTimeout;
    usernameInput.addEventListener('input', (e) => {
        const username = e.target.value;
        const usernameAvailable = document.getElementById('newUsernameAvailable');
        const submitButton = document.querySelector('#createAccountForm button[type="submit"]');
        
        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }
        
        // Reset display
        usernameAvailable.style.display = 'none';
        submitButton.disabled = true;
        
        // Check if username is too short
        if (username.length < 3) {
            usernameAvailable.textContent = 'too short';
            usernameAvailable.style.color = '#dc3545';
            usernameAvailable.style.display = 'inline';
            return;
        }
        
        // Check network availability
        checkTimeout = setTimeout(async () => {
            const taken = await checkUsernameAvailability(username);
            if (taken == 'taken') {
                usernameAvailable.textContent = 'taken';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            } else if (taken == 'available') {
                usernameAvailable.textContent = 'available';
                usernameAvailable.style.color = '#28a745';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = false;
            } else {
                usernameAvailable.textContent = 'network error';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            }
        }, 1000);
    });
}

function closeCreateAccountModal() {
    document.getElementById('createAccountModal').classList.remove('active');
}

async function handleCreateAccount(event) {
    event.preventDefault();
    const username = normalizeUsername(document.getElementById('newUsername').value)
    
    // Get network ID from network.js
    const { netid } = network;
    
    // Get existing accounts or create new structure
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    
    // Ensure netid and usernames objects exist
    if (!existingAccounts.netids[netid]) {
        existingAccounts.netids[netid] = { usernames: {} };
    }

    // Get private key from input or generate new one
    const providedPrivateKey = document.getElementById('newPrivateKey').value;
    const privateKeyError = document.getElementById('newPrivateKeyError');
    let privateKey, privateKeyHex;
    
    if (providedPrivateKey) {
        // Validate and normalize private key
        const validation = validatePrivateKey(providedPrivateKey);
        if (!validation.valid) {
            privateKeyError.textContent = validation.message;
            privateKeyError.style.color = '#dc3545';
            privateKeyError.style.display = 'inline';
            return;
        }
        
        privateKey = hex2bin(validation.key);
        privateKeyHex = validation.key;
        privateKeyError.style.display = 'none';
    } else {
        privateKey = secp.utils.randomPrivateKey();
        privateKeyHex = bin2hex(privateKey);
    }

    function validatePrivateKey(key) {
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
                message: 'Invalid characters - only 0-9 and a-f allowed'
            };
        }
        
        // Validate length (64 chars for 32 bytes)
        if (key.length !== 64) {
            return {
                valid: false,
                message: 'Invalid length - must be 64 hex characters'
            };
        }
        
        return {
            valid: true,
            key: key
        };
    }
    
    // Generate uncompressed public key
    const publicKey = secp.getPublicKey(privateKey, false);
    const publicKeyHex = bin2hex(publicKey);
    const pqSeed = bin2hex(randomBytes(64));
    
    // Generate address from public key
    const address = keccak256(publicKey.slice(1)).slice(-20);
    const addressHex = bin2hex(address);

    // Create new account entry
    myAccount = {
        netid,
        username,
        chatTimestamp: 0,
        keys: {
            address: addressHex,
            public: publicKeyHex,
            secret: privateKeyHex,
            type: "secp256k1",
            pqSeed: pqSeed,  // store only the 64 byte seed instead of 32,000 byte public and secret keys
        }
    };

    // Create new data entry
    myData = newDataRecord(myAccount);
    const res = await postRegisterAlias(username, myAccount.keys);

    if (res && (res.error || !res.result.success)) {
//console.log('no res', res)
        if (res?.result?.reason){
            alert(res.result.reason)
        }
        return;
    }

    // Store updated accounts back in localStorage
//    existingAccounts.netids[netid].usernames[username] = myAccount;
    existingAccounts.netids[netid].usernames[username] = {address: myAccount.keys.address};
    localStorage.setItem('accounts', stringify(existingAccounts));
    
    // Store the account data in localStorage
    localStorage.setItem(`${username}_${netid}`, stringify(myData));

    requestNotificationPermission();

    // Close modal and proceed to app
    closeCreateAccountModal();
    document.getElementById('welcomeScreen').style.display = 'none';
    getChats.lastCall = Date.now() // since we just created the account don't check for chat messages
    switchView('chats'); // Default view
}

// This is for the sign in button after selecting an account
async function handleSignIn(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const submitButton = document.querySelector('#signInForm button[type="submit"]');

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
    if (submitButton.textContent === 'Recreate') {
        const privateKey = existingAccounts.netids[netid].usernames[username].keys.secret;
        const newUsernameInput = document.getElementById('newUsername');
        newUsernameInput.value = username;
        closeSignInModal();
        openCreateAccountModal();
        // Dispatch a change event to trigger the availability check
        newUsernameInput.dispatchEvent(new Event('input'));

        document.getElementById('newPrivateKey').value = privateKey;
        closeSignInModal();
        openCreateAccountModal();
        return;
    }

    myData = parse(localStorage.getItem(`${username}_${netid}`));
    if (!myData) { console.log('Account data not found'); return }
    myAccount = myData.account;

    requestNotificationPermission();

    // Close modal and proceed to app
    closeSignInModal();
    document.getElementById('welcomeScreen').style.display = 'none';
    await switchView('chats'); // Default view
}

function newDataRecord(myAccount){
    const myData = {
        timestamp: Date.now(),
        account: myAccount,
        network: {
            gateways: []
        },
        contacts: {},
        chats: [],
        wallet: {
            networth: 0.0,
            timestamp: 0,           // last balance update timestamp
            priceTimestamp: 0,      // last time when prices were updated
            assets: [
                {
                    id: "liberdus",
                    name: "Liberdus",
                    symbol: "LIB",
                    img: "images/lib.png",
                    chainid:2220,
                    contract: "041e48a5b11c29fdbd92498eb05573c52728398c",
                    price: 1.0,
                    balance: 0n,
                    networth: 0.0,
                    addresses: [            // TODO remove addresses and only the address in myData.account.keys.address
                        {
                            address: myAccount.keys.address,
                            balance: 0n,
                        }
                    ]
                }
            ],
            history: [],
        },
        state: {
            unread: 0
        },
        settings: {
            encrypt: true,
            toll: 1
        }
    }
    return myData
}

// Generate deterministic color from hash
function getColorFromHash(hash, index) {
    const hue = parseInt(hash.slice(index * 2, (index * 2) + 2), 16) % 360;
    const saturation = 60 + (parseInt(hash.slice((index * 2) + 2, (index * 2) + 4), 16) % 20);
    const lightness = 45 + (parseInt(hash.slice((index * 2) + 4, (index * 2) + 6), 16) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Function to open the About modal
function openAboutModal() {
    document.getElementById('aboutModal').classList.add('active');
    document.getElementById('versionDisplayAbout').textContent = myVersion + ' '+version;
    document.getElementById('networkNameAbout').textContent = network.name;
    document.getElementById('netIdAbout').textContent = network.netid;
}

// Function to close the About modal
function closeAboutModal() {
    document.getElementById('aboutModal').classList.remove('active');
}

// Load saved account data and update chat list on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize service worker first
    if ('serviceWorker' in navigator) {
        await registerServiceWorker();
        setupServiceWorkerMessaging(); 
        setupAppStateManagement();
        setupConnectivityDetection();
    }

    checkVersion()
    document.getElementById('versionDisplay').textContent = myVersion + ' '+version;
    document.getElementById('networkNameDisplay').textContent = network.name;

    // Add unload handler to save myData
    window.addEventListener('unload', handleUnload)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange);  // Keep as document
    
    // Check for existing accounts and arrange welcome buttons
    const usernames = getAvailableUsernames()
    const hasAccounts = usernames.length > 0

    const signInBtn = document.getElementById('signInButton');
    const createAccountBtn = document.getElementById('createAccountButton');
    const importAccountBtn = document.getElementById('importAccountButton');
    const welcomeButtons = document.querySelector('.welcome-buttons');

    // Reorder buttons based on accounts existence
    if (hasAccounts) {
        welcomeButtons.innerHTML = ''; // Clear existing order
        welcomeButtons.appendChild(signInBtn);
                welcomeButtons.appendChild(createAccountBtn);
                welcomeButtons.appendChild(importAccountBtn);
        signInBtn.classList.add('primary-button');
        signInBtn.classList.remove('secondary-button');
    } else {
        welcomeButtons.innerHTML = ''; // Clear existing order
        welcomeButtons.appendChild(createAccountBtn);
                welcomeButtons.appendChild(signInBtn);
        welcomeButtons.appendChild(importAccountBtn);
        createAccountBtn.classList.add('primary-button');
        createAccountBtn.classList.remove('secondary-button');
    }

    // Add event listeners
    document.getElementById('toggleMenu').addEventListener('click', toggleMenu);
    document.getElementById('closeMenu').addEventListener('click', toggleMenu);

    // About Modal
    document.getElementById('openAbout').addEventListener('click', openAboutModal);
    document.getElementById('closeAboutModal').addEventListener('click', closeAboutModal);

    // Sign In Modal
    signInBtn.addEventListener('click', openSignInModal);
    document.getElementById('closeSignInModal').addEventListener('click', closeSignInModal);
    document.getElementById('signInForm').addEventListener('submit', handleSignIn);

    // Create Account Modal
    createAccountBtn.addEventListener('click', () => {
        document.getElementById('newUsername').value = '';
        document.getElementById('newPrivateKey').value = '';
        document.getElementById('newUsernameAvailable').style.display = 'none';
        document.getElementById('newPrivateKeyError').style.display = 'none';
        openCreateAccountModal();
    });
    document.getElementById('closeCreateAccountModal').addEventListener('click', closeCreateAccountModal);
    document.getElementById('createAccountForm').addEventListener('submit', handleCreateAccount);
    
    // Import Account now opens Import File Modal
    importAccountBtn.addEventListener('click', openImportFileModal);
    
    
    // Account Form Modal
    document.getElementById('openAccountForm').addEventListener('click', openAccountForm);
    document.getElementById('openExplorer').addEventListener('click', () => {
        window.open(network.explorer.url, '_blank');
    });
    document.getElementById('openMonitor').addEventListener('click', () => {
        window.open(network.monitor.url, '_blank');
    });
    document.getElementById('closeAccountForm').addEventListener('click', closeAccountForm);
    document.getElementById('accountForm').addEventListener('submit', handleAccountUpdate);
//            document.getElementById('openImportFormMenu').addEventListener('click', openImportFileModal);
    document.getElementById('closeImportForm').addEventListener('click', closeImportFileModal);
    document.getElementById('importForm').addEventListener('submit', handleImportFile);
    
    document.getElementById('openExportForm').addEventListener('click', openExportForm);
    document.getElementById('closeExportForm').addEventListener('click', closeExportForm);
    document.getElementById('exportForm').addEventListener('submit', handleExport);
    
    // Remove Account Modal
    document.getElementById('openRemoveAccount').addEventListener('click', openRemoveAccountModal);
    document.getElementById('closeRemoveAccountModal').addEventListener('click', closeRemoveAccountModal);
    document.getElementById('confirmRemoveAccount').addEventListener('click', handleRemoveAccount);

    // TODO add comment about which send form this is for chat or assets
    document.getElementById('openSendModal').addEventListener('click', openSendModal);
    document.getElementById('closeSendModal').addEventListener('click', closeSendModal);
    document.getElementById('sendForm').addEventListener('submit', handleSendAsset);

    document.getElementById('sendAsset').addEventListener('change', () => {
//        updateSendAddresses();
        updateAvailableBalance();
    });
    document.getElementById('availableBalance').addEventListener('click', fillAmount);
    
    // Add blur event listener for recipient validation
//    document.getElementById('sendToAddress').addEventListener('blur', handleSendToAddressValidation);
    
    document.getElementById('openReceiveModal').addEventListener('click', openReceiveModal);
    document.getElementById('closeReceiveModal').addEventListener('click', closeReceiveModal);
    document.getElementById('copyAddress').addEventListener('click', copyAddress);
    
    document.getElementById('openHistoryModal').addEventListener('click', openHistoryModal);
    document.getElementById('closeHistoryModal').addEventListener('click', closeHistoryModal);
    document.getElementById('historyAsset').addEventListener('change', updateHistoryAddresses);
    
    document.getElementById('switchToChats').addEventListener('click', () => switchView('chats'));
    document.getElementById('switchToContacts').addEventListener('click', () => switchView('contacts'));
    document.getElementById('switchToWallet').addEventListener('click', () => switchView('wallet'));
    
    document.getElementById('handleSignOut').addEventListener('click', handleSignOut);
    document.getElementById('closeChatModal').addEventListener('click', closeChatModal);
    document.getElementById('closeContactInfoModal').addEventListener('click', () => contactInfoModal.close());
    document.getElementById('handleSendMessage').addEventListener('click', handleSendMessage);
    
    // Add refresh balance button handler
    document.getElementById('refreshBalance').addEventListener('click', async () => {
//        await updateWalletBalances();
        updateWalletView();
    });
    
    // New Chat functionality
    document.getElementById('newChatButton').addEventListener('click', openNewChatModal);
    document.getElementById('closeNewChatModal').addEventListener('click', closeNewChatModal);
    document.getElementById('newChatForm').addEventListener('submit', handleNewChat);

    // Add input event listener for message textarea auto-resize
    document.querySelector('.message-input')?.addEventListener('input', function() {
        this.style.height = '44px';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    document.getElementById('openLogs').addEventListener('click', () => {
        // Close the menu modal first
        document.getElementById('menuModal').classList.remove('active');
        // Then open the logs modal and update view
        document.getElementById('logsModal').classList.add('active');
        updateLogsView();
    });

    document.getElementById('closeLogsModal').addEventListener('click', () => {
        document.getElementById('logsModal').classList.remove('active');
    });

    document.getElementById('refreshLogs').addEventListener('click', () => {
        updateLogsView();
    });

    document.getElementById('clearLogs').addEventListener('click', async () => {
        await Logger.clearLogs();
        updateLogsView();
    });

    // Add new search functionality
    const searchInput = document.getElementById('searchInput');
    const messageSearch = document.getElementById('messageSearch');
    const searchModal = document.getElementById('searchModal');

    // Close search modal
    document.getElementById('closeSearchModal').addEventListener('click', () => {
        searchModal.classList.remove('active');
        messageSearch.value = '';
        document.getElementById('searchResults').innerHTML = '';
    });

    // Handle search input with debounce
    messageSearch.addEventListener('input', debounce((e) => {
        const searchText = e.target.value.trim();
        if (searchText.length < 2) {
            displayEmptyState('searchResults', "No messages found");
            return;
        }

        const results = searchMessages(searchText);
        if (results.length === 0) {
            displayEmptyState('searchResults', "No messages found");
        } else {
            displaySearchResults(results);
        }
    }, 300));

    document.getElementById('closeChatModal')?.addEventListener('click', () => {
        document.getElementById('chatModal').classList.remove('active');
    });
    initializeSearch();

    

    // Add contact search functionality
    const contactSearchInput = document.getElementById("contactSearchInput");
    const contactSearch = document.getElementById("contactSearch");
    const contactSearchModal = document.getElementById("contactSearchModal");

    // Open contact search modal when clicking the search bar
    contactSearchInput.addEventListener("click", () => {
        contactSearchModal.classList.add("active");
        contactSearch.focus();
    });

    // Close contact search modal
    document.getElementById("closeContactSearchModal").addEventListener("click", () => {
        contactSearchModal.classList.remove("active");
        contactSearch.value = "";
        document.getElementById("contactSearchResults").innerHTML = "";
    });

    // Handle contact search input with debounce
    contactSearch.addEventListener("input", debounce((e) => {
        const searchText = e.target.value.trim();

        // Just clear results if empty
        if (!searchText) {
            document.getElementById("contactSearchResults").innerHTML = "";
            return;
        }

        const results = searchContacts(searchText);
        if (results.length === 0) {
            displayEmptyState('contactSearchResults', "No contacts found");
        } else {
            displayContactResults(results, searchText);
        }
    }, (searchText) => searchText.length === 1 ? 600 : 300)); // Dynamic wait time

    setupAddToHomeScreen()
});


function handleUnload(e){
    console.log('in handleUnload')
    if (handleSignOut.exit){ 
        return 
    } // User selected to Signout; state was already saved
    else{
        saveState()
        Logger.forceSave();
    }
}

// Add unload handler to save myData
function handleBeforeUnload(e){
console.log('in handleBeforeUnload', e)
    saveState()
    Logger.saveState();
    if (handleSignOut.exit){ 
        window.removeEventListener('beforeunload', handleBeforeUnload)
        return 
    }  // user selected to Signout; state was already saved
console.log('stop back button')
    e.preventDefault();
    history.pushState(null, '', window.location.href);
}

// This is for installed apps where we can't stop the back button; just save the state
function handleVisibilityChange(e) {
    console.log('in handleVisibilityChange', document.visibilityState);
    Logger.log('in handleVisibilityChange', document.visibilityState);
    if (document.visibilityState === 'hidden') {
        saveState();
        Logger.saveState();
        if (handleSignOut.exit) {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            return;
        }
    }
}


function saveState(){
console.log('in saveState')
    if (myData && myAccount && myAccount.username && myAccount.netid) {
console.log('saving state')
        localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));
    }
}

function setupAddToHomeScreen(){
    // Add to home screen functionality
    let deferredInstallPrompt;
    let addToHomeScreenButton = document.getElementById('addToHomeScreenButton');

    // Device and browser detection with improved iOS browser checks
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isChromeIOS = /CriOS/.test(navigator.userAgent);
    const isFirefoxIOS = /FxiOS/.test(navigator.userAgent);
    const isEdgeIOS = /EdgiOS/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android|CriOS|FxiOS|EdgiOS).)*safari/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isDesktop = !isIOS && !isAndroid;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone || // iOS
                        document.referrer.includes('android-app://');

    // Add browser detection
    const isOpera = navigator.userAgent.indexOf("OPR") > -1 || navigator.userAgent.indexOf("Opera") > -1;
    const isFirefox = navigator.userAgent.indexOf("Firefox") > -1;

    // Function to check if the app can be installed
    const canInstall = () => {
        // Already installed as PWA
        if (isStandalone) {
            console.log('App is already installed');
            return false;
        }

        // iOS - show button for all browsers (will handle redirect to Safari)
        if (isIOS) {
            const browser = isChromeIOS ? 'Chrome' : 
                          isFirefoxIOS ? 'Firefox' : 
                          isEdgeIOS ? 'Edge' : 
                          isSafari ? 'Safari' : 'other';
            console.log(`iOS ${browser} detected - showing button`);
            return true;
        }

        // For both Desktop and Android, rely on actual install prompt support
        return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
    };

    // Function to update button visibility
    const updateButtonVisibility = () => {
        if (addToHomeScreenButton) {
            if (canInstall()) {
                console.log('Can install - showing button');
                addToHomeScreenButton.style.display = 'block';
            } else {
                console.log('Cannot install - hiding button');
                addToHomeScreenButton.style.display = 'none';
            }
        }
    };

    // Create button if it doesn't exist
    if (!addToHomeScreenButton) {
        console.log('Creating Add to Home Screen button');
        const welcomeButtons = document.querySelector('.welcome-buttons');
        if (welcomeButtons) {
            addToHomeScreenButton = document.createElement('button');
            addToHomeScreenButton.id = 'addToHomeScreenButton';
            addToHomeScreenButton.className = 'secondary-button';
            addToHomeScreenButton.textContent = 'Install';
            welcomeButtons.appendChild(addToHomeScreenButton);
        }
    }

    // Set up installation handling
    if (addToHomeScreenButton) {
        console.log('Setting up installation handling');
        console.log('Device/Browser Detection:', {
            isIOS,
            isChromeIOS,
            isFirefoxIOS,
            isEdgeIOS,
            isSafari,
            isDesktop,
            isStandalone
        });

        if (isIOS) {
            if (!isSafari) {
                // Non-Safari iOS browsers
                addToHomeScreenButton.addEventListener('click', () => {
                    const currentUrl = window.location.href;
                    alert('Open in Safari...\n\n' +
                          'iOS only supports adding to home screen through Safari browser.');
                    // Open the current URL in Safari
                    window.location.href = currentUrl;
                });
            } else {
                // iOS Safari - Show numbered install instructions
                addToHomeScreenButton.addEventListener('click', () => {
                    alert('To add to home screen:\n\n' +
                          '1. Tap the share button (rectangle with arrow) at the bottom of Safari\n' +
                          '2. Scroll down and tap "Add to Home Screen"\n' +
                          '3. Tap "Add" in the top right');
                });
            }
        } else if (isDesktop) {
            // Desktop browsers - Handle install prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('beforeinstallprompt fired on desktop');
                e.preventDefault();
                deferredInstallPrompt = e;
                
                // Make sure the button is visible when we can install
                updateButtonVisibility();
            });

            addToHomeScreenButton.addEventListener('click', async () => {
                if (deferredInstallPrompt) {
                    console.log('prompting desktop install');
                    deferredInstallPrompt.prompt();
                    const { outcome } = await deferredInstallPrompt.userChoice;
                    console.log(`User response to the desktop install prompt: ${outcome}`);
                    deferredInstallPrompt = null;

                    if (outcome === 'accepted') {
                        addToHomeScreenButton.style.display = 'none';
                    }
                } else if (isOpera) {
                    alert('Installation is not supported in Opera browser. Please use Google Chrome or Microsoft Edge.');
                } else if (isFirefox) {
                    alert('Installation is not supported in Firefox browser. Please use Google Chrome or Microsoft Edge.');
                } else {
                    alert('This app is already installed or cannot be installed on this device/browser.');
                }
            });
        } else {
            // Android - Handle install prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('beforeinstallprompt fired on Android');
                e.preventDefault();
                deferredInstallPrompt = e;
                
                updateButtonVisibility();
            });

            addToHomeScreenButton.addEventListener('click', async () => {
                if (deferredInstallPrompt) {
                    console.log('prompting Android install');
                    deferredInstallPrompt.prompt();
                    const { outcome } = await deferredInstallPrompt.userChoice;
                    console.log(`User response to the Android install prompt: ${outcome}`);
                    deferredInstallPrompt = null;

                    if (outcome === 'accepted') {
                        addToHomeScreenButton.style.display = 'none';
                    }
                }
            });
        }

        // Hide button after successful installation
        window.addEventListener('appinstalled', (event) => {
            console.log('👍', 'appinstalled', event);
            addToHomeScreenButton.style.display = 'none';
        });

        // Check if we can display the install button
        updateButtonVisibility();

        // Listen for display mode changes
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
            updateButtonVisibility();
        });
    }
}

// Update chat list UI
async function updateChatList(force) {
    let gotChats = 0
    if (myAccount && myAccount.keys) {
        if (isOnline) {
            // Online: Get from network and cache
            gotChats = await getChats(myAccount.keys);
            if (gotChats > 0 || force) {
                // Cache the updated chat data
                try {
                    const chatData = addVersion({
                        chatId: myAccount.keys.address,
                        chats: myData.chats,
                        contacts: myData.contacts
                    });
                    await saveData(STORES.CHATS, chatData);
                } catch (error) {
                    console.error('Failed to cache chat data:', error);
                }
            }
        } else {
            // Offline: Get from cache
            try {
                const cachedData = await getData(STORES.CHATS, myAccount.keys.address);
                if (cachedData) {
                    myData.chats = cachedData.chats;
                    myData.contacts = cachedData.contacts;
                    console.log('Using cached chat data from:', new Date(cachedData.lastUpdated));
                }
            } catch (error) {
                console.error('Failed to read cached chat data:', error);
            }
        }
    }
    console.log('force gotChats', force === undefined ? 'undefined' : JSON.stringify(force), 
                             gotChats === undefined ? 'undefined' : JSON.stringify(gotChats))
    if (! (force || gotChats)){ return }
    const chatList = document.getElementById('chatList');
//            const chatsData = myData
    const contacts = myData.contacts
    const chats = myData.chats
    
    if (document.getElementById('chatModal').classList.contains('active')) { appendChatModal() }

    if (chats.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Chats Yet</div>
                <div>Your conversations will appear here</div>
            </div>`;
        return;
    }

    console.log('updateChatList chats.length', JSON.stringify(chats.length))
    
    const chatItems = await Promise.all(chats.map(async chat => {
        const identicon = await generateIdenticon(chat.address);
        const contact = contacts[chat.address]
        const message = contact.messages.at(-1)
        if (!message){ return '' }
        return `
            <li class="chat-item">
                <div class="chat-avatar">${identicon}</div>
                <div class="chat-content">
                    <div class="chat-header">
                        <div class="chat-name">${contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`}</div>
                        <div class="chat-time">${formatTime(message.timestamp)}</div>
                    </div>
                    <div class="chat-message">
                        ${message.my ? 'You: ' : ''}${message.message}
                        ${contact.unread ? `<span class="chat-unread">${contact.unread}</span>` : ''}
                    </div>
                </div>
            </li>
        `;
    }));
    
    chatList.innerHTML = chatItems.join('');
    
    // Add click handlers to chat items
    document.querySelectorAll('.chat-item').forEach((item, index) => {
        item.onclick = () => openChatModal(chats[index].address);
    });
}

// refresh wallet balance
async function updateWalletBalances() {
    if (!myAccount || !myData || !myData.wallet || !myData.wallet.assets) {
        console.error('No wallet data available');
        return;
    }
    await updateAssetPricesIfNeeded()
    const now = Date.now()
    if (!myData.wallet.timestamp){myData.wallet.timestamp = 0}
    if (now - myData.wallet.timestamp < 5000){return}

    // TODO - first update the asset prices from a public API

    let totalWalletNetworth = 0.0;

    // Update balances for each asset and address
    for (const asset of myData.wallet.assets) {
        let assetTotalBalance = 0n;
        
        // Get balance for each address in the asset
        for (const addr of asset.addresses) {
            try {
                const address = longAddress(addr.address);
                const data = await queryNetwork(`/account/${address}/balance`)
console.log('balance', data)                       
                // Update address balance
                addr.balance = hex2big(data.balance.value) || 0;
                
                // Add to asset total (convert to USD using asset price)
                assetTotalBalance += addr.balance
            } catch (error) {
                console.error(`Error fetching balance for address ${addr.address}:`, error);
            }
        }
        asset.balance = assetTotalBalance;
        asset.networth = asset.price * Number(assetTotalBalance)/Number(wei);
        
        // Add this asset's total to wallet total
        totalWalletNetworth += asset.networth;
    }

    // Update total wallet balance
    myData.wallet.networth = totalWalletNetworth;
    myData.wallet.timestamp = now
}

async function switchView(view) {
    // Hide all screens
    document.querySelectorAll('.app-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected screen
    document.getElementById(`${view}Screen`).classList.add('active');

    // Show header and footer
    document.getElementById('header').classList.add('active');
    document.getElementById('footer').classList.add('active');
    
    // Update header with username if signed in
    const appName = document.querySelector('.app-name');
    if (myAccount && myAccount.username) {
        appName.textContent = `${myAccount.username}`;
    } else {
        appName.textContent = '';
    }   

    // Show/hide new chat button
    const newChatButton = document.getElementById('newChatButton');
    if (view === 'chats') {
        newChatButton.classList.add('visible');
    } else {
        newChatButton.classList.remove('visible');
    }

    // Update lists when switching views
    if (view === 'chats') {
        await updateChatList('force');
        if (isOnline) {
            pollChatInterval(pollIntervalNormal)
        }
    } else if (view === 'contacts') {
        await updateContactsList();
    } else if (view === 'wallet') {
//        await updateAssetPricesIfNeeded(); // New function to update asset prices
//        await updateWalletBalances();
        await updateWalletView();
    }
    
    // Update nav button states
    document.querySelectorAll('.nav-button').forEach(button => {
        button.classList.remove('active');
        if (button.textContent.toLowerCase() === view) {
            button.classList.add('active');
        }
    });
}

// Update contacts list UI
async function updateContactsList() {
    if (isOnline) {
        // Online: Get from network and cache
        try {
            const contactsData = addVersion({
                address: myAccount.keys.address,
                contacts: myData.contacts
            });
            await saveData(STORES.CONTACTS, contactsData);
            console.log('Successfully cached contacts data:', contactsData);
        } catch (error) {
            console.error('Failed to cache contacts data:', error);
        }
    } else {
        // Offline: Get from cache
        try {
            const cachedData = await getData(STORES.CONTACTS, myAccount.keys.address);
            if (cachedData) {
                myData.contacts = cachedData.contacts;
                console.log('Using cached contacts data from:', new Date(cachedData.lastUpdated));
            }
        } catch (error) {
            console.error('Failed to read cached contacts data:', error);
        }
    }

    const contactsList = document.getElementById('contactsList');
//            const chatsData = myData
    const contacts = myData.contacts;
    
    if (Object.keys(contacts).length === 0) {
        contactsList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Contacts Yet</div>
                <div>Your contacts will appear here</div>
            </div>`;
        return;
    }

    // Convert contacts object to array and sort
    const contactsArray = Object.values(contacts);
    
    // Split into friends and others in a single pass
    const { friends, others } = contactsArray.reduce((acc, contact) => {
        const key = contact.friend ? 'friends' : 'others';
        acc[key].push(contact);
        return acc;
    }, { friends: [], others: [] });

    // Sort friends and others by name first, then by username if name is not available
    const sortByName = (a, b) => {
        const nameA = a.name || a.username || '';
        const nameB = b.name || b.username || '';
        return nameA.localeCompare(nameB);
    };

    // sort friends and others
    friends.sort(sortByName);
    others.sort(sortByName);

    // Build HTML for both sections
    let html = '';

    // Add friends section if there are friends
    if (friends.length > 0) {
        html += `<div class="contact-section-header">Friends</div>`;
        const friendItems = await Promise.all(friends.map(async contact => {
            const identicon = await generateIdenticon(contact.address);
            return `
                <li class="chat-item">
                    <div class="chat-avatar">${identicon}</div>
                    <div class="chat-content">
                        <div class="chat-header">
                            <div class="chat-name">${contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`}</div>
                        </div>
                        <div class="chat-message">
                            ${contact.email || contact.x || contact.phone || contact.address}
                        </div>
                    </div>
                </li>
            `;
        }));
        html += friendItems.join('');
    }

    // Add others section if there are other contacts
    if (others.length > 0) {
        html += `<div class="contact-section-header">Others</div>`;
        const otherItems = await Promise.all(others.map(async contact => {
            const identicon = await generateIdenticon(contact.address);
            return `
                <li class="chat-item">
                    <div class="chat-avatar">${identicon}</div>
                    <div class="chat-content">
                        <div class="chat-header">
                            <div class="chat-name">${contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`}</div>
                        </div>
                        <div class="chat-message">
                            ${contact.email || contact.x || contact.phone || contact.address}
                        </div>
                    </div>
                </li>
            `;
        }));
        html += otherItems.join('');
    }
    
    contactsList.innerHTML = html;
    
    // Add click handlers to contact items
    document.querySelectorAll('#contactsList .chat-item').forEach((item, index) => {
        const contact = [...friends, ...others][index];
        item.onclick = () => {
            contactInfoModal.open(createDisplayInfo(contact));
        };
    });
}

function toggleMenu() {
    document.getElementById('menuModal').classList.toggle('active');
//    document.getElementById('accountModal').classList.remove('active');
}

function openAccountForm() {
    document.getElementById('accountModal').classList.add('active');
    if (myData && myData.account) {
        document.getElementById('name').value = myData.account.name || '';
        document.getElementById('email').value = myData.account.email || '';
        document.getElementById('phone').value = myData.account.phone || '';
        document.getElementById('linkedin').value = myData.account.linkedin || '';
        document.getElementById('x').value = myData.account.x || '';
    }
}

function closeAccountForm() {
    document.getElementById('accountModal').classList.remove('active');
}

function openExportForm() {
    document.getElementById('exportModal').classList.add('active');
}

function closeExportForm() {
    document.getElementById('exportModal').classList.remove('active');
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
// Decrypt data using ChaCha20-Poly1305
async function decryptData(encryptedData, password) {
    if (!password) return encryptedData;

    // Generate key using 100,000 iterations of blake2b
    let key = utf82bin(password);
    for (let i = 0; i < 100000; i++) {
        key = blake.blake2b(key, null, 32);
    }

    // Decrypt the data using ChaCha20-Poly1305
    return decryptChacha(key, encryptedData);
}

function openImportFileModal() {
    document.getElementById('importModal').classList.add('active');
}

function closeImportFileModal() {
    document.getElementById('importModal').classList.remove('active');
}

async function handleImportFile(event) {
    event.preventDefault();
    const fileInput = document.getElementById('importFile');
    const passwordInput = document.getElementById('importPassword');
    const messageElement = document.getElementById('importMessage');
    
    try {
        // Read the file
        const file = fileInput.files[0];
        let fileContent = await file.text();
        const isNotEncryptedData = fileContent.match('{')

        // Check if data is encrypted and decrypt if necessary
        if ( ! isNotEncryptedData) {
            if (!passwordInput.value.trim()) {
                alert('Password required for encrypted data');
                return
            }
            fileContent = await decryptData(fileContent, passwordInput.value.trim());
            if (fileContent == null){ throw "" }
        }
        const jsonData = parse(fileContent);

        // We first parse to jsonData so that if the parse does not work we don't destroy myData
        myData = parse(fileContent)
        // also need to set myAccount
        const acc = myData.account  // this could have other things which are not needed
        myAccount = {
            netid: acc.netid,
            username: acc.username,
            keys: {
                address: acc.keys.address,
                public: acc.keys.public,
                secret: acc.keys.secret,
                type: acc.keys.type
            }
        }
        // Get existing accounts or create new structure
        const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
        // Ensure netid exists
        if (!existingAccounts.netids[myAccount.netid]) {
            existingAccounts.netids[myAccount.netid] = { usernames: {} };
        }
        // Store updated accounts back in localStorage
        existingAccounts.netids[myAccount.netid].usernames[myAccount.username] = {address: myAccount.keys.address};
        localStorage.setItem('accounts', stringify(existingAccounts));

        // Store the localStore entry for username_netid
        localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));

        requestNotificationPermission();

/*
        // Refresh form data and chat list
//                loadAccountFormData();
        await updateChatList();
*/

        // Show success message
        messageElement.textContent = 'Data imported successfully!';
        messageElement.classList.add('active');
        
        // Reset form and close modal after delay
        setTimeout(() => {
            messageElement.classList.remove('active');
            closeImportFileModal();
            window.location.reload();  // need to go through Sign In to make sure imported account exists on network
            fileInput.value = '';
            passwordInput.value = '';
        }, 2000);
        
    } catch (error) {
        messageElement.textContent = error.message || 'Import failed. Please check file and password.';
        messageElement.style.color = '#dc3545';
        messageElement.classList.add('active');
        setTimeout(() => {
            messageElement.classList.remove('active');
            messageElement.style.color = '#28a745';
        }, 3000);
    }
}


// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
// Encrypt data using ChaCha20-Poly1305
async function encryptData(data, password) {
    if (!password) return data;

    // Generate salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // Derive key using 100,000 iterations of blake2b
    let key = utf82bin(password);
    for (let i = 0; i < 100000; i++) {
        key = blake.blake2b(key, null, 32);
    }

    // Encrypt the data using ChaCha20-Poly1305
    const encrypted = encryptChacha(key, data);
    return encrypted
}

async function handleExport(event) {
    event.preventDefault();

    const password = document.getElementById('exportPassword').value;
    const jsonData = stringify(myData, null, 2);
    
    try {
        // Encrypt data if password is provided
        const finalData = password ? 
            await encryptData(jsonData, password) : 
            jsonData;
        
        // Create and trigger download
        const blob = new Blob([finalData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${myAccount.username}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Close export modal
        closeExportForm();
    } catch (error) {
        console.error('Encryption failed:', error);
        alert('Failed to encrypt data. Please try again.');
    }
}

function openRemoveAccountModal() {
    document.getElementById('removeAccountModal').classList.add('active');
}

function closeRemoveAccountModal() {
    document.getElementById('removeAccountModal').classList.remove('active');
}

async function handleRemoveAccount() {
    // Get network ID from network.js
    const { netid } = network;

    // Get existing accounts
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');

    // Remove the account from the accounts object
    if (existingAccounts.netids[netid] && existingAccounts.netids[netid].usernames) {
        delete existingAccounts.netids[netid].usernames[myAccount.username];
        localStorage.setItem('accounts', stringify(existingAccounts));
    }
    // Remove the account data from localStorage
    localStorage.removeItem(`${myAccount.username}_${netid}`);

    // Reload the page to redirect to welcome screen
    myData = null       // need to delete this so that the reload does not save the data into localStore again
    window.location.reload();
}

function openNewChatModal() {
    document.getElementById('newChatModal').classList.add('active');
    document.getElementById('newChatButton').classList.remove('visible');

    const usernameInput = document.getElementById('chatRecipient');
    const usernameAvailable = document.getElementById('chatRecipientError');
    const submitButton = document.querySelector('#newChatForm button[type="submit"]');
    usernameAvailable.style.display = 'none';
    submitButton.disabled = true;
// Check availability on input changes
    let checkTimeout;
    usernameInput.addEventListener('input', (e) => {
        const username = normalizeUsername(e.target.value);
        
        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }
                
        // Check if username is too short
        if (username.length < 3) {
            usernameAvailable.textContent = 'too short';
            usernameAvailable.style.color = '#dc3545';
            usernameAvailable.style.display = 'inline';
            return;
        }
        
        // Check network availability
        checkTimeout = setTimeout(async () => {
            const taken = await checkUsernameAvailability(username, myAccount.keys.address);
            if (taken == 'taken') {
                usernameAvailable.textContent = 'found';
                usernameAvailable.style.color = '#28a745';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = false;
            } else if ((taken == 'available') || (taken == 'mine')) {
                usernameAvailable.textContent = 'not found';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            } else {
                usernameAvailable.textContent = 'network error';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            }
        }, 1000);
    });    
}

function closeNewChatModal() {
    document.getElementById('newChatModal').classList.remove('active');
    document.getElementById('newChatForm').reset();
    if (document.getElementById('chatsScreen').classList.contains('active')) {
        document.getElementById('newChatButton').classList.add('visible');
    }
}

// Show error message in the new chat form
function showRecipientError(message) {
    const errorElement = document.getElementById('chatRecipientError');
    errorElement.textContent = message;
    errorElement.style.color = '#dc3545';  // Always red for errors
    errorElement.style.display = 'inline';
}

// Validate recipient in send modal
async function handleSendToAddressValidation(e) {
    const input = e.target.value.trim();
    const errorElement = document.getElementById('sendToAddressError');
    
    // Clear previous error
    errorElement.style.display = 'none';
    
    if (!input) return;
    
    // Check if input is an Ethereum address
    if (input.startsWith('0x')) {
        if (!isValidEthereumAddress(input)) {
            errorElement.textContent = 'Invalid address format';
            errorElement.style.color = '#dc3545';
            errorElement.style.display = 'inline';
        }
        return;
    }
    
    // If not an address, treat as username
    if (input.length < 3) {
        errorElement.textContent = 'Username too short';
        errorElement.style.color = '#dc3545';
        errorElement.style.display = 'inline';
        return;
    }
    
    // Check username availability on network
    const taken = await checkUsernameAvailability(input);
    if (taken === 'taken') {
        errorElement.textContent = 'found';
        errorElement.style.color = '#28a745';
        errorElement.style.display = 'inline';
    } else if (taken === 'available') {
        errorElement.textContent = 'not found';
        errorElement.style.color = '#dc3545';
        errorElement.style.display = 'inline';
    } else {
        errorElement.textContent = 'network error';
        errorElement.style.color = '#dc3545';
        errorElement.style.display = 'inline';
    }
}

// Hide error message in the new chat form
function hideRecipientError() {
    const errorElement = document.getElementById('chatRecipientError');
    errorElement.style.display = 'none';
}

async function handleNewChat(event) {
    event.preventDefault();
    const input = document.getElementById('chatRecipient').value.trim();
    let recipientAddress;
    let username;
    
    hideRecipientError();
    
    // Check if input is an Ethereum address
    if (input.startsWith('0x')) {
        if (!isValidEthereumAddress(input)) {
            showRecipientError('Invalid Ethereum address format');
            return;
        }
        // Input is valid Ethereum address, normalize it
        recipientAddress = normalizeAddress(input);
    } else {
        if (input.length < 3) {
            showRecipientError('Username too short');
            return;
        }
        username = normalizeUsername(input)
        // Treat as username and lookup address
        const usernameBytes = utf82bin(username);
        const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);
        try {
            const data = await queryNetwork(`/address/${usernameHash}`)
            if (!data || !data.address) {
                showRecipientError('Username not found');
                return;
            }
            // Normalize address from API if it has 0x prefix or trailing zeros
            recipientAddress = normalizeAddress(data.address);
        } catch (error) {
            console.log('Error looking up username:', error);
            showRecipientError('Error looking up username');
            return;
        }
    }
    
    // Get or create chat data
    const chatsData = myData
    
    // Check if contact exists
    if (!chatsData.contacts[recipientAddress]) { createNewContact(recipientAddress) }
    chatsData.contacts[recipientAddress].username = username

// TODO - maybe we don't need this; this is just adding a blank entry into the chats table
    // Add to chats if not already present
    const existingChat = chatsData.chats.find(chat => chat.address === recipientAddress);
    if (!existingChat) {
        chatsData.chats.unshift({
            address: recipientAddress,
            timestamp: Date.now(),
        });
    }

    // Close new chat modal and open chat modal
    closeNewChatModal();
    openChatModal(recipientAddress);
}

// create new contact
function createNewContact(addr, username){
    const address = normalizeAddress(addr)
    if (myData.contacts[address]){ return }  // already exists
    const c = myData.contacts[address] = {}
    c.address = address
    if (username){ c.username = username }
    c.messages = []
    c.timestamp = Date.now()
    c.unread = 0
}


function openChatModal(address) {
    const modal = document.getElementById('chatModal');
    const modalAvatar = modal.querySelector('.modal-avatar');
    const modalTitle = modal.querySelector('.modal-title');
    const messagesList = modal.querySelector('.messages-list');
    document.getElementById('newChatButton').classList.remove('visible');
    const contact = myData.contacts[address]
    // Set user info
    modalTitle.textContent = contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`;
    generateIdenticon(contact.address, 40).then(identicon => {
        modalAvatar.innerHTML = identicon;
    });

    // Get messages from contacts data
    const messages = contact?.messages || [];

    // Display messages
    messagesList.innerHTML = messages.map(msg => `
        <div class="message ${msg.my ? 'sent' : 'received'}">
            <div class="message-content">${msg.message}</div>
            <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
    `).join('');

    // Scroll to bottom
    setTimeout(() => {
        messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;
    }, 100);

    // Add click handler for username to show contact info
    const userInfo = modal.querySelector('.chat-user-info');
    userInfo.onclick = () => {
        const contact = myData.contacts[address];
        if (contact) {
            contactInfoModal.open(createDisplayInfo(contact));
        }
    };

    // Show modal
    modal.classList.add('active');

    // Clear unread count
    if (contact.unread > 0) {
        myData.state.unread = Math.max(0, (myData.state.unread || 0) - contact.unread);
        contact.unread = 0;
        updateChatList();
    } 

    // Setup to update new messages
    appendChatModal.address = address
    appendChatModal.len = messages.length
    if (isOnline) {
        pollChatInterval(pollIntervalChatting) // poll for messages at a faster rate
    }
}

function appendChatModal(){
console.log('appendChatModal')
    if (! appendChatModal.address){ return }
//console.log(2)
//    if (document.getElementById('chatModal').classList.contains('active')) { return }
//console.log(3)
    const messages = myData.contacts[appendChatModal.address].messages
    if (appendChatModal.len >= messages.length){ return }
//console.log(4)
    const modal = document.getElementById('chatModal');
    const messagesList = modal.querySelector('.messages-list');

    for (let i=appendChatModal.len; i<messages.length; i++) {
console.log(5, i)
        const m = messages[i]
        m.type = m.my ? 'sent' : 'received'
        // Add message to UI
        messagesList.insertAdjacentHTML('beforeend', `
            <div class="message ${m.type}">
                <div class="message-content" style="white-space: pre-wrap">${m.message}</div>
                <div class="message-time">${formatTime(m.timestamp)}</div>
            </div>
        `);
    }
    appendChatModal.len = messages.length
    // Scroll to bottom
    messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;
}
appendChatModal.address = null
appendChatModal.len = 0

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('active');
    if (document.getElementById('chatsScreen').classList.contains('active')) {
        updateChatList('force')
        document.getElementById('newChatButton').classList.add('visible');
    }
    appendChatModal.address = null
    appendChatModal.len = 0
    if (isOnline) {
        pollChatInterval(pollIntervalNormal) // back to polling at slower rate
    }
}

function openReceiveModal() {
    const modal = document.getElementById('receiveModal');
    modal.classList.add('active');
    
    // Get wallet data
    const walletData = myData.wallet

    // Update addresses for first asset
    updateReceiveAddresses();
}

function closeReceiveModal() {
    document.getElementById('receiveModal').classList.remove('active');
}

function updateReceiveAddresses() {
    // Update display address
    updateDisplayAddress();
}

function updateDisplayAddress() {
    const displayAddress = document.getElementById('displayAddress');
    const qrcodeContainer = document.getElementById('qrcode');
    
    // Clear previous QR code
    qrcodeContainer.innerHTML = '';

    const address = myAccount.keys.address;
    displayAddress.textContent = '0x' + address;
    
    // Update QR code
    new QRCode(qrcodeContainer, {
        text: '0x' + address,
        width: 200,
        height: 200
    });
}

async function copyAddress() {
    const address = document.getElementById('displayAddress').textContent;
    try {
        await navigator.clipboard.writeText(address);
        const button = document.getElementById('copyAddress');
        button.classList.add('success');
        setTimeout(() => {
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

function openSendModal() {
    const modal = document.getElementById('sendModal');
    modal.classList.add('active');
    
    const usernameInput = document.getElementById('sendToAddress');
    const usernameAvailable = document.getElementById('sendToAddressError');
    const submitButton = document.querySelector('#sendForm button[type="submit"]');
    usernameAvailable.style.display = 'none';
    submitButton.disabled = true;
// Check availability on input changes
    let checkTimeout;
    usernameInput.addEventListener('input', (e) => {
        const username = normalizeUsername(e.target.value);
        
        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }
                
        // Check if username is too short
        if (username.length < 3) {
            usernameAvailable.textContent = 'too short';
            usernameAvailable.style.color = '#dc3545';
            usernameAvailable.style.display = 'inline';
            return;
        }
        
        // Check network availability
        checkTimeout = setTimeout(async () => {
            const taken = await checkUsernameAvailability(username, myAccount.keys.address);
            if (taken == 'taken') {
                usernameAvailable.textContent = 'found';
                usernameAvailable.style.color = '#28a745';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = false;
            } else if ((taken == 'available') || (taken == 'mine')) {
                usernameAvailable.textContent = 'not found';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            } else {
                usernameAvailable.textContent = 'network error';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
                submitButton.disabled = true;
            }
        }, 1000);
    });


    // Get wallet data
    const wallet = myData.wallet
    // Populate assets dropdown
    const assetSelect = document.getElementById('sendAsset');
    assetSelect.innerHTML = wallet.assets.map((asset, index) => 
        `<option value="${index}">${asset.name} (${asset.symbol})</option>`
    ).join('');


    // Update addresses for first asset
    updateSendAddresses();
}

async function closeSendModal() {
    await updateChatList()
    document.getElementById('sendModal').classList.remove('active');
    document.getElementById('sendForm').reset();
}

function updateSendAddresses() {
    const walletData = myData.wallet
    const assetIndex = document.getElementById('sendAsset').value;
//    const addressSelect = document.getElementById('sendFromAddress');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        addressSelect.innerHTML = '<option value="">No addresses available</option>';
        updateAvailableBalance();
        return;
    }

    // Update available balance display
    updateAvailableBalance();
}

function updateAvailableBalance() {
    const walletData = myData.wallet
    const assetIndex = document.getElementById('sendAsset').value;

    const balanceAmount = document.getElementById('balanceAmount');
    const balanceSymbol = document.getElementById('balanceSymbol');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        balanceAmount.textContent = '0.00';
        balanceSymbol.textContent = '';
        return;
    }

    const asset = walletData.assets[assetIndex];
    
    balanceAmount.textContent = big2str(asset.balance, weiDigits);
    balanceSymbol.textContent = asset.symbol;
}

function fillAmount() {
    const amount = document.getElementById('balanceAmount').textContent;
    document.getElementById('sendAmount').value = amount;
}

// The user has filled out the form to send assets to a recipient and clicked the Send button
// The recipient account may not exist in myData.contacts and might have to be created
async function handleSendAsset(event) {
    event.preventDefault();
    
    const wallet = myData.wallet;
    const assetIndex = document.getElementById('sendAsset').value;  // TODO include the asset id and symbol in the tx
    const fromAddress = myAccount.keys.address;
    const amount = bigxnum2big(wei, document.getElementById('sendAmount').value);
    const username = normalizeUsername(document.getElementById('sendToAddress').value);
    const memoIn = document.getElementById('sendMemo').value || '';
    const memo = memoIn.trim()
    const keys = myAccount.keys;
    let toAddress;

    // Validate amount
    if (amount > fromAddress.balance) {  // TODO - include tx fee
        alert('Insufficient balance');
        return;
    }

    // Validate username - must be username; address not supported
    if (username.startsWith('0x')) {
        alert('Address not supported; enter username instead.');
        return;
    }
    if (username.length < 3) {
        alert('Username too short');
        return;
    }
    try {
        // Look up username on network
        const usernameBytes = utf82bin(username);
        const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);
/*
        const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/address/${usernameHash}`);
        const data = await response.json();
*/
        const data = await queryNetwork(`/address/${usernameHash}`)        
        if (!data || !data.address) {
            alert('Username not found');
            return;
        }
        toAddress = normalizeAddress(data.address);
    } catch (error) {
        console.error('Error looking up username:', error);
        alert('Error looking up username');
        return;
    }

    // Get recipient's public key from contacts
    let recipientPubKey = myData.contacts[toAddress]?.public;
    let pqRecPubKey = myData.contacts[toAddress]?.pqPublic
    if (!recipientPubKey || !pqRecPubKey) {
        const recipientInfo = await queryNetwork(`/account/${longAddress(currentAddress)}`)
        if (!recipientInfo?.account?.publicKey){
            console.log(`no public key found for recipient ${currentAddress}`)
            return
        }
        recipientPubKey = recipientInfo.account.publicKey
        myData.contacts[toAddress].public = recipientPubKey
        pqRecPubKey = recipientInfo.account.pqPublicKey
        myData.contacts[toAddress].pqPublic = pqRecPubKey
    }

    // Generate shared secret using ECDH and take first 32 bytes
    let dhkey = ecSharedKey(keys.secret, recipientPubKey)
    const  { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey)
    const combined = new Uint8Array(dhkey.length + sharedSecret.length)
    combined.set(dhkey).set(sharedSecret, dhkey.length)
    dhkey = blake.blake2b(combined, myHashKey, 32)


    // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
    // Encrypt message using shared secret
    let encMemo = ''
    if (memo){
        encMemo = encryptChacha(dhkey, memo)
    }

    // Create sender info object
    const senderInfo = {
        username: myAccount.username,
        name: myData.account.name,
        email: myData.account.email,
        phone: myData.account.phone,
        linkedin: myData.account.linkedin,
        x: myData.account.x
    };
    // Encrypt sender info
    const encSenderInfo = encryptChacha(dhkey, stringify(senderInfo));

    // Create message payload
    const payload = {
        message: encMemo,  // we need to call this field message, so we can use decryptMessage()
        senderInfo: encSenderInfo,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: bin2base64(cipherText),
        sent_timestamp: Date.now()
    };

    try {
console.log('payload is', payload)
        // Send the transaction using postAssetTransfer
        const response = await postAssetTransfer(toAddress, amount, payload, keys);
        
        if (!response || !response.result || !response.result.success) {
            alert('Transaction failed: ' + response.result.reason);
            return;
        }

        // Create contact if it doesn't exit
        if (!myData.contacts[toAddress].messages) {
            createNewContact(toAddress)
            myData.contacts[toAddress].username = normalizeUsername(recipientInput)
        }

        // Add transaction to history
        const newPayment = {
            txid: response.txid,
            amount: amount,
            sign: -1,
            timestamp: Date.now(),
            address: toAddress,
            memo: memo
        };
        wallet.history.unshift(newPayment);

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
        closeSendModal();
        document.getElementById('sendToAddress').value = '';
        document.getElementById('sendAmount').value = '';
        document.getElementById('sendMemo').value = '';
        document.getElementById('sendToAddressError').style.display = 'none'
/*
        const sendToAddressError = document.getElementById('sendToAddressError');
        if (sendToAddressError) {
            sendToAddressError.style.display = 'none';
        }
*/
    } catch (error) {
        console.error('Transaction error:', error);
        alert('Transaction failed. Please try again.');
    }
}

// Contact Info Modal Management
class ContactInfoModalManager {
    constructor() {
        this.modal = document.getElementById('contactInfoModal');
        this.menuDropdown = document.getElementById('contactInfoMenuDropdown');
        this.currentContactAddress = null;
        this.needsContactListUpdate = false;  // track if we need to update the contact list
        this.isEditing = false;
        this.originalName = null;
        this.setupEventListeners();
    }

    // Initialize event listeners that only need to be set up once
    setupEventListeners() {
        // Back button
        this.modal.querySelector('.back-button').addEventListener('click', () => {
            if (this.isEditing) {
                this.exitEditMode(false);
            } else {
                this.close();
            }
        });

        // Menu toggle
        const menuButton = document.getElementById('contactInfoMenuButton');
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.menuDropdown.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.menuDropdown.classList.remove('active');
        });

        // Edit button
        document.getElementById('editContactButton').addEventListener('click', () => {
            this.enterEditMode();
            this.menuDropdown.classList.remove('active');
        });

        // Add friend button
        document.getElementById('addFriendButton').addEventListener('click', () => {
            if (!this.currentContactAddress) return;
            
            const contact = myData.contacts[this.currentContactAddress];
            if (!contact) return;

            // Toggle friend status
            contact.friend = !contact.friend;

            // Show appropriate toast message
            showToast(contact.friend ? 'Added to friends' : 'Removed from friends');

            // Update button text
            this.updateFriendButton(contact.friend);

            // Close the dropdown
            this.menuDropdown.classList.remove('active');

            // Mark that we need to update the contact list
            this.needsContactListUpdate = true;

            // Save state
            saveState();
        });

        // Add keyboard event listener for Escape key
        this.modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isEditing) {
                this.exitEditMode(false);
            }
        });
    }

    enterEditMode() {
        this.isEditing = true;
        const contact = myData.contacts[this.currentContactAddress];
        this.originalName = contact?.name || '';
        
        // Update header
        const header = this.modal.querySelector('.modal-header');
        header.innerHTML = `
            <button class="icon-button cancel-button" id="cancelEdit" aria-label="Cancel"></button>
            <div class="modal-title">Edit Contact</div>
            <button class="icon-button save-button" id="saveEdit" aria-label="Save"></button>
        `;

        // Setup header button listeners
        header.querySelector('#cancelEdit').addEventListener('click', () => this.exitEditMode(false));
        header.querySelector('#saveEdit').addEventListener('click', () => this.exitEditMode(true));

        // Transform name field to edit mode
        this.updateNameFieldToEditMode();
    }

    updateNameFieldToEditMode() {
        const nameField = document.getElementById('contactInfoName');
        const contact = myData.contacts[this.currentContactAddress];
        const currentValue = contact?.name || '';
        
        nameField.innerHTML = `
            <div class="contact-info-value editing">
                <input 
                    type="text" 
                    class="edit-field-input"
                    value="${currentValue}"
                    placeholder="Enter contact name"
                >
                <button class="field-action-button ${currentValue ? 'clear' : 'add'}" aria-label="${currentValue ? 'Clear' : 'Add'}"></button>
            </div>
        `;

        // Add event listeners
        const input = nameField.querySelector('input');
        const actionButton = nameField.querySelector('.field-action-button');

        // Handle input changes
        input.addEventListener('input', () => {
            const hasValue = input.value.trim().length > 0;
            actionButton.className = `field-action-button ${hasValue ? 'clear' : 'add'}`;
            actionButton.setAttribute('aria-label', hasValue ? 'Clear' : 'Add');
        });

        // Handle action button clicks
        actionButton.addEventListener('click', () => {
            if (input.value.trim()) {
                input.value = '';
                actionButton.className = 'field-action-button add';
                actionButton.setAttribute('aria-label', 'Add');
            }
            input.focus();
        });

        // Handle enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.exitEditMode(true);
            }
        });
    }

    exitEditMode(save = false) {
        if (save) {
            // Save changes
            const input = document.querySelector('.edit-field-input');
            const newName = input.value.trim();
            const contact = myData.contacts[this.currentContactAddress];
            if (contact) {
                contact.name = newName || null;
                saveState();
                this.needsContactListUpdate = true;
            }
        } else {
            // Restore original name
            const contact = myData.contacts[this.currentContactAddress];
            if (contact) {
                contact.name = this.originalName;
            }
        }

        // Reset edit state
        this.isEditing = false;
        
        // Restore original header
        this.restoreHeader();
        
        // Update display
        this.updateContactInfo(createDisplayInfo(myData.contacts[this.currentContactAddress]));
    }

    restoreHeader() {
        const header = this.modal.querySelector('.modal-header');
        header.innerHTML = `
            <button class="back-button" id="closeContactInfoModal"></button>
            <div class="modal-title">Contact Info</div>
            <div class="header-actions">
                <button class="icon-button chat-icon" id="contactInfoChatButton"></button>
                <div class="dropdown">
                    <button class="dropdown-menu-button" id="contactInfoMenuButton"></button>
                    <div class="dropdown-menu" id="contactInfoMenuDropdown">
                        <button class="dropdown-item" id="editContactButton">
                            <span class="dropdown-icon edit-icon"></span>
                            <span class="dropdown-text">Edit</span>
                        </button>
                        <button class="dropdown-item add-friend" id="addFriendButton">
                            <span class="dropdown-icon add-friend-icon"></span>
                            <span class="dropdown-text">Add Friend</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Reattach all necessary event listeners
        const menuButton = document.getElementById('contactInfoMenuButton');
        const menuDropdown = document.getElementById('contactInfoMenuDropdown');
        const editButton = document.getElementById('editContactButton');
        const addFriendButton = document.getElementById('addFriendButton');

        // Menu button click handler
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('active');
        });

        // Edit button click handler
        editButton.addEventListener('click', () => {
            this.enterEditMode();
            menuDropdown.classList.remove('active');
        });

        // Add friend button click handler
        addFriendButton.addEventListener('click', () => {
            if (!this.currentContactAddress) return;
            const contact = myData.contacts[this.currentContactAddress];
            if (!contact) return;
            contact.friend = !contact.friend;
            this.updateFriendButton(contact.friend);
            menuDropdown.classList.remove('active');
            this.needsContactListUpdate = true;
            saveState();
        });

        // Back button click handler
        this.modal.querySelector('.back-button').addEventListener('click', () => {
            if (this.isEditing) {
                this.exitEditMode(false);
            } else {
                this.close();
            }
        });

        // Document click handler to close dropdown
        document.addEventListener('click', () => {
            menuDropdown.classList.remove('active');
        });

        // Restore chat button functionality and friend status
        const contact = myData.contacts[this.currentContactAddress];
        if (contact) {
            this.setupChatButton({ address: this.currentContactAddress });
            this.updateFriendButton(contact.friend || false);
        }
    }

    // Update friend button text based on current status
    updateFriendButton(isFriend) {
        const button = document.getElementById('addFriendButton');
        const textSpan = button.querySelector('.dropdown-text');
        const iconSpan = button.querySelector('.dropdown-icon');
        textSpan.textContent = isFriend ? 'Remove Friend' : 'Add Friend';
        
        // Toggle the removing class based on friend status
        if (isFriend) {
            button.classList.add('removing');
            iconSpan.classList.add('removing');
        } else {
            button.classList.remove('removing');
            iconSpan.classList.remove('removing');
        }
    }

    // Update contact info values
    async updateContactInfo(displayInfo) {
        // Add avatar section at the top
        const contactInfoList = this.modal.querySelector('.contact-info-list');
        const avatarSection = document.createElement('div');
        avatarSection.className = 'contact-avatar-section';
        
        // Generate identicon for the contact
        const identicon = await generateIdenticon(displayInfo.address, 96);
        
        avatarSection.innerHTML = `
            <div class="avatar">${identicon}</div>
            <div class="name">${displayInfo.name !== 'Not provided' ? displayInfo.name : displayInfo.username}</div>
            <div class="subtitle">${displayInfo.address}</div>
        `;

        // Remove existing avatar section if it exists
        const existingAvatarSection = contactInfoList.querySelector('.contact-avatar-section');
        if (existingAvatarSection) {
            existingAvatarSection.remove();
        }

        // Add new avatar section at the top
        contactInfoList.insertBefore(avatarSection, contactInfoList.firstChild);

        const fields = {
            'Username': 'contactInfoUsername',
            'Name': 'contactInfoName',
            'Email': 'contactInfoEmail',
            'Phone': 'contactInfoPhone',
            'LinkedIn': 'contactInfoLinkedin',
            'X': 'contactInfoX'
        };

        Object.entries(fields).forEach(([field, elementId]) => {
            const element = document.getElementById(elementId);
            if (element) {
                const value = displayInfo[field.toLowerCase()] || 'Not provided';
                element.textContent = value;
            }
        });
    }

    // Set up chat button functionality
    setupChatButton(displayInfo) {
        const chatButton = document.getElementById('contactInfoChatButton');
        if (displayInfo.address) {
            chatButton.addEventListener('click', () => {
                this.close();
                openChatModal(displayInfo.address);
            });
            chatButton.style.display = 'block';
        } else {
            chatButton.style.display = 'none';
        }
    }

    // Open the modal
    async open(displayInfo) {
        this.currentContactAddress = displayInfo.address;
        await this.updateContactInfo(displayInfo);
        this.setupChatButton(displayInfo);

        // Update friend button status
        const contact = myData.contacts[displayInfo.address];
        if (contact) {
            this.updateFriendButton(contact.friend || false);
        }

        this.modal.classList.add('active');
    }

    // Close the modal
    close() {
        this.currentContactAddress = null;
        this.modal.classList.remove('active');
        this.menuDropdown.classList.remove('active');

        // If we made changes that affect the contact list, update it
        if (this.needsContactListUpdate) {
            updateContactsList();
            this.needsContactListUpdate = false;
        }
    }
}

// Create a singleton instance
const contactInfoModal = new ContactInfoModalManager();


function handleSignOut() {
//    const shouldLeave = confirm('Do you want to leave this page?');
//    if (shouldLeave == false) { return }

    // Save myData to localStorage if it exists
    saveState()
/*
    if (myData && myAccount) {
        localStorage.setItem(`${myAccount.username}_${myAccount.netid}`, stringify(myData));
    }
*/

    // Close all modals
    document.getElementById('menuModal').classList.remove('active');
    document.getElementById('accountModal').classList.remove('active');
    
    // Hide header and footer
    document.getElementById('header').classList.remove('active');
    document.getElementById('footer').classList.remove('active');
    document.getElementById('newChatButton').classList.remove('visible');

    // Reset header text
    document.querySelector('.app-name').textContent = 'Liberdus';
    
    // Hide all app screens
    document.querySelectorAll('.app-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show welcome screen
    document.getElementById('welcomeScreen').style.display = 'flex';
    
    handleSignOut.exit = true

    // Reload the page to get fresh welcome page
    window.location.reload();
}
handleSignOut.exit = false

// Handle sending a message
// The user has a chat modal open to a recipient and has typed a message anc clicked the Send button
// The recipient account already exists in myData.contacts; it was created when the user submitted the New Chat form
async function handleSendMessage() {
    await updateChatList()  // before sending the message check and show received messages
    const messageInput = document.querySelector('.message-input');
    const message = messageInput.value.trim();
    if (!message) return;

    const modal = document.getElementById('chatModal');
    const modalTitle = modal.querySelector('.modal-title');
    const messagesList = modal.querySelector('.messages-list');

    // Get current chat data
    const chatsData = myData
/*
    const currentAddress = Object.values(chatsData.contacts).find(contact =>
        modalTitle.textContent === (contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`)
    )?.address;
*/
    const currentAddress = appendChatModal.address
    if (!currentAddress) return;

    // Get sender's keys from wallet
    const keys = myAccount.keys;
    if (!keys) {
        alert('Keys not found for sender address');
        return;
    }

///yyy
    // Get recipient's public key from contacts
    let recipientPubKey = myData.contacts[currentAddress]?.public;
    let pqRecPubKey = myData.contacts[currentAddress]?.pqPublic;
    if (!recipientPubKey || !pqRecPubKey) {
        const recipientInfo = await queryNetwork(`/account/${longAddress(currentAddress)}`)
        if (!recipientInfo?.account?.publicKey){
            console.log(`no public key found for recipient ${currentAddress}`)
            return
        }
        recipientPubKey = recipientInfo.account.publicKey
        myData.contacts[currentAddress].public = recipientPubKey
        pqRecPubKey = recipientInfo.account.pqPublicKey
        myData.contacts[currentAddress].pqPublic = pqRecPubKey
    }

    // Generate shared secret using ECDH and take first 32 bytes
    let dhkey = ecSharedKey(keys.secret, recipientPubKey)
    const { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey)
    const combined = new Uint8Array(dhkey.length + sharedSecret.length)
    combined.set(dhkey)
    combined.set(sharedSecret, dhkey.length)
    dhkey = blake.blake2b(combined, myHashKey, 32)

    // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
    // Encrypt message using shared secret
    const encMessage = encryptChacha(dhkey, message)

    // Create message payload
    const payload = {
        message: encMessage,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: bin2base64(cipherText),
        sent_timestamp: Date.now()
    };

    // Always include username, but only include other info if recipient is a friend
    const contact = myData.contacts[currentAddress];
    // Create basic sender info with just username
    const senderInfo = {
        username: myAccount.username
    };
    
    // Add additional info only if recipient is a friend
    if (contact && contact.friend) {
        // Add more personal details for friends
        senderInfo.name = myData.account.name;
        senderInfo.email = myData.account.email;
        senderInfo.phone = myData.account.phone;
        senderInfo.linkedin = myData.account.linkedin;
        senderInfo.x = myData.account.x;
    }
    
    // Always encrypt and send senderInfo (which will contain at least the username)
    payload.senderInfo = encryptChacha(dhkey, stringify(senderInfo));

    try {
//console.log('payload is', payload)
        // Send the message transaction using postChatMessage with default toll of 1
        const response = await postChatMessage(currentAddress, payload, 1, keys);
        
        if (!response || !response.result || !response.result.success) {
            alert('Message failed to send: ' + (response.result?.reason || 'Unknown error'));
            return;
        }

        // Not needed since it is created when the New Chat form was submitted
/*
        // Create contact if needed
        if (!chatsData.contacts[currentAddress].messages) {   // TODO check if this is really needed; should be created already
            createNewContact(currentAddress)
        }
*/

        // Create new message
        const newMessage = {
            message,
            timestamp: Date.now(),
            sent_timestamp: Date.now(),
            my: true
        };
        chatsData.contacts[currentAddress].messages.push(newMessage);

        // Update or add to chats list
        const existingChatIndex = chatsData.chats.findIndex(chat => chat.address === currentAddress);
        const chatUpdate = {
            address: currentAddress,
            timestamp: newMessage.timestamp,
        };

        // Remove existing chat if present
        if (existingChatIndex !== -1) {
            chatsData.chats.splice(existingChatIndex, 1);
        }
        // Add updated chat to the beginning of the array
        chatsData.chats.unshift(chatUpdate);

        // Clear input and reset height
        messageInput.value = '';
        messageInput.style.height = '45px';

        appendChatModal()

        // Scroll to bottom of chat modal
        messagesList.parentElement.scrollTop = messagesList.parentElement.scrollHeight;

    } catch (error) {
        console.error('Message error:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Update wallet view; refresh wallet
async function updateWalletView() {
    const walletData = myData.wallet
    
    if (isOnline) {
        // Online: Get from network and cache
        await updateWalletBalances();
        try {
            const walletCacheData = addVersion({
                assetId: myAccount.keys.address,
                wallet: walletData
            });
            await saveData(STORES.WALLET, walletCacheData);
            console.log('Successfully cached wallet data:', walletCacheData);
        } catch (error) {
            console.error('Failed to cache wallet data:', error);
        }
    } else {
        // Offline: Get from cache
        try {
            const cachedData = await getData(STORES.WALLET, myAccount.keys.address);
            if (cachedData) {
                myData.wallet = cachedData.wallet;
                console.log('Using cached wallet data from:', new Date(cachedData.lastUpdated));
            }
        } catch (error) {
            console.error('Failed to read cached wallet data:', error);
        }
    }

    // Update total networth
    document.getElementById('walletTotalBalance').textContent = (walletData.networth || 0).toFixed(2);
    
    // Update assets list
    const assetsList = document.getElementById('assetsList');
    
    if (!Array.isArray(walletData.assets) || walletData.assets.length === 0) {
        assetsList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Assets Yet</div>
                <div>Your assets will appear here</div>
            </div>`;
        return;
    }
    
    assetsList.innerHTML = walletData.assets.map(asset => {
console.log('asset balance', asset, asset.balance)
        return `
            <div class="asset-item">
                <div class="asset-logo"><img src="liberdus_logo_50.png" class="asset-logo"></div>
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-symbol">$${asset.price} / ${asset.symbol}</div>
                </div>
                <div class="asset-balance">${(Number(asset.balance)/Number(wei)).toPrecision(4)}<br><span class="asset-symbol">$${asset.networth}</span></div>
            </div>
        `;
    }).join('');
}

async function updateAssetPricesIfNeeded() {
    if (!myData || !myData.wallet || !myData.wallet.assets) {
        console.error('No wallet data available to update asset prices');
        return;
    }

    const now = Date.now();
    const priceUpdateInterval = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (now - myData.wallet.priceTimestamp < priceUpdateInterval){ return }

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
//                asset.lastPriceUpdate = now;
//                myData.wallet.assets[i] = asset; // Update the asset in the array
                myData.wallet.priceTimestamp = now
                console.log(`Updated price of ${asset.symbol} to ${asset.price}`);
console.log(JSON.stringify(data,null,4))
            } else {
                console.warn(`No price data found for ${asset.symbol} from API`);
            }
        } catch (error) {
            console.error(`Failed to update price for ${asset.symbol}`, error);
        }
    }
}

function openHistoryModal() {
    const modal = document.getElementById('historyModal');
    modal.classList.add('active');
    
    // Get wallet data
    const walletData = myData.wallet

    const assetSelect = document.getElementById('historyAsset');
    
    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        assetSelect.innerHTML = '<option value="">No assets available</option>';
        return
    }
    // Populate assets dropdown
    assetSelect.innerHTML = walletData.assets.map((asset, index) =>
        `<option value="${index}">${asset.name} (${asset.symbol})</option>`
    ).join('');

    // Update addresses for first asset
    updateHistoryAddresses();
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

function updateHistoryAddresses() {         // TODO get rid of this function after changing all refrences 
    // Update transaction history
    updateTransactionHistory();
}

async function updateTransactionHistory() { 
    await updateChatList();

    const walletData = myData.wallet

    const assetIndex = document.getElementById('historyAsset').value;
    const transactionList = document.getElementById('transactionList');

    // Check if we have any assets
    if (!walletData.assets || walletData.assets.length === 0) {
        transactionList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                <div>Your transaction history will appear here</div>
            </div>`;
        return;
    }

    const asset = walletData.assets[assetIndex];
    const contacts = myData.contacts

    transactionList.innerHTML = walletData.history.map(tx => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-type ${tx.sign === -1 ? 'send' : 'receive'}">
                    ${tx.sign === -1 ? '↑ Sent' : '↓ Received'}
                </div>
                <div class="transaction-amount">
                    ${tx.sign === -1 ? '-' : '+'} ${(Number(tx.amount)/Number(wei)).toPrecision(4)} ${asset.symbol}
                </div>
            </div>
            <div class="transaction-details">
                <div class="transaction-address">
                    ${tx.sign === -1 ? 'To:' : 'From:'} ${contacts[tx.address].username}
                </div>
                <div class="transaction-time">${formatTime(tx.timestamp)}</div>
            </div>
            ${tx.memo ? `<div class="transaction-memo">${tx.memo}</div>` : ''}
        </div>
    `).join('');
}

// Form to allow user to enter info about themself
function handleAccountUpdate(event) {
    event.preventDefault();

    // Get form data
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        linkedin: document.getElementById('linkedin').value,
        x: document.getElementById('x').value
    };

    // TODO massage the inputs and check for correct formats; for now assume it is all good

    // Save to myData.account
    myData.account = { ...myData.account, ...formData };

    // Show success message
    const successMessage = document.getElementById('successMessage');
    successMessage.classList.add('active');
    
    // Hide success message after 2 seconds
    setTimeout(() => {
        successMessage.classList.remove('active');
        closeAccountForm();
    }, 2000);
}

async function queryNetwork(url) {
//console.log('query', url)
    if (!await checkOnlineStatus()) {
//TODO show user we are not online
        console.log("not online")
        alert('not online')
        return null 
    }
    const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`);
console.log('query', `${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`)
        const data = await response.json();
console.log('response', data)
        return data
    } catch (error) {
        console.error(`Error fetching balance for address ${addr.address}:`, error);
        return null
    }
}

async function pollChatInterval(milliseconds) {
    pollChats.nextPoll = milliseconds
    pollChats()
}

async function pollChats(){
    if (pollChats.nextPoll < 100){ return } // can be used to stop polling; pollChatInterval(0)
    const now = Date.now()
    if (pollChats.lastPoll + pollChats.nextPoll <= now){
        updateChatList()
        if (document.getElementById('walletScreen').classList.contains('active')) { await updateWalletView() }
        pollChats.lastPoll = now
    }
    if (pollChats.timer){ clearTimeout(pollChats.timer) }
console.log('in pollChats setting timer', now, pollChats.nextPoll)
    pollChats.timer = setTimeout(pollChats, pollChats.nextPoll)
}
pollChats.lastPoll = 0
pollChats.nextPoll = 10000   // milliseconds between polls
pollChats.timer = null

async function getChats(keys) {  // needs to return the number of chats that need to be processed
//console.log('keys', keys)
    if (! keys){ console.log('no keys in getChats'); return 0 }     // TODO don't require passing in keys
    const now = Date.now()
    if (now - getChats.lastCall < 1000){ return 0 }
    getChats.lastCall = now
//console.log('address', keys)
//console.log('mydata', myData)
//console.log('contacts', myData.contacts[keys.address])
//console.log('messages', myData.contacts[keys.address].messages)
//console.log('last messages', myData.contacts[keys.address].messages.at(-1))
//console.log('timestamp', myData.contacts[keys.address].messages.at(-1).timestamp)
    const timestamp = myAccount.chatTimestamp || 0
//    const timestamp = myData.contacts[keys.address]?.messages?.at(-1).timestamp || 0

    const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/${timestamp}`) // TODO get this working
//    const senders = await queryNetwork(`/account/${longAddress(keys.address)}/chats/0`) // TODO stop using this
    const chatCount = Object.keys(senders.chats).length
    console.log('getChats senders', 
        timestamp === undefined ? 'undefined' : JSON.stringify(timestamp),
        chatCount === undefined ? 'undefined' : JSON.stringify(chatCount),
        senders === undefined ? 'undefined' : JSON.stringify(senders))
    if (senders && senders.chats && chatCount){     // TODO check if above is working
        await processChats(senders.chats, keys)
    }
    if (appendChatModal.address){   // clear the unread count of address for open chat modal
        myData.contacts[appendChatModal.address].unread = 0 
    }
    return chatCount
}
getChats.lastCall = 0

// Actually payments also appear in the chats, so we can add these to
async function processChats(chats, keys) {
    for (let sender in chats) {
        const timestamp = myAccount.chatTimestamp || 0
        const res = await queryNetwork(`/messages/${chats[sender]}/${timestamp}`)
console.log("processChats sender", sender)
        if (res && res.messages){  
            const from = normalizeAddress(sender)
            if (!myData.contacts[from]){ createNewContact(from) }
            const contact = myData.contacts[from]
//            contact.address = from        // not needed since createNewContact does this
            let added = 0
            let newTimestamp = 0
            for (let i in res.messages){
                const tx = res.messages[i] // the messages are actually the whole tx
//console.log('message tx is')
//console.log(JSON.stringify(message, null, 4))
                newTimestamp = tx.timestamp > newTimestamp ? tx.timestamp : newTimestamp
                if (tx.type == 'message'){
                    if (tx.from == longAddress(keys.address)){ continue }  // skip if the message is from us
                    const payload = tx.xmessage  // changed to use .message
                    if (payload.encrypted){ 
                        let senderPublic = myData.contacts[from]?.public
                        if (!senderPublic){
                            const senderInfo = await queryNetwork(`/account/${longAddress(from)}`)
                            // TODO for security, make sure hash of public key is same as from address; needs to be in other similar situations
//console.log('senderInfo.account', senderInfo.account)
                            if (!senderInfo?.account?.publicKey){
                                console.log(`no public key found for sender ${sender}`)
                                continue
                            }
                            senderPublic = senderInfo.account.publicKey
                            if (myData.contacts[from]){
                                myData.contacts[from].public = senderPublic
                            }
                        }
                        payload.public = senderPublic
                    }
//console.log("payload", payload)
                    decryptMessage(payload, keys)  // modifies the payload object
                    if (payload.senderInfo){
                        contact.senderInfo = JSON.parse(JSON.stringify(payload.senderInfo))  // make a copy
                        delete payload.senderInfo
                        if (! contact.username && contact.senderInfo.username){
                            // TODO check the network to see if the username given with the message maps to the address of this contact
                            contact.username = contact.senderInfo.username
                        }
                    }
                    //  skip if this tx was processed before and is already in contact.messages;
                    //    messages are the same if the messages[x].sent_timestamp is the same as the tx.timestamp, 
                    //    and messages[x].my is false and messages[x].message == payload.message
                    let alreadyExists = false;
                    for (const existingMessage of contact.messages) {
                        if (existingMessage.sent_timestamp === payload.sent_timestamp && existingMessage.message === payload.message && existingMessage.my === false) {
                            alreadyExists = true;
                            break;
                        }
                    }
                    if (alreadyExists) {
                        continue; // Skip to the next message
                    }

//console.log('contact.message', contact.messages)
                    payload.my = false
                    payload.timestamp = Date.now()
                    contact.messages.push(payload)
                    added += 1
                } else if (tx.type == 'transfer'){
//console.log('transfer tx is')
//console.log(JSON.stringify(message, null, 4))
                    if (tx.from == longAddress(keys.address)){ continue }  // skip if the message is from us
                    const payload = tx.xmemo 
                    if (payload.encrypted){ 
                        let senderPublic = myData.contacts[from]?.public
                        if (!senderPublic){
                            const senderInfo = await queryNetwork(`/account/${longAddress(from)}`)
                    //console.log('senderInfo.account', senderInfo.account)
                            if (!senderInfo?.account?.publicKey){
                                console.log(`no public key found for sender ${sender}`)
                                continue
                            }
                            senderPublic = senderInfo.account.publicKey
                            if (myData.contacts[from]){
                                myData.contacts[from].public = senderPublic
                            }
                        }
                        payload.public = senderPublic
                    }
                    //console.log("payload", payload)
                    decryptMessage(payload, keys)  // modifies the payload object
                    if (payload.senderInfo){
                        contact.senderInfo = JSON.parse(JSON.stringify(payload.senderInfo))  // make a copy
                        delete payload.senderInfo
                        if (! contact.username && contact.senderInfo.username){
                            // TODO check the network to see if the username given with the message maps to the address of this contact
                            contact.username = contact.senderInfo.username
                        }
                    }
                    // compute the transaction id (txid)
                    delete tx.sign
                    const jstr = stringify(tx)
                    const jstrBytes = utf82bin(jstr)
                    const txidHex = blake.blake2bHex(jstrBytes, myHashKey, 32)

                    // skip if this tx was processed before and is already in the history array;
                    //    txs are the same if the history[x].txid is the same as txidHex
                    const history = myData.wallet.history
                    let alreadyInHistory = false;
                    for (const historyTx of history) {
                        if (historyTx.txid === txidHex) {
                            alreadyInHistory = true;
                            break;
                        }
                    }
                    if (alreadyInHistory) {
                        continue; // Skip to the next message
                    }
                    // add the transfer tx to the wallet history
                    const newPayment = {
                        txid: txidHex,
                        amount: parse(stringify(tx.amount)),  // need to make a copy
                        sign: 1,
                        timestamp: payload.sent_timestamp,
                        address: from,
                        memo: payload.message
                    };
                    history.unshift(newPayment);
                    //  sort history array based on timestamp field in descending order
                    history.sort((a, b) => b.timestamp - a.timestamp);
                }
            }
            if (newTimestamp > 0){
                // Update the timestamp
                myAccount.chatTimestamp = newTimestamp
            }
            // If messages were added to contact.messages, update myData.chats
            if (added > 0) {
                // Get the most recent message
                const latestMessage = contact.messages[contact.messages.length - 1];
                
                // Create chat object with only guaranteed fields
                const chatUpdate = {
                    address: from,
                    timestamp: latestMessage.timestamp,
                };

                contact.unread += added;  // setting this will show a unread bubble count

                // Remove existing chat for this contact if it exists
                const existingChatIndex = myData.chats.findIndex(chat => chat.address === from);
                if (existingChatIndex !== -1) {
                    myData.chats.splice(existingChatIndex, 1);
                }

                // Find insertion point to maintain timestamp order (newest first)
                const insertIndex = myData.chats.findIndex(chat => chat.timestamp < chatUpdate.timestamp);
                
                if (insertIndex === -1) {
                    // If no earlier timestamp found, append to end
                    myData.chats.push(chatUpdate);
                } else {
                    // Insert at correct position to maintain order
                    myData.chats.splice(insertIndex, 0, chatUpdate);
                }
            }
        }
    }
}

// We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
async function decryptMessage(payload, keys){
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
                if (payload.message){
                    payload.message = decryptChacha(dhkey, payload.message);
                    if (payload.message == null){ payload.message = 'Decryption failed.'}
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
                    payload.senderInfo = {username:'decryption_failed'}
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
`

async function postChatMessage(to, payload, toll, keys) {
    const toAddr = longAddress(to);
    const fromAddr = longAddress(keys.address)
    const tx = {
        type: 'message',
        from: fromAddr,
        to: toAddr,
        amount: BigInt(toll),       // not sure if this is used by the backend
        chatId: blake.blake2bHex([fromAddr, toAddr].sort().join``, myHashKey, 32),
        message: 'x',
        xmessage: payload,
        timestamp: Date.now(),
        network: '0000000000000000000000000000000000000000000000000000000000000000',
        fee: BigInt(parameters.current.transactionFee || 1)           // This is not used by the backend
    }
    const res = await injectTx(tx, keys)
    return res        
}

async function postAssetTransfer(to, amount, memo, keys) {
    const toAddr = longAddress(to)
    const fromAddr = longAddress(keys.address)
    const tx = {
        type: 'transfer',
        from: fromAddr,
        to: toAddr,
        amount: BigInt(amount),
        chatId: blake.blake2bHex([fromAddr, toAddr].sort().join``, myHashKey, 32),
// TODO backend is not allowing memo > 140 characters; by pass using xmemo; we might have to check the total tx size instead
//        memo: stringify(memo),
        xmemo: memo,
        timestamp: Date.now(),
        network: '0000000000000000000000000000000000000000000000000000000000000000',
        fee: BigInt(parameters.current.transactionFee || 1)           // This is not used by the backend
    }
    const res = await injectTx(tx, keys)
    return res
}

// TODO - backend - when account is being registered, ensure that loserCase(alias)=alias and hash(alias)==aliasHash 
async function postRegisterAlias(alias, keys){
    const aliasBytes = utf82bin(alias)
    const aliasHash = blake.blake2bHex(aliasBytes, myHashKey, 32)
    const { publicKey, secretKey } = ml_kem1024.keygen(hex2bin(keys.pqSeed))
    const pqPublicKey = bin2base64(publicKey)
    const tx = {
        type: 'register',
        aliasHash: aliasHash,
        from: longAddress(keys.address),
        alias: alias,
        publicKey: keys.public,
        pqPublicKey: pqPublicKey,
        timestamp: Date.now()
    }
    const res = await injectTx(tx, keys)
    return res
}

async function injectTx(tx, keys){
    const txid = await signObj(tx, keys)  // add the sign obj to tx
    // Get random gateway
    const randomGateway = network.gateways[Math.floor(Math.random() * network.gateways.length)];
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: stringify({tx: stringify(tx)})
    }
    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/inject`, options);
        const data = await response.json();     
        data.txid = txid           
        return data
    } catch (error) {
        console.error('Error injecting tx:', error, tx);
        return error;
    }
}

async function signObj(tx, keys){
    const jstr = stringify(tx)
//console.log('tx stringify', jstr)
    const jstrBytes = utf82bin(jstr)
    const txidHex = blake.blake2bHex(jstrBytes, myHashKey, 32)
    const txidHashHex = ethHashMessage(txidHex)     // Asked Thant why we are doing this; 
                                                    //  why hash txid with ethHashMessage again before signing
                                                    //  why not just sign the original txid
                                                    // https://discord.com/channels/746426387606274199/1303158886089359431/1329097165137772574

    const sig = await secp.signAsync(hex2bin(txidHashHex), hex2bin(keys.secret))
    const r = sig.r.toString(16).padStart(64, '0');
    const s = sig.s.toString(16).padStart(64, '0');
    // Convert recovery to hex and append (27 + recovery)
    const v = (27 + sig.recovery).toString(16).padStart(2, '0');
    // Concatenate everything with 0x prefix
    const flatSignature = `0x${r}${s}${v}`;
    tx.sign = {
        owner: longAddress(keys.address),
        sig: flatSignature
    }
    return txidHex
}

// Based on what ethers.js is doing in the following code
// hashMessage() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/hash/message.ts#L35
// concat() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/utils/data.ts#L116
// MessagePrefix https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/constants/strings.ts#L16
// keccak256 https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/crypto/keccak.ts#L44
// input message can be string or binary; output is hex; binary means Uint8Array
function ethHashMessage(message){
    if (typeof(message) === "string") { message = utf82bin(message); }
    const MessagePrefix = "\x19Ethereum Signed Message:\n"
    const str = bin2hex(utf82bin(MessagePrefix)) + bin2hex(utf82bin(String(message.length))) + bin2hex(message)
    return bin2hex(keccak256(hex2bin(str)))
}

// key is binary, data is string, output is base64
function encryptChacha(key, data) {
    const nonce = window.crypto.getRandomValues(new Uint8Array(24))
    const cipher = xchacha20poly1305(key, nonce);
    const encrypted = cipher.encrypt(utf82bin(data));
    
    // Combine nonce + encrypted data (which includes authentication tag)
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    
    return bin2base64(combined);
}

// key is binary, encrypted is base64, output is string
function decryptChacha(key, encrypted) {
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
        return null
    }
}

// Service Worker Registration and Management
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        Logger.log('Service Worker not supported');
        return;
    }

    try {
        // Get the current service worker registration
        const registration = await navigator.serviceWorker.getRegistration();
        
        // If there's an existing service worker
        if (registration?.active) {
            console.log('Service Worker already registered and active');
            Logger.log('Service Worker already registered and active');
            
            // Set up message handling for the active worker
            setupServiceWorkerMessaging(registration.active);
            
            // Check if there's a new version waiting
            if (registration.waiting) {
                // Notify user about new version
                showUpdateNotification(registration);
            }
            
            return registration;
        }

        // Explicitly unregister any existing registration
        if (registration) {
            await registration.unregister();
        }

        // Register new service worker
        const newRegistration = await navigator.serviceWorker.register('./service-worker.js', {
            scope: './',
            updateViaCache: 'none' // Don't cache service worker file
        });

        console.log('Service Worker registered successfully:', newRegistration.scope);
        Logger.log('Service Worker registered successfully:', newRegistration.scope);

        // Set up new service worker handling
        newRegistration.addEventListener('updatefound', () => {
            const newWorker = newRegistration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    showUpdateNotification(newRegistration);
                }
            });
        });

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('Service Worker ready');
        Logger.log('Service Worker ready');

        return newRegistration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        Logger.error('Service Worker registration failed:', error);
        return null;
    }
}

// Handle service worker messages
function setupServiceWorkerMessaging() {
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        
        // Handle different message types
        switch (data.type) {
            case 'error':
                console.error('Service Worker error:', data.error);
                break;
            case 'OFFLINE_MODE':
                console.warn('Service worker detected offline mode:', data.url);
                Logger.warn('Service worker detected offline mode:', data.url);
                isOnline = false;
                updateUIForConnectivity();
                markConnectivityDependentElements();
                break;
            case 'CACHE_UPDATED':
                console.log('Cache updated:', data.url);
                break;
            case 'CACHE_ERROR':
                console.error('Cache error:', data.error);
                break;
            case 'OFFLINE_READY':
                showToast('App ready for offline use');
                break;
            case 'NEW_CONTENT':
                showUpdateNotification();
                break;
        }
    });
}

// App state management
function setupAppStateManagement() {
    // Initialize app state
    localStorage.setItem('appPaused', '0');
    
    // Stop polling if service worker was already polling
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage({ type: 'stop_polling' });
        });
    }

    // Handle visibility changes
    document.addEventListener('visibilitychange', async () => {
        if (!myData || !myAccount) return; // Only manage state if logged in
        
        if (document.hidden) {
            // App is being hidden/closed
            console.log('📱 App hidden - starting service worker polling');
            Logger.log('📱 App hidden - starting service worker polling');
            const timestamp = Date.now().toString();
            localStorage.setItem('appPaused', timestamp);
            
            // Prepare account data for service worker
            const accountData = {
                address: myAccount.keys.address,
                network: {
                    gateways: network.gateways
                }
            };
            
            
            // Start polling in service worker with timestamp and account data
            const registration = await navigator.serviceWorker.ready;
            registration.active?.postMessage({ 
                type: 'start_polling',
                timestamp,
                account: accountData  
            });
        } else {
            // App is becoming visible/open
            console.log('📱 App visible - stopping service worker polling');
            Logger.log('📱 App visible - stopping service worker polling');
            localStorage.setItem('appPaused', '0');
            
            // Stop polling in service worker
            const registration = await navigator.serviceWorker.ready;
            registration.active?.postMessage({ type: 'stop_polling' });

            await updateChatList('force');
        }
    });
}

function ecSharedKey(sec, pub){
    return secp.getSharedSecret(
        hex2bin(sec),
        hex2bin(pub)
    ).slice(1, 33);  // TODO - we were taking only first 32 bytes for chacha; now we can return the whole thing
}

function pqSharedKey(recipientKey, encKey){  // inputs base64 or binary, outputs binary
    if (typeof(recipientKey) == 'string'){ recipientKey = base642bin(recipientKey)}
    if (encKey){
        if (typeof(encKey) == 'string'){ encKey = base642bin(encKey)} 
        return ml_kem1024.decapsulate(encKey, recipientKey);
    }
    return ml_kem1024.encapsulate(recipientKey);  // { cipherText, sharedSecret }
}


function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
            .then(permission => {
                console.log('Notification permission result:', permission);
                Logger.log('Notification permission result:', permission);
                // Optional: Hide a notification button if granted.
                if (permission === 'granted') {
                    const notificationButton = document.getElementById('requestNotificationPermission');
                    if (notificationButton) {
                        notificationButton.style.display = 'none';
                    }
                } else {
                    console.log('Notification permission denied');
                    Logger.log('Notification permission denied');
                }
            })
            .catch(error => {
                console.error('Error during notification permission request:', error);
                Logger.error('Error during notification permission request:', error);
            });
    }
}


async function updateLogsView() {
    const logsContainer = document.getElementById('logsContainer');
    const logs = await Logger.getLogs();
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Use logs directly without sorting - they'll be in insertion order
    const dateFormatter = new Intl.DateTimeFormat();
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    logs.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${log.level || 'info'}`;
        
        const date = new Date(log.timestamp);
        logEntry.innerHTML = `
            <span class="log-timestamp">${dateFormatter.format(date)} ${timeFormatter.format(date)}</span>
            <span class="log-source">[${log.source || 'app'}]</span>
            <span class="log-level">${log.level || 'info'}</span>
            <pre class="log-message">${escapeHtml(formatMessage(log.message))}</pre>
        `;
        fragment.appendChild(logEntry);
    });

    logsContainer.innerHTML = '';
    logsContainer.appendChild(fragment);
    logsContainer.scrollTop = logsContainer.scrollHeight;  // This scrolls to bottom
}

// Helper functions moved outside for reuse
function formatMessage(message) {
    // If message is an array (from new format)
    if (Array.isArray(message)) {
        return message.map(part => {
            try {
                // Try to parse if it looks like JSON
                if (typeof part === 'string' && 
                    (part.startsWith('{') || part.startsWith('[') || 
                     part.startsWith('"') || part === 'null' || 
                     part === '"undefined"')) {
                    return JSON.stringify(JSON.parse(part), null, 2);
                }
                return part;
            } catch (e) {
                return part;
            }
        }).join(' ');
    }

    // Legacy format (string)
    try {
        const parsed = JSON.parse(message);
        return JSON.stringify(parsed, null, 2);
    } catch (e) {
        return message;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(func, waitFn) {
    let timeout;
    return function executedFunction(...args) {
        const wait = typeof waitFn === 'function' ? waitFn(args[0]) : waitFn;
        
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function truncateMessage(message, maxLength = 50) {
    return message.length > maxLength
        ? message.substring(0, maxLength) + '...'
        : message;
}

// Add these search-related functions
function searchMessages(searchText) {
    if (!searchText || !myData?.contacts) return [];
    
    const results = [];
    const searchLower = searchText.toLowerCase();
    
    // Search through all contacts and their messages
    Object.entries(myData.contacts).forEach(([address, contact]) => {
        if (!contact.messages) return;
        
        contact.messages.forEach((message, index) => {
            if (message.message.toLowerCase().includes(searchLower)) {
                // Highlight matching text
                const messageText = message.message;
                const highlightedText = messageText.replace(
                    new RegExp(searchText, 'gi'),
                    match => `<mark>${match}</mark>`
                );
                
                results.push({
                    contactAddress: address,
                    username: contact.username || address,
                    messageId: index,
                    message: message,  // Pass the entire message object
                    timestamp: message.timestamp,
                    preview: truncateMessage(highlightedText, 100),
                    my: message.my  // Include the my property
                });
            }
        });
    });
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    // Create a ul element to properly contain the list items
    const resultsList = document.createElement('ul');
    resultsList.className = 'chat-list';
    
    results.forEach(async result => {
        const resultElement = document.createElement('li');
        resultElement.className = 'chat-item search-result-item';
        
        // Generate identicon for the contact
        const identicon = await generateIdenticon(result.contactAddress);
        
        // Format message preview with "You:" prefix if it's a sent message
        const messagePreview = result.my ? `You: ${result.preview}` : result.preview;
        
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

        resultElement.addEventListener('click', () => {
            handleSearchResultClick(result);
        });

        resultsList.appendChild(resultElement);
    });

    // Clear and append the new list
    searchResults.innerHTML = '';
    searchResults.appendChild(resultsList);
}

function displayEmptyState(containerId, message = "No results found") {
    const resultsContainer = document.getElementById(containerId);
    resultsContainer.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-message">${message}</div>
        </div>
    `;
}

function handleSearchResultClick(result) {
    try {
        // Close search modal
        document.getElementById('searchModal').classList.remove('active');
        
        // Switch to chats view if not already there
        switchView('chats');
        
        // Open the chat with this contact
        handleResultClick(result.contactAddress);
        
        // Scroll to and highlight the message
        setTimeout(() => {
            const messageElement = document.querySelector(`[data-message-id="${result.messageId}"]`);
            if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                messageElement.classList.add('highlighted');
                setTimeout(() => messageElement.classList.remove('highlighted'), 2000);
            } else {
                console.error('Message not found');
                // Could add a toast notification here
            }
        }, 300);
    } catch (error) {
        console.error('Error handling search result:', error);
        // Could add error notification here
    }
}

// Add the search input handler
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const messageSearch = document.getElementById('messageSearch');
    const searchResults = document.getElementById('searchResults');
    const searchModal = document.getElementById('searchModal');
    
    // Debounced search function
    const debouncedSearch = debounce((searchText) => {
        const trimmedText = searchText.trim();
        
        if (!trimmedText) {
            searchResults.innerHTML = '';
            return;
        }

        const results = searchMessages(trimmedText);
        if (results.length === 0) {
            displayEmptyState('searchResults', "No messages found");
        } else {
            displaySearchResults(results);
        }
    }, (searchText) => searchText.length === 1 ? 600 : 300); // Dynamic wait time
    
    // Connect search input to modal input
    searchInput.addEventListener('click', () => {
        searchModal.classList.add('active');
        messageSearch.focus();
    });
    
    // Handle search input
    messageSearch.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
}

// Add loading state display function
function displayLoadingState() {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = `
        <div class="search-loading">
            Searching messages
        </div>
    `;
}

async function handleResultClick(contactAddress) {
    // Get the contact info
    const contact = myData.contacts[contactAddress];
    if (!contact) return;

    // Open chat modal
    const chatModal = document.getElementById('chatModal');
    chatModal.classList.add('active');

    // Generate the identicon first
    const identicon = await generateIdenticon(contactAddress);

    // Update chat header with contact info and avatar - match exact structure from chat view
    const modalHeader = chatModal.querySelector('.modal-header');
    modalHeader.innerHTML = `
        <button class="back-button" id="closeChatModal"></button>
        <div class="chat-user-info">
            <div class="modal-avatar">${identicon}</div>
            <div class="modal-title">${contact.username || contactAddress}</div>
        </div>
    `;

    // Re-attach close button event listener
    document.getElementById('closeChatModal').addEventListener('click', () => {
        chatModal.classList.remove('active');
    });

    // Add click handler for username to show contact info
    const userInfo = chatModal.querySelector('.chat-user-info');
    userInfo.onclick = () => {
        if (contact) {
            contactInfoModal.open(createDisplayInfo(contact));
        }
    };

    // Ensure messages container structure matches
    const messagesContainer = chatModal.querySelector('.messages-container');
    if (!messagesContainer) {
        const container = document.createElement('div');
        container.className = 'messages-container';
        container.innerHTML = '<div class="messages-list"></div>';
        chatModal.appendChild(container);
    }

    // Load messages
    const messagesList = chatModal.querySelector('.messages-list');
    messagesList.innerHTML = ''; // Clear existing messages

    // Add messages if they exist
    if (contact.messages && contact.messages.length > 0) {
        contact.messages.forEach((msg, index) => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${msg.my ? 'sent' : 'received'}`;
            messageElement.setAttribute('data-message-id', index);
            messageElement.innerHTML = `
                <div class="message-content">${msg.message}</div>
                <div class="message-time">${formatTime(msg.timestamp)}</div>
            `;
            messagesList.appendChild(messageElement);
        });
        
        // Scroll to bottom of messages
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    // Ensure input container exists
    const inputContainer = chatModal.querySelector('.message-input-container');
    if (!inputContainer) {
        const container = document.createElement('div');
        container.className = 'message-input-container';
        container.innerHTML = `
            <textarea class="message-input" placeholder="Type a message..."></textarea>
            <button class="send-button" id="handleSendMessage">
                <svg viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
            </button>
        `;
        chatModal.appendChild(container);
    }

    // Store current contact for message sending
    handleResultClick.currentContact = contactAddress;
}

// Contact search functions
function searchContacts(searchText) {
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
        const matches = searchFields.some((field) =>
            field.toLowerCase().includes(searchLower)
        );

        if (matches) {
            // Determine match type for sorting
            const exactMatch = searchFields.some(
                (field) => field.toLowerCase() === searchLower
            );
            const startsWithMatch = searchFields.some((field) =>
                field.toLowerCase().startsWith(searchLower)
            );

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
        return (a.username || "").localeCompare(b.username || "");
    });
}

function displayContactResults(results, searchText) {
    const resultsContainer = document.getElementById("contactSearchResults");
    resultsContainer.innerHTML = "";

    results.forEach(async (contact) => {
        const contactElement = document.createElement("div");
        contactElement.className = "chat-item contact-item";
        
        // Generate identicon for the contact
        const identicon = await generateIdenticon(contact.address);
        
        // Determine which field matched for display
        const matchedField = [
            { field: 'username', value: contact.username },
            { field: 'name', value: contact.name },
            { field: 'email', value: contact.email },
            { field: 'phone', value: contact.phone },
            { field: 'linkedin', value: contact.linkedin },
            { field: 'x', value: contact.x }
        ].find(f => f.value && f.value.toLowerCase().includes(searchText.toLowerCase()));

        // Create match preview with label and highlighted matched value
        const matchPreview = matchedField 
            ? `${matchedField.field}: ${matchedField.value.replace(
                new RegExp(searchText, 'gi'),
                match => `<mark>${match}</mark>`
              )}`
            : '';
        
        contactElement.innerHTML = `
            <div class="chat-avatar">
                ${identicon}
            </div>
            <div class="chat-content">
                <div class="chat-header">
                    <span class="chat-name">${contact.username || "Unknown"}</span>
                </div>
                <div class="chat-message">
                    <span class="match-label">${matchPreview}</span>
                </div>
            </div>
        `;

        // Add click handler to show contact info
        contactElement.addEventListener("click", () => {
            // Create display info and open contact info modal
            contactInfoModal.open(createDisplayInfo(contact));
            // Close the search modal
            document.getElementById("contactSearchModal").classList.remove("active");
        });

        resultsContainer.appendChild(contactElement);
    });
}

// Create a display info object from a contact object
function createDisplayInfo(contact) {
    return {
        username: contact.senderInfo?.username || contact.username || contact.address.slice(0,8) + '...' + contact.address.slice(-6),
        name: contact.name || contact.senderInfo?.name || 'Not provided',
        email: contact.senderInfo?.email || 'Not provided',
        phone: contact.senderInfo?.phone || 'Not provided',
        linkedin: contact.senderInfo?.linkedin || 'Not provided',
        x: contact.senderInfo?.x || 'Not provided',
        address: contact.address
    };
}

// Add this function before the ContactInfoModalManager class
function showToast(message, duration = 2000) {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Force reflow to enable transition
    toast.offsetHeight;
    
    // Show the toast
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Hide and remove the toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300); // Match transition duration
    }, duration);
}

// Show update notification to user
function showUpdateNotification(registration) {
    // Create update notification
    const updateNotification = document.createElement('div');
    updateNotification.className = 'update-notification';
    updateNotification.innerHTML = `
        <div class="update-message">
            A new version is available
            <button class="update-button">
                Update Now
            </button>
        </div>
    `;
    
    // Add click handler directly to the button
    updateNotification.querySelector('.update-button').addEventListener('click', () => {
        updateServiceWorker();
    });
    
    document.body.appendChild(updateNotification);
}

// Update the service worker
async function updateServiceWorker() {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    // If there's a waiting worker, activate it
    if (registration.waiting) {
        // Send message to service worker to skip waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Reload once the new service worker takes over
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New service worker activated, reloading...');
            window.location.reload();
        });
    }
}

// Handle online/offline events
async function handleConnectivityChange(event) {
    if (event.type === 'offline') {
        const wasOnline = isOnline;
        // Trust offline events immediately
        isOnline = false;
        updateUIForConnectivity();
        if (wasOnline) {
            showToast("You're offline. Some features are unavailable.", 3000, "offline");
        }
    } else {
        // For online events, verify connectivity before updating UI
        const wasOffline = !isOnline;
        isOnline = await checkOnlineStatus();

        if (isOnline && wasOffline) {
            updateUIForConnectivity();
            showToast("You're back online!", 3000, "online");
            
            // Sync any pending offline actions
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && 'sync' in registration) {
                try {
                    await registration.sync.register('sync-messages');
                    await registration.sync.register('sync-transactions');
                } catch (err) {
                    console.error('Background sync registration failed:', err);
                }
            }
        }
    }
}

// Setup connectivity detection
function setupConnectivityDetection() {
    // Listen for browser online/offline events
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);

    // Mark elements that depend on connectivity
    markConnectivityDependentElements();

    // Check initial status (don't trust the browser's initial state)
    checkConnectivity();

    // Periodically check connectivity (every 30 seconds)
    setInterval(checkConnectivity, 30000);
}

// Mark elements that should be disabled when offline
function markConnectivityDependentElements() {
    // Elements that require network connectivity
    const networkDependentElements = [
        // Chat related
        '#handleSendMessage',
        '.message-input',
        '#newChatButton',
        
        // Wallet related
        '#openSendModal',
        '#refreshBalance',
        '#sendForm button[type="submit"]',
        
        // Contact related
        '#chatRecipient',
        
        // Profile related
        '#accountForm button[type="submit"]',
        '#createAccountForm button[type="submit"]',
        '#importForm button[type="submit"]'
    ];

    // Add data attribute to all network-dependent elements
    networkDependentElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.setAttribute('data-requires-connection', 'true');
            
            // Add tooltip for disabled state
            element.title = 'This feature requires an internet connection';
            
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
    
    networkDependentElements.forEach(element => {
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
}

// Prevent form submissions when offline
function preventOfflineSubmit(event) {
    if (!isOnline) {
        event.preventDefault();
        showToast('This action requires an internet connection', 3000, 'error');
    }
}


// Add global isOnline variable at the top with other globals
let isOnline = true; // Will be updated by connectivity checks

// Add checkConnectivity function before setupConnectivityDetection
async function checkConnectivity() {
    const wasOffline = !isOnline;
    isOnline = await checkOnlineStatus();
    
    if (isOnline !== wasOffline) {
        // Only trigger change handler if state actually changed
        await handleConnectivityChange({ type: isOnline ? 'online' : 'offline' });
    }
}


