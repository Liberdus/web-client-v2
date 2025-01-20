// https://github.com/paulmillr/noble-secp256k1
// https://github.com/paulmillr/noble-secp256k1/raw/refs/heads/main/index.js
import * as secp from "./noble-secp256k1.js";

// https://github.com/adraffy/keccak.js
// https://github.com/adraffy/keccak.js/blob/main/src/keccak256.js
//   permute.js and utils.js were copied into keccak256.js instead of being imported
import keccak256 from "./keccak256.js";

// https://github.com/dcposch/blakejs
// https://github.com/dcposch/blakejs/blob/master/blake2b.js
//   some functions from util.js were copied into blake2b.js
import blake from "./blake2b.js";

// https://github.com/streamich/fastest-stable-stringify
// https://github.com/streamich/fastest-stable-stringify/blob/master/index.js
//        import { stringify } from './stringify-fastest.js';

// https://github.com/shardus/lib-crypto-web/blob/main/utils/stringify.js
// Needed to stringify and parse bigints; also deterministic stringify
import { stringify, parse } from "./stringify-shardus.js";

const myHashKey = hex2bin(
  "69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc"
);
const wei = 1n; // eventualy set this to 10n**18n for Eth like currency

let myAccount = null;
let myData = null;

// TODO - get the parameters from the network
// mock network parameters
let parameters = {
  current: {
    transactionFee: 1,
  },
};

const LIB_RPC_METHODS = {
  SEND_TRANSACTION: "lib_sendTransaction",
  GET_ACCOUNT: "lib_getAccount",
  GET_TRANSACTION_RECEIPT: "lib_getTransactionReceipt",
  GET_TRANSACTION_HISTORY: "lib_getTransactionHistory",
  GET_MESSAGES: "lib_getMessages",
  SUBSCRIBE: "lib_subscribe",
  UNSUBSCRIBE: "lib_unsubscribe",
};

