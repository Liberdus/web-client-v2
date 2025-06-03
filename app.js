// Check if there is a newer version and load that using a new random url to avoid cache hits
//   Versions should be YYYY.MM.DD.HH.mm like 2025.01.25.10.05
const version = 't'   // Also increment this when you increment version.html
let myVersion = '0'
async function checkVersion(){
    myVersion = localStorage.getItem('version') || '0';
    let newVersion;
    try {
        const response = await fetch(`version.html?${getCorrectedTimestamp()}`);
        if (!response.ok) throw new Error('Version check failed');
        newVersion = await response.text();
    } catch (error) {
        console.error('Version check failed:', error);
        alert('Version check failed. Your Internet connection may be down.')
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
    if (parseInt(myVersion.replace(/\D/g, '')) != parseInt(newVersion.replace(/\D/g, ''))) {
        if (parseInt(myVersion.replace(/\D/g, '')) > 0){
            alert('Updating to new version: ' + newVersion + ' ' + version)
        }
        localStorage.setItem('version', newVersion); // Save new version
        forceReload(['./', 'index.html','styles.css','app.js','lib.js', 'network.js', 'service-worker.js', 'offline.html'])
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

// Function to attempt locking orientation to portrait
async function lockToPortrait() {
    try {
        // Attempt to lock the orientation to any portrait mode.
        // This will throw an error if screen.orientation or screen.orientation.lock is undefined,
        // or if the lock operation itself fails.
        await screen.orientation.lock("portrait");
        console.log("Screen orientation locked to portrait.");
    } catch (error) {
        // Log any error encountered during the attempt
        console.warn("Could not lock screen orientation:", error);
    }
}

// https://github.com/shardus/lib-crypto-web/blob/main/utils/stringify.js
// Needed to stringify and parse bigints; also deterministic stringify
//   modified to use export
import { stringify, parse } from './external/stringify-shardus.js';

// Import crypto functions from crypto.js
import {
    encryptChacha, encryptData, decryptData,
    decryptMessage, ecSharedKey, pqSharedKey, ethHashMessage,
    hashBytes, deriveDhKey,
    generateRandomPrivateKey, getPublicKey, signMessage, generatePQKeys,
    generateRandomBytes, generateAddress
} from './crypto.js';

// Put standalone conversion function in lib.js
import { normalizeUsername, generateIdenticon, formatTime,
    isValidEthereumAddress,
    normalizeAddress, longAddress, utf82bin, bigxnum2big,
    big2str, bin2base64, hex2bin, bin2hex, linkifyUrls, escapeHtml,
    debounce, truncateMessage
} from './lib.js';

const weiDigits = 18;
const wei = 10n**BigInt(weiDigits)
const pollIntervalNormal = 30000 // in millisconds
const pollIntervalChatting = 5000  // in millseconds
//network.monitor.url = "http://test.liberdus.com:3000"    // URL of the monitor server
//network.explorer.url = "http://test.liberdus.com:6001"   // URL of the chain explorer


let myData = null
let myAccount = null        // this is set to myData.account for convience
let isInstalledPWA = false
let timeSkew = 0

let updateWebSocketIndicatorIntervalId = null;
let checkPendingTransactionsIntervalId = null;
//let checkConnectivityIntervalId = null;

// Used in getNetworkParams function
const NETWORK_ACCOUNT_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const NETWORK_ACCOUNT_ID = '0000000000000000000000000000000000000000000000000000000000000000';

// TODO - get the parameters from the network
// mock network parameters
let parameters = {
    current: {
        transactionFee: 1n * wei
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
    // First check if we're offline
    if (!isOnline) {
        console.log('Checking username availability offline');
        // When offline, check local storage only
        const { netid } = network;
        const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
        const netidAccounts = existingAccounts.netids[netid];

        // If we have this username locally and the address matches
        if (netidAccounts?.usernames &&
            netidAccounts.usernames[username] &&
            normalizeAddress(netidAccounts.usernames[username].address) === normalizeAddress(address)) {
            console.log('Username found locally and matches address');
            return 'mine';
        }

        // If we have the username but address doesn't match
        if (netidAccounts?.usernames && netidAccounts.usernames[username]) {
            console.log('Username found locally but address does not match');
            return 'taken';
        }

        // Username not found locally
        console.log('Username not found locally');
        return 'available';
    }

    // Online flow - existing implementation
    const randomGateway = getGatewayForRequest();
    if (!randomGateway) {
        console.error('No gateway available for username check');
        return 'error';
    }

    const usernameBytes = utf82bin(normalizeUsername(username))
    const usernameHash = hashBytes(usernameBytes);
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

    const usernameSelect = document.getElementById('username');
    // Populate select with usernames
    usernameSelect.innerHTML = `
        <option value="" disabled selected hidden>Select an account</option>
        ${usernames.map(username => `<option value="${username}">${username}</option>`).join('')}
    `;

        // If only one account exists, select it and trigger change event
    if (usernames.length === 1) {
        usernameSelect.value = usernames[0];
        usernameSelect.dispatchEvent(new Event('change'));
        return;
    }


    // Multiple accounts exist, show modal with select dropdown
    const submitButton = document.querySelector('#signInForm button[type="submit"]');
    const removeButton = document.getElementById('removeAccountButton');
    const notFoundMessage = document.getElementById('usernameNotFound');

    submitButton.disabled = true;  // Keep button disabled until an account is selected
    submitButton.textContent = 'Sign In';
    submitButton.style.display = 'inline';
    removeButton.style.display = 'none';
    notFoundMessage.style.display = 'none';

    const signInModalLastItem = document.getElementById('signInModalLastItem');
    // set timeout to focus on the last item so shift+tab and tab prevention works
    setTimeout(() => {
        signInModalLastItem.focus();
    }, 100);

}

async function handleRemoveAccountButton() {
    removeAccountModal.confirmSubmit()
}

async function handleUsernameOnSignInModal() {
    console.log('in handleUsernameOnSignInModal')
    // Get existing accounts
    const { netid } = network;
    const existingAccounts = parse(localStorage.getItem('accounts') || '{"netids":{}}');
    const netidAccounts = existingAccounts.netids[netid];
    const usernames = netidAccounts?.usernames ? Object.keys(netidAccounts.usernames) : [];
    const usernameSelect = document.getElementById('username');
    const submitButton = document.querySelector('#signInForm button[type="submit"]');
    // Enable submit button when an account is selected
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
        handleSignIn();
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
}

function closeSignInModal() {
    document.getElementById('signInModal').classList.remove('active');
}

function openCreateAccountModal() {
    document.getElementById('createAccountModal').classList.add('active');
}

// Check availability on input changes
let createAccountCheckTimeout;
function handleCreateAccountInput(e) {
    const username = normalizeUsername(e.target.value);
    const usernameAvailable = document.getElementById('newUsernameAvailable');
    const submitButton = document.querySelector('#createAccountForm button[type="submit"]');

    // Clear previous timeout
    if (createAccountCheckTimeout) {
        clearTimeout(createAccountCheckTimeout);
    }

    // Reset display
    usernameAvailable.style.display = 'none';
    // username available test: change to false to test pending register tx
    submitButton.disabled = true;

    // Check if username is too short
    if (username.length < 3) {
        usernameAvailable.textContent = 'too short';
        usernameAvailable.style.color = '#dc3545';
        usernameAvailable.style.display = 'inline';
        return;
    }

    // Check network availability
    createAccountCheckTimeout = setTimeout(async () => {
        const taken = await checkUsernameAvailability(username);
        if (taken == 'taken') {
            usernameAvailable.textContent = 'taken';
            usernameAvailable.style.color = '#dc3545';
            usernameAvailable.style.display = 'inline';
            // username available test: comment out to test pending register tx
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
}

function closeCreateAccountModal() {
    document.getElementById('createAccountModal').classList.remove('active');
}

async function handleCreateAccount(event) {
    // disable submit button
    const submitButton = document.querySelector('#createAccountForm button[type="submit"]');
    submitButton.disabled = true;
    // disable input fields, back button, and toggle button
    const toggleButton = document.getElementById('togglePrivateKeyInput');
    const usernameInput = document.getElementById('newUsername');
    const privateKeyInput = document.getElementById('newPrivateKey');
    const backButton = document.getElementById('closeCreateAccountModal');
    
    toggleButton.disabled = true;
    usernameInput.disabled = true;
    privateKeyInput.disabled = true;
    backButton.disabled = true;

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
            // Re-enable controls on validation failure
            submitButton.disabled = false;
            toggleButton.disabled = false;
            usernameInput.disabled = false;
            privateKeyInput.disabled = false;
            backButton.disabled = false;
            return;
        }

        privateKey = hex2bin(validation.key);
        privateKeyHex = validation.key;
        privateKeyError.style.display = 'none';
    } else {
        privateKey = generateRandomPrivateKey();
        privateKeyHex = bin2hex(privateKey);
        privateKeyError.style.display = 'none'; // Ensure hidden if generated
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
                privateKeyError.textContent = 'An account already exists for this private key.';
                privateKeyError.style.color = '#dc3545';
                privateKeyError.style.display = 'inline';
                // Re-enable controls when account already exists
                submitButton.disabled = false;
                toggleButton.disabled = false;
                usernameInput.disabled = false;
                privateKeyInput.disabled = false;
                backButton.disabled = false;
                return; // Stop the account creation process
            } else {
                 console.log('No existing account found for this private key.');
                 privateKeyError.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking for existing account:', error);
            privateKeyError.textContent = 'Network error checking key. Please try again.';
            privateKeyError.style.color = '#dc3545';
            privateKeyError.style.display = 'inline';
            // Re-enable controls on network error
            submitButton.disabled = false;
            toggleButton.disabled = false;
            usernameInput.disabled = false;
            privateKeyInput.disabled = false;
            backButton.disabled = false;
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
            type: "secp256k1",
            pqSeed: pqSeed,  // store only the 64 byte seed instead of 32,000 byte public and secret keys
        }
    };

    // Create new data entry
    myData = newDataRecord(myAccount);
    let waitingToastId = showToast('Creating account...', 0, 'loading');
    const res = await postRegisterAlias(username, myAccount.keys);

    if (res && res.result && res.result.success && res.txid) {
        const txid = res.txid;

        try {
            // Start intervals since trying to create account and tx should be in pending
            if (!updateWebSocketIndicatorIntervalId) {
                updateWebSocketIndicatorIntervalId = setInterval(updateWebSocketIndicator, 5000);
            }
            if (!checkPendingTransactionsIntervalId) {
                checkPendingTransactionsIntervalId = setInterval(checkPendingTransactions, 5000);
            }

            // Wait for the transaction confirmation
            const confirmationDetails = await pendingPromiseService.register(txid);
            if (confirmationDetails.username !== username || confirmationDetails.address !== longAddress(myAccount.keys.address)) {
                throw new Error("Confirmation details mismatch.");
            }

            if (waitingToastId) hideToast(waitingToastId);
            showToast('Account created successfully!', 3000, 'success');
            submitButton.disabled = false;
            toggleButton.disabled = false;
            usernameInput.disabled = false;
            privateKeyInput.disabled = false;
            backButton.disabled = false;
            closeCreateAccountModal();
            document.getElementById('welcomeScreen').style.display = 'none';
            getChats.lastCall = getCorrectedTimestamp();
            // Store updated accounts back in localStorage
            existingAccounts.netids[netid].usernames[username] = {address: myAccount.keys.address};
            localStorage.setItem('accounts', stringify(existingAccounts));
            saveState();

            await switchView('chats');
        } catch (error) {
            if (waitingToastId) hideToast(waitingToastId);
            console.log(`DEBUG: handleCreateAccount error`, JSON.stringify(error, null, 2));
            showToast(`account creation failed: ${error}`, 0, 'error');
            submitButton.disabled = false;
            toggleButton.disabled = false;
            usernameInput.disabled = false;
            privateKeyInput.disabled = false;
            backButton.disabled = false;

            // Clear intervals
            if (updateWebSocketIndicatorIntervalId) {
                clearInterval(updateWebSocketIndicatorIntervalId);
                updateWebSocketIndicatorIntervalId = null;
            }
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
        if (updateWebSocketIndicatorIntervalId) {
            clearInterval(updateWebSocketIndicatorIntervalId);
            updateWebSocketIndicatorIntervalId = null;
        }
        if (checkPendingTransactionsIntervalId) {
            clearInterval(checkPendingTransactionsIntervalId);
            checkPendingTransactionsIntervalId = null;
        }

        // no toast here since injectTx will show it
        submitButton.disabled = false;
        toggleButton.disabled = false;
        usernameInput.disabled = false;
        privateKeyInput.disabled = false;
        backButton.disabled = false;
        return;
    }
}

// This is for the sign in button after selecting an account
async function handleSignIn(event) {
    if(event) {
        event.preventDefault();
    }
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
        const myData = parse(localStorage.getItem(`${username}_${netid}`));
        const privateKey = myData.account.keys.secret;
        const newUsernameInput = document.getElementById('newUsername');
        newUsernameInput.value = username;

        document.getElementById('newPrivateKey').value = privateKey;
        closeSignInModal();
        openCreateAccountModal();
        // Dispatch a change event to trigger the availability check
        newUsernameInput.dispatchEvent(new Event('input'));
        return;
    }

    myData = parse(localStorage.getItem(`${username}_${netid}`));
    if (!myData) { console.log('Account data not found'); return }
    myAccount = myData.account;

    /* requestNotificationPermission(); */

    // Start intervals now that user is signed in
    if (!updateWebSocketIndicatorIntervalId) {
        updateWebSocketIndicatorIntervalId = setInterval(updateWebSocketIndicator, 5000);
    }
    if (!checkPendingTransactionsIntervalId) {
        checkPendingTransactionsIntervalId = setInterval(checkPendingTransactions, 5000);
    }

    // Close modal and proceed to app
    closeSignInModal();
    document.getElementById('welcomeScreen').style.display = 'none';
    await switchView('chats'); // Default view
}

function newDataRecord(myAccount){
    // Process network gateways first
    const networkGateways = (typeof network !== 'undefined' && network?.gateways?.length)
        ? network.gateways.map(gateway => ({
            protocol: gateway.protocol,
            host: gateway.host,
            port: gateway.port,
            name: `${gateway.host} (System)`,
            isSystem: true,
            isDefault: false,
        }))
        : [];

    const myData = {
        timestamp: getCorrectedTimestamp(),
        account: myAccount,
        network: {
            gateways: networkGateways,
            defaultGatewayIndex: -1,  // -1 means use random selection
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
        pending: [],  // Array to track pending transactions
        state: {
            unread: 0
        },
        settings: {
            encrypt: true,
            toll: parameters.current.defaultToll || 1n * wei,
            tollUnit: parameters.current.defaultTollUnit || "LIB",
        }
    }

    return myData
}

// Check if app is running as installed PWA
function checkIsInstalledPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
}

// Load saved account data and update chat list on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkVersion()  // version needs to be checked before anything else happens
    await lockToPortrait()
    timeDifference(); // Calculate and log time difference early

    // Initialize service worker only if running as installed PWA
    isInstalledPWA = checkIsInstalledPWA(); // Set the global variable
    if (isInstalledPWA && 'serviceWorker' in navigator) {
        await registerServiceWorker();
        setupServiceWorkerMessaging();
        setupAppStateManagement();
    } else {
        // Web-only mode
        console.log('Running in web-only mode, skipping service worker initialization');
    }

    setupConnectivityDetection();

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
        signInBtn.classList.remove('hidden');
        createAccountBtn.classList.remove('hidden');
        importAccountBtn.classList.remove('hidden');
        welcomeButtons.appendChild(signInBtn);
        welcomeButtons.appendChild(createAccountBtn);
        welcomeButtons.appendChild(importAccountBtn);
        signInBtn.classList.add('primary-button');
        signInBtn.classList.remove('secondary-button');
    } else {
        welcomeButtons.innerHTML = ''; // Clear existing order
        createAccountBtn.classList.remove('hidden');
        importAccountBtn.classList.remove('hidden');
        welcomeButtons.appendChild(createAccountBtn);
        welcomeButtons.appendChild(importAccountBtn);
        createAccountBtn.classList.add('primary-button');
        createAccountBtn.classList.remove('secondary-button');
    }

    // Add event listeners
    document.getElementById('toggleMenu').addEventListener('click', toggleMenu);
    document.getElementById('closeMenu').addEventListener('click', toggleMenu);

    // About and Contact Modals
    aboutModal.load()
    contactModal.load()

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

    // Event listener for the private key toggle checkbox
    const togglePrivateKeyInput = document.getElementById('togglePrivateKeyInput');
    togglePrivateKeyInput.addEventListener('change', handleTogglePrivateKeyInput);

    // Account Form Modal
    myProfileModal.load()

    document.getElementById('openExplorer').addEventListener('click', () => {
        window.open('./explorer', '_blank');
    });
    document.getElementById('openMonitor').addEventListener('click', () => {
        window.open('./network', '_blank');
    });

    restoreAccountModal.load()

    // Validator Modals
    validatorStakingModal.load()

    // Toll Modal
    tollModal.load()

    // Stake Modal
    stakeValidatorModal.load()

    // Export Form Modal
    backupAccountModal.load()

    // Remove Account Modal
    removeAccountModal.load()

    // Gateway Menu
    gatewayModal.load()

    // Invite Modal
    inviteModal.load()

    // Chat Modal
    chatModal.load()

    // Failed Message Modal
    failedMessageModal.load()

    // New Chat Modal
    newChatModal.load()

    // Send Modal
    sendModal.load()

    // Add event listeners for send confirmation modal
    document.getElementById('closeSendConfirmationModal').addEventListener('click', closeSendConfirmationModal);
    document.getElementById('confirmSendButton').addEventListener('click', handleSendAsset);
    document.getElementById('cancelSendButton').addEventListener('click', closeSendConfirmationModal);

    document.getElementById('openReceiveModal').addEventListener('click', openReceiveModal);
    document.getElementById('closeReceiveModal').addEventListener('click', closeReceiveModal);
    document.getElementById('copyAddress').addEventListener('click', copyAddress);

    document.getElementById('openHistoryModal').addEventListener('click', openHistoryModal);
    document.getElementById('closeHistoryModal').addEventListener('click', closeHistoryModal);
    document.getElementById('historyAsset').addEventListener('change', updateHistoryAddresses);
    document.getElementById('transactionList').addEventListener('click', handleHistoryItemClick);

    // Receive Modal input listeners
    document.getElementById('receiveAsset').addEventListener('change', updateQRCode);
    document.getElementById('receiveAmount').addEventListener('input', debounce(updateQRCode, 300));
    document.getElementById('receiveMemo').addEventListener('input', debounce(updateQRCode, 300));

    document.getElementById('switchToChats').addEventListener('click', () => switchView('chats'));
    document.getElementById('switchToContacts').addEventListener('click', () => switchView('contacts'));
    document.getElementById('switchToWallet').addEventListener('click', () => switchView('wallet'));

    document.getElementById('handleSignOut').addEventListener('click', handleSignOut);
    document.getElementById('closeContactInfoModal').addEventListener('click', () => contactInfoModal.close());

    // add event listener for back-button presses to prevent shift+tab
    document.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('keydown', ignoreShiftTabKey);
    });
    // add event listener for last-item to prevent tab
    document.querySelectorAll('.last-item').forEach(item => {
        item.addEventListener('keydown', ignoreTabKey);
    });
    // add event listener for first-item to prevent shift+tab
    document.querySelectorAll('.logo-link').forEach(item => {
        item.addEventListener('keydown', ignoreShiftTabKey);
    });

    // Add refresh balance button handler
    document.getElementById('refreshBalance').addEventListener('click', async () => {
        // await updateWalletBalances();
        updateWalletView();
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

    // Handle message search input
    document.getElementById('messageSearch').addEventListener('input', (e) => {
        handleMessageSearchInput(e);
    });

    // Handle search input click
    document.getElementById('searchInput').addEventListener('click', (e) => {
        handleSearchInputClick(e);
    });

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


    // Omar added
    document.getElementById('scanQRButton').addEventListener('click', openQRScanModal);
    document.getElementById('scanStakeQRButton').addEventListener('click', openQRScanModal);
    document.getElementById('closeQRScanModal').addEventListener('click', closeQRScanModal);

    // File upload handlers
    document.getElementById('uploadQRButton').addEventListener('click', () => {
        document.getElementById('qrFileInput').click();
    });

    document.getElementById('uploadStakeQRButton').addEventListener('click', () => {
        document.getElementById('stakeQrFileInput').click();
    });

    document.getElementById('qrFileInput').addEventListener('change', (event) => handleQRFileSelect(event, fillPaymentFromQR));
    document.getElementById('stakeQrFileInput').addEventListener('change', (event) => handleQRFileSelect(event, fillStakeAddressFromQR));

    const nameInput = document.getElementById('editContactNameInput');
    const nameActionButton = nameInput.parentElement.querySelector('.field-action-button');

    nameInput.addEventListener('input', handleEditNameInput);
    nameInput.addEventListener('keydown', handleEditNameKeydown);
    nameActionButton.addEventListener('click', handleEditNameButton);

    // Add send money button handler
    document.getElementById('contactInfoSendButton').addEventListener('click', () => {
        const contactUsername = document.getElementById('contactInfoUsername');
        if (contactUsername) {
            sendModal.username = contactUsername.textContent;
        }
        sendModal.open();
    });

    document.getElementById('chatSendMoneyButton').addEventListener('click', (event) => {
        const button = event.currentTarget;
        sendModal.username = button.dataset.username;
        sendModal.open();
    });

    // Add listener for the password visibility toggle
    const togglePasswordButton = document.getElementById('togglePrivateKeyVisibility');
    const passwordInput = document.getElementById('newPrivateKey');

    togglePasswordButton.addEventListener('click', function () {
        // Toggle the type attribute
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle the visual state class on the button
        this.classList.toggle('toggled-visible');
    });

    // add listener for username select change on sign in modal
    document.getElementById('username').addEventListener('change', handleUsernameOnSignInModal);

    // Add event listener for remove account button
    document.getElementById('removeAccountButton').addEventListener('click', handleRemoveAccountButton);

    // create account button listener to clear message input on create account
    document.getElementById('newUsername').addEventListener('input', handleCreateAccountInput);

    // Event Listerns for FailedPaymentModal
    const failedPaymentModal = document.getElementById('failedPaymentModal');
    const failedPaymentRetryButton = failedPaymentModal.querySelector('.retry-button');
    const failedPaymentDeleteButton = failedPaymentModal.querySelector('.delete-button');
    const failedPaymentHeaderCloseButton = document.getElementById('closeFailedPaymentModal');

    failedPaymentRetryButton.addEventListener('click', handleFailedPaymentRetry);
    failedPaymentDeleteButton.addEventListener('click', handleFailedPaymentDelete);
    failedPaymentHeaderCloseButton.addEventListener('click', closeFailedPaymentModalAndClearState);
    failedPaymentModal.addEventListener('click', handleFailedPaymentBackdropClick);

    getNetworkParams();

    const welcomeScreenLastItem = document.getElementById('welcomeScreenLastItem');
    welcomeScreenLastItem.focus();
          
    setupAddToHomeScreen()
});


function handleUnload(e){
    console.log('in handleUnload')
    if (handleSignOut.exit){
        return
    } // User selected to Signout; state was already saved
    else{
        // Clean up WebSocket connection
        if (wsManager) {
            wsManager.disconnect();
            wsManager = null;
        }

        saveState()
    }
}

// Add unload handler to save myData
function handleBeforeUnload(e){
console.log('in handleBeforeUnload', e)
    // Clean up WebSocket connection
    if (wsManager) {
        wsManager.disconnect();
        wsManager = null;
    }

    saveState()
    if (handleSignOut.exit){
        window.removeEventListener('beforeunload', handleBeforeUnload)
        return
    }  // user selected to Signout; state was already saved
console.log('stop back button')
    e.preventDefault();
    history.pushState(null, '', window.location.href);
}

// This is for installed apps where we can't stop the back button; just save the state
async function handleVisibilityChange(e) {
    console.log('in handleVisibilityChange', document.visibilityState);
    if (!myAccount) {
        return;
    }

    if (document.visibilityState === 'hidden') {
        saveState();
        if (handleSignOut.exit) {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            return;
        }
    } else if (document.visibilityState === 'visible') {
        // Reconnect WebSocket if needed
        if (wsManager && !wsManager.isConnected() && myAccount) {
            wsManager.connect();
        }
        setTimeout(async () => {
            await updateChatData();
            await updateChatList();
        }, 1000);
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

async function updateChatData() {
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
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Increasing backoff
                }
            }
        } catch (error) {
            console.error('Error updating chat list:', error);
        }
    }
    return gotChats;
}

