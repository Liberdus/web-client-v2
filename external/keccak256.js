

// from round-const.js
const RC = [1,0,32898,0,32906,-2147483648,-2147450880,-2147483648,32907,0,-2147483647,0,-2147450751,-2147483648,32777,-2147483648,138,0,136,0,-2147450871,0,-2147483638,0,-2147450741,0,139,-2147483648,32905,-2147483648,32771,-2147483648,32770,-2147483648,128,-2147483648,32778,0,-2147483638,-2147483648,-2147450751,-2147483648,32896,-2147483648,-2147483647,0,-2147450872,-2147483648];

// https://github.com/emn178/js-sha3/blob/master/src/sha3.js
function permute32(s) {
	for (let n = 0; n < 48; n += 2) {
		let c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
		let c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
		let c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
		let c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
		let c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
		let c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
		let c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
		let c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
		let c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
		let c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

		let h = c8 ^ ((c2 << 1) | (c3 >>> 31));
		let l = c9 ^ ((c3 << 1) | (c2 >>> 31));
		s[0] ^= h;
		s[1] ^= l;
		s[10] ^= h;
		s[11] ^= l;
		s[20] ^= h;
		s[21] ^= l;
		s[30] ^= h;
		s[31] ^= l;
		s[40] ^= h;
		s[41] ^= l;
		h = c0 ^ ((c4 << 1) | (c5 >>> 31));
		l = c1 ^ ((c5 << 1) | (c4 >>> 31));
		s[2] ^= h;
		s[3] ^= l;
		s[12] ^= h;
		s[13] ^= l;
		s[22] ^= h;
		s[23] ^= l;
		s[32] ^= h;
		s[33] ^= l;
		s[42] ^= h;
		s[43] ^= l;
		h = c2 ^ ((c6 << 1) | (c7 >>> 31));
		l = c3 ^ ((c7 << 1) | (c6 >>> 31));
		s[4] ^= h;
		s[5] ^= l;
		s[14] ^= h;
		s[15] ^= l;
		s[24] ^= h;
		s[25] ^= l;
		s[34] ^= h;
		s[35] ^= l;
		s[44] ^= h;
		s[45] ^= l;
		h = c4 ^ ((c8 << 1) | (c9 >>> 31));
		l = c5 ^ ((c9 << 1) | (c8 >>> 31));
		s[6] ^= h;
		s[7] ^= l;
		s[16] ^= h;
		s[17] ^= l;
		s[26] ^= h;
		s[27] ^= l;
		s[36] ^= h;
		s[37] ^= l;
		s[46] ^= h;
		s[47] ^= l;
		h = c6 ^ ((c0 << 1) | (c1 >>> 31));
		l = c7 ^ ((c1 << 1) | (c0 >>> 31));
		s[8] ^= h;
		s[9] ^= l;
		s[18] ^= h;
		s[19] ^= l;
		s[28] ^= h;
		s[29] ^= l;
		s[38] ^= h;
		s[39] ^= l;
		s[48] ^= h;
		s[49] ^= l;

		let b00 = s[0];
		let b01 = s[1];
		let b32 = (s[11] << 4) | (s[10] >>> 28);
		let b33 = (s[10] << 4) | (s[11] >>> 28);
		let b14 = (s[20] << 3) | (s[21] >>> 29);
		let b15 = (s[21] << 3) | (s[20] >>> 29);
		let b46 = (s[31] << 9) | (s[30] >>> 23);
		let b47 = (s[30] << 9) | (s[31] >>> 23);
		let b28 = (s[40] << 18) | (s[41] >>> 14);
		let b29 = (s[41] << 18) | (s[40] >>> 14);
		let b20 = (s[2] << 1) | (s[3] >>> 31);
		let b21 = (s[3] << 1) | (s[2] >>> 31);
		let b02 = (s[13] << 12) | (s[12] >>> 20);
		let b03 = (s[12] << 12) | (s[13] >>> 20);
		let b34 = (s[22] << 10) | (s[23] >>> 22);
		let b35 = (s[23] << 10) | (s[22] >>> 22);
		let b16 = (s[33] << 13) | (s[32] >>> 19);
		let b17 = (s[32] << 13) | (s[33] >>> 19);
		let b48 = (s[42] << 2) | (s[43] >>> 30);
		let b49 = (s[43] << 2) | (s[42] >>> 30);
		let b40 = (s[5] << 30) | (s[4] >>> 2);
		let b41 = (s[4] << 30) | (s[5] >>> 2);
		let b22 = (s[14] << 6) | (s[15] >>> 26);
		let b23 = (s[15] << 6) | (s[14] >>> 26);
		let b04 = (s[25] << 11) | (s[24] >>> 21);
		let b05 = (s[24] << 11) | (s[25] >>> 21);
		let b36 = (s[34] << 15) | (s[35] >>> 17);
		let b37 = (s[35] << 15) | (s[34] >>> 17);
		let b18 = (s[45] << 29) | (s[44] >>> 3);
		let b19 = (s[44] << 29) | (s[45] >>> 3);
		let b10 = (s[6] << 28) | (s[7] >>> 4);
		let b11 = (s[7] << 28) | (s[6] >>> 4);
		let b42 = (s[17] << 23) | (s[16] >>> 9);
		let b43 = (s[16] << 23) | (s[17] >>> 9);
		let b24 = (s[26] << 25) | (s[27] >>> 7);
		let b25 = (s[27] << 25) | (s[26] >>> 7);
		let b06 = (s[36] << 21) | (s[37] >>> 11);
		let b07 = (s[37] << 21) | (s[36] >>> 11);
		let b38 = (s[47] << 24) | (s[46] >>> 8);
		let b39 = (s[46] << 24) | (s[47] >>> 8);
		let b30 = (s[8] << 27) | (s[9] >>> 5);
		let b31 = (s[9] << 27) | (s[8] >>> 5);
		let b12 = (s[18] << 20) | (s[19] >>> 12);
		let b13 = (s[19] << 20) | (s[18] >>> 12);
		let b44 = (s[29] << 7) | (s[28] >>> 25);
		let b45 = (s[28] << 7) | (s[29] >>> 25);
		let b26 = (s[38] << 8) | (s[39] >>> 24);
		let b27 = (s[39] << 8) | (s[38] >>> 24);
		let b08 = (s[48] << 14) | (s[49] >>> 18);
		let b09 = (s[49] << 14) | (s[48] >>> 18);

		s[0] = b00 ^ (~b02 & b04);
		s[1] = b01 ^ (~b03 & b05);
		s[10] = b10 ^ (~b12 & b14);
		s[11] = b11 ^ (~b13 & b15);
		s[20] = b20 ^ (~b22 & b24);
		s[21] = b21 ^ (~b23 & b25);
		s[30] = b30 ^ (~b32 & b34);
		s[31] = b31 ^ (~b33 & b35);
		s[40] = b40 ^ (~b42 & b44);
		s[41] = b41 ^ (~b43 & b45);
		s[2] = b02 ^ (~b04 & b06);
		s[3] = b03 ^ (~b05 & b07);
		s[12] = b12 ^ (~b14 & b16);
		s[13] = b13 ^ (~b15 & b17);
		s[22] = b22 ^ (~b24 & b26);
		s[23] = b23 ^ (~b25 & b27);
		s[32] = b32 ^ (~b34 & b36);
		s[33] = b33 ^ (~b35 & b37);
		s[42] = b42 ^ (~b44 & b46);
		s[43] = b43 ^ (~b45 & b47);
		s[4] = b04 ^ (~b06 & b08);
		s[5] = b05 ^ (~b07 & b09);
		s[14] = b14 ^ (~b16 & b18);
		s[15] = b15 ^ (~b17 & b19);
		s[24] = b24 ^ (~b26 & b28);
		s[25] = b25 ^ (~b27 & b29);
		s[34] = b34 ^ (~b36 & b38);
		s[35] = b35 ^ (~b37 & b39);
		s[44] = b44 ^ (~b46 & b48);
		s[45] = b45 ^ (~b47 & b49);
		s[6] = b06 ^ (~b08 & b00);
		s[7] = b07 ^ (~b09 & b01);
		s[16] = b16 ^ (~b18 & b10);
		s[17] = b17 ^ (~b19 & b11);
		s[26] = b26 ^ (~b28 & b20);
		s[27] = b27 ^ (~b29 & b21);
		s[36] = b36 ^ (~b38 & b30);
		s[37] = b37 ^ (~b39 & b31);
		s[46] = b46 ^ (~b48 & b40);
		s[47] = b47 ^ (~b49 & b41);
		s[8] = b08 ^ (~b00 & b02);
		s[9] = b09 ^ (~b01 & b03);
		s[18] = b18 ^ (~b10 & b12);
		s[19] = b19 ^ (~b11 & b13);
		s[28] = b28 ^ (~b20 & b22);
		s[29] = b29 ^ (~b21 & b23);
		s[38] = b38 ^ (~b30 & b32);
		s[39] = b39 ^ (~b31 & b33);
		s[48] = b48 ^ (~b40 & b42);
		s[49] = b49 ^ (~b41 & b43);

		s[0] ^= RC[n];
		s[1] ^= RC[n + 1];
	}
}