async function checkOnlineStatus() {
  try {
    const url = new URL(window.location.origin);
    url.searchParams.set("rand", Math.random());
    const response = await fetch(url.toString(), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkUsernameAvailability(username) {
  const usernameBytes = utf82bin(username);
  const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);
  console.log("usernameHash", usernameHash);
  
  try {
    const accountData = await makeJsonRpcRequest(LIB_RPC_METHODS.GET_ACCOUNT, [usernameHash]);
    
    // If we get account data with an address field, username is taken
    if (accountData && accountData.address) {
      return "taken";
    }
    
    // If we get null (account not found) or account data without address, username is available
    return "available";
    
  } catch (error) {
    console.log("Error checking username:", error);
    return "error2";
  }
}

function getAvailableUsernames() {
  const { netid } = network;
  const accounts = parse(localStorage.getItem("accounts") || '{"netids":{}}');
  const netidAccounts = accounts.netids[netid];
  if (!netidAccounts || !netidAccounts.usernames) return [];
  return Object.keys(netidAccounts.usernames);
}

function openSignInModal() {
  // Get existing accounts
  const { netid } = network;
  const existingAccounts = parse(
    localStorage.getItem("accounts") || '{"netids":{}}'
  );
  const netidAccounts = existingAccounts.netids[netid];
  const usernames = netidAccounts?.usernames
    ? Object.keys(netidAccounts.usernames)
    : [];

  // First show the modal so we can properly close it if needed
  document.getElementById("signInModal").classList.add("active");

  // If no accounts exist, close modal and open Create Account modal
  if (usernames.length === 0) {
    closeSignInModal();
    openCreateAccountModal();
    return;
  }

  // If only one account exists, sign in automatically
  if (usernames.length === 1) {
    const username = usernames[0];
    myAccount = netidAccounts.usernames[username];
    myData = parse(localStorage.getItem(`${username}_${netid}`));
    if (!myData) {
      myData = newDataRecord(myAccount);
    }
    closeSignInModal();
    document.getElementById("welcomeScreen").style.display = "none";
    switchView("chats");
    return;
  }

  // Multiple accounts exist, show modal with select dropdown
  const usernameSelect = document.getElementById("username");
  const submitButton = document.querySelector(
    '#signInForm button[type="submit"]'
  );

  // Populate select with usernames
  usernameSelect.innerHTML = `
                        <option value="">Select an account</option>
                        ${usernames
                          .map(
                            (username) =>
                              `<option value="${username}">${username}</option>`
                          )
                          .join("")}
                    `;

  // Enable submit button when an account is selected
  usernameSelect.addEventListener("change", () => {
    submitButton.disabled = !usernameSelect.value;
  });

  // Initially disable submit button
  submitButton.disabled = true;
}

function closeSignInModal() {
  document.getElementById("signInModal").classList.remove("active");
}

function openCreateAccountModal() {
  document.getElementById("createAccountModal").classList.add("active");
  const usernameInput = document.getElementById("newUsername");

  // Check availability on input changes
  let checkTimeout;
  usernameInput.addEventListener("input", (e) => {
    const username = e.target.value;
    const usernameAvailable = document.getElementById("newUsernameAvailable");
    const submitButton = document.querySelector(
      '#createAccountForm button[type="submit"]'
    );

    // Clear previous timeout
    if (checkTimeout) {
      clearTimeout(checkTimeout);
    }

    // Reset display
    usernameAvailable.style.display = "none";
    submitButton.disabled = true;

    // Check if username is too short
    if (username.length < 3) {
      usernameAvailable.textContent = "too short";
      usernameAvailable.style.color = "#dc3545";
      usernameAvailable.style.display = "inline";
      return;
    }

    // Check network availability
    checkTimeout = setTimeout(async () => {
      const taken = await checkUsernameAvailability(username);
      if (taken == "taken") {
        usernameAvailable.textContent = "taken";
        usernameAvailable.style.color = "#dc3545";
        usernameAvailable.style.display = "inline";
        submitButton.disabled = true;
      } else if (taken == "available") {
        usernameAvailable.textContent = "available";
        usernameAvailable.style.color = "#28a745";
        usernameAvailable.style.display = "inline";
        submitButton.disabled = false;
      } else {
        usernameAvailable.textContent = "network error";
        usernameAvailable.style.color = "#dc3545";
        usernameAvailable.style.display = "inline";
        submitButton.disabled = true;
      }
    }, 1000);
  });
}

function closeCreateAccountModal() {
  document.getElementById("createAccountModal").classList.remove("active");
}

async function handleCreateAccount(event) {
  event.preventDefault();
  const username = document.getElementById("newUsername").value;

  // Get network ID from network.js
  const { netid } = network;

  // Get existing accounts or create new structure
  const existingAccounts = parse(
    localStorage.getItem("accounts") || '{"netids":{}}'
  );

  // Ensure netid and usernames objects exist
  if (!existingAccounts.netids[netid]) {
    existingAccounts.netids[netid] = { usernames: {} };
  }

  // Get private key from input or generate new one
  const providedPrivateKey = document
    .getElementById("newPrivateKey")
    .value.trim();
  let privateKey, privateKeyHex;

  if (providedPrivateKey) {
    try {
      privateKey = hex2bin(providedPrivateKey);
      if (privateKey.length !== 32) {
        throw new Error("Invalid private key length");
      }
      privateKeyHex = providedPrivateKey;
    } catch (error) {
      alert("Invalid private key format. Using random key instead.");
      privateKey = secp.utils.randomPrivateKey();
      privateKeyHex = bin2hex(privateKey);
    }
  } else {
    privateKey = secp.utils.randomPrivateKey();
    privateKeyHex = bin2hex(privateKey);
  }

  // Generate uncompressed public key
  const publicKey = secp.getPublicKey(privateKey, false);
  const publicKeyHex = bin2hex(publicKey);

  // Generate address from public key
  const address = keccak256(publicKey.slice(1)).slice(-20);
  const addressHex = bin2hex(address);

  // Create new account entry
  myAccount = {
    netid,
    username,
    keys: {
      address: addressHex,
      public: publicKeyHex,
      secret: privateKeyHex,
      type: "secp256k1",
    },
  };

  // Create new data entry
  myData = newDataRecord(myAccount);
  const res = await postRegisterAlias(username, myAccount.keys);

  // Update this check to match the RPC response format
  if (!res || !res.success) {
    showToast("Failed to create account. Please try again.", res?.reason);
    return;
  }

  // Change create account button to Creating Account...
  const createAccountButton = document.querySelector(
    '#createAccountForm button[type="submit"]'
  );
  createAccountButton.textContent = "Creating Account...";
  createAccountButton.disabled = true;

  // Wait for 5 seconds
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const created = await checkAccountCreation(username);

  if (!created) {
    createAccountButton.textContent = "Create Account";
    createAccountButton.disabled = false;
    showToast("Failed to create account. Please try again.");
    return;
  }

  // Store updated accounts back in localStorage
  existingAccounts.netids[netid].usernames[username] = myAccount;
  localStorage.setItem("accounts", stringify(existingAccounts));

  // Store the account data in localStorage
  localStorage.setItem(`${username}_${netid}`, stringify(myData));

  // Close modal and proceed to app
  closeCreateAccountModal();
  document.getElementById("welcomeScreen").style.display = "none";
  switchView("chats"); // Default view
  await updateWalletBalances();
}

async function handleSignIn(event) {
  event.preventDefault();
  const username = document.getElementById("username").value;

  // Get network ID from network.js
  const { netid } = network;

  // Get existing accounts
  const existingAccounts = parse(
    localStorage.getItem("accounts") || '{"netids":{}}'
  );

  // Check if username exists
  if (!existingAccounts.netids[netid]?.usernames?.[username]) {
    console.error("Account not found");
    return;
  }

  // Use existing account
  myAccount = existingAccounts.netids[netid].usernames[username];
  myData = parse(localStorage.getItem(`${username}_${netid}`));
  if (!myData) {
    myData = newDataRecord(myAccount);
  }

  // Close modal and proceed to app
  closeSignInModal();
  document.getElementById("welcomeScreen").style.display = "none";
  switchView("chats"); // Default view
}

function newDataRecord(myAccount) {
  const myData = {
    timestamp: Date.now(),
    account: myAccount,
    network: {
      gateways: [],
    },
    contacts: {},
    chats: [],
    wallet: {
      balance: 0,
      timestamp: 0, // last balance update timestamp
      assets: [
        {
          id: "liberdus",
          name: "Liberdus",
          symbol: "LIB",
          img: "images/lib.png",
          chainid: 2220,
          contract: "",
          price: 1,
          balance: 0,
          addresses: [
            {
              address: myAccount.keys.address,
              balance: 0,
              history: [],
            },
          ],
        },
      ],
      keys: {},
    },
    state: {
      unread: 0,
    },
    settings: {
      encrypt: true,
      toll: 1,
    },
  };
  myData.wallet.keys[`${myAccount.keys.address}`] = {
    address: myAccount.keys.address,
    public: myAccount.keys.public,
    secret: myAccount.keys.secret,
    type: myAccount.keys.type,
  };
  return myData;
}

// Generate deterministic color from hash
function getColorFromHash(hash, index) {
  const hue = parseInt(hash.slice(index * 2, index * 2 + 2), 16) % 360;
  const saturation =
    60 + (parseInt(hash.slice(index * 2 + 2, index * 2 + 4), 16) % 20);
  const lightness =
    45 + (parseInt(hash.slice(index * 2 + 4, index * 2 + 6), 16) % 10);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Convert string to Uint8Array for hashing
function str2ab(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Generate SVG path for identicon
function generateIdenticonSvg(hash, size = 50) {
  const padding = 5;
  const cellSize = (size - 2 * padding) / 5;

  // Create 5x5 grid of cells
  let paths = [];
  let colors = [];

  // Use first 10 bytes for colors (2 colors)
  const color1 = getColorFromHash(hash, 0);
  const color2 = getColorFromHash(hash, 3);

  // Use remaining bytes for pattern
  for (let i = 0; i < 15; i++) {
    const byte = parseInt(hash.slice(i * 2 + 12, i * 2 + 14), 16);
    if (byte % 2 === 0) {
      // 50% chance for each cell
      const row = Math.floor(i / 3);
      const col = i % 3;
      // Mirror the pattern horizontally
      const x1 = padding + col * cellSize;
      const x2 = padding + (4 - col) * cellSize;
      const y = padding + row * cellSize;

      // Add rectangles for both sides
      paths.push(`M ${x1} ${y} h ${cellSize} v ${cellSize} h -${cellSize} Z`);
      if (col < 2) {
        // Don't duplicate center column
        paths.push(`M ${x2} ${y} h ${cellSize} v ${cellSize} h -${cellSize} Z`);
      }

      // Alternate between colors
      colors.push(byte % 4 === 0 ? color1 : color2);
      if (col < 2) {
        colors.push(byte % 4 === 0 ? color1 : color2);
      }
    }
  }

  return `
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                    <rect width="${size}" height="${size}" fill="#f0f0f0"/>
                    ${paths
                      .map(
                        (path, i) => `<path d="${path}" fill="${colors[i]}"/>`
                      )
                      .join("")}
                </svg>
            `;
}

// Generate identicon from address
async function generateIdenticon(address, size = 50) {
  // Hash the address using SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", str2ab(address));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = bin2hex(hashArray); // hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return generateIdenticonSvg(hashHex, size);
}

// Load saved account data and update chat list on page load
document.addEventListener("DOMContentLoaded", () => {
  //            loadAccountFormData();
  //            updateChatList();

  // Add unload handler to save myData
  window.addEventListener("unload", () => {
    if (myData && myAccount) {
      localStorage.setItem(
        `${myAccount.username}_${myAccount.netid}`,
        stringify(myData)
      );
    }
  });

  // Check for existing accounts and arrange welcome buttons
  const hasAccounts =
    localStorage.getItem("accounts") &&
    Object.keys(JSON.parse(localStorage.getItem("accounts")).netids || {})
      .length > 0;

  const signInBtn = document.getElementById("signInButton");
  const createAccountBtn = document.getElementById("createAccountButton");
  const importAccountBtn = document.getElementById("importAccountButton");
  const welcomeButtons = document.querySelector(".welcome-buttons");

  // Reorder buttons based on accounts existence
  if (hasAccounts) {
    welcomeButtons.innerHTML = ""; // Clear existing order
    welcomeButtons.appendChild(signInBtn);
    welcomeButtons.appendChild(createAccountBtn);
    welcomeButtons.appendChild(importAccountBtn);
    signInBtn.classList.add("primary-button");
    signInBtn.classList.remove("secondary-button");
  } else {
    welcomeButtons.innerHTML = ""; // Clear existing order
    welcomeButtons.appendChild(createAccountBtn);
    welcomeButtons.appendChild(signInBtn);
    welcomeButtons.appendChild(importAccountBtn);
    createAccountBtn.classList.add("primary-button");
    createAccountBtn.classList.remove("secondary-button");
  }

  // Add event listeners
  document.getElementById("search").addEventListener("click", () => {
    // TODO: Implement search functionality
  });
  document.getElementById("toggleMenu").addEventListener("click", toggleMenu);
  document.getElementById("closeMenu").addEventListener("click", toggleMenu);

  // Sign In Modal
  signInBtn.addEventListener("click", openSignInModal);
  document
    .getElementById("closeSignInModal")
    .addEventListener("click", closeSignInModal);
  document
    .getElementById("signInForm")
    .addEventListener("submit", handleSignIn);

  // Create Account Modal
  createAccountBtn.addEventListener("click", openCreateAccountModal);
  document
    .getElementById("closeCreateAccountModal")
    .addEventListener("click", closeCreateAccountModal);
  document
    .getElementById("createAccountForm")
    .addEventListener("submit", handleCreateAccount);

  // Import Account now opens Import File Modal
  importAccountBtn.addEventListener("click", openImportFileModal);

  // Account Form Modal
  document
    .getElementById("openAccountForm")
    .addEventListener("click", openAccountForm);
  document
    .getElementById("closeAccountForm")
    .addEventListener("click", closeAccountForm);
  document
    .getElementById("accountForm")
    .addEventListener("submit", handleAccountUpdate);

  //            document.getElementById('openImportFormMenu').addEventListener('click', openImportFileModal);
  document
    .getElementById("closeImportForm")
    .addEventListener("click", closeImportFileModal);
  document
    .getElementById("importForm")
    .addEventListener("submit", handleImportFile);

  document
    .getElementById("openExportForm")
    .addEventListener("click", openExportForm);
  document
    .getElementById("closeExportForm")
    .addEventListener("click", closeExportForm);
  document
    .getElementById("exportForm")
    .addEventListener("submit", handleExport);

  document
    .getElementById("openSendModal")
    .addEventListener("click", openSendModal);
  document
    .getElementById("closeSendModal")
    .addEventListener("click", closeSendModal);
  document.getElementById("sendForm").addEventListener("submit", handleSend);
  document.getElementById("sendAsset").addEventListener("change", () => {
    updateSendAddresses();
    updateAvailableBalance();
  });
  document
    .getElementById("sendFromAddress")
    .addEventListener("change", updateAvailableBalance);
  document
    .getElementById("availableBalance")
    .addEventListener("click", fillAmount);

  // Add blur event listener for recipient validation
  document
    .getElementById("sendToAddress")
    .addEventListener("blur", handleSendToAddressValidation);

  document
    .getElementById("openReceiveModal")
    .addEventListener("click", openReceiveModal);
  document
    .getElementById("closeReceiveModal")
    .addEventListener("click", closeReceiveModal);
  document
    .getElementById("receiveAsset")
    .addEventListener("change", updateReceiveAddresses);
  document
    .getElementById("receiveAddress")
    .addEventListener("change", updateDisplayAddress);
  document.getElementById("copyAddress").addEventListener("click", copyAddress);

  document
    .getElementById("openHistoryModal")
    .addEventListener("click", openHistoryModal);
  document
    .getElementById("closeHistoryModal")
    .addEventListener("click", closeHistoryModal);
  document
    .getElementById("historyAsset")
    .addEventListener("change", updateHistoryAddresses);
  document
    .getElementById("historyAddress")
    .addEventListener("change", updateTransactionHistory);

  document
    .getElementById("switchToChats")
    .addEventListener("click", () => switchView("chats"));
  document
    .getElementById("switchToContacts")
    .addEventListener("click", () => switchView("contacts"));
  document
    .getElementById("switchToWallet")
    .addEventListener("click", () => switchView("wallet"));

  document
    .getElementById("handleSignOut")
    .addEventListener("click", handleSignOut);
  document
    .getElementById("closeChatModal")
    .addEventListener("click", closeChatModal);
  document
    .getElementById("handleSendMessage")
    .addEventListener("click", handleSendMessage);

  // Add refresh balance button handler
  document
    .getElementById("refreshBalance")
    .addEventListener("click", async () => {
      await updateWalletBalances();
      updateWalletView();
    });

  // New Chat functionality
  document
    .getElementById("newChatButton")
    .addEventListener("click", openNewChatModal);
  document
    .getElementById("closeNewChatModal")
    .addEventListener("click", closeNewChatModal);
  document
    .getElementById("newChatForm")
    .addEventListener("submit", handleNewChat);

  // Add blur event listener to recipient input for validation
  document.getElementById("recipient").addEventListener("blur", async (e) => {
    const input = e.target.value.trim();
    if (input.length >= 3 && !input.startsWith("0x")) {
      // Check username availability on network
      const taken = await checkUsernameAvailability(input);
      if (taken == "taken") {
        const errorElement = document.getElementById("recipientError");
        errorElement.textContent = "found";
        errorElement.style.color = "#28a745"; // Green color for success
        errorElement.style.display = "inline";
      } else if (taken == "available") {
        showRecipientError("not found");
      } else {
        showRecipientError("network error");
      }
    }
  });

  // Add input event listener for message textarea auto-resize
  document
    .querySelector(".message-input")
    .addEventListener("input", function () {
      this.style.height = "44px";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
});

// Format timestamp to relative time
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 7) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    return currentYear === year ? `${month} ${day}` : `${month} ${day} ${year}`;
  } else if (days > 0) {
    return days === 1 ? "Yesterday" : `${days} days ago`;
  } else {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

// Update chat list UI
async function updateChatList() {
  if (myAccount && myAccount.keys) {
    await getChats(myAccount.keys);
  }
  const chatList = document.getElementById("chatList");
  //            const chatsData = JSON.parse(localStorage.getItem('chatsData') || '{"chats":[]}');
  const chatsData = myData;

  if (chatsData.chats.length === 0) {
    chatList.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size: 2rem; margin-bottom: 1rem">💬</div>
                        <div style="font-weight: bold; margin-bottom: 0.5rem">No Chats Yet</div>
                        <div>Your conversations will appear here</div>
                    </div>`;
    return;
  }

  const chatItems = await Promise.all(
    chatsData.chats.map(async (chat) => {
      const identicon = await generateIdenticon(chat.address);
      return `
                    <li class="chat-item">
                        <div class="chat-avatar">${identicon}</div>
                        <div class="chat-content">
                            <div class="chat-header">
                                <div class="chat-name">${
                                  chat.name ||
                                  chat.username ||
                                  `${chat.address.slice(
                                    0,
                                    8
                                  )}...${chat.address.slice(-6)}`
                                }</div>
                                <div class="chat-time">${formatTime(
                                  chat.timestamp
                                )}</div>
                            </div>
                            <div class="chat-message">
                                ${chat.my ? "You: " : ""}${chat.message}
                                ${
                                  chat.unread
                                    ? `<span class="chat-unread">${chat.unread}</span>`
                                    : ""
                                }
                            </div>
                        </div>
                    </li>
                `;
    })
  );

  chatList.innerHTML = chatItems.join("");

  // Add click handlers to chat items
  document.querySelectorAll(".chat-item").forEach((item, index) => {
    item.onclick = () => openChatModal(chatsData.chats[index]);
  });
}

// Function to load account data into form
function loadAccountFormData() {
  const savedData = parse(localStorage.getItem("accountData") || "{}");
  document.getElementById("name").value = savedData.name || "";
  document.getElementById("phone").value = savedData.phone || "";
  document.getElementById("gender").value = savedData.gender || "";
  document.getElementById("bio").value = savedData.bio || "";
}

const checkAccountCreation = async (username) => {
  let retries = 0;
  const maxRetries = 20;
  let created = false;

  while (retries < maxRetries) {
    const res = await checkUsernameAvailability(username);
    if (res == "taken") {
      created = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    retries++;
  }
  return created;
};

cons;

async function updateWalletBalances() {
  if (!myAccount || !myData || !myData.wallet || !myData.wallet.assets) {
    console.error("No wallet data available");
    return;
  }
  if (!myData.wallet.timestamp) {
    myData.wallet.timestamp = 0;
  }
  if (Date.now() - myData.wallet.timestamp < 5000) {
    return;
  }

  let totalWalletBalance = 0;

  // Update balances for each asset and address
  for (const asset of myData.wallet.assets) {
    let assetTotalBalance = 0;

    // Get balance for each address in the asset
    for (const addr of asset.addresses) {
      try {
        const address = longAddress(addr.address);
        const accountData = await makeJsonRpcRequest(LIB_RPC_METHODS.GET_ACCOUNT, [address]);
        
        if (accountData && accountData.balance) {
          // Update address balance
          addr.balance = hex2big(accountData.balance.value) || 0;

          // Add to asset total (convert to USD using asset price)
          const balanceUSD = bigxnum2num(addr.balance, asset.price);
          assetTotalBalance += balanceUSD;
        }
      } catch (error) {
        console.error(
          `Error fetching balance for address ${addr.address}:`,
          error
        );
      }
    }
    asset.balance = assetTotalBalance;

    // Add this asset's total to wallet total
    totalWalletBalance += assetTotalBalance;
  }

  // Update total wallet balance
  myData.wallet.balance = totalWalletBalance;
  myData.wallet.timestamp = Date.now();
}

function switchView(view) {
  // Add active class to selected nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    if (item.textContent.trim().toLowerCase().trim() === view)
      item.classList.toggle("active", true);
    else item.classList.toggle("active", false);
  });

  // Hide all screens
  document.querySelectorAll(".app-screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  // Show selected screen
  document.getElementById(`${view}Screen`).classList.add("active");

  // Show header and footer
  document.getElementById("header").classList.add("active");
  document.getElementById("footer").classList.add("active");

  // Show header and footer
  document.getElementById("header").classList.add("active");
  document.getElementById("footer").classList.add("active");

  // Update header with username if signed in
  const appName = document.querySelector(".app-name");
  if (myAccount && myAccount.username) {
    // appName.textContent = `Liberdus - ${myAccount.username}`;
    // Display the view name, Make sure to display the 1st letter in uppercase
    appName.textContent = view.charAt(0).toUpperCase() + view.slice(1);

    if (view === "chats" || view === "contacts") {
      // Make the search bar visible
      document.getElementById("searchBar").style.display = "flex";
      const searchInput = document.getElementById("searchInput");
      searchInput.placeholder = `Search ${
        view === "chats" ? "messages" : "contacts"
      }...`;
    } else {
      // Hide the search bar
      document.getElementById("searchBar").style.display = "none";
    }
  } else {
    appName.textContent = "Liberdus";
  }

  // Show/hide new chat button
  const newChatButton = document.getElementById("newChatButton");
  if (view === "chats") {
    newChatButton.classList.add("visible");
  } else {
    newChatButton.classList.remove("visible");
  }

  // Update lists when switching views
  if (view === "chats") {
    updateChatList();
  } else if (view === "contacts") {
    updateContactsList();
  } else if (view === "wallet") {
    updateWalletView();
  }

  // Update nav button states
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.remove("active");
    if (button.textContent.toLowerCase() === view) {
      button.classList.add("active");
    }
  });
}

// Toast notification function
function showToast(message, duration = 3000) {
  // Remove existing toast if any
  const existingToast = document.querySelector(".toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Hide and remove toast after duration
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// Update contacts list UI
async function updateContactsList() {
  const contactsList = document.getElementById("contactsList");
  //            const chatsData = JSON.parse(localStorage.getItem('chatsData') || '{"contacts":{}}');
  const chatsData = myData;
  const contacts = chatsData.contacts;

  if (Object.keys(contacts).length === 0) {
    contactsList.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size: 2rem; margin-bottom: 1rem">👥</div>
                        <div style="font-weight: bold; margin-bottom: 0.5rem">No Contacts Yet</div>
                        <div>Your contacts will appear here</div>
                    </div>`;
    return;
  }

  const contactsArray = Object.values(contacts);
  const contactItems = await Promise.all(
    contactsArray.map(async (contact) => {
      const identicon = await generateIdenticon(contact.address);
      return `
                    <li class="chat-item">
                        <div class="chat-avatar">${identicon}</div>
                        <div class="chat-content">
                            <div class="chat-header">
                                <div class="chat-name">${
                                  contact.name ||
                                  contact.username ||
                                  `${contact.address.slice(
                                    0,
                                    8
                                  )}...${contact.address.slice(-6)}`
                                }</div>
                            </div>
                            <div class="chat-message">
                                ${
                                  contact.email ||
                                  contact.x ||
                                  contact.phone ||
                                  contact.address
                                }
                            </div>
                        </div>
                    </li>
                `;
    })
  );

  contactsList.innerHTML = contactItems.join("");

  // Add click handlers to contact items
  document
    .querySelectorAll("#contactsList .chat-item")
    .forEach((item, index) => {
      item.onclick = () => openChatModal(contactsArray[index]);
    });
}

function toggleMenu() {
  document.getElementById("menuModal").classList.toggle("active");
  document.getElementById("accountModal").classList.remove("active");
}

function openAccountForm() {
  document.getElementById("accountModal").classList.add("active");
}

function closeAccountForm() {
  document.getElementById("accountModal").classList.remove("active");
}

function openExportForm() {
  document.getElementById("exportModal").classList.add("active");
}

function closeExportForm() {
  document.getElementById("exportModal").classList.remove("active");
}

// Convert ArrayBuffer to Base64 string
function ab2base64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 string to ArrayBuffer
function base642ab(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive key from password using PBKDF2
async function deriveKey(password, salt, iterations = 100000) {
  const passwordBuffer = str2ab(password);
  const importedKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    importedKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Decrypt data using AES-GCM
async function decryptData(encryptedData, password) {
  const { salt, iv, content } = parse(encryptedData);

  // Convert Base64 strings back to ArrayBuffers
  const saltBuffer = base642ab(salt);
  const ivBuffer = base642ab(iv);
  const contentBuffer = base642ab(content);

  // Derive key from password
  const key = await deriveKey(password, saltBuffer);

  // Decrypt the data
  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
    },
    key,
    contentBuffer
  );

  // Convert decrypted ArrayBuffer to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedContent);
}

// Check if data is encrypted by attempting to parse it as encryption envelope
function isEncryptedData(data) {
  try {
    const parsed = parse(data);
    return (
      parsed.hasOwnProperty("salt") &&
      parsed.hasOwnProperty("iv") &&
      parsed.hasOwnProperty("content")
    );
  } catch {
    return false;
  }
}

function openImportFileModal() {
  document.getElementById("importModal").classList.add("active");
}

function closeImportFileModal() {
  document.getElementById("importModal").classList.remove("active");
}

async function handleImportFile(event) {
  event.preventDefault();
  const fileInput = document.getElementById("importFile");
  const passwordInput = document.getElementById("importPassword");
  const messageElement = document.getElementById("importMessage");

  try {
    // Read the file
    const file = fileInput.files[0];
    let fileContent = await file.text();

    let jsonData;
    // Check if data is encrypted and decrypt if necessary
    if (isEncryptedData(fileContent)) {
      if (!passwordInput.value) {
        throw new Error("Password required for encrypted data");
      }
      fileContent = await decryptData(fileContent, passwordInput.value);
    }
    jsonData = parse(fileContent);

    /*                
                // Store the data in localStorage
                if (jsonData.account) {
                    localStorage.setItem('accountData', stringify(jsonData.account));
                }
                if (jsonData.network) {
                    localStorage.setItem('networkData', stringify(jsonData.network));
                }
                if (jsonData.wallet) {
                    localStorage.setItem('walletData', stringify(jsonData.wallet));
                }
                // Store chats data directly from the imported file
                localStorage.setItem('chatsData', stringify({
                    chats: jsonData.chats || [],
                    contacts: jsonData.contacts || {},
                    unread: jsonData.unread || 0
                }));
*/
    // We first parse to jsonData so that if the parse does not work we don't destroy myData
    myData = parse(fileContent);
    // also need to set myAccount
    myAccount = myData.account;
    // Get existing accounts or create new structure
    const existingAccounts = parse(
      localStorage.getItem("accounts") || '{"netids":{}}'
    );
    // Store updated accounts back in localStorage
    existingAccounts.netids[myAccount.netid].usernames[myAccount.username] =
      myAccount;
    localStorage.setItem("accounts", stringify(existingAccounts));

    // Refresh form data and chat list
    loadAccountFormData();
    updateChatList();

    // Show success message
    messageElement.textContent = "Data imported successfully!";
    messageElement.classList.add("active");

    // Reset form and close modal after delay
    setTimeout(() => {
      messageElement.classList.remove("active");
      closeImportFileModal();
      fileInput.value = "";
      passwordInput.value = "";
    }, 2000);
  } catch (error) {
    messageElement.textContent =
      error.message || "Import failed. Please check file and password.";
    messageElement.style.color = "#dc3545";
    messageElement.classList.add("active");
    setTimeout(() => {
      messageElement.classList.remove("active");
      messageElement.style.color = "#28a745";
    }, 3000);
  }
}

// Encrypt data using AES-GCM
async function encryptData(data, password) {
  if (!password) return data;

  // Generate salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt the data
  const encodedData = str2ab(data);
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedData
  );

  // Combine the salt, IV, and encrypted content
  const encryptedData = {
    salt: ab2base64(salt),
    iv: ab2base64(iv),
    content: ab2base64(encryptedContent),
  };

  return stringify(encryptedData);
}

async function handleExport(event) {
  event.preventDefault();

  /*            
            // Collect all data from localStorage
            const chatsData = JSON.parse(localStorage.getItem('chatsData') || '{"chats":[],"contacts":{},"unread":0}');
            const exportData = {
                timestamp: new Date().toISOString(),
                account: JSON.parse(localStorage.getItem('accountData') || '{}'),
                network: JSON.parse(localStorage.getItem('networkData') || '{}'),
                wallet: JSON.parse(localStorage.getItem('walletData') || '{}'),
                chats: chatsData.chats || [],
                contacts: chatsData.contacts || {},
                unread: chatsData.unread || 0
            };
*/

  const password = document.getElementById("exportPassword").value;
  const jsonData = stringify(myData, null, 2);

  try {
    // Encrypt data if password is provided
    const finalData = password
      ? await encryptData(jsonData, password)
      : jsonData;

    // Create and trigger download
    const blob = new Blob([finalData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `app-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close export modal
    closeExportForm();
  } catch (error) {
    console.error("Encryption failed:", error);
    alert("Failed to encrypt data. Please try again.");
  }
}

function openNewChatModal() {
  document.getElementById("newChatModal").classList.add("active");
  document.getElementById("newChatButton").classList.remove("visible");
}

function closeNewChatModal() {
  document.getElementById("newChatModal").classList.remove("active");
  document.getElementById("newChatForm").reset();
  if (document.getElementById("chatsScreen").classList.contains("active")) {
    document.getElementById("newChatButton").classList.add("visible");
  }
}

// Validate Ethereum address format
function isValidEthereumAddress(address) {
  if (!address.startsWith("0x")) return false;
  if (address.length !== 42) return false;
  // Check if the address contains only valid hex characters after 0x
  const hexRegex = /^0x[0-9a-fA-F]{40}$/;
  return hexRegex.test(address);
}

// Show error message in the new chat form
function showRecipientError(message) {
  const errorElement = document.getElementById("recipientError");
  errorElement.textContent = message;
  errorElement.style.color = "#dc3545"; // Always red for errors
  errorElement.style.display = "inline";
}

// Validate recipient in send modal
async function handleSendToAddressValidation(e) {
  const input = e.target.value.trim();
  const errorElement = document.getElementById("sendToAddressError");

  // Clear previous error
  errorElement.style.display = "none";

  if (!input) return;

  // Check if input is an Ethereum address
  if (input.startsWith("0x")) {
    if (!isValidEthereumAddress(input)) {
      errorElement.textContent = "Invalid address format";
      errorElement.style.color = "#dc3545";
      errorElement.style.display = "inline";
    }
    return;
  }

  // If not an address, treat as username
  if (input.length < 3) {
    errorElement.textContent = "Username too short";
    errorElement.style.color = "#dc3545";
    errorElement.style.display = "inline";
    return;
  }

  // Check username availability on network
  const taken = await checkUsernameAvailability(input);
  if (taken === "taken") {
    errorElement.textContent = "found";
    errorElement.style.color = "#28a745";
    errorElement.style.display = "inline";
  } else if (taken === "available") {
    errorElement.textContent = "not found";
    errorElement.style.color = "#dc3545";
    errorElement.style.display = "inline";
  } else {
    errorElement.textContent = "network error";
    errorElement.style.color = "#dc3545";
    errorElement.style.display = "inline";
  }
}

// Hide error message in the new chat form
function hideRecipientError() {
  const errorElement = document.getElementById("recipientError");
  errorElement.style.display = "none";
}

async function handleNewChat(event) {
  event.preventDefault();
  const input = document.getElementById("recipient").value.trim();
  let recipientAddress;

  hideRecipientError();

  // Check if input is an Ethereum address
  if (input.startsWith("0x")) {
    if (!isValidEthereumAddress(input)) {
      showRecipientError("Invalid Ethereum address format");
      return;
    }
    // Input is valid Ethereum address, normalize it
    recipientAddress = normalizeAddress(input);
  } else {
    if (input.length < 3) {
      showRecipientError("Username too short");
      return;
    }

    // Treat as username and lookup address
    const usernameBytes = utf82bin(input);
    const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);

    try {
      const accountData = await makeJsonRpcRequest(LIB_RPC_METHODS.GET_ACCOUNT, [usernameHash]);

      if (!accountData || !accountData.address) {
        showRecipientError("Username not found");
        return;
      }
      // Normalize address from account data if it has 0x prefix or trailing zeros
      recipientAddress = normalizeAddress(accountData.address);
    } catch (error) {
      console.log("Error looking up username:", error);
      showRecipientError("Error looking up username");
      return;
    }
  }

  // Get or create chat data
  //            const chatsData = JSON.parse(localStorage.getItem('chatsData') || '{"chats":[],"contacts":{},"unread":0}');
  const chatsData = myData;

  // Check if contact exists
  if (!chatsData.contacts[recipientAddress]) {
    // Create new contact
    chatsData.contacts[recipientAddress] = {
      address: recipientAddress,
      username: !input.startsWith("0x") ? input : undefined,
      messages: [],
      timestamp: Date.now(),
    };
  }

  // Add to chats if not already present
  const existingChat = chatsData.chats.find(
    (chat) => chat.address === recipientAddress
  );
  if (!existingChat) {
    chatsData.chats.unshift({
      address: recipientAddress,
      username: !input.startsWith("0x") ? input : undefined,
      timestamp: Date.now(),
      message: "Start a conversation",
      unread: 0,
    });
  }

  // Close new chat modal and open chat modal
  closeNewChatModal();
  openChatModal(chatsData.contacts[recipientAddress]);
}

function openChatModal(chat) {
  const modal = document.getElementById("chatModal");
  const modalAvatar = modal.querySelector(".modal-avatar");
  const modalTitle = modal.querySelector(".modal-title");
  const messagesList = modal.querySelector(".messages-list");
  document.getElementById("newChatButton").classList.remove("visible");

  // Set user info
  modalTitle.textContent =
    chat.name ||
    chat.username ||
    `${chat.address.slice(0, 8)}...${chat.address.slice(-6)}`;
  generateIdenticon(chat.address, 40).then((identicon) => {
    modalAvatar.innerHTML = identicon;
  });

  // Get messages from contacts data
  //            const chatsData = JSON.parse(localStorage.getItem('chatsData') || '{}');
  const chatsData = myData;
  const contact = chatsData.contacts?.[chat.address];
  const messages = contact?.messages || [];

  // Display messages
  messagesList.innerHTML = messages
    .map(
      (msg) => `
                <div class="message ${msg.my ? "sent" : "received"}">
                    <div class="message-content">${msg.message}</div>
                    <div class="message-time">${formatTime(msg.timestamp)}</div>
                </div>
            `
    )
    .join("");

  // Scroll to bottom
  setTimeout(() => {
    messagesList.parentElement.scrollTop =
      messagesList.parentElement.scrollHeight;
  }, 100);

  // Show modal
  modal.classList.add("active");

  // Clear unread count
  if (chatsData.state.unread) {
    chatsData.state.unread = 0;
    chatsData.state.unread = Math.max(
      0,
      (chatsData.state.unread || 0) - chat.unread
    );
    //                localStorage.setItem('chatsData', JSON.stringify(chatsData));
    updateChatList();
  }
}

function closeChatModal() {
  document.getElementById("chatModal").classList.remove("active");
  if (document.getElementById("chatsScreen").classList.contains("active")) {
    document.getElementById("newChatButton").classList.add("visible");
  }
}

function openReceiveModal() {
  const modal = document.getElementById("receiveModal");
  modal.classList.add("active");

  // Get wallet data
  //            const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;

  // Populate assets dropdown
  const assetSelect = document.getElementById("receiveAsset");
  assetSelect.innerHTML = walletData.assets
    .map(
      (asset, index) =>
        `<option value="${index}">${asset.name} (${asset.symbol})</option>`
    )
    .join("");

  // Update addresses for first asset
  updateReceiveAddresses();
}

function closeReceiveModal() {
  document.getElementById("receiveModal").classList.remove("active");
}

function updateReceiveAddresses() {
  //            const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;
  const assetIndex = document.getElementById("receiveAsset").value;
  const addressSelect = document.getElementById("receiveAddress");

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    addressSelect.innerHTML =
      '<option value="">No addresses available</option>';
    return;
  }

  const asset = walletData.assets[assetIndex];

  // Check if asset exists and has addresses
  if (!asset || !asset.addresses || asset.addresses.length === 0) {
    addressSelect.innerHTML =
      '<option value="">No addresses available</option>';
    return;
  }

  // Populate addresses dropdown
  addressSelect.innerHTML = asset.addresses
    .map((addr, index) => `<option value="${index}">${addr.address}</option>`)
    .join("");

  // Update display address
  updateDisplayAddress();
}

function updateDisplayAddress() {
  //            const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;

  const assetIndex = document.getElementById("receiveAsset").value;
  const addressIndex = document.getElementById("receiveAddress").value;
  const displayAddress = document.getElementById("displayAddress");
  const qrcodeContainer = document.getElementById("qrcode");

  // Clear previous QR code
  qrcodeContainer.innerHTML = "";

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    displayAddress.textContent = "No address available";
    return;
  }

  const asset = walletData.assets[assetIndex];

  // Check if asset exists and has addresses
  if (!asset || !asset.addresses || asset.addresses.length === 0) {
    displayAddress.textContent = "No address available";
    return;
  }

  const address = asset.addresses[addressIndex].address;
  displayAddress.textContent = "0x" + address;

  // Update QR code
  new QRCode(qrcodeContainer, {
    text: "0x" + address,
    width: 200,
    height: 200,
  });
}

async function copyAddress() {
  const address = document.getElementById("displayAddress").textContent;
  try {
    await navigator.clipboard.writeText(address);
    const button = document.getElementById("copyAddress");
    button.textContent = "✓";
    setTimeout(() => {
      button.textContent = "📋";
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function openSendModal() {
  const modal = document.getElementById("sendModal");
  modal.classList.add("active");

  // Get wallet data
  //            const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;

  // Populate assets dropdown
  const assetSelect = document.getElementById("sendAsset");
  assetSelect.innerHTML = walletData.assets
    .map(
      (asset, index) =>
        `<option value="${index}">${asset.name} (${asset.symbol})</option>`
    )
    .join("");

  // Update addresses for first asset
  updateSendAddresses();
}

function closeSendModal() {
  document.getElementById("sendModal").classList.remove("active");
  document.getElementById("sendForm").reset();
}

function updateSendAddresses() {
  //                    const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;
  const assetIndex = document.getElementById("sendAsset").value;
  const addressSelect = document.getElementById("sendFromAddress");

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    addressSelect.innerHTML =
      '<option value="">No addresses available</option>';
    updateAvailableBalance();
    return;
  }

  const asset = walletData.assets[assetIndex];

  // Check if asset exists and has addresses
  if (!asset || !asset.addresses || asset.addresses.length === 0) {
    addressSelect.innerHTML =
      '<option value="">No addresses available</option>';
    updateAvailableBalance();
    return;
  }

  // Populate addresses dropdown
  addressSelect.innerHTML = asset.addresses
    .map(
      (addr, index) =>
        `<option value="${index}">${addr.address} (${big2num(
          addr.balance / wei
        ).toFixed(2)} ${asset.symbol})</option>`
    )
    .join("");

  // Update available balance display
  updateAvailableBalance();
}

function updateAvailableBalance() {
  //                    const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;
  const assetIndex = document.getElementById("sendAsset").value;
  const addressIndex = document.getElementById("sendFromAddress").value;
  const balanceAmount = document.getElementById("balanceAmount");
  const balanceSymbol = document.getElementById("balanceSymbol");

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    balanceAmount.textContent = "0.00";
    balanceSymbol.textContent = "";
    return;
  }

  const asset = walletData.assets[assetIndex];

  // Check if asset exists and has addresses
  if (!asset || !asset.addresses || asset.addresses.length === 0) {
    balanceAmount.textContent = "0.00";
    balanceSymbol.textContent = asset ? asset.symbol : "";
    return;
  }

  const fromAddress = asset.addresses[addressIndex];
  if (!fromAddress) {
    balanceAmount.textContent = "0.00";
    balanceSymbol.textContent = asset.symbol;
    return;
  }

  balanceAmount.textContent = big2num(fromAddress.balance).toFixed(2);
  balanceSymbol.textContent = asset.symbol;
}

function fillAmount() {
  const amount = document.getElementById("balanceAmount").textContent;
  document.getElementById("sendAmount").value = amount;
}

async function handleSend(event) {
  event.preventDefault();

  const walletData = myData.wallet;
  const assetIndex = document.getElementById("sendAsset").value;
  const addressIndex = document.getElementById("sendFromAddress").value;
  const asset = walletData.assets[assetIndex];
  const fromAddress = asset.addresses[addressIndex];
  const amount = bigxnum2big(
    wei,
    parseFloat(document.getElementById("sendAmount").value)
  );
  const recipientInput = document.getElementById("sendToAddress").value.trim();
  const memo = document.getElementById("sendMemo").value || "";
  let toAddress;

  // Validate amount
  if (amount > fromAddress.balance) {
    alert("Insufficient balance");
    return;
  }

  // Handle recipient input - could be username or address
  if (recipientInput.startsWith("0x")) {
    if (!isValidEthereumAddress(recipientInput)) {
      alert("Invalid address format");
      return;
    }
    toAddress = normalizeAddress(recipientInput);
  } else {
    if (recipientInput.length < 3) {
      alert("Username too short");
      return;
    }

    // Look up username using RPC
    const usernameBytes = utf82bin(recipientInput);
    const usernameHash = blake.blake2bHex(usernameBytes, myHashKey, 32);

    try {
      const accountData = await makeJsonRpcRequest(LIB_RPC_METHODS.GET_ACCOUNT, [usernameHash]);

      if (!accountData || !accountData.address) {
        alert("Username not found");
        return;
      }
      toAddress = normalizeAddress(accountData.address);
    } catch (error) {
      console.error("Error looking up username:", error);
      alert("Error looking up username");
      return;
    }
  }

  // Get sender's keys from wallet
  const keys = walletData.keys[fromAddress.address];
  if (!keys) {
    alert("Keys not found for sender address");
    return;
  }

  // Change Send button text to "Sending..."
  const sendButton = document.querySelector(
    '#sendForm button[type="submit"]'
  )
  sendButton.textContent = "Sending...";
  sendButton.disabled = true;

  try {
    // Send the transaction using postTransferAsset
    const response = await postTransferAsset(toAddress, amount, memo, keys);

    // Update this check to match the RPC response format
    if (!response || !response.success) {
      console.error("Transaction failed:", response?.reason);
      sendButton.textContent = "Send";
      sendButton.disabled = false;
      showToast("Transaction failed. Please try again.");
      // alert("Transaction failed: " + response.result.reason);

      return;
    }

    // Don't try to update the balance here; the tx might not have gone through; let user refresh the balance from the wallet page
    /*
                // Update local balance after successful transaction
                fromAddress.balance -= amount;
                walletData.balance = walletData.assets.reduce((total, asset) =>
                    total + asset.addresses.reduce((sum, addr) => sum + bigxnum2num(addr.balance, asset.price), 0), 0);

                // Update wallet view and close modal
                updateWalletView();
*/
    showToast("Transaction submitted, waiting it to be processed");
    sendButton.textContent = "Send";
    sendButton.disabled = false;
    closeSendModal();
  } catch (error) {
    console.error("Transaction error:", error);
    sendButton.textContent = "Send";
    sendButton.disabled = false;
    showToast("Transaction failed. Please try again.");
  }
}

function handleSignOut() {
  // Save myData to localStorage if it exists
  if (myData && myAccount) {
    localStorage.setItem(
      `${myAccount.username}_${myAccount.netid}`,
      stringify(myData)
    );
  }

  // Close all modals
  document.getElementById("menuModal").classList.remove("active");
  document.getElementById("accountModal").classList.remove("active");

  // Hide header and footer
  document.getElementById("header").classList.remove("active");
  document.getElementById("footer").classList.remove("active");
  document.getElementById("newChatButton").classList.remove("visible");

  // Reset header text
  document.querySelector(".app-name").textContent = "Liberdus";

  // Hide all app screens
  document.querySelectorAll(".app-screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  // Show welcome screen
  document.getElementById("welcomeScreen").style.display = "flex";

  // Reload the page to get fresh welcome page
  window.location.reload();
}

// Handle sending a message
async function handleSendMessage() {
  const messageInput = document.querySelector(".message-input");
  const message = messageInput.value.trim();
  if (!message) return;

  const modal = document.getElementById("chatModal");
  const modalTitle = modal.querySelector(".modal-title");
  const messagesList = modal.querySelector(".messages-list");

  // Get current chat data
  const chatsData = myData;
  const currentAddress = Object.values(chatsData.contacts).find(
    (contact) =>
      modalTitle.textContent ===
      (contact.name ||
        contact.username ||
        `${contact.address.slice(0, 8)}...${contact.address.slice(-6)}`)
  )?.address;

  if (!currentAddress) return;

  // Get sender's keys from wallet
  const keys = myAccount.keys;
  if (!keys) {
    alert("Keys not found for sender address");
    return;
  }

  try {
    // Create message payload
    const payload = {
      message: message,
      encrypted: false,
      encryptionMethod: "none",
      sent_timestamp: Date.now(),
    };
    console.log("payload is", payload);
    // Send the message transaction using postSendMessage with default toll of 1
    const response = await postSendMessage(currentAddress, payload, 1, keys);

    if (!response || !response.success) {
      alert(
        "Message failed to send: " +
          (response?.reason || "Unknown error")
      );
      return;
    }

    // Create new message
    const newMessage = {
      message,
      timestamp: Date.now(),
      sent_timestamp: Date.now(),
      my: true,
    };

    // Update contacts messages
    if (!chatsData.contacts[currentAddress].messages) {
      chatsData.contacts[currentAddress].messages = [];
    }
    chatsData.contacts[currentAddress].messages.push(newMessage);

    // Update or add to chats list
    const existingChatIndex = chatsData.chats.findIndex(
      (chat) => chat.address === currentAddress
    );
    const chatUpdate = {
      ...chatsData.contacts[currentAddress],
      message,
      timestamp: newMessage.timestamp,
      my: true,
      unread: 0,
    };

    // Remove existing chat if present
    if (existingChatIndex !== -1) {
      chatsData.chats.splice(existingChatIndex, 1);
    }
    // Add updated chat to the beginning of the array
    chatsData.chats.unshift(chatUpdate);

    // Add message to UI
    messagesList.insertAdjacentHTML(
      "beforeend",
      `
                    <div class="message sent">
                        <div class="message-content" style="white-space: pre-wrap">${message}</div>
                        <div class="message-time">${formatTime(
                          newMessage.timestamp
                        )}</div>
                    </div>
                `
    );

    // Clear input and reset height
    messageInput.value = "";
    messageInput.style.height = "45px";

    // Scroll to bottom
    messagesList.parentElement.scrollTop =
      messagesList.parentElement.scrollHeight;

    // Update chat list if visible
    if (document.getElementById("chatsScreen").classList.contains("active")) {
      updateChatList();
    }
  } catch (error) {
    console.error("Message error:", error);
    alert("Failed to send message. Please try again.");
  }
}

// Update wallet view
function updateWalletView() {
  //            const walletData = JSON.parse(localStorage.getItem('walletData') || '{"balance":0,"assets":[]}');
  const walletData = myData.wallet;

  // Update total balance
  document.getElementById("walletTotalBalance").textContent = (
    walletData.balance || 0
  ).toFixed(2);

  // Update assets list
  const assetsList = document.getElementById("assetsList");

  if (!Array.isArray(walletData.assets) || walletData.assets.length === 0) {
    assetsList.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size: 2rem; margin-bottom: 1rem">💰</div>
                        <div style="font-weight: bold; margin-bottom: 0.5rem">No Assets Yet</div>
                        <div>Your assets will appear here</div>
                    </div>`;
    return;
  }

  assetsList.innerHTML = walletData.assets
    .map((asset) => {
      console.log("asset", asset);
      return `
                    <div class="asset-item">
                        <div class="asset-logo">${asset.symbol[0]}</div>
                        <div class="asset-info">
                            <div class="asset-name">${asset.name}</div>
                            <div class="asset-symbol">${asset.symbol}</div>
                        </div>
                        <div class="asset-balance">${asset.balance.toFixed(
                          2
                        )}</div>
                    </div>
                `;
    })
    .join("");
}

function openHistoryModal() {
  const modal = document.getElementById("historyModal");
  modal.classList.add("active");

  // Get wallet data
  //                    const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;

  const assetSelect = document.getElementById("historyAsset");

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    assetSelect.innerHTML = '<option value="">No assets available</option>';
  } else {
    // Populate assets dropdown
    assetSelect.innerHTML = walletData.assets
      .map(
        (asset, index) =>
          `<option value="${index}">${asset.name} (${asset.symbol})</option>`
      )
      .join("");
  }

  // Update addresses for first asset
  updateHistoryAddresses();
}

function closeHistoryModal() {
  document.getElementById("historyModal").classList.remove("active");
}

async function updateHistoryAddresses() {
  //                    const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;

  const assetIndex = document.getElementById("historyAsset").value;
  const addressSelect = document.getElementById("historyAddress");

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    addressSelect.innerHTML =
      '<option value="">No addresses available</option>';
    await updateTransactionHistory();
    return;
  }

  const asset = walletData.assets[assetIndex];

  // Check if asset exists and has addresses
  if (!asset || !asset.addresses || asset.addresses.length === 0) {
    addressSelect.innerHTML =
      '<option value="">No addresses available</option>';
    await updateTransactionHistory();
    return;
  }

  // Populate addresses dropdown
  addressSelect.innerHTML = asset.addresses
    .map((addr, index) => `<option value="${index}">${addr.address}</option>`)
    .join("");

  // Update transaction history
  await updateTransactionHistory();
}

async function updateTransactionHistory() {
  //                    const walletData = JSON.parse(localStorage.getItem('walletData') || '{"assets":[]}');
  const walletData = myData.wallet;

  const assetIndex = document.getElementById("historyAsset").value;
  const addressIndex = document.getElementById("historyAddress").value;
  const transactionList = document.getElementById("transactionList");

  // Check if we have any assets
  if (!walletData.assets || walletData.assets.length === 0) {
    transactionList.innerHTML = `
                            <div class="empty-state">
                                <div style="font-size: 2rem; margin-bottom: 1rem">📜</div>
                                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                                <div>Your transaction history will appear here</div>
                            </div>`;
    return;
  }

  const asset = walletData.assets[assetIndex];

  // Check if asset exists and has addresses
  if (!asset || !asset.addresses || asset.addresses.length === 0) {
    transactionList.innerHTML = `
                            <div class="empty-state">
                                <div style="font-size: 2rem; margin-bottom: 1rem">📜</div>
                                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                                <div>Your transaction history will appear here</div>
                            </div>`;
    return;
  }

  const address = asset.addresses[addressIndex];

  // Fetch transaction history for the selected address
  const result = await makeJsonRpcRequest(
    LIB_RPC_METHODS.GET_TRANSACTION_HISTORY,
    [longAddress(address.address)]
  );

  if (result && result.transactions && result.transactions.length > 0) {
    address.history = result.transactions.map((tx) => {
      return {
        txid: tx.txId,
        amount: Number(tx.amount),
        sign: tx.from === longAddress(address.address) ? -1 : 1,
        timestamp: tx.timestamp,
        address: tx.from === longAddress(address.address) ? tx.to : tx.from,
        memo: tx.memo,
      };
    });
  }

  if (!address || !address.history || address.history.length === 0) {
    transactionList.innerHTML = `
                            <div class="empty-state">
                                <div style="font-size: 2rem; margin-bottom: 1rem">📜</div>
                                <div style="font-weight: bold; margin-bottom: 0.5rem">No Transactions</div>
                                <div>Your transaction history will appear here</div>
                            </div>`;
    return;
  }

  transactionList.innerHTML = address.history
    .map(
      (tx) => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-type ${
                          tx.sign === -1 ? "send" : "receive"
                        }">
                            ${tx.sign === -1 ? "↑ Sent" : "↓ Received"}
                        </div>
                        <div class="transaction-amount">
                            ${tx.sign === -1 ? "-" : "+"} ${tx.amount.toFixed(
        2
      )} ${asset.symbol}
                        </div>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-address">
                            ${tx.sign === -1 ? "To: " : "From: "}${tx.address}
                        </div>
                        <div class="transaction-time">${formatTime(
                          tx.timestamp
                        )}</div>
                    </div>
                    ${
                      tx.memo
                        ? `<div class="transaction-memo">${tx.memo}</div>`
                        : ""
                    }
                </div>
            `
    )
    .join("");
}

function handleAccountUpdate(event) {
  event.preventDefault();

  // TODO need to change this form
  // Get form data
  const formData = {
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    gender: document.getElementById("gender").value,
    bio: document.getElementById("bio").value,
  };

  // Save to localStorage
  //            localStorage.setItem('accountData', JSON.stringify(formData));

  // Show success message
  const successMessage = document.getElementById("successMessage");
  successMessage.classList.add("active");

  // Hide success message after 2 seconds
  setTimeout(() => {
    successMessage.classList.remove("active");
  }, 2000);
}

async function queryNetwork(url) {
  if (!checkOnlineStatus()) {
    console.log("not online");
    return null;
  }
  const randomGateway =
    network.gateways[Math.floor(Math.random() * network.gateways.length)];
  try {
    const response = await fetch(
      `${randomGateway.protocol}://${randomGateway.host}:${randomGateway.port}${url}`
    );
    const data = await response.json();
    console.log("response.json", data);
    return data;
  } catch (error) {
    console.error(`Error fetching balance for address ${addr.address}:`, error);
    return null;
  }
}

async function getChats(keys) {
  if (Date.now() - getChats.lastCall < 5000) {
    return null;
  }
  getChats.lastCall = Date.now();
  const account = await queryNetwork(`/account/${longAddress(keys.address)}`);
  console.log("account", account);
  if (
    account &&
    account.account &&
    account.account.data &&
    account.account.data.chats
  ) {
    processChats(account.account.data.chats, keys);
  }

  return account;
}
getChats.lastCall = 0;

function decryptMessage(payload, keys) {
  // TODO replace payload.message with the decrypted message
  delete payload.encrypted;
  delete payload.encryptionMethod;
  return payload;
}

async function processChats(chats, keys) {
  for (let sender in chats) {
    const res = await queryNetwork(`/messages/${chats[sender]}`);
    console.log("sender", sender);
    if (res && res.messages) {
      const from = normalizeAddress(sender);
      // TODO add to myData
      if (!myData.contacts[from]) {
        myData.contacts[from] = {};
      }
      const contact = myData.contacts[from];
      contact.address = from;
      let added = 0;
      for (let index in res.messages) {
        const payload = parse(res.messages[index]);
        console.log("payload", payload);
        decryptMessage(payload, keys);
        if (!contact.messages) {
          contact.messages = [];
        }
        console.log("contact.message", contact.messages);
        if (contact.messages.length > 0) {
          console.log(
            "comp times <",
            contact.messages.at(-1).sent_timestamp,
            payload.sent_timestamp
          );
        }
        if (
          contact.messages.length == 0 ||
          contact.messages.at(-1).sent_timestamp < payload.sent_timestamp
        ) {
          payload.my = false;
          payload.timestamp = Date.now();
          console.log("pushing", payload);
          contact.messages.push(payload);
          added += 1;
        }
      }
      // If messages were added to contact.messages, update myData.chats
      if (added > 0) {
        // Get the most recent message
        const latestMessage = contact.messages[contact.messages.length - 1];

        // Create chat object with only guaranteed fields
        const chatUpdate = {
          address: from,
          message: latestMessage.message,
          timestamp: latestMessage.timestamp,
          my: latestMessage.my,
          unread: added, // Set to added to indicate how many unread messages were added to this chat
        };

        // Only add optional fields if they exist in contact
        if (contact.username) chatUpdate.username = contact.username;
        if (contact.name) chatUpdate.name = contact.name;
        if (contact.img_url) chatUpdate.img_url = contact.img_url;

        // Remove existing chat for this contact if it exists
        const existingChatIndex = myData.chats.findIndex(
          (chat) => chat.address === from
        );
        if (existingChatIndex !== -1) {
          myData.chats.splice(existingChatIndex, 1);
        }

        // Find insertion point to maintain timestamp order (newest first)
        const insertIndex = myData.chats.findIndex(
          (chat) => chat.timestamp < chatUpdate.timestamp
        );

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

/*
        payload = {
            message: "string; can be encrypted",
            encrypted: true | false,
            encryptionMethod: 'none' | 'aes',
            timestamp: 1736713717000
        }
        */
async function postSendMessage(to, payload, toll, keys) {
  const toAddr = longAddress(to);
  const fromAddr = longAddress(keys.address);

  const tx = {
    type: "message",
    from: fromAddr,
    to: toAddr,
    amount: BigInt(toll),
    //                chatId: crypto.hash([fromAddr, toAddr].sort().join``),
    chatId: blake.blake2bHex([fromAddr, toAddr].sort().join``, myHashKey, 32),
    message: stringify(payload),
    timestamp: Date.now(),
    network: "0000000000000000000000000000000000000000000000000000000000000000",
    //                fee: BigInt(parameters.current.transactionFee || 1)           // we should also add a fee
  };
  const res = await injectTx(tx, keys);
  console.log("res", res);
  return res;
}

async function postTransferAsset(to, amount, memo, keys) {
  // Normalize destination address if it's in Ethereum format
  const normalizedTo = to.startsWith("0x") ? normalizeAddress(to) : to;

  const tx = {
    type: "transfer",
    from: longAddress(keys.address),
    to: longAddress(normalizedTo),
    amount: BigInt(amount),
    //                memo: memo,                      // TODO encrypt the memo
    timestamp: Date.now(),
    network: "0000000000000000000000000000000000000000000000000000000000000000",
    fee: BigInt(parameters.current.transactionFee || 1),
  };
  const res = await injectTx(tx, keys);
  return res;
}

async function postRegisterAlias(alias, keys) {
  const aliasBytes = utf82bin(alias);
  const aliasHash = blake.blake2bHex(aliasBytes, myHashKey, 32);
  const tx = {
    type: "register",
    aliasHash: aliasHash,
    from: longAddress(keys.address),
    alias: alias,
    publicKey: keys.public,
    timestamp: Date.now(),
  };
  const res = await injectTx(tx, keys);
  return res;
}

// Use this function to make addresses 256 bit long before using them in network APIs
// Normalize address to 40 hex characters (no 0x prefix, no trailing zeros)
function normalizeAddress(address) {
  // Remove 0x prefix if present
  address = address.replace(/^0x/, "");
  // Remove trailing zeros
  if (address.length == 64) {
    address = address.replace(/0{24}$/, "");
  }
  // Ensure exactly 40 characters
  if (address.length !== 40) {
    throw new Error("Invalid address length after normalization");
  }
  return address;
}

// Add padding zeros for network API calls
function longAddress(address) {
  // First normalize the address to ensure consistent format
  const normalized = normalizeAddress(address);
  // Then add the required padding for network calls
  return normalized + "0".repeat(24);
}

async function injectTx(tx, keys) {
  const txid = await signObj(tx, keys); // add the sign obj to tx
  
  try {
    const response = await makeJsonRpcRequest(
      LIB_RPC_METHODS.SEND_TRANSACTION,
      [stringify(tx)]
    );
    
    if (response) {
      response.txid = txid;
    }
    return response;
  } catch (error) {
    console.error("Error injecting tx:", error, tx);
    return error;
  }
}

async function signObj(tx, keys) {
  const jstr = stringify(tx);
  console.log("tx stringify", jstr);
  const jstrBytes = utf82bin(jstr);
  const txidHex = blake.blake2bHex(jstrBytes, myHashKey, 32);
  const txidHashHex = ethHashMessage(txidHex); // TODO - ask Thant why we are doing this

  const sig = await secp.signAsync(hex2bin(txidHashHex), hex2bin(keys.secret));
  const r = sig.r.toString(16).padStart(64, "0");
  const s = sig.s.toString(16).padStart(64, "0");
  // Convert recovery to hex and append (27 + recovery)
  const v = (27 + sig.recovery).toString(16).padStart(2, "0");
  // Concatenate everything with 0x prefix
  const flatSignature = `0x${r}${s}${v}`;
  tx.sign = {
    owner: longAddress(keys.address),
    sig: flatSignature,
  };
  return txidHex;
}

function bin2hex(bin) {
  return Array.from(bin)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function hex2bin(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}
function utf82bin(str) {
  return blake.utf8ToBytes(str);
}
function hex2big(hexString) {
  const cleanHex = hexString.replace("0x", "");
  return BigInt("0x" + cleanHex);
}
function big2num(bigIntNum) {
  // Handle special cases
  if (bigIntNum === 0n) return 0;

  // Get the sign
  const isNegative = bigIntNum < 0n;
  const absValue = isNegative ? -bigIntNum : bigIntNum;

  // Convert to string and get length
  const str = absValue.toString();
  const length = str.length;

  if (length <= 15) {
    // For smaller numbers, direct conversion is safe
    return isNegative ? -Number(str) : Number(str);
  }

  // For larger numbers, use scientific notation approach
  const firstFifteen = str.slice(0, 15);
  const remainingDigits = length - 15;

  // Combine with appropriate scaling
  const result = Number(firstFifteen) * Math.pow(10, remainingDigits);

  return isNegative ? -result : result;
}
// Based on what ethers.js is doing in the following code
// hashMessage() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/hash/message.ts#L35
// concat() https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/utils/data.ts#L116
// MessagePrefix https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/constants/strings.ts#L16
// keccak256 https://github.com/ethers-io/ethers.js/blob/22c081e1cd617b43d267fd4b29cd92ada5fc7e43/src.ts/crypto/keccak.ts#L44
// input message can be string or binary; output is hex; binary means Uint8Array
function ethHashMessage(message) {
  if (typeof message === "string") {
    message = utf82bin(message);
  }
  const MessagePrefix = "\x19Ethereum Signed Message:\n";
  const str =
    bin2hex(utf82bin(MessagePrefix)) +
    bin2hex(utf82bin(String(message.length))) +
    bin2hex(message);
  return bin2hex(keccak256(hex2bin(str)));
}

function bigxnum2big(bigIntNum, floatNum) {
  // Convert float to string to handle decimal places
  const floatStr = floatNum.toString();

  // Find number of decimal places
  const decimalPlaces = floatStr.includes(".")
    ? floatStr.split(".")[1].length
    : 0;

  // Convert float to integer by multiplying by 10^decimalPlaces
  const floatAsInt = Math.round(floatNum * Math.pow(10, decimalPlaces));

  // Multiply and adjust for decimal places
  const result =
    (bigIntNum * BigInt(floatAsInt)) / BigInt(Math.pow(10, decimalPlaces));

  return result;
}

function bigxnum2num(bigIntNum, floatNum) {
  // Handle edge cases
  if (floatNum === 0) return 0;
  if (bigIntNum === 0n) return 0;

  // Convert BigInt to scientific notation string to handle large numbers
  const bigIntStr = bigIntNum.toString();
  const bigIntLength = bigIntStr.length;

  // Break the bigint into chunks to maintain precision
  const chunkSize = 15; // Safe size for float precision
  const chunks = [];

  for (let i = bigIntStr.length; i > 0; i -= chunkSize) {
    const start = Math.max(0, i - chunkSize);
    chunks.unshift(Number(bigIntStr.slice(start, i)));
  }

  // Multiply each chunk and combine results
  let result = 0;
  for (let i = 0; i < chunks.length; i++) {
    const multiplier = Math.pow(10, chunkSize * i);
    result += chunks[i] * floatNum * multiplier;
  }

  return result;
}

async function makeJsonRpcRequest(method, params = []) {
  const requestBody = {
    jsonrpc: "2.0",
    method,
    params,
    id: 1,
  };

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  };

  const randomRPCServer =
    network.rpc_server[Math.floor(Math.random() * network.rpc_server.length)];
  const url = `${randomRPCServer.protocol}://${randomRPCServer.host}:${randomRPCServer.port}`;

  console.log("RPC Request:", url, method, params);

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      // Special handling for "Account not found" error
      if (data.error.code === -32600 && data.error.message.includes("Account not found")) {
        console.warn("Account not found");
        return null;  // Return null for non-existent accounts
      }
      console.error("RPC Error:", method, data.error);
      return null;
    }

    console.log("RPC Result:", method, data.result);
    return parse(stringify(data.result));
  } catch (error) {
    console.error("RPC Request failed:", method, error);
    return null;
  }
}