// Update chat list UI
async function updateChatList() {
    const chatList = document.getElementById('chatList');
    //const chatsData = myData
    const contacts = myData.contacts
    const chats = myData.chats
    if (chats.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 2rem; margin-bottom: 1rem"></div>
                <div style="font-weight: bold; margin-bottom: 0.5rem">Click the + button to start a chat</div>
                <div>Your conversations will appear here</div>
            </div>`;
        return;
    }

    console.log('updateChatList chats.length', JSON.stringify(chats.length))

    // Clear existing chat items before adding new ones
    chatList.innerHTML = '';

    const chatElements = await Promise.all(chats.map(async chat => {
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
            const amountStr = big2str(latestActivity.amount, 18);
            const amountDisplay = `${amountStr.slice(0, 6)} ${latestActivity.symbol || 'LIB'}`;
            const directionText = latestActivity.my ? '-' : '+';
            // Create payment preview text
            previewHTML = `<span class="payment-preview">${directionText} ${amountDisplay}</span>`;
                // Optionally add memo preview
                if (latestActivity.message) { // Memo is stored in the 'message' field for transfers
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
        const contactName = contact.name || contact.senderInfo?.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`;

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
                    ${previewHTML}
                    ${contact.unread ? `<span class="chat-unread">${contact.unread}</span>` : ''}
                </div>
            </div>
        `;

        // Add the onclick handler directly to the element
        li.onclick = () => chatModal.open(chat.address);

        return li; // Return the created DOM element
    }));

    // Append the created (and non-null) list item elements to the chatList
    chatElements.forEach(element => {
        if (element) { // Only append if the element is not null
            chatList.appendChild(element);
        }
    });
}
// refresh wallet balance
async function updateWalletBalances() {
    if (!myAccount || !myData || !myData.wallet || !myData.wallet.assets) {
        console.error('No wallet data available');
        return;
    } else if (!isOnline) {
        console.error('Not online. Not updating wallet balances');
        return;
    }
    await updateAssetPricesIfNeeded()
    const now = getCorrectedTimestamp()
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
                addr.balance = data.balance || 0n;

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
    // Store the current view for potential rollback
    const previousView = document.querySelector('.app-screen.active')?.id?.replace('Screen', '') || 'chats';
    const previousButton = document.querySelector('.nav-button.active');

    // Initialize WebSocket connection regardless of view
    wsManager.initializeWebSocketManager();

    try {
        // Direct references to view elements
        const chatScreen = document.getElementById('chatsScreen');
        const contactsScreen = document.getElementById('contactsScreen');
        const walletScreen = document.getElementById('walletScreen');

        // Direct references to button elements
        const chatButton = document.getElementById('switchToChats');
        const contactsButton = document.getElementById('switchToContacts');
        const walletButton = document.getElementById('switchToWallet');

        // Hide all screens
        chatScreen.classList.remove('active');
        contactsScreen.classList.remove('active');
        walletScreen.classList.remove('active');

        // Show selected screen
        document.getElementById(`${view}Screen`).classList.add('active');

        // Update nav buttons - remove active class from all
        chatButton.classList.remove('active');
        contactsButton.classList.remove('active');
        walletButton.classList.remove('active');

        // Add active class to selected button
        if (view === 'chats') {
            chatButton.classList.add('active');
        } else if (view === 'contacts') {
            contactsButton.classList.add('active');
        } else if (view === 'wallet') {
            walletButton.classList.add('active');
        }

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
        if (view === 'chats' || view === 'contacts') {
            newChatButton.classList.add('visible');
        } else {
            newChatButton.classList.remove('visible');
        }

        // Update lists when switching views
        if (view === 'chats') {
            chatButton.classList.remove('has-notification');
            // TODO: maybe need to invoke updateChatData here?
            await updateChatList();
            if (isOnline) {
                if (wsManager && !wsManager.isSubscribed()) {
                    pollChatInterval(pollIntervalNormal);
                }
            }

            // focus onto last-item in the footer
            const footer = document.getElementById('footer');
            const lastItem = footer.querySelector('.last-item');
            if (lastItem) {
                lastItem.focus();
            }
        } else if (view === 'contacts') {
            await updateContactsList();
        } else if (view === 'wallet') {
            walletButton.classList.remove('has-notification');
            await updateWalletView();
        }
    } catch (error) {
        console.error(`Error switching to ${view} view:`, error);

        // Restore previous view if there was an error
        if (previousView && previousButton) {
            console.log(`Restoring previous view: ${previousView}`);

            // Get references to screens and buttons
            const chatScreen = document.getElementById('chatsScreen');
            const contactsScreen = document.getElementById('contactsScreen');
            const walletScreen = document.getElementById('walletScreen');

            const chatButton = document.getElementById('switchToChats');
            const contactsButton = document.getElementById('switchToContacts');
            const walletButton = document.getElementById('switchToWallet');

            // Hide all screens with direct references
            chatScreen.classList.remove('active');
            contactsScreen.classList.remove('active');
            walletScreen.classList.remove('active');

            // Show previous screen
            const previousScreenElement = document.getElementById(`${previousView}Screen`);
            if (previousScreenElement) {
                previousScreenElement.classList.add('active');
            }

            // Remove active class from all buttons with direct references
            chatButton.classList.remove('active');
            contactsButton.classList.remove('active');
            walletButton.classList.remove('active');

            // Add active to the correct button based on previousView
            if (previousView === 'chats') {
                chatButton.classList.add('active');
            } else if (previousView === 'contacts') {
                contactsButton.classList.add('active');
            } else if (previousView === 'wallet') {
                walletButton.classList.add('active');
            } else {
                // Fallback if previousButton is available
                previousButton.classList.add('active');
            }

            // Display error toast to user
            showToast(`Failed to switch to ${view} view`, 3000, "error");
        }
    }
}

// Update contacts list UI
async function updateContactsList() {
    const contactsList = document.getElementById('contactsList');
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

    // Split into status groups in a single pass
    const statusGroups = contactsArray.reduce((acc, contact) => {
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
    }, { others: [], acquaintances: [], friends: [], blocked: []});

    // Sort each group by name first, then by username if name is not available
    const sortByName = (a, b) => {
        const nameA = a.name || a.username || '';
        const nameB = b.name || b.username || '';
        return nameA.localeCompare(nameB);
    };
    Object.values(statusGroups).forEach(group => group.sort(sortByName));

    // Group metadata for rendering
    const groupMeta = [
        { key: 'friends', label: 'Friends', itemClass: 'chat-item' },
        { key: 'acquaintances', label: 'Acquaintances', itemClass: 'chat-item' },
        { key: 'others', label: 'Others', itemClass: 'chat-item' },
        { key: 'blocked', label: 'Blocked', itemClass: 'chat-item blocked' }
    ];

    // Helper to render a contact item
    const renderContactItem = async (contact, itemClass) => {
        const identicon = await generateIdenticon(contact.address);
        return `
            <li class="${itemClass}">
                <div class="chat-avatar">${identicon}</div>
                <div class="chat-content">
                    <div class="chat-header">
                        <div class="chat-name">${contact.name || contact.senderInfo?.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`}</div>
                    </div>
                    <div class="contact-list-info">
                        ${contact.email || contact.x || contact.phone || `${contact.address.slice(0,8)}…${contact.address.slice(-6)}`}
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
            const items = await Promise.all(group.map(contact => renderContactItem(contact, itemClass)));
            html += items.join('');
            allContacts = allContacts.concat(group);
        }
    }

    contactsList.innerHTML = html;

    // Add click handlers to contact items
    document.querySelectorAll('#contactsList .chat-item').forEach((item, index) => {
        const contact = allContacts[index];
        item.onclick = () => {
            contactInfoModal.open(createDisplayInfo(contact));
        };
    });
}

function toggleMenu() {
    document.getElementById('menuModal').classList.toggle('active');
//    document.getElementById('accountModal').classList.remove('active');
}

// create new contact
function createNewContact(addr, username){
    const address = normalizeAddress(addr)
    if (myData.contacts[address]){ return }  // already exists
    const c = myData.contacts[address] = {}
    c.address = address
    if (username){ c.username = normalizeUsername(username) }
    c.messages = []
    c.timestamp = 0
    c.unread = 0
    c.toll = 0n
    c.tollRequiredToReceive = 1
    c.tollRequiredToSend = 1
    c.friend = 1
}

/**
 * updateTollAmountUI 
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
        toll = bigxnum2big(toll, (1.0/factor).toString())
        mainString = mainValue.toFixed(4) + ' USD';
        const libValue = mainValue / factor;
        otherString = libValue.toFixed(6) + ' LIB';
    } else {
        mainString = mainValue.toFixed(6) + ' LIB';
        const usdValue = mainValue * factor;
        otherString = usdValue.toFixed(4) + ' USD';
    }
    let display;
    if (contact.tollRequiredToSend == 1) {
        display = `${mainString} (${otherString})`;
    } else if (contact.tollRequiredToSend == 2) {
        tollValue.style.color = 'red';
        display = `blocked`;
    } else {
        // light green used to show success
        tollValue.style.color = '#28a745';
        display = `free (${mainString} (${otherString}))`;
    }
    tollValue.textContent = display;

    chatModal.toll = toll
    chatModal.tollUnit = tollUnit
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

        if (contactAccountData?.error === "No account with the given chatId") {
            console.warn(`chatId has not been created yet: ${address}`, contactAccountData.error);
        } else if (contactAccountData?.error) {
            console.error(`Error querying toll required for address: ${address}`, contactAccountData.error);
            return;
        }

        const localContact = myData.contacts[address]
        localContact.tollRequiredToSend = contactAccountData.toll.required[toIndex]
        localContact.tollRequiredToReceive = contactAccountData.toll.required[myIndex]

        if (chatModal.modal.classList.contains('active') && chatModal.address === address) {
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


    // update the toll value in the UI if the queried toll value is different from the toll field in localStorage
    if (myData.contacts[address].toll != queriedToll && myData.contacts[address].tollUnit != queriedTollUnit) {
        myData.contacts[address].toll = queriedToll;
        myData.contacts[address].tollUnit = queriedTollUnit;
        // if correct modal is open for this address, update the toll value
        if (chatModal.modal.classList.contains('active') && chatModal.address === address) {
            updateTollAmountUI(address);
        }
    } else {
        console.log(`Returning early since queried toll value is the same as the toll field in localStorage`);
        // return early
        return;
    }
}

function openReceiveModal() {
    const modal = document.getElementById('receiveModal');
    modal.classList.add('active');

    // Get wallet data
    const walletData = myData.wallet;

    // Get references to elements
    const assetSelect = document.getElementById('receiveAsset');
    const amountInput = document.getElementById('receiveAmount');
    const memoInput = document.getElementById('receiveMemo');

    // Populate assets dropdown
    // Clear existing options
    assetSelect.innerHTML = '';

    // Check if wallet assets exist
    if (walletData && walletData.assets && walletData.assets.length > 0) {
        // Add options for each asset
        walletData.assets.forEach((asset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${asset.name} (${asset.symbol})`;
            assetSelect.appendChild(option);
        });
        console.log(`Populated ${walletData.assets.length} assets in dropdown`);
    } else {
        // Add a default option if no assets
        const option = document.createElement('option');
        option.value = 0;
        option.textContent = 'Liberdus (LIB)';
        assetSelect.appendChild(option);
        console.log('No wallet assets found, using default');
    }

    // Clear input fields
    amountInput.value = '';
    memoInput.value = '';

    // Initial update for addresses based on the first asset
    updateReceiveAddresses();
}

function closeReceiveModal() {
    const modal = document.getElementById('receiveModal');
    // Hide the modal
    modal.classList.remove('active');
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

    // Generate QR code with payment data
    try {
        updateQRCode();
        console.log("QR code updated with payment data");
    } catch (error) {
        console.error("Error updating QR code:", error);

        // Fallback to basic address QR code if there's an error
        new QRCode(qrcodeContainer, {
            text: '0x' + address,
            width: 200,
            height: 200
        });
        console.log("Fallback to basic address QR code");
    }
}

// Create QR payment data object based on form values
function createQRPaymentData() {
    // Get selected asset
    const assetSelect = document.getElementById('receiveAsset');
    const assetIndex = parseInt(assetSelect.value, 10) || 0;

    // Default asset info in case we can't find the selected asset
    let assetId = "liberdus";
    let symbol = "LIB";

    // Try to get the selected asset
    try {
        if (myData && myData.wallet && myData.wallet.assets && myData.wallet.assets.length > 0) {
            const asset = myData.wallet.assets[assetIndex];
            if (asset) {
                assetId = asset.id || "liberdus";
                symbol = asset.symbol || "LIB";
                console.log(`Selected asset: ${asset.name} (${symbol})`);
            } else {
                console.log(`Asset not found at index ${assetIndex}, using defaults`);
            }
        } else {
            console.warn("Wallet assets not available, using default asset");
        }
    } catch (error) {
        console.error("Error accessing asset data:", error);
    }

    // Build payment data object
    const paymentData = {
        u: myAccount.username, // username
        i: assetId, // assetId
        s: symbol // symbol
    };

    // Add optional fields if they have values
    const amount = document.getElementById('receiveAmount').value.trim();
    if (amount) {
        paymentData.a = amount;
    }

    const memo = document.getElementById('receiveMemo').value.trim();
    if (memo) {
        paymentData.m = memo;
    }

    return paymentData;
}

// Update QR code with current payment data
function updateQRCode() {
    const qrcodeContainer = document.getElementById('qrcode');
    const previewElement = document.getElementById('qrDataPreview'); // Get preview element
    qrcodeContainer.innerHTML = '';
    previewElement.style.display = 'none'; // Hide preview/error area initially
    previewElement.innerHTML = ''; // Clear any previous error message

    try {
        // Get payment data
        const paymentData = createQRPaymentData();
        console.log("Created payment data:", JSON.stringify(paymentData, null, 2));

        // Convert to JSON and encode as base64
        const jsonData = JSON.stringify(paymentData);
        const base64Data = btoa(jsonData);

        // Create URI with liberdus:// prefix
        const qrText = `liberdus://${base64Data}`;
        console.log("QR code text length:", qrText.length);
        console.log("QR code text (first 100 chars):", qrText.substring(0, 100) + (qrText.length > 100 ? "..." : ""));


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
        qrcodeContainer.appendChild(img);


        return qrText;
    } catch (error) {
        console.error("Error in updateQRCode:", error);

        qrcodeContainer.innerHTML = ''; // Clear the container before adding fallback QR

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
            qrcodeContainer.appendChild(img);


            console.log("Fallback QR code generated with username URI");
            console.error("Error generating full QR", error);

            // Show error directly in the preview element
            if (previewElement) {
                previewElement.innerHTML = `<span style="color: red;">Error generating full QR</span><br> Generating QR with only username. <br> Username: ${myAccount.username}`;
                previewElement.style.display = 'block'; // Make the error visible
            }

            return fallbackQrText; // Return the generated fallback URI
        } catch (fallbackError) {
            // If even the fallback fails (e.g., username missing), show a simple error
            console.error("Error generating fallback QR code:", fallbackError);
            qrcodeContainer.innerHTML = '<p style="color: red; text-align: center;">Failed to generate QR code.</p>';
            if (previewElement) {
                previewElement.innerHTML = '<p style="color: red;">Error generating QR code.</p>';
                previewElement.style.display = 'block'; // Make the error visible
            }
            return null; // Indicate complete failure
        }
    }
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

// Function to handle QR code scanning Omar
function openQRScanModal() {
    const modal = document.getElementById('qrScanModal');
    modal.classList.add('active');
    startCamera(openQRScanModal.fill)
}
openQRScanModal.fill = null

function closeQRScanModal(){
    document.getElementById('qrScanModal').classList.remove('active');
    stopCamera()
}

function fillPaymentFromQR(data) {
    console.log('Attempting to fill payment form from QR:', data);

    // Explicitly check for the required prefix
    if (!data || !data.startsWith('liberdus://')) {
        console.error("Invalid payment QR code format. Missing 'liberdus://' prefix.", data);
        showToast("Invalid payment QR code format.", 3000, "error");
        // Optionally clear fields or leave them as they were
        document.getElementById('sendToAddress').value = '';
        document.getElementById('sendAmount').value = '';
        document.getElementById('sendMemo').value = '';
        return; // Stop processing if the format is wrong
    }

    // Clear existing fields first
    document.getElementById('sendToAddress').value = '';
    document.getElementById('sendAmount').value = '';
    document.getElementById('sendMemo').value = '';

    try {
        // Remove the prefix and process the base64 data
        const base64Data = data.substring('liberdus://'.length);
        const jsonData = atob(base64Data);
        const paymentData = JSON.parse(jsonData);

        console.log("Read payment data:", JSON.stringify(paymentData, null, 2));

        if (paymentData.u) {
            document.getElementById('sendToAddress').value = paymentData.u;
        }
        if (paymentData.a) {
            document.getElementById('sendAmount').value = paymentData.a;
        }
        if (paymentData.m) {
            document.getElementById('sendMemo').value = paymentData.m;
        }

        // Trigger username validation and amount validation
        document.getElementById('sendToAddress').dispatchEvent(new Event('input'));
        document.getElementById('sendAmount').dispatchEvent(new Event('input'));

    } catch (error) {
        console.error("Error parsing payment QR data:", error, data);
        showToast("Failed to parse payment QR data.", 3000, "error");
        // Clear fields on error
        document.getElementById('sendToAddress').value = '';
        document.getElementById('sendAmount').value = '';
        document.getElementById('sendMemo').value = '';
    }
}