function expect_byte_array(v, str_handler) {
	if (Array.isArray(v)) {
		if (v.every(x => Number.isSafeInteger(x) && x >= 0 && x <= 255)) return v;
	} else if (v instanceof Uint8Array) {
		return v;
	} else if (v instanceof ArrayBuffer) {
		return new Uint8Array(v);
	} else if (ArrayBuffer.isView(v)) {
		return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
	} else if (str_handler && typeof v === 'string') {
		return str_handler(v);
	}
	throw new TypeError(`expected array of bytes`);
}

function bytes_from_int32LE(u) {
	let n = u.length;
	let v = new Uint8Array(n << 2);
	let i = 0;
	for (let x of u) {
		v[i++] = x;
		v[i++] = x >> 8;
		v[i++] = x >> 16;
		v[i++] = x >> 24;
	}
	return v;
}

// returns no-prefix hex string from Uint8Array
function hex_from_bytes(v) {
	v = expect_byte_array(v, bytes_from_utf8);
	let cps = [];
	for (let i = 0, n = v.length; i < n; i++) {
		let x = v[i];
		cps.push(hex_from_nibble(x >> 4), hex_from_nibble(x & 15));
	}
	return String.fromCharCode(...cps);
}
function hex_from_nibble(x) {
	return x < 10 ? 48 + x : 87 + x; // '0' or ('a' - 10)
}

