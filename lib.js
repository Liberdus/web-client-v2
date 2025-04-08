export function normalizeUsername(u){
    return u.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Convert string to Uint8Array for hashing
export function str2ab(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
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
export async function generateIdenticon(address, size = 50) {
    // Hash the address using SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', str2ab(address));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = bin2hex(hashArray)  // hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return generateIdenticonSvg(hashHex, size);
}

// Format timestamp to relative time
export function formatTime(timestamp) {
    if (!timestamp || timestamp == 0){ return ''}
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 7) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const currentYear = now.getFullYear();
        
        return currentYear === year ? 
            `${month} ${day}` : 
            `${month} ${day} ${year}`;
    } else if (days > 0) {
        return days === 1 ? 'Yesterday' : `${days} days ago`;
    } else {
        // Use hour12: true to get 12-hour format and remove leading zeros
        return date.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }
}

// Function to detect URLs, convert them to clickable links, prevent XSS, prevent html tags from being displayed
export function linkifyUrls(text) {
    if (!text) return '';

    // escape html characters in the text
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

        // Create the link
        return `<a href="${properUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    });
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

export async function decryptData(encryptedData, password) {
    if (!password) return encryptedData;

    // Generate key using 100,000 iterations of blake2b
    let key = utf82bin(password);
    for (let i = 0; i < 100000; i++) {
        key = blake.blake2b(key, null, 32);
    }

    // Decrypt the data using ChaCha20-Poly1305
    return decryptChacha(key, encryptedData);
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

export async function encryptData(data, password) {
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

export function ethHashMessage(message){
    if (typeof(message) === "string") { message = utf82bin(message); }
    const MessagePrefix = "\x19Ethereum Signed Message:\n"
    const str = bin2hex(utf82bin(MessagePrefix)) + bin2hex(utf82bin(String(message.length))) + bin2hex(message)
    return bin2hex(keccak256(hex2bin(str)))
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
export function bin2base64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

// Convert base64 to Uint8Array
export function base642bin(str) {
    return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// key is binary, data is string, output is base64
export function encryptChacha(key, data) {
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
export function decryptChacha(key, encrypted) {
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
        console.log('Decryption failed: message authentication failed or corrupted data');
        return 'Decryption failed due to tampered data'
    }
}

export function hex2bin(hex){
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

export function bin2hex(bin){
    return Array.from(bin).map(b => b.toString(16).padStart(2, '0')).join('');
}


function getColorFromHash(hash, index) {
    const hue = parseInt(hash.slice(index * 2, (index * 2) + 2), 16) % 360;
    const saturation = 60 + (parseInt(hash.slice((index * 2) + 2, (index * 2) + 4), 16) % 20);
    const lightness = 45 + (parseInt(hash.slice((index * 2) + 4, (index * 2) + 6), 16) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}