function fillStakeAddressFromQR(data) {
    console.log('Filling stake address from QR data:', data);

    // Directly set the value of the stakeNodeAddress input field
    const stakeNodeAddressInput = document.getElementById('stakeNodeAddress');
    if (stakeNodeAddressInput) {
        stakeNodeAddressInput.value = data;
        stakeNodeAddressInput.dispatchEvent(new Event('input'));
    } else {
        console.error('Stake node address input field not found!');
        showToast("Could not find stake address field.", 3000, "error");
    }
}

/**
 * Validate the balance of the user
 * @param {BigInt} amount - The amount to validate
 * @param {number} assetIndex - The index of the asset to validate
 * @param {HTMLElement} balanceWarning - The element to display the balance warning
 * @returns {Promise<boolean>} - A promise that resolves to true if the balance is sufficient, false otherwise
 */
async function validateBalance(amount, assetIndex = 0, balanceWarning = null) {
    if (!amount) {
        if (balanceWarning) balanceWarning.style.display = 'none';
        console.warn('[validateBalance] amount is 0')
        return false;
    } else if (amount < 0) {
        console.warn('[validateBalance] amount is negative')
        if (balanceWarning) balanceWarning.style.display = 'inline';
        balanceWarning.textContent = 'Amount cannot be negative';
        return false;
    } 


    await getNetworkParams();
    const asset = myData.wallet.assets[assetIndex];
    const feeInWei = (parameters.current.transactionFee || 1n * wei);
    const totalRequired = bigxnum2big(1n, amount.toString()) + feeInWei;
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

// The user has filled out the form to send assets to a recipient and clicked the Send button
// The recipient account may not exist in myData.contacts and might have to be created
/**
 * Handle the send asset event
 * @param {Event} event - The event object
 * @returns {Promise<void>}- A promise that resolves when the send asset event is handled
 */
async function handleSendAsset(event) {
    event.preventDefault();
    const confirmButton = document.getElementById('confirmSendButton');
    const cancelButton = document.getElementById('cancelSendButton');
    const username = normalizeUsername(document.getElementById('sendToAddress').value);

    // if it's your own username disable the send button
    if (username == myAccount.username) {
        confirmButton.disabled = true;
        showToast('You cannot send assets to yourself', 3000, 'error');
        return;
    }

    if ((getCorrectedTimestamp() - handleSendAsset.timestamp) < 2000 || confirmButton.disabled) {
        return;
    }

    confirmButton.disabled = true;
    cancelButton.disabled = true;

    handleSendAsset.timestamp = getCorrectedTimestamp()
    const wallet = myData.wallet;
    const assetIndex = document.getElementById('sendAsset').value;  // TODO include the asset id and symbol in the tx
    const amount = bigxnum2big(wei, document.getElementById('sendAmount').value);
    const memoIn = document.getElementById('sendMemo').value || '';
    const memo = memoIn.trim()
    const keys = myAccount.keys;
    let toAddress;

    // Validate amount including transaction fee
    if (!await validateBalance(amount, assetIndex)) {
        await getNetworkParams();
        const txFeeInLIB = (parameters.current.transactionFee || 1n * wei);
        const balance = BigInt(wallet.assets[assetIndex].balance);
        const amountStr = big2str(amount, 18).slice(0, -16);
        const feeStr = big2str(txFeeInLIB, 18).slice(0, -16);
        const balanceStr = big2str(balance, 18).slice(0, -16);
        alert(`Insufficient balance: ${amountStr} + ${feeStr} (fee) > ${balanceStr} LIB`);
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
        const usernameHash = hashBytes(usernameBytes);
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

    if (!myData.contacts[toAddress]) { createNewContact(toAddress, username) }

    // Get recipient's public key from contacts
    let recipientPubKey = myData.contacts[toAddress]?.public;
    let pqRecPubKey = myData.contacts[toAddress]?.pqPublic
    let pqEncSharedKey = ''
    if (!recipientPubKey || !pqRecPubKey) {
        const recipientInfo = await queryNetwork(`/account/${longAddress(toAddress)}`)
        if (!recipientInfo?.account?.publicKey){
            console.log(`no public key found for recipient ${toAddress}`)
            return
        }
        if (recipientInfo.account.publicKey) {  
            recipientPubKey = recipientInfo.account.publicKey
            myData.contacts[toAddress].public = recipientPubKey
        }
        if (recipientInfo.account.pqPublicKey) {
            pqRecPubKey = recipientInfo.account.pqPublicKey
            myData.contacts[toAddress].pqPublic = pqRecPubKey
        }
    }
    let dhkey = ''
    let sharedKeyMethod = 'none'
    if (recipientPubKey){
        dhkey = ecSharedKey(keys.secret, recipientPubKey)
        sharedKeyMethod = 'ec'
        if (pqRecPubKey) {
            // Generate shared secret using ECDH and take first 32 bytes
            const  { cipherText, sharedSecret } = pqSharedKey(pqRecPubKey)
            const combined = new Uint8Array(dhkey.length + sharedSecret.length)
            combined.set(dhkey)
            combined.set(sharedSecret, dhkey.length)
            dhkey = deriveDhKey(combined);
            pqEncSharedKey = bin2base64(cipherText)
            sharedKeyMethod = 'pq'
        }
    }

    let encMemo = ''
    if (memo && sharedKeyMethod !== 'none') {
    // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
    // Encrypt message using shared secret
        encMemo = encryptChacha(dhkey, memo)
    }

    // hidden input field retryOfTxId value is not an empty string
    if (document.getElementById('retryOfPaymentTxId').value) {
        // remove from myData use txid from hidden field retryOfPaymentTxId
        removeFailedTx(document.getElementById('retryOfPaymentTxId').value, toAddress)

        // clear the field
        handleFailedPaymentClick.txid = '';
        handleFailedPaymentClick.address = '';
        handleFailedPaymentClick.memo = '';
        document.getElementById('retryOfPaymentTxId').value = '';
    }

    // only include the sender info if the recipient is is a friend and has a pqKey
    let encSenderInfo = ''
    let senderInfo = ''
    if (pqRecPubKey && myData.contacts[toAddress]?.friend === 3) {
        // Create sender info object
        senderInfo = {
            username: myAccount.username,
            name: myData.account.name,
            email: myData.account.email,
            phone: myData.account.phone,
            linkedin: myData.account.linkedin,
            x: myData.account.x
        };
    }
    else if (recipientPubKey) {
        senderInfo = {
            username: myAccount.username
        }
    }
    else {
        senderInfo = { username: myAccount.address }
    }
    if (sharedKeyMethod !== 'none') {
        encSenderInfo = encryptChacha(dhkey, stringify(senderInfo));
    }
    else {
        encSenderInfo = stringify(senderInfo);
    }
    // Create message payload
    const payload = {
        message: encMemo,  // we need to call this field message, so we can use decryptMessage()
        senderInfo: encSenderInfo,
        encrypted: true,
        encryptionMethod: 'xchacha20poly1305',
        pqEncSharedKey: pqEncSharedKey,
        sharedKeyMethod: sharedKeyMethod,
        sent_timestamp: getCorrectedTimestamp()
    };

    try {
        console.log('payload is', payload)
        // Send the transaction using postAssetTransfer
        const response = await postAssetTransfer(toAddress, amount, payload, keys);

        /* if (!response || !response.result || !response.result.success) {
            alert('Transaction failed: ' + response.result.reason);
            return;
        } */

        // Create contact if it doesn't exit
        if (!myData.contacts[toAddress].messages) {
            createNewContact(toAddress)
            // TODO can pass the username to createNewConact and get rid of the following line
            myData.contacts[toAddress].username = normalizeUsername(recipientInput)
        }

        // Add transaction to history
        const currentTime = getCorrectedTimestamp();

        const newPayment = {
            txid: response.txid,
            amount: amount,
            sign: -1,
            timestamp: currentTime,
            address: toAddress,
            memo: memo,
            status: 'sent'
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
            status: 'sent'
        };
        // Insert the transfer message into the contact's message list, maintaining sort order
        insertSorted(myData.contacts[toAddress].messages, transferMessage, 'timestamp');
        // --------------------------------------------------------------

        // --- Update myData.chats to reflect the new message ---
        const existingChatIndex = myData.chats.findIndex(chat => chat.address === toAddress);
        if (existingChatIndex !== -1) {
            myData.chats.splice(existingChatIndex, 1); // Remove existing entry
        }
        // Create the new chat entry
        const chatUpdate = {
            address: toAddress,
            timestamp: currentTime,
            txid: response.txid
        };
        // Find insertion point to maintain timestamp order (newest first)
        insertSorted(myData.chats, chatUpdate, 'timestamp');
        // --- End Update myData.chats ---

        // Update the chat modal to show the newly sent transfer message
        // Check if the chat modal for this recipient is currently active
        const inActiveChatWithRecipient = chatModal.address === toAddress && chatModal.modal.classList.contains('active');

        if (inActiveChatWithRecipient) {
            chatModal.appendChatModal(); // Re-render the chat modal and highlight the new item
        }

        sendModal.close();
        closeSendConfirmationModal();
        document.getElementById('sendToAddress').value = '';
        document.getElementById('sendAmount').value = '';
        document.getElementById('sendMemo').value = '';
        document.getElementById('sendToAddressError').style.display = 'none'
        // Show history modal after successful transaction
        openHistoryModal();
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
handleSendAsset.timestamp = getCorrectedTimestamp()

// Contact Info Modal Management
class ContactInfoModalManager {
    constructor() {
        this.modal = document.getElementById('contactInfoModal');
        this.currentContactAddress = null;
        this.needsContactListUpdate = false;  // track if we need to update the contact list
        this.setupEventListeners();
    }

    // Initialize event listeners that only need to be set up once
    setupEventListeners() {
        // Back button
        this.modal.querySelector('.back-button').addEventListener('click', () => {
            this.close();
        });

        document.getElementById('nameEditButton').addEventListener('click', openEditContactModal);

        // Add close button handler for edit contact modal
        document.getElementById('closeEditContactModal').addEventListener('click', () => {
            document.getElementById('editContactModal').classList.remove('active');
        });

        // Add chat button handler for contact info modal
        document.getElementById('contactInfoChatButton').addEventListener('click', () => {
            const addressToOpen = this.currentContactAddress;
            if (addressToOpen) { // Ensure we have an address before proceeding
                this.close();
                chatModal.open(addressToOpen);
            }
        });
    }

    // Update contact info values
    async updateContactInfo(displayInfo) {
        // Update avatar section
        const avatarSection = this.modal.querySelector('.contact-avatar-section');
        const avatarDiv = avatarSection.querySelector('.avatar');
        const nameDiv = avatarSection.querySelector('.name');
        const subtitleDiv = avatarSection.querySelector('.subtitle');

        // Generate identicon for the contact
        const identicon = await generateIdenticon(displayInfo.address, 96);

        // Update the avatar section
        avatarDiv.innerHTML = identicon;
        nameDiv.textContent = displayInfo.name !== 'Not provided' ? displayInfo.name : displayInfo.username;
        subtitleDiv.textContent = displayInfo.address;

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
            chatButton.style.display = 'block';
        } else {
            chatButton.style.display = 'none';
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
            updateContactsList();
            this.needsContactListUpdate = false;
        }
    }
}

class FriendModal {
    constructor() {
        this.modal = document.getElementById('friendModal');
        this.friendForm = document.getElementById('friendForm');
        this.currentContactAddress = null;
        this.needsContactListUpdate = false;  // track if we need to update the contact list
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add friend button
        document.getElementById('addFriendButtonContactInfo').addEventListener('click', () => {
            if (!this.currentContactAddress) return;
            this.openFriendModal();
        });

        document.getElementById('addFriendButtonChat').addEventListener('click', () => {
            if (!this.currentContactAddress) return;
            this.openFriendModal();
        });

        // Friend modal form submission
        this.friendForm.addEventListener('submit', (event) => this.handleFriendSubmit(event));

        // Friend modal close button
        this.modal.querySelector('.back-button').addEventListener('click', () => this.closeFriendModal());
    }

    // Open the friend modal
    openFriendModal() {
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
        const fromAddr = longAddress(myAccount.keys.address)
        const toAddr = longAddress(address)
        const chatId_ = hashBytes([fromAddr, toAddr].sort().join``)
        console.log('DEBUG 1:chatId_', chatId_)
        
        const tx = {
            from: fromAddr,
            to: toAddr,
            chatId: chatId_,
            required: requiredNum,
            type: 'update_toll_required',
            timestamp: getCorrectedTimestamp(),
            friend: friend
        }
        const txid = await signObj(tx, myAccount.keys)
        const res = await injectTx(tx, txid)
        return res
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
        const res = await this.postUpdateTollRequired(this.currentContactAddress, Number(selectedStatus))
        if (res?.transaction?.success === false) {
            console.log(`[handleFriendSubmit] update_toll_required transaction failed: ${res?.transaction?.reason}. Did not update contact status.`);
            return;
        }

        // Update friend status based on selected value
        contact.friend = Number(selectedStatus);

        // Show appropriate toast message depending value 0,1,2,3
        showToast(
            contact.friend === 0 ? 'Blocked' :
            contact.friend === 1 ? 'Added as Other' :
            contact.friend === 2 ? 'Added as Acquaintance' :
            contact.friend === 3 ? 'Added as Friend' :
            'Error updating friend status'
        );

        // Mark that we need to update the contact list
        this.needsContactListUpdate = true;

        // Save state
        saveState();

        // Update the friend button
        this.updateFriendButton(contact, 'addFriendButtonContactInfo');
        this.updateFriendButton(contact, 'addFriendButtonChat');

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
}

const friendModal = new FriendModal();

async function openEditContactModal() {
    const editContactModal = document.getElementById('editContactModal');

    // Get the avatar section elements
    const avatarSection = document.querySelector('#editContactModal .contact-avatar-section');
    const avatarDiv = avatarSection.querySelector('.avatar');
    const nameDiv = avatarSection.querySelector('.name');
    const subtitleDiv = avatarSection.querySelector('.subtitle');
    const identicon = document.getElementById('contactInfoAvatar').innerHTML;

    // Update the avatar section
    avatarDiv.innerHTML = identicon;
    nameDiv.textContent = document.getElementById('contactInfoName').textContent;
    subtitleDiv.textContent = document.getElementById('contactInfoUsername').textContent;

    // Get the original name from the contact info display
    const contactNameDisplay = document.getElementById('contactInfoName');
    let originalName = contactNameDisplay.textContent;
    if (originalName === 'Not provided') {
        originalName = '';
    }

    // Store the original name
    openEditContactModal.originalName = originalName;

    // Set up the input field with the original name
    const nameInput = document.getElementById('editContactNameInput');
    nameInput.value = originalName;

    // field-action-button should be clear
    nameInput.parentElement.querySelector('.field-action-button').className = 'field-action-button clear';

    // Show the edit contact modal
    editContactModal.classList.add('active');

    // Get the current contact info from the contact info modal
    const currentContactAddress = contactInfoModal.currentContactAddress;
    if (!currentContactAddress || !myData.contacts[currentContactAddress]) {
        console.error('No current contact found');
        return;
    }

    // Create display info object using the same format as contactInfoModal
    const displayInfo = createDisplayInfo(myData.contacts[currentContactAddress]);

    // Create a handler function to focus the input after the modal transition
    const editContactFocusHandler = () => {
        nameInput.focus();
        editContactModal.removeEventListener('transitionend', editContactFocusHandler);
    };

    // Add the event listener
    editContactModal.addEventListener('transitionend', editContactFocusHandler);
}

openEditContactModal.originalName = ''

// Creates a handler for input changes
function handleEditNameInput() {
    const nameInput = document.getElementById('editContactNameInput');
    const nameActionButton = nameInput.parentElement.querySelector('.field-action-button');
    const originalNameValue = openEditContactModal.originalName;

    const currentValue = nameInput.value.trim();
    const valueChanged = currentValue !== originalNameValue;

    if (valueChanged) {
        nameActionButton.className = 'field-action-button add';
        nameActionButton.setAttribute('aria-label', 'Save');
    } else {
        nameActionButton.className = 'field-action-button clear';
        nameActionButton.setAttribute('aria-label', 'Clear');
    }
}

// Creates a handler for action button clicks
function handleEditNameButton() {
    const nameInput = document.getElementById('editContactNameInput');
    const nameActionButton = nameInput.parentElement.querySelector('.field-action-button');

    if (nameActionButton.classList.contains('clear')) {
        nameInput.value = '';
        // Always show save button after clearing
        nameActionButton.className = 'field-action-button add';
        nameActionButton.setAttribute('aria-label', 'Save');
        nameInput.focus();
    } else {
        handleSaveEditContact();
    }
}

// Creates a handler for keydown events
function handleEditNameKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEditContact();
    }
}

// Handles saving contact changes
function handleSaveEditContact() {
    const nameInput = document.getElementById('editContactNameInput');
    const currentContactAddress = contactInfoModal.currentContactAddress;

    // Save changes - if input is empty/spaces, it will become undefined
    const newName = nameInput.value.trim() || null;
    const contact = myData.contacts[currentContactAddress];
    if (contact) {
        contact.name = newName;
        contactInfoModal.needsContactListUpdate = true;
    }

    // Safely close the edit modal
    const editModal = document.getElementById('editContactModal');
    if (editModal) {
        editModal.classList.remove('active');
    }

    // Safely update the contact info modal if it exists and is open
    if (contactInfoModal.currentContactAddress) {
        const contactInfoModalElement = document.getElementById('contactInfoModal');
        if (contactInfoModalElement && contactInfoModalElement.classList.contains('active')) {
            contactInfoModal.updateContactInfo(createDisplayInfo(myData.contacts[currentContactAddress]));
        }
    }
}

// Create a singleton instance
const contactInfoModal = new ContactInfoModalManager();

function handleSignOut() {
    // Clear intervals
    if (updateWebSocketIndicatorIntervalId) {
        clearInterval(updateWebSocketIndicatorIntervalId);
        updateWebSocketIndicatorIntervalId = null;
    }
    if (checkPendingTransactionsIntervalId) {
        clearInterval(checkPendingTransactionsIntervalId);
        checkPendingTransactionsIntervalId = null;
    }
    // Stop camera if it's running
    if (typeof startCamera !== 'undefined' && startCamera.scanInterval) {
        stopCamera();
    }

    //    const shouldLeave = confirm('Do you want to leave this page?');
//    if (shouldLeave == false) { return }

    // Clean up WebSocket connection
    if (wsManager) {
        wsManager.disconnect();
        wsManager = null;
    }

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

    // Add offline fallback
    if (!navigator.onLine) {
        // Just reset the UI state without clearing storage
        document.getElementById('welcomeScreen').classList.add('active');
        return;
    }

    // Only reload if online
    window.location.reload();
}
handleSignOut.exit = false

function handleFailedPaymentClick(txid, element) {
    console.log('handleFailedPaymentClick', txid)
    const modal = document.getElementById('failedPaymentModal');

    // Get the address and memo from the original failed transfer element
    const address = element?.dataset?.address || chatModal.address;
    const memo = element?.querySelector('.transaction-memo')?.textContent || element?.querySelector('.payment-memo')?.textContent;
    //const assetID = element?.dataset?.assetID || ''; // TODO: need to add assetID to `myData.wallet.history` for when we have multiple assets

    // Store the address and memo in properties of handleFailedPaymentClick
    handleFailedPaymentClick.address = address;
    handleFailedPaymentClick.memo = memo;
    handleFailedPaymentClick.txid = txid;
    //handleFailedPaymentClick.assetID = assetID;

    console.log(`handleFailedPaymentClick.address: ${handleFailedPaymentClick.address}`)
    console.log(`handleFailedPaymentClick.memo: ${handleFailedPaymentClick.memo}`)
    console.log(`handleFailedPaymentClick.txid: ${handleFailedPaymentClick.txid}`)
    //console.log(`handleFailedPaymentClick.assetID: ${handleFailedPaymentClick.assetID}`)
    if (modal) {
        modal.classList.add('active');
    }
}
handleFailedPaymentClick.txid = '';
handleFailedPaymentClick.address = '';
handleFailedPaymentClick.memo = '';
//handleFailedPaymentClick.assetID = '';

/**
 * Invoked when the user clicks the retry button in the failed payment modal
 * It will fill the sendModal with the payment content and txid of the failed payment in a hidden input field in the sendModal
 */
function handleFailedPaymentRetry() {
    const retryOfPaymentTxId = sendModal.retryTxIdInput;

    // close the failed payment modal
    const failedPaymentModal = document.getElementById('failedPaymentModal');
    if (failedPaymentModal) {
        failedPaymentModal.classList.remove('active');
    }

    if (sendModal.modal && retryOfPaymentTxId) {
        sendModal.open();

        // 1. fill in hidden retryOfPaymentTxId input
        retryOfPaymentTxId.value = handleFailedPaymentClick.txid;

        // 2. fill in the memo input
        sendModal.querySelector('#sendMemo').value = handleFailedPaymentClick.memo;

        // 3. fill in the to address input
        // find username in myData.contacts[handleFailedPaymentClick.address].senderInfo.username
        // enter as an input to invoke the oninput event
        sendModal.usernameInput.value = myData.contacts[handleFailedPaymentClick.address]?.senderInfo?.username || handleFailedPaymentClick.address || '';
        sendModal.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));

        // 4. fill in the amount input
        // get the amount from myData.wallet.history since we need to the bigint value
        const amount = myData.wallet.history.find(tx => tx.txid === handleFailedPaymentClick.txid)?.amount;
        // convert bigint to string
        const amountStr = big2str(amount, 18);
        sendModal.amountInput.value = amountStr;
    }
}