// returns Uint8Array from hex-string
function bytes_from_hex(s) {
	if (typeof s !== 'string') throw new TypeError('expected string');
	let pos = s.startsWith('0x') ? 2 : 0; // optional prefix
	let i = 0;
	let len = s.length;
	let v = new Uint8Array((len + 1 - pos) >> 1); // round up for odd
	if (len & 1) { // handle odd
		v[i++] = req_hex_digit(s, pos++);
	}
	while (pos < len) {
		v[i++] = (req_hex_digit(s, pos++) << 4) | req_hex_digit(s, pos++);
	}
	return v;
}
function req_hex_digit(s, i) {
	let c = s.charCodeAt(i);
	if (c <= 57) { // 0-9
		c -= 48; // '0'
	} else if (c <= 90) { // A-Z
		c -= 55; // 'A' + 10
	} else { // a-z
		c -= 87; // 'a' + 10
	}
	if (!(c >= 0 && c < 16)) throw new TypeError(`expected hex digit: ${s[i]}`);
	return c;
}

// returns string from bytes
function utf8_from_bytes(v) {
	v = expect_byte_array(v, bytes_from_hex);
	let cps = [];
	for (let i = 0, n = v.length; i < n; ) {
		let x = v[i++];
		if (x < 0x80) {
			cps.push(x);
		} else if (x < 0xE0) {
			cps.push(((x & 0x1F) << 6) | req_utf8_cont(v, i++));
		} else if (x < 0xF0) {
			cps.push(((x & 0x0F) << 12) | (req_utf8_cont(v, i++) << 6) | req_utf8_cont(v, i++));
		} else {
			cps.push(((x & 0x07) << 18) | (req_utf8_cont(v, i++) << 12) | (req_utf8_cont(v, i++) << 6) | req_utf8_cont(v, i++));
		}
	}
	return String.fromCodePoint(...cps);
}
function req_utf8_cont(v, i) {
	let x = v[i];
	if ((x & 0xC0) != 0x80) throw new Error(`malformed utf8 at ${i}: expected continuation`);
	return x & 0x3F;
}

// returns Uint8Array from string
function bytes_from_utf8(s) {
	if (typeof s !== 'string') throw new TypeError('expected string');
	let v = [];
	for (let pos = 0, len = s.length; pos < len; ) {
		let cp = s.codePointAt(pos++);
		if (cp < 0x800) {
			if (cp < 0x80) {
				v.push(cp);
			} else {
				v.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
			}
		} else {
			if (cp < 0x10000) {
				v.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
			} else {
				v.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
				pos++;
			}
		}
	}
	return Uint8Array.from(v);
}

function random_bytes(n) {	
	let v = new Uint8Array(n);
	for (let i = 0; i < n; i++) {
		v[i] = (Math.random() * 256)|0; 
	}
	return v;
}

function random_chunks(v) {
	if (typeof v === 'number') v = random_bytes(v);
	if (!ArrayBuffer.isView(v)) throw new TypeError('expected view');
	let chunks = [];
	while (v.length > 0) {
		let cut = 1 + (Math.random() * (v.length - 1))|0;
		chunks.push(v.slice(0, cut)); // copy
		v = v.subarray(cut);
	}
	return chunks;
}

// only 256-bit keccak
export default function(v) {
	if (!(v instanceof Uint8Array)) throw new TypeError('expected Uint8Array');
	const block_count = 34;
	let sponge = [];
	for (let i = 0; i < 50; i++) sponge[i] = 0;
	let off = 0;
	let len = v.length;
	let blocks = len >> 2;
	let block_index;
	while (true) {
		block_index = 0;
		let end = Math.min(block_count, blocks);
		while (block_index < end) {
			sponge[block_index++] ^= v[off++] | (v[off++] << 8) | (v[off++] << 16) | (v[off++] << 24);
		}
		if (end < block_count) break;
		permute32(sponge);
		blocks -= block_count;
	}
	let suffix = 1;
	while (off < len) {
		suffix = (suffix << 8) | v[--len];
	}
	sponge[block_index] ^= suffix;
	sponge[block_count-1] ^= 0x80000000;
	permute32(sponge);
	return bytes_from_int32LE(sponge.slice(0, 8));
}

