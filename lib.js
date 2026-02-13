/**
 * Normalizes a username string. Keeps only letters and numbers; lowercase all letters; limit to 15 characters.
 * @param {string} u - The string to normalize.
 * @returns {string} - The normalized string.
 */
export function normalizeUsername(u){
    const normalized = u.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return normalized.substring(0, 15);
}

/**
 * Normalizes a string to a name. Keeps only alphabet and space characters; lowercase all letters; capitalize the first letter of each word.
 * @param {string} s - The string to normalize.
 * @param {boolean} final - Whether to apply strict validation rules.
 * @returns {string} - The normalized string.
 */
export function normalizeName(s, final = false) {
    if (!s) return '';
    let normalized = s
      .replace(/[^a-zA-Z\s]/g, '') // keep only alphabet and space characters
      .replace(/\s+/g, ' ')
      .toLowerCase() // lowercase all letters
      .replace(/\b\w/g, c => c.toUpperCase()) // capitalize first letter of each word
      .substring(0, 20); // limit to 20 characters
    
    if (final) {
      normalized = normalized.replace(/\s+$/g, '');
    }
    return normalized;
  }

// Convert string to Uint8Array for hashing
export function str2ab(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

/**
 * Normalizes a string to a phone number. Keeps only digits; limit to 20 characters; if final is true, wipe out if less than 7 digits.
 * @param {string} s - The string to normalize.
 * @param {boolean} final - Whether to apply strict validation rules.
 * @returns {string} - The normalized string.
 */
export function normalizePhone(s, final = false) {
    if (!s) return '';
    // remove all non-digit characters
    let normalized = s.replace(/\D/g, '');
    // limit to 20 characters
    normalized = normalized.substring(0, 20);
    // if final is true, wipe out if less than 7 digits
    if (final && normalized.length < 7) {
        normalized = '';
    }
    return normalized;
}

/**
 * Normalizes a string to an email address. Keeps only lowercase letters, numbers, and allowed special characters; limit to 256 characters.
 * @param {string} s - The string to normalize.
 * @returns {string} - The normalized string.
 */
export function normalizeEmail(s) {
    if (!s) return '';
    // Convert to lowercase
    s = s.toLowerCase();
    // Remove any whitespace
    s = s.trim();
    // Keep only valid email characters
    s = s.replace(/[^a-z0-9._%+-@]/g, '');
    // limit to 256 characters
    s = s.substring(0, 256);
    return s;
}

/**
 * Normalizes a string to a LinkedIn username. Keeps only letters, numbers, and hyphens; limit to 30 characters; if final is true, apply strict validation rules.
 * @param {string} username - The string to normalize.
 * @param {boolean} final - Whether to apply strict validation rules.
 * @returns {string} - The normalized string.
 */
export function normalizeLinkedinUsername(username, final = false) {
    if (!username) return '';
    let normalized = username;
    if (normalized.includes('/')) {
        // Remove trailing slashes
        normalized = normalized.replace(/\/+$/, '');
        // Keep only the username from the URL
        normalized = normalized.substring(normalized.lastIndexOf('/') + 1);
    }
    // Step 1: Remove all characters that are not letters, numbers, or hyphens
    normalized = normalized.replace(/[^a-zA-Z0-9-]/g, '');
    // Step 2: Replace consecutive hyphens with a single hyphen
    normalized = normalized.replace(/-+/g, '-');
    // Remove leading hyphens
    normalized = normalized.replace(/^-+/, '');
    // Step 3: Truncate to maximum length (30 characters)
    normalized = normalized.substring(0, 30);
    // Step 4: If final is true, apply strict validation rules
    if (final) {
        // Remove trailing hyphens
        normalized = normalized.replace(/-+$/, '');
        // If still empty or too short after cleanup, return empty string
        if (normalized.length < 3) {
            normalized = '';
        }
    }
    return normalized;
}

/**
 * Normalizes a string to an X (Twitter) username. Keeps only letters, numbers, and underscores; limit to 15 characters; if final is true, apply strict validation rules.
 * @param {string} username - The string to normalize.
 * @param {boolean} final - Whether to apply strict validation rules.
 * @returns {string} - The normalized string.
 */
export function normalizeXTwitterUsername(username, final = false) {
    if (!username) return '';
    let normalized = username;
    if (normalized.includes('/')) {
        // Remove trailing slashes
        normalized = normalized.replace(/\/+$/, '');
        // Keep only the username from the URL
        normalized = normalized.substring(normalized.lastIndexOf('/') + 1);
    }
    // Step 3: Remove all characters that are not letters, numbers, or underscores
    normalized = normalized.replace(/[^a-zA-Z0-9_]/g, '');
    // Step 4: Truncate to maximum length (15 characters)
    normalized = normalized.substring(0, 15);
    // Ensure minimum length of 1 character
    if (normalized.length < 1) {
        normalized = '';
    }
    return normalized;
}

// Generate SVG path for identicon
export function generateIdenticonSvg(hash, size = 50) {
    const padding = 5;
    const cellSize = (size - (2 * padding)) / 5;

    // Create 5x5 grid of cells
    let paths = [];
    let colors = [];

    // Use first 10 bytes for colors (2 colors)
    const color1 = getColorFromHash(hash, 0);
    const color2 = getColorFromHash(hash, 3);

    // Use remaining bytes for pattern
    for (let i = 0; i < 15; i++) {
        const byte = parseInt(hash.slice(i * 2 + 12, i * 2 + 14), 16);
        if (byte % 2 === 0) { // 50% chance for each cell
            const row = Math.floor(i / 3);
            const col = i % 3;
            // Mirror the pattern horizontally
            const x1 = padding + (col * cellSize);
            const x2 = padding + ((4 - col) * cellSize);
            const y = padding + (row * cellSize);

            // Add rectangles for both sides
            paths.push(`M ${x1} ${y} h ${cellSize} v ${cellSize} h -${cellSize} Z`);
            if (col < 2) { // Don't duplicate center column
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
            ${paths.map((path, i) => `<path d="${path}" fill="${colors[i]}"/>`).join('')}
        </svg>
    `;
}

// Generate identicon from address
export function generateIdenticon(address, size = 50) {
    return generateIdenticonSvg(address, size);
}

// Format timestamp to relative time
export function formatTime(timestamp, includeTimeForOld = true) {
    if (!timestamp || timestamp == 0){ return ''}
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Format time for display
    const formattedTime = date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    if (days > 7) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const currentYear = now.getFullYear();
        
        const dateStr = currentYear === year ? `${month} ${day}` : `${month} ${day} ${year}`;
        return includeTimeForOld ? `${dateStr}, ${formattedTime}` : dateStr;
    } else if (days > 0) {
        const relativeDay = days === 1 ? 'Yesterday' : `${days} days ago`;
        return includeTimeForOld ? `${relativeDay}, ${formattedTime}` : relativeDay;
    } else {
        // Messages less than 24 hours old: always show time
        return formattedTime;
    }
}

// Function to detect URLs, convert them to clickable links, prevent XSS, prevent html tags from being displayed
export function linkifyUrls(text) {
    if (!text) return '';

    // escape html characters in the text
    text = escapeHtml(text);

    // Updated Regex: Only match explicit http:// or https://
    const urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

    // Allowed protocols check (still good practice, though the regex is stricter)
    const allowedProtocols = /^https?:\/\//i;

    return text.replace(urlRegex, function(url) {
        // No need to prepend protocol anymore, as the regex ensures it's present.
        const properUrl = url;

        const escapedUrl = url;

        // **Safety Check:** Validate the protocol
        // Should always pass now due to the strict regex, but kept for safety.
        if (!allowedProtocols.test(properUrl)) {
            return escapedUrl;
        }

        // Check if URL might lead to a file download
        const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.exe', '.dmg', '.pkg', '.deb', '.rpm', '.apk', '.ipa', '.mp3', '.mp4', '.avi', '.mov', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.txt', '.csv', '.json', '.xml'];
        const downloadKeywords = ['download', 'file', 'attachment', 'get', 'fetch'];

        const hasFileExtension = fileExtensions.some(ext => properUrl.toLowerCase().includes(ext));
        const hasDownloadKeyword = downloadKeywords.some(keyword => properUrl.toLowerCase().includes(keyword));
        const isPotentialDownload = hasFileExtension || hasDownloadKeyword;

        let warningMessage = '⚠️ Security Warning\\n\\nYou are leaving Liberdus and navigating to:\\n' + properUrl + '\\n\\n⚠️ Be careful:\\n• Verify the website is legitimate\\n• Never enter passwords on suspicious sites\\n• Check the URL for typos or fake domains';

        if (isPotentialDownload) {
            warningMessage = '\\n\\n⚠️ File Download Warning:\\n• This link may download a file\\n• Only download from trusted sources\\n• Scan files with antivirus software\\n• Be especially careful with executable files (.exe, .dmg, .pkg)';
        }

        warningMessage += '\\n\\nClick OK to continue or Cancel to stay.';

        // removing the confirm dialog for now, since it triggers popup blockers
        // return `<a href="${properUrl}" target="_blank" rel="noopener noreferrer" onclick="return confirm('${warningMessage}')">${escapedUrl}</a>`;
        return `<a href="${properUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    });
}

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export const BUTTON_COOLDOWN_MS = 2000;

/**
 * Wraps an async handler so the given buttons are disabled for a minimum cooldown (ms).
 * If the handler takes longer than ms, cooldown lifts as soon as the handler finishes.
 * When cooldown ends: calls revalidateFn() if provided, otherwise sets disabled = false on the buttons.
 * @param {HTMLButtonElement|HTMLButtonElement[]} buttons - Button(s) to disable during cooldown
 * @param {number} ms - Minimum cooldown in milliseconds
 * @param {(() => void)|null|undefined} revalidateFn - Optional; called when cooldown ends to refresh button state
 * @param {(event: Event) => Promise<void>} handler - The async handler to run
 * @returns {(event: Event) => Promise<void>} Wrapped handler to use as the listener
 */
export function withButtonCooldown(buttons, ms, revalidateFn, handler) {
    const list = Array.isArray(buttons) ? buttons : [buttons];
    let inProgress = false;
    let liftDone = false;
    let timeoutId = null;

    function lift() {
        if (liftDone) return;
        liftDone = true;
        inProgress = false;
        if (typeof revalidateFn === 'function') {
            revalidateFn();
        } else {
            list.forEach((b) => { if (b) b.disabled = false; });
        }
    }

    return async function wrappedHandler(event) {
        if (inProgress) return;
        inProgress = true;
        liftDone = false;
        list.forEach((b) => { if (b) b.disabled = true; });
        const startTime = Date.now();
        timeoutId = setTimeout(() => {
            timeoutId = null;
            lift();
        }, ms);
        try {
            await handler(event);
        } finally {
            if (Date.now() - startTime >= ms) {
                if (timeoutId !== null) clearTimeout(timeoutId);
                lift();
            }
        }
    };
}

export function debounce(func, waitFn) {
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

export function truncateMessage(message, maxLength = 100) {
    // If the message fits or is shorter, return it as is.
    if (message.length <= maxLength) {
        return message;
    }

    const firstMarkStart = message.indexOf('<mark>');

    // Case 1: No highlight found
    if (firstMarkStart === -1) {
        // Default behavior: truncate from the beginning
        return message.substring(0, maxLength) + '...';
    }

    // Case 2: Highlight found
    // Aim to show some context before the highlight. Adjust ratio as needed.
    const charsToShowBefore = Math.floor(maxLength * 0.3); // e.g., 30 chars for maxLength 100

    // Calculate the ideal starting point
    let startIndex = Math.max(0, firstMarkStart - charsToShowBefore);

    // Calculate the ending point based on start + maxLength
    let endIndex = Math.min(message.length, startIndex + maxLength);

    // --- Adjustment for hitting the end ---
    // If the calculated window ends exactly at the message end,
    // it might be shorter than maxLength if the highlight was very close to the end.
    // In this case, pull the startIndex back to ensure we show the full maxLength window
    // ending at the message end.
    if (endIndex === message.length) {
         startIndex = Math.max(0, message.length - maxLength);
    }
    // --- End Adjustment ---

    // --- Ensure we don't cut through HTML tags ---
    // Check if we're cutting through a tag at the end
    if (endIndex < message.length && message.lastIndexOf('<', endIndex) > message.lastIndexOf('>', endIndex)) {
        endIndex = message.lastIndexOf('<', endIndex);
    }
    // Check if we're starting inside a tag
    if (startIndex > 0) {
        const nextClose = message.indexOf('>', startIndex);
        const nextOpen = message.indexOf('<', startIndex);
        if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
            startIndex = nextClose + 1;
        }
    }

    // Extract the substring
    let preview = message.substring(startIndex, endIndex);

    // Add ellipsis prefix if we didn't start at the beginning
    if (startIndex > 0) {
        preview = '...' + preview;
    }

    // Add ellipsis suffix if we didn't end at the very end
    if (endIndex < message.length) {
        preview = preview + '...';
    }

    return preview;
}


export function ab2base64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base642ab(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function deriveKey(password, salt, iterations = 100000) {
    const passwordBuffer = str2ab(password);
    const importedKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export function isEncryptedData(data) {
    try {
        const parsed = JSON.parse(data);
        return parsed.hasOwnProperty('salt') &&
               parsed.hasOwnProperty('iv') &&
               parsed.hasOwnProperty('content');
    } catch {
        return false;
    }
}

export function isValidEthereumAddress(address) {
    if (!address.startsWith('0x')) return false;
    if (address.length !== 42) return false;
    // Check if the address contains only valid hex characters after 0x
    const hexRegex = /^0x[0-9a-fA-F]{40}$/;
    return hexRegex.test(address);
}

export function normalizeAddress(address) {
    // Remove 0x prefix if present
    address = address.replace(/^0x/, '');
    // Convert to lowercase for consistent comparison
    address = address.toLowerCase();
    // Remove trailing zeros
    if (address.length == 64) {
        address = address.replace(/0{24}$/, '');
    }
    // Ensure exactly 40 characters
    if (address.length !== 40) {
        throw new Error('Invalid address length after normalization');
    }
    return address;
}

export function longAddress(address){
    // First normalize the address to ensure consistent format
    const normalized = normalizeAddress(address);
    // Then add the required padding for network calls
    return normalized + '0'.repeat(24);
}

export function utf82bin(str) {
    if (typeof str !== 'string') {
        throw new TypeError(`Input must be a string instead of ${typeof str}`);
    }
    // Create a TextEncoder instance
    const encoder = new TextEncoder();
    // Encode the string to Uint8Array
    return encoder.encode(str);
}

export function bin2utf8(uint8Array) {
    if (!(uint8Array instanceof Uint8Array)) {
        throw new TypeError('Input must be a Uint8Array');
    }
    // Create a TextDecoder instance
    const decoder = new TextDecoder('utf-8');
    // Decode the Uint8Array to string
    return decoder.decode(uint8Array);
}

export function hex2big(hexString) {
    const cleanHex = hexString.replace('0x', '');
    return BigInt('0x' + cleanHex);
}

export function big2num(bigIntNum) {
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

// This was losing precision because the number was getting converted to float by the caller
export function bigxnum2big_old(bigIntNum, floatNum) {
    // Convert float to string to handle decimal places
    const floatStr = floatNum.toString();

    // Find number of decimal places
    const decimalPlaces = floatStr.includes('.')
        ? floatStr.split('.')[1].length
        : 0;

    // Convert float to integer by multiplying by 10^decimalPlaces
    const floatAsInt = Math.round(floatNum * Math.pow(10, decimalPlaces));

    // Multiply and adjust for decimal places
    const result = (bigIntNum * BigInt(floatAsInt)) / BigInt(Math.pow(10, decimalPlaces));

    return result;
}

/**
 * Convert a string number to a BigInt number
 * @param {BigInt} bigIntNum - The base BigInt number
 * @param {string} stringNum - The string number to convert
 * @returns {BigInt} The converted BigInt number
 */
export function bigxnum2big(bigIntNum, stringNum) {
    stringNum = stringNum.trim().replace(/\.0*$/, '')
    // Find decimal point position if it exists
    const decimalPosition = stringNum.indexOf('.');

    if (decimalPosition === -1) {
        // No decimal point - direct conversion to BigInt
        return BigInt(stringNum) * bigIntNum;
    }

    // Count decimal places
    const decimalPlaces = stringNum.length - decimalPosition - 1;

    // Remove decimal point and convert to BigInt
    const numberWithoutDecimal = stringNum.replace('.', '');
    const scaledResult = BigInt(numberWithoutDecimal) * bigIntNum;

    // Adjust for decimal places
    return scaledResult / BigInt(10 ** decimalPlaces);
}

/**
 * Convert a BigInt number to a number with decimals
 * @param {BigInt} bigIntNum - The base BigInt number
 * @param {number} floatNum - The number of decimals
 * @returns {number} The converted number
 */
export function bigxnum2num(bigIntNum, floatNum) {
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

/**
 * Convert a BigInt number to a string number with decimals
 * @param {BigInt} amount - The amount to convert
 * @param {number} decimals - The number of decimals
 * @returns {string} The converted string number
 */
export function big2str(amount, decimals) {
    let amountString = amount.toString();
    // Pad with zeros if needed
    amountString = amountString.padStart(decimals, '0');

    const insertPosition = amountString.length - decimals;
    let r = insertPosition === 0
        ? '0.' + amountString
        : amountString.slice(0, insertPosition) + '.' + amountString.slice(insertPosition);
//            r.replace('0*$', '')
    return r
}

// Convert Uint8Array to base64
//   See https://www.perplexity.ai/search/is-there-a-more-compute-effice-q9adLBpFTWSHW12lVWn2PA
/* export function bin2base64(bytes) {
    return btoa(String.fromCharCode(...bytes));
} */
export function bin2base64(bytes) {
    let binary = '';
    const chunkSize = 0x8000; // 32KB per chunk is safe
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + chunkSize)
        );
    }
    return btoa(binary);
}

// Convert base64 to Uint8Array
/* export function base642bin(str) {
    return Uint8Array.from(atob(str), c => c.charCodeAt(0));
} */
export function base642bin(str) {
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}


export function hex2bin(hex){
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

export function bin2hex(bin){
    return Array.from(bin).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalizes a string to a float and limits the number of decimals to 18 and the number of digits before the decimal point to 9.
 * @param {string} value - The float as a string to normalize.
 * @returns {string} - The normalized float as a string.
 */
export function normalizeUnsignedFloat(value) {
  if (!value) return '';

  // keep only digits or dots
  let normalized = value.replace(/[^0-9.]/g, '');
  if (normalized.match(/^0+$/)){ return '0'};
  normalized = normalized.replace(/^0+/,'');

  // keep only the first dot
  const firstDot = normalized.indexOf('.');
  if (firstDot !== -1) {
    normalized =
      normalized.slice(0, firstDot + 1) +
      normalized.slice(firstDot + 1).replace(/\./g, '');
  }
  // if the first character is a dot, add a 0 in front
  if (normalized.startsWith('.')) {
    normalized = '0' + normalized;
  }

  // Handle numbers that exceed the 9-digit limit before decimal
  if (normalized.includes('.')) {
    const [wholePart, decimalPart] = normalized.split('.');
    if (wholePart.length > 9) {
      // Slice to exactly 9 digits before decimal
      normalized = wholePart.slice(0, 9) + '.' + decimalPart;
    }
    // Limit decimal places to 18
    if (decimalPart && decimalPart.length > 18) {
      normalized = wholePart + '.' + decimalPart.slice(0, 18);
    }
  } else {
    // No decimal point - limit to 9 digits
    if (normalized.length > 9) {
      normalized = normalized.slice(0, 9);
    }
  }
  return normalized;
}

function getColorFromHash(hash, index) {
    const hue = parseInt(hash.slice(index * 2, (index * 2) + 2), 16) % 360;
    const saturation = 60 + (parseInt(hash.slice((index * 2) + 2, (index * 2) + 4), 16) % 20);
    const lightness = 45 + (parseInt(hash.slice((index * 2) + 4, (index * 2) + 6), 16) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export class EthNum {
  /**
   * Converts a base 10 string representation of an Ethereum-like number
   * (with up to 18 decimal places) into its BigInt representation (Wei).
   * @param {string} str The string to convert.
   * @returns {bigint} The BigInt representation in Wei.
   */
  static toWei(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }
    const parts = str.split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';
    if (decimalPart.length > 18) {
      throw new Error('Decimal precision cannot exceed 18 digits');
    }
    const padding = 18 - decimalPart.length;
    const paddedDecimal = decimalPart + '0'.repeat(padding);
    return BigInt(integerPart + paddedDecimal);
  }

  /**
   * Converts a BigInt representation of an Ethereum-like number (Wei)
   * back into a base 10 string with up to 18 decimal places.
   * @param {bigint} wei The BigInt to convert.
   * @returns {string} The string representation.
   */
  static toStr(wei) {
    if (typeof wei !== 'bigint') {
      throw new Error('Input must be a BigInt');
    }
    const weiStr = wei.toString().padStart(19, '0');
    const integerPart = weiStr.slice(0, -18);
    const decimalPart = weiStr.slice(-18).replace(/0+$/, '');
    if (decimalPart === '') {
      return integerPart;
    }
    return `${integerPart}.${decimalPart}`;
  }

  /**
   * Adds two Ethereum-like numbers given as strings and returns their sum as a string.
   * @param {string} str1 The first number string.
   * @param {string} str2 The second number string.
   * @returns {string} The sum as a string.
   */
  static add(str1, str2) {
    const wei1 = EthNum.toWei(str1);
    const wei2 = EthNum.toWei(str2);
    const sumWei = wei1 + wei2;
    return EthNum.toStr(sumWei);
  }

  /**
   * Subtracts one Ethereum-like number string from another and returns the result as a string.
   * @param {string} str1 The number string to subtract from.
   * @param {string} str2 The number string to subtract.
   * @returns {string} The difference as a string.
   */
  static sub(str1, str2) {
    const wei1 = EthNum.toWei(str1);
    const wei2 = EthNum.toWei(str2);
    const diffWei = wei1 - wei2;
    return EthNum.toStr(diffWei);
  }

  /**
   * Multiplies two Ethereum-like number strings and returns the product as a string.
   * @param {string} str1 The first number string.
   * @param {string} str2 The second number string.
   * @returns {string} The product as a string.
   */
  static mul(str1, str2) {
    const wei1 = EthNum.toWei(str1);
    const wei2 = EthNum.toWei(str2);
    const productWei = (wei1 * wei2) / BigInt(1e18);
    return EthNum.toStr(productWei);
  }

  /**
   * Divides one Ethereum-like number string by another and returns the quotient as a string.
   * @param {string} str1 The dividend string.
   * @param {string} str2 The divisor string.
   * @returns {string} The quotient as a string.
   */
  static div(str1, str2) {
    const wei1 = EthNum.toWei(str1);
    const wei2 = EthNum.toWei(str2);
    const quotientWei = (wei1 * BigInt(1e18)) / wei2;
    return EthNum.toStr(quotientWei);
  }
}