function handleFailedPaymentDelete() {
    const failedPaymentModal = document.getElementById('failedPaymentModal');
    const originalTxid = handleFailedPaymentClick.txid;

    if (typeof originalTxid === 'string' && originalTxid) {
        const currentAddress = handleFailedPaymentClick.address;
        removeFailedTx(originalTxid, currentAddress);

        if (failedPaymentModal) {
            failedPaymentModal.classList.remove('active');
        }

        // refresh current view
        chatModal.refreshCurrentView(handleFailedPaymentClick.txid);

        // Clear the stored values
        handleFailedPaymentClick.txid = '';
        handleFailedPaymentClick.address = '';
        handleFailedPaymentClick.memo = '';
        //handleFailedPaymentClick.assetID = '';
    } else {
        console.error('Error deleting message: TXID not found.');
        if (failedPaymentModal) {
            failedPaymentModal.classList.remove('active');
        }
    }
}

function closeFailedPaymentModalAndClearState() {
    const failedPaymentModal = document.getElementById('failedPaymentModal');
    if (failedPaymentModal) {
        failedPaymentModal.classList.remove('active');
    }
    // Clear the stored values when modal is closed
    handleFailedPaymentClick.txid = '';
    handleFailedPaymentClick.address = '';
    handleFailedPaymentClick.memo = '';
    //handleFailedPaymentClick.assetID = '';
}

function handleFailedPaymentBackdropClick(event) {
    const failedPaymentModal = document.getElementById('failedPaymentModal');
    if (event.target === failedPaymentModal) {
        closeFailedPaymentModalAndClearState();
    }
}

// Update wallet view; refresh wallet
async function updateWalletView() {
    const walletData = myData.wallet



    await updateWalletBalances()

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
                <div class="asset-logo"><img src="./media/liberdus_logo_50.png" class="asset-logo"></div>
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

    const now = getCorrectedTimestamp();
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
                // asset.lastPriceUpdate = now;
                // myData.wallet.assets[i] = asset; // Update the asset in the array
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
    document.getElementById('openHistoryModal').classList.remove('has-notification');
    document.getElementById('switchToWallet').classList.remove('has-notification');
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

    transactionList.innerHTML = walletData.history.map(tx => {
        const txidAttr = tx?.txid ? `data-txid="${tx.txid}"` : '';
        const statusAttr = tx?.status ? `data-status="${tx.status}"` : '';
        return `
        <div class="transaction-item" data-address="${tx.address}" ${txidAttr} ${statusAttr}>
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
                    ${tx.sign === -1 ? 'To:' : 'From:'} ${tx.nominee || contacts[tx.address]?.name || contacts[tx.address]?.senderInfo?.name || contacts[tx.address]?.username || `${contacts[tx.address]?.address.slice(0,8)}...${contacts[tx.address]?.address.slice(-6)}`}
                </div>
                <div class="transaction-time">${formatTime(tx.timestamp)}</div>
            </div>
            ${tx.memo ? `<div class="transaction-memo">${linkifyUrls(tx.memo)}</div>` : ''}
        </div>
    `}).join('');

    // Scroll the form container to top after rendering
    requestAnimationFrame(() => {
        const modal = document.getElementById('historyModal');
        const formContainer = modal?.querySelector('.form-container'); // Find the form container within the modal
        if (formContainer) {
            formContainer.scrollTop = 0;
        }
    });
}

// Handle clicks on transaction history items
function handleHistoryItemClick(event) {
    // Find the closest ancestor element with the class 'transaction-item'
    const item = event.target.closest('.transaction-item');

    if (item.dataset.status === 'failed') {
        console.log(`Not opening chatModal for failed transaction`)

        // if not data-address then we can assume it's a stake or unstake transaction so when clicking on it it should lead to the validator modal
        // TODO: remove this maybe since it should be removed from history receipt when we know it has failed when checking receipt right?
        /* if (!item.dataset.address) {
            openValidatorModal();
            return;
        } */

        if (event.target.closest('.transaction-item')){
            handleFailedPaymentClick(item.dataset.txid, item);
        }

        return;
    }

    // if not data-address then we can assume it's a stake or unstake transaction so when clicking on it it should lead to the validator modal
    /* if (!item.dataset.address) {
        openValidatorModal();
        return;
    } */

    if (item) {
        // Check if this is a stake/unstake transaction by looking at the memo
        const memo = item.querySelector('.transaction-memo')?.textContent;
        if (memo === 'stake' || memo === 'unstake') {
            validatorStakingModal.open();
            return;
        }

        // Get the address from the data-address attribute
        const address = item.dataset.address;
        if (address && myData.contacts[address]) {
            // close contactInfoModal if it is open
            if (document.getElementById('contactInfoModal').classList.contains('active')) {
                document.getElementById('contactInfoModal').classList.remove('active');
            }

            // Close the history modal
            closeHistoryModal();
            // Open the chat modal for the corresponding address
            chatModal.open(address);
        }
    }
}

async function queryNetwork(url) {
    //console.log('queryNetwork', url)
    if (!await checkOnlineStatus()) {
        //TODO: show user we are not online
        console.warn("not online")
        //alert('not online')
        return null
    }
    const randomGateway = getGatewayForRequest();
    if (!randomGateway) {
        console.error('No gateway available for network query');
        return null;
    }

    try {
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`);
        console.log('query', `${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`)
        const data = parse(await response.text());
        console.log('response', data)
        return data
    } catch (error) {
        console.error(`queryNetwork ERROR: ${error}`);
        return null
    }
}

async function pollChatInterval(milliseconds) {
    pollChats.nextPoll = milliseconds
    pollChats()
}

// Called every 30 seconds if we are online and not subscribed to WebSocket
async function pollChats() {

    // Step 2: variable to check if we are subscribed to WebSocket
    const isSubscribed = wsManager && wsManager.subscribed && wsManager.isSubscribed();

    // Step 3: Poll if we are not subscribed to WebSocket
    if (!isSubscribed) {
        // Skip if no valid account
        if (!myAccount?.keys?.address) {
            console.log('Poll skipped: No valid account');
            return;
        }

        try {
            const gotChats = await updateChatData();
            if (gotChats > 0) {
                await updateChatList();
            }

            if (document.getElementById('walletScreen')?.classList.contains('active')) {
                await updateWalletView();
            }
        } catch (error) {
            console.error('Chat polling error:', error);
        }

        scheduleNextPoll();
    } else if (window.chatUpdateTimer) {
        // Clear polling if WebSocket is subscribed
        clearTimeout(window.chatUpdateTimer);
        window.chatUpdateTimer = null;
        console.log('Poll status: Stopped - WebSocket subscribed');
    }

    const wsStatus = await checkWebSocketStatus();
    // Step 4: Log final status
    const pollStatus = {
        wsStatus,
        accountValid: Boolean(myAccount?.keys?.address),
        subscriptionStatus: isSubscribed ? 'subscribed' : 'not subscribed',
        pollingStatus: window.chatUpdateTimer ? 'polling' : 'not polling'
    };
    console.log('Poll Status:', JSON.stringify(pollStatus, null, 2));
}

// Helper function to check WebSocket status and log diagnostics if needed
async function checkWebSocketStatus() {
    if (!wsManager) return "not initialized";

    const status = wsManager.isConnected() ? "connected" : "disconnected";

    // Log diagnostic info if disconnected
    if (status === "disconnected" && wsManager.connectionState === 'disconnected') {
        const diagnosticInfo = {
            browserState: {
                isPrivateMode: !window.localStorage,
                networkProtocol: window.location.protocol === 'https:' ? 'Secure (HTTPS)' : 'Insecure (HTTP)',
                isOnline: navigator.onLine,
                webSocketSupport: typeof WebSocket !== 'undefined'
            },
            websocketConfig: {
                urlValid: network?.websocket?.url ?
                    (network.websocket.url.startsWith('ws://') || network.websocket.url.startsWith('wss://')) :
                    false,
                url: network?.websocket?.url || 'Not configured'
            }
        };
        console.log('WebSocket Diagnostic Information:', diagnosticInfo);
    }

    return status;
}

// Helper function to schedule next poll
function scheduleNextPoll() {
    if (window.chatUpdateTimer) {
        clearTimeout(window.chatUpdateTimer);
    }

    const interval = pollChats.nextPoll || pollIntervalNormal;
    const now = getCorrectedTimestamp();
    console.log('Poll schedule:', JSON.stringify({
        timestamp: now,
        nextPollIn: `${interval}ms`,
        reason: 'WebSocket not subscribed'
    }, null, 2));

    window.chatUpdateTimer = setTimeout(pollChats, interval);
}

async function getChats(keys, retry = 1) {  // needs to return the number of chats that need to be processed
console.log(`getChats retry ${retry}`)
//console.log('keys', keys)
    if (! keys){ console.log('no keys in getChats'); return 0 }     // TODO don't require passing in keys
    const now = getCorrectedTimestamp()
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
    let chatCount = senders?.chats ? Object.keys(senders.chats).length : 0; // Handle null/undefined senders.chats
    console.log('getChats senders',
        timestamp === undefined ? 'undefined' : JSON.stringify(timestamp),
        chatCount === undefined ? 'undefined' : JSON.stringify(chatCount),
        senders === undefined ? 'undefined' : JSON.stringify(senders))
    if (senders && senders.chats && chatCount){     // TODO check if above is working
        await processChats(senders.chats, keys)
    } else {
        if (retry > 0) {
            const getChatsRetryLimit = 3;
            if (retry <= getChatsRetryLimit) {
                await new Promise(resolve => setTimeout(resolve, 1000*retry));
                // call getChats recursively
                chatCount = await getChats(keys, retry + 1);
            } else {
                console.error('Failed to get chats after', getChatsRetryLimit, 'retries');
            }
        }
    }
    if (chatModal.address){   // clear the unread count of address for open chat modal
        myData.contacts[chatModal.address].unread = 0
    }
    return chatCount
}
getChats.lastCall = 0

// play sound if true or false parameter
function playChatSound(shouldPlay) {
    if (shouldPlay) {
        const notificationAudio = document.getElementById('notificationSound');
        if (notificationAudio) {
            notificationAudio.play().catch(error => {
                console.warn("Notification sound playback failed:", error);
            });
        }
    }
}

function playTransferSound(shouldPlay) {
    if (shouldPlay) {
        const notificationAudio = document.getElementById('transferSound');
        if (notificationAudio) {
            notificationAudio.play().catch(error => {
                console.warn("Notification sound playback failed:", error);
            });
        }
    }
}

// Actually payments also appear in the chats, so we can add these to
async function processChats(chats, keys) {
    let newTimestamp = 0
    const timestamp = myAccount.chatTimestamp || 0
    const messageQueryTimestamp = Math.max(0, timestamp);

    for (let sender in chats) {
        // Fetch messages using the adjusted timestamp
        const res = await queryNetwork(`/messages/${chats[sender]}/${messageQueryTimestamp}`)
        console.log("processChats sender", sender, "fetching since", messageQueryTimestamp)
        if (res && res.messages){
            const from = normalizeAddress(sender)
            if (!myData.contacts[from]){ createNewContact(from) }
            const contact = myData.contacts[from]
//            contact.address = from        // not needed since createNewContact does this
            let added = 0
            let hasNewTransfer = false;

            // This check determines if we're currently chatting with the sender
            // We ONLY want to avoid notifications if we're actively viewing this exact chat
            const inActiveChatWithSender = chatModal.address === from &&
                document.getElementById('chatModal')?.classList.contains('active'); // Added null check for safety

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
                        //console.log(`Skipping already existing message: ${payload.sent_timestamp}`);
                        continue; // Skip to the next message
                    }

//console.log('contact.message', contact.messages)
                    payload.my = false
                    payload.timestamp = payload.sent_timestamp
                    insertSorted(contact.messages, payload, 'timestamp')
                    // if we are not in the chatModal of who sent it, playChatSound
                    if (!inActiveChatWithSender){
                        playChatSound(true);
                    }
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
                    const txidHex = hashBytes(jstrBytes);

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
                        //console.log(`Skipping already existing transfer: ${txidHex}`);
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
                    insertSorted(history, newPayment, 'timestamp');
                    // TODO: redundant but keep for now
                    //  sort history array based on timestamp field in descending order
                    //history.sort((a, b) => b.timestamp - a.timestamp);

                    // Mark that we have a new transfer for toast notification
                    hasNewTransfer = true

                    // --- Create and Insert Transfer Message into contact.messages ---
                    const transferMessage = {
                        timestamp: payload.sent_timestamp,
                        sent_timestamp: payload.sent_timestamp,
                        my: false, // Received transfer
                        message: payload.message, // Use the memo as the message content
                        amount: parse(stringify(tx.amount)), // Ensure amount is stored as BigInt
                        symbol: 'LIB', // TODO: get the symbol from the asset
                    };
                    // Insert the transfer message into the contact's message list, maintaining sort order
                    insertSorted(contact.messages, transferMessage, 'timestamp');
                    // --------------------------------------------------------------

                    added += 1

                    const walletScreenActive = document.getElementById("walletScreen")?.classList.contains("active");
                    const historyModalActive = document.getElementById("historyModal")?.classList.contains("active");
                    // Update wallet view if it's active
                    if (walletScreenActive) {
                        updateWalletView();
                    }
                    // update history modal if it's active
                    if (historyModalActive) {
                        updateTransactionHistory();
                    }
                    // Always play transfer sound for new transfers
                    playTransferSound(true);
                    // is chatModal of sender address is active
                    if (inActiveChatWithSender){
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
                    chatModal.appendChatModal(true); // Pass true for highlightNewMessage flag
                }

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

                // Show toast notification for new messages
                // Only suppress notification if we're ACTIVELY viewing this chat and if not a transfer
                if (!inActiveChatWithSender && !hasNewTransfer) {
                    // Get name of sender
                    const senderName = contact.name || contact.username || `${from.slice(0,8)}...`

                    // Add notification indicator to Chats tab if we're not on it
                    const chatsButton = document.getElementById('switchToChats');
                    if (!document.getElementById('chatsScreen').classList.contains('active')) {
                        chatsButton.classList.add('has-notification');
                    }

                }
            }

            // Show transfer notification even if no messages were added
            if (hasNewTransfer) {
                // Add notification indicator to Wallet tab if we're not on it
                const walletButton = document.getElementById('switchToWallet');
                if (!document.getElementById('walletScreen').classList.contains('active')) {
                    walletButton.classList.add('has-notification');
                }
                // Add notification to openHistoryModal wallet-action-button
                const historyButton = document.getElementById('openHistoryModal');
                historyButton.classList.add('has-notification');
            }
        }
    }

    // Update the global timestamp AFTER processing all senders
    if (newTimestamp > 0){
        // Update the timestamp
        myAccount.chatTimestamp = newTimestamp
        console.log("Updated global chat timestamp to", newTimestamp);
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
`

async function postAssetTransfer(to, amount, memo, keys) {
    const toAddr = longAddress(to)
    const fromAddr = longAddress(keys.address)
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
        network: NETWORK_ACCOUNT_ID,
        fee: (parameters.current.transactionFee || 1n * wei)           // This is not used by the backend
    }

    const txid = await signObj(tx, keys)
    const res = await injectTx(tx, txid)
    return res
}

// TODO - backend - when account is being registered, ensure that loserCase(alias)=alias and hash(alias)==aliasHash
async function postRegisterAlias(alias, keys){
    const aliasBytes = utf82bin(alias)
    const aliasHash = hashBytes(aliasBytes);
    const { publicKey, secretKey } = generatePQKeys(keys.pqSeed)
    const pqPublicKey = bin2base64(publicKey)
    const tx = {
        type: 'register',
        aliasHash: aliasHash,
        from: longAddress(keys.address),
        alias: alias,
        publicKey: keys.public,
        pqPublicKey: pqPublicKey,
        timestamp: getCorrectedTimestamp()
    }
    const txid = await signObj(tx, keys)
    const res = await injectTx(tx, txid)
    return res
}

/**
 * Inject a transaction
 * @param {Object} tx - The transaction object
 * @param {string} txid - The transaction ID
 * @returns {Promise<Object>} The response from the injectTx call
 */
async function injectTx(tx, txid){
    if (!isOnline) {
        return null
    }
    const randomGateway = getGatewayForRequest();
    if (!randomGateway) {
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
            body: stringify({tx: stringify(tx)})
        }
        const response = await fetch(`${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}/inject`, options);
        console.log("DEBUG: injectTx response", response);
        const data = await response.json();
        data.txid = txid

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
            } else if (tx.type === 'message' || tx.type === 'transfer' || tx.type === 'deposit_stake' || tx.type === 'withdraw_stake') {
                pendingTxData.to = tx.to;
            }
            myData.pending.push(pendingTxData);
        } else {
            showToast('Error injecting transaction: ' + data?.result?.reason, 0, 'error');
            console.error('Error injecting transaction:', data?.result?.reason);
        }

        return data
    } catch (error) {
        showToast('Error injecting transaction: ' + error, 0, 'error');
        console.error('Error injecting transaction:', error);
        return null
    }
}

/**
 * Sign a transaction object and return the transaction ID hash
 * @param {Object} tx - The transaction object to sign
 * @param {Object} keys - The keys object containing address and secret
 * @returns {Promise<string>} The transaction ID hash
 */
async function signObj(tx, keys){
    const jstr = stringify(tx)
//console.log('tx stringify', jstr)
    const jstrBytes = utf82bin(jstr)
    const txidHex = hashBytes(jstrBytes)
    const txidHashHex = ethHashMessage(txidHex)     // Asked Thant why we are doing this;
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
        sig: flatSignature
    }
    return txidHex
}


// Service Worker Registration and Management
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
    }

    try {
        // Get the current service worker registration
        const registration = await navigator.serviceWorker.getRegistration();

        // If there's an existing service worker
        if (registration?.active) {
            console.log('Service Worker already registered and active');

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

        return newRegistration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
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
            const timestamp = getCorrectedTimestamp().toString();
            localStorage.setItem('appPaused', timestamp);

            // Prepare account data for service worker
            const accountData = {
                address: myAccount.keys.address,
                network: {
                    gateways: myData.network.gateways,
                    defaultGatewayIndex: myData.network.defaultGatewayIndex
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
            localStorage.setItem('appPaused', '0');

            // Stop polling in service worker
            const registration = await navigator.serviceWorker.ready;
            registration.active?.postMessage({ type: 'stop_polling' });

            const gotChats = await updateChatData();
            if (gotChats > 0) {
                await updateChatList();
            }
        }
    });
}



/* function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
            .then(permission => {
                console.log('Notification permission result:', permission);
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                } else {
                    console.log('Notification permission denied');
                }
            })
            .catch(error => {
                console.error('Error during notification permission request:', error);
            });
    }
} */

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
                const messageText = escapeHtml(message.message);
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
        chatModal.open(result.contactAddress);

        // Scroll to and highlight the message
        setTimeout(() => {
            const messageSelector = `[data-message-id="${result.messageId}"]`;
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

function handleSearchInputClick(e) {
    const messageSearch = document.getElementById('messageSearch');
    const searchModal = document.getElementById('searchModal');

    searchModal.classList.add('active');
    messageSearch.focus();
}

function handleMessageSearchInput(e) {
    const searchResults = document.getElementById('searchResults');

    // debounced search
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
    }, (searchText) => searchText.length === 1 ? 600 : 300);


        debouncedSearch(e.target.value);

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
            // clear search results and input contactSearchResults
            document.getElementById("contactSearchResults").innerHTML = "";
            document.getElementById("contactSearch").value = "";
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
function showToast(message, duration = 2000, type = "default") {
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
        if (type === "error") {
            // Add a close button to error toasts
            toast.style.pointerEvents = "auto";
            const closeBtn = document.createElement('button');
            closeBtn.className = "toast-close-btn";
            closeBtn.setAttribute("aria-label", "Close");
            closeBtn.innerHTML = "&times;";
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                hideToast(toastId);
            };
            toast.appendChild(closeBtn);
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
    const wasOffline = !isOnline;
    isOnline = navigator.onLine;

    if (isOnline && wasOffline) {
        console.log('Just came back online.')
        // We just came back online
        updateUIForConnectivity();
        showToast("You're back online!", 3000, "online");

        // Verify username is still valid on the network
        /* await verifyUsernameOnReconnect(); */
        // Initialize WebSocket connection regardless of view
        wsManager.initializeWebSocketManager();
        // Force update data with reconnection handling
        if (myAccount && myAccount.keys) {
            try {
                // Update chats with reconnection handling
                const gotChats = await updateChatData();
                if (gotChats > 0) {
                    await updateChatList();
                }

                // Update contacts with reconnection handling
                await updateContactsList();

                // Update wallet with reconnection handling
                await updateWalletView();

            } catch (error) {
                console.error('Failed to update data on reconnect:', error);
                showToast("Some data couldn't be updated. Please refresh if you notice missing information.", 5000, "warning");
            }
        }
    } else if (!isOnline) {
        // We just went offline
        updateUIForConnectivity();
        showToast("You're offline. Some features are unavailable.", 3000, "offline");
    }
}

// Setup connectivity detection
function setupConnectivityDetection() {
    // Only setup offline detection if running as installed PWA
    /* if (!checkIsInstalledPWA()) {
        isOnline = true; // Always consider online in web mode
        return;
    } */

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
        '#chatSendMoneyButton',

        // Wallet related
        '#openSendModal',
        '#refreshBalance',
        '#sendForm button[type="submit"]',

        // Contact related
        '#chatRecipient',
        '#chatAddFriendButton',
        '#addFriendButton',

        // Profile related
        '#accountForm button[type="submit"]',
        '#createAccountForm button[type="submit"]',
        '#importForm button[type="submit"]',
        '#contactInfoSendButton',

        // menu list buttons
        '.menu-item[id="openAccountForm"]',
        '.menu-item[id="openNetwork"]',
        '.menu-item[id="openExplorer"]',
        '.menu-item[id="openMonitor"]',
        '.menu-item[id="openAbout"]',
        '.menu-item[id="openRemoveAccount"]',

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

    // Ensure defaultGatewayIndex property exists and set to -1 (random selection)
    if (myData.network.defaultGatewayIndex === undefined) {
        myData.network.defaultGatewayIndex = -1; // -1 means use random selection
    }

    // If no gateways, initialize with system gateways
    if (myData.network.gateways.length === 0) {
        // Add system gateways from the global network object
        if (network && network.gateways) {
            network.gateways.forEach(gateway => {
                myData.network.gateways.push({
                    protocol: gateway.protocol,
                    host: gateway.host,
                    port: gateway.port,
                    name: `${gateway.host} (System)`,
                    isSystem: true,
                    isDefault: false
                });
            });
        }
    }
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
    if (
        myData.network.defaultGatewayIndex >= 0 &&
        myData.network.defaultGatewayIndex < myData.network.gateways.length
    ) {
        return myData.network.gateways[myData.network.defaultGatewayIndex];
    }

    // Otherwise use random selection
    return myData.network.gateways[
        Math.floor(Math.random() * myData.network.gateways.length)
    ];
}

async function startCamera() {
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    try {
        // First check if camera API is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API is not supported in this browser');
        }

        // Stop any existing stream
        if (startCamera.stream) {
            stopCamera();
        }

        // Hide previous results
        // resultContainer.classList.add('hidden');

        // statusMessage.textContent = 'Accessing camera...';
        // Request camera access with specific error handling
        try {
            startCamera.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
        } catch (mediaError) {
            // Handle specific getUserMedia errors
            switch (mediaError.name) {
                case 'NotAllowedError':
                    throw new Error('Camera access was denied. Please check your browser settings and grant permission to use the camera.');
                case 'NotFoundError':
                    throw new Error('No camera device was found on your system.');
                case 'NotReadableError':
                    throw new Error('Camera is already in use by another application or encountered a hardware error.');
                case 'SecurityError':
                    throw new Error('Camera access was blocked by your browser\'s security policy.');
                case 'AbortError':
                    throw new Error('Camera access was cancelled.');
                default:
                    throw new Error(`Camera error: ${mediaError.message}`);
            }
        }

        // Connect the camera stream to the video element
        video.srcObject = startCamera.stream;
        video.setAttribute('playsinline', true); // required for iOS Safari

        // When video is ready to play
        video.onloadedmetadata = function() {
            video.play();

            // Enable scanning and update button
            startCamera.scanning = true;
            // toggleButton.textContent = 'Stop Camera';

            // Start scanning for QR codes
            // Use interval instead of requestAnimationFrame for better control over scan frequency
            startCamera.scanInterval = setInterval(readQRCode, 100); // scan every 100ms (10 times per second)

            // statusMessage.textContent = 'Camera active. Point at a QR code.';
        };

        // Add error handler for video element
        video.onerror = function(error) {
            console.error('Video element error:', error);
            stopCamera();
            throw new Error('Failed to start video stream');
        };

    } catch (error) {
        console.error('Error accessing camera:', error);
        stopCamera(); // Ensure we clean up any partial setup

        // Show user-friendly error message
        showToast(error.message || 'Failed to access camera. Please check your permissions and try again.', 5000, 'error');

        // Re-throw the error if you need to handle it further up
        throw error;
    }
}

// changed to use qr.js library instead of jsQR.js
function readQRCode(){
    const video = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvas = canvasElement.getContext('2d');

    if (startCamera.scanning && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Set canvas size to match video dimensions
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;

        // Draw video frame onto canvas
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

        // Get image data for QR processing
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);

        try {
            // Process image with qr.js library
            // qr.decodeQR expects an object { data, height, width }
            const decodedText = qr.decodeQR({
                data: imageData.data,
                width: imageData.width,
                height: imageData.height
            });

            // If QR code found and decoded
            if (decodedText) {
                console.log("QR Code detected:", decodedText);
                handleSuccessfulScan(decodedText);
            }
        } catch (error) {
            // qr.decodeQR throws error if not found or on error
            //console.log('QR scanning error or not found:', error); // Optional: Log if needed
        }
    }
}


// Handle successful scan
function handleSuccessfulScan(data) {
    const scanHighlight = document.getElementById('scan-highlight');
    // Stop scanning
    if (startCamera.scanInterval) {
        clearInterval(startCamera.scanInterval);
        startCamera.scanInterval = null;
    }

    startCamera.scanning = false;

    // Stop the camera
    stopCamera();

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
    console.log("Raw QR Data Scanned:", data)
    if (openQRScanModal.fill){
        // Call the assigned fill function (e.g., fillPaymentFromQR or fillStakeAddressFromQR)
        openQRScanModal.fill(data)
    }

    closeQRScanModal()

    // Update status
//    statusMessage.textContent = 'QR code detected! Camera stopped.';
}

// Stop camera
function stopCamera() {
    const video = document.getElementById('video');
    if (startCamera.scanInterval) {
        clearInterval(startCamera.scanInterval);
        startCamera.scanInterval = null;
    }

    if (startCamera.stream) {
        startCamera.stream.getTracks().forEach(track => track.stop());
        startCamera.stream = null;
        video.srcObject = null;
        startCamera.scanning = false;
//        toggleButton.textContent = 'Start Camera';
//        statusMessage.textContent = 'Camera stopped.';
    }
}

// Changed to use qr.js library instead of jsQR.js
async function handleQRFileSelect(event, fillFunction) { // Added fillFunction parameter
    const file = event.target.files[0];
    if (!file) {
        return; // No file selected
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
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
                    // handleSuccessfulScan(decodedData); // Original call
                    if (typeof fillFunction === 'function') {
                        fillFunction(decodedData); // Call the provided fill function
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
                    document.getElementById('sendForm')?.reset();
                    document.getElementById('sendToAddressError').textContent = '';
                    document.getElementById('balanceWarning').textContent = '';
                }
            } catch (error) {
                console.error('Error processing QR code image with qr.js:', error);
                // Assume error means no QR code found or decoding failed
                showToast('Could not read QR code from image', 3000, 'error');
                // Clear the form fields in case of error
                 document.getElementById('sendForm')?.reset();
                 document.getElementById('sendToAddressError').textContent = '';
                 document.getElementById('balanceWarning').textContent = '';
            } finally {
                 event.target.value = ''; // Reset the file input value regardless of outcome
            }
        };
        img.onerror = function() {
            console.error('Error loading image');
            showToast('Error loading image file', 3000, 'error');
             event.target.value = ''; // Reset the file input value
            // Clear the form fields in case of image loading error
            document.getElementById('sendForm')?.reset();
            document.getElementById('sendToAddressError').textContent = '';
            document.getElementById('balanceWarning').textContent = '';
        };
        img.src = e.target.result;
    };

    reader.onerror = function() {
        console.error('Error reading file');
        showToast('Error reading file', 3000, 'error');
        event.target.value = ''; // Reset the file input value
    };

    reader.readAsDataURL(file);
}


// WebSocket Manager Class
/**
 * WebSocket Manager Class
 * Handles WebSocket connections, reconnection logic, and message processing for chat events.
 * Maintains connection state and provides methods for subscribing to and processing chat notifications.
 */
class WSManager {
  /**
   * Initialize the WebSocket Manager with default configuration
   */
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connectionState = 'disconnected';
    this.subscribed = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    updateWebSocketIndicator();
    // Check if ws is not null and readyState is either CONNECTING or OPEN
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket connection already established');
      return;
    }

    // Check if WebSockets are supported before attempting to connect
    if (!this.checkWebSocketSupport()) {
      console.error('WebSockets not supported, falling back to polling');
      this.connectionState = 'disconnected';
      return;
    }

    this.connectionState = 'connecting';
    console.log('WebSocket Connection:', JSON.stringify({
        url: network.websocket.url,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent
    }, null, 2));

    try {
      console.log('Creating new WebSocket instance');
      this.ws = new WebSocket(network.websocket.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection creation error:', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    if (!this.ws) {
      console.error('Cannot setup event handlers: WebSocket is null');
      return;
    }

    // console.log('Setting up WebSocket event handlers');

    this.ws.onopen = () => {
      updateWebSocketIndicator();
      console.log('WebSocket connection established');
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;

      // Auto-subscribe if account is available
      if (myAccount && myAccount.keys && myAccount.keys.address) {
        console.log('Auto-subscribing to WebSocket events');
        this.subscribe();
      } else {
        console.warn('Cannot auto-subscribe: No account information available');
      }
    };

    this.ws.onclose = (event) => {
      updateWebSocketIndicator();
      console.log('WebSocket connection closed', event.code, event.reason);
      this.connectionState = 'disconnected';
      this.subscribed = false;

      if (event.code !== 1000) {
        // Not a normal closure, try to reconnect
        console.log('Abnormal closure, attempting to reconnect');
        this.handleConnectionFailure();
      }
    };

    this.ws.onmessage = async (event) => {
      updateWebSocketIndicator();
      try {
        console.log('WebSocket message received:', event.data);
        const data = JSON.parse(event.data);

        // Check if this is a subscription response
        if (data.id !== null && data.result !== undefined) {
            if (data.result.subscription_status === true) {
              console.log('Server confirmed subscription successful');
              this.subscribed = true;
            } else if (data.error) {
              console.error('Server rejected subscription:', data.error);
              this.subscribed = false;
            }
          } else if (!data.id  && data.result.account_id && data.result.timestamp) {
            console.log('Received new chat notification in ws');
            const gotChats = await updateChatData();
            console.log('gotChats inside of ws.onmessage', gotChats);
            if (gotChats > 0) {
                console.log('inside of ws.onmessage, gotChats > 0, updating chat list');
                await updateChatList();
            }
          } else {
            // Handle any other unexpected message formats
            console.warn('Received unrecognized websocket message format:', data);
          }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    // Add error event handler before setupEventHandlers
    this.ws.onerror = (error) => {
        updateWebSocketIndicator();
        console.error('WebSocket error occurred:', error);
        console.log('WebSocket readyState at error:', this.ws ? this.ws.readyState : 'ws is null');
        this.handleConnectionFailure();
    };
  }

  /**
   * Subscribe to chat events for the current account
   */
  subscribe() {
    // don't call updateWebSocketIndicator here since that function calls this function
  //  updateWebSocketIndicator();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot subscribe: WebSocket not connected');
      return false;
    }

    if (!myAccount || !myAccount.keys || !myAccount.keys.address) {
      console.error('Cannot subscribe: No account information');
      return false;
    }

    try {
      console.log('Subscribing to chat events for address:', myAccount.keys.address);

      // Create subscription message directly with the required format
      const subscribeMessage = {
        jsonrpc: "2.0",
        id: 1,
        method: "ChatEvent",
        params: ["subscribe", longAddress(myAccount.keys.address)]
      };

      console.log('Sending subscription message:', JSON.stringify(subscribeMessage));
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log('Subscription message sent');
      return true;
    } catch (error) {
      console.error('Error subscribing to chat events:', error);
      this.subscribed = false;
      return false;
    }
  }

  /**
   * Unsubscribe from chat events
   */
  unsubscribe() {
    updateWebSocketIndicator();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return;
    }

    if (!this.subscribed) {
      console.log('Not subscribed, no need to unsubscribe');
      return;
    }

    try {
      console.log('Unsubscribing from chat events');

      const unsubscribeMessage = {
        jsonrpc: "2.0",
        id: 1,    
        method: "ChatEvent",
        params: ["unsubscribe", longAddress(myAccount.keys.address)]
      };

      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.subscribed = false;
      console.log('Attempted to unsubscribe');
    } catch (error) {
      console.error('Error unsubscribing from chat events:', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    updateWebSocketIndicator();
    console.log('Disconnecting WebSocket');
    if (this.subscribed) {
      this.unsubscribe();
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Normal closure');
        }
        this.ws = null;
        this.connectionState = 'disconnected';
        console.log('WebSocket disconnected successfully');
      } catch (error) {
        console.error('Error disconnecting WebSocket:', error);
      }
    }
  }

  /**
   * Handle connection failures with exponential backoff retry logic
   */
  handleConnectionFailure() {
    updateWebSocketIndicator();
    const diagnosticInfo = {
      connectionState: this.connectionState,
      browser: {
        userAgent: navigator.userAgent,
        protocol: window.location.protocol
      },
      reconnection: {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      }
    };

    // Add Firefox-specific diagnostics
    if (navigator.userAgent.includes('Firefox')) {
      diagnosticInfo.firefox = {
        securityPolicy: 'Different security policies for WebSockets',
        mixedContent: 'Check if HTTPS site with WS instead of WSS',
        websocketUrl: network.websocket.url,
        pageProtocol: window.location.protocol
      };
    }

    console.error('WebSocket Connection Failure:', JSON.stringify(diagnosticInfo, null, 2));

    this.connectionState = 'disconnected';

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Reconnection Status: Maximum attempts reached, falling back to polling');
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000 + Math.random() * 1000);

    const reconnectInfo = {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delaySeconds: Math.round(delay / 1000)
    };
    console.log('Reconnection Schedule:', JSON.stringify(reconnectInfo, null, 2));

    setTimeout(() => {
      console.log('Reconnecting to WebSocket');
      this.connect();
    }, delay);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected() {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  /**
   * Check if WebSocket is subscribed
   */
  isSubscribed() {
    return this.subscribed;
  }

  /**
   * Check if WebSockets are supported in the current browser
   */
  checkWebSocketSupport() {
    const supportInfo = {
      webSocketAvailable: typeof WebSocket !== 'undefined',
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language
      },
      environment: {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      }
    };

    // Add iOS standalone info
    const isIOSStandalone = (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) &&
                            window.navigator.standalone === true;
    if (isIOSStandalone) {
      supportInfo.ios = {
        mode: 'standalone_pwa',
        restrictions: network.websocket.url.startsWith('wss://')
      };
    }

    // Add Firefox-specific info
    if (navigator.userAgent.includes('Firefox')) {
      supportInfo.firefox = {
        mixedContentBlocked: window.location.protocol === 'https:' &&
                             network.websocket.url.startsWith('ws://'),
        usingSecureWebSocket: network.websocket.url.startsWith('wss://'),
        port: network.websocket.url.split(':')[2]?.split('/')[0] || 'default'
      };
    }

    // Add WebSocket URL details
    const wsUrl = new URL(network.websocket.url);
    supportInfo.websocket = {
      protocol: wsUrl.protocol,
      hostname: wsUrl.hostname,
      port: wsUrl.port || (wsUrl.protocol === 'wss:' ? '443' : '80'),
      pathname: wsUrl.pathname,
      requiresSecureContext: wsUrl.protocol === 'wss:' &&
                            !supportInfo.environment.isLocalhost
    };

    console.log('WebSocket Support Analysis:', JSON.stringify(supportInfo, null, 2));

    // Return false for known unsupported conditions
    if (!supportInfo.webSocketAvailable) {
      console.error('WebSocket Support: Not available in browser');
      return false;
    }

    if (supportInfo.firefox?.mixedContentBlocked) {
      console.error('WebSocket Support: Mixed content blocked in Firefox');
      return false;
    }

    // Allow WSS connections on localhost even with HTTP protocol
    if (supportInfo.websocket.requiresSecureContext &&
        supportInfo.environment.protocol !== 'https:' &&
        !supportInfo.environment.isLocalhost) {
      console.error('WebSocket Support: Secure context required for WSS');
      return false;
    }

    return true;
  }


    // Initialize WebSocket manager if not already created
    initializeWebSocketManager() {

        if (this.isConnected()) {
            if(!this.isSubscribed()) {
                console.log('WebSocket is already connected but not subscribed, subscribing');
                this.subscribe();
                return;
            }
            console.log('WebSocket is already connected and subscribed');
            return;
        }

        try {
            const initInfo = {
                status: 'starting',
                config: {
                    url: network.websocket.url,
                },
                account: {
                    available: !!(myAccount?.keys?.address)
                }
            };

            console.log('WebSocket Manager Initialization:', JSON.stringify(initInfo, null, 2));

            initInfo.status = 'created';

            if (initInfo.account.available) {
                this.connect();
                initInfo.status = 'connecting';
            }
            console.log('WebSocket Manager Status:', JSON.stringify(initInfo, null, 2));

        } catch (error) {
            console.error('WebSocket Manager Initialization Error:', JSON.stringify({
                error: error.message,
                stack: error.stack
            }, null, 2));
        }
    }
}

let wsManager = new WSManager()        // this is set to new WSManager() for convience

function closeSendConfirmationModal() {
    document.getElementById('sendConfirmationModal').classList.remove('active');
    document.getElementById('sendModal').classList.add('active');
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
    const index = array.findIndex(
      (existingItem) => existingItem[timestampField] < item[timestampField]
    );

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
        const sign = difference < 0 ? "-" : "+";
        console.log(`Time difference: ${sign}${minutes}m ${seconds}s ${milliseconds}ms`);
        console.log(`Successfully obtained time skew (${timeSkew}ms) from gateway endpoint ${timestampEndpoint} on attempt ${retryCount + 1}.`);

    } catch (error) {
        // Handle errors from queryNetwork (e.g., network issues, gateway unavailable)
        console.warn(`Attempt ${retryCount + 1} failed to fetch time via queryNetwork(${timestampEndpoint}):`, error);

        if (retryCount < maxRetries) {
            console.log(`Retrying time fetch in ${retryDelay}ms... (Attempt ${retryCount + 2})`);
            setTimeout(() => timeDifference(retryCount + 1), retryDelay);
        } else {
            console.error(`Failed to fetch time from gateway endpoint ${timestampEndpoint} after ${maxRetries + 1} attempts. Time skew might be inaccurate.`);
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

function updateWebSocketIndicator() {
    // added this so that we don't miss messages on phones, since phones drop the ws if not used periodically
    if (getCorrectedTimestamp() - updateWebSocketIndicator.lastSubscribed > 31000){
        wsManager.subscribe()
        updateWebSocketIndicator.lastSubscribed = getCorrectedTimestamp()
    }
    const indicator = document.getElementById('wsStatusIndicator');
    if (!indicator) return;
    if (!wsManager || !wsManager.isConnected()) {
        indicator.textContent = 'Not Connected';
        indicator.className = 'ws-status-indicator ws-red';
    } else if (wsManager.isConnected() && !wsManager.isSubscribed()) {
        indicator.textContent = 'Connected (No Sub)';
        indicator.className = 'ws-status-indicator ws-yellow';
    } else if (wsManager.isConnected() && wsManager.isSubscribed()) {
        indicator.textContent = 'Connected';
        indicator.className = 'ws-status-indicator ws-green';
    }
}
updateWebSocketIndicator.lastSubscribed = 0

// Validator Modals

// fetching market price by invoking `updateAssetPricesIfNeeded` and extracting from myData.assetPrices
async function getMarketPrice() {

    try {
        // Ensure asset prices are potentially updated by the central function
        await updateAssetPricesIfNeeded();

        // Check if wallet data and assets exist after the update attempt
        if (!myData?.wallet?.assets) {
            console.warn("getMarketPrice: Wallet assets not available in myData.");
            return null;
        }

        // Find the LIB asset in the myData structure
        const libAsset = myData.wallet.assets.find(asset => asset.id === 'liberdus');

        if (libAsset) {
            // Check if the price exists and is a valid number on the found asset
            if (typeof libAsset.price === 'number' && !isNaN(libAsset.price)) {
                // console.log(`getMarketPrice: Retrieved LIB price from myData: ${libAsset.price}`); // Optional: For debugging
                return libAsset.price;
            } else {
                // Price might be missing if the initial fetch failed or hasn't happened yet
                console.warn(`getMarketPrice: LIB asset found in myData, but its price is missing or invalid (value: ${libAsset.price}).`);
                return null;
            }
        } else {
            console.warn("getMarketPrice: LIB asset not found in myData.wallet.assets.");
            return null;
        }

    } catch (error) {
        console.error("getMarketPrice: Error occurred while trying to get price from myData:", error);
        return null; // Return null on any unexpected error during the process
    }
}

 class RemoveAccountModal {
    constructor(){
    }

    load(){  // called when the DOM is loaded; can setup event handlers here
        this.modal = document.getElementById('removeAccountModal')
        document.getElementById('openRemoveAccount').addEventListener('click', () => this.open());
        document.getElementById('closeRemoveAccountModal').addEventListener('click', () => this.close());
        document.getElementById('confirmRemoveAccount').addEventListener('click', () => this.submit());
    }

    signin(){ // called when user logs in
    }

    open(){  // called when the modal needs to be opened
        this.modal.classList.add('active')
    }

    close(){  // called when the modal needs to be closed
        this.modal.classList.remove('active')
    }

    submit(username = myAccount.username){  // called when the form is submitted
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
        myData = null       // need to delete this so that the reload does not save the data into localStore again
        window.location.reload();
    }

    confirmSubmit(){
        const usernameSelect = document.getElementById('username');
        const username = usernameSelect.value;
        if (!username) return;
        const confirmed = confirm(`Are you sure you want to remove account "${username}"?`);
        if (!confirmed) return;
        this.submit(username)
    }

    signout(){  // called when user is logging out
    }
}
const removeAccountModal = new RemoveAccountModal()

class BackupAccountModal {
    constructor() {
    }

    load() {  // called when the DOM is loaded; can setup event handlers here
        this.modal = document.getElementById('exportModal');
        document.getElementById('openExportForm').addEventListener('click', () => this.open());
        document.getElementById('closeExportForm').addEventListener('click', () => this.close());
        document.getElementById('exportForm').addEventListener('submit', (event) => this.handleSubmit(event));
    }

    open() {  // called when the modal needs to be opened
        this.modal.classList.add('active');
    }

    close() {  // called when the modal needs to be closed
        this.modal.classList.remove('active');
    }

    async handleSubmit(event) {
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
            a.download = `${myAccount.username}-liberdus-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Close export modal
            this.close();
        } catch (error) {
            console.error('Encryption failed:', error);
            alert('Failed to encrypt data. Please try again.');
        }
    }
}
const backupAccountModal = new BackupAccountModal()

class RestoreAccountModal {
    constructor() {
    }

    load() {  // called when the DOM is loaded; can setup event handlers here
        this.modal = document.getElementById('importModal');
        document.getElementById('importAccountButton').addEventListener('click', () => this.open());
        document.getElementById('closeImportForm').addEventListener('click', () => this.close());
        document.getElementById('importForm').addEventListener('submit', (event) => this.handleSubmit(event));
    }

    open() {  // called when the modal needs to be opened
        this.modal.classList.add('active');
    }

    close() {  // called when the modal needs to be closed
        this.modal.classList.remove('active');
    }

    async handleSubmit(event) {
        event.preventDefault();
        const fileInput = document.getElementById('importFile');
        const passwordInput = document.getElementById('importPassword');

        try {
            // Read the file
            const file = fileInput.files[0];
            let fileContent = await file.text();
            const isNotEncryptedData = fileContent.match('{')

            // Check if data is encrypted and decrypt if necessary
            if (!isNotEncryptedData) {
                if (!passwordInput.value.trim()) {
                    showToast('Password required for encrypted data', 3000, 'error');
                    return
                }
                fileContent = await decryptData(fileContent, passwordInput.value.trim());
                if (fileContent == null){ throw "" }
            }

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

            // Show success message using toast
            showToast('Account restored successfully!', 2000, 'success');

            // Reset form and close modal after delay
            setTimeout(() => {
                this.close();
                window.location.reload();  // need to go through Sign In to make sure imported account exists on network
                fileInput.value = '';
                passwordInput.value = '';
            }, 2000);

        } catch (error) {
            showToast(error.message || 'Import failed. Please check file and password.', 3000, 'error');
        }
    }
}
const restoreAccountModal = new RestoreAccountModal()

class GatewayModal {
    constructor() {
    }

    load() {
        this.modal = document.getElementById('gatewayModal');
        this.addEditModal = document.getElementById('addEditGatewayModal');
        this.gatewayList = document.getElementById('gatewayList');
        this.gatewayForm = document.getElementById('gatewayForm');

        // Setup event listeners when DOM is loaded
        document.getElementById('openNetwork').addEventListener('click', () => this.open());
        document.getElementById('closeGatewayForm').addEventListener('click', () => this.close());
        document.getElementById('addGatewayButton').addEventListener('click', () => this.openAddForm());
        document.getElementById('closeAddEditGatewayForm').addEventListener('click', () => this.closeAddEditForm());
        this.gatewayForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    open() {
        // Initialize gateway configuration if needed
        initializeGatewayConfig();
        this.modal.classList.add('active');
        this.updateList();
    }

    close() {
        this.modal.classList.remove('active');
    }

    openAddForm() {
        this.modal.classList.remove('active');
        this.gatewayForm.reset();
        document.getElementById('gatewayEditIndex').value = -1;
        document.getElementById('addEditGatewayTitle').textContent = 'Add Gateway';
        this.addEditModal.classList.add('active');
    }

    closeAddEditForm() {
        this.addEditModal.classList.remove('active');
        this.modal.classList.add('active');
        this.updateList();
    }

    updateList() {
        // Clear existing list
        this.gatewayList.innerHTML = '';

        // If no gateways, show empty state
        if (myData.network.gateways.length === 0) {
            this.gatewayList.innerHTML = `
                <div class="empty-state">
                    <div style="font-weight: bold; margin-bottom: 0.5rem">No Gateways</div>
                    <div>Add a gateway to get started</div>
                </div>`;
            return;
        }

        // Add "Use Random Selection" option
        const randomOption = document.createElement('div');
        randomOption.className = 'gateway-item random-option';
        randomOption.innerHTML = `
            <div class="gateway-info">
                <div class="gateway-name">Random Selection</div>
                <div class="gateway-url">Selects random gateway from list</div>
            </div>
            <div class="gateway-actions">
                <label class="default-toggle">
                    <input type="radio" name="defaultGateway" ${myData.network.defaultGatewayIndex === -1 ? 'checked' : ''}>
                    <span>Default</span>
                </label>
            </div>
        `;

        const randomToggle = randomOption.querySelector('input[type="radio"]');
        randomToggle.addEventListener('change', () => {
            if (randomToggle.checked) {
                this.setDefaultGateway(-1);
            }
        });

        this.gatewayList.appendChild(randomOption);

        // Add each gateway to the list
        myData.network.gateways.forEach((gateway, index) => {
            const isDefault = index === myData.network.defaultGatewayIndex;
            const canRemove = !gateway.isSystem;

            const gatewayItem = document.createElement('div');
            gatewayItem.className = 'gateway-item';
            gatewayItem.innerHTML = `
                <div class="gateway-info">
                    <div class="gateway-name">${escapeHtml(gateway.name)}</div>
                    <div class="gateway-url">${gateway.protocol}://${escapeHtml(gateway.host)}:${gateway.port}</div>
                    ${gateway.isSystem ? '<span class="system-badge">System</span>' : ''}
                </div>
                <div class="gateway-actions">
                    <label class="default-toggle">
                        <input type="radio" name="defaultGateway" ${isDefault ? 'checked' : ''}>
                        <span>Default</span>
                    </label>
                    <button class="icon-button edit-button" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    ${canRemove ? `
                        <button class="icon-button remove-button" title="Remove">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;

            // Add event listeners
            const defaultToggle = gatewayItem.querySelector('input[type="radio"]');
            defaultToggle.addEventListener('change', () => {
                if (defaultToggle.checked) {
                    this.setDefaultGateway(index);
                }
            });

            const editButton = gatewayItem.querySelector('.edit-button');
            editButton.addEventListener('click', () => {
                this.openEditForm(index);
            });

            if (canRemove) {
                const removeButton = gatewayItem.querySelector('.remove-button');
                removeButton.addEventListener('click', () => {
                    this.confirmRemove(index);
                });
            }

            this.gatewayList.appendChild(gatewayItem);
        });
    }

    openEditForm(index) {
        this.modal.classList.remove('active');
        const gateway = myData.network.gateways[index];
        document.getElementById('gatewayName').value = gateway.name;
        document.getElementById('gatewayProtocol').value = gateway.protocol;
        document.getElementById('gatewayHost').value = gateway.host;
        document.getElementById('gatewayPort').value = gateway.port;
        document.getElementById('gatewayEditIndex').value = index;
        document.getElementById('addEditGatewayTitle').textContent = 'Edit Gateway';
        this.addEditModal.classList.add('active');
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        const formData = {
            protocol: document.getElementById('gatewayProtocol').value,
            host: document.getElementById('gatewayHost').value,
            port: parseInt(document.getElementById('gatewayPort').value),
            name: document.getElementById('gatewayName').value
        };

        const editIndex = parseInt(document.getElementById('gatewayEditIndex').value);

        if (editIndex >= 0) {
            this.updateGateway(editIndex, formData.protocol, formData.host, formData.port, formData.name);
        } else {
            this.addGateway(formData.protocol, formData.host, formData.port, formData.name);
        }

        this.closeAddEditForm();
    }

    confirmRemove(index) {
        if (confirm('Are you sure you want to remove this gateway?')) {
            this.removeGateway(index);
        }
    }

    addGateway(protocol, host, port, name) {
        // Initialize if needed
        initializeGatewayConfig();

        // Add the new gateway
        myData.network.gateways.push({
            protocol,
            host,
            port,
            name,
            isSystem: false,
            isDefault: false
        });

        // Update the UI
        this.updateList();

        // Show success message
        showToast('Gateway added successfully');
    }

    updateGateway(index, protocol, host, port, name) {
        // Check if index is valid
        if (index >= 0 && index < myData.network.gateways.length) {
            const gateway = myData.network.gateways[index];

            // Update gateway properties
            gateway.protocol = protocol;
            gateway.host = host;
            gateway.port = port;
            gateway.name = name;

            // Update the UI
            this.updateList();

            // Show success message
            showToast('Gateway updated successfully');
        }
    }

    removeGateway(index) {
        // Check if index is valid
        if (index >= 0 && index < myData.network.gateways.length) {
            const gateway = myData.network.gateways[index];

            // Only allow removing non-system gateways
            if (!gateway.isSystem) {
                // If this was the default gateway, reset to random selection
                if (myData.network.defaultGatewayIndex === index) {
                    myData.network.defaultGatewayIndex = -1;
                } else if (myData.network.defaultGatewayIndex > index) {
                    // Adjust default gateway index if needed
                    myData.network.defaultGatewayIndex--;
                }

                // Remove the gateway
                myData.network.gateways.splice(index, 1);

                // Update the UI
                this.updateList();

                // Show success message
                showToast('Gateway removed successfully');
            }
        }
    }

    setDefaultGateway(index) {
        // Reset all gateways to non-default
        myData.network.gateways.forEach(gateway => {
            gateway.isDefault = false;
        });

        // Set the new default gateway index
        myData.network.defaultGatewayIndex = index;

        // If setting a specific gateway as default, mark it
        if (index >= 0 && index < myData.network.gateways.length) {
            myData.network.gateways[index].isDefault = true;
        }

        // Update the UI
        this.updateList();

        // Show success message
        const message = index === -1
            ? 'Using random gateway selection for better reliability'
            : 'Default gateway set';
        showToast(message);
    }
}
const gatewayModal = new GatewayModal()

class TollModal {
    constructor() {
        this.modal = document.getElementById('tollModal');
        this.currentCurrency = 'LIB'; // Initialize currency state
        this.oldToll = null;
    }

    load() {
        document.getElementById('openToll').addEventListener('click', () => this.open());
        document.getElementById('closeTollModal').addEventListener('click', () => this.close());
        document.getElementById('toggleTollCurrency').addEventListener('click', (event) => this.handleToggleTollCurrency(event));
        document.getElementById('tollForm').addEventListener('submit', (event) => this.saveAndPostNewToll(event));
    }

    open() {
        this.modal.classList.add('active');
        // set currentTollValue to the toll value in wei
        const toll = myData.settings.toll || 0n
        const tollUnit = myData.settings.tollUnit || 'LIB'

        this.updateTollDisplay(toll, tollUnit);

        this.currentCurrency = 'LIB'; // Reset currency state
        document.getElementById('tollCurrencySymbol').textContent = this.currentCurrency;
        document.getElementById('newTollAmountInput').value = ''; // Clear input field
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
        const newTollAmountInput = document.getElementById('newTollAmountInput');
        const tollCurrencySymbol = document.getElementById('tollCurrencySymbol');

        this.currentCurrency = this.currentCurrency === 'LIB' ? 'USD' : 'LIB';
        tollCurrencySymbol.textContent = this.currentCurrency;

        const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
        if (newTollAmountInput.value !== '') {
            const currentValue = parseFloat(newTollAmountInput.value);
            const convertedValue = this.currentCurrency === 'USD' ? currentValue * scalabilityFactor : currentValue / scalabilityFactor;
            newTollAmountInput.value = convertedValue.toString();
        }

        // convert `currentTollValue`
        //const currentTollValue = big2str(myData.settings.toll, 18);
        //const convertedValue = this.currentCurrency === 'USD' ? currentTollValue * marketPrice : currentTollValue;
        //document.getElementById('currentTollValue').textContent = this.currentCurrency === 'USD' ? `$${convertedValue}` : `${convertedValue} LIB`;
    }

    /**
     * Save and post the new toll to the network
     * @param {Event} event - The event object
     * @returns {Promise<void>}
     */
    async saveAndPostNewToll(event) {
        event.preventDefault();
        const newTollAmountInput = document.getElementById('newTollAmountInput');
        let newTollValue = parseFloat(newTollAmountInput.value);

        if (isNaN(newTollValue) || newTollValue < 0) {
            // console.error("Invalid toll amount");
            showToast('Invalid toll amount entered.', 'error');
            return;
        }
        const newToll = bigxnum2big(wei, newTollAmountInput.value);

        // Post the new toll to the network
        const response = await this.postToll(newToll, this.currentCurrency);

        if (response && response.result && response.result.success) {
            this.editMyDataToll(newToll, this.currentCurrency);
        }
        else {
            console.error(`Toll submission failed for txid: ${response.txid}`);
            return;
        }
        
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
        let tollValueLib = ''
        let tollValueUSD = ''

        if (tollUnit == 'LIB') {
            tollValueLib = big2str(toll, 18)
            tollValueUSD = (parseFloat(big2str(toll, 18)) * scalabilityFactor).toString()
        } else {
            tollValueUSD = big2str(toll, 18)
            tollValueLib = (parseFloat(big2str(toll, 18)) / scalabilityFactor).toString()
        }

        tollValueLib = parseFloat(tollValueLib).toString()
        tollValueUSD = parseFloat(tollValueUSD).toString()

        document.getElementById('tollAmountLIB').textContent = tollValueLib + ' LIB'
        document.getElementById('tollAmountUSD').textContent = tollValueUSD + ' USD'
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
            type: "toll",
            timestamp: getCorrectedTimestamp(),
            tollUnit: tollUnit,
        };
    
        const txid = await signObj(tollTx, myAccount.keys)
        const response = await injectTx(tollTx, txid);
        return response;
    }
}

const tollModal = new TollModal()

// Invite Modal
class InviteModal {
    constructor() {
        this.modal = document.getElementById('inviteModal');
        this.inviteEmailInput = document.getElementById('inviteEmail');
        this.invitePhoneInput = document.getElementById('invitePhone');
        this.submitButton = document.querySelector('#inviteForm button[type="submit"]');
    }

    load() {
        // Set up event listeners
        document.getElementById('openInvite').addEventListener('click', () => this.open());
        document.getElementById('closeInviteModal').addEventListener('click', () => this.close());
        document.getElementById('inviteForm').addEventListener('submit', (event) => this.handleSubmit(event));

        // Add input event listeners for email and phone fields
        this.inviteEmailInput.addEventListener('input', () => this.validateInputs());
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
            const response = await fetch('http://arimaa.com:5050/api/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user: myAccount.username,
                    email: email || undefined,
                    phone: phone || undefined
                })
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
const inviteModal = new InviteModal()


class AboutModal {
    constructor() {
        this.modal = document.getElementById('aboutModal');
    }

    load() {
        // Set up event listeners
        document.getElementById('openAbout').addEventListener('click', () => this.open());
        document.getElementById('closeAboutModal').addEventListener('click', () => this.close());

        // Set version and network information once during initialization
        document.getElementById('versionDisplayAbout').textContent = myVersion + ' ' + version;
        document.getElementById('networkNameAbout').textContent = network.name;
        document.getElementById('netIdAbout').textContent = network.netid;
    }

    open() {
        // Show the modal
        this.modal.classList.add('active');
    }

    close() {
        this.modal.classList.remove('active');
    }
}
const aboutModal = new AboutModal()

class ContactModal {
    constructor() {
        this.modal = document.getElementById('contactModal');
    }

    load() {
        document.getElementById('openContact').addEventListener('click', () => this.open());
        document.getElementById('closeContactModal').addEventListener('click', () => this.close());
        document.getElementById('submitFeedback').addEventListener('click', () => {
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
const contactModal = new ContactModal()

class MyProfileModal {
    constructor() {
    }

    load() {  // called when the DOM is loaded; can setup event handlers here
        this.modal = document.getElementById('accountModal');
        this.closeButton = document.getElementById('closeAccountForm');
        document.getElementById('openAccountForm').addEventListener('click', () => this.open());
        this.closeButton.addEventListener('click', () => this.close());
        document.getElementById('accountForm').addEventListener('submit', (event) => this.handleSubmit(event));
        this.submitButton = document.querySelector('#accountForm .update-button');
    }

    open() {  // called when the modal needs to be opened
        this.modal.classList.add('active');
        if (myData && myData.account) {
            document.getElementById('name').value = myData.account.name || '';
            document.getElementById('email').value = myData.account.email || '';
            document.getElementById('phone').value = myData.account.phone || '';
            document.getElementById('linkedin').value = myData.account.linkedin || '';
            document.getElementById('x').value = myData.account.x || '';
        }
    }

    close() {  // called when the modal needs to be closed
        this.modal.classList.remove('active');
    }

    async handleSubmit(event) {
        event.preventDefault();
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
const myProfileModal = new MyProfileModal()

class ValidatorStakingModal {
    constructor() {
        // Modal and main buttons
        this.modal = document.getElementById('validatorModal');
        this.stakeButton = document.getElementById('openStakeModal');
        this.unstakeButton = document.getElementById('submitUnstake');
        this.backButton = document.getElementById('closeStakeModal');
        
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
    }

    load() {
        // Setup event listeners when DOM is loaded
        // stakeButton handling is in the StakeValidatorModal
        this.unstakeButton.addEventListener('click', () => this.handleUnstake());

        // Add listeners for opening and closing the modal
        document.getElementById('openValidator').addEventListener('click', () => this.open());
        document.getElementById('closeValidatorModal').addEventListener('click', () => this.close());
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
            currentPendingTx = myData.pending.find(
                tx => tx.type === 'deposit_stake' || tx.type === 'withdraw_stake'
            );
        }

        if (currentPendingTx) {
            this.detailsElement.style.display = 'block';
            this.pendingSkeletonBar.style.display = 'flex';
            this.pendingTxTextInBar.textContent = currentPendingTx.type === 'withdraw_stake' ? 'Pending Unstake Transaction' : 'Pending Stake Transaction';
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
                console.warn("User address not found in myData. Skipping user account fetch.");
                // Decide how to handle this - maybe show an error or a specific state?
                // For now, we'll proceed, but nominee/user stake will be unavailable.
            }

            const [userAccountData, networkAccountData, updatePrices] = await Promise.all([
                userAddress ? queryNetwork(`/account/${longAddress(userAddress)}`) : Promise.resolve(null), // Fetch User Data if available
                queryNetwork('/account/0000000000000000000000000000000000000000000000000000000000000000'), // Fetch Network Data
                updateWalletBalances()
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
            if (stakeRequiredUsd != null && typeof stakeRequiredUsd === 'bigint' &&
                stabilityScaleMul != null && typeof stabilityScaleMul === 'number' &&
                stabilityScaleDiv != null && typeof stabilityScaleDiv === 'number' && stabilityScaleDiv !== 0) {
                try {
                    // No need to parse stakeRequiredUsd from string, it's already a BigInt
                    const scaleMulBigInt = BigInt(stabilityScaleMul);
                    const scaleDivBigInt = BigInt(stabilityScaleDiv);
                    if (scaleMulBigInt !== 0n) {
                        stakeAmountLibBaseUnits = (stakeRequiredUsd * scaleDivBigInt) / scaleMulBigInt;
                    } else {
                        console.warn("Stability scale multiplier is zero, cannot calculate LIB stake amount.");
                    }
                } catch (e) {
                    console.error("Error calculating stakeAmountLibBaseUnits with BigInt:", e, {
                        stakeRequiredUsdBaseUnits,
                        stabilityScaleMul,
                        stabilityScaleDiv
                    });
                }
            }

            let userStakedUsd = null; // number or null
            // TODO: Calculate User Staked Amount (USD) using market price - Use stability factor if available?
            // For now, using market price as implemented previously.
            if (userStakedBaseUnits != null && typeof userStakedBaseUnits === 'bigint' && marketPrice != null) { // Check it's a BigInt
                try {
                    // userStakedBaseUnits is already a BigInt object
                    const userStakedLib = Number(userStakedBaseUnits) / 1e18;
                    userStakedUsd = userStakedLib * marketPrice;
                } catch (e) {
                    console.error("Error calculating userStakedUsd:", e, { userStakedBaseUnits, marketPrice });
                }
            }

            let marketStakeUsdBaseUnits = null; // BigInt object or null
            // Calculate Min Stake at Market (USD) using BigInt and market price
            if (stakeAmountLibBaseUnits !== null && marketPrice != null) { // stakeAmountLibBaseUnits is BigInt object here
                try {
                    const stakeAmountLib = Number(stakeAmountLibBaseUnits) / 1e18;
                    const marketStakeUsd = stakeAmountLib * marketPrice;
                    // Approximate back to base units (assuming 18 decimals for USD base units)
                    marketStakeUsdBaseUnits = BigInt(Math.round(marketStakeUsd * 1e18));
                } catch (e) {
                    console.error("Error calculating marketStakeUsdBaseUnits:", e, { stakeAmountLibBaseUnits, marketPrice });
                }
            }


            // Format & Update UI

            // stakeAmountLibBaseUnits is a BigInt object or null. Pass its string representation to big2str.
            this.stakeForm.dataset.minStake = stakeAmountLibBaseUnits === null ? '0' : big2str(stakeAmountLibBaseUnits, 18);

            // stakeRequiredUsd is a BigInt object or null/undefined. Pass its string representation.
            const displayNetworkStakeUsd = stakeRequiredUsd != null ? '$' + big2str(stakeRequiredUsd, 18).slice(0, 6) : 'N/A';
            // stakeAmountLibBaseUnits is a BigInt object or null. Pass its string representation.
            const displayNetworkStakeLib = stakeAmountLibBaseUnits !== null ? big2str(stakeAmountLibBaseUnits, 18).slice(0, 7) : 'N/A';
            const displayStabilityFactor = stabilityFactor ? stabilityFactor.toFixed(4) : 'N/A';
            const displayMarketPrice = marketPrice ? '$' + marketPrice.toFixed(4) : 'N/A';
            // marketStakeUsdBaseUnits is a BigInt object or null. Pass its string representation.
            const displayMarketStakeUsd = marketStakeUsdBaseUnits !== null ? '$' + big2str(marketStakeUsdBaseUnits, 18).slice(0, 6) : 'N/A';

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
                const displayUserStakedUsd = userStakedUsd != null ? '$' + userStakedUsd.toFixed(4) : 'N/A';

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
            console.error("Error fetching validator details:", error);
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
        if (!nominee || nominee.length < 10) { // Add a basic sanity check for length
            showToast('Could not find nominated validator.', 4000, 'error');
            console.warn("ValidatorStakingModal: Nominee not found or invalid in DOM element #validator-nominee.");
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
                    txid: response.txid
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
            type: "withdraw_stake",
            nominator: longAddress(myAccount?.keys?.address),
            nominee: nodeAddress,
            force: false,
            timestamp: getCorrectedTimestamp(),
        };
    
        const txid = await signObj(unstakeTx, myAccount.keys)
        const response = await injectTx(unstakeTx, txid);
        return response;
     }
    

    async checkValidatorActivity(validatorAddress) {
        if (!validatorAddress) {
            console.error("ValidatorStakingModal: No validator address provided.");
            return { isActive: false, error: "No address provided" }; // Cannot determine activity without address
        }
        try {
            const data = await queryNetwork(`/account/${validatorAddress}`);
            if (data && data.account) {
                const account = data.account;
                // Active if reward has started (not 0) but hasn't ended (is 0)
                const isActive = account.rewardStartTime && account.rewardStartTime !== 0 && (!account.rewardEndTime || account.rewardEndTime === 0);
                return { isActive: isActive, error: null };
            } else {
                console.warn(`ValidatorStakingModal: No account data found for validator ${validatorAddress}.`);
                return { isActive: false, error: "Could not fetch validator data" };
            }
        } catch (error) {
            console.error(`ValidatorStakingModal: Error fetching data for validator ${validatorAddress}:`, error);
            // Network error or other issue fetching data.
            return { isActive: false, error: "Network error fetching validator status" };
        }
    }
}
const validatorStakingModal = new ValidatorStakingModal()

class StakeValidatorModal {
    constructor() {
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

        this.stakedAmount = 0n;
        this.lastValidationTimestamp = 0;
        this.hasNominee = false;
    }

    load() {
        // Setup event listeners
        this.form.addEventListener('submit', (event) => this.handleSubmit(event));
        this.backButton.addEventListener('click', () => this.close());

        this.debouncedValidateStakeInputs = debounce(() => this.validateStakeInputs(), 300);

        this.nodeAddressInput.addEventListener('input', this.debouncedValidateStakeInputs);
        this.amountInput.addEventListener('input', this.debouncedValidateStakeInputs);

        // Add listener for opening the modal
        document.getElementById('openStakeModal').addEventListener('click', () => this.open());
    }

    open() {
        this.modal.classList.add('active');

        // Set the correct fill function for the staking context
        openQRScanModal.fill = fillStakeAddressFromQR;

        // Display Available Balance
        const libAsset = myData.wallet.assets.find(asset => asset.symbol === 'LIB');
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
            console.log("Stake Response:", response);

            if (response && response.result && response.result.success) {
                myData.wallet.history.unshift({
                    nominee: nodeAddress,
                    amount: amount_in_wei,
                    memo: 'stake',
                    sign: -1,
                    status: 'sent',
                    timestamp: getCorrectedTimestamp(),
                    txid: response.txid
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
            type: "deposit_stake",
            nominator: longAddress(myAccount.keys.address),
            nominee: nodeAddress,
            stake: amount,
            timestamp: getCorrectedTimestamp()
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
            if(amountWei <= 0n) {
                return;
            }
    
            // get the account info for the address
            const address = longAddress(myData?.account?.keys?.address);
    
            // if the time stamps are more than 30 seconds ago, reset the staked amount and time stamps
            if(getCorrectedTimestamp() - this.lastValidationTimestamp > 30000) {
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
                if(minStakeWei < 0n) {
                    minStakeWei = 0n;
                }
            }
        } catch (error) {
            showToast(`Error validating stake inputs: ${error}`, 0, "error");
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
}
const stakeValidatorModal = new StakeValidatorModal()

class ChatModal {
    constructor() {
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
        this.newestReceivedMessage = null;
        this.newestSentMessage = null;
        
        
        // used by updateTollValue and updateTollRequired
        this.toll = null;
        this.tollUnit = null;
        this.address = null
    }

    /**
     * Loads the chat modal event listeners
     * @returns {void}
     */
    load() {
        // Add message click-to-copy handler
        this.messagesList.addEventListener('click', this.handleClickToCopy.bind(this));
        this.sendButton.addEventListener('click', this.handleSendMessage.bind(this));
        this.closeButton.addEventListener('click', this.close.bind(this));
        this.sendButton.addEventListener('keydown', ignoreTabKey);

        // Add input event listener for message textarea auto-resize
        this.messageInput.addEventListener('input', function() {
            this.style.height = '48px';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // Add focus event listener for message input to handle scrolling
        this.messageInput.addEventListener('focus', function() {
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                // Check if we're already at the bottom (within 50px threshold)
                const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= 50;
                if (isAtBottom) {
                    // Wait for keyboard to appear and viewport to adjust
                    setTimeout(() => {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }, 300); // Increased delay to ensure keyboard is fully shown
                }
            }
        });
    }

    /**
     * Opens the chat modal for the given address.
     * @param {string} address - The address of the contact to open the chat modal for.
     * @returns {void}
     */
    async open(address) {
        friendModal.setAddress(address);
        document.getElementById('newChatButton').classList.remove('visible');
        const contact = myData.contacts[address]
        friendModal.updateFriendButton(contact, 'addFriendButtonChat');
        // Set user info
        this.modalTitle.textContent = contact.name || contact.senderInfo?.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`;

        // update the toll value. Will not await this and it'll update the toll value while the modal is open.
        updateTollValue(address);

        // update local contact object with the toll required to send and receive
        updateTollRequired(address);

        // clear hidden txid input
        this.retryOfTxId.value = '';

        updateTollAmountUI(address);

        // Add data attributes to store the username and address
        this.sendMoneyButton.dataset.username = contact.username || address;

        generateIdenticon(contact.address, 40).then(identicon => {
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

        // Show modal
        this.modal.classList.add('active');

        // Clear unread count
        if (contact.unread > 0) {
            myData.state.unread = Math.max(0, (myData.state.unread || 0) - contact.unread);
            contact.unread = 0;
            updateChatList();
        }

        // Setup state for appendChatModal and perform initial render
        this.address = address
        this.appendChatModal(false); // Call appendChatModal to render messages, ensure highlight=false

        if (isOnline) {
            if (wsManager && !wsManager.isSubscribed()) {
                pollChatInterval(pollIntervalChatting) // poll for messages at a faster rate
            }
        }
    }

    /**
     * Closes the chat modal
     * @returns {void}
     */
    close() {
        if (this.newestReceivedMessage) {
            console.log(`[close] invoking sendReadTransaction`)
            this.sendReadTransaction(this.address);
        }

        this.sendReclaimTollTransaction(this.address);

        this.modal.classList.remove('active');
        if (document.getElementById('chatsScreen').classList.contains('active')) {
            updateChatList()
            document.getElementById('newChatButton').classList.add('visible');
        }
        if (document.getElementById('contactsScreen').classList.contains('active')) {
            updateContactsList()
            document.getElementById('newChatButton').classList.add('visible');
        }
        this.address = null
        if (isOnline) {
            if (wsManager && !wsManager.isSubscribed()) {
                pollChatInterval(pollIntervalNormal) // back to polling at slower rate
            }
        }
    }

    /**
     * Send a reclaim toll if the newest sent message is older than 7 days and the contact has a value not 0 in payOnReplay or payOnRead
     * @param {string} contactAddress - The address of the contact
     * @returns {Promise<void>}
     */
    async sendReclaimTollTransaction(contactAddress) {
        console.log(`[sendReclaimTollTransaction] entering function`)
        const sevenDaysAgo = getCorrectedTimestamp() -  (7 * 24 * 60 * 60 * 1000);
        console.log(`this.newestSentMessage: ${!!this.newestSentMessage}`)
        console.log(`this.newestSentMessage?.timestamp: ${this.newestSentMessage?.timestamp}`)
        console.log(`sevenDaysAgo: ${sevenDaysAgo}`)
        console.log(`this.newestSentMessage?.timestamp > sevenDaysAgo: ${this.newestSentMessage?.timestamp < sevenDaysAgo}`)
        if (!this.newestSentMessage || this.newestSentMessage?.timestamp > sevenDaysAgo) {
            console.log(`[sendReclaimTollTransaction] newestSentMessage is null or timestamp is less than 7 days ago, skipping reclaim toll transaction`)
            return;
        }
        const canReclaimToll = await this.canSenderReclaimToll(contactAddress)
        if (!canReclaimToll) {
            console.log(`[sendReclaimTollTransaction] does not have a value not 0 in payOnReplay or payOnRead, skipping reclaim toll transaction`)
            return;
        }

        const tx = {
            type: 'reclaim_toll',
            from: longAddress(myData.account.keys.address),
            to: longAddress(contactAddress),
            chatId: hashBytes([longAddress(myData.account.keys.address), longAddress(contactAddress)].sort().join``),
            timestamp: getCorrectedTimestamp(),
        }
        const txid = await signObj(tx, myAccount.keys)
        const response = await injectTx(tx, txid)
        if (!response || !response.result || !response.result.success) {
            console.warn('reclaim toll transaction failed to send', response)
        } else {
            console.log('reclaim toll transaction sent successfully')
        }
    }

    /**
     * return true if when we query chatID account , then check payOnReplay and payOnRead for index of the receiver has a value not 0
     * @param {string} contactAddress - The address of the contact
     * @returns {Promise<boolean>} - True if the contact has a value not 0 in payOnReplay or payOnRead, false otherwise
     */
    async canSenderReclaimToll(contactAddress) {
        const contact = myData.contacts[contactAddress];
        // keep track receiver index during the sort
        const sortedAddresses = [longAddress(myData.account.keys.address), longAddress(contactAddress)].sort()
        const receiverIndex = sortedAddresses.indexOf(longAddress(contactAddress))
        const chatId = hashBytes(sortedAddresses.join``);
        const chatIdAccount = await queryNetwork(`/messages/${chatId}/toll`)
        if (!chatIdAccount || !chatIdAccount.toll) {
            console.warn('chatIdAccount not found', chatIdAccount)
            return false
        }
        const payOnReply = chatIdAccount.toll.payOnReply[receiverIndex] // bigint
        const payOnRead = chatIdAccount.toll.payOnRead[receiverIndex] // bigint
        if (payOnReply !== 0n) {
            return true
        }
        if (payOnRead !== 0n) {
            return true
        }
        return false
    }

    /**
     * Sends a read transaction to the contact if the contact's timestamp is less than the newest received message's timestamp
     * @param {string} contactAddress - The address of the contact
     * @returns {void}
     */
    async sendReadTransaction(contactAddress) {
        const contact = myData.contacts[contactAddress];
        const latestMessage = this.newestReceivedMessage;
        // if the other party is not required to pay toll, then don't send a read transaction.
        if (contact.tollRequiredToReceive === 0) {
            console.log(`[sendReadTransaction] contact does not need to pay toll, skipping read transaction`)
            return;
        }
        console.log(`[sendReadTransaction] contact.timestamp: ${contact.timestamp}, latestMessage.timestamp: ${latestMessage.timestamp}`)
        console.log(`[sendReadTransaction] contact.timestamp < latestMessage.timestamp: ${contact.timestamp < latestMessage.timestamp}`)
        if (contact.timestamp < latestMessage.timestamp) {
            console.log(`[sendReadTransaction] injecting read transaction`)
            const readTransaction = await this.createReadTransaction(contactAddress);
            const txid = await signObj(readTransaction, myAccount.keys)
            const response = await injectTx(readTransaction, txid)
            if (!response || !response.result || !response.result.success) {
                console.warn('read transaction failed to send', response)
            } else {
                contact.timestamp = readTransaction.timestamp;
            }
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
        }
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

            const sufficientBalance = await validateBalance(this.toll)
            if (!sufficientBalance) {
                showToast('Insufficient balance for toll and fee', 0, 'error');
                this.sendButton.disabled = false;
                return;
            }

            //const messagesList = this.messagesList;

            // Get current chat data
            const chatsData = myData
            /*
            const currentAddress = Object.values(chatsData.contacts).find(contact =>
                modalTitle.textContent === (contact.name || contact.username || `${contact.address.slice(0,8)}...${contact.address.slice(-6)}`)
            )?.address;
            */
            const currentAddress = this.address
            if (!currentAddress) return;

            // Check if trying to message self
            if (currentAddress === myAccount.address) {
                return;
            }

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
            dhkey = deriveDhKey(combined);

            // We purposely do not encrypt/decrypt using browser native crypto functions; all crypto functions must be readable
            // Encrypt message using shared secret
            const encMessage = encryptChacha(dhkey, message)

            // Create message payload
            const payload = {
                message: encMessage,
                encrypted: true,
                encryptionMethod: 'xchacha20poly1305',
                pqEncSharedKey: bin2base64(cipherText),
                sent_timestamp: getCorrectedTimestamp()
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


            // can create a function to query the account and get the receivers toll they've set
            // TODO: will need to query network and receiver account where we validate
            // TODO: decided to query everytime we do chatModal.open and save as global variable. We don't need to clear it but we can clear it when closing the modal but should get reset when opening the modal again anyway
            const toll = this.toll;

            const chatMessageObj = await this.createChatMessage(currentAddress, payload, toll, keys);
            const txid = await signObj(chatMessageObj, keys)

            // if there a hidden txid input, get the value to be used to delete that txid from relevant data stores
            const retryTxId = this.retryOfTxId.value;
            if (retryTxId) {
                removeFailedTx(retryTxId, currentAddress);
                this.retryOfTxId.value = '';
                failedMessageModal.handleFailedMessageClick.txid = '';
                failedMessageModal.handleFailedMessageClick.handleFailedMessage = '';
            }

            // --- Optimistic UI Update ---
            // Create new message object for local display immediately
            const newMessage = {
                message,
                timestamp: payload.sent_timestamp,
                sent_timestamp: payload.sent_timestamp,
                my: true,
                txid: txid,
                status: 'sent'
            };
            insertSorted(chatsData.contacts[currentAddress].messages, newMessage, 'timestamp');

            // Update or add to chats list, maintaining chronological order
            const chatUpdate = {
                address: currentAddress,
                timestamp: newMessage.sent_timestamp,
                txid: txid
            };

            // Remove existing chat for this contact if it exists. Not handling in removeFailedTx anymore.
            const existingChatIndex = chatsData.chats.findIndex(chat => chat.address === currentAddress);
            if (existingChatIndex !== -1) {
                chatsData.chats.splice(existingChatIndex, 1);
            }

            insertSorted(chatsData.chats, chatUpdate, 'timestamp');

            // Clear input and reset height
            this.messageInput.value = '';
            this.messageInput.style.height = '48px'; // original height

            // Update the chat modal UI immediately
            this.appendChatModal() // This should now display the 'sending' message

            // Scroll to bottom of chat modal
            this.messagesList.parentElement.scrollTop = this.messagesList.parentElement.scrollHeight;
            // --- End Optimistic UI Update ---

            //console.log('payload is', payload)
            // Send the message transaction using createChatMessage with default toll of 1
            const response = await injectTx(chatMessageObj, txid)

            if (!response || !response.result || !response.result.success) {
                console.log('message failed to send', response)
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
            alert('Failed to send message. Please try again.');
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
    async createChatMessage(to, payload, toll, keys) {
        const toAddr = longAddress(to);
        const fromAddr = longAddress(keys.address)
        await getNetworkParams();
        const tx = {
            type: 'message',
            from: fromAddr,
            to: toAddr,
            amount: toll,       // not sure if this is used by the backend
            chatId: hashBytes([fromAddr, toAddr].sort().join``),
            message: 'x',
            xmessage: payload,
            timestamp: getCorrectedTimestamp(),
            network: NETWORK_ACCOUNT_ID,
            fee: (parameters.current.transactionFee || 1n * wei)           // This is not used by the backend
        }
        return tx
    }

    /**
     * Appends the chat modal to the DOM
     * @param {boolean} highlightNewMessage - Whether to highlight the newest message
     * @returns {void}
     */
    appendChatModal(highlightNewMessage = false) {
        const currentAddress = this.address; // Use a local constant
        console.log('appendChatModal running for address:', currentAddress, 'Highlight:', highlightNewMessage);
        if (!currentAddress) { return; }
    
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
        const newestReceivedItem = messages.find(item => !item.my);
        console.log('appendChatModal: Identified newestReceivedItem data:', newestReceivedItem);
        this.newestReceivedMessage = newestReceivedItem;
        this.newestSentMessage = messages.find(item => item.my);
    
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
                const amountDisplay = `${amountStr.slice(0, 6)} ${item.symbol || 'LIB'}`; // Use item.symbol or fallback
    
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
                const newestReceivedElementDOM = this.messagesList.querySelector(`[data-message-timestamp="${newestReceivedItem.timestamp}"]`);
    
                if (newestReceivedElementDOM) {
                    // Found the element, scroll to and highlight it
                    newestReceivedElementDOM.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
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
                     console.warn('appendChatModal: Could not find DOM element for newestReceivedItem with timestamp:', newestReceivedItem.timestamp);
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
        const messageEl = e.target.closest('.message');
        if (!messageEl) return;

        // Prevent copying if the message has failed and not `payment-info`
        if (messageEl.dataset.status === 'failed') {
            console.log('Copy prevented for failed message.');

            // If the message is not a payment message, show the failed message modal
            if (!messageEl.classList.contains('payment-info')) {
                failedMessageModal.handleFailedMessageClick(messageEl)
            }

            // If the message is a payment message, show the failed history item modal
            if (messageEl.classList.contains('payment-info')) {
                failedMessageModal.handleFailedPaymentClick(messageEl.dataset.txid, messageEl)
            }

            // TODO: if message is a payment open sendModal and fill with information in the payment message?

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
            }
            else {
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
        } else if (contentType === 'Memo'){
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
    refreshCurrentView(txid) { // contactAddress is kept for potential future use but not needed for this txid-based logic
        const chatsScreen = document.getElementById('chatsScreen');
        const historyModal = document.getElementById('historyModal');
        const messagesList = this.modal ? this.messagesList : null;

        // 1. Refresh History Modal if active
        if (historyModal && historyModal.classList.contains('active')) {
            console.log("DEBUG: Refreshing transaction history modal due to transaction failure.");
            updateTransactionHistory();
        }
        // 2. Refresh Chat Modal if active AND the failed txid's message is currently rendered
        if (this.modal && this.modal.classList.contains('active') && txid && messagesList) {
            // Check if an element with the specific data-txid exists within the message list
            const messageElement = messagesList.querySelector(`[data-txid="${txid}"]`);

            if (messageElement) {
                // If the element exists, the failed message is visible in the open chat. Refresh the modal.
                console.log(`DEBUG: Refreshing active chat modal because failed txid ${txid} was found in the view.`);
                this.modal.appendChatModal(); // This will redraw the messages based on the updated data (where the failed tx is removed)
            } else {
                // The failed txid doesn't correspond to a visible message in the *currently open* chat modal. No UI refresh needed for the modal itself.
                console.log(`DEBUG: Skipping chat modal refresh. Failed txid ${txid} not found in the active modal's message list.`);
            }
        }
        // 3. Refresh Chat List if active
        if (chatsScreen && chatsScreen.classList.contains('active')) {
            console.log("DEBUG: Refreshing chat list view due to transaction failure.");
            updateChatList();
        }
        // No other active view to refresh in this context
    }
}

const chatModal = new ChatModal()

class FailedMessageModal {
    constructor() {
        this.modal = document.getElementById('failedMessageModal');
        this.retryButton = this.modal.querySelector('.retry-button');
        this.deleteButton = this.modal.querySelector('.delete-button');
        this.closeButton = document.getElementById('closeFailedMessageModal');
        // used by handleFailedMessageClick
        this.handleFailedMessageClick = {
            handleFailedMessage: '',
            txid: ''
        }
        
    }

    /**
     * Loads the failed message modal event listeners
     * @returns {void}
     */
    load() {
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
        this.handleFailedMessageClick.handleFailedMessage = messageContent;
        this.handleFailedMessageClick.txid = originalTxid;

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
        const messageToRetry = this.handleFailedMessageClick.handleFailedMessage;
        const originalTxid = this.handleFailedMessageClick.txid;

        if (this.messageInput && this.retryTxIdInput && typeof messageToRetry === 'string' && typeof originalTxid === 'string') {
            this.messageInput.value = messageToRetry;
            this.retryTxIdInput.value = originalTxid;

            if (this.modal) {
                this.modal.classList.remove('active');
            }
            this.messageInput.focus();

            // Clear the stored values after use
            this.handleFailedMessageClick.handleFailedMessage = '';
            this.handleFailedMessageClick.txid = '';
        } else {
            console.error('Error preparing message retry: Necessary elements or data missing.');
            if (this.modal) {
                this.modal.classList.remove('active');
            }
        }
    }

    /**
     * When the user clicks the delete button in the failed message modal
     * It will delete the message from all data stores using removeFailedTx and remove pending tx if exists
     * @returns {void}
     */
    handleFailedMessageDelete() {
        const originalTxid = this.handleFailedMessageClick.txid;

        if (typeof originalTxid === 'string' && originalTxid) {
            const currentAddress = this.address
            removeFailedTx(originalTxid, currentAddress)

            if (this.modal) {
                this.modal.classList.remove('active');
            }

            // Clear the stored values
            this.handleFailedMessageClick.handleFailedMessage = '';
            this.handleFailedMessageClick.txid = '';
            // refresh current chatModal
            this.appendChatModal();
        } else {
            console.error('Error deleting message: TXID not found.');
            if (this.modal) {
                this.modal.classList.remove('active');
            }
        }
    }

    /**
     * Invoked when the user clicks the close button in the failed message modal
     * It will close the modal and clear the stored values
     * @returns {void}
     */
    closeFailedMessageModalAndClearState() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
        // Clear the stored values when modal is closed
        this.handleFailedMessageClick.handleFailedMessage = '';
        this.handleFailedMessageClick.txid = '';
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

// new chat modal
class NewChatModal {
    constructor() {
        this.modal = document.getElementById('newChatModal');
        this.newChatButton = document.getElementById('newChatButton');
        this.closeNewChatModalButton = document.getElementById('closeNewChatModal');
        this.newChatForm = document.getElementById('newChatForm');
        this.usernameAvailable = document.getElementById('chatRecipientError');
        this.recipientInput = document.getElementById('chatRecipient');
        this.submitButton = document.querySelector('#newChatForm button[type="submit"]');
        this.usernameInputCheckTimeout = null;
    }

    /**
     * Loads the new chat modal event listeners
     * @returns {void}
     */
    load() {
        this.newChatButton.addEventListener('click', this.openNewChatModal.bind(this));
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
        this.newChatButton.classList.remove('visible');
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
        if (document.getElementById('chatsScreen').classList.contains('active')) {
            this.newChatButton.classList.add('visible');
        }
        if (document.getElementById('contactsScreen').classList.contains('active')) {
            this.newChatButton.classList.add('visible');
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
            username = normalizeUsername(input)
            // Treat as username and lookup address
            const usernameBytes = utf82bin(username);
            const usernameHash = hashBytes(usernameBytes);
            try {
                const data = await queryNetwork(`/address/${usernameHash}`)
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
        const chatsData = myData
    
        // Check if contact exists
        if (!chatsData.contacts[recipientAddress]) { createNewContact(recipientAddress) }
        chatsData.contacts[recipientAddress].username = username
    
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
        this.usernameAvailable.style.color = '#dc3545';  // Always red for errors
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
            } else if ((taken == 'mine') || (taken == 'available')) {
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

// Send Modal
class SendModal {
    constructor() {
        this.modal = document.getElementById('sendModal');
        this.openSendModalButton = document.getElementById('openSendModal');
        this.closeSendModalButton = document.getElementById('closeSendModal');
        this.sendForm = document.getElementById('sendForm');
        this.username = null;
        this.usernameInput = document.getElementById('sendToAddress');
        this.amountInput = document.getElementById('sendAmount');
        this.memoInput = document.getElementById('sendMemo');
        this.retryTxIdInput = document.getElementById('retryOfPaymentTxId');
        this.usernameAvailable = document.getElementById('sendToAddressError');
        this.submitButton = document.querySelector('#sendForm button[type="submit"]');
        this.assetSelectDropdown = document.getElementById('sendAsset');
        this.sendModalCheckTimeout = null;
        this.balanceSymbol = document.getElementById('balanceSymbol');
        this.availableBalance = document.getElementById('availableBalance');
        this.toggleBalanceButton = document.getElementById('toggleBalance');
    }

    /**
     * Loads the send modal event listeners
     * @returns {void}
     */
    load() {
        // TODO add comment about which send form this is for chat or assets
        this.openSendModalButton.addEventListener('click', this.open.bind(this));
        this.closeSendModalButton.addEventListener('click', this.close.bind(this));
        this.sendForm.addEventListener('submit', this.handleSendFormSubmit.bind(this));
        // TODO: need to add check that it's not a back/delete key
        this.usernameInput.addEventListener('input',  async (e) => {
            this.handleSendToAddressInput(e);
        });

        this.availableBalance.addEventListener('click', this.fillAmount.bind(this));
        this.assetSelectDropdown.addEventListener('change', () => {
            // updateSendAddresses();
            this.updateAvailableBalance();
        });
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
    }

    /**
     * Opens the send modal
     * @returns {void}
     */
    async open() {
        this.modal.classList.add('active');
    
        // Clear fields when opening the modal
        this.usernameInput.value = '';
        this.amountInput.value = '';
        this.memoInput.value = '';
        this.retryTxIdInput.value = '';
    
        this.usernameAvailable.style.display = 'none';
        this.submitButton.disabled = true;
        openQRScanModal.fill = fillPaymentFromQR  // set function to handle filling the payment form from QR data
    
        if (this.username) {
            this.usernameInput.value = this.username;
            setTimeout(() => {
                this.usernameInput.dispatchEvent(new Event('input'));
            }, 500);
            this.username = null
        }
    
    
        await updateWalletBalances(); // Refresh wallet balances first
        // Get wallet data
        const wallet = myData.wallet
        // Populate assets dropdown
        this.assetSelectDropdown.innerHTML = wallet.assets.map((asset, index) =>
            `<option value="${index}">${asset.name} (${asset.symbol})</option>`
        ).join('');
    
    
        // Update addresses for first asset
        this.updateSendAddresses();
    }

    /**
     * Closes the send modal
     * @returns {void}
     */
    async close() {
        await updateChatList()
        this.modal.classList.remove('active');
        this.sendForm.reset();
        this.username = null
    }

    /**
     * Invoked when the user types in the username input
     * It will check if the username is too short, available, or not available
     * @param {Event} e - The event object
     * @returns {void}
     */
    async handleSendToAddressInput(e){
        // Check availability on input changes
        const username = normalizeUsername(e.target.value);
        const usernameAvailable = this.usernameAvailable;
    
    
        // Clear previous timeout
        if (this.sendModalCheckTimeout) {
            clearTimeout(this.sendModalCheckTimeout);
        }
    
        // Check if username is too short
        if (username.length < 3) {
            usernameAvailable.textContent = 'too short';
            usernameAvailable.style.color = '#dc3545';
            usernameAvailable.style.display = 'inline';
            await this.refreshSendButtonDisabledState();
            return;
        }
    
        // Check network availability
        this.sendModalCheckTimeout = setTimeout(async () => {
            const taken = await checkUsernameAvailability(username, myAccount.keys.address);
            if (taken == 'taken') {
                usernameAvailable.textContent = 'found';
                usernameAvailable.style.color = '#28a745';
                usernameAvailable.style.display = 'inline';
            } else if((taken == 'mine')) {
                usernameAvailable.textContent = 'mine';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
            } else if ((taken == 'available')) {
                usernameAvailable.textContent = 'not found';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
            } else {
                usernameAvailable.textContent = 'network error';
                usernameAvailable.style.color = '#dc3545';
                usernameAvailable.style.display = 'inline';
            }
            await this.refreshSendButtonDisabledState(); // Update button state based on new address status and current amount status
        }, 1000);
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
        let amount = this.amountInput.value;
        const memo = this.memoInput.value;
        const confirmButton = document.getElementById('confirmSendButton');
        const cancelButton = document.getElementById('cancelSendButton');

        await getNetworkParams();
        const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;

        // need to convert to LIB if USD is selected
        const isLib = this.balanceSymbol.textContent === 'LIB';
        if (!isLib) {
            amount = (amount / scalabilityFactor);
        }

        // Update confirmation modal with values
        document.getElementById('confirmRecipient').textContent = this.usernameInput.value;
        document.getElementById('confirmAmount').textContent = `${amount}`;
        document.getElementById('confirmAsset').textContent = assetSymbol;

        // Show/hide memo if present
        const memoGroup = document.getElementById('confirmMemoGroup');
        if (memo) {
            document.getElementById('confirmMemo').textContent = memo;
            memoGroup.style.display = 'block';
        } else {
            memoGroup.style.display = 'none';
        }

        // Hide send modal and show confirmation modal
        this.modal.classList.remove('active');

        confirmButton.disabled = false;
        cancelButton.disabled = false;
        document.getElementById('sendConfirmationModal').classList.add('active');
    }

    /**
     * Fills the amount input with the available balance
     * @returns {void}
     */
    async fillAmount() {
        await getNetworkParams();
        const asset = myData.wallet.assets[this.assetSelectDropdown.value];
        const feeInWei = (parameters.current.transactionFee || 1n * wei);
        const maxAmount = BigInt(asset.balance) - feeInWei;
    
        this.amountInput.value = big2str(maxAmount > 0n ? maxAmount : 0n, 18).slice(0, -16);
        this.amountInput.dispatchEvent(new Event('input'));
    }

    /**
     * Updates the available balance in the send modal based on the asset
     * @returns {void}
     */
    async updateAvailableBalance() {
        const walletData = myData.wallet;
        const assetIndex = this.assetSelectDropdown.value;
        const balanceWarning = this.balanceWarning;
    
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
     * Updates the balance display in the send modal based on the asset
     * @param {object} asset - The asset to update the balance display for
     * @returns {void}
     */
    async updateBalanceDisplay(asset) {
        if (!asset) {
            document.getElementById('balanceAmount').textContent = '0.0000';
            document.getElementById('balanceSymbol').textContent = '';
            document.getElementById('transactionFee').textContent = '0.00';
            return;
        }
    
        await getNetworkParams();
        const txFeeInLIB = ((parameters.current.transactionFee) || 1n * wei);
        const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
        
        // Preserve the current toggle state (LIB/USD) instead of overwriting it
        const balanceSymbolElement = document.getElementById('balanceSymbol');
        const currentSymbol = balanceSymbolElement.textContent;
        const isCurrentlyUSD = currentSymbol === 'USD';
        
        // Only set to asset symbol if it's empty (initial state)
        if (!currentSymbol) {
            balanceSymbolElement.textContent = asset.symbol;
        }

        const balanceInLIB = big2str(BigInt(asset.balance), 18).slice(0, -12);
        const feeInLIB = big2str(txFeeInLIB, 18).slice(0, -16);

        // Set the base LIB values first
        document.getElementById('balanceAmount').textContent = balanceInLIB;
        document.getElementById('transactionFee').textContent = feeInLIB;
        
        // If currently showing USD, convert the displayed values
        if (isCurrentlyUSD) {
            const balanceAmount = document.getElementById('balanceAmount');
            const transactionFee = document.getElementById('transactionFee');
            
            balanceAmount.textContent = (parseFloat(balanceInLIB) * scalabilityFactor).toString();
            transactionFee.textContent = (parseFloat(feeInLIB) * scalabilityFactor).toString();
        }
    }
    
    /**
     * Updates the send addresses for the first asset
     * @returns {void}
     */
    updateSendAddresses() {
        const walletData = myData.wallet
        const assetIndex = document.getElementById('sendAsset').value;
        // TODO: why is this commented out? are we not using it in the if block?
    //    const addressSelect = document.getElementById('sendFromAddress');
    
        // Check if we have any assets
        if (!walletData.assets || walletData.assets.length === 0) {
            addressSelect.innerHTML = '<option value="">No addresses available</option>';
            this.updateAvailableBalance();
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
        const sendToAddressError = document.getElementById('sendToAddressError');
        // Address is valid if its error/status message is visible and set to 'found'.
        const isAddressConsideredValid = sendToAddressError.style.display === 'inline' && sendToAddressError.textContent === 'found';
        //console.log(`isAddressConsideredValid ${isAddressConsideredValid}`);

        const amountInput = document.getElementById('sendAmount');
        const amount = amountInput.value;
        const assetIndex = document.getElementById('sendAsset').value;
        const balanceWarning = document.getElementById('balanceWarning');

        // Check if amount is in USD and convert to LIB for validation
        const balanceSymbol = document.getElementById('balanceSymbol');
        const isUSD = balanceSymbol.textContent === 'USD';
        let amountForValidation = amount;
        
        if (isUSD && amount) {
            await getNetworkParams();
            const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;
            amountForValidation = parseFloat(amount) / scalabilityFactor;
        }

        // convert amount to bigint
        const amountBigInt = bigxnum2big(wei, amountForValidation.toString());

        // validateBalance returns false if the amount/balance is invalid.
        const isAmountAndBalanceValid = await validateBalance(amountBigInt, assetIndex, balanceWarning);
        console.log(`isAmountAndBalanceValid ${isAmountAndBalanceValid}`);

        const submitButton = document.querySelector('#sendForm button[type="submit"]');

        // Enable button only if both conditions are met.
        if (isAddressConsideredValid && isAmountAndBalanceValid) {
            submitButton.disabled = false;
        } else {
            submitButton.disabled = true;
        }
    }

    /**
     * This function is called when the user clicks the toggle LIB/USD button.
     * Updates the balance symbol and the send amount to the equivalent value in USD/LIB
     * @param {Event} e - The event object
     * @returns {void}
     */
    async handleToggleBalance(e) {
        e.preventDefault();
        const balanceSymbol = document.getElementById('balanceSymbol');
        balanceSymbol.textContent = balanceSymbol.textContent === 'LIB' ? 'USD' : 'LIB';
        const sendAmount = document.getElementById('sendAmount');
        const balanceAmount = document.getElementById('balanceAmount');
        const transactionFee = document.getElementById('transactionFee');

        // check the context value of the button to determine if it's LIB or USD
        const isLib = balanceSymbol.textContent === 'LIB';

        // get the scalability factor for LIB/USD conversion
        await getNetworkParams();
        const scalabilityFactor = parameters.current.stabilityScaleMul / parameters.current.stabilityScaleDiv;

        // Get the raw values in LIB format
        const asset = myData.wallet.assets[this.assetSelectDropdown.value];
        const txFeeInWei = (parameters.current.transactionFee || 1n * wei);
        const balanceInLIB = big2str(BigInt(asset.balance), 18).slice(0, -12);
        const feeInLIB = big2str(txFeeInWei, 18).slice(0, -16);

        // if isLib is false, convert the sendAmount to USD
        if (!isLib) {
            sendAmount.value = (sendAmount.value * scalabilityFactor);
            balanceAmount.textContent = '$' + (parseFloat(balanceInLIB) * scalabilityFactor).toString();
            transactionFee.textContent = '$' + (parseFloat(feeInLIB) * scalabilityFactor).toString();
        } else {
            sendAmount.value = (sendAmount.value / scalabilityFactor);
            balanceAmount.textContent = balanceInLIB;
            transactionFee.textContent = feeInLIB;
        }
    }
}

const sendModal = new SendModal();


/**
 * Remove failed transaction from the contacts messages, pending, and wallet history
 * @param {string} txid - The transaction ID to remove
 * @param {string} currentAddress - The address of the current contact
 */
function removeFailedTx(txid, currentAddress) {
    console.log(`DEBUG: Removing failed/timed-out txid ${txid} from all stores`);

    // remove pending tx if exists
    const index = myData.pending.findIndex(tx => tx.txid === txid);
    if (index > -1) {
        myData.pending.splice(index, 1);
    }

    const contact = myData?.contacts?.[currentAddress];
    if (contact && contact.messages) {
        contact.messages = contact.messages.filter(msg => msg.txid !== txid);
    }
    myData.wallet.history = myData?.wallet?.history?.filter(item => item.txid !== txid);
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
            if (submittedts < thirtySecondsAgo && 
                (res.transaction === null || Object.keys(res.transaction).length === 0)
            ) {
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
                        address: pendingTxInfo.address
                    });
                }

                if (res?.transaction?.type === 'withdraw_stake') {
                    const index = myData.wallet.history.findIndex(tx => tx.txid === txid);
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
                    if (document.getElementById('validatorModal').classList.contains('active')) {
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
            }
            else if (res?.transaction?.success === false) {
                console.log(`DEBUG: txid ${txid} failed, removing completely`);
                // Check for failure reason in the transaction receipt
                const failureReason = res?.transaction?.reason || 'Transaction failed';
                console.log(`DEBUG: failure reason: ${failureReason}`);

                if (type === 'register') {
                    pendingPromiseService.reject(txid, new Error(failureReason));
                } else {
                    // Show toast notification with the failure reason
                    if (type === 'withdraw_stake') {
                        showToast(`Unstake failed: ${failureReason}`, 0, "error");
                    } else if (type === 'deposit_stake') {
                        showToast(`Stake failed: ${failureReason}`, 0, "error");
                    } 
                    else if (type === 'toll') {
                        showToast(`Toll submission failed! Reverting to old toll: ${tollModal.oldToll}. Failure reason: ${failureReason}. `, 0, "error");
                        // revert the local myData.settings.toll to the old value
                        tollModal.editMyDataToll(tollModal.oldToll);
                    } 
                    else if (type === 'update_toll_required') {
                        showToast(`Update contact status failed: ${failureReason}. Reverting contact to old status.`, 0, "error");
                        // revert the local myData.contacts[toAddress].friend to the old value
                        myData.contacts[pendingTxInfo.to].friend = pendingTxInfo.friend;
                    } else if (type === 'read') {
                        showToast(`Read transaction failed: ${failureReason}`, 0, "error");
                        // revert the local myData.contacts[toAddress].timestamp to the old value
                        myData.contacts[pendingTxInfo.to].timestamp = pendingTxInfo.oldContactTimestamp;
                    }
                    else { // for messages, transfer etc.
                        showToast(failureReason, 0, "error");
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
                    myData.wallet.history = myData.wallet.history.filter(tx => tx.txid !== txid);

                    if (document.getElementById('validatorModal').classList.contains('active')) {
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
    // update wallet balances
    updateWalletBalances();
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
        const txIndex = myData.wallet.history.findIndex(tx => tx.txid === txid);
        if (txIndex !== -1) {
            myData.wallet.history[txIndex].status = status;
        }
    }

    // now use toAddress to find the contact and change the status of the message
    const contact = myData.contacts[toAddress];
    if (contact) {
        const msgIndex = contact.messages.findIndex(msg => msg.txid === txid);
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

function handleTogglePrivateKeyInput() {
    const privateKeySection = document.getElementById('privateKeySection');
    const newPrivateKeyInput = document.getElementById('newPrivateKey');

    // clear the newPrivateKeyInput
    newPrivateKeyInput.value = '';

    if (togglePrivateKeyInput.checked) {
        privateKeySection.style.display = 'block';
    } else {
        privateKeySection.style.display = 'none';
    }
}

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
            return;
        } else {
            console.warn(`getNetworkParams: Received null or undefined data from queryNetwork for account ${NETWORK_ACCOUNT_ID}. Cached data (if any) will remain unchanged.`);
        }
    } catch (error) {
        console.error(`getNetworkParams: Error fetching network account data for ${NETWORK_ACCOUNT_ID}: Cached data (if any) will remain unchanged.`, error);
        // Optional: Clear data or reset timestamp to force retry on next call
    }
}
getNetworkParams.timestamp = 0;

