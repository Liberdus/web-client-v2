/*
 * ts-mls + X-Wing + ML-KEM-1024 — vendored MLS bundle for group chat.
 *
 * GENERATED FILE. Do not edit; run `npm run build:mls` instead.
 * Deliberately unminified so it can be read and audited as shipped.
 *
 * Built from these packages (name, version, npm integrity):
 *   @hpke/chacha20poly1305         1.7.1      sha512-Zp8IwRIkdCucu877wCNqDp3B8yOhAnAah/YDDkO94pPr/KKV7IGnBbpwIjDB3BsAySWBMrhhdE0JKYw3N4FCag==
 *   @hpke/common                   1.10.1     sha512-moJwhmtLtuxiUzzNp1jpfBfx8yefKoO9D/RCR9dmwrnc7qjJqId1rEtQz+lSlU5cabX8daToMSx/7HayXOiaFw==
 *   @hpke/core                     1.8.0      sha512-yHuo+2q4HSPUFuxcg87Kiy7QZRk4IeR+cwBB0qW8fHnr71bnRCArM39Cq1bWHBt75gTyeERGD/v1H14yPB2wyw==
 *   @hpke/dhkem-x25519             1.8.0      sha512-S1MWWkAfu+TFxySgv5+2P3O4Mx/jk7BsoplzQaA1s3sfUJVJ2UsZsSzSsMc+FXJumLXncoJFlO6mK6mDGspfmA==
 *   @hpke/hybridkem-x-wing         0.6.1      sha512-mNdGapyHPw9gEicUlBYlWGjOpWmQyC49dEqLm5QtGZOSjIVSjSTBX/Bq2VxXNTeNdsRYIpPOalTwYbop/+4Ykw==
 *   @noble/ciphers                 2.1.1      sha512-bysYuiVfhxNJuldNXlFEitTVdNnYUc+XNJZd7Qm2a5j1vZHgY+fazadNFWFaMK/2vye0JVlxV3gHmC0WDfAOQw==
 *   @noble/curves                  2.0.1      sha512-vs1Az2OOTBiP4q0pwjW5aF0xp9n4MxVrmkFBxc6EKZc6ddYx5gaZiAsZoq0uRRXWbi3AT/sBqn05eRPtn1JCPw==
 *   @noble/hashes                  2.2.0      sha512-IYqDGiTXab6FniAgnSdZwgWbomxpy9FtYvLKs7wCUs2a8RkITG+DFGO1DM9cr+E3/RgADRpFjrKVaJ1z6sjtEg==
 *   @noble/post-quantum            0.5.2      sha512-etMDBkCuB95Xj/gfsWYBD2x+84IjL4uMLd/FhGoUUG/g+eh0K2eP7pJz1EmvpN8Df3vKdoWVAc7RxIBCHQfFHQ==
 *   mlkem                          2.7.0      sha512-I2bcB5d6jtkdan6MLGOxObpUbidqv0ej+PhbCGnXUqmcGYZ6X8F0qBpU6HE4mvYc81NSznBrVDp+Uc808Ba2RA==
 *   ts-mls                         1.6.2      sha512-Li0Ow/IkcV3x2Jk9zi7QaQlqPIegOFUtM1mfBvvJdCysU/byifYFKWpCkKfKpu2wRa9/RH8MaT+rq/JSheUYTQ==
 *
 * To verify: `npm ci && npm run build:mls` reproduces this file byte for
 * byte, header included — the header is derived from package-lock.json and
 * the bundler input list, so it carries no timestamps or machine state.
 */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@hpke/common/esm/src/errors.js
var HpkeError, InvalidParamError, SerializeError, DeserializeError, EncapError, DecapError, ExportError, SealError, OpenError, MessageLimitReachedError, DeriveKeyPairError, NotSupportedError;
var init_errors = __esm({
  "node_modules/@hpke/common/esm/src/errors.js"() {
    HpkeError = class extends Error {
      constructor(e) {
        let message;
        if (e instanceof Error) {
          message = e.message;
        } else if (typeof e === "string") {
          message = e;
        } else {
          message = "";
        }
        super(message);
        this.name = this.constructor.name;
      }
    };
    InvalidParamError = class extends HpkeError {
    };
    SerializeError = class extends HpkeError {
    };
    DeserializeError = class extends HpkeError {
    };
    EncapError = class extends HpkeError {
    };
    DecapError = class extends HpkeError {
    };
    ExportError = class extends HpkeError {
    };
    SealError = class extends HpkeError {
    };
    OpenError = class extends HpkeError {
    };
    MessageLimitReachedError = class extends HpkeError {
    };
    DeriveKeyPairError = class extends HpkeError {
    };
    NotSupportedError = class extends HpkeError {
    };
  }
});

// node_modules/@hpke/common/esm/_dnt.shims.js
function createMergeProxy(baseObj, extObj) {
  return new Proxy(baseObj, {
    get(_target, prop, _receiver) {
      if (prop in extObj) {
        return extObj[prop];
      } else {
        return baseObj[prop];
      }
    },
    set(_target, prop, value) {
      if (prop in extObj) {
        delete extObj[prop];
      }
      baseObj[prop] = value;
      return true;
    },
    deleteProperty(_target, prop) {
      let success = false;
      if (prop in extObj) {
        delete extObj[prop];
        success = true;
      }
      if (prop in baseObj) {
        delete baseObj[prop];
        success = true;
      }
      return success;
    },
    ownKeys(_target) {
      const baseKeys = Reflect.ownKeys(baseObj);
      const extKeys = Reflect.ownKeys(extObj);
      const extKeysSet = new Set(extKeys);
      return [...baseKeys.filter((k) => !extKeysSet.has(k)), ...extKeys];
    },
    defineProperty(_target, prop, desc) {
      if (prop in extObj) {
        delete extObj[prop];
      }
      Reflect.defineProperty(baseObj, prop, desc);
      return true;
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop in extObj) {
        return Reflect.getOwnPropertyDescriptor(extObj, prop);
      } else {
        return Reflect.getOwnPropertyDescriptor(baseObj, prop);
      }
    },
    has(_target, prop) {
      return prop in extObj || prop in baseObj;
    }
  });
}
var dntGlobals, dntGlobalThis;
var init_dnt_shims = __esm({
  "node_modules/@hpke/common/esm/_dnt.shims.js"() {
    dntGlobals = {};
    dntGlobalThis = createMergeProxy(globalThis, dntGlobals);
  }
});

// node_modules/@hpke/common/esm/src/algorithm.js
async function loadSubtleCrypto() {
  if (dntGlobalThis !== void 0 && globalThis.crypto !== void 0) {
    return globalThis.crypto.subtle;
  }
  try {
    const { webcrypto } = await import("crypto");
    return webcrypto.subtle;
  } catch (e) {
    throw new NotSupportedError(e);
  }
}
var NativeAlgorithm;
var init_algorithm = __esm({
  "node_modules/@hpke/common/esm/src/algorithm.js"() {
    init_dnt_shims();
    init_errors();
    NativeAlgorithm = class {
      constructor() {
        Object.defineProperty(this, "_api", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
      }
      async _setup() {
        if (this._api !== void 0) {
          return;
        }
        this._api = await loadSubtleCrypto();
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/identifiers.js
var Mode, KemId, KdfId, AeadId;
var init_identifiers = __esm({
  "node_modules/@hpke/common/esm/src/identifiers.js"() {
    Mode = {
      Base: 0,
      Psk: 1,
      Auth: 2,
      AuthPsk: 3
    };
    KemId = {
      NotAssigned: 0,
      DhkemP256HkdfSha256: 16,
      DhkemP384HkdfSha384: 17,
      DhkemP521HkdfSha512: 18,
      DhkemSecp256k1HkdfSha256: 19,
      DhkemX25519HkdfSha256: 32,
      DhkemX448HkdfSha512: 33,
      HybridkemX25519Kyber768: 48,
      MlKem512: 64,
      MlKem768: 65,
      MlKem1024: 66,
      XWing: 25722
    };
    KdfId = {
      HkdfSha256: 1,
      HkdfSha384: 2,
      HkdfSha512: 3,
      Sha3256: 4,
      Sha3384: 5,
      Sha3512: 6,
      Shake128: 16,
      Shake256: 17,
      TurboShake128: 18,
      TurboShake256: 19
    };
    AeadId = {
      Aes128Gcm: 1,
      Aes256Gcm: 2,
      Chacha20Poly1305: 3,
      ExportOnly: 65535
    };
  }
});

// node_modules/@hpke/common/esm/src/consts.js
var INPUT_LENGTH_LIMIT, INFO_LENGTH_LIMIT, MINIMUM_PSK_LENGTH, EMPTY, N_0, N_1, N_2, BYTE_TO_BIGINT_256;
var init_consts = __esm({
  "node_modules/@hpke/common/esm/src/consts.js"() {
    INPUT_LENGTH_LIMIT = 8192;
    INFO_LENGTH_LIMIT = 268435456;
    MINIMUM_PSK_LENGTH = 32;
    EMPTY = /* @__PURE__ */ new Uint8Array(0);
    N_0 = 0n;
    N_1 = 1n;
    N_2 = 2n;
    BYTE_TO_BIGINT_256 = /* @__PURE__ */ (() => {
      const out = new Array(256);
      let i = 0;
      let value = 0n;
      while (i < 256) {
        out[i] = value;
        i++;
        value += 1n;
      }
      return out;
    })();
  }
});

// node_modules/@hpke/common/esm/src/interfaces/kemInterface.js
var SUITE_ID_HEADER_KEM;
var init_kemInterface = __esm({
  "node_modules/@hpke/common/esm/src/interfaces/kemInterface.js"() {
    SUITE_ID_HEADER_KEM = /* @__PURE__ */ new Uint8Array([
      75,
      69,
      77,
      0,
      0
    ]);
  }
});

// node_modules/@hpke/common/esm/src/kdfs/hkdf.js
function toUint8Array(input) {
  return new Uint8Array(toArrayBuffer(input));
}
function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice().buffer;
  }
  return new Uint8Array(input).slice().buffer;
}
var HPKE_VERSION, HkdfNative, HkdfSha256Native, HkdfSha384Native, HkdfSha512Native;
var init_hkdf = __esm({
  "node_modules/@hpke/common/esm/src/kdfs/hkdf.js"() {
    init_consts();
    init_errors();
    init_identifiers();
    init_algorithm();
    HPKE_VERSION = /* @__PURE__ */ new Uint8Array([
      72,
      80,
      75,
      69,
      45,
      118,
      49
    ]);
    HkdfNative = class extends NativeAlgorithm {
      constructor() {
        super();
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: KdfId.HkdfSha256
        });
        Object.defineProperty(this, "hashSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_suiteId", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: EMPTY
        });
        Object.defineProperty(this, "algHash", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: {
            name: "HMAC",
            hash: "SHA-256",
            length: 256
          }
        });
      }
      init(suiteId) {
        this._suiteId = suiteId;
      }
      buildLabeledIkm(label, ikm) {
        this._checkInit();
        const ret = new Uint8Array(7 + this._suiteId.byteLength + label.byteLength + ikm.byteLength);
        ret.set(HPKE_VERSION, 0);
        ret.set(this._suiteId, 7);
        ret.set(label, 7 + this._suiteId.byteLength);
        ret.set(ikm, 7 + this._suiteId.byteLength + label.byteLength);
        return ret;
      }
      buildLabeledInfo(label, info, len) {
        this._checkInit();
        const ret = new Uint8Array(9 + this._suiteId.byteLength + label.byteLength + info.byteLength);
        ret.set(new Uint8Array([0, len]), 0);
        ret.set(HPKE_VERSION, 2);
        ret.set(this._suiteId, 9);
        ret.set(label, 9 + this._suiteId.byteLength);
        ret.set(info, 9 + this._suiteId.byteLength + label.byteLength);
        return ret;
      }
      async extract(salt, ikm) {
        await this._setup();
        const saltBuf = salt.byteLength === 0 ? new ArrayBuffer(this.hashSize) : toArrayBuffer(salt);
        if (saltBuf.byteLength !== this.hashSize) {
          throw new InvalidParamError("The salt length must be the same as the hashSize");
        }
        const ikmBuf = toArrayBuffer(ikm);
        const key = await this._api.importKey("raw", saltBuf, this.algHash, false, [
          "sign"
        ]);
        return await this._api.sign("HMAC", key, ikmBuf);
      }
      async expand(prk, info, len) {
        await this._setup();
        const prkBuf = toArrayBuffer(prk);
        const key = await this._api.importKey("raw", prkBuf, this.algHash, false, [
          "sign"
        ]);
        const okm = new ArrayBuffer(len);
        const okmBytes = new Uint8Array(okm);
        let prev = EMPTY;
        const mid = toUint8Array(info);
        const tail = new Uint8Array(1);
        if (len > 255 * this.hashSize) {
          throw new Error("Entropy limit reached");
        }
        const tmp = new Uint8Array(this.hashSize + mid.length + 1);
        for (let i = 1, cur = 0; cur < okmBytes.length; i++) {
          tail[0] = i;
          tmp.set(prev, 0);
          tmp.set(mid, prev.length);
          tmp.set(tail, prev.length + mid.length);
          prev = new Uint8Array(await this._api.sign("HMAC", key, tmp.slice(0, prev.length + mid.length + 1)));
          if (okmBytes.length - cur >= prev.length) {
            okmBytes.set(prev, cur);
            cur += prev.length;
          } else {
            okmBytes.set(prev.slice(0, okmBytes.length - cur), cur);
            cur += okmBytes.length - cur;
          }
        }
        return okm;
      }
      async extractAndExpand(salt, ikm, info, len) {
        await this._setup();
        const ikmBuf = toArrayBuffer(ikm);
        const baseKey = await this._api.importKey("raw", ikmBuf, "HKDF", false, ["deriveBits"]);
        return await this._api.deriveBits({
          name: "HKDF",
          hash: this.algHash.hash,
          salt: toArrayBuffer(salt),
          info: toArrayBuffer(info)
        }, baseKey, len * 8);
      }
      async labeledExtract(salt, label, ikm) {
        return await this.extract(salt, this.buildLabeledIkm(label, ikm));
      }
      async labeledExpand(prk, label, info, len) {
        return await this.expand(prk, this.buildLabeledInfo(label, info, len), len);
      }
      _checkInit() {
        if (this._suiteId === EMPTY) {
          throw new Error("Not initialized. Call init()");
        }
      }
    };
    HkdfSha256Native = class extends HkdfNative {
      constructor() {
        super(...arguments);
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: KdfId.HkdfSha256
        });
        Object.defineProperty(this, "hashSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 32
        });
        Object.defineProperty(this, "algHash", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: {
            name: "HMAC",
            hash: "SHA-256",
            length: 256
          }
        });
      }
    };
    HkdfSha384Native = class extends HkdfNative {
      constructor() {
        super(...arguments);
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: KdfId.HkdfSha384
        });
        Object.defineProperty(this, "hashSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 48
        });
        Object.defineProperty(this, "algHash", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: {
            name: "HMAC",
            hash: "SHA-384",
            length: 384
          }
        });
      }
    };
    HkdfSha512Native = class extends HkdfNative {
      constructor() {
        super(...arguments);
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: KdfId.HkdfSha512
        });
        Object.defineProperty(this, "hashSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 64
        });
        Object.defineProperty(this, "algHash", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: {
            name: "HMAC",
            hash: "SHA-512",
            length: 512
          }
        });
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/utils/misc.js
function i2Osp(n, w) {
  if (w <= 0) {
    throw new Error("i2Osp: too small size");
  }
  if (n >= 256 ** w) {
    throw new Error("i2Osp: too large integer");
  }
  const ret = new Uint8Array(w);
  for (let i = 0; i < w && n; i++) {
    ret[w - (i + 1)] = n % 256;
    n = Math.floor(n / 256);
  }
  return ret;
}
function concat(a, b) {
  const ret = new Uint8Array(a.length + b.length);
  ret.set(a, 0);
  ret.set(b, a.length);
  return ret;
}
function base64UrlToBytes(v) {
  const base64 = v.replace(/-/g, "+").replace(/_/g, "/");
  const byteString = atob(base64);
  const ret = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ret[i] = byteString.charCodeAt(i);
  }
  return ret;
}
async function loadCrypto() {
  if (typeof dntGlobalThis !== "undefined" && globalThis.crypto !== void 0) {
    return globalThis.crypto;
  }
  try {
    const { webcrypto } = await import("crypto");
    return webcrypto;
  } catch (_e) {
    throw new Error("failed to load Crypto");
  }
}
function xor(a, b) {
  if (a.byteLength !== b.byteLength) {
    throw new Error("xor: different length inputs");
  }
  const buf = new Uint8Array(a.byteLength);
  for (let i = 0; i < a.byteLength; i++) {
    buf[i] = a[i] ^ b[i];
  }
  return buf;
}
var isCryptoKeyPair;
var init_misc = __esm({
  "node_modules/@hpke/common/esm/src/utils/misc.js"() {
    init_dnt_shims();
    init_identifiers();
    isCryptoKeyPair = (x) => typeof x === "object" && x !== null && typeof x.privateKey === "object" && typeof x.publicKey === "object";
  }
});

// node_modules/@hpke/common/esm/src/kems/dhkem.js
function concat3(a, b, c) {
  const ret = new Uint8Array(a.length + b.length + c.length);
  ret.set(a, 0);
  ret.set(b, a.length);
  ret.set(c, a.length + b.length);
  return ret;
}
var LABEL_EAE_PRK, LABEL_SHARED_SECRET, Dhkem;
var init_dhkem = __esm({
  "node_modules/@hpke/common/esm/src/kems/dhkem.js"() {
    init_consts();
    init_errors();
    init_kemInterface();
    init_hkdf();
    init_misc();
    LABEL_EAE_PRK = /* @__PURE__ */ new Uint8Array([
      101,
      97,
      101,
      95,
      112,
      114,
      107
    ]);
    LABEL_SHARED_SECRET = /* @__PURE__ */ new Uint8Array([
      115,
      104,
      97,
      114,
      101,
      100,
      95,
      115,
      101,
      99,
      114,
      101,
      116
    ]);
    Dhkem = class {
      constructor(id2, prim, kdf) {
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "secretSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "encSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "publicKeySize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "privateKeySize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_prim", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_kdf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.id = id2;
        this._prim = prim;
        this._kdf = kdf;
        const suiteId = new Uint8Array(SUITE_ID_HEADER_KEM);
        suiteId.set(i2Osp(this.id, 2), 3);
        this._kdf.init(suiteId);
      }
      async serializePublicKey(key) {
        return await this._prim.serializePublicKey(key);
      }
      async deserializePublicKey(key) {
        return await this._prim.deserializePublicKey(toArrayBuffer(key));
      }
      async serializePrivateKey(key) {
        return await this._prim.serializePrivateKey(key);
      }
      async deserializePrivateKey(key) {
        return await this._prim.deserializePrivateKey(toArrayBuffer(key));
      }
      async importKey(format, key, isPublic = true) {
        return await this._prim.importKey(format, key, isPublic);
      }
      async generateKeyPair() {
        return await this._prim.generateKeyPair();
      }
      async deriveKeyPair(ikm) {
        const rawIkm = toArrayBuffer(ikm);
        if (rawIkm.byteLength > INPUT_LENGTH_LIMIT) {
          throw new InvalidParamError("Too long ikm");
        }
        return await this._prim.deriveKeyPair(rawIkm);
      }
      async encap(params) {
        let ke;
        if (params.ekm === void 0) {
          ke = await this.generateKeyPair();
        } else if (isCryptoKeyPair(params.ekm)) {
          ke = params.ekm;
        } else {
          ke = await this.deriveKeyPair(params.ekm);
        }
        const enc = await this._prim.serializePublicKey(ke.publicKey);
        const pkrm = await this._prim.serializePublicKey(params.recipientPublicKey);
        try {
          let dh;
          if (params.senderKey === void 0) {
            dh = new Uint8Array(await this._prim.dh(ke.privateKey, params.recipientPublicKey));
          } else {
            const sks = isCryptoKeyPair(params.senderKey) ? params.senderKey.privateKey : params.senderKey;
            const dh1 = new Uint8Array(await this._prim.dh(ke.privateKey, params.recipientPublicKey));
            const dh2 = new Uint8Array(await this._prim.dh(sks, params.recipientPublicKey));
            dh = concat(dh1, dh2);
          }
          let kemContext;
          if (params.senderKey === void 0) {
            kemContext = concat(new Uint8Array(enc), new Uint8Array(pkrm));
          } else {
            const pks = isCryptoKeyPair(params.senderKey) ? params.senderKey.publicKey : await this._prim.derivePublicKey(params.senderKey);
            const pksm = await this._prim.serializePublicKey(pks);
            kemContext = concat3(new Uint8Array(enc), new Uint8Array(pkrm), new Uint8Array(pksm));
          }
          const sharedSecret = await this._generateSharedSecret(dh, kemContext);
          return {
            enc,
            sharedSecret
          };
        } catch (e) {
          throw new EncapError(e);
        }
      }
      async decap(params) {
        const enc = toArrayBuffer(params.enc);
        const pke = await this._prim.deserializePublicKey(enc);
        const skr = isCryptoKeyPair(params.recipientKey) ? params.recipientKey.privateKey : params.recipientKey;
        const pkr = isCryptoKeyPair(params.recipientKey) ? params.recipientKey.publicKey : await this._prim.derivePublicKey(params.recipientKey);
        const pkrm = await this._prim.serializePublicKey(pkr);
        try {
          let dh;
          if (params.senderPublicKey === void 0) {
            dh = new Uint8Array(await this._prim.dh(skr, pke));
          } else {
            const dh1 = new Uint8Array(await this._prim.dh(skr, pke));
            const dh2 = new Uint8Array(await this._prim.dh(skr, params.senderPublicKey));
            dh = concat(dh1, dh2);
          }
          let kemContext;
          if (params.senderPublicKey === void 0) {
            kemContext = concat(new Uint8Array(enc), new Uint8Array(pkrm));
          } else {
            const pksm = await this._prim.serializePublicKey(params.senderPublicKey);
            kemContext = new Uint8Array(enc.byteLength + pkrm.byteLength + pksm.byteLength);
            kemContext.set(new Uint8Array(enc), 0);
            kemContext.set(new Uint8Array(pkrm), enc.byteLength);
            kemContext.set(new Uint8Array(pksm), enc.byteLength + pkrm.byteLength);
          }
          return await this._generateSharedSecret(dh, kemContext);
        } catch (e) {
          throw new DecapError(e);
        }
      }
      async _generateSharedSecret(dh, kemContext) {
        const labeledIkm = this._kdf.buildLabeledIkm(LABEL_EAE_PRK, dh);
        const labeledInfo = this._kdf.buildLabeledInfo(LABEL_SHARED_SECRET, kemContext, this.secretSize);
        return await this._kdf.extractAndExpand(EMPTY, labeledIkm, labeledInfo, this.secretSize);
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/interfaces/dhkemPrimitives.js
var KEM_USAGES, LABEL_DKP_PRK, LABEL_SK;
var init_dhkemPrimitives = __esm({
  "node_modules/@hpke/common/esm/src/interfaces/dhkemPrimitives.js"() {
    KEM_USAGES = ["deriveBits"];
    LABEL_DKP_PRK = /* @__PURE__ */ new Uint8Array([
      100,
      107,
      112,
      95,
      112,
      114,
      107
    ]);
    LABEL_SK = /* @__PURE__ */ new Uint8Array([115, 107]);
  }
});

// node_modules/@hpke/common/esm/src/utils/bignum.js
var Bignum;
var init_bignum = __esm({
  "node_modules/@hpke/common/esm/src/utils/bignum.js"() {
    Bignum = class {
      constructor(size) {
        Object.defineProperty(this, "_num", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this._num = new Uint8Array(size);
      }
      val() {
        return this._num;
      }
      reset() {
        this._num.fill(0);
      }
      set(src) {
        if (src.length !== this._num.length) {
          throw new Error("Bignum.set: invalid argument");
        }
        this._num.set(src);
      }
      isZero() {
        for (let i = 0; i < this._num.length; i++) {
          if (this._num[i] !== 0) {
            return false;
          }
        }
        return true;
      }
      lessThan(v) {
        if (v.length !== this._num.length) {
          throw new Error("Bignum.lessThan: invalid argument");
        }
        for (let i = 0; i < this._num.length; i++) {
          if (this._num[i] < v[i]) {
            return true;
          }
          if (this._num[i] > v[i]) {
            return false;
          }
        }
        return false;
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/kems/dhkemPrimitives/ec.js
function mod(a, p) {
  const r = a % p;
  return r >= 0n ? r : r + p;
}
function modPow(base, exponent, p) {
  let result = 1n;
  let b = mod(base, p);
  let e = exponent;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = mod(result * b, p);
    }
    b = mod(b * b, p);
    e >>= 1n;
  }
  return result;
}
function modSqrt(rhs, p) {
  const y = modPow(rhs, p + 1n >> 2n, p);
  if (mod(y * y, p) !== mod(rhs, p)) {
    throw new Error("Invalid ECDH point");
  }
  return y;
}
function bytesToBigInt(bytes) {
  let v = 0n;
  for (const b of bytes) {
    v = v << 8n | BYTE_TO_BIGINT_256[b];
  }
  return v;
}
function bigIntToBytes(v, len) {
  const out = new Uint8Array(len);
  let n = v;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) {
    throw new Error("Invalid coordinate length");
  }
  return out;
}
function buildRawUncompressedPublicKey(x, y, coordinateSize) {
  const out = new Uint8Array(1 + coordinateSize * 2);
  out[0] = 4;
  out.set(bigIntToBytes(x, coordinateSize), 1);
  out.set(bigIntToBytes(y, coordinateSize), 1 + coordinateSize);
  return out;
}
var LABEL_CANDIDATE, ORDER_P_256, ORDER_P_384, ORDER_P_521, PKCS8_ALG_ID_P_256, PKCS8_ALG_ID_P_384, PKCS8_ALG_ID_P_521, EC_P_256_PARAMS, EC_P_384_PARAMS, EC_P_521_PARAMS, Ec;
var init_ec = __esm({
  "node_modules/@hpke/common/esm/src/kems/dhkemPrimitives/ec.js"() {
    init_algorithm();
    init_consts();
    init_hkdf();
    init_errors();
    init_identifiers();
    init_dhkemPrimitives();
    init_bignum();
    init_misc();
    LABEL_CANDIDATE = /* @__PURE__ */ new Uint8Array([
      99,
      97,
      110,
      100,
      105,
      100,
      97,
      116,
      101
    ]);
    ORDER_P_256 = /* @__PURE__ */ new Uint8Array([
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      188,
      230,
      250,
      173,
      167,
      23,
      158,
      132,
      243,
      185,
      202,
      194,
      252,
      99,
      37,
      81
    ]);
    ORDER_P_384 = /* @__PURE__ */ new Uint8Array([
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      199,
      99,
      77,
      129,
      244,
      55,
      45,
      223,
      88,
      26,
      13,
      178,
      72,
      176,
      167,
      122,
      236,
      236,
      25,
      106,
      204,
      197,
      41,
      115
    ]);
    ORDER_P_521 = /* @__PURE__ */ new Uint8Array([
      1,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      250,
      81,
      134,
      135,
      131,
      191,
      47,
      150,
      107,
      127,
      204,
      1,
      72,
      247,
      9,
      165,
      208,
      59,
      181,
      201,
      184,
      137,
      156,
      71,
      174,
      187,
      111,
      183,
      30,
      145,
      56,
      100,
      9
    ]);
    PKCS8_ALG_ID_P_256 = /* @__PURE__ */ new Uint8Array([
      48,
      65,
      2,
      1,
      0,
      48,
      19,
      6,
      7,
      42,
      134,
      72,
      206,
      61,
      2,
      1,
      6,
      8,
      42,
      134,
      72,
      206,
      61,
      3,
      1,
      7,
      4,
      39,
      48,
      37,
      2,
      1,
      1,
      4,
      32
    ]);
    PKCS8_ALG_ID_P_384 = /* @__PURE__ */ new Uint8Array([
      48,
      78,
      2,
      1,
      0,
      48,
      16,
      6,
      7,
      42,
      134,
      72,
      206,
      61,
      2,
      1,
      6,
      5,
      43,
      129,
      4,
      0,
      34,
      4,
      55,
      48,
      53,
      2,
      1,
      1,
      4,
      48
    ]);
    PKCS8_ALG_ID_P_521 = /* @__PURE__ */ new Uint8Array([
      48,
      96,
      2,
      1,
      0,
      48,
      16,
      6,
      7,
      42,
      134,
      72,
      206,
      61,
      2,
      1,
      6,
      5,
      43,
      129,
      4,
      0,
      35,
      4,
      73,
      48,
      71,
      2,
      1,
      1,
      4,
      66
    ]);
    EC_P_256_PARAMS = {
      p: 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn,
      b: 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn,
      gx: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
      gy: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
      coordinateSize: 32
    };
    EC_P_384_PARAMS = {
      p: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn,
      b: 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn,
      gx: 0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7n,
      gy: 0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5fn,
      coordinateSize: 48
    };
    EC_P_521_PARAMS = {
      p: (1n << 521n) - 1n,
      b: 0x0051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00n,
      gx: 0x00c6858e06b70404e9cd9e3ecb662395b4429c648139053fb521f828af606b4d3dbaa14b5e77efe75928fe1dc127a2ffa8de3348b3c1856a429bf97e7e31c2e5bd66n,
      gy: 0x011839296a789a3bc0045c8a5fb42c7d1bd998f54449579b446817afbd17273e662c97ee72995ef42640c550b9013fad0761353c7086a272c24088be94769fd16650n,
      coordinateSize: 66
    };
    Ec = class extends NativeAlgorithm {
      constructor(kem, hkdf) {
        super();
        Object.defineProperty(this, "_hkdf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_alg", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_nPk", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_nSk", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_nDh", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_order", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_bitmask", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_pkcs8AlgId", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_curveParams", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this._hkdf = hkdf;
        switch (kem) {
          case KemId.DhkemP256HkdfSha256:
            this._alg = { name: "ECDH", namedCurve: "P-256" };
            this._nPk = 65;
            this._nSk = 32;
            this._nDh = 32;
            this._order = ORDER_P_256;
            this._bitmask = 255;
            this._pkcs8AlgId = PKCS8_ALG_ID_P_256;
            this._curveParams = EC_P_256_PARAMS;
            break;
          case KemId.DhkemP384HkdfSha384:
            this._alg = { name: "ECDH", namedCurve: "P-384" };
            this._nPk = 97;
            this._nSk = 48;
            this._nDh = 48;
            this._order = ORDER_P_384;
            this._bitmask = 255;
            this._pkcs8AlgId = PKCS8_ALG_ID_P_384;
            this._curveParams = EC_P_384_PARAMS;
            break;
          default:
            this._alg = { name: "ECDH", namedCurve: "P-521" };
            this._nPk = 133;
            this._nSk = 66;
            this._nDh = 66;
            this._order = ORDER_P_521;
            this._bitmask = 1;
            this._pkcs8AlgId = PKCS8_ALG_ID_P_521;
            this._curveParams = EC_P_521_PARAMS;
            break;
        }
      }
      async serializePublicKey(key) {
        await this._setup();
        try {
          return await this._api.exportKey("raw", key);
        } catch (e) {
          throw new SerializeError(e);
        }
      }
      async deserializePublicKey(key) {
        await this._setup();
        try {
          return await this._importRawKey(toArrayBuffer(key), true);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      async serializePrivateKey(key) {
        await this._setup();
        try {
          const jwk = await this._api.exportKey("jwk", key);
          if (!("d" in jwk)) {
            throw new Error("Not private key");
          }
          return base64UrlToBytes(jwk["d"]).buffer;
        } catch (e) {
          throw new SerializeError(e);
        }
      }
      async deserializePrivateKey(key) {
        await this._setup();
        try {
          return await this._importRawKey(toArrayBuffer(key), false);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      async importKey(format, key, isPublic) {
        await this._setup();
        try {
          if (format === "raw") {
            return await this._importRawKey(key, isPublic);
          }
          if (key instanceof ArrayBuffer) {
            throw new Error("Invalid jwk key format");
          }
          return await this._importJWK(key, isPublic);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      async generateKeyPair() {
        await this._setup();
        try {
          return await this._api.generateKey(this._alg, true, KEM_USAGES);
        } catch (e) {
          throw new NotSupportedError(e);
        }
      }
      async deriveKeyPair(ikm) {
        await this._setup();
        try {
          const rawIkm = toArrayBuffer(ikm);
          const dkpPrk = await this._hkdf.labeledExtract(EMPTY, LABEL_DKP_PRK, new Uint8Array(rawIkm));
          const bn = new Bignum(this._nSk);
          for (let counter = 0; bn.isZero() || !bn.lessThan(this._order); counter++) {
            if (counter > 255) {
              throw new Error("Faild to derive a key pair");
            }
            const bytes = new Uint8Array(await this._hkdf.labeledExpand(dkpPrk, LABEL_CANDIDATE, i2Osp(counter, 1), this._nSk));
            bytes[0] = bytes[0] & this._bitmask;
            bn.set(bytes);
          }
          const sk = await this._deserializePkcs8Key(bn.val());
          bn.reset();
          return {
            privateKey: sk,
            publicKey: await this.derivePublicKey(sk)
          };
        } catch (e) {
          throw new DeriveKeyPairError(e);
        }
      }
      async derivePublicKey(key) {
        await this._setup();
        try {
          const jwk = await this._api.exportKey("jwk", key);
          delete jwk["d"];
          delete jwk["key_ops"];
          return await this._api.importKey("jwk", jwk, this._alg, true, []);
        } catch {
          try {
            return await this._derivePublicKeyWithoutJwkExport(key);
          } catch (e) {
            throw new DeserializeError(e);
          }
        }
      }
      async dh(sk, pk) {
        try {
          await this._setup();
          const bits = await this._api.deriveBits({
            name: "ECDH",
            public: pk
          }, sk, this._nDh * 8);
          return bits;
        } catch (e) {
          throw new SerializeError(e);
        }
      }
      async _importRawKey(key, isPublic) {
        if (isPublic && key.byteLength !== this._nPk) {
          throw new Error("Invalid public key for the ciphersuite");
        }
        if (!isPublic && key.byteLength !== this._nSk) {
          throw new Error("Invalid private key for the ciphersuite");
        }
        if (isPublic) {
          return await this._api.importKey("raw", key, this._alg, true, []);
        }
        return await this._deserializePkcs8Key(new Uint8Array(key));
      }
      async _importJWK(key, isPublic) {
        if (typeof key.crv === "undefined" || key.crv !== this._alg.namedCurve) {
          throw new Error(`Invalid crv: ${key.crv}`);
        }
        if (isPublic) {
          if (typeof key.d !== "undefined") {
            throw new Error("Invalid key: `d` should not be set");
          }
          return await this._api.importKey("jwk", key, this._alg, true, []);
        }
        if (typeof key.d === "undefined") {
          throw new Error("Invalid key: `d` not found");
        }
        return await this._api.importKey("jwk", key, this._alg, true, KEM_USAGES);
      }
      async _deserializePkcs8Key(k) {
        const pkcs8Key = new Uint8Array(this._pkcs8AlgId.length + k.length);
        pkcs8Key.set(this._pkcs8AlgId, 0);
        pkcs8Key.set(k, this._pkcs8AlgId.length);
        return await this._api.importKey("pkcs8", pkcs8Key, this._alg, true, KEM_USAGES);
      }
      async _derivePublicKeyWithoutJwkExport(key) {
        const basePointRaw = buildRawUncompressedPublicKey(this._curveParams.gx, this._curveParams.gy, this._curveParams.coordinateSize);
        const basePoint = await this._api.importKey("raw", basePointRaw.buffer, this._alg, true, []);
        const xBytes = new Uint8Array(await this._api.deriveBits({
          name: "ECDH",
          public: basePoint
        }, key, this._nDh * 8));
        const p = this._curveParams.p;
        const x = bytesToBigInt(xBytes);
        const rhs = mod(modPow(x, 3n, p) - 3n * x + this._curveParams.b, p);
        let y = modSqrt(rhs, p);
        if ((y & 1n) === 1n) {
          y = p - y;
        }
        const pubRaw = buildRawUncompressedPublicKey(x, y, this._curveParams.coordinateSize);
        return await this._api.importKey("raw", pubRaw.buffer, this._alg, true, []);
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/xCryptoKey.js
var XCryptoKey;
var init_xCryptoKey = __esm({
  "node_modules/@hpke/common/esm/src/xCryptoKey.js"() {
    XCryptoKey = class {
      constructor(name, key, type, usages = []) {
        Object.defineProperty(this, "key", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "type", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "extractable", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: true
        });
        Object.defineProperty(this, "algorithm", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "usages", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.key = key;
        this.type = type;
        this.algorithm = { name };
        this.usages = usages;
        if (type === "public") {
          this.usages = [];
        }
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/kems/dhkemPrimitives/xCurve.js
var XCurveDhkemPrimitives;
var init_xCurve = __esm({
  "node_modules/@hpke/common/esm/src/kems/dhkemPrimitives/xCurve.js"() {
    init_consts();
    init_errors();
    init_hkdf();
    init_dhkemPrimitives();
    init_misc();
    init_xCryptoKey();
    XCurveDhkemPrimitives = class {
      constructor(algName, keySize, curve, hkdf) {
        Object.defineProperty(this, "_algName", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_curve", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_hkdf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_nPk", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_nSk", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this._algName = algName;
        this._nPk = keySize;
        this._nSk = keySize;
        this._curve = curve;
        this._hkdf = hkdf;
      }
      serializePublicKey(key) {
        try {
          return Promise.resolve(key.key.buffer);
        } catch (e) {
          return Promise.reject(new SerializeError(e));
        }
      }
      async deserializePublicKey(key) {
        try {
          return await this._importRawKey(toArrayBuffer(key), true);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      serializePrivateKey(key) {
        try {
          return Promise.resolve(key.key.buffer);
        } catch (e) {
          return Promise.reject(new SerializeError(e));
        }
      }
      async deserializePrivateKey(key) {
        try {
          return await this._importRawKey(toArrayBuffer(key), false);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      async importKey(format, key, isPublic) {
        try {
          if (format === "raw") {
            return await this._importRawKey(key, isPublic);
          }
          if (key instanceof ArrayBuffer) {
            throw new Error("Invalid jwk key format");
          }
          return await this._importJWK(key, isPublic);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      async generateKeyPair() {
        try {
          const rawSk = await this._curve.utils.randomSecretKey();
          const sk = new XCryptoKey(this._algName, rawSk, "private", KEM_USAGES);
          const pk = await this.derivePublicKey(sk);
          return { publicKey: pk, privateKey: sk };
        } catch (e) {
          throw new NotSupportedError(e);
        }
      }
      async deriveKeyPair(ikm) {
        try {
          const rawIkm = toArrayBuffer(ikm);
          const dkpPrk = await this._hkdf.labeledExtract(EMPTY.buffer, LABEL_DKP_PRK, new Uint8Array(rawIkm));
          const rawSk = await this._hkdf.labeledExpand(dkpPrk, LABEL_SK, EMPTY, this._nSk);
          const sk = new XCryptoKey(this._algName, new Uint8Array(rawSk), "private", KEM_USAGES);
          return {
            privateKey: sk,
            publicKey: await this.derivePublicKey(sk)
          };
        } catch (e) {
          throw new DeriveKeyPairError(e);
        }
      }
      derivePublicKey(key) {
        try {
          const pk = this._curve.getPublicKey(key.key);
          return Promise.resolve(new XCryptoKey(this._algName, pk, "public"));
        } catch (e) {
          return Promise.reject(new DeserializeError(e));
        }
      }
      dh(sk, pk) {
        try {
          return Promise.resolve(this._curve.getSharedSecret(sk.key, pk.key).buffer);
        } catch (e) {
          return Promise.reject(new SerializeError(e));
        }
      }
      _importRawKey(key, isPublic) {
        return new Promise((resolve, reject) => {
          if (isPublic && key.byteLength !== this._nPk) {
            reject(new Error("Invalid length of the key"));
          }
          if (!isPublic && key.byteLength !== this._nSk) {
            reject(new Error("Invalid length of the key"));
          }
          resolve(new XCryptoKey(this._algName, new Uint8Array(key), isPublic ? "public" : "private", isPublic ? [] : KEM_USAGES));
        });
      }
      _importJWK(key, isPublic) {
        return new Promise((resolve, reject) => {
          if (key.kty !== "OKP") {
            reject(new Error(`Invalid kty: ${key.kty}`));
          }
          if (key.crv !== this._algName) {
            reject(new Error(`Invalid crv: ${key.crv}`));
          }
          if (isPublic) {
            if (typeof key.d !== "undefined") {
              reject(new Error("Invalid key: `d` should not be set"));
            }
            if (typeof key.x !== "string") {
              reject(new Error("Invalid key: `x` not found"));
            }
            resolve(new XCryptoKey(this._algName, base64UrlToBytes(key.x), "public"));
          } else {
            if (typeof key.d !== "string") {
              reject(new Error("Invalid key: `d` not found"));
            }
            resolve(new XCryptoKey(this._algName, base64UrlToBytes(key.d), "private", KEM_USAGES));
          }
        });
      }
    };
  }
});

// node_modules/@hpke/common/esm/src/kems/hybridkem.js
var init_hybridkem = __esm({
  "node_modules/@hpke/common/esm/src/kems/hybridkem.js"() {
    init_consts();
    init_errors();
    init_hkdf();
    init_identifiers();
    init_dhkemPrimitives();
    init_kemInterface();
    init_misc();
    init_xCryptoKey();
  }
});

// node_modules/@hpke/common/esm/src/interfaces/aeadEncryptionContext.js
var AEAD_USAGES;
var init_aeadEncryptionContext = __esm({
  "node_modules/@hpke/common/esm/src/interfaces/aeadEncryptionContext.js"() {
    AEAD_USAGES = ["encrypt", "decrypt"];
  }
});

// node_modules/@hpke/common/esm/src/utils/noble.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n, title = "") {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new Error(`${prefix}expected integer >0, got ${n}`);
  }
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished) {
    throw new Error("Hash#digest() has already been called");
  }
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function abignumer(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new Error("positive bigint expected, got " + n);
  } else
    anumber(n);
  return n;
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes(hex) {
  if (typeof hex !== "string") {
    throw new Error("hex string expected, got " + typeof hex);
  }
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2) {
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  }
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function hexToNumber(hex) {
  if (typeof hex !== "string") {
    throw new Error("hex string expected, got " + typeof hex);
  }
  let out = N_0;
  for (let i = 0; i < hex.length; i++) {
    const n = asciiToBase16(hex.charCodeAt(i));
    if (n === void 0) {
      throw new Error('hex string expected, got non-hex character "' + hex[i] + '" at index ' + i);
    }
    out = out << 4n | HEX_TO_BIGINT[n];
  }
  return out;
}
function numberToBigint(num) {
  anumber(num, "numberToBigint");
  let n = num;
  let out = N_0;
  let bit = 1n;
  while (n > 0) {
    if (n % 2 === 1)
      out += bit;
    n = Math.floor(n / 2);
    bit <<= 1n;
  }
  return out;
}
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber(len);
  n = abignumer(n);
  const res = hexToBytes(n.toString(16).padStart(len * 2, "0"));
  if (res.length !== len)
    throw new Error("number too large");
  return res;
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function copyBytes(bytes) {
  return Uint8Array.from(bytes);
}
function isPosBig(n) {
  return typeof n === "bigint" && N_0 <= n;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max)) {
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
  }
}
function validateObject(object, fields = {}, optFields = {}) {
  if (!object || typeof object !== "object") {
    throw new Error("expected valid options object");
  }
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null) {
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
    }
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}
async function randomBytesAsync(bytesLength = 32) {
  const api = await loadCrypto();
  const rnd = new Uint8Array(bytesLength);
  api.getRandomValues(rnd);
  return rnd;
}
function oidNist(suffix) {
  return {
    oid: Uint8Array.from([
      6,
      9,
      96,
      134,
      72,
      1,
      101,
      3,
      4,
      2,
      suffix
    ])
  };
}
var _endianTestBuffer, _endianTestBytes, isLE, hasHexBuiltin, hexes, HEX_TO_BIGINT, asciis;
var init_noble = __esm({
  "node_modules/@hpke/common/esm/src/utils/noble.js"() {
    init_misc();
    init_consts();
    _endianTestBuffer = /* @__PURE__ */ new Uint32Array([287454020]);
    _endianTestBytes = /* @__PURE__ */ new Uint8Array(_endianTestBuffer.buffer);
    isLE = _endianTestBytes[0] === 68;
    hasHexBuiltin = /* @__PURE__ */ (() => (
      // @ts-ignore: to use toHex
      typeof Uint8Array.from([]).toHex === "function" && // @ts-ignore: to use fromHex
      typeof Uint8Array.fromHex === "function"
    ))();
    hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    HEX_TO_BIGINT = [
      0n,
      1n,
      2n,
      3n,
      4n,
      5n,
      6n,
      7n,
      8n,
      9n,
      10n,
      11n,
      12n,
      13n,
      14n,
      15n
    ];
    asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
  }
});

// node_modules/@hpke/common/esm/src/hash/hash.js
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function") {
    throw new Error("Hash must wrapped by utils.createHasher");
  }
  anumber(h.outputLen);
  anumber(h.blockLen);
}
function createHasher(hashCons, info = {}) {
  const hashFn = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  const hashC = Object.assign(hashFn, {
    outputLen: tmp.outputLen,
    blockLen: tmp.blockLen,
    create: (opts) => hashCons(opts),
    ...info
  });
  return Object.freeze(hashC);
}
var init_hash = __esm({
  "node_modules/@hpke/common/esm/src/hash/hash.js"() {
    init_noble();
  }
});

// node_modules/@hpke/common/esm/src/hash/hmac.js
var _HMAC, hmac;
var init_hmac = __esm({
  "node_modules/@hpke/common/esm/src/hash/hmac.js"() {
    init_noble();
    init_hash();
    _HMAC = class {
      constructor(hash, key) {
        Object.defineProperty(this, "oHash", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "iHash", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "blockLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "outputLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "finished", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        Object.defineProperty(this, "destroyed", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        ahash(hash);
        abytes(key, void 0, "key");
        this.iHash = hash.create();
        if (typeof this.iHash.update !== "function") {
          throw new Error("Expected instance of class which extends utils.Hash");
        }
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad = new Uint8Array(blockLen);
        pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54;
        this.iHash.update(pad);
        this.oHash = hash.create();
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54 ^ 92;
        this.oHash.update(pad);
        clean(pad);
      }
      update(buf) {
        aexists(this);
        this.iHash.update(buf);
        return this;
      }
      digestInto(out) {
        aexists(this);
        abytes(out, this.outputLen, "output");
        this.finished = true;
        this.iHash.digestInto(out);
        this.oHash.update(out);
        this.oHash.digestInto(out);
        this.destroy();
      }
      digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
      }
      _cloneInto(to) {
        to ||= Object.create(Object.getPrototypeOf(this), {});
        const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
      destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
      }
    };
    hmac = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
    hmac.create = (hash, key) => new _HMAC(hash, key);
  }
});

// node_modules/@hpke/common/esm/src/hash/md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD, SHA256_IV;
var init_md = __esm({
  "node_modules/@hpke/common/esm/src/hash/md.js"() {
    init_noble();
    HashMD = class {
      constructor(blockLen, outputLen, padOffset, isLE7) {
        Object.defineProperty(this, "blockLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "outputLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "padOffset", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "isLE", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "buffer", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "view", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "finished", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        Object.defineProperty(this, "length", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "pos", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "destroyed", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE7;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView(this.buffer);
      }
      update(data) {
        aexists(this);
        abytes(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = createView(data);
            for (; blockLen <= len - pos; pos += blockLen) {
              this.process(dataView, pos);
            }
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        aexists(this);
        aoutput(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE: isLE7 } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        clean(this.buffer.subarray(pos));
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        view.setBigUint64(blockLen - 8, numberToBigint(this.length * 8), isLE7);
        this.process(view, 0);
        const oview = createView(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen must be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length) {
          throw new Error("_sha2: outputLen bigger than state");
        }
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE7);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to ||= new this.constructor();
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
    };
    SHA256_IV = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
  }
});

// node_modules/@hpke/common/esm/src/hash/u64.js
function fromBig(n, le = false) {
  if (le) {
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  }
  return {
    h: Number(n >> _32n & U32_MASK64) | 0,
    l: Number(n & U32_MASK64) | 0
  };
}
function split(lst, le = false) {
  const len = lst.length;
  const Ah = new Uint32Array(len);
  const Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var U32_MASK64, _32n;
var init_u64 = __esm({
  "node_modules/@hpke/common/esm/src/hash/u64.js"() {
    U32_MASK64 = 0xffffffffn;
    _32n = 32n;
  }
});

// node_modules/@hpke/common/esm/src/hash/sha2.js
var SHA256_K, SHA256_W, SHA2_32B, _SHA256, sha256;
var init_sha2 = __esm({
  "node_modules/@hpke/common/esm/src/hash/sha2.js"() {
    init_md();
    init_u64();
    init_noble();
    init_hash();
    SHA256_K = /* @__PURE__ */ Uint32Array.from([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    SHA2_32B = class extends HashMD {
      constructor(outputLen) {
        super(64, outputLen, 8, false);
      }
      get() {
        const { A, B, C, D: D2, E, F: F2, G, H } = this;
        return [A, B, C, D2, E, F2, G, H];
      }
      set(A, B, C, D2, E, F2, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D2 | 0;
        this.E = E | 0;
        this.F = F2 | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4) {
          SHA256_W[i] = view.getUint32(offset, false);
        }
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
          const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D: D2, E, F: F2, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
          const T1 = H + sigma1 + Chi(E, F2, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
          const T2 = sigma0 + Maj(A, B, C) | 0;
          H = G;
          G = F2;
          F2 = E;
          E = D2 + T1 | 0;
          D2 = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D2 = D2 + this.D | 0;
        E = E + this.E | 0;
        F2 = F2 + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D2, E, F2, G, H);
      }
      roundClean() {
        clean(SHA256_W);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean(this.buffer);
      }
    };
    _SHA256 = class extends SHA2_32B {
      constructor() {
        super(32);
        Object.defineProperty(this, "A", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[0] | 0
        });
        Object.defineProperty(this, "B", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[1] | 0
        });
        Object.defineProperty(this, "C", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[2] | 0
        });
        Object.defineProperty(this, "D", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[3] | 0
        });
        Object.defineProperty(this, "E", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[4] | 0
        });
        Object.defineProperty(this, "F", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[5] | 0
        });
        Object.defineProperty(this, "G", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[6] | 0
        });
        Object.defineProperty(this, "H", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: SHA256_IV[7] | 0
        });
      }
    };
    sha256 = /* @__PURE__ */ createHasher(
      () => new _SHA256(),
      /* @__PURE__ */ oidNist(1)
    );
  }
});

// node_modules/@hpke/common/esm/src/hash/sha3.js
var _0n, _1n, _2n, _7n, _256n, _0x71n, SHA3_PI, SHA3_ROTL, _SHA3_IOTA, IOTAS, SHA3_IOTA_H, SHA3_IOTA_L;
var init_sha3 = __esm({
  "node_modules/@hpke/common/esm/src/hash/sha3.js"() {
    init_u64();
    init_noble();
    init_hash();
    _0n = 0n;
    _1n = 1n;
    _2n = 2n;
    _7n = 7n;
    _256n = 256n;
    _0x71n = 0x71n;
    SHA3_PI = [];
    SHA3_ROTL = [];
    _SHA3_IOTA = [];
    for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI.push(2 * (5 * y + x));
      SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
        if (R & _2n)
          t ^= _1n << (_1n << BigInt(j)) - _1n;
      }
      _SHA3_IOTA.push(t);
    }
    IOTAS = split(_SHA3_IOTA, true);
    SHA3_IOTA_H = IOTAS[0];
    SHA3_IOTA_L = IOTAS[1];
  }
});

// node_modules/@hpke/common/esm/src/curve/modular.js
function mod2(a, b) {
  const result = a % b;
  return result >= N_0 ? result : b + result;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > N_0) {
    res *= res;
    res %= modulo;
  }
  return res;
}
var init_modular = __esm({
  "node_modules/@hpke/common/esm/src/curve/modular.js"() {
    init_consts();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  }
});

// node_modules/@hpke/common/esm/src/curve/curve.js
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}
var init_curve = __esm({
  "node_modules/@hpke/common/esm/src/curve/curve.js"() {
  }
});

// node_modules/@hpke/common/esm/src/curve/montgomery.js
function validateOpts(curve) {
  validateObject(curve, {
    adjustScalarBytes: "function",
    powPminus2: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { P, type, adjustScalarBytes: adjustScalarBytes4, powPminus2, randomBytes: rand } = CURVE;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand || randomBytesAsync;
  const montgomeryBits = is25519 ? 255n : 448n;
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? 9n : 5n;
  const a24 = is25519 ? 121665n : 39081n;
  const minScalar = is25519 ? N_2 ** 254n : N_2 ** 447n;
  const maxAdded = is25519 ? 8n * N_2 ** 251n - N_1 : 4n * N_2 ** 445n - N_1;
  const maxScalar = minScalar + maxAdded + N_1;
  const modP = (n) => mod2(n, P);
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE(modP(u), fieldLen);
  }
  function decodeU(u) {
    const _u = copyBytes(abytes(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE(_u));
  }
  function decodeScalar(scalar) {
    return bytesToNumberLE(adjustScalarBytes4(copyBytes(abytes(scalar, fieldLen, "scalar"))));
  }
  function scalarMult(scalar, u) {
    const pu = montgomeryLadder(decodeU(u), decodeScalar(scalar));
    if (pu === N_0)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  function scalarMultBase(scalar) {
    return scalarMult(scalar, GuBytes);
  }
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function cswap(swap, x_2, x_3) {
    const dummy = modP(swap * (x_2 - x_3));
    x_2 = modP(x_2 - dummy);
    x_3 = modP(x_3 + dummy);
    return { x_2, x_3 };
  }
  function montgomeryLadder(u, scalar) {
    aInRange("u", u, N_0, P);
    aInRange("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = N_1;
    let z_2 = N_0;
    let x_3 = u;
    let z_3 = N_1;
    let swap = N_0;
    for (let t = montgomeryBits - 1n; t >= N_0; t--) {
      const k_t = k >> t & N_1;
      swap ^= k_t;
      ({ x_2, x_3 } = cswap(swap, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
      swap = k_t;
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D2 = x_3 - z_3;
      const DA = modP(D2 * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    ({ x_2, x_3 } = cswap(swap, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = async (seed) => {
    if (seed === void 0) {
      seed = await randomBytes_(fieldLen);
    }
    abytes(seed, lengths.seed, "seed");
    return seed;
  };
  const utils = { randomSecretKey };
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult,
    scalarMultBase,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}
var init_montgomery = __esm({
  "node_modules/@hpke/common/esm/src/curve/montgomery.js"() {
    init_noble();
    init_curve();
    init_modular();
    init_consts();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  }
});

// node_modules/@hpke/common/esm/mod.js
var init_mod = __esm({
  "node_modules/@hpke/common/esm/mod.js"() {
    init_errors();
    init_algorithm();
    init_identifiers();
    init_dhkem();
    init_ec();
    init_xCurve();
    init_hybridkem();
    init_xCryptoKey();
    init_hkdf();
    init_aeadEncryptionContext();
    init_dhkemPrimitives();
    init_dhkemPrimitives();
    init_kemInterface();
    init_consts();
    init_misc();
    init_noble();
    init_hmac();
    init_sha2();
    init_sha3();
    init_modular();
    init_montgomery();
  }
});

// node_modules/@hpke/chacha20poly1305/esm/src/chacha/utils.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abool(b) {
  if (typeof b !== "boolean")
    throw new Error(`boolean expected, not ${b}`);
}
function anumber2(n) {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error("positive integer expected, got " + n);
  }
}
function abytes2(value, length, title = "") {
  const bytes = isBytes2(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished) {
    throw new Error("Hash#digest() has already been called");
  }
}
function aoutput2(out, instance) {
  abytes2(out, void 0, "output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u322(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean2(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView2(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function checkOpts(defaults, opts) {
  if (opts == null || typeof opts !== "object") {
    throw new Error("options must be defined");
  }
  const merged = Object.assign(defaults, opts);
  return merged;
}
function equalBytes(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function getOutput(expectedLength, out, onlyAligned = true) {
  if (out === void 0)
    return new Uint8Array(expectedLength);
  if (out.length !== expectedLength) {
    throw new Error('"output" expected Uint8Array of length ' + expectedLength + ", got: " + out.length);
  }
  if (onlyAligned && !isAligned32(out)) {
    throw new Error("invalid output, must be aligned");
  }
  return out;
}
function u64Lengths(dataLength, aadLength, isLE7) {
  abool(isLE7);
  const num = new Uint8Array(16);
  const view = createView2(num);
  view.setBigUint64(0, BigInt(aadLength), isLE7);
  view.setBigUint64(8, BigInt(dataLength), isLE7);
  return num;
}
function isAligned32(bytes) {
  return bytes.byteOffset % 4 === 0;
}
function copyBytes2(bytes) {
  return Uint8Array.from(bytes);
}
var isLE2, wrapCipher;
var init_utils = __esm({
  "node_modules/@hpke/chacha20poly1305/esm/src/chacha/utils.js"() {
    isLE2 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
      function wrappedCipher(key, ...args) {
        abytes2(key, void 0, "key");
        if (!isLE2) {
          throw new Error("Non little-endian hardware is not yet supported");
        }
        if (params.nonceLength !== void 0) {
          const nonce = args[0];
          abytes2(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
        }
        const tagl = params.tagLength;
        if (tagl && args[1] !== void 0)
          abytes2(args[1], void 0, "AAD");
        const cipher = constructor(key, ...args);
        const checkOutput = (fnLength, output) => {
          if (output !== void 0) {
            if (fnLength !== 2)
              throw new Error("cipher output not supported");
            abytes2(output, void 0, "output");
          }
        };
        let called = false;
        const wrCipher = {
          encrypt(data, output) {
            if (called) {
              throw new Error("cannot encrypt() twice with same key + nonce");
            }
            called = true;
            abytes2(data);
            checkOutput(cipher.encrypt.length, output);
            return cipher.encrypt(data, output);
          },
          decrypt(data, output) {
            abytes2(data);
            if (tagl && data.length < tagl) {
              throw new Error('"ciphertext" expected length bigger than tagLength=' + tagl);
            }
            checkOutput(cipher.decrypt.length, output);
            return cipher.decrypt(data, output);
          }
        };
        return wrCipher;
      }
      Object.assign(wrappedCipher, params);
      return wrappedCipher;
    };
  }
});

// node_modules/@hpke/chacha20poly1305/esm/src/chacha/_arx.js
function rotl(a, b) {
  return a << b | a >>> 32 - b;
}
function isAligned322(b) {
  return b.byteOffset % 4 === 0;
}
function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN);
  const b32 = u322(block);
  const isAligned = isAligned322(data) && isAligned322(output);
  const d32 = isAligned ? u322(data) : U32_EMPTY;
  const o32 = isAligned ? u322(output) : U32_EMPTY;
  for (let pos = 0; pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN, len - pos);
    if (isAligned && take === BLOCK_LEN) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj; j < BLOCK_LEN32; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN;
      continue;
    }
    for (let j = 0, posj; j < take; j++) {
      posj = pos + j;
      output[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher(core, opts) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts({
    allowShortKeys: false,
    counterLength: 8,
    counterRight: false,
    rounds: 20
  }, opts);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber2(counterLength);
  anumber2(rounds);
  abool(counterRight);
  abool(allowShortKeys);
  return (key, nonce, data, output, counter = 0) => {
    abytes2(key, void 0, "key");
    abytes2(nonce, void 0, "nonce");
    abytes2(data, void 0, "data");
    const len = data.length;
    if (output === void 0)
      output = new Uint8Array(len);
    abytes2(output, void 0, "output");
    anumber2(counter);
    if (counter < 0 || counter >= MAX_COUNTER) {
      throw new Error("arx: counter overflow");
    }
    if (output.length < len) {
      throw new Error(`arx: output (${output.length}) is shorter than data (${len})`);
    }
    const toClean = [];
    const l = key.length;
    let k;
    let sigma;
    if (l === 32) {
      toClean.push(k = copyBytes2(key));
      sigma = sigma32_32;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_32;
      toClean.push(k);
    } else {
      abytes2(key, 32, "arx key");
      throw new Error("invalid key size");
    }
    if (!isAligned322(nonce))
      toClean.push(nonce = copyBytes2(nonce));
    const k32 = u322(k);
    if (extendNonceFn) {
      if (nonce.length !== 24) {
        throw new Error(`arx: extended nonce must be 24 bytes`);
      }
      extendNonceFn(sigma, k32, u322(nonce.subarray(0, 16)), k32);
      nonce = nonce.subarray(16);
    }
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length) {
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    }
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = u322(nonce);
    runCipher(core, sigma, k32, n32, data, output, counter, rounds);
    clean2(...toClean);
    return output;
  };
}
var _utf8ToBytes, sigma16, sigma32, sigma16_32, sigma32_32, BLOCK_LEN, BLOCK_LEN32, MAX_COUNTER, U32_EMPTY;
var init_arx = __esm({
  "node_modules/@hpke/chacha20poly1305/esm/src/chacha/_arx.js"() {
    init_utils();
    _utf8ToBytes = (str) => Uint8Array.from(str.split("").map((c) => c.charCodeAt(0)));
    sigma16 = _utf8ToBytes("expand 16-byte k");
    sigma32 = _utf8ToBytes("expand 32-byte k");
    sigma16_32 = u322(sigma16);
    sigma32_32 = u322(sigma32);
    BLOCK_LEN = 64;
    BLOCK_LEN32 = 16;
    MAX_COUNTER = 2 ** 32 - 1;
    U32_EMPTY = Uint32Array.of();
  }
});

// node_modules/@hpke/chacha20poly1305/esm/src/chacha/_poly1305.js
function u8to16(a, i) {
  return a[i++] & 255 | (a[i++] & 255) << 8;
}
function wrapConstructorWithKey(hashCons) {
  const hashC = (msg, key) => hashCons(key).update(msg).digest();
  const tmp = hashCons(new Uint8Array(32));
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (key) => hashCons(key);
  return hashC;
}
var Poly1305, poly1305;
var init_poly1305 = __esm({
  "node_modules/@hpke/chacha20poly1305/esm/src/chacha/_poly1305.js"() {
    init_utils();
    Poly1305 = class {
      // Can be speed-up using BigUint64Array, at the cost of complexity
      constructor(key) {
        Object.defineProperty(this, "blockLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 16
        });
        Object.defineProperty(this, "outputLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 16
        });
        Object.defineProperty(this, "buffer", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(16)
        });
        Object.defineProperty(this, "r", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint16Array(10)
        });
        Object.defineProperty(this, "h", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint16Array(10)
        });
        Object.defineProperty(this, "pad", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint16Array(8)
        });
        Object.defineProperty(this, "pos", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "finished", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        key = copyBytes2(abytes2(key, 32, "key"));
        const t0 = u8to16(key, 0);
        const t1 = u8to16(key, 2);
        const t2 = u8to16(key, 4);
        const t3 = u8to16(key, 6);
        const t4 = u8to16(key, 8);
        const t5 = u8to16(key, 10);
        const t6 = u8to16(key, 12);
        const t7 = u8to16(key, 14);
        this.r[0] = t0 & 8191;
        this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
        this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
        this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
        this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
        this.r[5] = t4 >>> 1 & 8190;
        this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
        this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
        this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
        this.r[9] = t7 >>> 5 & 127;
        for (let i = 0; i < 8; i++)
          this.pad[i] = u8to16(key, 16 + 2 * i);
      }
      process(data, offset, isLast = false) {
        const hibit = isLast ? 0 : 1 << 11;
        const { h, r } = this;
        const r0 = r[0];
        const r1 = r[1];
        const r2 = r[2];
        const r3 = r[3];
        const r4 = r[4];
        const r5 = r[5];
        const r6 = r[6];
        const r7 = r[7];
        const r8 = r[8];
        const r9 = r[9];
        const t0 = u8to16(data, offset + 0);
        const t1 = u8to16(data, offset + 2);
        const t2 = u8to16(data, offset + 4);
        const t3 = u8to16(data, offset + 6);
        const t4 = u8to16(data, offset + 8);
        const t5 = u8to16(data, offset + 10);
        const t6 = u8to16(data, offset + 12);
        const t7 = u8to16(data, offset + 14);
        const h0 = h[0] + (t0 & 8191);
        const h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
        const h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
        const h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
        const h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
        const h5 = h[5] + (t4 >>> 1 & 8191);
        const h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
        const h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
        const h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
        const h9 = h[9] + (t7 >>> 5 | hibit);
        let c = 0;
        let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
        c = d0 >>> 13;
        d0 &= 8191;
        d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
        c += d0 >>> 13;
        d0 &= 8191;
        let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
        c = d1 >>> 13;
        d1 &= 8191;
        d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
        c += d1 >>> 13;
        d1 &= 8191;
        let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
        c = d2 >>> 13;
        d2 &= 8191;
        d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
        c += d2 >>> 13;
        d2 &= 8191;
        let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
        c = d3 >>> 13;
        d3 &= 8191;
        d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
        c += d3 >>> 13;
        d3 &= 8191;
        let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
        c = d4 >>> 13;
        d4 &= 8191;
        d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
        c += d4 >>> 13;
        d4 &= 8191;
        let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
        c = d5 >>> 13;
        d5 &= 8191;
        d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
        c += d5 >>> 13;
        d5 &= 8191;
        let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
        c = d6 >>> 13;
        d6 &= 8191;
        d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
        c += d6 >>> 13;
        d6 &= 8191;
        let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
        c = d7 >>> 13;
        d7 &= 8191;
        d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
        c += d7 >>> 13;
        d7 &= 8191;
        let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
        c = d8 >>> 13;
        d8 &= 8191;
        d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
        c += d8 >>> 13;
        d8 &= 8191;
        let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
        c = d9 >>> 13;
        d9 &= 8191;
        d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
        c += d9 >>> 13;
        d9 &= 8191;
        c = (c << 2) + c | 0;
        c = c + d0 | 0;
        d0 = c & 8191;
        c = c >>> 13;
        d1 += c;
        h[0] = d0;
        h[1] = d1;
        h[2] = d2;
        h[3] = d3;
        h[4] = d4;
        h[5] = d5;
        h[6] = d6;
        h[7] = d7;
        h[8] = d8;
        h[9] = d9;
      }
      finalize() {
        const { h, pad } = this;
        const g = new Uint16Array(10);
        let c = h[1] >>> 13;
        h[1] &= 8191;
        for (let i = 2; i < 10; i++) {
          h[i] += c;
          c = h[i] >>> 13;
          h[i] &= 8191;
        }
        h[0] += c * 5;
        c = h[0] >>> 13;
        h[0] &= 8191;
        h[1] += c;
        c = h[1] >>> 13;
        h[1] &= 8191;
        h[2] += c;
        g[0] = h[0] + 5;
        c = g[0] >>> 13;
        g[0] &= 8191;
        for (let i = 1; i < 10; i++) {
          g[i] = h[i] + c;
          c = g[i] >>> 13;
          g[i] &= 8191;
        }
        g[9] -= 1 << 13;
        let mask = (c ^ 1) - 1;
        for (let i = 0; i < 10; i++)
          g[i] &= mask;
        mask = ~mask;
        for (let i = 0; i < 10; i++)
          h[i] = h[i] & mask | g[i];
        h[0] = (h[0] | h[1] << 13) & 65535;
        h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
        h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
        h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
        h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
        h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
        h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
        h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
        let f = h[0] + pad[0];
        h[0] = f & 65535;
        for (let i = 1; i < 8; i++) {
          f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
          h[i] = f & 65535;
        }
        clean2(g);
      }
      update(data) {
        aexists2(this);
        abytes2(data);
        data = copyBytes2(data);
        const { buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(data, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(buffer, 0, false);
            this.pos = 0;
          }
        }
        return this;
      }
      destroy() {
        clean2(this.h, this.r, this.buffer, this.pad);
      }
      digestInto(out) {
        aexists2(this);
        aoutput2(out, this);
        this.finished = true;
        const { buffer, h } = this;
        let { pos } = this;
        if (pos) {
          buffer[pos++] = 1;
          for (; pos < 16; pos++)
            buffer[pos] = 0;
          this.process(buffer, 0, true);
        }
        this.finalize();
        let opos = 0;
        for (let i = 0; i < 8; i++) {
          out[opos++] = h[i] >>> 0;
          out[opos++] = h[i] >>> 8;
        }
        return out;
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
    };
    poly1305 = /* @__PURE__ */ (() => wrapConstructorWithKey((key) => new Poly1305(key)))();
  }
});

// node_modules/@hpke/chacha20poly1305/esm/src/chacha/chacha.js
function chachaCore(s, k, n, out, cnt, rounds = 20) {
  const y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0; r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function computeTag(fn, key, nonce, ciphertext, AAD) {
  if (AAD !== void 0)
    abytes2(AAD, void 0, "AAD");
  const authKey = fn(key, nonce, ZEROS32);
  const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
  const h = poly1305.create(authKey);
  if (AAD)
    updatePadded(h, AAD);
  updatePadded(h, ciphertext);
  h.update(lengths);
  const res = h.digest();
  clean2(authKey, lengths);
  return res;
}
var chacha20, ZEROS16, updatePadded, ZEROS32, _poly1305_aead, chacha20poly1305;
var init_chacha = __esm({
  "node_modules/@hpke/chacha20poly1305/esm/src/chacha/chacha.js"() {
    init_arx();
    init_poly1305();
    init_utils();
    chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
      counterRight: false,
      counterLength: 4,
      allowShortKeys: false
    });
    ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
    updatePadded = (h, msg) => {
      h.update(msg);
      const leftover = msg.length % 16;
      if (leftover)
        h.update(ZEROS16.subarray(leftover));
    };
    ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
    _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
      const tagLength = 16;
      return {
        encrypt(plaintext, output) {
          const plength = plaintext.length;
          output = getOutput(plength + tagLength, output, false);
          output.set(plaintext);
          const oPlain = output.subarray(0, -tagLength);
          xorStream(key, nonce, oPlain, oPlain, 1);
          const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
          output.set(tag, plength);
          clean2(tag);
          return output;
        },
        decrypt(ciphertext, output) {
          output = getOutput(ciphertext.length - tagLength, output, false);
          const data = ciphertext.subarray(0, -tagLength);
          const passedTag = ciphertext.subarray(-tagLength);
          const tag = computeTag(xorStream, key, nonce, data, AAD);
          if (!equalBytes(passedTag, tag))
            throw new Error("invalid tag");
          output.set(ciphertext.subarray(0, -tagLength));
          xorStream(key, nonce, output, output, 1);
          clean2(tag);
          return output;
        }
      };
    };
    chacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 12, tagLength: 16 }, _poly1305_aead(chacha20));
  }
});

// node_modules/@hpke/chacha20poly1305/esm/src/chacha20Poly1305.js
var Chacha20Poly1305Context, Chacha20Poly1305;
var init_chacha20Poly1305 = __esm({
  "node_modules/@hpke/chacha20poly1305/esm/src/chacha20Poly1305.js"() {
    init_chacha();
    init_mod();
    Chacha20Poly1305Context = class {
      constructor(key) {
        Object.defineProperty(this, "_key", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this._key = new Uint8Array(key);
      }
      async seal(iv, data, aad) {
        return await this._seal(iv, data, aad);
      }
      async open(iv, data, aad) {
        return await this._open(iv, data, aad);
      }
      _seal(iv, data, aad) {
        return new Promise((resolve) => {
          const ret = chacha20poly1305(this._key, new Uint8Array(iv), new Uint8Array(aad)).encrypt(new Uint8Array(data));
          resolve(ret.buffer);
        });
      }
      _open(iv, data, aad) {
        return new Promise((resolve) => {
          const ret = chacha20poly1305(this._key, new Uint8Array(iv), new Uint8Array(aad)).decrypt(new Uint8Array(data));
          resolve(ret.buffer);
        });
      }
    };
    Chacha20Poly1305 = class {
      constructor() {
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: AeadId.Chacha20Poly1305
        });
        Object.defineProperty(this, "keySize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 32
        });
        Object.defineProperty(this, "nonceSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 12
        });
        Object.defineProperty(this, "tagSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 16
        });
      }
      createEncryptionContext(key) {
        return new Chacha20Poly1305Context(key);
      }
    };
  }
});

// node_modules/@hpke/chacha20poly1305/esm/mod.js
var mod_exports = {};
__export(mod_exports, {
  Chacha20Poly1305: () => Chacha20Poly1305
});
var init_mod2 = __esm({
  "node_modules/@hpke/chacha20poly1305/esm/mod.js"() {
    init_chacha20Poly1305();
  }
});

// node_modules/@noble/ciphers/utils.js
function isBytes3(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abool2(b) {
  if (typeof b !== "boolean")
    throw new Error(`boolean expected, not ${b}`);
}
function anumber3(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes3(value, length, title = "") {
  const bytes = isBytes3(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists3(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput3(out, instance) {
  abytes3(out, void 0, "output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u8(arr) {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
function u323(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean3(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView3(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function checkOpts2(defaults, opts) {
  if (opts == null || typeof opts !== "object")
    throw new Error("options must be defined");
  const merged = Object.assign(defaults, opts);
  return merged;
}
function equalBytes2(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function getOutput2(expectedLength, out, onlyAligned = true) {
  if (out === void 0)
    return new Uint8Array(expectedLength);
  if (out.length !== expectedLength)
    throw new Error('"output" expected Uint8Array of length ' + expectedLength + ", got: " + out.length);
  if (onlyAligned && !isAligned323(out))
    throw new Error("invalid output, must be aligned");
  return out;
}
function u64Lengths2(dataLength, aadLength, isLE7) {
  abool2(isLE7);
  const num = new Uint8Array(16);
  const view = createView3(num);
  view.setBigUint64(0, BigInt(aadLength), isLE7);
  view.setBigUint64(8, BigInt(dataLength), isLE7);
  return num;
}
function isAligned323(bytes) {
  return bytes.byteOffset % 4 === 0;
}
function copyBytes3(bytes) {
  return Uint8Array.from(bytes);
}
function randomBytes(bytesLength = 32) {
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var isLE3, wrapCipher2;
var init_utils2 = __esm({
  "node_modules/@noble/ciphers/utils.js"() {
    /*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
    isLE3 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    wrapCipher2 = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
      function wrappedCipher(key, ...args) {
        abytes3(key, void 0, "key");
        if (!isLE3)
          throw new Error("Non little-endian hardware is not yet supported");
        if (params.nonceLength !== void 0) {
          const nonce = args[0];
          abytes3(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
        }
        const tagl = params.tagLength;
        if (tagl && args[1] !== void 0)
          abytes3(args[1], void 0, "AAD");
        const cipher = constructor(key, ...args);
        const checkOutput = (fnLength, output) => {
          if (output !== void 0) {
            if (fnLength !== 2)
              throw new Error("cipher output not supported");
            abytes3(output, void 0, "output");
          }
        };
        let called = false;
        const wrCipher = {
          encrypt(data, output) {
            if (called)
              throw new Error("cannot encrypt() twice with same key + nonce");
            called = true;
            abytes3(data);
            checkOutput(cipher.encrypt.length, output);
            return cipher.encrypt(data, output);
          },
          decrypt(data, output) {
            abytes3(data);
            if (tagl && data.length < tagl)
              throw new Error('"ciphertext" expected length bigger than tagLength=' + tagl);
            checkOutput(cipher.decrypt.length, output);
            return cipher.decrypt(data, output);
          }
        };
        return wrCipher;
      }
      Object.assign(wrappedCipher, params);
      return wrappedCipher;
    };
  }
});

// node_modules/@noble/ciphers/_arx.js
function rotl2(a, b) {
  return a << b | a >>> 32 - b;
}
function isAligned324(b) {
  return b.byteOffset % 4 === 0;
}
function runCipher2(core, sigma, key, nonce, data, output, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN2);
  const b32 = u323(block);
  const isAligned = isAligned324(data) && isAligned324(output);
  const d32 = isAligned ? u323(data) : U32_EMPTY2;
  const o32 = isAligned ? u323(output) : U32_EMPTY2;
  for (let pos = 0; pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER2)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN2, len - pos);
    if (isAligned && take === BLOCK_LEN2) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj; j < BLOCK_LEN322; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN2;
      continue;
    }
    for (let j = 0, posj; j < take; j++) {
      posj = pos + j;
      output[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher2(core, opts) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts2({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber3(counterLength);
  anumber3(rounds);
  abool2(counterRight);
  abool2(allowShortKeys);
  return (key, nonce, data, output, counter = 0) => {
    abytes3(key, void 0, "key");
    abytes3(nonce, void 0, "nonce");
    abytes3(data, void 0, "data");
    const len = data.length;
    if (output === void 0)
      output = new Uint8Array(len);
    abytes3(output, void 0, "output");
    anumber3(counter);
    if (counter < 0 || counter >= MAX_COUNTER2)
      throw new Error("arx: counter overflow");
    if (output.length < len)
      throw new Error(`arx: output (${output.length}) is shorter than data (${len})`);
    const toClean = [];
    let l = key.length;
    let k;
    let sigma;
    if (l === 32) {
      toClean.push(k = copyBytes3(key));
      sigma = sigma32_322;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_322;
      toClean.push(k);
    } else {
      abytes3(key, 32, "arx key");
      throw new Error("invalid key size");
    }
    if (!isAligned324(nonce))
      toClean.push(nonce = copyBytes3(nonce));
    const k32 = u323(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error(`arx: extended nonce must be 24 bytes`);
      extendNonceFn(sigma, k32, u323(nonce.subarray(0, 16)), k32);
      nonce = nonce.subarray(16);
    }
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = u323(nonce);
    runCipher2(core, sigma, k32, n32, data, output, counter, rounds);
    clean3(...toClean);
    return output;
  };
}
var encodeStr, sigma162, sigma322, sigma16_322, sigma32_322, BLOCK_LEN2, BLOCK_LEN322, MAX_COUNTER2, U32_EMPTY2, _XorStreamPRG, createPRG;
var init_arx2 = __esm({
  "node_modules/@noble/ciphers/_arx.js"() {
    init_utils2();
    encodeStr = (str) => Uint8Array.from(str.split(""), (c) => c.charCodeAt(0));
    sigma162 = encodeStr("expand 16-byte k");
    sigma322 = encodeStr("expand 32-byte k");
    sigma16_322 = u323(sigma162);
    sigma32_322 = u323(sigma322);
    BLOCK_LEN2 = 64;
    BLOCK_LEN322 = 16;
    MAX_COUNTER2 = 2 ** 32 - 1;
    U32_EMPTY2 = Uint32Array.of();
    _XorStreamPRG = class __XorStreamPRG {
      blockLen;
      keyLen;
      nonceLen;
      state;
      buf;
      key;
      nonce;
      pos;
      ctr;
      cipher;
      constructor(cipher, blockLen, keyLen, nonceLen, seed) {
        this.cipher = cipher;
        this.blockLen = blockLen;
        this.keyLen = keyLen;
        this.nonceLen = nonceLen;
        this.state = new Uint8Array(this.keyLen + this.nonceLen);
        this.reseed(seed);
        this.ctr = 0;
        this.pos = this.blockLen;
        this.buf = new Uint8Array(this.blockLen);
        this.key = this.state.subarray(0, this.keyLen);
        this.nonce = this.state.subarray(this.keyLen);
      }
      reseed(seed) {
        abytes3(seed);
        if (!seed || seed.length === 0)
          throw new Error("entropy required");
        for (let i = 0; i < seed.length; i++)
          this.state[i % this.state.length] ^= seed[i];
        this.ctr = 0;
        this.pos = this.blockLen;
      }
      addEntropy(seed) {
        this.state.set(this.randomBytes(this.state.length));
        this.reseed(seed);
      }
      randomBytes(len) {
        anumber3(len);
        if (len === 0)
          return new Uint8Array(0);
        const out = new Uint8Array(len);
        let outPos = 0;
        if (this.pos < this.blockLen) {
          const take = Math.min(len, this.blockLen - this.pos);
          out.set(this.buf.subarray(this.pos, this.pos + take), 0);
          this.pos += take;
          outPos += take;
          if (outPos === len)
            return out;
        }
        const blocks = Math.floor((len - outPos) / this.blockLen);
        if (blocks > 0) {
          const blockBytes = blocks * this.blockLen;
          const b = out.subarray(outPos, outPos + blockBytes);
          this.cipher(this.key, this.nonce, b, b, this.ctr);
          this.ctr += blocks;
          outPos += blockBytes;
        }
        const left2 = len - outPos;
        if (left2 > 0) {
          this.buf.fill(0);
          this.cipher(this.key, this.nonce, this.buf, this.buf, this.ctr++);
          out.set(this.buf.subarray(0, left2), outPos);
          this.pos = left2;
        }
        return out;
      }
      clone() {
        return new __XorStreamPRG(this.cipher, this.blockLen, this.keyLen, this.nonceLen, this.randomBytes(this.state.length));
      }
      clean() {
        this.pos = 0;
        this.ctr = 0;
        this.buf.fill(0);
        this.state.fill(0);
      }
    };
    createPRG = (cipher, blockLen, keyLen, nonceLen) => {
      return (seed = randomBytes(32)) => new _XorStreamPRG(cipher, blockLen, keyLen, nonceLen, seed);
    };
  }
});

// node_modules/@noble/ciphers/_poly1305.js
function u8to162(a, i) {
  return a[i++] & 255 | (a[i++] & 255) << 8;
}
function wrapConstructorWithKey2(hashCons) {
  const hashC = (msg, key) => hashCons(key).update(msg).digest();
  const tmp = hashCons(new Uint8Array(32));
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (key) => hashCons(key);
  return hashC;
}
var Poly13052, poly13052;
var init_poly13052 = __esm({
  "node_modules/@noble/ciphers/_poly1305.js"() {
    init_utils2();
    Poly13052 = class {
      blockLen = 16;
      outputLen = 16;
      buffer = new Uint8Array(16);
      r = new Uint16Array(10);
      // Allocating 1 array with .subarray() here is slower than 3
      h = new Uint16Array(10);
      pad = new Uint16Array(8);
      pos = 0;
      finished = false;
      // Can be speed-up using BigUint64Array, at the cost of complexity
      constructor(key) {
        key = copyBytes3(abytes3(key, 32, "key"));
        const t0 = u8to162(key, 0);
        const t1 = u8to162(key, 2);
        const t2 = u8to162(key, 4);
        const t3 = u8to162(key, 6);
        const t4 = u8to162(key, 8);
        const t5 = u8to162(key, 10);
        const t6 = u8to162(key, 12);
        const t7 = u8to162(key, 14);
        this.r[0] = t0 & 8191;
        this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
        this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
        this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
        this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
        this.r[5] = t4 >>> 1 & 8190;
        this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
        this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
        this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
        this.r[9] = t7 >>> 5 & 127;
        for (let i = 0; i < 8; i++)
          this.pad[i] = u8to162(key, 16 + 2 * i);
      }
      process(data, offset, isLast = false) {
        const hibit = isLast ? 0 : 1 << 11;
        const { h, r } = this;
        const r0 = r[0];
        const r1 = r[1];
        const r2 = r[2];
        const r3 = r[3];
        const r4 = r[4];
        const r5 = r[5];
        const r6 = r[6];
        const r7 = r[7];
        const r8 = r[8];
        const r9 = r[9];
        const t0 = u8to162(data, offset + 0);
        const t1 = u8to162(data, offset + 2);
        const t2 = u8to162(data, offset + 4);
        const t3 = u8to162(data, offset + 6);
        const t4 = u8to162(data, offset + 8);
        const t5 = u8to162(data, offset + 10);
        const t6 = u8to162(data, offset + 12);
        const t7 = u8to162(data, offset + 14);
        let h0 = h[0] + (t0 & 8191);
        let h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
        let h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
        let h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
        let h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
        let h5 = h[5] + (t4 >>> 1 & 8191);
        let h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
        let h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
        let h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
        let h9 = h[9] + (t7 >>> 5 | hibit);
        let c = 0;
        let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
        c = d0 >>> 13;
        d0 &= 8191;
        d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
        c += d0 >>> 13;
        d0 &= 8191;
        let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
        c = d1 >>> 13;
        d1 &= 8191;
        d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
        c += d1 >>> 13;
        d1 &= 8191;
        let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
        c = d2 >>> 13;
        d2 &= 8191;
        d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
        c += d2 >>> 13;
        d2 &= 8191;
        let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
        c = d3 >>> 13;
        d3 &= 8191;
        d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
        c += d3 >>> 13;
        d3 &= 8191;
        let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
        c = d4 >>> 13;
        d4 &= 8191;
        d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
        c += d4 >>> 13;
        d4 &= 8191;
        let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
        c = d5 >>> 13;
        d5 &= 8191;
        d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
        c += d5 >>> 13;
        d5 &= 8191;
        let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
        c = d6 >>> 13;
        d6 &= 8191;
        d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
        c += d6 >>> 13;
        d6 &= 8191;
        let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
        c = d7 >>> 13;
        d7 &= 8191;
        d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
        c += d7 >>> 13;
        d7 &= 8191;
        let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
        c = d8 >>> 13;
        d8 &= 8191;
        d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
        c += d8 >>> 13;
        d8 &= 8191;
        let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
        c = d9 >>> 13;
        d9 &= 8191;
        d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
        c += d9 >>> 13;
        d9 &= 8191;
        c = (c << 2) + c | 0;
        c = c + d0 | 0;
        d0 = c & 8191;
        c = c >>> 13;
        d1 += c;
        h[0] = d0;
        h[1] = d1;
        h[2] = d2;
        h[3] = d3;
        h[4] = d4;
        h[5] = d5;
        h[6] = d6;
        h[7] = d7;
        h[8] = d8;
        h[9] = d9;
      }
      finalize() {
        const { h, pad } = this;
        const g = new Uint16Array(10);
        let c = h[1] >>> 13;
        h[1] &= 8191;
        for (let i = 2; i < 10; i++) {
          h[i] += c;
          c = h[i] >>> 13;
          h[i] &= 8191;
        }
        h[0] += c * 5;
        c = h[0] >>> 13;
        h[0] &= 8191;
        h[1] += c;
        c = h[1] >>> 13;
        h[1] &= 8191;
        h[2] += c;
        g[0] = h[0] + 5;
        c = g[0] >>> 13;
        g[0] &= 8191;
        for (let i = 1; i < 10; i++) {
          g[i] = h[i] + c;
          c = g[i] >>> 13;
          g[i] &= 8191;
        }
        g[9] -= 1 << 13;
        let mask = (c ^ 1) - 1;
        for (let i = 0; i < 10; i++)
          g[i] &= mask;
        mask = ~mask;
        for (let i = 0; i < 10; i++)
          h[i] = h[i] & mask | g[i];
        h[0] = (h[0] | h[1] << 13) & 65535;
        h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
        h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
        h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
        h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
        h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
        h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
        h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
        let f = h[0] + pad[0];
        h[0] = f & 65535;
        for (let i = 1; i < 8; i++) {
          f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
          h[i] = f & 65535;
        }
        clean3(g);
      }
      update(data) {
        aexists3(this);
        abytes3(data);
        data = copyBytes3(data);
        const { buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(data, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(buffer, 0, false);
            this.pos = 0;
          }
        }
        return this;
      }
      destroy() {
        clean3(this.h, this.r, this.buffer, this.pad);
      }
      digestInto(out) {
        aexists3(this);
        aoutput3(out, this);
        this.finished = true;
        const { buffer, h } = this;
        let { pos } = this;
        if (pos) {
          buffer[pos++] = 1;
          for (; pos < 16; pos++)
            buffer[pos] = 0;
          this.process(buffer, 0, true);
        }
        this.finalize();
        let opos = 0;
        for (let i = 0; i < 8; i++) {
          out[opos++] = h[i] >>> 0;
          out[opos++] = h[i] >>> 8;
        }
        return out;
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
    };
    poly13052 = /* @__PURE__ */ (() => wrapConstructorWithKey2((key) => new Poly13052(key)))();
  }
});

// node_modules/@noble/ciphers/chacha.js
var chacha_exports = {};
__export(chacha_exports, {
  _poly1305_aead: () => _poly1305_aead2,
  chacha12: () => chacha12,
  chacha20: () => chacha202,
  chacha20orig: () => chacha20orig,
  chacha20poly1305: () => chacha20poly13052,
  chacha8: () => chacha8,
  hchacha: () => hchacha,
  rngChacha20: () => rngChacha20,
  rngChacha8: () => rngChacha8,
  xchacha20: () => xchacha20,
  xchacha20poly1305: () => xchacha20poly1305
});
function chachaCore2(s, k, n, out, cnt, rounds = 20) {
  let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0; r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function hchacha(s, k, i, out) {
  let x00 = s[0], x01 = s[1], x02 = s[2], x03 = s[3], x04 = k[0], x05 = k[1], x06 = k[2], x07 = k[3], x08 = k[4], x09 = k[5], x10 = k[6], x11 = k[7], x12 = i[0], x13 = i[1], x14 = i[2], x15 = i[3];
  for (let r = 0; r < 20; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = x00;
  out[oi++] = x01;
  out[oi++] = x02;
  out[oi++] = x03;
  out[oi++] = x12;
  out[oi++] = x13;
  out[oi++] = x14;
  out[oi++] = x15;
}
function computeTag2(fn, key, nonce, ciphertext, AAD) {
  if (AAD !== void 0)
    abytes3(AAD, void 0, "AAD");
  const authKey = fn(key, nonce, ZEROS322);
  const lengths = u64Lengths2(ciphertext.length, AAD ? AAD.length : 0, true);
  const h = poly13052.create(authKey);
  if (AAD)
    updatePadded2(h, AAD);
  updatePadded2(h, ciphertext);
  h.update(lengths);
  const res = h.digest();
  clean3(authKey, lengths);
  return res;
}
var chacha20orig, chacha202, xchacha20, chacha8, chacha12, ZEROS162, updatePadded2, ZEROS322, _poly1305_aead2, chacha20poly13052, xchacha20poly1305, rngChacha20, rngChacha8;
var init_chacha2 = __esm({
  "node_modules/@noble/ciphers/chacha.js"() {
    init_arx2();
    init_poly13052();
    init_utils2();
    chacha20orig = /* @__PURE__ */ createCipher2(chachaCore2, {
      counterRight: false,
      counterLength: 8,
      allowShortKeys: true
    });
    chacha202 = /* @__PURE__ */ createCipher2(chachaCore2, {
      counterRight: false,
      counterLength: 4,
      allowShortKeys: false
    });
    xchacha20 = /* @__PURE__ */ createCipher2(chachaCore2, {
      counterRight: false,
      counterLength: 8,
      extendNonceFn: hchacha,
      allowShortKeys: false
    });
    chacha8 = /* @__PURE__ */ createCipher2(chachaCore2, {
      counterRight: false,
      counterLength: 4,
      rounds: 8
    });
    chacha12 = /* @__PURE__ */ createCipher2(chachaCore2, {
      counterRight: false,
      counterLength: 4,
      rounds: 12
    });
    ZEROS162 = /* @__PURE__ */ new Uint8Array(16);
    updatePadded2 = (h, msg) => {
      h.update(msg);
      const leftover = msg.length % 16;
      if (leftover)
        h.update(ZEROS162.subarray(leftover));
    };
    ZEROS322 = /* @__PURE__ */ new Uint8Array(32);
    _poly1305_aead2 = (xorStream) => (key, nonce, AAD) => {
      const tagLength = 16;
      return {
        encrypt(plaintext, output) {
          const plength = plaintext.length;
          output = getOutput2(plength + tagLength, output, false);
          output.set(plaintext);
          const oPlain = output.subarray(0, -tagLength);
          xorStream(key, nonce, oPlain, oPlain, 1);
          const tag = computeTag2(xorStream, key, nonce, oPlain, AAD);
          output.set(tag, plength);
          clean3(tag);
          return output;
        },
        decrypt(ciphertext, output) {
          output = getOutput2(ciphertext.length - tagLength, output, false);
          const data = ciphertext.subarray(0, -tagLength);
          const passedTag = ciphertext.subarray(-tagLength);
          const tag = computeTag2(xorStream, key, nonce, data, AAD);
          if (!equalBytes2(passedTag, tag))
            throw new Error("invalid tag");
          output.set(ciphertext.subarray(0, -tagLength));
          xorStream(key, nonce, output, output, 1);
          clean3(tag);
          return output;
        }
      };
    };
    chacha20poly13052 = /* @__PURE__ */ wrapCipher2({ blockSize: 64, nonceLength: 12, tagLength: 16 }, _poly1305_aead2(chacha202));
    xchacha20poly1305 = /* @__PURE__ */ wrapCipher2({ blockSize: 64, nonceLength: 24, tagLength: 16 }, _poly1305_aead2(xchacha20));
    rngChacha20 = /* @__PURE__ */ createPRG(chacha20orig, 64, 32, 8);
    rngChacha8 = /* @__PURE__ */ createPRG(chacha8, 64, 32, 12);
  }
});

// node_modules/mlkem/esm/src/errors.js
var MlKemError;
var init_errors2 = __esm({
  "node_modules/mlkem/esm/src/errors.js"() {
    MlKemError = class extends Error {
      constructor(e) {
        let message;
        if (e instanceof Error) {
          message = e.message;
        } else if (typeof e === "string") {
          message = e;
        } else {
          message = "";
        }
        super(message);
        this.name = this.constructor.name;
      }
    };
  }
});

// node_modules/mlkem/esm/src/consts.js
var N, Q, Q_INV, NTT_ZETAS, NTT_ZETAS_INV;
var init_consts2 = __esm({
  "node_modules/mlkem/esm/src/consts.js"() {
    N = 256;
    Q = 3329;
    Q_INV = 62209;
    NTT_ZETAS = [
      2285,
      2571,
      2970,
      1812,
      1493,
      1422,
      287,
      202,
      3158,
      622,
      1577,
      182,
      962,
      2127,
      1855,
      1468,
      573,
      2004,
      264,
      383,
      2500,
      1458,
      1727,
      3199,
      2648,
      1017,
      732,
      608,
      1787,
      411,
      3124,
      1758,
      1223,
      652,
      2777,
      1015,
      2036,
      1491,
      3047,
      1785,
      516,
      3321,
      3009,
      2663,
      1711,
      2167,
      126,
      1469,
      2476,
      3239,
      3058,
      830,
      107,
      1908,
      3082,
      2378,
      2931,
      961,
      1821,
      2604,
      448,
      2264,
      677,
      2054,
      2226,
      430,
      555,
      843,
      2078,
      871,
      1550,
      105,
      422,
      587,
      177,
      3094,
      3038,
      2869,
      1574,
      1653,
      3083,
      778,
      1159,
      3182,
      2552,
      1483,
      2727,
      1119,
      1739,
      644,
      2457,
      349,
      418,
      329,
      3173,
      3254,
      817,
      1097,
      603,
      610,
      1322,
      2044,
      1864,
      384,
      2114,
      3193,
      1218,
      1994,
      2455,
      220,
      2142,
      1670,
      2144,
      1799,
      2051,
      794,
      1819,
      2475,
      2459,
      478,
      3221,
      3021,
      996,
      991,
      958,
      1869,
      1522,
      1628
    ];
    NTT_ZETAS_INV = [
      1701,
      1807,
      1460,
      2371,
      2338,
      2333,
      308,
      108,
      2851,
      870,
      854,
      1510,
      2535,
      1278,
      1530,
      1185,
      1659,
      1187,
      3109,
      874,
      1335,
      2111,
      136,
      1215,
      2945,
      1465,
      1285,
      2007,
      2719,
      2726,
      2232,
      2512,
      75,
      156,
      3e3,
      2911,
      2980,
      872,
      2685,
      1590,
      2210,
      602,
      1846,
      777,
      147,
      2170,
      2551,
      246,
      1676,
      1755,
      460,
      291,
      235,
      3152,
      2742,
      2907,
      3224,
      1779,
      2458,
      1251,
      2486,
      2774,
      2899,
      1103,
      1275,
      2652,
      1065,
      2881,
      725,
      1508,
      2368,
      398,
      951,
      247,
      1421,
      3222,
      2499,
      271,
      90,
      853,
      1860,
      3203,
      1162,
      1618,
      666,
      320,
      8,
      2813,
      1544,
      282,
      1838,
      1293,
      2314,
      552,
      2677,
      2106,
      1571,
      205,
      2918,
      1542,
      2721,
      2597,
      2312,
      681,
      130,
      1602,
      1871,
      829,
      2946,
      3065,
      1325,
      2756,
      1861,
      1474,
      1202,
      2367,
      3147,
      1752,
      2707,
      171,
      3127,
      3042,
      1907,
      1836,
      1517,
      359,
      758,
      1441
    ];
  }
});

// node_modules/mlkem/esm/src/sha3/_u64.js
function fromBig2(n, le = false) {
  if (le) {
    return { h: Number(n & U32_MASK642), l: Number(n >> _32n2 & U32_MASK642) };
  }
  return {
    h: Number(n >> _32n2 & U32_MASK642) | 0,
    l: Number(n & U32_MASK642) | 0
  };
}
function split2(lst, le = false) {
  const len = lst.length;
  const Ah = new Uint32Array(len);
  const Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig2(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var U32_MASK642, _32n2, rotlSH2, rotlSL2, rotlBH2, rotlBL2;
var init_u642 = __esm({
  "node_modules/mlkem/esm/src/sha3/_u64.js"() {
    U32_MASK642 = 0xffffffffn;
    _32n2 = 32n;
    rotlSH2 = (h, l, s) => h << s | l >>> 32 - s;
    rotlSL2 = (h, l, s) => l << s | h >>> 32 - s;
    rotlBH2 = (h, l, s) => l << s - 32 | h >>> 64 - s;
    rotlBL2 = (h, l, s) => h << s - 32 | l >>> 64 - s;
  }
});

// node_modules/mlkem/esm/src/sha3/utils.js
function isBytes4(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber4(n, title = "") {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new Error(`${prefix}expected integer >0, got ${n}`);
  }
}
function abytes4(value, length, title = "") {
  const bytes = isBytes4(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists4(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished) {
    throw new Error("Hash#digest() has already been called");
  }
}
function aoutput4(out, instance) {
  abytes4(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function u324(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean4(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
function createHasher2(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var isLE4, swap32IfBE2, oidNist2;
var init_utils3 = __esm({
  "node_modules/mlkem/esm/src/sha3/utils.js"() {
    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    isLE4 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    swap32IfBE2 = isLE4 ? (u) => u : byteSwap32;
    oidNist2 = (suffix) => ({
      oid: Uint8Array.from([
        6,
        9,
        96,
        134,
        72,
        1,
        101,
        3,
        4,
        2,
        suffix
      ])
    });
  }
});

// node_modules/mlkem/esm/src/sha3/sha3.js
function keccakP(s, rounds = 24, B) {
  if (!B)
    B = new Uint32Array(10);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++) {
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    }
    {
      const Th2 = rotlH(B[2], B[3], 1) ^ B[8];
      const Tl2 = rotlL(B[2], B[3], 1) ^ B[9];
      s[0] ^= Th2;
      s[1] ^= Tl2;
      s[10] ^= Th2;
      s[11] ^= Tl2;
      s[20] ^= Th2;
      s[21] ^= Tl2;
      s[30] ^= Th2;
      s[31] ^= Tl2;
      s[40] ^= Th2;
      s[41] ^= Tl2;
    }
    {
      const Th2 = rotlH(B[4], B[5], 1) ^ B[0];
      const Tl2 = rotlL(B[4], B[5], 1) ^ B[1];
      s[2] ^= Th2;
      s[3] ^= Tl2;
      s[12] ^= Th2;
      s[13] ^= Tl2;
      s[22] ^= Th2;
      s[23] ^= Tl2;
      s[32] ^= Th2;
      s[33] ^= Tl2;
      s[42] ^= Th2;
      s[43] ^= Tl2;
    }
    {
      const Th2 = rotlH(B[6], B[7], 1) ^ B[2];
      const Tl2 = rotlL(B[6], B[7], 1) ^ B[3];
      s[4] ^= Th2;
      s[5] ^= Tl2;
      s[14] ^= Th2;
      s[15] ^= Tl2;
      s[24] ^= Th2;
      s[25] ^= Tl2;
      s[34] ^= Th2;
      s[35] ^= Tl2;
      s[44] ^= Th2;
      s[45] ^= Tl2;
    }
    {
      const Th2 = rotlH(B[8], B[9], 1) ^ B[4];
      const Tl2 = rotlL(B[8], B[9], 1) ^ B[5];
      s[6] ^= Th2;
      s[7] ^= Tl2;
      s[16] ^= Th2;
      s[17] ^= Tl2;
      s[26] ^= Th2;
      s[27] ^= Tl2;
      s[36] ^= Th2;
      s[37] ^= Tl2;
      s[46] ^= Th2;
      s[47] ^= Tl2;
    }
    {
      const Th2 = rotlH(B[0], B[1], 1) ^ B[6];
      const Tl2 = rotlL(B[0], B[1], 1) ^ B[7];
      s[8] ^= Th2;
      s[9] ^= Tl2;
      s[18] ^= Th2;
      s[19] ^= Tl2;
      s[28] ^= Th2;
      s[29] ^= Tl2;
      s[38] ^= Th2;
      s[39] ^= Tl2;
      s[48] ^= Th2;
      s[49] ^= Tl2;
    }
    let curH = s[2];
    let curL = s[3];
    let Th, Tl;
    Th = rotlSH2(curH, curL, 1);
    Tl = rotlSL2(curH, curL, 1);
    curH = s[20];
    curL = s[21];
    s[20] = Th;
    s[21] = Tl;
    Th = rotlSH2(curH, curL, 3);
    Tl = rotlSL2(curH, curL, 3);
    curH = s[14];
    curL = s[15];
    s[14] = Th;
    s[15] = Tl;
    Th = rotlSH2(curH, curL, 6);
    Tl = rotlSL2(curH, curL, 6);
    curH = s[22];
    curL = s[23];
    s[22] = Th;
    s[23] = Tl;
    Th = rotlSH2(curH, curL, 10);
    Tl = rotlSL2(curH, curL, 10);
    curH = s[34];
    curL = s[35];
    s[34] = Th;
    s[35] = Tl;
    Th = rotlSH2(curH, curL, 15);
    Tl = rotlSL2(curH, curL, 15);
    curH = s[36];
    curL = s[37];
    s[36] = Th;
    s[37] = Tl;
    Th = rotlSH2(curH, curL, 21);
    Tl = rotlSL2(curH, curL, 21);
    curH = s[6];
    curL = s[7];
    s[6] = Th;
    s[7] = Tl;
    Th = rotlSH2(curH, curL, 28);
    Tl = rotlSL2(curH, curL, 28);
    curH = s[10];
    curL = s[11];
    s[10] = Th;
    s[11] = Tl;
    Th = rotlBH2(curH, curL, 36);
    Tl = rotlBL2(curH, curL, 36);
    curH = s[32];
    curL = s[33];
    s[32] = Th;
    s[33] = Tl;
    Th = rotlBH2(curH, curL, 45);
    Tl = rotlBL2(curH, curL, 45);
    curH = s[16];
    curL = s[17];
    s[16] = Th;
    s[17] = Tl;
    Th = rotlBH2(curH, curL, 55);
    Tl = rotlBL2(curH, curL, 55);
    curH = s[42];
    curL = s[43];
    s[42] = Th;
    s[43] = Tl;
    Th = rotlSH2(curH, curL, 2);
    Tl = rotlSL2(curH, curL, 2);
    curH = s[48];
    curL = s[49];
    s[48] = Th;
    s[49] = Tl;
    Th = rotlSH2(curH, curL, 14);
    Tl = rotlSL2(curH, curL, 14);
    curH = s[8];
    curL = s[9];
    s[8] = Th;
    s[9] = Tl;
    Th = rotlSH2(curH, curL, 27);
    Tl = rotlSL2(curH, curL, 27);
    curH = s[30];
    curL = s[31];
    s[30] = Th;
    s[31] = Tl;
    Th = rotlBH2(curH, curL, 41);
    Tl = rotlBL2(curH, curL, 41);
    curH = s[46];
    curL = s[47];
    s[46] = Th;
    s[47] = Tl;
    Th = rotlBH2(curH, curL, 56);
    Tl = rotlBL2(curH, curL, 56);
    curH = s[38];
    curL = s[39];
    s[38] = Th;
    s[39] = Tl;
    Th = rotlSH2(curH, curL, 8);
    Tl = rotlSL2(curH, curL, 8);
    curH = s[26];
    curL = s[27];
    s[26] = Th;
    s[27] = Tl;
    Th = rotlSH2(curH, curL, 25);
    Tl = rotlSL2(curH, curL, 25);
    curH = s[24];
    curL = s[25];
    s[24] = Th;
    s[25] = Tl;
    Th = rotlBH2(curH, curL, 43);
    Tl = rotlBL2(curH, curL, 43);
    curH = s[4];
    curL = s[5];
    s[4] = Th;
    s[5] = Tl;
    Th = rotlBH2(curH, curL, 62);
    Tl = rotlBL2(curH, curL, 62);
    curH = s[40];
    curL = s[41];
    s[40] = Th;
    s[41] = Tl;
    Th = rotlSH2(curH, curL, 18);
    Tl = rotlSL2(curH, curL, 18);
    curH = s[28];
    curL = s[29];
    s[28] = Th;
    s[29] = Tl;
    Th = rotlBH2(curH, curL, 39);
    Tl = rotlBL2(curH, curL, 39);
    curH = s[44];
    curL = s[45];
    s[44] = Th;
    s[45] = Tl;
    Th = rotlBH2(curH, curL, 61);
    Tl = rotlBL2(curH, curL, 61);
    curH = s[18];
    curL = s[19];
    s[18] = Th;
    s[19] = Tl;
    Th = rotlSH2(curH, curL, 20);
    Tl = rotlSL2(curH, curL, 20);
    curH = s[12];
    curL = s[13];
    s[12] = Th;
    s[13] = Tl;
    Th = rotlBH2(curH, curL, 44);
    Tl = rotlBL2(curH, curL, 44);
    s[2] = Th;
    s[3] = Tl;
    for (let y = 0; y < 50; y += 10) {
      B[0] = s[y];
      B[1] = s[y + 1];
      B[2] = s[y + 2];
      B[3] = s[y + 3];
      B[4] = s[y + 4];
      B[5] = s[y + 5];
      B[6] = s[y + 6];
      B[7] = s[y + 7];
      B[8] = s[y + 8];
      B[9] = s[y + 9];
      s[y + 0] ^= ~B[2] & B[4];
      s[y + 1] ^= ~B[3] & B[5];
      s[y + 2] ^= ~B[4] & B[6];
      s[y + 3] ^= ~B[5] & B[7];
      s[y + 4] ^= ~B[6] & B[8];
      s[y + 5] ^= ~B[7] & B[9];
      s[y + 6] ^= ~B[8] & B[0];
      s[y + 7] ^= ~B[9] & B[1];
      s[y + 8] ^= ~B[0] & B[2];
      s[y + 9] ^= ~B[1] & B[3];
    }
    s[0] ^= SHA3_IOTA_H2[round];
    s[1] ^= SHA3_IOTA_L2[round];
  }
}
var _0n2, _1n2, _2n2, _7n2, _256n2, _0x71n2, SHA3_PI2, SHA3_ROTL2, _SHA3_IOTA2, IOTAS2, SHA3_IOTA_H2, SHA3_IOTA_L2, rotlH, rotlL, Keccak, genKeccak, sha3_2562, genShake, shake2562;
var init_sha32 = __esm({
  "node_modules/mlkem/esm/src/sha3/sha3.js"() {
    init_u642();
    init_utils3();
    _0n2 = 0n;
    _1n2 = 1n;
    _2n2 = 2n;
    _7n2 = 7n;
    _256n2 = 256n;
    _0x71n2 = 0x71n;
    SHA3_PI2 = [];
    SHA3_ROTL2 = [];
    _SHA3_IOTA2 = [];
    for (let round = 0, R = _1n2, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI2.push(2 * (5 * y + x));
      SHA3_ROTL2.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n2;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n2 ^ (R >> _7n2) * _0x71n2) % _256n2;
        if (R & _2n2)
          t ^= _1n2 << (_1n2 << BigInt(j)) - _1n2;
      }
      _SHA3_IOTA2.push(t);
    }
    IOTAS2 = split2(_SHA3_IOTA2, true);
    SHA3_IOTA_H2 = IOTAS2[0];
    SHA3_IOTA_L2 = IOTAS2[1];
    rotlH = (h, l, s) => s > 32 ? rotlBH2(h, l, s) : rotlSH2(h, l, s);
    rotlL = (h, l, s) => s > 32 ? rotlBL2(h, l, s) : rotlSL2(h, l, s);
    Keccak = class _Keccak {
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        Object.defineProperty(this, "state", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "pos", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "posOut", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "finished", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        Object.defineProperty(this, "state32", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "destroyed", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        Object.defineProperty(this, "_B", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint32Array(10)
        });
        Object.defineProperty(this, "blockLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "suffix", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "outputLen", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "enableXOF", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        Object.defineProperty(this, "rounds", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        anumber4(outputLen, "outputLen");
        if (!(0 < blockLen && blockLen < 200)) {
          throw new Error("only keccak-f1600 function is supported");
        }
        this.state = new Uint8Array(200);
        this.state32 = u324(this.state);
      }
      clone() {
        return this._cloneInto();
      }
      /** Resets instance to initial (empty) state for reuse. */
      reset() {
        this.state.fill(0);
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
      }
      keccak() {
        swap32IfBE2(this.state32);
        keccakP(this.state32, this.rounds, this._B);
        swap32IfBE2(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists4(this);
        abytes4(data);
        return this.updateUnsafe(data);
      }
      /** Like update(), but skips validation. Caller must ensure valid state and input. */
      updateUnsafe(data) {
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists4(this, false);
        abytes4(out);
        return this.writeIntoUnsafe(out);
      }
      /** Like writeInto(), but skips validation. Caller must ensure valid state and output. */
      writeIntoUnsafe(out) {
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF) {
          throw new Error("XOF is not possible for this instance");
        }
        return this.writeInto(out);
      }
      xof(bytes) {
        anumber4(bytes);
        return this.xofInto(new Uint8Array(bytes));
      }
      digestInto(out) {
        aoutput4(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out);
        this.destroy();
        return out;
      }
      digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
      }
      destroy() {
        this.destroyed = true;
        clean4(this.state);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher2(() => new Keccak(blockLen, suffix, outputLen), info);
    sha3_2562 = /* @__PURE__ */ genKeccak(
      6,
      136,
      32,
      /* @__PURE__ */ oidNist2(8)
    );
    genShake = (suffix, blockLen, outputLen, info = {}) => createHasher2((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true), info);
    shake2562 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist2(12));
  }
});

// node_modules/mlkem/esm/src/deps.js
var init_deps = __esm({
  "node_modules/mlkem/esm/src/deps.js"() {
    init_sha32();
  }
});

// node_modules/mlkem/esm/_dnt.shims.js
function createMergeProxy2(baseObj, extObj) {
  return new Proxy(baseObj, {
    get(_target, prop, _receiver) {
      if (prop in extObj) {
        return extObj[prop];
      } else {
        return baseObj[prop];
      }
    },
    set(_target, prop, value) {
      if (prop in extObj) {
        delete extObj[prop];
      }
      baseObj[prop] = value;
      return true;
    },
    deleteProperty(_target, prop) {
      let success = false;
      if (prop in extObj) {
        delete extObj[prop];
        success = true;
      }
      if (prop in baseObj) {
        delete baseObj[prop];
        success = true;
      }
      return success;
    },
    ownKeys(_target) {
      const baseKeys = Reflect.ownKeys(baseObj);
      const extKeys = Reflect.ownKeys(extObj);
      const extKeysSet = new Set(extKeys);
      return [...baseKeys.filter((k) => !extKeysSet.has(k)), ...extKeys];
    },
    defineProperty(_target, prop, desc) {
      if (prop in extObj) {
        delete extObj[prop];
      }
      Reflect.defineProperty(baseObj, prop, desc);
      return true;
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (prop in extObj) {
        return Reflect.getOwnPropertyDescriptor(extObj, prop);
      } else {
        return Reflect.getOwnPropertyDescriptor(baseObj, prop);
      }
    },
    has(_target, prop) {
      return prop in extObj || prop in baseObj;
    }
  });
}
var dntGlobals2, dntGlobalThis2;
var init_dnt_shims2 = __esm({
  "node_modules/mlkem/esm/_dnt.shims.js"() {
    dntGlobals2 = {};
    dntGlobalThis2 = createMergeProxy2(globalThis, dntGlobals2);
  }
});

// node_modules/mlkem/esm/src/utils.js
function byte(n) {
  return n & 255;
}
function int16(n) {
  return n << 16 >> 16;
}
function uint16(n) {
  return n & 65535;
}
function constantTimeCompare(x, y) {
  if (x.length != y.length) {
    return 0;
  }
  let v = 0;
  for (let i = 0; i < x.length; i++) {
    v |= x[i] ^ y[i];
  }
  let z = ~v & 255;
  z &= z >> 4;
  z &= z >> 2;
  z &= z >> 1;
  return z & 1;
}
function equalUint8Array(x, y) {
  if (x.length != y.length) {
    return false;
  }
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) {
      return false;
    }
  }
  return true;
}
async function loadCrypto2() {
  if (typeof dntGlobalThis2 !== "undefined" && globalThis.crypto !== void 0) {
    return globalThis.crypto;
  }
  try {
    const { webcrypto } = await import("crypto");
    return webcrypto;
  } catch (_e) {
    throw new Error("failed to load Crypto");
  }
}
function byteopsLoad32(x, o = 0) {
  return (x[o] | x[o + 1] << 8 | x[o + 2] << 16 | x[o + 3] << 24) >>> 0;
}
var init_utils4 = __esm({
  "node_modules/mlkem/esm/src/utils.js"() {
    init_dnt_shims2();
    init_deps();
  }
});

// node_modules/mlkem/esm/src/mlKemBase.js
function polyToMsg(a) {
  const msg = new Uint8Array(32);
  let t, v;
  for (let i = 0; i < N / 8; i++) {
    for (let j = 0; j < 8; j++) {
      v = a[8 * i + j] - Q;
      v += v >> 31 & Q;
      t = ((uint16(v) << 1) + uint16(Q / 2)) / uint16(Q) & 1;
      msg[i] |= byte(t << j);
    }
  }
  return msg;
}
function polyFromMsg(msg) {
  const r = new Int16Array(N);
  let mask;
  for (let i = 0; i < N / 8; i++) {
    for (let j = 0; j < 8; j++) {
      mask = -1 * int16(msg[i] >> j & 1);
      r[8 * i + j] = mask & int16((Q + 1) / 2);
    }
  }
  return r;
}
function indcpaRejUniform(out, outOffset, buf, bufl, len) {
  let ctr = 0;
  let val0, val1;
  for (let pos = 0; ctr < len && pos + 3 <= bufl; ) {
    val0 = (uint16(buf[pos] >> 0) | uint16(buf[pos + 1]) << 8) & 4095;
    val1 = (uint16(buf[pos + 1] >> 4) | uint16(buf[pos + 2]) << 4) & 4095;
    pos = pos + 3;
    if (val0 < Q) {
      out[outOffset + ctr] = val0;
      ctr = ctr + 1;
    }
    if (ctr < len && val1 < Q) {
      out[outOffset + ctr] = val1;
      ctr = ctr + 1;
    }
  }
  return ctr;
}
function byteopsCbd(out, buf, eta) {
  let t, d;
  let a, b;
  for (let i = 0; i < N / 8; i++) {
    t = byteopsLoad32(buf, 4 * i);
    d = t & 1431655765;
    d = d + (t >> 1 & 1431655765);
    for (let j = 0; j < 8; j++) {
      a = int16(d >> 4 * j + 0 & 3);
      b = int16(d >> 4 * j + eta & 3);
      out[8 * i + j] = a - b;
    }
  }
}
function ntt(r) {
  for (let j = 0, k = 1, l = 128; l >= 2; l >>= 1) {
    for (let start = 0; start < 256; start = j + l) {
      const zeta = NTT_ZETAS[k];
      k = k + 1;
      for (j = start; j < start + l; j++) {
        const t = nttFqMul(zeta, r[j + l]);
        r[j + l] = r[j] - t;
        r[j] = r[j] + t;
      }
    }
  }
  return r;
}
function nttFqMul(a, b) {
  const ab = a * b;
  const u = Math.imul(ab, Q_INV) << 16 >> 16;
  return ab - u * Q >> 16;
}
function reduce(r) {
  for (let i = 0; i < N; i++) {
    r[i] = barrett(r[i]);
  }
  return r;
}
function barrett(a) {
  let t = BARRETT_V * a >> 24;
  t = t * Q;
  return a - t;
}
function polyToMont(r) {
  const f = 1353;
  for (let i = 0; i < N; i++) {
    const a = r[i] * f;
    const u = Math.imul(a, Q_INV) << 16 >> 16;
    r[i] = a - u * Q >> 16;
  }
  return r;
}
function multiply(a, b) {
  let r = polyBaseMulMontgomery(a[0], b[0]);
  let t;
  for (let i = 1; i < a.length; i++) {
    t = polyBaseMulMontgomery(a[i], b[i]);
    r = add2(r, t);
  }
  return reduce(r);
}
function polyBaseMulMontgomery(a, b) {
  for (let i = 0; i < N / 4; i++) {
    const idx = 4 * i;
    const a0 = a[idx], a1 = a[idx + 1], a2 = a[idx + 2], a3 = a[idx + 3];
    const b0 = b[idx], b1 = b[idx + 1], b2 = b[idx + 2], b3 = b[idx + 3];
    const zeta = NTT_ZETAS[64 + i];
    a[idx] = nttFqMul(nttFqMul(a1, b1), zeta) + nttFqMul(a0, b0);
    a[idx + 1] = nttFqMul(a0, b1) + nttFqMul(a1, b0);
    a[idx + 2] = nttFqMul(nttFqMul(a3, b3), -zeta) + nttFqMul(a2, b2);
    a[idx + 3] = nttFqMul(a2, b3) + nttFqMul(a3, b2);
  }
  return a;
}
function add2(a, b) {
  for (let i = 0; i < N; i++) {
    a[i] += b[i];
  }
  return a;
}
function subtract(a, b) {
  for (let i = 0; i < N; i++) {
    a[i] -= b[i];
  }
  return a;
}
function nttInverse(r) {
  let j = 0;
  for (let k = 0, l = 2; l <= 128; l <<= 1) {
    for (let start = 0; start < 256; start = j + l) {
      const zeta = NTT_ZETAS_INV[k];
      k = k + 1;
      for (j = start; j < start + l; j++) {
        const t = r[j];
        r[j] = barrett(t + r[j + l]);
        r[j + l] = t - r[j + l];
        r[j + l] = nttFqMul(zeta, r[j + l]);
      }
    }
  }
  for (j = 0; j < 256; j++) {
    r[j] = nttFqMul(r[j], NTT_ZETAS_INV[127]);
  }
  return r;
}
var MlKemBase, BARRETT_V;
var init_mlKemBase = __esm({
  "node_modules/mlkem/esm/src/mlKemBase.js"() {
    init_deps();
    init_consts2();
    init_utils4();
    MlKemBase = class {
      /**
       * Creates a new instance of the MlKemBase class.
       */
      constructor() {
        Object.defineProperty(this, "_api", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_k", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_du", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_dv", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_eta1", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_eta2", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_skSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_pkSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_compressedUSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_compressedVSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 0
        });
        Object.defineProperty(this, "_poolG", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_poolH", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_poolKdf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_poolXof", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_poolPrf1", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_poolPrf2", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_bufG", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(64)
        });
        Object.defineProperty(this, "_bufH", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(32)
        });
        Object.defineProperty(this, "_bufKdf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(32)
        });
        Object.defineProperty(this, "_bufXof", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(672)
        });
        Object.defineProperty(this, "_bufPrf1", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_bufPrf2", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_nonceBuf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(1)
        });
        Object.defineProperty(this, "_xofSeed", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: new Uint8Array(34)
        });
        Object.defineProperty(this, "_kBuf", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_matrixA", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_noiseVecs", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_polyVec", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_bufPkCheck", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_bufCt", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
      }
      _initPool() {
        this._poolG = new Keccak(72, 6, 64);
        this._poolH = new Keccak(136, 6, 32);
        this._poolKdf = new Keccak(136, 31, 32, true);
        this._poolXof = new Keccak(168, 31, 672, true);
        const prf1Len = this._eta1 * N / 4;
        this._poolPrf1 = new Keccak(136, 31, prf1Len, true);
        this._bufPrf1 = new Uint8Array(prf1Len);
        const prf2Len = this._eta2 * N / 4;
        this._poolPrf2 = new Keccak(136, 31, prf2Len, true);
        this._bufPrf2 = new Uint8Array(prf2Len);
        this._kBuf = new Uint8Array([this._k]);
        this._matrixA = new Array(this._k);
        for (let i = 0; i < this._k; i++) {
          this._matrixA[i] = new Array(this._k);
          for (let j = 0; j < this._k; j++) {
            this._matrixA[i][j] = new Int16Array(N);
          }
        }
        const maxNoise = 2 * this._k + 1;
        this._noiseVecs = new Array(maxNoise);
        for (let i = 0; i < maxNoise; i++) {
          this._noiseVecs[i] = new Int16Array(N);
        }
        this._polyVec = new Array(this._k);
        for (let i = 0; i < this._k; i++) {
          this._polyVec[i] = new Int16Array(N);
        }
        this._bufPkCheck = new Uint8Array(384 * this._k);
        this._bufCt = new Uint8Array(this._compressedUSize + this._compressedVSize);
      }
      _zeroPool() {
        this._bufG.fill(0);
        this._bufH.fill(0);
        this._bufKdf.fill(0);
        this._bufXof.fill(0);
        this._bufPrf1.fill(0);
        this._bufPrf2.fill(0);
        this._nonceBuf[0] = 0;
        this._xofSeed.fill(0);
        for (let i = 0; i < this._k; i++) {
          for (let j = 0; j < this._k; j++) {
            this._matrixA[i][j].fill(0);
          }
        }
        for (let i = 0; i < this._noiseVecs.length; i++) {
          this._noiseVecs[i].fill(0);
        }
        for (let i = 0; i < this._k; i++) {
          this._polyVec[i].fill(0);
        }
        this._bufPkCheck.fill(0);
        this._bufCt.fill(0);
        this._poolG.reset();
        this._poolH.reset();
        this._poolKdf.reset();
        this._poolXof.reset();
        this._poolPrf1.reset();
        this._poolPrf2.reset();
      }
      // Serialize polynomial into byte buffer at offset (eliminates intermediate Uint8Array(384))
      _polyToBytes(out, outOffset, a) {
        let t0, t1;
        for (let i = 0; i < N / 2; i++) {
          t0 = a[2 * i] - Q;
          t0 += t0 >> 31 & Q;
          t1 = a[2 * i + 1] - Q;
          t1 += t1 >> 31 & Q;
          out[outOffset + 3 * i + 0] = byte(t0);
          out[outOffset + 3 * i + 1] = byte(t0 >> 8) | byte(t1 << 4);
          out[outOffset + 3 * i + 2] = byte(t1 >> 4);
        }
      }
      // Deserialize bytes into polynomial (eliminates intermediate Int16Array(N))
      _polyFromBytes(out, a, aOffset) {
        for (let i = 0; i < N / 2; i++) {
          out[2 * i] = int16((uint16(a[aOffset + 3 * i + 0]) >> 0 | uint16(a[aOffset + 3 * i + 1]) << 8) & 4095);
          out[2 * i + 1] = int16((uint16(a[aOffset + 3 * i + 1]) >> 4 | uint16(a[aOffset + 3 * i + 2]) << 4) & 4095);
        }
      }
      // Hash G: SHA3-512
      _g(a, b) {
        this._poolG.reset();
        this._poolG.updateUnsafe(a);
        if (b !== void 0)
          this._poolG.updateUnsafe(b);
        this._poolG.writeIntoUnsafe(this._bufG);
        return [this._bufG.subarray(0, 32), this._bufG.subarray(32, 64)];
      }
      // Hash H: SHA3-256
      _h(msg) {
        this._poolH.reset();
        this._poolH.updateUnsafe(msg).writeIntoUnsafe(this._bufH);
        return this._bufH;
      }
      // KDF: SHAKE256(dkLen=32)
      _kdf(a, b) {
        this._poolKdf.reset();
        this._poolKdf.updateUnsafe(a);
        if (b !== void 0)
          this._poolKdf.updateUnsafe(b);
        this._poolKdf.writeIntoUnsafe(this._bufKdf);
        return this._bufKdf;
      }
      // XOF: SHAKE128(dkLen=672)
      _xof(seed) {
        this._poolXof.reset();
        this._poolXof.updateUnsafe(seed).writeIntoUnsafe(this._bufXof);
        return this._bufXof;
      }
      // PRF for eta1 noise sampling: SHAKE256(dkLen=eta1*N/4)
      _prf1(sigma, nonce) {
        this._nonceBuf[0] = nonce;
        this._poolPrf1.reset();
        this._poolPrf1.updateUnsafe(sigma).updateUnsafe(this._nonceBuf).writeIntoUnsafe(this._bufPrf1);
        return this._bufPrf1;
      }
      // PRF for eta2 noise sampling: SHAKE256(dkLen=eta2*N/4)
      _prf2(sigma, nonce) {
        this._nonceBuf[0] = nonce;
        this._poolPrf2.reset();
        this._poolPrf2.updateUnsafe(sigma).updateUnsafe(this._nonceBuf).writeIntoUnsafe(this._bufPrf2);
        return this._bufPrf2;
      }
      _generateKeyPairCore() {
        try {
          const rnd = new Uint8Array(64);
          this._api.getRandomValues(rnd);
          return this._deriveKeyPair(rnd);
        } finally {
          this._zeroPool();
        }
      }
      _deriveKeyPairCore(seed) {
        try {
          if (seed.byteLength !== 64) {
            throw new Error("seed must be 64 bytes in length");
          }
          return this._deriveKeyPair(seed);
        } finally {
          this._zeroPool();
        }
      }
      _encapCore(pk, seed) {
        try {
          if (pk.length !== 384 * this._k + 32) {
            throw new Error("invalid encapsulation key");
          }
          const m = this._getSeed(seed);
          const [k, r] = this._g(m, this._h(pk));
          this._encap(pk, m, r);
          return [this._bufCt.slice(), k.slice()];
        } finally {
          this._zeroPool();
        }
      }
      _decapCore(ct, sk) {
        try {
          if (ct.byteLength !== this._compressedUSize + this._compressedVSize) {
            throw new Error("Invalid ct size");
          }
          if (sk.length !== 768 * this._k + 96) {
            throw new Error("Invalid decapsulation key");
          }
          const sk2 = sk.subarray(0, this._skSize);
          const pk = sk.subarray(this._skSize, this._skSize + this._pkSize);
          const hpk = sk.subarray(this._skSize + this._pkSize, this._skSize + this._pkSize + 32);
          const z = sk.subarray(this._skSize + this._pkSize + 32, this._skSize + this._pkSize + 64);
          const m2 = this._decap(ct, sk2);
          const [k2, r2] = this._g(m2, hpk);
          const kBar = this._kdf(z, ct);
          this._encap(pk, m2, r2);
          return constantTimeCompare(ct, this._bufCt) === 1 ? k2.slice() : kBar.slice();
        } finally {
          this._zeroPool();
        }
      }
      /**
       * Sets up the MlKemBase instance by loading the necessary crypto library.
       * If the crypto library is already loaded, this method does nothing.
       * @returns {Promise<void>} A promise that resolves when the setup is complete.
       */
      async _setup() {
        if (this._api !== void 0) {
          return;
        }
        this._api = await loadCrypto2();
      }
      /**
       * Returns a Uint8Array seed for cryptographic operations.
       * If no seed is provided, a random seed of length 32 bytes is generated.
       * If a seed is provided, it must be exactly 32 bytes in length.
       *
       * @param seed - Optional seed for cryptographic operations.
       * @returns A Uint8Array seed.
       * @throws Error if the provided seed is not 32 bytes in length.
       */
      _getSeed(seed) {
        if (seed == void 0) {
          const s = new Uint8Array(32);
          this._api.getRandomValues(s);
          return s;
        }
        if (seed.byteLength !== 32) {
          throw new Error("seed must be 32 bytes in length");
        }
        return seed;
      }
      /**
       * Derives a key pair from a given seed.
       *
       * @param seed - The seed used for key derivation.
       * @returns An array containing the public key and secret key.
       */
      _deriveKeyPair(seed) {
        const cpaSeed = seed.subarray(0, 32);
        const z = seed.subarray(32, 64);
        const [pk, skBody] = this._deriveCpaKeyPair(cpaSeed);
        const pkh = this._h(pk);
        const sk = new Uint8Array(this._skSize + this._pkSize + 64);
        sk.set(skBody, 0);
        sk.set(pk, this._skSize);
        sk.set(pkh, this._skSize + this._pkSize);
        sk.set(z, this._skSize + this._pkSize + 32);
        return [pk, sk];
      }
      // indcpaKeyGen generates public and private keys for the CPA-secure
      // public-key encryption scheme underlying ML-KEM.
      /**
       * Derives a CPA key pair using the provided CPA seed.
       *
       * @param cpaSeed - The CPA seed used for key derivation.
       * @returns An array containing the public key and private key.
       */
      _deriveCpaKeyPair(cpaSeed) {
        const [publicSeed, noiseSeed] = this._g(cpaSeed, this._kBuf);
        const a = this._sampleMatrix(publicSeed, false);
        const s = this._sampleNoise1(noiseSeed, 0, this._k);
        const e = this._sampleNoise1(noiseSeed, this._k, this._k);
        for (let i = 0; i < this._k; i++) {
          s[i] = ntt(s[i]);
          s[i] = reduce(s[i]);
          e[i] = ntt(e[i]);
        }
        const pk = new Array(this._k);
        for (let i = 0; i < this._k; i++) {
          pk[i] = polyToMont(multiply(a[i], s));
          pk[i] = add2(pk[i], e[i]);
          pk[i] = reduce(pk[i]);
        }
        const pubKey = new Uint8Array(this._pkSize);
        for (let i = 0; i < this._k; i++) {
          this._polyToBytes(pubKey, i * 384, pk[i]);
        }
        pubKey.set(publicSeed, this._skSize);
        const privKey = new Uint8Array(this._skSize);
        for (let i = 0; i < this._k; i++) {
          this._polyToBytes(privKey, i * 384, s[i]);
        }
        return [pubKey, privKey];
      }
      // _encap is the encapsulation function of the CPA-secure
      // public-key encryption scheme underlying ML-KEM.
      /**
       * Encapsulates a message using the ML-KEM encryption scheme.
       *
       * @param pk - The public key.
       * @param msg - The message to be encapsulated.
       * @param seed - The seed used for generating random values.
       * @returns The encapsulated message as a Uint8Array.
       */
      _encap(pk, msg, seed) {
        const tHat = this._polyVec;
        const pkCheck = this._bufPkCheck;
        for (let i = 0; i < this._k; i++) {
          this._polyFromBytes(tHat[i], pk, i * 384);
          this._polyToBytes(pkCheck, i * 384, tHat[i]);
        }
        if (!equalUint8Array(pk.subarray(0, pkCheck.length), pkCheck)) {
          throw new Error("invalid encapsulation key");
        }
        const rho = pk.subarray(this._skSize);
        const a = this._sampleMatrix(rho, true);
        const r = this._sampleNoise1(seed, 0, this._k);
        const e1 = this._sampleNoise2(seed, this._k, this._k);
        const e2 = this._sampleNoise2(seed, this._k * 2, 1)[0];
        for (let i = 0; i < this._k; i++) {
          r[i] = ntt(r[i]);
          r[i] = reduce(r[i]);
        }
        const u = new Array(this._k);
        for (let i = 0; i < this._k; i++) {
          u[i] = multiply(a[i], r);
          u[i] = nttInverse(u[i]);
          u[i] = add2(u[i], e1[i]);
          u[i] = reduce(u[i]);
        }
        const m = polyFromMsg(msg);
        let v = multiply(tHat, r);
        v = nttInverse(v);
        v = add2(v, e2);
        v = add2(v, m);
        v = reduce(v);
        this._compressU(this._bufCt.subarray(0, this._compressedUSize), u);
        this._compressV(this._bufCt.subarray(this._compressedUSize), v);
        return this._bufCt;
      }
      // indcpaDecrypt is the decryption function of the CPA-secure
      // public-key encryption scheme underlying ML-KEM.
      /**
       * Decapsulates the ciphertext using the provided secret key.
       *
       * @param ct - The ciphertext to be decapsulated.
       * @param sk - The secret key used for decapsulation.
       * @returns The decapsulated message as a Uint8Array.
       */
      _decap(ct, sk) {
        const u = this._decompressU(ct.subarray(0, this._compressedUSize));
        const v = this._decompressV(ct.subarray(this._compressedUSize));
        const privateKeyPolyvec = this._polyvecFromBytes(sk);
        for (let i = 0; i < this._k; i++) {
          u[i] = ntt(u[i]);
        }
        let mp = multiply(privateKeyPolyvec, u);
        mp = nttInverse(mp);
        mp = subtract(v, mp);
        mp = reduce(mp);
        return polyToMsg(mp);
      }
      // generateMatrixA deterministically generates a matrix `A` (or the transpose of `A`)
      // from a seed. Entries of the matrix are polynomials that look uniformly random.
      // Performs rejection sampling on the output of an extendable-output function (XOF).
      /**
       * Generates a sample matrix based on the provided seed and transposition flag.
       *
       * @param seed - The seed used for generating the matrix.
       * @param transposed - A flag indicating whether the matrix should be transposed or not.
       * @returns The generated sample matrix.
       */
      _sampleMatrix(seed, transposed) {
        const a = this._matrixA;
        this._xofSeed.set(seed);
        for (let ctr = 0, i = 0; i < this._k; i++) {
          for (let j = 0; j < this._k; j++) {
            if (transposed) {
              this._xofSeed[seed.length] = i;
              this._xofSeed[seed.length + 1] = j;
            } else {
              this._xofSeed[seed.length] = j;
              this._xofSeed[seed.length + 1] = i;
            }
            const output = this._xof(this._xofSeed);
            ctr = indcpaRejUniform(a[i][j], 0, output.subarray(0, 504), 504, N);
            while (ctr < N) {
              const outputn = output.subarray(504, 672);
              ctr += indcpaRejUniform(a[i][j], ctr, outputn, 168, N - ctr);
            }
          }
        }
        return a;
      }
      /**
       * Generates a 2D array of noise samples.
       *
       * @param sigma - The noise parameter.
       * @param offset - The offset value.
       * @param size - The size of the array.
       * @returns The generated 2D array of noise samples.
       */
      _sampleNoise1(sigma, offset, size) {
        const r = new Array(size);
        for (let i = 0; i < size; i++) {
          r[i] = this._noiseVecs[offset + i];
          byteopsCbd(r[i], this._prf1(sigma, offset + i), this._eta1);
        }
        return r;
      }
      /**
       * Generates a 2-dimensional array of noise samples.
       *
       * @param sigma - The noise parameter.
       * @param offset - The offset value.
       * @param size - The size of the array.
       * @returns The generated 2-dimensional array of noise samples.
       */
      _sampleNoise2(sigma, offset, size) {
        const r = new Array(size);
        for (let i = 0; i < size; i++) {
          r[i] = this._noiseVecs[offset + i];
          byteopsCbd(r[i], this._prf2(sigma, offset + i), this._eta2);
        }
        return r;
      }
      // polyvecFromBytes deserializes a vector of polynomials.
      /**
       * Converts a Uint8Array to a 2D array of numbers representing a polynomial vector.
       * Each element in the resulting array represents a polynomial.
       * @param a The Uint8Array to convert.
       * @returns The 2D array of numbers representing the polynomial vector.
       */
      _polyvecFromBytes(a) {
        const r = this._polyVec;
        for (let i = 0; i < this._k; i++) {
          this._polyFromBytes(r[i], a, i * 384);
        }
        return r;
      }
      // compressU lossily compresses and serializes a vector of polynomials.
      /**
       * Compresses the given array of coefficients into a Uint8Array.
       *
       * @param r - The output Uint8Array.
       * @param u - The array of coefficients.
       * @returns The compressed Uint8Array.
       */
      _compressU(r, u) {
        const t = new Array(4);
        for (let rr = 0, i = 0; i < this._k; i++) {
          for (let j = 0; j < N / 4; j++) {
            for (let k = 0; k < 4; k++) {
              t[k] = ((u[i][4 * j + k] << 10) + Q / 2) / Q & 1023;
            }
            r[rr++] = byte(t[0] >> 0);
            r[rr++] = byte(t[0] >> 8 | t[1] << 2);
            r[rr++] = byte(t[1] >> 6 | t[2] << 4);
            r[rr++] = byte(t[2] >> 4 | t[3] << 6);
            r[rr++] = byte(t[3] >> 2);
          }
        }
        return r;
      }
      // compressV lossily compresses and subsequently serializes a polynomial.
      /**
       * Compresses the given array of numbers into a Uint8Array.
       *
       * @param r - The Uint8Array to store the compressed values.
       * @param v - The array of numbers to compress.
       * @returns The compressed Uint8Array.
       */
      _compressV(r, v) {
        const t = new Uint8Array(8);
        for (let rr = 0, i = 0; i < N / 8; i++) {
          for (let j = 0; j < 8; j++) {
            t[j] = byte(((v[8 * i + j] << 4) + Q / 2) / Q) & 15;
          }
          r[rr++] = t[0] | t[1] << 4;
          r[rr++] = t[2] | t[3] << 4;
          r[rr++] = t[4] | t[5] << 4;
          r[rr++] = t[6] | t[7] << 4;
        }
        return r;
      }
      // decompressU de-serializes and decompresses a vector of polynomials and
      // represents the approximate inverse of compress1. Since compression is lossy,
      // the results of decompression will may not match the original vector of polynomials.
      /**
       * Decompresses a Uint8Array into a two-dimensional array of numbers.
       *
       * @param a The Uint8Array to decompress.
       * @returns The decompressed two-dimensional array.
       */
      _decompressU(a) {
        const r = new Array(this._k);
        for (let i = 0; i < this._k; i++) {
          r[i] = new Int16Array(N);
        }
        const t = new Array(4);
        for (let aa = 0, i = 0; i < this._k; i++) {
          for (let j = 0; j < N / 4; j++) {
            t[0] = uint16(a[aa + 0]) >> 0 | uint16(a[aa + 1]) << 8;
            t[1] = uint16(a[aa + 1]) >> 2 | uint16(a[aa + 2]) << 6;
            t[2] = uint16(a[aa + 2]) >> 4 | uint16(a[aa + 3]) << 4;
            t[3] = uint16(a[aa + 3]) >> 6 | uint16(a[aa + 4]) << 2;
            aa = aa + 5;
            for (let k = 0; k < 4; k++) {
              r[i][4 * j + k] = int16((t[k] & 1023) * Q + 512 >> 10);
            }
          }
        }
        return r;
      }
      // decompressV de-serializes and subsequently decompresses a polynomial,
      // representing the approximate inverse of compress2.
      // Note that compression is lossy, and thus decompression will not match the
      // original input.
      /**
       * Decompresses a Uint8Array into an array of numbers.
       *
       * @param a - The Uint8Array to decompress.
       * @returns An array of numbers.
       */
      _decompressV(a) {
        const r = new Int16Array(N);
        for (let aa = 0, i = 0; i < N / 2; i++, aa++) {
          r[2 * i + 0] = int16((a[aa] & 15) * Q + 8 >> 4);
          r[2 * i + 1] = int16((a[aa] >> 4) * Q + 8 >> 4);
        }
        return r;
      }
    };
    BARRETT_V = ((1 << 24) + Q / 2) / Q;
  }
});

// node_modules/mlkem/esm/src/mlKem512Base.js
var init_mlKem512Base = __esm({
  "node_modules/mlkem/esm/src/mlKem512Base.js"() {
    init_consts2();
    init_mlKemBase();
    init_utils4();
  }
});

// node_modules/mlkem/esm/src/mlKem512.js
var init_mlKem512 = __esm({
  "node_modules/mlkem/esm/src/mlKem512.js"() {
    init_errors2();
    init_mlKem512Base();
  }
});

// node_modules/mlkem/esm/src/mlKem512Impl.js
var init_mlKem512Impl = __esm({
  "node_modules/mlkem/esm/src/mlKem512Impl.js"() {
    init_errors2();
    init_mlKem512Base();
  }
});

// node_modules/mlkem/esm/src/mlKem768.js
var MlKem768;
var init_mlKem768 = __esm({
  "node_modules/mlkem/esm/src/mlKem768.js"() {
    init_consts2();
    init_errors2();
    init_mlKemBase();
    MlKem768 = class extends MlKemBase {
      constructor() {
        super();
        Object.defineProperty(this, "_k", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 3
        });
        Object.defineProperty(this, "_du", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 10
        });
        Object.defineProperty(this, "_dv", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 4
        });
        Object.defineProperty(this, "_eta1", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 2
        });
        Object.defineProperty(this, "_eta2", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 2
        });
        this._skSize = 12 * this._k * N / 8;
        this._pkSize = this._skSize + 32;
        this._compressedUSize = this._k * this._du * N / 8;
        this._compressedVSize = this._dv * N / 8;
        this._initPool();
      }
      /**
       * Generates a keypair [publicKey, privateKey].
       *
       * If an error occurred, throws {@link MlKemError}.
       *
       * @returns A kaypair [publicKey, privateKey].
       * @throws {@link MlKemError}
       */
      async generateKeyPair() {
        await this._setup();
        try {
          return this._generateKeyPairCore();
        } catch (e) {
          throw new MlKemError(e);
        }
      }
      /**
       * Derives a keypair [publicKey, privateKey] deterministically from a 64-octet seed.
       *
       * If an error occurred, throws {@link MlKemError}.
       *
       * @param seed A 64-octet seed for the deterministic key generation.
       * @returns A kaypair [publicKey, privateKey].
       * @throws {@link MlKemError}
       */
      async deriveKeyPair(seed) {
        await this._setup();
        try {
          return this._deriveKeyPairCore(seed);
        } catch (e) {
          throw new MlKemError(e);
        }
      }
      /**
       * Generates a shared secret from the encapsulated ciphertext and the private key.
       *
       * If an error occurred, throws {@link MlKemError}.
       *
       * @param pk A public key.
       * @param seed An optional 32-octet seed for the deterministic shared secret generation.
       * @returns A ciphertext (encapsulated public key) and a shared secret.
       * @throws {@link MlKemError}
       */
      async encap(pk, seed) {
        await this._setup();
        try {
          return this._encapCore(pk, seed);
        } catch (e) {
          throw new MlKemError(e);
        }
      }
      /**
       * Generates a ciphertext for the public key and a shared secret.
       *
       * If an error occurred, throws {@link MlKemError}.
       *
       * @param ct A ciphertext generated by {@link encap}.
       * @param sk A private key.
       * @returns A shared secret.
       * @throws {@link MlKemError}
       */
      async decap(ct, sk) {
        await this._setup();
        try {
          return this._decapCore(ct, sk);
        } catch (e) {
          throw new MlKemError(e);
        }
      }
    };
  }
});

// node_modules/mlkem/esm/src/mlKem768Impl.js
var init_mlKem768Impl = __esm({
  "node_modules/mlkem/esm/src/mlKem768Impl.js"() {
    init_consts2();
    init_errors2();
    init_mlKemBase();
  }
});

// node_modules/mlkem/esm/src/mlKem1024Base.js
var init_mlKem1024Base = __esm({
  "node_modules/mlkem/esm/src/mlKem1024Base.js"() {
    init_consts2();
    init_mlKemBase();
    init_utils4();
  }
});

// node_modules/mlkem/esm/src/mlKem1024.js
var init_mlKem1024 = __esm({
  "node_modules/mlkem/esm/src/mlKem1024.js"() {
    init_errors2();
    init_mlKem1024Base();
  }
});

// node_modules/mlkem/esm/src/mlKem1024Impl.js
var init_mlKem1024Impl = __esm({
  "node_modules/mlkem/esm/src/mlKem1024Impl.js"() {
    init_errors2();
    init_mlKem1024Base();
  }
});

// node_modules/mlkem/esm/mod.js
var init_mod3 = __esm({
  "node_modules/mlkem/esm/mod.js"() {
    init_errors2();
    init_mlKem512();
    init_mlKem512Impl();
    init_mlKem768();
    init_mlKem768Impl();
    init_mlKem1024();
    init_mlKem1024Impl();
    init_sha32();
  }
});

// node_modules/@hpke/dhkem-x25519/esm/src/primitives/x25519.js
function ed25519_pow_2_252_3(x) {
  const _10n = 10n;
  const _20n = 20n;
  const _40n = 40n;
  const _80n = 80n;
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n3, P) * b2 % P;
  const b5 = pow2(b4, _1n3, P) * x % P;
  const b10 = pow2(b5, _5n, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n3, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var _1n3, _2n3, _3n, _5n, ed25519_CURVE_p, x25519;
var init_x25519 = __esm({
  "node_modules/@hpke/dhkem-x25519/esm/src/primitives/x25519.js"() {
    init_mod();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _1n3 = 1n;
    _2n3 = 2n;
    _3n = 3n;
    _5n = 5n;
    ed25519_CURVE_p = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffedn;
    x25519 = /* @__PURE__ */ (() => {
      const P = ed25519_CURVE_p;
      return montgomery({
        P,
        type: "x25519",
        powPminus2: (x) => {
          const { pow_p_5_8, b2 } = ed25519_pow_2_252_3(x);
          return mod2(pow2(pow_p_5_8, _3n, P) * b2, P);
        },
        adjustScalarBytes
      });
    })();
  }
});

// node_modules/@hpke/dhkem-x25519/esm/src/hkdfSha256.js
var HkdfSha2562;
var init_hkdfSha256 = __esm({
  "node_modules/@hpke/dhkem-x25519/esm/src/hkdfSha256.js"() {
    init_mod();
    HkdfSha2562 = class extends HkdfSha256Native {
      async extract(salt, ikm) {
        await this._setup();
        const saltBuf = salt.byteLength === 0 ? new ArrayBuffer(this.hashSize) : toArrayBuffer(salt);
        const ikmBuf = toArrayBuffer(ikm);
        if (saltBuf.byteLength !== this.hashSize) {
          return hmac(sha256, new Uint8Array(saltBuf), new Uint8Array(ikmBuf)).buffer;
        }
        const key = await this._api.importKey("raw", saltBuf, this.algHash, false, [
          "sign"
        ]);
        return await this._api.sign("HMAC", key, ikmBuf);
      }
    };
  }
});

// node_modules/@hpke/dhkem-x25519/esm/src/dhkemX25519.js
var X255192;
var init_dhkemX25519 = __esm({
  "node_modules/@hpke/dhkem-x25519/esm/src/dhkemX25519.js"() {
    init_mod();
    init_x25519();
    init_hkdfSha256();
    X255192 = class extends XCurveDhkemPrimitives {
      constructor(hkdf) {
        super("X25519", 32, x25519, hkdf);
      }
      derive(sk, pk) {
        try {
          return Promise.resolve(this._curve.getSharedSecret(sk, pk));
        } catch (e) {
          return Promise.reject(new SerializeError(e));
        }
      }
    };
  }
});

// node_modules/@hpke/dhkem-x25519/esm/mod.js
var init_mod4 = __esm({
  "node_modules/@hpke/dhkem-x25519/esm/mod.js"() {
    init_dhkemX25519();
    init_hkdfSha256();
  }
});

// node_modules/@hpke/hybridkem-x-wing/esm/src/xWing.js
function combiner(ssM, ssX, ctX, pkX) {
  const ret = new Uint8Array(ssM.length + ssX.length + ctX.length + pkX.length + XWING_LABEL.length);
  ret.set(ssM, 0);
  ret.set(ssX, ssM.length);
  ret.set(ctX, ssM.length + ssX.length);
  ret.set(pkX, ssM.length + ssX.length + ctX.length);
  ret.set(XWING_LABEL, ssM.length + ssX.length + ctX.length + pkX.length);
  return sha3_2562.create().update(ret).digest();
}
var ALG_NAME2, X25519_BASE, XWING_LABEL, XWing;
var init_xWing = __esm({
  "node_modules/@hpke/hybridkem-x-wing/esm/src/xWing.js"() {
    init_mod3();
    init_mod();
    init_mod4();
    ALG_NAME2 = "X-Wing";
    X25519_BASE = new Uint8Array([
      9,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ]);
    XWING_LABEL = new Uint8Array([92, 46, 47, 47, 94, 92]);
    XWing = class {
      constructor() {
        Object.defineProperty(this, "id", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: KemId.XWing
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: ALG_NAME2
        });
        Object.defineProperty(this, "secretSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 32
        });
        Object.defineProperty(this, "encSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 1120
        });
        Object.defineProperty(this, "publicKeySize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 1216
        });
        Object.defineProperty(this, "privateKeySize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: 32
        });
        Object.defineProperty(this, "auth", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: false
        });
        Object.defineProperty(this, "_m", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_x25519", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "_api", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this._m = new MlKem768();
        this._x25519 = new X255192(new HkdfSha2562());
      }
      async serializePublicKey(key) {
        await this._setup();
        try {
          return await this._serializePublicKey(key);
        } catch (e) {
          throw new SerializeError(e);
        }
      }
      async deserializePublicKey(key) {
        await this._setup();
        try {
          return await this._deserializePublicKey(key);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      async serializePrivateKey(key) {
        await this._setup();
        try {
          return await this._serializePrivateKey(key);
        } catch (e) {
          throw new SerializeError(e);
        }
      }
      async deserializePrivateKey(key) {
        await this._setup();
        try {
          return await this._deserializePrivateKey(key);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      /**
       * Generates a new key pair.
       *
       * @returns {Promise<CryptoKeyPair>} A promise that resolves with a new key pair.
       */
      async generateKeyPair() {
        await this._setup();
        const sk = new Uint8Array(32);
        try {
          this._api.getRandomValues(sk);
        } catch (e) {
          throw new NotSupportedError(e);
        }
        try {
          const [_sk, pk] = await this._generateKeyPairDerand(sk);
          const dSk = await this.deserializePrivateKey(sk.buffer);
          const dPk = await this.deserializePublicKey(pk.buffer);
          return { privateKey: dSk, publicKey: dPk };
        } catch (e) {
          throw new DeriveKeyPairError(e);
        }
      }
      /**
       * Generates a key pair from the secret key.
       * @param sk The secret key.
       * @returns {Promise<CryptoKeyPair>} A promise that resolves with a new key pair.
       * @throws {InvalidParamError} Thrown if the length of the secret key is not 32 bytes.
       * @throws {DeriveKeyPairError} Thrown if the key pair cannot be derived.
       */
      async generateKeyPairDerand(sk) {
        if (sk.byteLength !== 32) {
          throw new InvalidParamError("Invalid length of sk");
        }
        try {
          const [_sk, pk] = await this._generateKeyPairDerand(sk);
          const dSk = await this.deserializePrivateKey(sk.buffer);
          const dPk = await this.deserializePublicKey(pk.buffer);
          return { privateKey: dSk, publicKey: dPk };
        } catch (e) {
          throw new DeriveKeyPairError(e);
        }
      }
      /**
       * Derives a key pair from the input keying material.
       *
       * @param {ArrayBuffer} ikm The input keying material.
       * @returns {Promise<CryptoKeyPair>} A promise that resolves with a new key pair.
       * @throws {DeriveKeyPairError} Thrown if the key pair cannot be derived.
       * @throws {InvalidParamError} Thrown if the length of the IKM is not 32 bytes.
       */
      async deriveKeyPair(ikm) {
        await this._setup();
        try {
          const sk = shake2562.create({ dkLen: 32 }).update(new Uint8Array(ikm)).digest();
          const [_sk, pk] = await this._generateKeyPairDerand(sk);
          const dSk = await this.deserializePrivateKey(sk.buffer);
          const dPk = await this.deserializePublicKey(pk.buffer);
          return { privateKey: dSk, publicKey: dPk };
        } catch (e) {
          throw new DeriveKeyPairError(e);
        }
      }
      /**
       * Imports a key from the input.
       * @param format The format of the key. "raw" or "jwk" can be specified.
       * @param key The key to import. If the format is "raw", the key must be an ArrayBuffer. If the format is "jwk", the key must be a JsonWebKey.
       * @param isPublic A boolean indicating whether the key is public or not. The default is true.
       * @returns {Promise<CryptoKey>} A promise that resolves with the imported key.
       * @throws {DeserializeError} Thrown if the key cannot be imported.
       */
      async importKey(format, key, isPublic = true) {
        await this._setup();
        try {
          let ret;
          if (format === "jwk") {
            if (key instanceof ArrayBuffer || key instanceof Uint8Array) {
              throw new Error("Invalid jwk key format");
            }
            ret = await this._importJWK(key, isPublic);
          } else {
            if (key instanceof ArrayBuffer) {
              ret = new Uint8Array(key);
            } else if (key instanceof Uint8Array) {
              ret = key;
            } else {
              throw new Error("Invalid key format");
            }
          }
          if (isPublic && ret.byteLength !== this.publicKeySize) {
            throw new Error("Invalid length of the key");
          }
          if (!isPublic && ret.byteLength !== this.privateKeySize) {
            throw new Error("Invalid length of the key");
          }
          return new XCryptoKey(ALG_NAME2, ret, isPublic ? "public" : "private", isPublic ? [] : KEM_USAGES);
        } catch (e) {
          throw new DeserializeError(e);
        }
      }
      /**
       * Encapsulates the shared secret and the `ct` (ciphertext) as `enc`.
       * @param params The parameters for encapsulation.
       * @returns {Promise<{ sharedSecret: ArrayBuffer; enc: ArrayBuffer }>} A promise that resolves with the `ss` (shared secret) as `sharedSecret` and the `ct` (ciphertext) as `enc`.
       * @throws {InvalidParamError} Thrown if the length of the `ekm` is not 64 bytes.
       * @throws {EncapError} Thrown if the shared secret cannot be encapsulated.
       */
      async encap(params) {
        let ekm = void 0;
        if (params.ekm !== void 0 && !isCryptoKeyPair(params.ekm)) {
          if (params.ekm.byteLength !== 64) {
            throw new InvalidParamError("ekm must be 64 bytes in length");
          }
          ekm = params.ekm;
        }
        let ekM = void 0;
        let ekX;
        if (ekm !== void 0) {
          const ek = new Uint8Array(ekm);
          ekM = ek.subarray(0, 32);
          ekX = ek.subarray(32, 64);
        } else {
          ekX = new Uint8Array(32);
          try {
            this._api.getRandomValues(ekX);
          } catch (e) {
            throw new NotSupportedError(e);
          }
        }
        const pk = new Uint8Array(await this.serializePublicKey(params.recipientPublicKey));
        if (pk.byteLength !== 1216) {
          throw new InvalidParamError("Invalid length of recipientPublicKey");
        }
        await this._setup();
        try {
          const pkM = pk.subarray(0, 1184);
          const pkX = pk.subarray(1184, 1216);
          const ctX = await this._x25519.derive(ekX, X25519_BASE);
          const ssX = await this._x25519.derive(ekX, pkX);
          const [ctM, ssM] = await this._m.encap(pkM, ekM);
          return {
            sharedSecret: combiner(ssM, ssX, ctX, pkX).buffer,
            enc: concat(ctM, ctX).buffer
          };
        } catch (e) {
          throw new EncapError(e);
        }
      }
      /**
       * Decapsulates the `ss` (shared secret) from the `enc` and the recipient's private key.
       * The `enc` is the same as the `ct` (ciphertext) resulting from `X-Wing::Encapsulate(),
       * which is executed under the `encap()`.
       * @param params The parameters for decapsulation.
       * @returns {Promise<ArrayBuffer>} A promise that resolves with the shared secret.
       * @throws {InvalidParamError} Thrown if the length of the `enc` is not 1120 bytes.
       * @throws {DecapError} Thrown if the shared secret cannot be decapsulated.
       */
      async decap(params) {
        const rSk = isCryptoKeyPair(params.recipientKey) ? params.recipientKey.privateKey : params.recipientKey;
        if (params.enc.byteLength !== 1120) {
          throw new InvalidParamError("Invalid length of enc");
        }
        const sk = new Uint8Array(await this.serializePrivateKey(rSk));
        if (sk.byteLength !== 32) {
          throw new InvalidParamError("Invalid length of recipientKey");
        }
        await this._setup();
        try {
          const [skM, skX, _pkM, pkX] = await this._expandDecapsulationKey(sk);
          const ct = new Uint8Array(params.enc);
          const ctM = ct.subarray(0, 1088);
          const ctX = ct.subarray(1088);
          const ssM = await this._m.decap(ctM, skM);
          const ssX = await this._x25519.derive(skX, ctX);
          return combiner(ssM, ssX, ctX, pkX).buffer;
        } catch (e) {
          throw new DecapError(e);
        }
      }
      /**
       * Sets up the MlKemBase instance by loading the necessary crypto library.
       * If the crypto library is already loaded, this method does nothing.
       * @returns {Promise<void>} A promise that resolves when the setup is complete.
       */
      async _setup() {
        if (this._api !== void 0) {
          return;
        }
        this._api = await loadCrypto();
      }
      /**
       * Generates a key pair from the secret key.
       * @param sk The secret key.
       * @returns {Promise<[Uint8Array, Uint8Array]>} A promise that resolves with the key pair derived from the secret key.
       */
      async _generateKeyPairDerand(sk) {
        const [_skM, _skX, pkM, pkX] = await this._expandDecapsulationKey(sk);
        return [sk, concat(pkM, pkX)];
      }
      /**
       * Expands the decapsulation key.
       * @param sk The secret key.
       * @returns {Promise<[Uint8Array, Uint8Array, Uint8Array, Uint8Array]>} A promise that resolves with the keys derived by expanding the secret key.
       */
      async _expandDecapsulationKey(sk) {
        const expanded = shake2562.create({ dkLen: 96 }).update(sk).digest();
        const [pkM, skM] = await this._m.deriveKeyPair(expanded.subarray(0, 64));
        const skX = expanded.subarray(64, 96);
        const pkX = await this._x25519.derive(skX, X25519_BASE);
        return [skM, skX, pkM, pkX];
      }
      _serializePublicKey(k) {
        return new Promise((resolve, reject) => {
          if (k.type !== "public") {
            reject(new Error("Not public key"));
          }
          if (k.algorithm.name !== this.name) {
            reject(new Error(`Invalid algorithm name: ${k.algorithm.name}`));
          }
          if (k.key.byteLength !== this.publicKeySize) {
            reject(new Error(`Invalid key length: ${k.key.byteLength}`));
          }
          resolve(k.key.buffer);
        });
      }
      _deserializePublicKey(k) {
        return new Promise((resolve, reject) => {
          if (k.byteLength !== this.publicKeySize) {
            reject(new Error(`Invalid key length: ${k.byteLength}`));
          }
          resolve(new XCryptoKey(this.name, new Uint8Array(k), "public"));
        });
      }
      _serializePrivateKey(k) {
        return new Promise((resolve, reject) => {
          if (k.type !== "private") {
            reject(new Error("Not private key"));
          }
          if (k.algorithm.name !== this.name) {
            reject(new Error(`Invalid algorithm name: ${k.algorithm.name}`));
          }
          if (k.key.byteLength !== this.privateKeySize) {
            reject(new Error(`Invalid key length: ${k.key.byteLength}`));
          }
          resolve(k.key.buffer);
        });
      }
      _deserializePrivateKey(k) {
        return new Promise((resolve, reject) => {
          if (k.byteLength !== this.privateKeySize) {
            reject(new Error(`Invalid key length: ${k.byteLength}`));
          }
          resolve(new XCryptoKey(this.name, new Uint8Array(k), "private", ["deriveBits"]));
        });
      }
      _importJWK(key, isPublic) {
        return new Promise((resolve, reject) => {
          if (typeof key.kty === "undefined" || key.kty !== "AKP") {
            reject(new Error(`Invalid kty: ${key.kty}`));
          }
          if (typeof key.alg === "undefined" || key.alg !== ALG_NAME2) {
            reject(new Error(`Invalid alg: ${key.alg}`));
          }
          if (!isPublic) {
            if (typeof key.priv === "undefined") {
              reject(new Error("Invalid key: `priv` not found"));
            }
            if (typeof key.key_ops !== "undefined" && (key.key_ops.length !== 1 || key.key_ops[0] !== "deriveBits")) {
              reject(new Error("Invalid key: `key_ops` should be ['deriveBits']"));
            }
            resolve(base64UrlToBytes(key.priv));
          }
          if (typeof key.priv !== "undefined") {
            reject(new Error("Invalid key: `priv` should not be set"));
          }
          if (typeof key.pub === "undefined") {
            reject(new Error("Invalid key: `pub` not found"));
          }
          if (typeof key.key_ops !== "undefined" && key.key_ops.length > 0) {
            reject(new Error("Invalid key: `key_ops` should not be set"));
          }
          resolve(base64UrlToBytes(key.pub));
        });
      }
    };
  }
});

// node_modules/@hpke/hybridkem-x-wing/esm/mod.js
var mod_exports2 = {};
__export(mod_exports2, {
  XWing: () => XWing
});
var init_mod5 = __esm({
  "node_modules/@hpke/hybridkem-x-wing/esm/mod.js"() {
    init_xWing();
  }
});

// node_modules/@noble/curves/node_modules/@noble/hashes/utils.js
function isBytes5(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber5(n, title = "") {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new Error(`${prefix}expected integer >= 0, got ${n}`);
  }
}
function abytes5(value, length, title = "") {
  const bytes = isBytes5(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function ahash2(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash must wrapped by utils.createHasher");
  anumber5(h.outputLen);
  anumber5(h.blockLen);
}
function aexists5(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput5(out, instance) {
  abytes5(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function u325(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean5(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView4(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr2(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function byteSwap2(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap322(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap2(arr[i]);
  }
  return arr;
}
function bytesToHex3(bytes) {
  abytes5(bytes);
  if (hasHexBuiltin2)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes2[bytes[i]];
  }
  return hex;
}
function asciiToBase162(ch) {
  if (ch >= asciis2._0 && ch <= asciis2._9)
    return ch - asciis2._0;
  if (ch >= asciis2.A && ch <= asciis2.F)
    return ch - (asciis2.A - 10);
  if (ch >= asciis2.a && ch <= asciis2.f)
    return ch - (asciis2.a - 10);
  return;
}
function hexToBytes3(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin2)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase162(hex.charCodeAt(hi));
    const n2 = asciiToBase162(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function concatBytes2(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes5(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function createHasher3(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes2(bytesLength = 32) {
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var isLE5, swap32IfBE3, hasHexBuiltin2, hexes2, asciis2, oidNist3;
var init_utils5 = __esm({
  "node_modules/@noble/curves/node_modules/@noble/hashes/utils.js"() {
    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    isLE5 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    swap32IfBE3 = isLE5 ? (u) => u : byteSwap322;
    hasHexBuiltin2 = /* @__PURE__ */ (() => (
      // @ts-ignore
      typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
    ))();
    hexes2 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    asciis2 = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
    oidNist3 = (suffix) => ({
      oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
    });
  }
});

// node_modules/@noble/curves/node_modules/@noble/hashes/_md.js
function Chi2(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj2(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD2, SHA256_IV2, SHA384_IV2, SHA512_IV2;
var init_md2 = __esm({
  "node_modules/@noble/curves/node_modules/@noble/hashes/_md.js"() {
    init_utils5();
    HashMD2 = class {
      blockLen;
      outputLen;
      padOffset;
      isLE;
      // For partial updates less than block size
      buffer;
      view;
      finished = false;
      length = 0;
      pos = 0;
      destroyed = false;
      constructor(blockLen, outputLen, padOffset, isLE7) {
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE7;
        this.buffer = new Uint8Array(blockLen);
        this.view = createView4(this.buffer);
      }
      update(data) {
        aexists5(this);
        abytes5(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = createView4(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        aexists5(this);
        aoutput5(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE: isLE7 } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        clean5(this.buffer.subarray(pos));
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE7);
        this.process(view, 0);
        const oview = createView4(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen must be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
          throw new Error("_sha2: outputLen bigger than state");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE7);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to ||= new this.constructor();
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
    };
    SHA256_IV2 = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    SHA384_IV2 = /* @__PURE__ */ Uint32Array.from([
      3418070365,
      3238371032,
      1654270250,
      914150663,
      2438529370,
      812702999,
      355462360,
      4144912697,
      1731405415,
      4290775857,
      2394180231,
      1750603025,
      3675008525,
      1694076839,
      1203062813,
      3204075428
    ]);
    SHA512_IV2 = /* @__PURE__ */ Uint32Array.from([
      1779033703,
      4089235720,
      3144134277,
      2227873595,
      1013904242,
      4271175723,
      2773480762,
      1595750129,
      1359893119,
      2917565137,
      2600822924,
      725511199,
      528734635,
      4215389547,
      1541459225,
      327033209
    ]);
  }
});

// node_modules/@noble/curves/node_modules/@noble/hashes/_u64.js
function fromBig3(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK643), l: Number(n >> _32n3 & U32_MASK643) };
  return { h: Number(n >> _32n3 & U32_MASK643) | 0, l: Number(n & U32_MASK643) | 0 };
}
function split3(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig3(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
function add3(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var U32_MASK643, _32n3, shrSH2, shrSL2, rotrSH2, rotrSL2, rotrBH2, rotrBL2, rotlSH3, rotlSL3, rotlBH3, rotlBL3, add3L2, add3H2, add4L2, add4H2, add5L2, add5H2;
var init_u643 = __esm({
  "node_modules/@noble/curves/node_modules/@noble/hashes/_u64.js"() {
    U32_MASK643 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    _32n3 = /* @__PURE__ */ BigInt(32);
    shrSH2 = (h, _l, s) => h >>> s;
    shrSL2 = (h, l, s) => h << 32 - s | l >>> s;
    rotrSH2 = (h, l, s) => h >>> s | l << 32 - s;
    rotrSL2 = (h, l, s) => h << 32 - s | l >>> s;
    rotrBH2 = (h, l, s) => h << 64 - s | l >>> s - 32;
    rotrBL2 = (h, l, s) => h >>> s - 32 | l << 64 - s;
    rotlSH3 = (h, l, s) => h << s | l >>> 32 - s;
    rotlSL3 = (h, l, s) => l << s | h >>> 32 - s;
    rotlBH3 = (h, l, s) => l << s - 32 | h >>> 64 - s;
    rotlBL3 = (h, l, s) => h << s - 32 | l >>> 64 - s;
    add3L2 = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
    add3H2 = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
    add4L2 = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
    add4H2 = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
    add5L2 = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
    add5H2 = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;
  }
});

// node_modules/@noble/curves/node_modules/@noble/hashes/sha2.js
var SHA256_K2, SHA256_W2, SHA2_32B2, _SHA2562, K512, SHA512_Kh, SHA512_Kl, SHA512_W_H, SHA512_W_L, SHA2_64B, _SHA512, _SHA384, sha2562, sha5122, sha3842;
var init_sha22 = __esm({
  "node_modules/@noble/curves/node_modules/@noble/hashes/sha2.js"() {
    init_md2();
    init_u643();
    init_utils5();
    SHA256_K2 = /* @__PURE__ */ Uint32Array.from([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    SHA256_W2 = /* @__PURE__ */ new Uint32Array(64);
    SHA2_32B2 = class extends HashMD2 {
      constructor(outputLen) {
        super(64, outputLen, 8, false);
      }
      get() {
        const { A, B, C, D: D2, E, F: F2, G, H } = this;
        return [A, B, C, D2, E, F2, G, H];
      }
      // prettier-ignore
      set(A, B, C, D2, E, F2, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D2 | 0;
        this.E = E | 0;
        this.F = F2 | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W2[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W2[i - 15];
          const W2 = SHA256_W2[i - 2];
          const s0 = rotr2(W15, 7) ^ rotr2(W15, 18) ^ W15 >>> 3;
          const s1 = rotr2(W2, 17) ^ rotr2(W2, 19) ^ W2 >>> 10;
          SHA256_W2[i] = s1 + SHA256_W2[i - 7] + s0 + SHA256_W2[i - 16] | 0;
        }
        let { A, B, C, D: D2, E, F: F2, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = rotr2(E, 6) ^ rotr2(E, 11) ^ rotr2(E, 25);
          const T1 = H + sigma1 + Chi2(E, F2, G) + SHA256_K2[i] + SHA256_W2[i] | 0;
          const sigma0 = rotr2(A, 2) ^ rotr2(A, 13) ^ rotr2(A, 22);
          const T2 = sigma0 + Maj2(A, B, C) | 0;
          H = G;
          G = F2;
          F2 = E;
          E = D2 + T1 | 0;
          D2 = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D2 = D2 + this.D | 0;
        E = E + this.E | 0;
        F2 = F2 + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D2, E, F2, G, H);
      }
      roundClean() {
        clean5(SHA256_W2);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        clean5(this.buffer);
      }
    };
    _SHA2562 = class extends SHA2_32B2 {
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      A = SHA256_IV2[0] | 0;
      B = SHA256_IV2[1] | 0;
      C = SHA256_IV2[2] | 0;
      D = SHA256_IV2[3] | 0;
      E = SHA256_IV2[4] | 0;
      F = SHA256_IV2[5] | 0;
      G = SHA256_IV2[6] | 0;
      H = SHA256_IV2[7] | 0;
      constructor() {
        super(32);
      }
    };
    K512 = /* @__PURE__ */ (() => split3([
      "0x428a2f98d728ae22",
      "0x7137449123ef65cd",
      "0xb5c0fbcfec4d3b2f",
      "0xe9b5dba58189dbbc",
      "0x3956c25bf348b538",
      "0x59f111f1b605d019",
      "0x923f82a4af194f9b",
      "0xab1c5ed5da6d8118",
      "0xd807aa98a3030242",
      "0x12835b0145706fbe",
      "0x243185be4ee4b28c",
      "0x550c7dc3d5ffb4e2",
      "0x72be5d74f27b896f",
      "0x80deb1fe3b1696b1",
      "0x9bdc06a725c71235",
      "0xc19bf174cf692694",
      "0xe49b69c19ef14ad2",
      "0xefbe4786384f25e3",
      "0x0fc19dc68b8cd5b5",
      "0x240ca1cc77ac9c65",
      "0x2de92c6f592b0275",
      "0x4a7484aa6ea6e483",
      "0x5cb0a9dcbd41fbd4",
      "0x76f988da831153b5",
      "0x983e5152ee66dfab",
      "0xa831c66d2db43210",
      "0xb00327c898fb213f",
      "0xbf597fc7beef0ee4",
      "0xc6e00bf33da88fc2",
      "0xd5a79147930aa725",
      "0x06ca6351e003826f",
      "0x142929670a0e6e70",
      "0x27b70a8546d22ffc",
      "0x2e1b21385c26c926",
      "0x4d2c6dfc5ac42aed",
      "0x53380d139d95b3df",
      "0x650a73548baf63de",
      "0x766a0abb3c77b2a8",
      "0x81c2c92e47edaee6",
      "0x92722c851482353b",
      "0xa2bfe8a14cf10364",
      "0xa81a664bbc423001",
      "0xc24b8b70d0f89791",
      "0xc76c51a30654be30",
      "0xd192e819d6ef5218",
      "0xd69906245565a910",
      "0xf40e35855771202a",
      "0x106aa07032bbd1b8",
      "0x19a4c116b8d2d0c8",
      "0x1e376c085141ab53",
      "0x2748774cdf8eeb99",
      "0x34b0bcb5e19b48a8",
      "0x391c0cb3c5c95a63",
      "0x4ed8aa4ae3418acb",
      "0x5b9cca4f7763e373",
      "0x682e6ff3d6b2b8a3",
      "0x748f82ee5defb2fc",
      "0x78a5636f43172f60",
      "0x84c87814a1f0ab72",
      "0x8cc702081a6439ec",
      "0x90befffa23631e28",
      "0xa4506cebde82bde9",
      "0xbef9a3f7b2c67915",
      "0xc67178f2e372532b",
      "0xca273eceea26619c",
      "0xd186b8c721c0c207",
      "0xeada7dd6cde0eb1e",
      "0xf57d4f7fee6ed178",
      "0x06f067aa72176fba",
      "0x0a637dc5a2c898a6",
      "0x113f9804bef90dae",
      "0x1b710b35131c471b",
      "0x28db77f523047d84",
      "0x32caab7b40c72493",
      "0x3c9ebe0a15c9bebc",
      "0x431d67c49c100d4c",
      "0x4cc5d4becb3e42b6",
      "0x597f299cfc657e2a",
      "0x5fcb6fab3ad6faec",
      "0x6c44198c4a475817"
    ].map((n) => BigInt(n))))();
    SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
    SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
    SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
    SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
    SHA2_64B = class extends HashMD2 {
      constructor(outputLen) {
        super(128, outputLen, 16, false);
      }
      // prettier-ignore
      get() {
        const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
      }
      // prettier-ignore
      set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
        this.Ah = Ah | 0;
        this.Al = Al | 0;
        this.Bh = Bh | 0;
        this.Bl = Bl | 0;
        this.Ch = Ch | 0;
        this.Cl = Cl | 0;
        this.Dh = Dh | 0;
        this.Dl = Dl | 0;
        this.Eh = Eh | 0;
        this.El = El | 0;
        this.Fh = Fh | 0;
        this.Fl = Fl | 0;
        this.Gh = Gh | 0;
        this.Gl = Gl | 0;
        this.Hh = Hh | 0;
        this.Hl = Hl | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4) {
          SHA512_W_H[i] = view.getUint32(offset);
          SHA512_W_L[i] = view.getUint32(offset += 4);
        }
        for (let i = 16; i < 80; i++) {
          const W15h = SHA512_W_H[i - 15] | 0;
          const W15l = SHA512_W_L[i - 15] | 0;
          const s0h = rotrSH2(W15h, W15l, 1) ^ rotrSH2(W15h, W15l, 8) ^ shrSH2(W15h, W15l, 7);
          const s0l = rotrSL2(W15h, W15l, 1) ^ rotrSL2(W15h, W15l, 8) ^ shrSL2(W15h, W15l, 7);
          const W2h = SHA512_W_H[i - 2] | 0;
          const W2l = SHA512_W_L[i - 2] | 0;
          const s1h = rotrSH2(W2h, W2l, 19) ^ rotrBH2(W2h, W2l, 61) ^ shrSH2(W2h, W2l, 6);
          const s1l = rotrSL2(W2h, W2l, 19) ^ rotrBL2(W2h, W2l, 61) ^ shrSL2(W2h, W2l, 6);
          const SUMl = add4L2(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
          const SUMh = add4H2(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
          SHA512_W_H[i] = SUMh | 0;
          SHA512_W_L[i] = SUMl | 0;
        }
        let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        for (let i = 0; i < 80; i++) {
          const sigma1h = rotrSH2(Eh, El, 14) ^ rotrSH2(Eh, El, 18) ^ rotrBH2(Eh, El, 41);
          const sigma1l = rotrSL2(Eh, El, 14) ^ rotrSL2(Eh, El, 18) ^ rotrBL2(Eh, El, 41);
          const CHIh = Eh & Fh ^ ~Eh & Gh;
          const CHIl = El & Fl ^ ~El & Gl;
          const T1ll = add5L2(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
          const T1h = add5H2(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
          const T1l = T1ll | 0;
          const sigma0h = rotrSH2(Ah, Al, 28) ^ rotrBH2(Ah, Al, 34) ^ rotrBH2(Ah, Al, 39);
          const sigma0l = rotrSL2(Ah, Al, 28) ^ rotrBL2(Ah, Al, 34) ^ rotrBL2(Ah, Al, 39);
          const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
          const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
          Hh = Gh | 0;
          Hl = Gl | 0;
          Gh = Fh | 0;
          Gl = Fl | 0;
          Fh = Eh | 0;
          Fl = El | 0;
          ({ h: Eh, l: El } = add3(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
          Dh = Ch | 0;
          Dl = Cl | 0;
          Ch = Bh | 0;
          Cl = Bl | 0;
          Bh = Ah | 0;
          Bl = Al | 0;
          const All = add3L2(T1l, sigma0l, MAJl);
          Ah = add3H2(All, T1h, sigma0h, MAJh);
          Al = All | 0;
        }
        ({ h: Ah, l: Al } = add3(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
        ({ h: Bh, l: Bl } = add3(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
        ({ h: Ch, l: Cl } = add3(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
        ({ h: Dh, l: Dl } = add3(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
        ({ h: Eh, l: El } = add3(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
        ({ h: Fh, l: Fl } = add3(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
        ({ h: Gh, l: Gl } = add3(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
        ({ h: Hh, l: Hl } = add3(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
        this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
      }
      roundClean() {
        clean5(SHA512_W_H, SHA512_W_L);
      }
      destroy() {
        clean5(this.buffer);
        this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      }
    };
    _SHA512 = class extends SHA2_64B {
      Ah = SHA512_IV2[0] | 0;
      Al = SHA512_IV2[1] | 0;
      Bh = SHA512_IV2[2] | 0;
      Bl = SHA512_IV2[3] | 0;
      Ch = SHA512_IV2[4] | 0;
      Cl = SHA512_IV2[5] | 0;
      Dh = SHA512_IV2[6] | 0;
      Dl = SHA512_IV2[7] | 0;
      Eh = SHA512_IV2[8] | 0;
      El = SHA512_IV2[9] | 0;
      Fh = SHA512_IV2[10] | 0;
      Fl = SHA512_IV2[11] | 0;
      Gh = SHA512_IV2[12] | 0;
      Gl = SHA512_IV2[13] | 0;
      Hh = SHA512_IV2[14] | 0;
      Hl = SHA512_IV2[15] | 0;
      constructor() {
        super(64);
      }
    };
    _SHA384 = class extends SHA2_64B {
      Ah = SHA384_IV2[0] | 0;
      Al = SHA384_IV2[1] | 0;
      Bh = SHA384_IV2[2] | 0;
      Bl = SHA384_IV2[3] | 0;
      Ch = SHA384_IV2[4] | 0;
      Cl = SHA384_IV2[5] | 0;
      Dh = SHA384_IV2[6] | 0;
      Dl = SHA384_IV2[7] | 0;
      Eh = SHA384_IV2[8] | 0;
      El = SHA384_IV2[9] | 0;
      Fh = SHA384_IV2[10] | 0;
      Fl = SHA384_IV2[11] | 0;
      Gh = SHA384_IV2[12] | 0;
      Gl = SHA384_IV2[13] | 0;
      Hh = SHA384_IV2[14] | 0;
      Hl = SHA384_IV2[15] | 0;
      constructor() {
        super(48);
      }
    };
    sha2562 = /* @__PURE__ */ createHasher3(
      () => new _SHA2562(),
      /* @__PURE__ */ oidNist3(1)
    );
    sha5122 = /* @__PURE__ */ createHasher3(
      () => new _SHA512(),
      /* @__PURE__ */ oidNist3(3)
    );
    sha3842 = /* @__PURE__ */ createHasher3(
      () => new _SHA384(),
      /* @__PURE__ */ oidNist3(2)
    );
  }
});

// node_modules/@noble/curves/utils.js
function abool3(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}" `;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig2(n))
      throw new Error("positive bigint expected, got " + n);
  } else
    anumber5(n);
  return n;
}
function asafenumber(value, title = "") {
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new Error(prefix + "expected safe integer, got type=" + typeof value);
  }
}
function numberToHexUnpadded(num) {
  const hex = abignumber(num).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber3(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n3 : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber3(bytesToHex3(bytes));
}
function bytesToNumberLE2(bytes) {
  return hexToNumber3(bytesToHex3(copyBytes4(abytes5(bytes)).reverse()));
}
function numberToBytesBE3(n, len) {
  anumber5(len);
  n = abignumber(n);
  const res = hexToBytes3(n.toString(16).padStart(len * 2, "0"));
  if (res.length !== len)
    throw new Error("number too large");
  return res;
}
function numberToBytesLE2(n, len) {
  return numberToBytesBE3(n, len).reverse();
}
function equalBytes3(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes4(bytes) {
  return Uint8Array.from(bytes);
}
function asciiToBytes(ascii) {
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new Error(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
function inRange2(n, min, max) {
  return isPosBig2(n) && isPosBig2(min) && isPosBig2(max) && min <= n && n < max;
}
function aInRange2(title, n, min, max) {
  if (!inRange2(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0; n > _0n3; n >>= _1n4, len += 1)
    ;
  return len;
}
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  anumber5(hashLen, "hashLen");
  anumber5(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0);
  const byte1 = Uint8Array.of(1);
  const _maxDrbgIters = 1e3;
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...msgs) => hmacFn(k, concatBytes2(v, ...msgs));
  const reseed = (seed = NULL) => {
    k = h(byte0, seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(byte1, seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= _maxDrbgIters)
      throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes2(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function validateObject2(object, fields = {}, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}
function memoized(fn) {
  const map = /* @__PURE__ */ new WeakMap();
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== void 0)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}
var _0n3, _1n4, isPosBig2, bitMask, notImplemented;
var init_utils6 = __esm({
  "node_modules/@noble/curves/utils.js"() {
    init_utils5();
    init_utils5();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _0n3 = /* @__PURE__ */ BigInt(0);
    _1n4 = /* @__PURE__ */ BigInt(1);
    isPosBig2 = (n) => typeof n === "bigint" && _0n3 <= n;
    bitMask = (n) => (_1n4 << BigInt(n)) - _1n4;
    notImplemented = () => {
      throw new Error("not implemented");
    };
  }
});

// node_modules/@noble/curves/abstract/modular.js
function mod3(a, b) {
  const result = a % b;
  return result >= _0n4 ? result : b + result;
}
function pow22(x, power, modulo) {
  let res = x;
  while (power-- > _0n4) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n4)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n4)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod3(number, modulo);
  let b = modulo;
  let x = _0n4, y = _1n5, u = _1n5, v = _0n4;
  while (a !== _0n4) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n5)
    throw new Error("invert: does not exist");
  return mod3(x, modulo);
}
function assertIsSquare(Fp3, root2, n) {
  if (!Fp3.eql(Fp3.sqr(root2), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp3, n) {
  const p1div4 = (Fp3.ORDER + _1n5) / _4n;
  const root2 = Fp3.pow(n, p1div4);
  assertIsSquare(Fp3, root2, n);
  return root2;
}
function sqrt5mod8(Fp3, n) {
  const p5div8 = (Fp3.ORDER - _5n2) / _8n;
  const n2 = Fp3.mul(n, _2n4);
  const v = Fp3.pow(n2, p5div8);
  const nv = Fp3.mul(n, v);
  const i = Fp3.mul(Fp3.mul(nv, _2n4), v);
  const root2 = Fp3.mul(nv, Fp3.sub(i, Fp3.ONE));
  assertIsSquare(Fp3, root2, n);
  return root2;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n3) / _16n;
  return (Fp3, n) => {
    let tv1 = Fp3.pow(n, c4);
    let tv2 = Fp3.mul(tv1, c1);
    const tv3 = Fp3.mul(tv1, c2);
    const tv4 = Fp3.mul(tv1, c3);
    const e1 = Fp3.eql(Fp3.sqr(tv2), n);
    const e2 = Fp3.eql(Fp3.sqr(tv3), n);
    tv1 = Fp3.cmov(tv1, tv2, e1);
    tv2 = Fp3.cmov(tv4, tv3, e2);
    const e3 = Fp3.eql(Fp3.sqr(tv2), n);
    const root2 = Fp3.cmov(tv1, tv2, e3);
    assertIsSquare(Fp3, root2, n);
    return root2;
  };
}
function tonelliShanks(P) {
  if (P < _3n2)
    throw new Error("sqrt is not defined for small field");
  let Q3 = P - _1n5;
  let S = 0;
  while (Q3 % _2n4 === _0n4) {
    Q3 /= _2n4;
    S++;
  }
  let Z = _2n4;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q3);
  const Q1div2 = (Q3 + _1n5) / _2n4;
  return function tonelliSlow(Fp3, n) {
    if (Fp3.is0(n))
      return n;
    if (FpLegendre(Fp3, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp3.mul(Fp3.ONE, cc);
    let t = Fp3.pow(n, Q3);
    let R = Fp3.pow(n, Q1div2);
    while (!Fp3.eql(t, Fp3.ONE)) {
      if (Fp3.is0(t))
        return Fp3.ZERO;
      let i = 1;
      let t_tmp = Fp3.sqr(t);
      while (!Fp3.eql(t_tmp, Fp3.ONE)) {
        i++;
        t_tmp = Fp3.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n5 << BigInt(M - i - 1);
      const b = Fp3.pow(c, exponent);
      M = i;
      c = Fp3.sqr(b);
      t = Fp3.mul(t, c);
      R = Fp3.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n2)
    return sqrt3mod4;
  if (P % _8n === _5n2)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  validateObject2(field, opts);
  return field;
}
function FpPow(Fp3, num, power) {
  if (power < _0n4)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n4)
    return Fp3.ONE;
  if (power === _1n5)
    return num;
  let p = Fp3.ONE;
  let d = num;
  while (power > _0n4) {
    if (power & _1n5)
      p = Fp3.mul(p, d);
    d = Fp3.sqr(d);
    power >>= _1n5;
  }
  return p;
}
function FpInvertBatch(Fp3, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp3.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (Fp3.is0(num))
      return acc;
    inverted[i] = acc;
    return Fp3.mul(acc, num);
  }, Fp3.ONE);
  const invertedAcc = Fp3.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (Fp3.is0(num))
      return acc;
    inverted[i] = Fp3.mul(acc, inverted[i]);
    return Fp3.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp3, n) {
  const p1mod2 = (Fp3.ORDER - _1n5) / _2n4;
  const powered = Fp3.pow(n, p1mod2);
  const yes = Fp3.eql(powered, Fp3.ONE);
  const zero = Fp3.eql(powered, Fp3.ZERO);
  const no = Fp3.eql(powered, Fp3.neg(Fp3.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber5(nBitLength);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, opts = {}) {
  return new _Field(ORDER, opts);
}
function FpSqrtEven(Fp3, elm) {
  if (!Fp3.isOdd)
    throw new Error("Field doesn't have isOdd");
  const root2 = Fp3.sqrt(elm);
  return Fp3.isOdd(root2) ? Fp3.neg(root2) : root2;
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE7 = false) {
  abytes5(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE7 ? bytesToNumberLE2(key) : bytesToNumberBE(key);
  const reduced = mod3(num, fieldOrder - _1n5) + _1n5;
  return isLE7 ? numberToBytesLE2(reduced, fieldLen) : numberToBytesBE3(reduced, fieldLen);
}
var _0n4, _1n5, _2n4, _3n2, _4n, _5n2, _7n3, _8n, _9n, _16n, isNegativeLE, FIELD_FIELDS, _Field;
var init_modular2 = __esm({
  "node_modules/@noble/curves/abstract/modular.js"() {
    init_utils6();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _0n4 = /* @__PURE__ */ BigInt(0);
    _1n5 = /* @__PURE__ */ BigInt(1);
    _2n4 = /* @__PURE__ */ BigInt(2);
    _3n2 = /* @__PURE__ */ BigInt(3);
    _4n = /* @__PURE__ */ BigInt(4);
    _5n2 = /* @__PURE__ */ BigInt(5);
    _7n3 = /* @__PURE__ */ BigInt(7);
    _8n = /* @__PURE__ */ BigInt(8);
    _9n = /* @__PURE__ */ BigInt(9);
    _16n = /* @__PURE__ */ BigInt(16);
    isNegativeLE = (num, modulo) => (mod3(num, modulo) & _1n5) === _1n5;
    FIELD_FIELDS = [
      "create",
      "isValid",
      "is0",
      "neg",
      "inv",
      "sqrt",
      "sqr",
      "eql",
      "add",
      "sub",
      "mul",
      "pow",
      "div",
      "addN",
      "subN",
      "mulN",
      "sqrN"
    ];
    _Field = class {
      ORDER;
      BITS;
      BYTES;
      isLE;
      ZERO = _0n4;
      ONE = _1n5;
      _lengths;
      _sqrt;
      // cached sqrt
      _mod;
      constructor(ORDER, opts = {}) {
        if (ORDER <= _0n4)
          throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
        let _nbitLength = void 0;
        this.isLE = false;
        if (opts != null && typeof opts === "object") {
          if (typeof opts.BITS === "number")
            _nbitLength = opts.BITS;
          if (typeof opts.sqrt === "function")
            this.sqrt = opts.sqrt;
          if (typeof opts.isLE === "boolean")
            this.isLE = opts.isLE;
          if (opts.allowedLengths)
            this._lengths = opts.allowedLengths?.slice();
          if (typeof opts.modFromBytes === "boolean")
            this._mod = opts.modFromBytes;
        }
        const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
        if (nByteLength > 2048)
          throw new Error("invalid field: expected ORDER of <= 2048 bytes");
        this.ORDER = ORDER;
        this.BITS = nBitLength;
        this.BYTES = nByteLength;
        this._sqrt = void 0;
        Object.preventExtensions(this);
      }
      create(num) {
        return mod3(num, this.ORDER);
      }
      isValid(num) {
        if (typeof num !== "bigint")
          throw new Error("invalid field element: expected bigint, got " + typeof num);
        return _0n4 <= num && num < this.ORDER;
      }
      is0(num) {
        return num === _0n4;
      }
      // is valid and invertible
      isValidNot0(num) {
        return !this.is0(num) && this.isValid(num);
      }
      isOdd(num) {
        return (num & _1n5) === _1n5;
      }
      neg(num) {
        return mod3(-num, this.ORDER);
      }
      eql(lhs, rhs) {
        return lhs === rhs;
      }
      sqr(num) {
        return mod3(num * num, this.ORDER);
      }
      add(lhs, rhs) {
        return mod3(lhs + rhs, this.ORDER);
      }
      sub(lhs, rhs) {
        return mod3(lhs - rhs, this.ORDER);
      }
      mul(lhs, rhs) {
        return mod3(lhs * rhs, this.ORDER);
      }
      pow(num, power) {
        return FpPow(this, num, power);
      }
      div(lhs, rhs) {
        return mod3(lhs * invert(rhs, this.ORDER), this.ORDER);
      }
      // Same as above, but doesn't normalize
      sqrN(num) {
        return num * num;
      }
      addN(lhs, rhs) {
        return lhs + rhs;
      }
      subN(lhs, rhs) {
        return lhs - rhs;
      }
      mulN(lhs, rhs) {
        return lhs * rhs;
      }
      inv(num) {
        return invert(num, this.ORDER);
      }
      sqrt(num) {
        if (!this._sqrt)
          this._sqrt = FpSqrt(this.ORDER);
        return this._sqrt(this, num);
      }
      toBytes(num) {
        return this.isLE ? numberToBytesLE2(num, this.BYTES) : numberToBytesBE3(num, this.BYTES);
      }
      fromBytes(bytes, skipValidation = false) {
        abytes5(bytes);
        const { _lengths: allowedLengths, BYTES, isLE: isLE7, ORDER, _mod: modFromBytes } = this;
        if (allowedLengths) {
          if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
            throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
          }
          const padded = new Uint8Array(BYTES);
          padded.set(bytes, isLE7 ? 0 : padded.length - bytes.length);
          bytes = padded;
        }
        if (bytes.length !== BYTES)
          throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
        let scalar = isLE7 ? bytesToNumberLE2(bytes) : bytesToNumberBE(bytes);
        if (modFromBytes)
          scalar = mod3(scalar, ORDER);
        if (!skipValidation) {
          if (!this.isValid(scalar))
            throw new Error("invalid field element: outside of range 0..ORDER");
        }
        return scalar;
      }
      // TODO: we don't need it here, move out to separate fn
      invertBatch(lst) {
        return FpInvertBatch(this, lst);
      }
      // We can't move this out because Fp6, Fp12 implement it
      // and it's unclear what to return in there.
      cmov(a, b, condition) {
        return condition ? b : a;
      }
    };
  }
});

// node_modules/@noble/curves/abstract/curve.js
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n6;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n5)
    throw new Error("invalid wNAF");
}
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n5 || k2 > _0n5) {
    if (k1 & _1n6)
      p1 = p1.add(acc);
    if (k2 & _1n6)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n6;
    k2 >>= _1n6;
  }
  return { p1, p2 };
}
function pippenger(c, points, scalars) {
  const fieldN = c.Fn;
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits; i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0; j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0; j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
function createField(order, field, isLE7) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE7 });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n5))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp3 = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn3 = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp3.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp: Fp3, Fn: Fn3 };
}
function createKeygen2(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}
var _0n5, _1n6, pointPrecomputes, pointWindowSizes, wNAF;
var init_curve2 = __esm({
  "node_modules/@noble/curves/abstract/curve.js"() {
    init_utils6();
    init_modular2();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _0n5 = /* @__PURE__ */ BigInt(0);
    _1n6 = /* @__PURE__ */ BigInt(1);
    pointPrecomputes = /* @__PURE__ */ new WeakMap();
    pointWindowSizes = /* @__PURE__ */ new WeakMap();
    wNAF = class {
      BASE;
      ZERO;
      Fn;
      bits;
      // Parametrized with a given Point class (not individual point)
      constructor(Point, bits) {
        this.BASE = Point.BASE;
        this.ZERO = Point.ZERO;
        this.Fn = Point.Fn;
        this.bits = bits;
      }
      // non-const time multiplication ladder
      _unsafeLadder(elm, n, p = this.ZERO) {
        let d = elm;
        while (n > _0n5) {
          if (n & _1n6)
            p = p.add(d);
          d = d.double();
          n >>= _1n6;
        }
        return p;
      }
      /**
       * Creates a wNAF precomputation window. Used for caching.
       * Default window size is set by `utils.precompute()` and is equal to 8.
       * Number of precomputed points depends on the curve size:
       * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
       * - 𝑊 is the window size
       * - 𝑛 is the bitlength of the curve order.
       * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
       * @param point Point instance
       * @param W window size
       * @returns precomputed point tables flattened to a single array
       */
      precomputeWindow(point, W) {
        const { windows, windowSize } = calcWOpts(W, this.bits);
        const points = [];
        let p = point;
        let base = p;
        for (let window = 0; window < windows; window++) {
          base = p;
          points.push(base);
          for (let i = 1; i < windowSize; i++) {
            base = base.add(p);
            points.push(base);
          }
          p = base.double();
        }
        return points;
      }
      /**
       * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
       * More compact implementation:
       * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
       * @returns real and fake (for const-time) points
       */
      wNAF(W, precomputes, n) {
        if (!this.Fn.isValid(n))
          throw new Error("invalid scalar");
        let p = this.ZERO;
        let f = this.BASE;
        const wo = calcWOpts(W, this.bits);
        for (let window = 0; window < wo.windows; window++) {
          const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
          n = nextN;
          if (isZero) {
            f = f.add(negateCt(isNegF, precomputes[offsetF]));
          } else {
            p = p.add(negateCt(isNeg, precomputes[offset]));
          }
        }
        assert0(n);
        return { p, f };
      }
      /**
       * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
       * @param acc accumulator point to add result of multiplication
       * @returns point
       */
      wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
        const wo = calcWOpts(W, this.bits);
        for (let window = 0; window < wo.windows; window++) {
          if (n === _0n5)
            break;
          const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
          n = nextN;
          if (isZero) {
            continue;
          } else {
            const item = precomputes[offset];
            acc = acc.add(isNeg ? item.negate() : item);
          }
        }
        assert0(n);
        return acc;
      }
      getPrecomputes(W, point, transform) {
        let comp = pointPrecomputes.get(point);
        if (!comp) {
          comp = this.precomputeWindow(point, W);
          if (W !== 1) {
            if (typeof transform === "function")
              comp = transform(comp);
            pointPrecomputes.set(point, comp);
          }
        }
        return comp;
      }
      cached(point, scalar, transform) {
        const W = getW(point);
        return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
      }
      unsafe(point, scalar, transform, prev) {
        const W = getW(point);
        if (W === 1)
          return this._unsafeLadder(point, scalar, prev);
        return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
      }
      // We calculate precomputes for elliptic curve point multiplication
      // using windowed method. This specifies window size and
      // stores precomputed values. Usually only base point would be precomputed.
      createCache(P, W) {
        validateW(W, this.bits);
        pointWindowSizes.set(P, W);
        pointPrecomputes.delete(P);
      }
      hasCache(elm) {
        return getW(elm) !== 1;
      }
    };
  }
});

// node_modules/@noble/curves/abstract/edwards.js
function isEdValidXY(Fp3, CURVE, x, y) {
  const x2 = Fp3.sqr(x);
  const y2 = Fp3.sqr(y);
  const left2 = Fp3.add(Fp3.mul(CURVE.a, x2), y2);
  const right2 = Fp3.add(Fp3.ONE, Fp3.mul(CURVE.d, Fp3.mul(x2, y2)));
  return Fp3.eql(left2, right2);
}
function edwards(params, extraOpts = {}) {
  const validated = createCurveFields("edwards", params, extraOpts, extraOpts.FpFnLE);
  const { Fp: Fp3, Fn: Fn3 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  validateObject2(extraOpts, {}, { uvRatio: "function" });
  const MASK = _2n5 << BigInt(Fn3.BYTES * 8) - _1n7;
  const modP = (n) => Fp3.create(n);
  const uvRatio3 = extraOpts.uvRatio || ((u, v) => {
    try {
      return { isValid: true, value: Fp3.sqrt(Fp3.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n6 };
    }
  });
  if (!isEdValidXY(Fp3, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n7 : _0n6;
    aInRange2("coordinate " + title, n, min, MASK);
    return n;
  }
  function aedpoint(other) {
    if (!(other instanceof Point))
      throw new Error("EdwardsPoint expected");
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? _8n2 : Fp3.inv(Z);
    const x = modP(X * iz);
    const y = modP(Y * iz);
    const zz = Fp3.mul(Z, iz);
    if (is0)
      return { x: _0n6, y: _1n7 };
    if (zz !== _1n7)
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    const { a, d } = CURVE;
    if (p.is0())
      throw new Error("bad point: ZERO");
    const { X, Y, Z, T } = p;
    const X2 = modP(X * X);
    const Y2 = modP(Y * Y);
    const Z2 = modP(Z * Z);
    const Z4 = modP(Z2 * Z2);
    const aX2 = modP(X2 * a);
    const left2 = modP(Z2 * modP(aX2 + Y2));
    const right2 = modP(Z4 + modP(d * modP(X2 * Y2)));
    if (left2 !== right2)
      throw new Error("bad point: equation left != right (1)");
    const XY = modP(X * Y);
    const ZT = modP(Z * T);
    if (XY !== ZT)
      throw new Error("bad point: equation left != right (2)");
    return true;
  });
  class Point {
    // base / generator point
    static BASE = new Point(CURVE.Gx, CURVE.Gy, _1n7, modP(CURVE.Gx * CURVE.Gy));
    // zero / infinity / identity point
    static ZERO = new Point(_0n6, _1n7, _1n7, _0n6);
    // 0, 1, 1, 0
    // math field
    static Fp = Fp3;
    // scalar field
    static Fn = Fn3;
    X;
    Y;
    Z;
    T;
    constructor(X, Y, Z, T) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y);
      this.Z = acoord("z", Z, true);
      this.T = acoord("t", T);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    static fromAffine(p) {
      if (p instanceof Point)
        throw new Error("extended point not allowed");
      const { x, y } = p || {};
      acoord("x", x);
      acoord("y", y);
      return new Point(x, y, _1n7, modP(x * y));
    }
    // Uses algo from RFC8032 5.1.3.
    static fromBytes(bytes, zip215 = false) {
      const len = Fp3.BYTES;
      const { a, d } = CURVE;
      bytes = copyBytes4(abytes5(bytes, len, "point"));
      abool3(zip215, "zip215");
      const normed = copyBytes4(bytes);
      const lastByte = bytes[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE2(normed);
      const max = zip215 ? MASK : Fp3.ORDER;
      aInRange2("point.y", y, _0n6, max);
      const y2 = modP(y * y);
      const u = modP(y2 - _1n7);
      const v = modP(d * y2 - a);
      let { isValid, value: x } = uvRatio3(u, v);
      if (!isValid)
        throw new Error("bad point: invalid y coordinate");
      const isXOdd = (x & _1n7) === _1n7;
      const isLastByteOdd = (lastByte & 128) !== 0;
      if (!zip215 && x === _0n6 && isLastByteOdd)
        throw new Error("bad point: x=0 and x_0=1");
      if (isLastByteOdd !== isXOdd)
        x = modP(-x);
      return Point.fromAffine({ x, y });
    }
    static fromHex(hex, zip215 = false) {
      return Point.fromBytes(hexToBytes3(hex), zip215);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_2n5);
      return this;
    }
    // Useful in fromAffine() - not for fromBytes(), which always created valid points.
    assertValidity() {
      assertValidMemo(this);
    }
    // Compare one point to another.
    equals(other) {
      aedpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const X1Z2 = modP(X1 * Z2);
      const X2Z1 = modP(X2 * Z1);
      const Y1Z2 = modP(Y1 * Z2);
      const Y2Z1 = modP(Y2 * Z1);
      return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    negate() {
      return new Point(modP(-this.X), this.Y, this.Z, modP(-this.T));
    }
    // Fast algo for doubling Extended Point.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
    // Cost: 4M + 4S + 1*a + 6add + 1*2.
    double() {
      const { a } = CURVE;
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const A = modP(X1 * X1);
      const B = modP(Y1 * Y1);
      const C = modP(_2n5 * modP(Z1 * Z1));
      const D2 = modP(a * A);
      const x1y1 = X1 + Y1;
      const E = modP(modP(x1y1 * x1y1) - A - B);
      const G = D2 + B;
      const F2 = G - C;
      const H = D2 - B;
      const X3 = modP(E * F2);
      const Y3 = modP(G * H);
      const T3 = modP(E * H);
      const Z3 = modP(F2 * G);
      return new Point(X3, Y3, Z3, T3);
    }
    // Fast algo for adding 2 Extended Points.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
    // Cost: 9M + 1*a + 1*d + 7add.
    add(other) {
      aedpoint(other);
      const { a, d } = CURVE;
      const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
      const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
      const A = modP(X1 * X2);
      const B = modP(Y1 * Y2);
      const C = modP(T1 * d * T2);
      const D2 = modP(Z1 * Z2);
      const E = modP((X1 + Y1) * (X2 + Y2) - A - B);
      const F2 = D2 - C;
      const G = D2 + C;
      const H = modP(B - a * A);
      const X3 = modP(E * F2);
      const Y3 = modP(G * H);
      const T3 = modP(E * H);
      const Z3 = modP(F2 * G);
      return new Point(X3, Y3, Z3, T3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    // Constant-time multiplication.
    multiply(scalar) {
      if (!Fn3.isValidNot0(scalar))
        throw new Error("invalid scalar: expected 1 <= sc < curve.n");
      const { p, f } = wnaf.cached(this, scalar, (p2) => normalizeZ(Point, p2));
      return normalizeZ(Point, [p, f])[0];
    }
    // Non-constant-time multiplication. Uses double-and-add algorithm.
    // It's faster, but should only be used when you don't care about
    // an exposed private key e.g. sig verification.
    // Does NOT allow scalars higher than CURVE.n.
    // Accepts optional accumulator to merge with multiply (important for sparse scalars)
    multiplyUnsafe(scalar, acc = Point.ZERO) {
      if (!Fn3.isValid(scalar))
        throw new Error("invalid scalar: expected 0 <= sc < curve.n");
      if (scalar === _0n6)
        return Point.ZERO;
      if (this.is0() || scalar === _1n7)
        return this;
      return wnaf.unsafe(this, scalar, (p) => normalizeZ(Point, p), acc);
    }
    // Checks if point is of small order.
    // If you add something to small order point, you will have "dirty"
    // point with torsion component.
    // Multiplies point by cofactor and checks if the result is 0.
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    // Multiplies point by curve order and checks if the result is 0.
    // Returns `false` is the point is dirty.
    isTorsionFree() {
      return wnaf.unsafe(this, CURVE.n).is0();
    }
    // Converts Extended point to default (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    clearCofactor() {
      if (cofactor === _1n7)
        return this;
      return this.multiplyUnsafe(cofactor);
    }
    toBytes() {
      const { x, y } = this.toAffine();
      const bytes = Fp3.toBytes(y);
      bytes[bytes.length - 1] |= x & _1n7 ? 128 : 0;
      return bytes;
    }
    toHex() {
      return bytesToHex3(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const wnaf = new wNAF(Point, Fn3.BITS);
  Point.BASE.precompute(8);
  return Point;
}
function eddsa(Point, cHash, eddsaOpts = {}) {
  if (typeof cHash !== "function")
    throw new Error('"hash" function param is required');
  validateObject2(eddsaOpts, {}, {
    adjustScalarBytes: "function",
    randomBytes: "function",
    domain: "function",
    prehash: "function",
    mapToCurve: "function"
  });
  const { prehash } = eddsaOpts;
  const { BASE, Fp: Fp3, Fn: Fn3 } = Point;
  const randomBytes5 = eddsaOpts.randomBytes || randomBytes2;
  const adjustScalarBytes4 = eddsaOpts.adjustScalarBytes || ((bytes) => bytes);
  const domain = eddsaOpts.domain || ((data, ctx, phflag) => {
    abool3(phflag, "phflag");
    if (ctx.length || phflag)
      throw new Error("Contexts/pre-hash are not supported");
    return data;
  });
  function modN_LE(hash) {
    return Fn3.create(bytesToNumberLE2(hash));
  }
  function getPrivateScalar(key) {
    const len = lengths.secretKey;
    abytes5(key, lengths.secretKey, "secretKey");
    const hashed = abytes5(cHash(key), 2 * len, "hashedSecretKey");
    const head = adjustScalarBytes4(hashed.slice(0, len));
    const prefix = hashed.slice(len, 2 * len);
    const scalar = modN_LE(head);
    return { head, prefix, scalar };
  }
  function getExtendedPublicKey(secretKey) {
    const { head, prefix, scalar } = getPrivateScalar(secretKey);
    const point = BASE.multiply(scalar);
    const pointBytes = point.toBytes();
    return { head, prefix, scalar, point, pointBytes };
  }
  function getPublicKey(secretKey) {
    return getExtendedPublicKey(secretKey).pointBytes;
  }
  function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
    const msg = concatBytes2(...msgs);
    return modN_LE(cHash(domain(msg, abytes5(context, void 0, "context"), !!prehash)));
  }
  function sign(msg, secretKey, options = {}) {
    msg = abytes5(msg, void 0, "message");
    if (prehash)
      msg = prehash(msg);
    const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
    const r = hashDomainToScalar(options.context, prefix, msg);
    const R = BASE.multiply(r).toBytes();
    const k = hashDomainToScalar(options.context, R, pointBytes, msg);
    const s = Fn3.create(r + k * scalar);
    if (!Fn3.isValid(s))
      throw new Error("sign failed: invalid s");
    const rs = concatBytes2(R, Fn3.toBytes(s));
    return abytes5(rs, lengths.signature, "result");
  }
  const verifyOpts = { zip215: true };
  function verify(sig, msg, publicKey, options = verifyOpts) {
    const { context, zip215 } = options;
    const len = lengths.signature;
    sig = abytes5(sig, len, "signature");
    msg = abytes5(msg, void 0, "message");
    publicKey = abytes5(publicKey, lengths.publicKey, "publicKey");
    if (zip215 !== void 0)
      abool3(zip215, "zip215");
    if (prehash)
      msg = prehash(msg);
    const mid = len / 2;
    const r = sig.subarray(0, mid);
    const s = bytesToNumberLE2(sig.subarray(mid, len));
    let A, R, SB;
    try {
      A = Point.fromBytes(publicKey, zip215);
      R = Point.fromBytes(r, zip215);
      SB = BASE.multiplyUnsafe(s);
    } catch (error) {
      return false;
    }
    if (!zip215 && A.isSmallOrder())
      return false;
    const k = hashDomainToScalar(context, R.toBytes(), A.toBytes(), msg);
    const RkA = R.add(A.multiplyUnsafe(k));
    return RkA.subtract(SB).clearCofactor().is0();
  }
  const _size = Fp3.BYTES;
  const lengths = {
    secretKey: _size,
    publicKey: _size,
    signature: 2 * _size,
    seed: _size
  };
  function randomSecretKey(seed = randomBytes5(lengths.seed)) {
    return abytes5(seed, lengths.seed, "seed");
  }
  function isValidSecretKey(key) {
    return isBytes5(key) && key.length === Fn3.BYTES;
  }
  function isValidPublicKey(key, zip215) {
    try {
      return !!Point.fromBytes(key, zip215);
    } catch (error) {
      return false;
    }
  }
  const utils = {
    getExtendedPublicKey,
    randomSecretKey,
    isValidSecretKey,
    isValidPublicKey,
    /**
     * Converts ed public key to x public key. Uses formula:
     * - ed25519:
     *   - `(u, v) = ((1+y)/(1-y), sqrt(-486664)*u/x)`
     *   - `(x, y) = (sqrt(-486664)*u/v, (u-1)/(u+1))`
     * - ed448:
     *   - `(u, v) = ((y-1)/(y+1), sqrt(156324)*u/x)`
     *   - `(x, y) = (sqrt(156324)*u/v, (1+u)/(1-u))`
     */
    toMontgomery(publicKey) {
      const { y } = Point.fromBytes(publicKey);
      const size = lengths.publicKey;
      const is25519 = size === 32;
      if (!is25519 && size !== 57)
        throw new Error("only defined for 25519 and 448");
      const u = is25519 ? Fp3.div(_1n7 + y, _1n7 - y) : Fp3.div(y - _1n7, y + _1n7);
      return Fp3.toBytes(u);
    },
    toMontgomerySecret(secretKey) {
      const size = lengths.secretKey;
      abytes5(secretKey, size);
      const hashed = cHash(secretKey.subarray(0, size));
      return adjustScalarBytes4(hashed).subarray(0, size);
    }
  };
  return Object.freeze({
    keygen: createKeygen2(randomSecretKey, getPublicKey),
    getPublicKey,
    sign,
    verify,
    utils,
    Point,
    lengths
  });
}
var _0n6, _1n7, _2n5, _8n2, PrimeEdwardsPoint;
var init_edwards = __esm({
  "node_modules/@noble/curves/abstract/edwards.js"() {
    init_utils6();
    init_curve2();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _0n6 = BigInt(0);
    _1n7 = BigInt(1);
    _2n5 = BigInt(2);
    _8n2 = BigInt(8);
    PrimeEdwardsPoint = class {
      static BASE;
      static ZERO;
      static Fp;
      static Fn;
      ep;
      constructor(ep) {
        this.ep = ep;
      }
      // Static methods that must be implemented by subclasses
      static fromBytes(_bytes) {
        notImplemented();
      }
      static fromHex(_hex) {
        notImplemented();
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      // Common implementations
      clearCofactor() {
        return this;
      }
      assertValidity() {
        this.ep.assertValidity();
      }
      toAffine(invertedZ) {
        return this.ep.toAffine(invertedZ);
      }
      toHex() {
        return bytesToHex3(this.toBytes());
      }
      toString() {
        return this.toHex();
      }
      isTorsionFree() {
        return true;
      }
      isSmallOrder() {
        return false;
      }
      add(other) {
        this.assertSame(other);
        return this.init(this.ep.add(other.ep));
      }
      subtract(other) {
        this.assertSame(other);
        return this.init(this.ep.subtract(other.ep));
      }
      multiply(scalar) {
        return this.init(this.ep.multiply(scalar));
      }
      multiplyUnsafe(scalar) {
        return this.init(this.ep.multiplyUnsafe(scalar));
      }
      double() {
        return this.init(this.ep.double());
      }
      negate() {
        return this.init(this.ep.negate());
      }
      precompute(windowSize, isLazy) {
        return this.init(this.ep.precompute(windowSize, isLazy));
      }
    };
  }
});

// node_modules/@noble/curves/abstract/hash-to-curve.js
function i2osp(value, length) {
  asafenumber(value);
  asafenumber(length);
  if (value < 0 || value >= 1 << 8 * length)
    throw new Error("invalid I2OSP input: " + value);
  const res = Array.from({ length }).fill(0);
  for (let i = length - 1; i >= 0; i--) {
    res[i] = value & 255;
    value >>>= 8;
  }
  return new Uint8Array(res);
}
function strxor(a, b) {
  const arr = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    arr[i] = a[i] ^ b[i];
  }
  return arr;
}
function normDST(DST) {
  if (!isBytes5(DST) && typeof DST !== "string")
    throw new Error("DST must be Uint8Array or ascii string");
  return typeof DST === "string" ? asciiToBytes(DST) : DST;
}
function expand_message_xmd(msg, DST, lenInBytes, H) {
  abytes5(msg);
  asafenumber(lenInBytes);
  DST = normDST(DST);
  if (DST.length > 255)
    DST = H(concatBytes2(asciiToBytes("H2C-OVERSIZE-DST-"), DST));
  const { outputLen: b_in_bytes, blockLen: r_in_bytes } = H;
  const ell = Math.ceil(lenInBytes / b_in_bytes);
  if (lenInBytes > 65535 || ell > 255)
    throw new Error("expand_message_xmd: invalid lenInBytes");
  const DST_prime = concatBytes2(DST, i2osp(DST.length, 1));
  const Z_pad = i2osp(0, r_in_bytes);
  const l_i_b_str = i2osp(lenInBytes, 2);
  const b = new Array(ell);
  const b_0 = H(concatBytes2(Z_pad, msg, l_i_b_str, i2osp(0, 1), DST_prime));
  b[0] = H(concatBytes2(b_0, i2osp(1, 1), DST_prime));
  for (let i = 1; i <= ell; i++) {
    const args = [strxor(b_0, b[i - 1]), i2osp(i + 1, 1), DST_prime];
    b[i] = H(concatBytes2(...args));
  }
  const pseudo_random_bytes = concatBytes2(...b);
  return pseudo_random_bytes.slice(0, lenInBytes);
}
function expand_message_xof(msg, DST, lenInBytes, k, H) {
  abytes5(msg);
  asafenumber(lenInBytes);
  DST = normDST(DST);
  if (DST.length > 255) {
    const dkLen = Math.ceil(2 * k / 8);
    DST = H.create({ dkLen }).update(asciiToBytes("H2C-OVERSIZE-DST-")).update(DST).digest();
  }
  if (lenInBytes > 65535 || DST.length > 255)
    throw new Error("expand_message_xof: invalid lenInBytes");
  return H.create({ dkLen: lenInBytes }).update(msg).update(i2osp(lenInBytes, 2)).update(DST).update(i2osp(DST.length, 1)).digest();
}
function hash_to_field(msg, count, options) {
  validateObject2(options, {
    p: "bigint",
    m: "number",
    k: "number",
    hash: "function"
  });
  const { p, k, m, hash, expand, DST } = options;
  asafenumber(hash.outputLen, "valid hash");
  abytes5(msg);
  asafenumber(count);
  const log2p = p.toString(2).length;
  const L = Math.ceil((log2p + k) / 8);
  const len_in_bytes = count * m * L;
  let prb;
  if (expand === "xmd") {
    prb = expand_message_xmd(msg, DST, len_in_bytes, hash);
  } else if (expand === "xof") {
    prb = expand_message_xof(msg, DST, len_in_bytes, k, hash);
  } else if (expand === "_internal_pass") {
    prb = msg;
  } else {
    throw new Error('expand must be "xmd" or "xof"');
  }
  const u = new Array(count);
  for (let i = 0; i < count; i++) {
    const e = new Array(m);
    for (let j = 0; j < m; j++) {
      const elm_offset = L * (j + i * m);
      const tv = prb.subarray(elm_offset, elm_offset + L);
      e[j] = mod3(os2ip(tv), p);
    }
    u[i] = e;
  }
  return u;
}
function createHasher4(Point, mapToCurve, defaults) {
  if (typeof mapToCurve !== "function")
    throw new Error("mapToCurve() must be defined");
  function map(num) {
    return Point.fromAffine(mapToCurve(num));
  }
  function clear(initial) {
    const P = initial.clearCofactor();
    if (P.equals(Point.ZERO))
      return Point.ZERO;
    P.assertValidity();
    return P;
  }
  return {
    defaults: Object.freeze(defaults),
    Point,
    hashToCurve(msg, options) {
      const opts = Object.assign({}, defaults, options);
      const u = hash_to_field(msg, 2, opts);
      const u0 = map(u[0]);
      const u1 = map(u[1]);
      return clear(u0.add(u1));
    },
    encodeToCurve(msg, options) {
      const optsDst = defaults.encodeDST ? { DST: defaults.encodeDST } : {};
      const opts = Object.assign({}, defaults, optsDst, options);
      const u = hash_to_field(msg, 1, opts);
      const u0 = map(u[0]);
      return clear(u0);
    },
    /** See {@link H2CHasher} */
    mapToCurve(scalars) {
      if (defaults.m === 1) {
        if (typeof scalars !== "bigint")
          throw new Error("expected bigint (m=1)");
        return clear(map([scalars]));
      }
      if (!Array.isArray(scalars))
        throw new Error("expected array of bigints");
      for (const i of scalars)
        if (typeof i !== "bigint")
          throw new Error("expected array of bigints");
      return clear(map(scalars));
    },
    // hash_to_scalar can produce 0: https://www.rfc-editor.org/errata/eid8393
    // RFC 9380, draft-irtf-cfrg-bbs-signatures-08
    hashToScalar(msg, options) {
      const N3 = Point.Fn.ORDER;
      const opts = Object.assign({}, defaults, { p: N3, m: 1, DST: _DST_scalar }, options);
      return hash_to_field(msg, 1, opts)[0][0];
    }
  };
}
var os2ip, _DST_scalar;
var init_hash_to_curve = __esm({
  "node_modules/@noble/curves/abstract/hash-to-curve.js"() {
    init_utils6();
    init_modular2();
    os2ip = bytesToNumberBE;
    _DST_scalar = asciiToBytes("HashToScalar-");
  }
});

// node_modules/@noble/curves/abstract/montgomery.js
function validateOpts2(curve) {
  validateObject2(curve, {
    adjustScalarBytes: "function",
    powPminus2: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery2(curveDef) {
  const CURVE = validateOpts2(curveDef);
  const { P, type, adjustScalarBytes: adjustScalarBytes4, powPminus2, randomBytes: rand } = CURVE;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand || randomBytes2;
  const montgomeryBits = is25519 ? 255 : 448;
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? BigInt(9) : BigInt(5);
  const a24 = is25519 ? BigInt(121665) : BigInt(39081);
  const minScalar = is25519 ? _2n6 ** BigInt(254) : _2n6 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * _2n6 ** BigInt(251) - _1n8 : BigInt(4) * _2n6 ** BigInt(445) - _1n8;
  const maxScalar = minScalar + maxAdded + _1n8;
  const modP = (n) => mod3(n, P);
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE2(modP(u), fieldLen);
  }
  function decodeU(u) {
    const _u = copyBytes4(abytes5(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE2(_u));
  }
  function decodeScalar(scalar) {
    return bytesToNumberLE2(adjustScalarBytes4(copyBytes4(abytes5(scalar, fieldLen, "scalar"))));
  }
  function scalarMult(scalar, u) {
    const pu = montgomeryLadder(decodeU(u), decodeScalar(scalar));
    if (pu === _0n7)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  function scalarMultBase(scalar) {
    return scalarMult(scalar, GuBytes);
  }
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function cswap(swap, x_2, x_3) {
    const dummy = modP(swap * (x_2 - x_3));
    x_2 = modP(x_2 - dummy);
    x_3 = modP(x_3 + dummy);
    return { x_2, x_3 };
  }
  function montgomeryLadder(u, scalar) {
    aInRange2("u", u, _0n7, P);
    aInRange2("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n8;
    let z_2 = _0n7;
    let x_3 = u;
    let z_3 = _1n8;
    let swap = _0n7;
    for (let t = BigInt(montgomeryBits - 1); t >= _0n7; t--) {
      const k_t = k >> t & _1n8;
      swap ^= k_t;
      ({ x_2, x_3 } = cswap(swap, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
      swap = k_t;
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D2 = x_3 - z_3;
      const DA = modP(D2 * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    ({ x_2, x_3 } = cswap(swap, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = (seed = randomBytes_(fieldLen)) => {
    abytes5(seed, lengths.seed, "seed");
    return seed;
  };
  const utils = { randomSecretKey };
  return Object.freeze({
    keygen: createKeygen2(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult,
    scalarMultBase,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}
var _0n7, _1n8, _2n6;
var init_montgomery2 = __esm({
  "node_modules/@noble/curves/abstract/montgomery.js"() {
    init_utils6();
    init_curve2();
    init_modular2();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _0n7 = BigInt(0);
    _1n8 = BigInt(1);
    _2n6 = BigInt(2);
  }
});

// node_modules/@noble/curves/abstract/oprf.js
function createORPF(opts) {
  validateObject2(opts, {
    name: "string",
    hash: "function",
    hashToScalar: "function",
    hashToGroup: "function"
  });
  const { name, Point, hash } = opts;
  const { Fn: Fn3 } = Point;
  const hashToGroup = (msg, ctx) => opts.hashToGroup(msg, {
    DST: concatBytes2(asciiToBytes("HashToGroup-"), ctx)
  });
  const hashToScalarPrefixed = (msg, ctx) => opts.hashToScalar(msg, { DST: concatBytes2(_DST_scalar, ctx) });
  const randomScalar = (rng = randomBytes2) => {
    const t = mapHashToField(rng(getMinHashLength(Fn3.ORDER)), Fn3.ORDER, Fn3.isLE);
    return Fn3.isLE ? bytesToNumberLE2(t) : bytesToNumberBE(t);
  };
  const msm = (points, scalars) => pippenger(Point, points, scalars);
  const getCtx = (mode) => concatBytes2(asciiToBytes("OPRFV1-"), new Uint8Array([mode]), asciiToBytes("-" + name));
  const ctxOPRF = getCtx(0);
  const ctxVOPRF = getCtx(1);
  const ctxPOPRF = getCtx(2);
  function encode2(...args) {
    const res = [];
    for (const a of args) {
      if (typeof a === "number")
        res.push(numberToBytesBE3(a, 2));
      else if (typeof a === "string")
        res.push(asciiToBytes(a));
      else {
        abytes5(a);
        res.push(numberToBytesBE3(a.length, 2), a);
      }
    }
    return concatBytes2(...res);
  }
  const hashInput = (...bytes) => hash(encode2(...bytes, "Finalize"));
  function getTranscripts(B, C, D2, ctx) {
    const Bm = B.toBytes();
    const seed = hash(encode2(Bm, concatBytes2(asciiToBytes("Seed-"), ctx)));
    const res = [];
    for (let i = 0; i < C.length; i++) {
      const Ci = C[i].toBytes();
      const Di = D2[i].toBytes();
      const di = hashToScalarPrefixed(encode2(seed, i, Ci, Di, "Composite"), ctx);
      res.push(di);
    }
    return res;
  }
  function computeComposites(B, C, D2, ctx) {
    const T = getTranscripts(B, C, D2, ctx);
    const M = msm(C, T);
    const Z = msm(D2, T);
    return { M, Z };
  }
  function computeCompositesFast(k, B, C, D2, ctx) {
    const T = getTranscripts(B, C, D2, ctx);
    const M = msm(C, T);
    const Z = M.multiply(k);
    return { M, Z };
  }
  function challengeTranscript(B, M, Z, t2, t3, ctx) {
    const [Bm, a0, a1, a2, a3] = [B, M, Z, t2, t3].map((i) => i.toBytes());
    return hashToScalarPrefixed(encode2(Bm, a0, a1, a2, a3, "Challenge"), ctx);
  }
  function generateProof(ctx, k, B, C, D2, rng) {
    const { M, Z } = computeCompositesFast(k, B, C, D2, ctx);
    const r = randomScalar(rng);
    const t2 = Point.BASE.multiply(r);
    const t3 = M.multiply(r);
    const c = challengeTranscript(B, M, Z, t2, t3, ctx);
    const s = Fn3.sub(r, Fn3.mul(c, k));
    return concatBytes2(...[c, s].map((i) => Fn3.toBytes(i)));
  }
  function verifyProof(ctx, B, C, D2, proof) {
    abytes5(proof, 2 * Fn3.BYTES);
    const { M, Z } = computeComposites(B, C, D2, ctx);
    const [c, s] = [proof.subarray(0, Fn3.BYTES), proof.subarray(Fn3.BYTES)].map((f) => Fn3.fromBytes(f));
    const t2 = Point.BASE.multiply(s).add(B.multiply(c));
    const t3 = M.multiply(s).add(Z.multiply(c));
    const expectedC = challengeTranscript(B, M, Z, t2, t3, ctx);
    if (!Fn3.eql(c, expectedC))
      throw new Error("proof verification failed");
  }
  function generateKeyPair() {
    const skS = randomScalar();
    const pkS = Point.BASE.multiply(skS);
    return { secretKey: Fn3.toBytes(skS), publicKey: pkS.toBytes() };
  }
  function deriveKeyPair(ctx, seed, info) {
    const dst = concatBytes2(asciiToBytes("DeriveKeyPair"), ctx);
    const msg = concatBytes2(seed, encode2(info), Uint8Array.of(0));
    for (let counter = 0; counter <= 255; counter++) {
      msg[msg.length - 1] = counter;
      const skS = opts.hashToScalar(msg, { DST: dst });
      if (Fn3.is0(skS))
        continue;
      return { secretKey: Fn3.toBytes(skS), publicKey: Point.BASE.multiply(skS).toBytes() };
    }
    throw new Error("Cannot derive key");
  }
  function blind(ctx, input, rng = randomBytes2) {
    const blind2 = randomScalar(rng);
    const inputPoint = hashToGroup(input, ctx);
    if (inputPoint.equals(Point.ZERO))
      throw new Error("Input point at infinity");
    const blinded = inputPoint.multiply(blind2);
    return { blind: Fn3.toBytes(blind2), blinded: blinded.toBytes() };
  }
  function evaluate(ctx, secretKey, input) {
    const skS = Fn3.fromBytes(secretKey);
    const inputPoint = hashToGroup(input, ctx);
    if (inputPoint.equals(Point.ZERO))
      throw new Error("Input point at infinity");
    const unblinded = inputPoint.multiply(skS).toBytes();
    return hashInput(input, unblinded);
  }
  const oprf = {
    generateKeyPair,
    deriveKeyPair: (seed, keyInfo) => deriveKeyPair(ctxOPRF, seed, keyInfo),
    blind: (input, rng = randomBytes2) => blind(ctxOPRF, input, rng),
    blindEvaluate(secretKey, blindedPoint) {
      const skS = Fn3.fromBytes(secretKey);
      const elm = Point.fromBytes(blindedPoint);
      return elm.multiply(skS).toBytes();
    },
    finalize(input, blindBytes, evaluatedBytes) {
      const blind2 = Fn3.fromBytes(blindBytes);
      const evalPoint = Point.fromBytes(evaluatedBytes);
      const unblinded = evalPoint.multiply(Fn3.inv(blind2)).toBytes();
      return hashInput(input, unblinded);
    },
    evaluate: (secretKey, input) => evaluate(ctxOPRF, secretKey, input)
  };
  const voprf = {
    generateKeyPair,
    deriveKeyPair: (seed, keyInfo) => deriveKeyPair(ctxVOPRF, seed, keyInfo),
    blind: (input, rng = randomBytes2) => blind(ctxVOPRF, input, rng),
    blindEvaluateBatch(secretKey, publicKey, blinded, rng = randomBytes2) {
      if (!Array.isArray(blinded))
        throw new Error("expected array");
      const skS = Fn3.fromBytes(secretKey);
      const pkS = Point.fromBytes(publicKey);
      const blindedPoints = blinded.map(Point.fromBytes);
      const evaluated = blindedPoints.map((i) => i.multiply(skS));
      const proof = generateProof(ctxVOPRF, skS, pkS, blindedPoints, evaluated, rng);
      return { evaluated: evaluated.map((i) => i.toBytes()), proof };
    },
    blindEvaluate(secretKey, publicKey, blinded, rng = randomBytes2) {
      const res = this.blindEvaluateBatch(secretKey, publicKey, [blinded], rng);
      return { evaluated: res.evaluated[0], proof: res.proof };
    },
    finalizeBatch(items, publicKey, proof) {
      if (!Array.isArray(items))
        throw new Error("expected array");
      const pkS = Point.fromBytes(publicKey);
      const blindedPoints = items.map((i) => i.blinded).map(Point.fromBytes);
      const evalPoints = items.map((i) => i.evaluated).map(Point.fromBytes);
      verifyProof(ctxVOPRF, pkS, blindedPoints, evalPoints, proof);
      return items.map((i) => oprf.finalize(i.input, i.blind, i.evaluated));
    },
    finalize(input, blind2, evaluated, blinded, publicKey, proof) {
      return this.finalizeBatch([{ input, blind: blind2, evaluated, blinded }], publicKey, proof)[0];
    },
    evaluate: (secretKey, input) => evaluate(ctxVOPRF, secretKey, input)
  };
  const poprf = (info) => {
    const m = hashToScalarPrefixed(encode2("Info", info), ctxPOPRF);
    const T = Point.BASE.multiply(m);
    return {
      generateKeyPair,
      deriveKeyPair: (seed, keyInfo) => deriveKeyPair(ctxPOPRF, seed, keyInfo),
      blind(input, publicKey, rng = randomBytes2) {
        const pkS = Point.fromBytes(publicKey);
        const tweakedKey = T.add(pkS);
        if (tweakedKey.equals(Point.ZERO))
          throw new Error("tweakedKey point at infinity");
        const blind2 = randomScalar(rng);
        const inputPoint = hashToGroup(input, ctxPOPRF);
        if (inputPoint.equals(Point.ZERO))
          throw new Error("Input point at infinity");
        const blindedPoint = inputPoint.multiply(blind2);
        return {
          blind: Fn3.toBytes(blind2),
          blinded: blindedPoint.toBytes(),
          tweakedKey: tweakedKey.toBytes()
        };
      },
      blindEvaluateBatch(secretKey, blinded, rng = randomBytes2) {
        if (!Array.isArray(blinded))
          throw new Error("expected array");
        const skS = Fn3.fromBytes(secretKey);
        const t = Fn3.add(skS, m);
        const invT = Fn3.inv(t);
        const blindedPoints = blinded.map(Point.fromBytes);
        const evalPoints = blindedPoints.map((i) => i.multiply(invT));
        const tweakedKey = Point.BASE.multiply(t);
        const proof = generateProof(ctxPOPRF, t, tweakedKey, evalPoints, blindedPoints, rng);
        return { evaluated: evalPoints.map((i) => i.toBytes()), proof };
      },
      blindEvaluate(secretKey, blinded, rng = randomBytes2) {
        const res = this.blindEvaluateBatch(secretKey, [blinded], rng);
        return { evaluated: res.evaluated[0], proof: res.proof };
      },
      finalizeBatch(items, proof, tweakedKey) {
        if (!Array.isArray(items))
          throw new Error("expected array");
        const evalPoints = items.map((i) => i.evaluated).map(Point.fromBytes);
        verifyProof(ctxPOPRF, Point.fromBytes(tweakedKey), evalPoints, items.map((i) => i.blinded).map(Point.fromBytes), proof);
        return items.map((i, j) => {
          const blind2 = Fn3.fromBytes(i.blind);
          const point = evalPoints[j].multiply(Fn3.inv(blind2)).toBytes();
          return hashInput(i.input, info, point);
        });
      },
      finalize(input, blind2, evaluated, blinded, proof, tweakedKey) {
        return this.finalizeBatch([{ input, blind: blind2, evaluated, blinded }], proof, tweakedKey)[0];
      },
      evaluate(secretKey, input) {
        const skS = Fn3.fromBytes(secretKey);
        const inputPoint = hashToGroup(input, ctxPOPRF);
        if (inputPoint.equals(Point.ZERO))
          throw new Error("Input point at infinity");
        const t = Fn3.add(skS, m);
        const invT = Fn3.inv(t);
        const unblinded = inputPoint.multiply(invT).toBytes();
        return hashInput(input, info, unblinded);
      }
    };
  };
  return Object.freeze({ name, oprf, voprf, poprf, __tests: { Fn: Fn3 } });
}
var init_oprf = __esm({
  "node_modules/@noble/curves/abstract/oprf.js"() {
    init_utils6();
    init_curve2();
    init_hash_to_curve();
    init_modular2();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  }
});

// node_modules/@noble/curves/ed25519.js
var ed25519_exports = {};
__export(ed25519_exports, {
  ED25519_TORSION_SUBGROUP: () => ED25519_TORSION_SUBGROUP,
  _map_to_curve_elligator2_curve25519: () => _map_to_curve_elligator2_curve25519,
  ed25519: () => ed25519,
  ed25519_hasher: () => ed25519_hasher,
  ed25519ctx: () => ed25519ctx,
  ed25519ph: () => ed25519ph,
  ristretto255: () => ristretto255,
  ristretto255_hasher: () => ristretto255_hasher,
  ristretto255_oprf: () => ristretto255_oprf,
  x25519: () => x255192
});
function ed25519_pow_2_252_32(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p2;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow22(b2, _2n7, P) * b2 % P;
  const b5 = pow22(b4, _1n9, P) * x % P;
  const b10 = pow22(b5, _5n3, P) * b5 % P;
  const b20 = pow22(b10, _10n, P) * b10 % P;
  const b40 = pow22(b20, _20n, P) * b20 % P;
  const b80 = pow22(b40, _40n, P) * b40 % P;
  const b160 = pow22(b80, _80n, P) * b80 % P;
  const b240 = pow22(b160, _80n, P) * b80 % P;
  const b250 = pow22(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow22(b250, _2n7, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes2(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
function uvRatio(u, v) {
  const P = ed25519_CURVE_p2;
  const v3 = mod3(v * v * v, P);
  const v7 = mod3(v3 * v3 * v, P);
  const pow = ed25519_pow_2_252_32(u * v7).pow_p_5_8;
  let x = mod3(u * v3 * pow, P);
  const vx2 = mod3(v * x * x, P);
  const root1 = x;
  const root2 = mod3(x * ED25519_SQRT_M1, P);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod3(-u, P);
  const noRoot = vx2 === mod3(-u * ED25519_SQRT_M1, P);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if (isNegativeLE(x, P))
    x = mod3(-x, P);
  return { isValid: useRoot1 || useRoot2, value: x };
}
function ed25519_domain(data, ctx, phflag) {
  if (ctx.length > 255)
    throw new Error("Context is too big");
  return concatBytes2(asciiToBytes("SigEd25519 no Ed25519 collisions"), new Uint8Array([phflag ? 1 : 0, ctx.length]), ctx, data);
}
function ed(opts) {
  return eddsa(ed25519_Point, sha5122, Object.assign({ adjustScalarBytes: adjustScalarBytes2 }, opts));
}
function _map_to_curve_elligator2_curve25519(u) {
  const ELL2_C4 = (ed25519_CURVE_p2 - _5n3) / _8n3;
  const ELL2_J2 = BigInt(486662);
  let tv1 = Fp.sqr(u);
  tv1 = Fp.mul(tv1, _2n7);
  let xd = Fp.add(tv1, Fp.ONE);
  let x1n = Fp.neg(ELL2_J2);
  let tv2 = Fp.sqr(xd);
  let gxd = Fp.mul(tv2, xd);
  let gx1 = Fp.mul(tv1, ELL2_J2);
  gx1 = Fp.mul(gx1, x1n);
  gx1 = Fp.add(gx1, tv2);
  gx1 = Fp.mul(gx1, x1n);
  let tv3 = Fp.sqr(gxd);
  tv2 = Fp.sqr(tv3);
  tv3 = Fp.mul(tv3, gxd);
  tv3 = Fp.mul(tv3, gx1);
  tv2 = Fp.mul(tv2, tv3);
  let y11 = Fp.pow(tv2, ELL2_C4);
  y11 = Fp.mul(y11, tv3);
  let y12 = Fp.mul(y11, ELL2_C3);
  tv2 = Fp.sqr(y11);
  tv2 = Fp.mul(tv2, gxd);
  let e1 = Fp.eql(tv2, gx1);
  let y1 = Fp.cmov(y12, y11, e1);
  let x2n = Fp.mul(x1n, tv1);
  let y21 = Fp.mul(y11, u);
  y21 = Fp.mul(y21, ELL2_C2);
  let y22 = Fp.mul(y21, ELL2_C3);
  let gx2 = Fp.mul(gx1, tv1);
  tv2 = Fp.sqr(y21);
  tv2 = Fp.mul(tv2, gxd);
  let e2 = Fp.eql(tv2, gx2);
  let y2 = Fp.cmov(y22, y21, e2);
  tv2 = Fp.sqr(y1);
  tv2 = Fp.mul(tv2, gxd);
  let e3 = Fp.eql(tv2, gx1);
  let xn = Fp.cmov(x2n, x1n, e3);
  let y = Fp.cmov(y2, y1, e3);
  let e4 = Fp.isOdd(y);
  y = Fp.cmov(y, Fp.neg(y), e3 !== e4);
  return { xMn: xn, xMd: xd, yMn: y, yMd: _1n9 };
}
function map_to_curve_elligator2_edwards25519(u) {
  const { xMn, xMd, yMn, yMd } = _map_to_curve_elligator2_curve25519(u);
  let xn = Fp.mul(xMn, yMd);
  xn = Fp.mul(xn, ELL2_C1_EDWARDS);
  let xd = Fp.mul(xMd, yMn);
  let yn = Fp.sub(xMn, xMd);
  let yd = Fp.add(xMn, xMd);
  let tv1 = Fp.mul(xd, yd);
  let e = Fp.eql(tv1, Fp.ZERO);
  xn = Fp.cmov(xn, Fp.ZERO, e);
  xd = Fp.cmov(xd, Fp.ONE, e);
  yn = Fp.cmov(yn, Fp.ONE, e);
  yd = Fp.cmov(yd, Fp.ONE, e);
  const [xd_inv, yd_inv] = FpInvertBatch(Fp, [xd, yd], true);
  return { x: Fp.mul(xn, xd_inv), y: Fp.mul(yn, yd_inv) };
}
function calcElligatorRistrettoMap(r0) {
  const { d } = ed25519_CURVE;
  const P = ed25519_CURVE_p2;
  const mod5 = (n) => Fp.create(n);
  const r = mod5(SQRT_M1 * r0 * r0);
  const Ns = mod5((r + _1n9) * ONE_MINUS_D_SQ);
  let c = BigInt(-1);
  const D2 = mod5((c - d * r) * mod5(r + d));
  let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D2);
  let s_ = mod5(s * r0);
  if (!isNegativeLE(s_, P))
    s_ = mod5(-s_);
  if (!Ns_D_is_sq)
    s = s_;
  if (!Ns_D_is_sq)
    c = r;
  const Nt = mod5(c * (r - _1n9) * D_MINUS_ONE_SQ - D2);
  const s2 = s * s;
  const W0 = mod5((s + s) * D2);
  const W1 = mod5(Nt * SQRT_AD_MINUS_ONE);
  const W2 = mod5(_1n9 - s2);
  const W3 = mod5(_1n9 + s2);
  return new ed25519_Point(mod5(W0 * W3), mod5(W2 * W1), mod5(W1 * W3), mod5(W0 * W2));
}
var _0n8, _1n9, _2n7, _3n3, _5n3, _8n3, ed25519_CURVE_p2, ed25519_CURVE, ED25519_SQRT_M1, ed25519_Point, Fp, Fn, ed25519, ed25519ctx, ed25519ph, x255192, ELL2_C1, ELL2_C2, ELL2_C3, ELL2_C1_EDWARDS, ed25519_hasher, SQRT_M1, SQRT_AD_MINUS_ONE, INVSQRT_A_MINUS_D, ONE_MINUS_D_SQ, D_MINUS_ONE_SQ, invertSqrt, MAX_255B, bytes255ToNumberLE, _RistrettoPoint, ristretto255, ristretto255_hasher, ristretto255_oprf, ED25519_TORSION_SUBGROUP;
var init_ed25519 = __esm({
  "node_modules/@noble/curves/ed25519.js"() {
    init_sha22();
    init_utils5();
    init_edwards();
    init_hash_to_curve();
    init_modular2();
    init_montgomery2();
    init_oprf();
    init_utils6();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    _0n8 = /* @__PURE__ */ BigInt(0);
    _1n9 = BigInt(1);
    _2n7 = BigInt(2);
    _3n3 = /* @__PURE__ */ BigInt(3);
    _5n3 = BigInt(5);
    _8n3 = BigInt(8);
    ed25519_CURVE_p2 = BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
    ed25519_CURVE = /* @__PURE__ */ (() => ({
      p: ed25519_CURVE_p2,
      n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
      h: _8n3,
      a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
      d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
      Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
      Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
    }))();
    ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
    ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
    Fp = /* @__PURE__ */ (() => ed25519_Point.Fp)();
    Fn = /* @__PURE__ */ (() => ed25519_Point.Fn)();
    ed25519 = /* @__PURE__ */ ed({});
    ed25519ctx = /* @__PURE__ */ ed({ domain: ed25519_domain });
    ed25519ph = /* @__PURE__ */ ed({ domain: ed25519_domain, prehash: sha5122 });
    x255192 = /* @__PURE__ */ (() => {
      const P = ed25519_CURVE_p2;
      return montgomery2({
        P,
        type: "x25519",
        powPminus2: (x) => {
          const { pow_p_5_8, b2 } = ed25519_pow_2_252_32(x);
          return mod3(pow22(pow_p_5_8, _3n3, P) * b2, P);
        },
        adjustScalarBytes: adjustScalarBytes2
      });
    })();
    ELL2_C1 = /* @__PURE__ */ (() => (ed25519_CURVE_p2 + _3n3) / _8n3)();
    ELL2_C2 = /* @__PURE__ */ (() => Fp.pow(_2n7, ELL2_C1))();
    ELL2_C3 = /* @__PURE__ */ (() => Fp.sqrt(Fp.neg(Fp.ONE)))();
    ELL2_C1_EDWARDS = /* @__PURE__ */ (() => FpSqrtEven(Fp, Fp.neg(BigInt(486664))))();
    ed25519_hasher = /* @__PURE__ */ (() => createHasher4(ed25519_Point, (scalars) => map_to_curve_elligator2_edwards25519(scalars[0]), {
      DST: "edwards25519_XMD:SHA-512_ELL2_RO_",
      encodeDST: "edwards25519_XMD:SHA-512_ELL2_NU_",
      p: ed25519_CURVE_p2,
      m: 1,
      k: 128,
      expand: "xmd",
      hash: sha5122
    }))();
    SQRT_M1 = ED25519_SQRT_M1;
    SQRT_AD_MINUS_ONE = /* @__PURE__ */ BigInt("25063068953384623474111414158702152701244531502492656460079210482610430750235");
    INVSQRT_A_MINUS_D = /* @__PURE__ */ BigInt("54469307008909316920995813868745141605393597292927456921205312896311721017578");
    ONE_MINUS_D_SQ = /* @__PURE__ */ BigInt("1159843021668779879193775521855586647937357759715417654439879720876111806838");
    D_MINUS_ONE_SQ = /* @__PURE__ */ BigInt("40440834346308536858101042469323190826248399146238708352240133220865137265952");
    invertSqrt = (number) => uvRatio(_1n9, number);
    MAX_255B = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    bytes255ToNumberLE = (bytes) => Fp.create(bytesToNumberLE2(bytes) & MAX_255B);
    _RistrettoPoint = class __RistrettoPoint extends PrimeEdwardsPoint {
      // Do NOT change syntax: the following gymnastics is done,
      // because typescript strips comments, which makes bundlers disable tree-shaking.
      // prettier-ignore
      static BASE = /* @__PURE__ */ (() => new __RistrettoPoint(ed25519_Point.BASE))();
      // prettier-ignore
      static ZERO = /* @__PURE__ */ (() => new __RistrettoPoint(ed25519_Point.ZERO))();
      // prettier-ignore
      static Fp = /* @__PURE__ */ (() => Fp)();
      // prettier-ignore
      static Fn = /* @__PURE__ */ (() => Fn)();
      constructor(ep) {
        super(ep);
      }
      static fromAffine(ap) {
        return new __RistrettoPoint(ed25519_Point.fromAffine(ap));
      }
      assertSame(other) {
        if (!(other instanceof __RistrettoPoint))
          throw new Error("RistrettoPoint expected");
      }
      init(ep) {
        return new __RistrettoPoint(ep);
      }
      static fromBytes(bytes) {
        abytes5(bytes, 32);
        const { a, d } = ed25519_CURVE;
        const P = ed25519_CURVE_p2;
        const mod5 = (n) => Fp.create(n);
        const s = bytes255ToNumberLE(bytes);
        if (!equalBytes3(Fp.toBytes(s), bytes) || isNegativeLE(s, P))
          throw new Error("invalid ristretto255 encoding 1");
        const s2 = mod5(s * s);
        const u1 = mod5(_1n9 + a * s2);
        const u2 = mod5(_1n9 - a * s2);
        const u1_2 = mod5(u1 * u1);
        const u2_2 = mod5(u2 * u2);
        const v = mod5(a * d * u1_2 - u2_2);
        const { isValid, value: I } = invertSqrt(mod5(v * u2_2));
        const Dx = mod5(I * u2);
        const Dy = mod5(I * Dx * v);
        let x = mod5((s + s) * Dx);
        if (isNegativeLE(x, P))
          x = mod5(-x);
        const y = mod5(u1 * Dy);
        const t = mod5(x * y);
        if (!isValid || isNegativeLE(t, P) || y === _0n8)
          throw new Error("invalid ristretto255 encoding 2");
        return new __RistrettoPoint(new ed25519_Point(x, y, _1n9, t));
      }
      /**
       * Converts ristretto-encoded string to ristretto point.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-decode).
       * @param hex Ristretto-encoded 32 bytes. Not every 32-byte string is valid ristretto encoding
       */
      static fromHex(hex) {
        return __RistrettoPoint.fromBytes(hexToBytes3(hex));
      }
      /**
       * Encodes ristretto point to Uint8Array.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-encode).
       */
      toBytes() {
        let { X, Y, Z, T } = this.ep;
        const P = ed25519_CURVE_p2;
        const mod5 = (n) => Fp.create(n);
        const u1 = mod5(mod5(Z + Y) * mod5(Z - Y));
        const u2 = mod5(X * Y);
        const u2sq = mod5(u2 * u2);
        const { value: invsqrt } = invertSqrt(mod5(u1 * u2sq));
        const D1 = mod5(invsqrt * u1);
        const D2 = mod5(invsqrt * u2);
        const zInv = mod5(D1 * D2 * T);
        let D3;
        if (isNegativeLE(T * zInv, P)) {
          let _x = mod5(Y * SQRT_M1);
          let _y = mod5(X * SQRT_M1);
          X = _x;
          Y = _y;
          D3 = mod5(D1 * INVSQRT_A_MINUS_D);
        } else {
          D3 = D2;
        }
        if (isNegativeLE(X * zInv, P))
          Y = mod5(-Y);
        let s = mod5((Z - Y) * D3);
        if (isNegativeLE(s, P))
          s = mod5(-s);
        return Fp.toBytes(s);
      }
      /**
       * Compares two Ristretto points.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-equals).
       */
      equals(other) {
        this.assertSame(other);
        const { X: X1, Y: Y1 } = this.ep;
        const { X: X2, Y: Y2 } = other.ep;
        const mod5 = (n) => Fp.create(n);
        const one = mod5(X1 * Y2) === mod5(Y1 * X2);
        const two = mod5(Y1 * Y2) === mod5(X1 * X2);
        return one || two;
      }
      is0() {
        return this.equals(__RistrettoPoint.ZERO);
      }
    };
    ristretto255 = { Point: _RistrettoPoint };
    ristretto255_hasher = {
      Point: _RistrettoPoint,
      /**
      * Spec: https://www.rfc-editor.org/rfc/rfc9380.html#name-hashing-to-ristretto255. Caveats:
      * * There are no test vectors
      * * encodeToCurve / mapToCurve is undefined
      * * mapToCurve would be `calcElligatorRistrettoMap(scalars[0])`, not ristretto255_map!
      * * hashToScalar is undefined too, so we just use OPRF implementation
      * * We cannot re-use 'createHasher', because ristretto255_map is different algorithm/RFC
        (os2ip -> bytes255ToNumberLE)
      * * mapToCurve == calcElligatorRistrettoMap, hashToCurve == ristretto255_map
      * * hashToScalar is undefined in RFC9380 for ristretto, we are using version from OPRF here, using bytes255ToNumblerLE will create different result if we use bytes255ToNumberLE as os2ip
      * * current version is closest to spec.
      */
      hashToCurve(msg, options) {
        const DST = options?.DST || "ristretto255_XMD:SHA-512_R255MAP_RO_";
        const xmd = expand_message_xmd(msg, DST, 64, sha5122);
        return ristretto255_hasher.deriveToCurve(xmd);
      },
      hashToScalar(msg, options = { DST: _DST_scalar }) {
        const xmd = expand_message_xmd(msg, options.DST, 64, sha5122);
        return Fn.create(bytesToNumberLE2(xmd));
      },
      /**
       * HashToCurve-like construction based on RFC 9496 (Element Derivation).
       * Converts 64 uniform random bytes into a curve point.
       *
       * WARNING: This represents an older hash-to-curve construction, preceding the finalization of RFC 9380.
       * It was later reused as a component in the newer `hash_to_ristretto255` function defined in RFC 9380.
       */
      deriveToCurve(bytes) {
        abytes5(bytes, 64);
        const r1 = bytes255ToNumberLE(bytes.subarray(0, 32));
        const R1 = calcElligatorRistrettoMap(r1);
        const r2 = bytes255ToNumberLE(bytes.subarray(32, 64));
        const R2 = calcElligatorRistrettoMap(r2);
        return new _RistrettoPoint(R1.add(R2));
      }
    };
    ristretto255_oprf = /* @__PURE__ */ (() => createORPF({
      name: "ristretto255-SHA512",
      Point: _RistrettoPoint,
      hash: sha5122,
      hashToGroup: ristretto255_hasher.hashToCurve,
      hashToScalar: ristretto255_hasher.hashToScalar
    }))();
    ED25519_TORSION_SUBGROUP = [
      "0100000000000000000000000000000000000000000000000000000000000000",
      "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
      "0000000000000000000000000000000000000000000000000000000000000080",
      "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
      "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
      "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85",
      "0000000000000000000000000000000000000000000000000000000000000000",
      "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa"
    ];
  }
});

// node_modules/@noble/curves/node_modules/@noble/hashes/sha3.js
function keccakP2(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH2(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL2(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL3[t];
      const Th = rotlH2(curH, curL, shift);
      const Tl = rotlL2(curH, curL, shift);
      const PI = SHA3_PI3[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H3[round];
    s[1] ^= SHA3_IOTA_L3[round];
  }
  clean5(B);
}
var _0n9, _1n10, _2n8, _7n4, _256n3, _0x71n3, SHA3_PI3, SHA3_ROTL3, _SHA3_IOTA3, IOTAS3, SHA3_IOTA_H3, SHA3_IOTA_L3, rotlH2, rotlL2, Keccak2, genShake2, shake2563;
var init_sha33 = __esm({
  "node_modules/@noble/curves/node_modules/@noble/hashes/sha3.js"() {
    init_u643();
    init_utils5();
    _0n9 = BigInt(0);
    _1n10 = BigInt(1);
    _2n8 = BigInt(2);
    _7n4 = BigInt(7);
    _256n3 = BigInt(256);
    _0x71n3 = BigInt(113);
    SHA3_PI3 = [];
    SHA3_ROTL3 = [];
    _SHA3_IOTA3 = [];
    for (let round = 0, R = _1n10, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI3.push(2 * (5 * y + x));
      SHA3_ROTL3.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n9;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n10 ^ (R >> _7n4) * _0x71n3) % _256n3;
        if (R & _2n8)
          t ^= _1n10 << (_1n10 << BigInt(j)) - _1n10;
      }
      _SHA3_IOTA3.push(t);
    }
    IOTAS3 = split3(_SHA3_IOTA3, true);
    SHA3_IOTA_H3 = IOTAS3[0];
    SHA3_IOTA_L3 = IOTAS3[1];
    rotlH2 = (h, l, s) => s > 32 ? rotlBH3(h, l, s) : rotlSH3(h, l, s);
    rotlL2 = (h, l, s) => s > 32 ? rotlBL3(h, l, s) : rotlSL3(h, l, s);
    Keccak2 = class _Keccak {
      state;
      pos = 0;
      posOut = 0;
      finished = false;
      state32;
      destroyed = false;
      blockLen;
      suffix;
      outputLen;
      enableXOF = false;
      rounds;
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        anumber5(outputLen, "outputLen");
        if (!(0 < blockLen && blockLen < 200))
          throw new Error("only keccak-f1600 function is supported");
        this.state = new Uint8Array(200);
        this.state32 = u325(this.state);
      }
      clone() {
        return this._cloneInto();
      }
      keccak() {
        swap32IfBE3(this.state32);
        keccakP2(this.state32, this.rounds);
        swap32IfBE3(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists5(this);
        abytes5(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists5(this, false);
        abytes5(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF)
          throw new Error("XOF is not possible for this instance");
        return this.writeInto(out);
      }
      xof(bytes) {
        anumber5(bytes);
        return this.xofInto(new Uint8Array(bytes));
      }
      digestInto(out) {
        aoutput5(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out);
        this.destroy();
        return out;
      }
      digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
      }
      destroy() {
        this.destroyed = true;
        clean5(this.state);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    genShake2 = (suffix, blockLen, outputLen, info = {}) => createHasher3((opts = {}) => new Keccak2(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true), info);
    shake2563 = /* @__PURE__ */ genShake2(31, 136, 32, /* @__PURE__ */ oidNist3(12));
  }
});

// node_modules/@noble/curves/ed448.js
var ed448_exports = {};
__export(ed448_exports, {
  E448: () => E448,
  ED448_TORSION_SUBGROUP: () => ED448_TORSION_SUBGROUP,
  decaf448: () => decaf448,
  decaf448_hasher: () => decaf448_hasher,
  decaf448_oprf: () => decaf448_oprf,
  ed448: () => ed448,
  ed448_hasher: () => ed448_hasher,
  ed448ph: () => ed448ph,
  x448: () => x448
});
function ed448_pow_Pminus3div4(x) {
  const P = ed448_CURVE_p;
  const b2 = x * x * x % P;
  const b3 = b2 * b2 * x % P;
  const b6 = pow22(b3, _3n4, P) * b3 % P;
  const b9 = pow22(b6, _3n4, P) * b3 % P;
  const b11 = pow22(b9, _2n9, P) * b2 % P;
  const b22 = pow22(b11, _11n, P) * b11 % P;
  const b44 = pow22(b22, _22n, P) * b22 % P;
  const b88 = pow22(b44, _44n, P) * b44 % P;
  const b176 = pow22(b88, _88n, P) * b88 % P;
  const b220 = pow22(b176, _44n, P) * b44 % P;
  const b222 = pow22(b220, _2n9, P) * b2 % P;
  const b223 = pow22(b222, _1n11, P) * x % P;
  return pow22(b223, _223n, P) * b222 % P;
}
function adjustScalarBytes3(bytes) {
  bytes[0] &= 252;
  bytes[55] |= 128;
  bytes[56] = 0;
  return bytes;
}
function uvRatio2(u, v) {
  const P = ed448_CURVE_p;
  const u2v = mod3(u * u * v, P);
  const u3v = mod3(u2v * u, P);
  const u5v3 = mod3(u3v * u2v * v, P);
  const root2 = ed448_pow_Pminus3div4(u5v3);
  const x = mod3(u3v * root2, P);
  const x2 = mod3(x * x, P);
  return { isValid: mod3(x2 * v, P) === u, value: x };
}
function dom4(data, ctx, phflag) {
  if (ctx.length > 255)
    throw new Error("context must be smaller than 255, got: " + ctx.length);
  return concatBytes2(asciiToBytes("SigEd448"), new Uint8Array([phflag ? 1 : 0, ctx.length]), ctx, data);
}
function ed4(opts) {
  return eddsa(ed448_Point, shake256_114, Object.assign({ adjustScalarBytes: adjustScalarBytes3, domain: dom4 }, opts));
}
function map_to_curve_elligator2_curve448(u) {
  let tv1 = Fp2.sqr(u);
  let e1 = Fp2.eql(tv1, Fp2.ONE);
  tv1 = Fp2.cmov(tv1, Fp2.ZERO, e1);
  let xd = Fp2.sub(Fp2.ONE, tv1);
  let x1n = Fp2.neg(ELL2_J);
  let tv2 = Fp2.sqr(xd);
  let gxd = Fp2.mul(tv2, xd);
  let gx1 = Fp2.mul(tv1, Fp2.neg(ELL2_J));
  gx1 = Fp2.mul(gx1, x1n);
  gx1 = Fp2.add(gx1, tv2);
  gx1 = Fp2.mul(gx1, x1n);
  let tv3 = Fp2.sqr(gxd);
  tv2 = Fp2.mul(gx1, gxd);
  tv3 = Fp2.mul(tv3, tv2);
  let y1 = Fp2.pow(tv3, ELL2_C12);
  y1 = Fp2.mul(y1, tv2);
  let x2n = Fp2.mul(x1n, Fp2.neg(tv1));
  let y2 = Fp2.mul(y1, u);
  y2 = Fp2.cmov(y2, Fp2.ZERO, e1);
  tv2 = Fp2.sqr(y1);
  tv2 = Fp2.mul(tv2, gxd);
  let e2 = Fp2.eql(tv2, gx1);
  let xn = Fp2.cmov(x2n, x1n, e2);
  let y = Fp2.cmov(y2, y1, e2);
  let e3 = Fp2.isOdd(y);
  y = Fp2.cmov(y, Fp2.neg(y), e2 !== e3);
  return { xn, xd, yn: y, yd: Fp2.ONE };
}
function map_to_curve_elligator2_edwards448(u) {
  let { xn, xd, yn, yd } = map_to_curve_elligator2_curve448(u);
  let xn2 = Fp2.sqr(xn);
  let xd2 = Fp2.sqr(xd);
  let xd4 = Fp2.sqr(xd2);
  let yn2 = Fp2.sqr(yn);
  let yd2 = Fp2.sqr(yd);
  let xEn = Fp2.sub(xn2, xd2);
  let tv2 = Fp2.sub(xEn, xd2);
  xEn = Fp2.mul(xEn, xd2);
  xEn = Fp2.mul(xEn, yd);
  xEn = Fp2.mul(xEn, yn);
  xEn = Fp2.mul(xEn, _4n2);
  tv2 = Fp2.mul(tv2, xn2);
  tv2 = Fp2.mul(tv2, yd2);
  let tv3 = Fp2.mul(yn2, _4n2);
  let tv1 = Fp2.add(tv3, yd2);
  tv1 = Fp2.mul(tv1, xd4);
  let xEd = Fp2.add(tv1, tv2);
  tv2 = Fp2.mul(tv2, xn);
  let tv4 = Fp2.mul(xn, xd4);
  let yEn = Fp2.sub(tv3, yd2);
  yEn = Fp2.mul(yEn, tv4);
  yEn = Fp2.sub(yEn, tv2);
  tv1 = Fp2.add(xn2, xd2);
  tv1 = Fp2.mul(tv1, xd2);
  tv1 = Fp2.mul(tv1, xd);
  tv1 = Fp2.mul(tv1, yn2);
  tv1 = Fp2.mul(tv1, BigInt(-2));
  let yEd = Fp2.add(tv2, tv1);
  tv4 = Fp2.mul(tv4, yd2);
  yEd = Fp2.add(yEd, tv4);
  tv1 = Fp2.mul(xEd, yEd);
  let e = Fp2.eql(tv1, Fp2.ZERO);
  xEn = Fp2.cmov(xEn, Fp2.ZERO, e);
  xEd = Fp2.cmov(xEd, Fp2.ONE, e);
  yEn = Fp2.cmov(yEn, Fp2.ONE, e);
  yEd = Fp2.cmov(yEd, Fp2.ONE, e);
  const inv = FpInvertBatch(Fp2, [xEd, yEd], true);
  return { x: Fp2.mul(xEn, inv[0]), y: Fp2.mul(yEn, inv[1]) };
}
function calcElligatorDecafMap(r0) {
  const { d, p: P } = ed448_CURVE;
  const mod5 = (n) => Fp448.create(n);
  const r = mod5(-(r0 * r0));
  const u0 = mod5(d * (r - _1n11));
  const u1 = mod5((u0 + _1n11) * (u0 - r));
  const { isValid: was_square, value: v } = uvRatio2(ONE_MINUS_TWO_D, mod5((r + _1n11) * u1));
  let v_prime = v;
  if (!was_square)
    v_prime = mod5(r0 * v);
  let sgn = _1n11;
  if (!was_square)
    sgn = mod5(-_1n11);
  const s = mod5(v_prime * (r + _1n11));
  let s_abs = s;
  if (isNegativeLE(s, P))
    s_abs = mod5(-s);
  const s2 = s * s;
  const W0 = mod5(s_abs * _2n9);
  const W1 = mod5(s2 + _1n11);
  const W2 = mod5(s2 - _1n11);
  const W3 = mod5(v_prime * s * (r - _1n11) * ONE_MINUS_TWO_D + sgn);
  return new ed448_Point(mod5(W0 * W3), mod5(W2 * W1), mod5(W1 * W3), mod5(W0 * W2));
}
var ed448_CURVE_p, ed448_CURVE, E448_CURVE, shake256_114, shake256_64, _1n11, _2n9, _3n4, _4n2, _11n, _22n, _44n, _88n, _223n, Fp2, Fn2, Fp448, Fn448, ed448_Point, ed448, ed448ph, E448, x448, ELL2_C12, ELL2_J, ed448_hasher, ONE_MINUS_D, ONE_MINUS_TWO_D, SQRT_MINUS_D, INVSQRT_MINUS_D, invertSqrt2, _DecafPoint, decaf448, decaf448_hasher, decaf448_oprf, ED448_TORSION_SUBGROUP;
var init_ed448 = __esm({
  "node_modules/@noble/curves/ed448.js"() {
    init_sha33();
    init_utils5();
    init_edwards();
    init_hash_to_curve();
    init_modular2();
    init_montgomery2();
    init_oprf();
    init_utils6();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    ed448_CURVE_p = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    ed448_CURVE = /* @__PURE__ */ (() => ({
      p: ed448_CURVE_p,
      n: BigInt("0x3fffffffffffffffffffffffffffffffffffffffffffffffffffffff7cca23e9c44edb49aed63690216cc2728dc58f552378c292ab5844f3"),
      h: BigInt(4),
      a: BigInt(1),
      d: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffffffffffffffffffffffffffffffffffffffffffffffff6756"),
      Gx: BigInt("0x4f1970c66bed0ded221d15a622bf36da9e146570470f1767ea6de324a3d3a46412ae1af72ab66511433b80e18b00938e2626a82bc70cc05e"),
      Gy: BigInt("0x693f46716eb6bc248876203756c9c7624bea73736ca3984087789c1e05a0c2d73ad3ff1ce67c39c4fdbd132c4ed7c8ad9808795bf230fa14")
    }))();
    E448_CURVE = /* @__PURE__ */ (() => Object.assign({}, ed448_CURVE, {
      d: BigInt("0xd78b4bdc7f0daf19f24f38c29373a2ccad46157242a50f37809b1da3412a12e79ccc9c81264cfe9ad080997058fb61c4243cc32dbaa156b9"),
      Gx: BigInt("0x79a70b2b70400553ae7c9df416c792c61128751ac92969240c25a07d728bdc93e21f7787ed6972249de732f38496cd11698713093e9c04fc"),
      Gy: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffff80000000000000000000000000000000000000000000000000000001")
    }))();
    shake256_114 = /* @__PURE__ */ createHasher3(() => shake2563.create({ dkLen: 114 }));
    shake256_64 = /* @__PURE__ */ createHasher3(() => shake2563.create({ dkLen: 64 }));
    _1n11 = BigInt(1);
    _2n9 = BigInt(2);
    _3n4 = BigInt(3);
    _4n2 = /* @__PURE__ */ BigInt(4);
    _11n = BigInt(11);
    _22n = BigInt(22);
    _44n = BigInt(44);
    _88n = BigInt(88);
    _223n = BigInt(223);
    Fp2 = /* @__PURE__ */ (() => Field(ed448_CURVE_p, { BITS: 456, isLE: true }))();
    Fn2 = /* @__PURE__ */ (() => Field(ed448_CURVE.n, { BITS: 456, isLE: true }))();
    Fp448 = /* @__PURE__ */ (() => Field(ed448_CURVE_p, { BITS: 448, isLE: true }))();
    Fn448 = /* @__PURE__ */ (() => Field(ed448_CURVE.n, { BITS: 448, isLE: true }))();
    ed448_Point = /* @__PURE__ */ edwards(ed448_CURVE, { Fp: Fp2, Fn: Fn2, uvRatio: uvRatio2 });
    ed448 = /* @__PURE__ */ ed4({});
    ed448ph = /* @__PURE__ */ ed4({ prehash: shake256_64 });
    E448 = /* @__PURE__ */ edwards(E448_CURVE);
    x448 = /* @__PURE__ */ (() => {
      const P = ed448_CURVE_p;
      return montgomery2({
        P,
        type: "x448",
        powPminus2: (x) => {
          const Pminus3div4 = ed448_pow_Pminus3div4(x);
          const Pminus3 = pow22(Pminus3div4, _2n9, P);
          return mod3(Pminus3 * x, P);
        },
        adjustScalarBytes: adjustScalarBytes3
      });
    })();
    ELL2_C12 = /* @__PURE__ */ (() => (ed448_CURVE_p - BigInt(3)) / BigInt(4))();
    ELL2_J = /* @__PURE__ */ BigInt(156326);
    ed448_hasher = /* @__PURE__ */ (() => createHasher4(ed448_Point, (scalars) => map_to_curve_elligator2_edwards448(scalars[0]), {
      DST: "edwards448_XOF:SHAKE256_ELL2_RO_",
      encodeDST: "edwards448_XOF:SHAKE256_ELL2_NU_",
      p: ed448_CURVE_p,
      m: 1,
      k: 224,
      expand: "xof",
      hash: shake2563
    }))();
    ONE_MINUS_D = /* @__PURE__ */ BigInt("39082");
    ONE_MINUS_TWO_D = /* @__PURE__ */ BigInt("78163");
    SQRT_MINUS_D = /* @__PURE__ */ BigInt("98944233647732219769177004876929019128417576295529901074099889598043702116001257856802131563896515373927712232092845883226922417596214");
    INVSQRT_MINUS_D = /* @__PURE__ */ BigInt("315019913931389607337177038330951043522456072897266928557328499619017160722351061360252776265186336876723201881398623946864393857820716");
    invertSqrt2 = (number) => uvRatio2(_1n11, number);
    _DecafPoint = class __DecafPoint extends PrimeEdwardsPoint {
      // The following gymnastics is done because typescript strips comments otherwise
      // prettier-ignore
      static BASE = /* @__PURE__ */ (() => new __DecafPoint(ed448_Point.BASE).multiplyUnsafe(_2n9))();
      // prettier-ignore
      static ZERO = /* @__PURE__ */ (() => new __DecafPoint(ed448_Point.ZERO))();
      // prettier-ignore
      static Fp = /* @__PURE__ */ (() => Fp448)();
      // prettier-ignore
      static Fn = /* @__PURE__ */ (() => Fn448)();
      constructor(ep) {
        super(ep);
      }
      static fromAffine(ap) {
        return new __DecafPoint(ed448_Point.fromAffine(ap));
      }
      assertSame(other) {
        if (!(other instanceof __DecafPoint))
          throw new Error("DecafPoint expected");
      }
      init(ep) {
        return new __DecafPoint(ep);
      }
      static fromBytes(bytes) {
        abytes5(bytes, 56);
        const { d, p: P } = ed448_CURVE;
        const mod5 = (n) => Fp448.create(n);
        const s = Fp448.fromBytes(bytes);
        if (!equalBytes3(Fn448.toBytes(s), bytes) || isNegativeLE(s, P))
          throw new Error("invalid decaf448 encoding 1");
        const s2 = mod5(s * s);
        const u1 = mod5(_1n11 + s2);
        const u1sq = mod5(u1 * u1);
        const u2 = mod5(u1sq - _4n2 * d * s2);
        const { isValid, value: invsqrt } = invertSqrt2(mod5(u2 * u1sq));
        let u3 = mod5((s + s) * invsqrt * u1 * SQRT_MINUS_D);
        if (isNegativeLE(u3, P))
          u3 = mod5(-u3);
        const x = mod5(u3 * invsqrt * u2 * INVSQRT_MINUS_D);
        const y = mod5((_1n11 - s2) * invsqrt * u1);
        const t = mod5(x * y);
        if (!isValid)
          throw new Error("invalid decaf448 encoding 2");
        return new __DecafPoint(new ed448_Point(x, y, _1n11, t));
      }
      /**
       * Converts decaf-encoded string to decaf point.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-decode-2).
       * @param hex Decaf-encoded 56 bytes. Not every 56-byte string is valid decaf encoding
       */
      static fromHex(hex) {
        return __DecafPoint.fromBytes(hexToBytes3(hex));
      }
      /**
       * Encodes decaf point to Uint8Array.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-encode-2).
       */
      toBytes() {
        const { X, Z, T } = this.ep;
        const P = ed448_CURVE.p;
        const mod5 = (n) => Fp448.create(n);
        const u1 = mod5(mod5(X + T) * mod5(X - T));
        const x2 = mod5(X * X);
        const { value: invsqrt } = invertSqrt2(mod5(u1 * ONE_MINUS_D * x2));
        let ratio = mod5(invsqrt * u1 * SQRT_MINUS_D);
        if (isNegativeLE(ratio, P))
          ratio = mod5(-ratio);
        const u2 = mod5(INVSQRT_MINUS_D * ratio * Z - T);
        let s = mod5(ONE_MINUS_D * invsqrt * X * u2);
        if (isNegativeLE(s, P))
          s = mod5(-s);
        return Fn448.toBytes(s);
      }
      /**
       * Compare one point to another.
       * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-equals-2).
       */
      equals(other) {
        this.assertSame(other);
        const { X: X1, Y: Y1 } = this.ep;
        const { X: X2, Y: Y2 } = other.ep;
        return Fp448.create(X1 * Y2) === Fp448.create(Y1 * X2);
      }
      is0() {
        return this.equals(__DecafPoint.ZERO);
      }
    };
    decaf448 = { Point: _DecafPoint };
    decaf448_hasher = {
      Point: _DecafPoint,
      hashToCurve(msg, options) {
        const DST = options?.DST || "decaf448_XOF:SHAKE256_D448MAP_RO_";
        return decaf448_hasher.deriveToCurve(expand_message_xof(msg, DST, 112, 224, shake2563));
      },
      /**
       * Warning: has big modulo bias of 2^-64.
       * RFC is invalid. RFC says "use 64-byte xof", while for 2^-112 bias
       * it must use 84-byte xof (56+56/2), not 64.
       */
      hashToScalar(msg, options = { DST: _DST_scalar }) {
        const xof = expand_message_xof(msg, options.DST, 64, 256, shake2563);
        return Fn448.create(bytesToNumberLE2(xof));
      },
      /**
       * HashToCurve-like construction based on RFC 9496 (Element Derivation).
       * Converts 112 uniform random bytes into a curve point.
       *
       * WARNING: This represents an older hash-to-curve construction, preceding the finalization of RFC 9380.
       * It was later reused as a component in the newer `hash_to_ristretto255` function defined in RFC 9380.
       */
      deriveToCurve(bytes) {
        abytes5(bytes, 112);
        const skipValidation = true;
        const r1 = Fp448.create(Fp448.fromBytes(bytes.subarray(0, 56), skipValidation));
        const R1 = calcElligatorDecafMap(r1);
        const r2 = Fp448.create(Fp448.fromBytes(bytes.subarray(56, 112), skipValidation));
        const R2 = calcElligatorDecafMap(r2);
        return new _DecafPoint(R1.add(R2));
      }
    };
    decaf448_oprf = /* @__PURE__ */ (() => createORPF({
      name: "decaf448-SHAKE256",
      Point: _DecafPoint,
      hash: (msg) => shake2563(msg, { dkLen: 64 }),
      hashToGroup: decaf448_hasher.hashToCurve,
      hashToScalar: decaf448_hasher.hashToScalar
    }))();
    ED448_TORSION_SUBGROUP = [
      "010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "fefffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffffffffffffffffffffffffffffffffffffffffffffffffff00",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080"
    ];
  }
});

// node_modules/@noble/curves/node_modules/@noble/hashes/hmac.js
var _HMAC2, hmac2;
var init_hmac2 = __esm({
  "node_modules/@noble/curves/node_modules/@noble/hashes/hmac.js"() {
    init_utils5();
    _HMAC2 = class {
      oHash;
      iHash;
      blockLen;
      outputLen;
      finished = false;
      destroyed = false;
      constructor(hash, key) {
        ahash2(hash);
        abytes5(key, void 0, "key");
        this.iHash = hash.create();
        if (typeof this.iHash.update !== "function")
          throw new Error("Expected instance of class which extends utils.Hash");
        this.blockLen = this.iHash.blockLen;
        this.outputLen = this.iHash.outputLen;
        const blockLen = this.blockLen;
        const pad = new Uint8Array(blockLen);
        pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54;
        this.iHash.update(pad);
        this.oHash = hash.create();
        for (let i = 0; i < pad.length; i++)
          pad[i] ^= 54 ^ 92;
        this.oHash.update(pad);
        clean5(pad);
      }
      update(buf) {
        aexists5(this);
        this.iHash.update(buf);
        return this;
      }
      digestInto(out) {
        aexists5(this);
        abytes5(out, this.outputLen, "output");
        this.finished = true;
        this.iHash.digestInto(out);
        this.oHash.update(out);
        this.oHash.digestInto(out);
        this.destroy();
      }
      digest() {
        const out = new Uint8Array(this.oHash.outputLen);
        this.digestInto(out);
        return out;
      }
      _cloneInto(to) {
        to ||= Object.create(Object.getPrototypeOf(this), {});
        const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
        to = to;
        to.finished = finished;
        to.destroyed = destroyed;
        to.blockLen = blockLen;
        to.outputLen = outputLen;
        to.oHash = oHash._cloneInto(to.oHash);
        to.iHash = iHash._cloneInto(to.iHash);
        return to;
      }
      clone() {
        return this._cloneInto();
      }
      destroy() {
        this.destroyed = true;
        this.oHash.destroy();
        this.iHash.destroy();
      }
    };
    hmac2 = (hash, key, message) => new _HMAC2(hash, key).update(message).digest();
    hmac2.create = (hash, key) => new _HMAC2(hash, key);
  }
});

// node_modules/@noble/curves/abstract/weierstrass.js
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n10;
  const k2neg = k2 < _0n10;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n12;
  if (k1 < _0n10 || k1 >= MAX_NUM || k2 < _0n10 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  abool3(optsn.lowS, "lowS");
  abool3(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const { Fp: Fp3, Fn: Fn3 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject2(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp3.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp3, Fn3);
  function assertCompressionIsSupported() {
    if (!Fp3.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp3.toBytes(x);
    abool3(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp3.isOdd(y);
      return concatBytes2(pprefix(hasEvenY), bx);
    } else {
      return concatBytes2(Uint8Array.of(4), bx, Fp3.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes5(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp3.fromBytes(tail);
      if (!Fp3.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp3.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp3.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp3.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp3.BYTES;
      const x = Fp3.fromBytes(tail.subarray(0, L));
      const y = Fp3.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes || pointToBytes;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp3.sqr(x);
    const x3 = Fp3.mul(x2, x);
    return Fp3.add(Fp3.add(x3, Fp3.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left2 = Fp3.sqr(y);
    const right2 = weierstrassEquation(x);
    return Fp3.eql(left2, right2);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp3.mul(Fp3.pow(CURVE.a, _3n5), _4n3);
  const _27b2 = Fp3.mul(Fp3.sqr(CURVE.b), BigInt(27));
  if (Fp3.is0(Fp3.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp3.isValid(n) || banZero && Fp3.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn3.ORDER);
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp3.eql(Z, Fp3.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp3.ONE : Fp3.inv(Z);
    const x = Fp3.mul(X, iz);
    const y = Fp3.mul(Y, iz);
    const zz = Fp3.mul(Z, iz);
    if (is0)
      return { x: Fp3.ZERO, y: Fp3.ZERO };
    if (!Fp3.eql(zz, Fp3.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp3.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp3.isValid(x) || !Fp3.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp3.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  class Point {
    // base / generator point
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp3.ONE);
    // zero / infinity / identity point
    static ZERO = new Point(Fp3.ZERO, Fp3.ONE, Fp3.ZERO);
    // 0, 1, 0
    // math field
    static Fp = Fp3;
    // scalar field
    static Fn = Fn3;
    X;
    Y;
    Z;
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp3.isValid(x) || !Fp3.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp3.is0(x) && Fp3.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp3.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes5(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(hexToBytes3(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n5);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp3.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp3.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp3.eql(Fp3.mul(X1, Z2), Fp3.mul(X2, Z1));
      const U2 = Fp3.eql(Fp3.mul(Y1, Z2), Fp3.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp3.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp3.mul(b, _3n5);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp3.ZERO, Y3 = Fp3.ZERO, Z3 = Fp3.ZERO;
      let t0 = Fp3.mul(X1, X1);
      let t1 = Fp3.mul(Y1, Y1);
      let t2 = Fp3.mul(Z1, Z1);
      let t3 = Fp3.mul(X1, Y1);
      t3 = Fp3.add(t3, t3);
      Z3 = Fp3.mul(X1, Z1);
      Z3 = Fp3.add(Z3, Z3);
      X3 = Fp3.mul(a, Z3);
      Y3 = Fp3.mul(b3, t2);
      Y3 = Fp3.add(X3, Y3);
      X3 = Fp3.sub(t1, Y3);
      Y3 = Fp3.add(t1, Y3);
      Y3 = Fp3.mul(X3, Y3);
      X3 = Fp3.mul(t3, X3);
      Z3 = Fp3.mul(b3, Z3);
      t2 = Fp3.mul(a, t2);
      t3 = Fp3.sub(t0, t2);
      t3 = Fp3.mul(a, t3);
      t3 = Fp3.add(t3, Z3);
      Z3 = Fp3.add(t0, t0);
      t0 = Fp3.add(Z3, t0);
      t0 = Fp3.add(t0, t2);
      t0 = Fp3.mul(t0, t3);
      Y3 = Fp3.add(Y3, t0);
      t2 = Fp3.mul(Y1, Z1);
      t2 = Fp3.add(t2, t2);
      t0 = Fp3.mul(t2, t3);
      X3 = Fp3.sub(X3, t0);
      Z3 = Fp3.mul(t2, t1);
      Z3 = Fp3.add(Z3, Z3);
      Z3 = Fp3.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp3.ZERO, Y3 = Fp3.ZERO, Z3 = Fp3.ZERO;
      const a = CURVE.a;
      const b3 = Fp3.mul(CURVE.b, _3n5);
      let t0 = Fp3.mul(X1, X2);
      let t1 = Fp3.mul(Y1, Y2);
      let t2 = Fp3.mul(Z1, Z2);
      let t3 = Fp3.add(X1, Y1);
      let t4 = Fp3.add(X2, Y2);
      t3 = Fp3.mul(t3, t4);
      t4 = Fp3.add(t0, t1);
      t3 = Fp3.sub(t3, t4);
      t4 = Fp3.add(X1, Z1);
      let t5 = Fp3.add(X2, Z2);
      t4 = Fp3.mul(t4, t5);
      t5 = Fp3.add(t0, t2);
      t4 = Fp3.sub(t4, t5);
      t5 = Fp3.add(Y1, Z1);
      X3 = Fp3.add(Y2, Z2);
      t5 = Fp3.mul(t5, X3);
      X3 = Fp3.add(t1, t2);
      t5 = Fp3.sub(t5, X3);
      Z3 = Fp3.mul(a, t4);
      X3 = Fp3.mul(b3, t2);
      Z3 = Fp3.add(X3, Z3);
      X3 = Fp3.sub(t1, Z3);
      Z3 = Fp3.add(t1, Z3);
      Y3 = Fp3.mul(X3, Z3);
      t1 = Fp3.add(t0, t0);
      t1 = Fp3.add(t1, t0);
      t2 = Fp3.mul(a, t2);
      t4 = Fp3.mul(b3, t4);
      t1 = Fp3.add(t1, t2);
      t2 = Fp3.sub(t0, t2);
      t2 = Fp3.mul(a, t2);
      t4 = Fp3.add(t4, t2);
      t0 = Fp3.mul(t1, t4);
      Y3 = Fp3.add(Y3, t0);
      t0 = Fp3.mul(t5, t4);
      X3 = Fp3.mul(t3, X3);
      X3 = Fp3.sub(X3, t0);
      t0 = Fp3.mul(t3, t1);
      Z3 = Fp3.mul(t5, Z3);
      Z3 = Fp3.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn3.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul3 = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul3(k1);
        const { p: k2p, f: k2f } = mul3(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul3(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn3.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n10 || p.is0())
        return Point.ZERO;
      if (sc === _1n12)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n12)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n12)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      abool3(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex3(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const bits = Fn3.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function SWUFpSqrtRatio(Fp3, Z) {
  const q = Fp3.ORDER;
  let l = _0n10;
  for (let o = q - _1n12; o % _2n10 === _0n10; o /= _2n10)
    l += _1n12;
  const c1 = l;
  const _2n_pow_c1_1 = _2n10 << c1 - _1n12 - _1n12;
  const _2n_pow_c1 = _2n_pow_c1_1 * _2n10;
  const c2 = (q - _1n12) / _2n_pow_c1;
  const c3 = (c2 - _1n12) / _2n10;
  const c4 = _2n_pow_c1 - _1n12;
  const c5 = _2n_pow_c1_1;
  const c6 = Fp3.pow(Z, c2);
  const c7 = Fp3.pow(Z, (c2 + _1n12) / _2n10);
  let sqrtRatio = (u, v) => {
    let tv1 = c6;
    let tv2 = Fp3.pow(v, c4);
    let tv3 = Fp3.sqr(tv2);
    tv3 = Fp3.mul(tv3, v);
    let tv5 = Fp3.mul(u, tv3);
    tv5 = Fp3.pow(tv5, c3);
    tv5 = Fp3.mul(tv5, tv2);
    tv2 = Fp3.mul(tv5, v);
    tv3 = Fp3.mul(tv5, u);
    let tv4 = Fp3.mul(tv3, tv2);
    tv5 = Fp3.pow(tv4, c5);
    let isQR = Fp3.eql(tv5, Fp3.ONE);
    tv2 = Fp3.mul(tv3, c7);
    tv5 = Fp3.mul(tv4, tv1);
    tv3 = Fp3.cmov(tv2, tv3, isQR);
    tv4 = Fp3.cmov(tv5, tv4, isQR);
    for (let i = c1; i > _1n12; i--) {
      let tv52 = i - _2n10;
      tv52 = _2n10 << tv52 - _1n12;
      let tvv5 = Fp3.pow(tv4, tv52);
      const e1 = Fp3.eql(tvv5, Fp3.ONE);
      tv2 = Fp3.mul(tv3, tv1);
      tv1 = Fp3.mul(tv1, tv1);
      tvv5 = Fp3.mul(tv4, tv1);
      tv3 = Fp3.cmov(tv2, tv3, e1);
      tv4 = Fp3.cmov(tvv5, tv4, e1);
    }
    return { isValid: isQR, value: tv3 };
  };
  if (Fp3.ORDER % _4n3 === _3n5) {
    const c12 = (Fp3.ORDER - _3n5) / _4n3;
    const c22 = Fp3.sqrt(Fp3.neg(Z));
    sqrtRatio = (u, v) => {
      let tv1 = Fp3.sqr(v);
      const tv2 = Fp3.mul(u, v);
      tv1 = Fp3.mul(tv1, tv2);
      let y1 = Fp3.pow(tv1, c12);
      y1 = Fp3.mul(y1, tv2);
      const y2 = Fp3.mul(y1, c22);
      const tv3 = Fp3.mul(Fp3.sqr(y1), v);
      const isQR = Fp3.eql(tv3, u);
      let y = Fp3.cmov(y2, y1, isQR);
      return { isValid: isQR, value: y };
    };
  }
  return sqrtRatio;
}
function mapToCurveSimpleSWU(Fp3, opts) {
  validateField(Fp3);
  const { A, B, Z } = opts;
  if (!Fp3.isValid(A) || !Fp3.isValid(B) || !Fp3.isValid(Z))
    throw new Error("mapToCurveSimpleSWU: invalid opts");
  const sqrtRatio = SWUFpSqrtRatio(Fp3, Z);
  if (!Fp3.isOdd)
    throw new Error("Field does not have .isOdd()");
  return (u) => {
    let tv1, tv2, tv3, tv4, tv5, tv6, x, y;
    tv1 = Fp3.sqr(u);
    tv1 = Fp3.mul(tv1, Z);
    tv2 = Fp3.sqr(tv1);
    tv2 = Fp3.add(tv2, tv1);
    tv3 = Fp3.add(tv2, Fp3.ONE);
    tv3 = Fp3.mul(tv3, B);
    tv4 = Fp3.cmov(Z, Fp3.neg(tv2), !Fp3.eql(tv2, Fp3.ZERO));
    tv4 = Fp3.mul(tv4, A);
    tv2 = Fp3.sqr(tv3);
    tv6 = Fp3.sqr(tv4);
    tv5 = Fp3.mul(tv6, A);
    tv2 = Fp3.add(tv2, tv5);
    tv2 = Fp3.mul(tv2, tv3);
    tv6 = Fp3.mul(tv6, tv4);
    tv5 = Fp3.mul(tv6, B);
    tv2 = Fp3.add(tv2, tv5);
    x = Fp3.mul(tv1, tv3);
    const { isValid, value } = sqrtRatio(tv2, tv6);
    y = Fp3.mul(tv1, u);
    y = Fp3.mul(y, value);
    x = Fp3.cmov(x, tv3, isValid);
    y = Fp3.cmov(y, value, isValid);
    const e1 = Fp3.isOdd(u) === Fp3.isOdd(y);
    y = Fp3.cmov(Fp3.neg(y), y, e1);
    const tv4_inv = FpInvertBatch(Fp3, [tv4], true)[0];
    x = Fp3.mul(x, tv4_inv);
    return { x, y };
  };
}
function getWLengths(Fp3, Fn3) {
  return {
    secretKey: Fn3.BYTES,
    publicKey: 1 + Fp3.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp3.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn3.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  const { Fn: Fn3 } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes2;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn3), { seed: getMinHashLength(Fn3.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn3.fromBytes(secretKey);
      return Fn3.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(abytes5(seed, lengths.seed, "seed"), Fn3.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn3.fromBytes(secretKey)).toBytes(isCompressed);
  }
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (!isBytes5(item))
      return void 0;
    if ("_lengths" in Fn3 && Fn3._lengths || secretKey === publicKey)
      return void 0;
    const l = abytes5(item, void 0, "key").length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = Fn3.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey
  };
  const keygen = createKeygen2(randomSecretKey, getPublicKey);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  ahash2(hash);
  validateObject2(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  ecdsaOpts = Object.assign({}, ecdsaOpts);
  const randomBytes5 = ecdsaOpts.randomBytes || randomBytes2;
  const hmac4 = ecdsaOpts.hmac || ((key, msg) => hmac2(hash, key, msg));
  const { Fp: Fp3, Fn: Fn3 } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn3;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : true,
    format: "compact",
    extraEntropy: false
  };
  const hasLargeCofactor = CURVE_ORDER * _2n10 < Fp3.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n12;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn3.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function assertSmallCofactor() {
    if (hasLargeCofactor)
      throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return abytes5(bytes, sizer);
  }
  class Signature {
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null) {
        assertSmallCofactor();
        if (![0, 1, 2, 3].includes(recovery))
          throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts.format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(abytes5(bytes));
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = lengths.signature / 2;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn3.fromBytes(r), Fn3.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes3(hex), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null)
        throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp3.isValid(radj))
        throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp3.toBytes(radj);
      const R = Point.fromBytes(concatBytes2(pprefix((recovery & 1) === 0), x));
      const ir = Fn3.inv(radj);
      const h = bits2int_modN(abytes5(messageHash, void 0, "msgHash"));
      const u1 = Fn3.create(-h * ir);
      const u2 = Fn3.create(s * ir);
      const Q3 = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q3.is0())
        throw new Error("invalid recovery: point at infinify");
      Q3.assertValidity();
      return Q3;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes3(DER.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn3.toBytes(r);
      const sb = Fn3.toBytes(s);
      if (format === "recovered") {
        assertSmallCofactor();
        return concatBytes2(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes2(rb, sb);
    }
    toHex(format) {
      return bytesToHex3(this.toBytes(format));
    }
  }
  const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
    return Fn3.create(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange2("num < 2^" + fnBits, num, _0n10, ORDER_MASK);
    return Fn3.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    abytes5(message, void 0, "message");
    return prehash ? abytes5(hash(message), void 0, "prehashed message") : message;
  }
  function prepSig(message, secretKey, opts) {
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = Fn3.fromBytes(secretKey);
    if (!Fn3.isValidNot0(d))
      throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes5(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes5(e, void 0, "extraEntropy"));
    }
    const seed = concatBytes2(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn3.isValidNot0(k))
        return;
      const ik = Fn3.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn3.create(q.x);
      if (r === _0n10)
        return;
      const s = Fn3.create(ik * Fn3.create(m + r * d));
      if (s === _0n10)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n12);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn3.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, hasLargeCofactor ? void 0 : recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn3.BYTES, hmac4);
    const sig = drbg(seed, k2sig);
    return sig.toBytes(opts.format);
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = abytes5(publicKey, void 0, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes5(signature)) {
      const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format);
    try {
      const sig = Signature.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn3.inv(s);
      const u1 = Fn3.create(h * is);
      const u2 = Fn3.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn3.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
var divNearest, DERErr, DER, _0n10, _1n12, _2n10, _3n5, _4n3;
var init_weierstrass = __esm({
  "node_modules/@noble/curves/abstract/weierstrass.js"() {
    init_hmac2();
    init_utils5();
    init_utils6();
    init_curve2();
    init_modular2();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n10) / den;
    DERErr = class extends Error {
      constructor(m = "") {
        super(m);
      }
    };
    DER = {
      // asn.1 DER encoding utils
      Err: DERErr,
      // Basic building block is TLV (Tag-Length-Value)
      _tlv: {
        encode: (tag, data) => {
          const { Err: E } = DER;
          if (tag < 0 || tag > 256)
            throw new E("tlv.encode: wrong tag");
          if (data.length & 1)
            throw new E("tlv.encode: unpadded data");
          const dataLen = data.length / 2;
          const len = numberToHexUnpadded(dataLen);
          if (len.length / 2 & 128)
            throw new E("tlv.encode: long form length too big");
          const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
          const t = numberToHexUnpadded(tag);
          return t + lenLen + len + data;
        },
        // v - value, l - left bytes (unparsed)
        decode(tag, data) {
          const { Err: E } = DER;
          let pos = 0;
          if (tag < 0 || tag > 256)
            throw new E("tlv.encode: wrong tag");
          if (data.length < 2 || data[pos++] !== tag)
            throw new E("tlv.decode: wrong tlv");
          const first = data[pos++];
          const isLong = !!(first & 128);
          let length = 0;
          if (!isLong)
            length = first;
          else {
            const lenLen = first & 127;
            if (!lenLen)
              throw new E("tlv.decode(long): indefinite length not supported");
            if (lenLen > 4)
              throw new E("tlv.decode(long): byte length is too big");
            const lengthBytes = data.subarray(pos, pos + lenLen);
            if (lengthBytes.length !== lenLen)
              throw new E("tlv.decode: length bytes not complete");
            if (lengthBytes[0] === 0)
              throw new E("tlv.decode(long): zero leftmost byte");
            for (const b of lengthBytes)
              length = length << 8 | b;
            pos += lenLen;
            if (length < 128)
              throw new E("tlv.decode(long): not minimal encoding");
          }
          const v = data.subarray(pos, pos + length);
          if (v.length !== length)
            throw new E("tlv.decode: wrong value length");
          return { v, l: data.subarray(pos + length) };
        }
      },
      // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
      // since we always use positive integers here. It must always be empty:
      // - add zero byte if exists
      // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
      _int: {
        encode(num) {
          const { Err: E } = DER;
          if (num < _0n10)
            throw new E("integer: negative integers are not allowed");
          let hex = numberToHexUnpadded(num);
          if (Number.parseInt(hex[0], 16) & 8)
            hex = "00" + hex;
          if (hex.length & 1)
            throw new E("unexpected DER parsing assertion: unpadded hex");
          return hex;
        },
        decode(data) {
          const { Err: E } = DER;
          if (data[0] & 128)
            throw new E("invalid signature integer: negative");
          if (data[0] === 0 && !(data[1] & 128))
            throw new E("invalid signature integer: unnecessary leading zero");
          return bytesToNumberBE(data);
        }
      },
      toSig(bytes) {
        const { Err: E, _int: int, _tlv: tlv } = DER;
        const data = abytes5(bytes, void 0, "signature");
        const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
        if (seqLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
        const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
        if (sLeftBytes.length)
          throw new E("invalid signature: left bytes after parsing");
        return { r: int.decode(rBytes), s: int.decode(sBytes) };
      },
      hexFromSig(sig) {
        const { _tlv: tlv, _int: int } = DER;
        const rs = tlv.encode(2, int.encode(sig.r));
        const ss = tlv.encode(2, int.encode(sig.s));
        const seq = rs + ss;
        return tlv.encode(48, seq);
      }
    };
    _0n10 = BigInt(0);
    _1n12 = BigInt(1);
    _2n10 = BigInt(2);
    _3n5 = BigInt(3);
    _4n3 = BigInt(4);
  }
});

// node_modules/@noble/curves/nist.js
var nist_exports = {};
__export(nist_exports, {
  p256: () => p256,
  p256_hasher: () => p256_hasher,
  p256_oprf: () => p256_oprf,
  p384: () => p384,
  p384_hasher: () => p384_hasher,
  p384_oprf: () => p384_oprf,
  p521: () => p521,
  p521_hasher: () => p521_hasher,
  p521_oprf: () => p521_oprf
});
function createSWU(Point, opts) {
  const map = mapToCurveSimpleSWU(Point.Fp, opts);
  return (scalars) => map(scalars[0]);
}
var p256_CURVE, p384_CURVE, p521_CURVE, p256_Point, p256, p256_hasher, p256_oprf, p384_Point, p384, p384_hasher, p384_oprf, Fn521, p521_Point, p521, p521_hasher, p521_oprf;
var init_nist = __esm({
  "node_modules/@noble/curves/nist.js"() {
    init_sha22();
    init_hash_to_curve();
    init_modular2();
    init_oprf();
    init_weierstrass();
    /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    p256_CURVE = /* @__PURE__ */ (() => ({
      p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
      n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
      h: BigInt(1),
      a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
      b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
      Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
      Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
    }))();
    p384_CURVE = /* @__PURE__ */ (() => ({
      p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff"),
      n: BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973"),
      h: BigInt(1),
      a: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc"),
      b: BigInt("0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef"),
      Gx: BigInt("0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7"),
      Gy: BigInt("0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f")
    }))();
    p521_CURVE = /* @__PURE__ */ (() => ({
      p: BigInt("0x1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
      n: BigInt("0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409"),
      h: BigInt(1),
      a: BigInt("0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc"),
      b: BigInt("0x0051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00"),
      Gx: BigInt("0x00c6858e06b70404e9cd9e3ecb662395b4429c648139053fb521f828af606b4d3dbaa14b5e77efe75928fe1dc127a2ffa8de3348b3c1856a429bf97e7e31c2e5bd66"),
      Gy: BigInt("0x011839296a789a3bc0045c8a5fb42c7d1bd998f54449579b446817afbd17273e662c97ee72995ef42640c550b9013fad0761353c7086a272c24088be94769fd16650")
    }))();
    p256_Point = /* @__PURE__ */ weierstrass(p256_CURVE);
    p256 = /* @__PURE__ */ ecdsa(p256_Point, sha2562);
    p256_hasher = /* @__PURE__ */ (() => {
      return createHasher4(p256_Point, createSWU(p256_Point, {
        A: p256_CURVE.a,
        B: p256_CURVE.b,
        Z: p256_Point.Fp.create(BigInt("-10"))
      }), {
        DST: "P256_XMD:SHA-256_SSWU_RO_",
        encodeDST: "P256_XMD:SHA-256_SSWU_NU_",
        p: p256_CURVE.p,
        m: 1,
        k: 128,
        expand: "xmd",
        hash: sha2562
      });
    })();
    p256_oprf = /* @__PURE__ */ (() => createORPF({
      name: "P256-SHA256",
      Point: p256_Point,
      hash: sha2562,
      hashToGroup: p256_hasher.hashToCurve,
      hashToScalar: p256_hasher.hashToScalar
    }))();
    p384_Point = /* @__PURE__ */ weierstrass(p384_CURVE);
    p384 = /* @__PURE__ */ ecdsa(p384_Point, sha3842);
    p384_hasher = /* @__PURE__ */ (() => {
      return createHasher4(p384_Point, createSWU(p384_Point, {
        A: p384_CURVE.a,
        B: p384_CURVE.b,
        Z: p384_Point.Fp.create(BigInt("-12"))
      }), {
        DST: "P384_XMD:SHA-384_SSWU_RO_",
        encodeDST: "P384_XMD:SHA-384_SSWU_NU_",
        p: p384_CURVE.p,
        m: 1,
        k: 192,
        expand: "xmd",
        hash: sha3842
      });
    })();
    p384_oprf = /* @__PURE__ */ (() => createORPF({
      name: "P384-SHA384",
      Point: p384_Point,
      hash: sha3842,
      hashToGroup: p384_hasher.hashToCurve,
      hashToScalar: p384_hasher.hashToScalar
    }))();
    Fn521 = /* @__PURE__ */ (() => Field(p521_CURVE.n, { allowedLengths: [65, 66] }))();
    p521_Point = /* @__PURE__ */ weierstrass(p521_CURVE, { Fn: Fn521 });
    p521 = /* @__PURE__ */ ecdsa(p521_Point, sha5122);
    p521_hasher = /* @__PURE__ */ (() => {
      return createHasher4(p521_Point, createSWU(p521_Point, {
        A: p521_CURVE.a,
        B: p521_CURVE.b,
        Z: p521_Point.Fp.create(BigInt("-4"))
      }), {
        DST: "P521_XMD:SHA-512_SSWU_RO_",
        encodeDST: "P521_XMD:SHA-512_SSWU_NU_",
        p: p521_CURVE.p,
        m: 1,
        k: 256,
        expand: "xmd",
        hash: sha5122
      });
    })();
    p521_oprf = /* @__PURE__ */ (() => createORPF({
      name: "P521-SHA512",
      Point: p521_Point,
      hash: sha5122,
      hashToGroup: p521_hasher.hashToCurve,
      hashToScalar: p521_hasher.hashToScalar
      // produces L=98 just like in RFC
    }))();
  }
});

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/_u64.js
function fromBig4(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK644), l: Number(n >> _32n4 & U32_MASK644) };
  return { h: Number(n >> _32n4 & U32_MASK644) | 0, l: Number(n & U32_MASK644) | 0 };
}
function split4(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig4(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var U32_MASK644, _32n4, rotlSH4, rotlSL4, rotlBH4, rotlBL4;
var init_u644 = __esm({
  "node_modules/@noble/post-quantum/node_modules/@noble/hashes/_u64.js"() {
    U32_MASK644 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    _32n4 = /* @__PURE__ */ BigInt(32);
    rotlSH4 = (h, l, s) => h << s | l >>> 32 - s;
    rotlSL4 = (h, l, s) => l << s | h >>> 32 - s;
    rotlBH4 = (h, l, s) => l << s - 32 | h >>> 64 - s;
    rotlBL4 = (h, l, s) => h << s - 32 | l >>> 64 - s;
  }
});

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/utils.js
function isBytes6(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber6(n, title = "") {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new Error(`${prefix}expected integer >= 0, got ${n}`);
  }
}
function abytes6(value, length, title = "") {
  const bytes = isBytes6(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists6(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput6(out, instance) {
  abytes6(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function u326(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean6(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function byteSwap3(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap323(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap3(arr[i]);
  }
  return arr;
}
function concatBytes3(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes6(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function createHasher5(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes3(bytesLength = 32) {
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var isLE6, swap32IfBE4, oidNist4;
var init_utils7 = __esm({
  "node_modules/@noble/post-quantum/node_modules/@noble/hashes/utils.js"() {
    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    isLE6 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    swap32IfBE4 = isLE6 ? (u) => u : byteSwap323;
    oidNist4 = (suffix) => ({
      oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
    });
  }
});

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/sha3.js
function keccakP3(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH3(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL3(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL4[t];
      const Th = rotlH3(curH, curL, shift);
      const Tl = rotlL3(curH, curL, shift);
      const PI = SHA3_PI4[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H4[round];
    s[1] ^= SHA3_IOTA_L4[round];
  }
  clean6(B);
}
var _0n11, _1n13, _2n11, _7n5, _256n4, _0x71n4, SHA3_PI4, SHA3_ROTL4, _SHA3_IOTA4, IOTAS4, SHA3_IOTA_H4, SHA3_IOTA_L4, rotlH3, rotlL3, Keccak3, genShake3, shake1283, shake2564;
var init_sha34 = __esm({
  "node_modules/@noble/post-quantum/node_modules/@noble/hashes/sha3.js"() {
    init_u644();
    init_utils7();
    _0n11 = BigInt(0);
    _1n13 = BigInt(1);
    _2n11 = BigInt(2);
    _7n5 = BigInt(7);
    _256n4 = BigInt(256);
    _0x71n4 = BigInt(113);
    SHA3_PI4 = [];
    SHA3_ROTL4 = [];
    _SHA3_IOTA4 = [];
    for (let round = 0, R = _1n13, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI4.push(2 * (5 * y + x));
      SHA3_ROTL4.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n11;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n13 ^ (R >> _7n5) * _0x71n4) % _256n4;
        if (R & _2n11)
          t ^= _1n13 << (_1n13 << BigInt(j)) - _1n13;
      }
      _SHA3_IOTA4.push(t);
    }
    IOTAS4 = split4(_SHA3_IOTA4, true);
    SHA3_IOTA_H4 = IOTAS4[0];
    SHA3_IOTA_L4 = IOTAS4[1];
    rotlH3 = (h, l, s) => s > 32 ? rotlBH4(h, l, s) : rotlSH4(h, l, s);
    rotlL3 = (h, l, s) => s > 32 ? rotlBL4(h, l, s) : rotlSL4(h, l, s);
    Keccak3 = class _Keccak {
      state;
      pos = 0;
      posOut = 0;
      finished = false;
      state32;
      destroyed = false;
      blockLen;
      suffix;
      outputLen;
      enableXOF = false;
      rounds;
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        anumber6(outputLen, "outputLen");
        if (!(0 < blockLen && blockLen < 200))
          throw new Error("only keccak-f1600 function is supported");
        this.state = new Uint8Array(200);
        this.state32 = u326(this.state);
      }
      clone() {
        return this._cloneInto();
      }
      keccak() {
        swap32IfBE4(this.state32);
        keccakP3(this.state32, this.rounds);
        swap32IfBE4(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists6(this);
        abytes6(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists6(this, false);
        abytes6(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF)
          throw new Error("XOF is not possible for this instance");
        return this.writeInto(out);
      }
      xof(bytes) {
        anumber6(bytes);
        return this.xofInto(new Uint8Array(bytes));
      }
      digestInto(out) {
        aoutput6(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out);
        this.destroy();
        return out;
      }
      digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
      }
      destroy() {
        this.destroyed = true;
        clean6(this.state);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    genShake3 = (suffix, blockLen, outputLen, info = {}) => createHasher5((opts = {}) => new Keccak3(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true), info);
    shake1283 = /* @__PURE__ */ genShake3(31, 168, 16, /* @__PURE__ */ oidNist4(11));
    shake2564 = /* @__PURE__ */ genShake3(31, 136, 32, /* @__PURE__ */ oidNist4(12));
  }
});

// node_modules/@noble/curves/abstract/fft.js
function checkU32(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
    throw new Error("wrong u32 integer:" + n);
  return n;
}
function isPowerOfTwo(x) {
  checkU32(x);
  return (x & x - 1) === 0 && x !== 0;
}
function reverseBits(n, bits) {
  checkU32(n);
  let reversed = 0;
  for (let i = 0; i < bits; i++, n >>>= 1)
    reversed = reversed << 1 | n & 1;
  return reversed;
}
function log22(n) {
  checkU32(n);
  return 31 - Math.clz32(n);
}
function bitReversalInplace(values) {
  const n = values.length;
  if (n < 2 || !isPowerOfTwo(n))
    throw new Error("n must be a power of 2 and greater than 1. Got " + n);
  const bits = log22(n);
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, bits);
    if (i < j) {
      const tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
  }
  return values;
}
var FFTCore;
var init_fft = __esm({
  "node_modules/@noble/curves/abstract/fft.js"() {
    FFTCore = (F2, coreOpts) => {
      const { N: N3, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
      const bits = log22(N3);
      if (!isPowerOfTwo(N3))
        throw new Error("FFT: Polynomial size should be power of two");
      const isDit = dit !== invertButterflies;
      isDit;
      return (values) => {
        if (values.length !== N3)
          throw new Error("FFT: wrong Polynomial length");
        if (dit && brp)
          bitReversalInplace(values);
        for (let i = 0, g = 1; i < bits - skipStages; i++) {
          const s = dit ? i + 1 + skipStages : bits - i;
          const m = 1 << s;
          const m2 = m >> 1;
          const stride = N3 >> s;
          for (let k = 0; k < N3; k += m) {
            for (let j = 0, grp = g++; j < m2; j++) {
              const rootPos = invertButterflies ? dit ? N3 - grp : grp : j * stride;
              const i0 = k + j;
              const i1 = k + j + m2;
              const omega = roots[rootPos];
              const b = values[i1];
              const a = values[i0];
              if (isDit) {
                const t = F2.mul(b, omega);
                values[i0] = F2.add(a, t);
                values[i1] = F2.sub(a, t);
              } else if (invertButterflies) {
                values[i0] = F2.add(b, a);
                values[i1] = F2.mul(F2.sub(b, a), omega);
              } else {
                values[i0] = F2.add(a, b);
                values[i1] = F2.mul(F2.sub(a, b), omega);
              }
            }
          }
        }
        if (!dit && brp)
          bitReversalInplace(values);
        return values;
      };
    };
  }
});

// node_modules/@noble/post-quantum/utils.js
function equalBytes4(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function validateOpts3(opts) {
  if (typeof opts !== "object" || opts === null || isBytes6(opts))
    throw new Error("expected opts to be an object");
}
function validateVerOpts(opts) {
  validateOpts3(opts);
  if (opts.context !== void 0)
    abytes6(opts.context, void 0, "opts.context");
}
function validateSigOpts2(opts) {
  validateVerOpts(opts);
  if (opts.extraEntropy !== false && opts.extraEntropy !== void 0)
    abytes6(opts.extraEntropy, void 0, "opts.extraEntropy");
}
function splitCoder(label, ...lengths) {
  const getLength = (c) => typeof c === "number" ? c : c.bytesLen;
  const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
  return {
    bytesLen,
    encode: (bufs) => {
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < lengths.length; i++) {
        const c = lengths[i];
        const l = getLength(c);
        const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
        abytes6(b, l, label);
        res.set(b, pos);
        if (typeof c !== "number")
          b.fill(0);
        pos += l;
      }
      return res;
    },
    decode: (buf) => {
      abytes6(buf, bytesLen, label);
      const res = [];
      for (const c of lengths) {
        const l = getLength(c);
        const b = buf.subarray(0, l);
        res.push(typeof c === "number" ? b : c.decode(b));
        buf = buf.subarray(l);
      }
      return res;
    }
  };
}
function vecCoder(c, vecLen) {
  const bytesLen = vecLen * c.bytesLen;
  return {
    bytesLen,
    encode: (u) => {
      if (u.length !== vecLen)
        throw new Error(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < u.length; i++) {
        const b = c.encode(u[i]);
        res.set(b, pos);
        b.fill(0);
        pos += b.length;
      }
      return res;
    },
    decode: (a) => {
      abytes6(a, bytesLen);
      const r = [];
      for (let i = 0; i < a.length; i += c.bytesLen)
        r.push(c.decode(a.subarray(i, i + c.bytesLen)));
      return r;
    }
  };
}
function cleanBytes(...list) {
  for (const t of list) {
    if (Array.isArray(t))
      for (const b of t)
        b.fill(0);
    else
      t.fill(0);
  }
}
function getMask(bits) {
  return (1 << bits) - 1;
}
function getMessage(msg, ctx = EMPTY2) {
  abytes6(msg);
  abytes6(ctx);
  if (ctx.length > 255)
    throw new Error("context should be less than 255 bytes");
  return concatBytes3(new Uint8Array([0, ctx.length]), ctx, msg);
}
function checkHash(hash, requiredStrength = 0) {
  if (!hash.oid || !equalBytes4(hash.oid.subarray(0, 10), oidNistP))
    throw new Error("hash.oid is invalid: expected NIST hash");
  const collisionResistance = hash.outputLen * 8 / 2;
  if (requiredStrength > collisionResistance) {
    throw new Error("Pre-hash security strength too low: " + collisionResistance + ", required: " + requiredStrength);
  }
}
function getMessagePrehash(hash, msg, ctx = EMPTY2) {
  abytes6(msg);
  abytes6(ctx);
  if (ctx.length > 255)
    throw new Error("context should be less than 255 bytes");
  const hashed = hash(msg);
  return concatBytes3(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
}
var randomBytes4, EMPTY2, oidNistP;
var init_utils8 = __esm({
  "node_modules/@noble/post-quantum/utils.js"() {
    init_utils7();
    init_utils7();
    /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
    randomBytes4 = randomBytes3;
    EMPTY2 = Uint8Array.of();
    oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2]);
  }
});

// node_modules/@noble/post-quantum/_crystals.js
var genCrystals, createXofShake, XOF128, XOF256;
var init_crystals = __esm({
  "node_modules/@noble/post-quantum/_crystals.js"() {
    init_fft();
    init_sha34();
    init_utils8();
    /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
    genCrystals = (opts) => {
      const { newPoly: newPoly2, N: N3, Q: Q3, F: F2, ROOT_OF_UNITY: ROOT_OF_UNITY2, brvBits, isKyber } = opts;
      const mod5 = (a, modulo = Q3) => {
        const result = a % modulo | 0;
        return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
      };
      const smod2 = (a, modulo = Q3) => {
        const r = mod5(a, modulo) | 0;
        return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
      };
      function getZettas() {
        const out = newPoly2(N3);
        for (let i = 0; i < N3; i++) {
          const b = reverseBits(i, brvBits);
          const p = BigInt(ROOT_OF_UNITY2) ** BigInt(b) % BigInt(Q3);
          out[i] = Number(p) | 0;
        }
        return out;
      }
      const nttZetas = getZettas();
      const field = {
        add: (a, b) => mod5((a | 0) + (b | 0)) | 0,
        sub: (a, b) => mod5((a | 0) - (b | 0)) | 0,
        mul: (a, b) => mod5((a | 0) * (b | 0)) | 0,
        inv: (_a) => {
          throw new Error("not implemented");
        }
      };
      const nttOpts = {
        N: N3,
        roots: nttZetas,
        invertButterflies: true,
        skipStages: isKyber ? 1 : 0,
        brp: false
      };
      const dif = FFTCore(field, { dit: false, ...nttOpts });
      const dit = FFTCore(field, { dit: true, ...nttOpts });
      const NTT2 = {
        encode: (r) => {
          return dif(r);
        },
        decode: (r) => {
          dit(r);
          for (let i = 0; i < r.length; i++)
            r[i] = mod5(F2 * r[i]);
          return r;
        }
      };
      const bitsCoder2 = (d, c) => {
        const mask = getMask(d);
        const bytesLen = d * (N3 / 8);
        return {
          bytesLen,
          encode: (poly) => {
            const r = new Uint8Array(bytesLen);
            for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
              buf |= (c.encode(poly[i]) & mask) << bufLen;
              bufLen += d;
              for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
                r[pos++] = buf & getMask(bufLen);
            }
            return r;
          },
          decode: (bytes) => {
            const r = newPoly2(N3);
            for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
              buf |= bytes[i] << bufLen;
              bufLen += 8;
              for (; bufLen >= d; bufLen -= d, buf >>= d)
                r[pos++] = c.decode(buf & mask);
            }
            return r;
          }
        };
      };
      return { mod: mod5, smod: smod2, nttZetas, NTT: NTT2, bitsCoder: bitsCoder2 };
    };
    createXofShake = (shake) => (seed, blockLen) => {
      if (!blockLen)
        blockLen = shake.blockLen;
      const _seed = new Uint8Array(seed.length + 2);
      _seed.set(seed);
      const seedLen = seed.length;
      const buf = new Uint8Array(blockLen);
      let h = shake.create({});
      let calls = 0;
      let xofs = 0;
      return {
        stats: () => ({ calls, xofs }),
        get: (x, y) => {
          _seed[seedLen + 0] = x;
          _seed[seedLen + 1] = y;
          h.destroy();
          h = shake.create({}).update(_seed);
          calls++;
          return () => {
            xofs++;
            return h.xofInto(buf);
          };
        },
        clean: () => {
          h.destroy();
          cleanBytes(buf, _seed);
        }
      };
    };
    XOF128 = /* @__PURE__ */ createXofShake(shake1283);
    XOF256 = /* @__PURE__ */ createXofShake(shake2564);
  }
});

// node_modules/@noble/post-quantum/ml-dsa.js
var ml_dsa_exports = {};
__export(ml_dsa_exports, {
  PARAMS: () => PARAMS,
  ml_dsa44: () => ml_dsa44,
  ml_dsa65: () => ml_dsa65,
  ml_dsa87: () => ml_dsa87
});
function validateInternalOpts(opts) {
  validateOpts3(opts);
  if (opts.externalMu !== void 0)
    abool3(opts.externalMu, "opts.externalMu");
}
function RejNTTPoly(xof) {
  const r = newPoly(N2);
  for (let j = 0; j < N2; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("RejNTTPoly: unaligned block");
    for (let i = 0; j < N2 && i <= b.length - 3; i += 3) {
      const t = (b[i + 0] | b[i + 1] << 8 | b[i + 2] << 16) & 8388607;
      if (t < Q2)
        r[j++] = t;
    }
  }
  return r;
}
function getDilithium(opts) {
  const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts;
  const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128: XOF1282, XOF256: XOF2562, securityLevel } = opts;
  if (![2, 4].includes(ETA))
    throw new Error("Wrong ETA");
  if (![1 << 17, 1 << 19].includes(GAMMA1))
    throw new Error("Wrong GAMMA1");
  if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
    throw new Error("Wrong GAMMA2");
  const BETA = TAU * ETA;
  const decompose = (r) => {
    const rPlus = mod4(r);
    const r0 = smod(rPlus, 2 * GAMMA2) | 0;
    if (rPlus - r0 === Q2 - 1)
      return { r1: 0 | 0, r0: r0 - 1 | 0 };
    const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
    return { r1, r0 };
  };
  const HighBits = (r) => decompose(r).r1;
  const LowBits = (r) => decompose(r).r0;
  const MakeHint = (z, r) => {
    const res0 = z <= GAMMA2 || z > Q2 - GAMMA2 || z === Q2 - GAMMA2 && r === 0 ? 0 : 1;
    return res0;
  };
  const UseHint = (h, r) => {
    const m = Math.floor((Q2 - 1) / (2 * GAMMA2));
    const { r1, r0 } = decompose(r);
    if (h === 1)
      return r0 > 0 ? mod4(r1 + 1, m) | 0 : mod4(r1 - 1, m) | 0;
    return r1 | 0;
  };
  const Power2Round = (r) => {
    const rPlus = mod4(r);
    const r0 = smod(rPlus, 2 ** D) | 0;
    return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
  };
  const hintCoder = {
    bytesLen: OMEGA + K,
    encode: (h) => {
      if (h === false)
        throw new Error("hint.encode: hint is false");
      const res = new Uint8Array(OMEGA + K);
      for (let i = 0, k = 0; i < K; i++) {
        for (let j = 0; j < N2; j++)
          if (h[i][j] !== 0)
            res[k++] = j;
        res[OMEGA + i] = k;
      }
      return res;
    },
    decode: (buf) => {
      const h = [];
      let k = 0;
      for (let i = 0; i < K; i++) {
        const hi = newPoly(N2);
        if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
          return false;
        for (let j = k; j < buf[OMEGA + i]; j++) {
          if (j > k && buf[j] <= buf[j - 1])
            return false;
          hi[buf[j]] = 1;
        }
        k = buf[OMEGA + i];
        h.push(hi);
      }
      for (let j = k; j < OMEGA; j++)
        if (buf[j] !== 0)
          return false;
      return h;
    }
  };
  const ETACoder = polyCoder(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
    if (!(-ETA <= i && i <= ETA))
      throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
    return i;
  });
  const T0Coder = polyCoder(13, (i) => (1 << D - 1) - i);
  const T1Coder = polyCoder(10);
  const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => smod(GAMMA1 - i));
  const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
  const W1Vec = vecCoder(W1Coder, K);
  const publicCoder = splitCoder("publicKey", 32, vecCoder(T1Coder, K));
  const secretCoder = splitCoder("secretKey", 32, 32, TR_BYTES, vecCoder(ETACoder, L), vecCoder(ETACoder, K), vecCoder(T0Coder, K));
  const sigCoder = splitCoder("signature", C_TILDE_BYTES, vecCoder(ZCoder, L), hintCoder);
  const CoefFromHalfByte = ETA === 2 ? (n) => n < 15 ? 2 - n % 5 : false : (n) => n < 9 ? 4 - n : false;
  function RejBoundedPoly(xof) {
    const r = newPoly(N2);
    for (let j = 0; j < N2; ) {
      const b = xof();
      for (let i = 0; j < N2 && i < b.length; i += 1) {
        const d1 = CoefFromHalfByte(b[i] & 15);
        const d2 = CoefFromHalfByte(b[i] >> 4 & 15);
        if (d1 !== false)
          r[j++] = d1;
        if (j < N2 && d2 !== false)
          r[j++] = d2;
      }
    }
    return r;
  }
  const SampleInBall = (seed) => {
    const pre = newPoly(N2);
    const s = shake2564.create({}).update(seed);
    const buf = new Uint8Array(shake2564.blockLen);
    s.xofInto(buf);
    const masks = buf.slice(0, 8);
    for (let i = N2 - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N2; i++) {
      let b = i + 1;
      for (; b > i; ) {
        b = buf[pos++];
        if (pos < shake2564.blockLen)
          continue;
        s.xofInto(buf);
        pos = 0;
      }
      pre[i] = pre[b];
      pre[b] = 1 - ((masks[maskPos] >> maskBit++ & 1) << 1);
      if (maskBit >= 8) {
        maskPos++;
        maskBit = 0;
      }
    }
    return pre;
  };
  const polyPowerRound = (p) => {
    const res0 = newPoly(N2);
    const res1 = newPoly(N2);
    for (let i = 0; i < p.length; i++) {
      const { r0, r1 } = Power2Round(p[i]);
      res0[i] = r0;
      res1[i] = r1;
    }
    return { r0: res0, r1: res1 };
  };
  const polyUseHint = (u, h) => {
    for (let i = 0; i < N2; i++)
      u[i] = UseHint(h[i], u[i]);
    return u;
  };
  const polyMakeHint = (a, b) => {
    const v = newPoly(N2);
    let cnt = 0;
    for (let i = 0; i < N2; i++) {
      const h = MakeHint(a[i], b[i]);
      v[i] = h;
      cnt += h;
    }
    return { v, cnt };
  };
  const signRandBytes = 32;
  const seedCoder = splitCoder("seed", 32, 64, 32);
  const internal = {
    info: { type: "internal-ml-dsa" },
    lengths: {
      secretKey: secretCoder.bytesLen,
      publicKey: publicCoder.bytesLen,
      seed: 32,
      signature: sigCoder.bytesLen,
      signRand: signRandBytes
    },
    keygen: (seed) => {
      const seedDst = new Uint8Array(32 + 2);
      const randSeed = seed === void 0;
      if (randSeed)
        seed = randomBytes4(32);
      abytes6(seed, 32, "seed");
      seedDst.set(seed);
      if (randSeed)
        cleanBytes(seed);
      seedDst[32] = K;
      seedDst[33] = L;
      const [rho, rhoPrime, K_] = seedCoder.decode(shake2564(seedDst, { dkLen: seedCoder.bytesLen }));
      const xofPrime = XOF2562(rhoPrime);
      const s1 = [];
      for (let i = 0; i < L; i++)
        s1.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s2 = [];
      for (let i = L; i < L + K; i++)
        s2.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s1Hat = s1.map((i) => NTT.encode(i.slice()));
      const t0 = [];
      const t1 = [];
      const xof = XOF1282(rho);
      const t = newPoly(N2);
      for (let i = 0; i < K; i++) {
        cleanBytes(t);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
        }
        NTT.decode(t);
        const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i]));
        t0.push(r0);
        t1.push(r1);
      }
      const publicKey = publicCoder.encode([rho, t1]);
      const tr = shake2564(publicKey, { dkLen: TR_BYTES });
      const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
      xof.clean();
      xofPrime.clean();
      cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
      return { publicKey, secretKey };
    },
    getPublicKey: (secretKey) => {
      const [rho, _K, _tr, s1, s2, _t0] = secretCoder.decode(secretKey);
      const xof = XOF1282(rho);
      const s1Hat = s1.map((p) => NTT.encode(p.slice()));
      const t1 = [];
      const tmp = newPoly(N2);
      for (let i = 0; i < K; i++) {
        tmp.fill(0);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(tmp, MultiplyNTTs(aij, s1Hat[j]));
        }
        NTT.decode(tmp);
        polyAdd(tmp, s2[i]);
        const { r1 } = polyPowerRound(tmp);
        t1.push(r1);
      }
      xof.clean();
      cleanBytes(tmp, s1Hat, _t0, s1, s2);
      return publicCoder.encode([rho, t1]);
    },
    // NOTE: random is optional.
    sign: (msg, secretKey, opts2 = {}) => {
      validateSigOpts2(opts2);
      validateInternalOpts(opts2);
      let { extraEntropy: random, externalMu = false } = opts2;
      const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey);
      const A = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K; i++) {
        const pv = [];
        for (let j = 0; j < L; j++)
          pv.push(RejNTTPoly(xof.get(j, i)));
        A.push(pv);
      }
      xof.clean();
      for (let i = 0; i < L; i++)
        NTT.encode(s1[i]);
      for (let i = 0; i < K; i++) {
        NTT.encode(s2[i]);
        NTT.encode(t0[i]);
      }
      const mu = externalMu ? msg : shake2564.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest();
      const rnd = random === false ? new Uint8Array(32) : random === void 0 ? randomBytes4(signRandBytes) : random;
      abytes6(rnd, 32, "extraEntropy");
      const rhoprime = shake2564.create({ dkLen: CRH_BYTES }).update(_K).update(rnd).update(mu).digest();
      abytes6(rhoprime, CRH_BYTES);
      const x256 = XOF2562(rhoprime, ZCoder.bytesLen);
      main_loop: for (let kappa = 0; ; ) {
        const y = [];
        for (let i = 0; i < L; i++, kappa++)
          y.push(ZCoder.decode(x256.get(kappa & 255, kappa >> 8)()));
        const z = y.map((i) => NTT.encode(i.slice()));
        const w = [];
        for (let i = 0; i < K; i++) {
          const wi = newPoly(N2);
          for (let j = 0; j < L; j++)
            polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
          NTT.decode(wi);
          w.push(wi);
        }
        const w1 = w.map((j) => j.map(HighBits));
        const cTilde = shake2564.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(w1)).digest();
        const cHat = NTT.encode(SampleInBall(cTilde));
        const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
        for (let i = 0; i < L; i++) {
          polyAdd(NTT.decode(cs1[i]), y[i]);
          if (polyChknorm(cs1[i], GAMMA1 - BETA))
            continue main_loop;
        }
        let cnt = 0;
        const h = [];
        for (let i = 0; i < K; i++) {
          const cs2 = NTT.decode(MultiplyNTTs(s2[i], cHat));
          const r0 = polySub(w[i], cs2).map(LowBits);
          if (polyChknorm(r0, GAMMA2 - BETA))
            continue main_loop;
          const ct0 = NTT.decode(MultiplyNTTs(t0[i], cHat));
          if (polyChknorm(ct0, GAMMA2))
            continue main_loop;
          polyAdd(r0, ct0);
          const hint = polyMakeHint(r0, w1[i]);
          h.push(hint.v);
          cnt += hint.cnt;
        }
        if (cnt > OMEGA)
          continue;
        x256.clean();
        const res = sigCoder.encode([cTilde, cs1, h]);
        cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, mu, s1, s2, t0, ...A);
        return res;
      }
      throw new Error("Unreachable code path reached, report this error");
    },
    verify: (sig, msg, publicKey, opts2 = {}) => {
      validateInternalOpts(opts2);
      const { externalMu = false } = opts2;
      const [rho, t1] = publicCoder.decode(publicKey);
      const tr = shake2564(publicKey, { dkLen: TR_BYTES });
      if (sig.length !== sigCoder.bytesLen)
        return false;
      const [cTilde, z, h] = sigCoder.decode(sig);
      if (h === false)
        return false;
      for (let i = 0; i < L; i++)
        if (polyChknorm(z[i], GAMMA1 - BETA))
          return false;
      const mu = externalMu ? msg : shake2564.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest();
      const c = NTT.encode(SampleInBall(cTilde));
      const zNtt = z.map((i) => i.slice());
      for (let i = 0; i < L; i++)
        NTT.encode(zNtt[i]);
      const wTick1 = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K; i++) {
        const ct12d = MultiplyNTTs(NTT.encode(polyShiftl(t1[i])), c);
        const Az = newPoly(N2);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
        }
        const wApprox = NTT.decode(polySub(Az, ct12d));
        wTick1.push(polyUseHint(wApprox, h[i]));
      }
      xof.clean();
      const c2 = shake2564.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(wTick1)).digest();
      for (const t of h) {
        const sum = t.reduce((acc, i) => acc + i, 0);
        if (!(sum <= OMEGA))
          return false;
      }
      for (const t of z)
        if (polyChknorm(t, GAMMA1 - BETA))
          return false;
      return equalBytes4(cTilde, c2);
    }
  };
  return {
    info: { type: "ml-dsa" },
    internal,
    securityLevel,
    keygen: internal.keygen,
    lengths: internal.lengths,
    getPublicKey: internal.getPublicKey,
    sign: (msg, secretKey, opts2 = {}) => {
      validateSigOpts2(opts2);
      const M = getMessage(msg, opts2.context);
      const res = internal.sign(M, secretKey, opts2);
      cleanBytes(M);
      return res;
    },
    verify: (sig, msg, publicKey, opts2 = {}) => {
      validateVerOpts(opts2);
      return internal.verify(sig, getMessage(msg, opts2.context), publicKey);
    },
    prehash: (hash) => {
      checkHash(hash, securityLevel);
      return {
        info: { type: "hashml-dsa" },
        securityLevel,
        lengths: internal.lengths,
        keygen: internal.keygen,
        getPublicKey: internal.getPublicKey,
        sign: (msg, secretKey, opts2 = {}) => {
          validateSigOpts2(opts2);
          const M = getMessagePrehash(hash, msg, opts2.context);
          const res = internal.sign(M, secretKey, opts2);
          cleanBytes(M);
          return res;
        },
        verify: (sig, msg, publicKey, opts2 = {}) => {
          validateVerOpts(opts2);
          return internal.verify(sig, getMessagePrehash(hash, msg, opts2.context), publicKey);
        }
      };
    }
  };
}
var N2, Q2, ROOT_OF_UNITY, F, D, GAMMA2_1, GAMMA2_2, PARAMS, newPoly, mod4, smod, NTT, bitsCoder, id, polyCoder, polyAdd, polySub, polyShiftl, polyChknorm, MultiplyNTTs, ml_dsa44, ml_dsa65, ml_dsa87;
var init_ml_dsa = __esm({
  "node_modules/@noble/post-quantum/ml-dsa.js"() {
    init_utils6();
    init_sha34();
    init_crystals();
    init_utils8();
    /*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
    N2 = 256;
    Q2 = 8380417;
    ROOT_OF_UNITY = 1753;
    F = 8347681;
    D = 13;
    GAMMA2_1 = Math.floor((Q2 - 1) / 88) | 0;
    GAMMA2_2 = Math.floor((Q2 - 1) / 32) | 0;
    PARAMS = {
      2: { K: 4, L: 4, D, GAMMA1: 2 ** 17, GAMMA2: GAMMA2_1, TAU: 39, ETA: 2, OMEGA: 80 },
      3: { K: 6, L: 5, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 49, ETA: 4, OMEGA: 55 },
      5: { K: 8, L: 7, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 60, ETA: 2, OMEGA: 75 }
    };
    newPoly = (n) => new Int32Array(n);
    ({ mod: mod4, smod, NTT, bitsCoder } = genCrystals({
      N: N2,
      Q: Q2,
      F,
      ROOT_OF_UNITY,
      newPoly,
      isKyber: false,
      brvBits: 8
    }));
    id = (n) => n;
    polyCoder = (d, compress = id, verify = id) => bitsCoder(d, {
      encode: (i) => compress(verify(i)),
      decode: (i) => verify(compress(i))
    });
    polyAdd = (a, b) => {
      for (let i = 0; i < a.length; i++)
        a[i] = mod4(a[i] + b[i]);
      return a;
    };
    polySub = (a, b) => {
      for (let i = 0; i < a.length; i++)
        a[i] = mod4(a[i] - b[i]);
      return a;
    };
    polyShiftl = (p) => {
      for (let i = 0; i < N2; i++)
        p[i] <<= D;
      return p;
    };
    polyChknorm = (p, B) => {
      for (let i = 0; i < N2; i++)
        if (Math.abs(smod(p[i])) >= B)
          return true;
      return false;
    };
    MultiplyNTTs = (a, b) => {
      const c = newPoly(N2);
      for (let i = 0; i < a.length; i++)
        c[i] = mod4(a[i] * b[i]);
      return c;
    };
    ml_dsa44 = /* @__PURE__ */ getDilithium({
      ...PARAMS[2],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 32,
      XOF128,
      XOF256,
      securityLevel: 128
    });
    ml_dsa65 = /* @__PURE__ */ getDilithium({
      ...PARAMS[3],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 48,
      XOF128,
      XOF256,
      securityLevel: 192
    });
    ml_dsa87 = /* @__PURE__ */ getDilithium({
      ...PARAMS[5],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 64,
      XOF128,
      XOF256,
      securityLevel: 256
    });
  }
});

// node_modules/ts-mls/dist/src/codec/tlsEncoder.js
function encode(enc) {
  return (t) => {
    const [len, write] = enc(t);
    const buf = new ArrayBuffer(len);
    write(0, buf);
    return new Uint8Array(buf);
  };
}
function contramapBufferEncoder(enc, f) {
  return (u) => enc(f(u));
}
function contramapBufferEncoders(encoders, toTuple) {
  return (value) => {
    const values = toTuple(value);
    let totalLength = 0;
    let writeTotal = (_offset, _buffer) => {
    };
    for (let i = 0; i < encoders.length; i++) {
      const [len, write] = encoders[i](values[i]);
      const oldFunc = writeTotal;
      const currentLen = totalLength;
      writeTotal = (offset, buffer) => {
        oldFunc(offset, buffer);
        write(offset + currentLen, buffer);
      };
      totalLength += len;
    }
    return [totalLength, writeTotal];
  };
}
function composeBufferEncoders(encoders) {
  return (values) => contramapBufferEncoders(encoders, (t) => t)(values);
}
var encVoid = [0, () => {
}];

// node_modules/ts-mls/dist/src/codec/number.js
var uint8Encoder = (n) => [
  1,
  (offset, buffer) => {
    const view = new DataView(buffer);
    view.setUint8(offset, n);
  }
];
var encodeUint8 = encode(uint8Encoder);
var decodeUint8 = (b, offset) => {
  const value = b.at(offset);
  return value !== void 0 ? [value, 1] : void 0;
};
var uint16Encoder = (n) => [
  2,
  (offset, buffer) => {
    const view = new DataView(buffer);
    view.setUint16(offset, n);
  }
];
var encodeUint16 = encode(uint16Encoder);
var decodeUint16 = (b, offset) => {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    return [view.getUint16(offset), 2];
  } catch (e) {
    return void 0;
  }
};
var uint32Encoder = (n) => [
  4,
  (offset, buffer) => {
    const view = new DataView(buffer);
    view.setUint32(offset, n);
  }
];
var encodeUint32 = encode(uint32Encoder);
var decodeUint32 = (b, offset) => {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    return [view.getUint32(offset), 4];
  } catch (e) {
    return void 0;
  }
};
var uint64Encoder = (n) => [
  8,
  (offset, buffer) => {
    const view = new DataView(buffer);
    view.setBigUint64(offset, n);
  }
];
var encodeUint64 = encode(uint64Encoder);
var decodeUint64 = (b, offset) => {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    return [view.getBigUint64(offset), 8];
  } catch (e) {
    return void 0;
  }
};

// node_modules/ts-mls/dist/src/codec/tlsDecoder.js
function mapDecoder(dec, f) {
  return (b, offset) => {
    const x = dec(b, offset);
    if (x !== void 0) {
      const [t, l] = x;
      return [f(t), l];
    }
  };
}
function mapDecodersOption(decoders, f) {
  return (b, offset) => {
    const initial = mapDecoders(decoders, f)(b, offset);
    if (initial === void 0)
      return void 0;
    else {
      const [r, len] = initial;
      return r !== void 0 ? [r, len] : void 0;
    }
  };
}
function mapDecoders(decoders, f) {
  return (b, offset) => {
    const result = decoders.reduce((acc, decoder) => {
      if (!acc)
        return void 0;
      const decoded = decoder(b, acc.offset);
      if (!decoded)
        return void 0;
      const [value, length] = decoded;
      return {
        values: [...acc.values, value],
        offset: acc.offset + length,
        totalLength: acc.totalLength + length
      };
    }, { values: [], offset, totalLength: 0 });
    if (!result)
      return;
    return [f(...result.values), result.totalLength];
  };
}
function mapDecoderOption(dec, f) {
  return (b, offset) => {
    const x = dec(b, offset);
    if (x !== void 0) {
      const [t, l] = x;
      const u = f(t);
      return u !== void 0 ? [u, l] : void 0;
    }
  };
}
function flatMapDecoder(dec, f) {
  return flatMapDecoderAndMap(dec, f, (_t, u) => u);
}
function orDecoder(decT, decU) {
  return (b, offset) => {
    const t = decT(b, offset);
    return t ? t : decU(b, offset);
  };
}
function flatMapDecoderAndMap(dec, f, g) {
  return (b, offset) => {
    const decodedT = dec(b, offset);
    if (decodedT !== void 0) {
      const [t, len] = decodedT;
      const decoderU = f(t);
      const decodedU = decoderU(b, offset + len);
      if (decodedU !== void 0) {
        const [u, len2] = decodedU;
        return [g(t, u), len + len2];
      }
    }
  };
}
function succeedDecoder(t) {
  return () => [t, 0];
}
function failDecoder() {
  return () => void 0;
}

// node_modules/ts-mls/dist/src/util/enumHelpers.js
function enumNumberToKey(t) {
  return (n) => Object.values(t).includes(n) ? reverseMap(t)[n] : void 0;
}
function reverseMap(obj) {
  return Object.entries(obj).reduce((acc, [key, value]) => ({
    ...acc,
    [value]: key
  }), {});
}
function openEnumNumberToKey(rec) {
  return (n) => {
    const decoded = enumNumberToKey(rec)(n);
    if (decoded === void 0)
      return n.toString();
    else
      return decoded;
  };
}
function openEnumNumberEncoder(rec) {
  return (s) => {
    const x = rec[s];
    if (x === void 0)
      return Number(s);
    else
      return x;
  };
}

// node_modules/ts-mls/dist/src/defaultProposalType.js
var defaultProposalTypes = {
  add: 1,
  update: 2,
  remove: 3,
  psk: 4,
  reinit: 5,
  external_init: 6,
  group_context_extensions: 7
};
var defaultProposalTypeEncoder = contramapBufferEncoder(uint16Encoder, (n) => defaultProposalTypes[n]);
var encodeDefaultProposalType = encode(defaultProposalTypeEncoder);
var decodeDefaultProposalType = mapDecoderOption(decodeUint16, enumNumberToKey(defaultProposalTypes));

// node_modules/ts-mls/dist/src/defaultExtensionType.js
var defaultExtensionTypes = {
  application_id: 1,
  ratchet_tree: 2,
  required_capabilities: 3,
  external_pub: 4,
  external_senders: 5
};
var defaultExtensionTypeEncoder = contramapBufferEncoder(uint16Encoder, (n) => defaultExtensionTypes[n]);
var encodeDefaultExtensionType = encode(defaultExtensionTypeEncoder);
var decodeDefaultExtensionType = mapDecoderOption(decodeUint16, enumNumberToKey(defaultExtensionTypes));

// node_modules/ts-mls/dist/src/incomingMessageAction.js
var acceptAll = () => "accept";

// node_modules/ts-mls/dist/src/mlsError.js
var MlsError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MlsError";
  }
};
var ValidationError = class extends MlsError {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
};
var CodecError = class extends MlsError {
  constructor(message) {
    super(message);
    this.name = "CodecError";
  }
};
var UsageError = class extends MlsError {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
};
var DependencyError = class extends MlsError {
  constructor(message) {
    super(message);
    this.name = "DependencyError";
  }
};
var CryptoVerificationError = class extends MlsError {
  constructor(message) {
    super(message);
    this.name = "CryptoVerificationError";
  }
};
var CryptoError = class extends MlsError {
  constructor(message) {
    super(message);
    this.name = "CryptoError";
  }
};
var InternalError = class extends MlsError {
  constructor(message) {
    super(`This error should never occur, if you see this please submit a bug report. Message: ${message}`);
    this.name = "InternalError";
  }
};

// node_modules/ts-mls/dist/src/util/byteArray.js
function bytesToArrayBuffer(b) {
  if (b.buffer instanceof ArrayBuffer) {
    if (b.byteOffset === 0 && b.byteLength === b.buffer.byteLength) {
      return b.buffer;
    }
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  } else {
    const ab = new ArrayBuffer(b.byteLength);
    const arr = new Uint8Array(ab);
    arr.set(b, 0);
    return ab;
  }
}
function toBufferSource(b) {
  if (b.buffer instanceof ArrayBuffer)
    return b;
  const ab = new ArrayBuffer(b.byteLength);
  const arr = new Uint8Array(ab);
  arr.set(b, 0);
  return ab;
}
function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  } else {
    let binary = "";
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return globalThis.btoa(binary);
  }
}
function base64ToBytes(base64) {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  } else {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
function concatUint8Arrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
function zeroOutUint8Array(buf) {
  crypto.getRandomValues(buf);
  for (let i = 0; i < buf.length; i++) {
    buf[i] ^= buf[i];
  }
}

// node_modules/ts-mls/dist/src/codec/variableLength.js
var varLenDataEncoder = (data) => {
  const [len, write] = lengthEncoder(data.length);
  return [
    len + data.length,
    (offset, buffer) => {
      write(offset, buffer);
      const view = new Uint8Array(buffer);
      view.set(data, offset + len);
    }
  ];
};
function lengthEncoder(len) {
  if (len < 64) {
    return [
      1,
      (offset, buffer) => {
        const view = new DataView(buffer);
        view.setUint8(offset, len & 63);
      }
    ];
  } else if (len < 16384) {
    return [
      2,
      (offset, buffer) => {
        const view = new DataView(buffer);
        view.setUint8(offset, len >> 8 & 63 | 64);
        view.setUint8(offset + 1, len & 255);
      }
    ];
  } else if (len < 1073741824) {
    return [
      4,
      (offset, buffer) => {
        const view = new DataView(buffer);
        view.setUint8(offset, len >> 24 & 63 | 128);
        view.setUint8(offset + 1, len >> 16 & 255);
        view.setUint8(offset + 2, len >> 8 & 255);
        view.setUint8(offset + 3, len & 255);
      }
    ];
  } else {
    throw new CodecError("Length too large to encode (max is 2^30 - 1)");
  }
}
function determineLength(data, offset = 0) {
  if (offset >= data.length) {
    throw new CodecError("Offset beyond buffer");
  }
  const firstByte = data[offset];
  const prefix = firstByte >> 6;
  if (prefix === 0) {
    return { length: firstByte & 63, lengthFieldSize: 1 };
  } else if (prefix === 1) {
    if (offset + 2 > data.length)
      throw new CodecError("Incomplete 2-byte length");
    return { length: (firstByte & 63) << 8 | data[offset + 1], lengthFieldSize: 2 };
  } else if (prefix === 2) {
    if (offset + 4 > data.length)
      throw new CodecError("Incomplete 4-byte length");
    return {
      length: (firstByte & 63) << 24 | data[offset + 1] << 16 | data[offset + 2] << 8 | data[offset + 3],
      lengthFieldSize: 4
    };
  } else {
    throw new CodecError("8-byte length not supported in this implementation");
  }
}
var decodeVarLenData = (buf, offset) => {
  if (offset >= buf.length) {
    throw new CodecError("Offset beyond buffer");
  }
  const { length, lengthFieldSize } = determineLength(buf, offset);
  const totalBytes = lengthFieldSize + length;
  if (offset + totalBytes > buf.length) {
    throw new CodecError("Data length exceeds buffer");
  }
  const data = buf.subarray(offset + lengthFieldSize, offset + totalBytes);
  return [data, totalBytes];
};
function varLenTypeEncoder(enc) {
  return (data) => {
    let totalLength = 0;
    let writeTotal = (_offset, _buffer) => {
    };
    for (let i = 0; i < data.length; i++) {
      const [len, write] = enc(data[i]);
      const oldFunc = writeTotal;
      const currentLen = totalLength;
      writeTotal = (offset, buffer) => {
        oldFunc(offset, buffer);
        write(offset + currentLen, buffer);
      };
      totalLength += len;
    }
    const [headerLength, writeLength] = lengthEncoder(totalLength);
    return [
      headerLength + totalLength,
      (offset, buffer) => {
        writeLength(offset, buffer);
        writeTotal(offset + headerLength, buffer);
      }
    ];
  };
}
function decodeVarLenType(dec) {
  return (b, offset) => {
    const d = decodeVarLenData(b, offset);
    if (d === void 0)
      return;
    const [totalBytes, totalLength] = d;
    let cursor = 0;
    const result = [];
    while (cursor < totalBytes.length) {
      const item = dec(totalBytes, cursor);
      if (item === void 0)
        return void 0;
      const [value, len] = item;
      result.push(value);
      cursor += len;
    }
    return [result, totalLength];
  };
}
function base64RecordEncoder(valueEncoder) {
  const entryEncoder = contramapBufferEncoders([contramapBufferEncoder(varLenDataEncoder, base64ToBytes), valueEncoder], ([key, value]) => [key, value]);
  return contramapBufferEncoders([varLenTypeEncoder(entryEncoder)], (record) => [Object.entries(record)]);
}
function decodeBase64Record(decodeValue) {
  return mapDecoder(decodeVarLenType(mapDecoders([mapDecoder(decodeVarLenData, bytesToBase64), decodeValue], (key, value) => [key, value])), (entries) => {
    const record = {};
    for (const [key, value] of entries) {
      record[key] = value;
    }
    return record;
  });
}
function numberRecordEncoder(numberEncoder, valueEncoder) {
  const entryEncoder = contramapBufferEncoders([numberEncoder, valueEncoder], ([key, value]) => [key, value]);
  return contramapBufferEncoder(varLenTypeEncoder(entryEncoder), (record) => Object.entries(record).map(([key, value]) => [Number(key), value]));
}
function decodeNumberRecord(decodeNumber, decodeValue) {
  return mapDecoder(decodeVarLenType(mapDecoders([decodeNumber, decodeValue], (key, value) => [key, value])), (entries) => {
    const record = {};
    for (const [key, value] of entries) {
      record[key] = value;
    }
    return record;
  });
}
function bigintMapEncoder(valueEncoder) {
  const entryEncoder = contramapBufferEncoders([uint64Encoder, valueEncoder], ([key, value]) => [key, value]);
  return contramapBufferEncoder(varLenTypeEncoder(entryEncoder), (map) => Array.from(map.entries()));
}
function decodeBigintMap(decodeValue) {
  return mapDecoder(decodeVarLenType(mapDecoders([decodeUint64, decodeValue], (key, value) => [key, value])), (entries) => new Map(entries));
}

// node_modules/ts-mls/dist/src/util/constantTimeCompare.js
function constantTimeEqual(a, b) {
  if (a.length !== b.length)
    return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// node_modules/ts-mls/dist/src/extension.js
var extensionTypeEncoder = (t) => typeof t === "number" ? uint16Encoder(t) : defaultExtensionTypeEncoder(t);
var encodeExtensionType = encode(extensionTypeEncoder);
var decodeExtensionType = orDecoder(decodeDefaultExtensionType, decodeUint16);
var extensionEncoder = contramapBufferEncoders([extensionTypeEncoder, varLenDataEncoder], (e) => [e.extensionType, e.extensionData]);
var encodeExtension = encode(extensionEncoder);
var decodeExtension = mapDecoders([decodeExtensionType, decodeVarLenData], (extensionType, extensionData) => ({ extensionType, extensionData }));
function extensionEqual(a, b) {
  return a.extensionType === b.extensionType && constantTimeEqual(a.extensionData, b.extensionData);
}
function extensionsEqual(a, b) {
  if (a.length !== b.length)
    return false;
  return a.every((val, i) => extensionEqual(val, b[i]));
}
function extensionsSupportedByCapabilities(requiredExtensions, capabilities) {
  return requiredExtensions.filter((ex) => !isDefaultExtension(ex.extensionType)).every((ex) => capabilities.extensions.includes(extensionTypeToNumber(ex.extensionType)));
}
function isDefaultExtension(t) {
  return typeof t !== "number";
}
function extensionTypeToNumber(t) {
  return typeof t === "number" ? t : defaultExtensionTypes[t];
}

// node_modules/ts-mls/dist/src/credentialType.js
var credentialTypes = {
  basic: 1,
  x509: 2
};
var credentialTypeEncoder = contramapBufferEncoder(uint16Encoder, openEnumNumberEncoder(credentialTypes));
var encodeCredentialType = encode(credentialTypeEncoder);
var decodeCredentialType = mapDecoderOption(decodeUint16, openEnumNumberToKey(credentialTypes));

// node_modules/ts-mls/dist/src/credential.js
var credentialBasicEncoder = contramapBufferEncoders([credentialTypeEncoder, varLenDataEncoder], (c) => [c.credentialType, c.identity]);
var encodeCredentialBasic = encode(credentialBasicEncoder);
var credentialX509Encoder = contramapBufferEncoders([credentialTypeEncoder, varLenTypeEncoder(varLenDataEncoder)], (c) => [c.credentialType, c.certificates]);
var encodeCredentialX509 = encode(credentialX509Encoder);
var credentialCustomEncoder = contramapBufferEncoders([credentialTypeEncoder, varLenDataEncoder], (c) => [c.credentialType, c.data]);
var encodeCredentialCustom = encode(credentialCustomEncoder);
var credentialEncoder = (c) => {
  switch (c.credentialType) {
    case "basic":
      return credentialBasicEncoder(c);
    case "x509":
      return credentialX509Encoder(c);
    default:
      return credentialCustomEncoder(c);
  }
};
var encodeCredential = encode(credentialEncoder);
var decodeCredentialBasic = mapDecoder(decodeVarLenData, (identity) => ({
  credentialType: "basic",
  identity
}));
var decodeCredentialX509 = mapDecoder(decodeVarLenType(decodeVarLenData), (certificates) => ({ credentialType: "x509", certificates }));
var decodeCredential = flatMapDecoder(decodeCredentialType, (credentialType) => {
  switch (credentialType) {
    case "basic":
      return decodeCredentialBasic;
    case "x509":
      return decodeCredentialX509;
  }
});

// node_modules/ts-mls/dist/src/externalSender.js
var externalSenderEncoder = contramapBufferEncoders([varLenDataEncoder, credentialEncoder], (e) => [e.signaturePublicKey, e.credential]);
var encodeExternalSender = encode(externalSenderEncoder);
var decodeExternalSender = mapDecoders([decodeVarLenData, decodeCredential], (signaturePublicKey, credential) => ({ signaturePublicKey, credential }));

// node_modules/ts-mls/dist/src/crypto/hash.js
function refhash(label, value, h) {
  return h.digest(encodeRefHash(label, value));
}
function encodeRefHash(label, value) {
  const labelBytes = new TextEncoder().encode(label);
  const enc = composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]);
  return encode(enc)([labelBytes, value]);
}

// node_modules/ts-mls/dist/src/codec/optional.js
function optionalEncoder(encodeT) {
  return (t) => {
    if (t) {
      const [len, write] = encodeT(t);
      return [
        len + 1,
        (offset, buffer) => {
          const view = new DataView(buffer);
          view.setUint8(offset, 1);
          write(offset + 1, buffer);
        }
      ];
    } else {
      return [
        1,
        (offset, buffer) => {
          const view = new DataView(buffer);
          view.setUint8(offset, 0);
        }
      ];
    }
  };
}
function decodeOptional(decodeT) {
  return (b, offset) => {
    const presenceOctet = decodeUint8(b, offset)?.[0];
    if (presenceOctet == 1) {
      const result = decodeT(b, offset + 1);
      return result === void 0 ? void 0 : [result[0], result[1] + 1];
    } else {
      return [void 0, 1];
    }
  };
}

// node_modules/ts-mls/dist/src/crypto/ciphersuite.js
var ciphersuites = {
  MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519: 1,
  MLS_128_DHKEMP256_AES128GCM_SHA256_P256: 2,
  MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519: 3,
  MLS_256_DHKEMX448_AES256GCM_SHA512_Ed448: 4,
  MLS_256_DHKEMP521_AES256GCM_SHA512_P521: 5,
  MLS_256_DHKEMX448_CHACHA20POLY1305_SHA512_Ed448: 6,
  MLS_256_DHKEMP384_AES256GCM_SHA384_P384: 7,
  MLS_128_MLKEM512_AES128GCM_SHA256_Ed25519: 77,
  MLS_128_MLKEM512_CHACHA20POLY1305_SHA256_Ed25519: 78,
  MLS_256_MLKEM768_AES256GCM_SHA384_Ed25519: 79,
  MLS_256_MLKEM768_CHACHA20POLY1305_SHA384_Ed25519: 80,
  MLS_256_MLKEM1024_AES256GCM_SHA512_Ed25519: 81,
  MLS_256_MLKEM1024_CHACHA20POLY1305_SHA512_Ed25519: 82,
  MLS_256_XWING_AES256GCM_SHA512_Ed25519: 83,
  MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519: 84,
  MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87: 85,
  MLS_256_MLKEM1024_CHACHA20POLY1305_SHA512_MLDSA87: 86,
  MLS_256_XWING_AES256GCM_SHA512_MLDSA87: 87,
  MLS_256_XWING_CHACHA20POLY1305_SHA512_MLDSA87: 88
};
var ciphersuiteEncoder = contramapBufferEncoder(uint16Encoder, openEnumNumberEncoder(ciphersuites));
var encodeCiphersuite = encode(ciphersuiteEncoder);
var decodeCiphersuite = mapDecoderOption(decodeUint16, openEnumNumberToKey(ciphersuites));
function getCiphersuiteFromName(name) {
  return ciphersuiteValues[ciphersuites[name]];
}
var ciphersuiteValues = {
  1: {
    hash: "SHA-256",
    hpke: {
      kem: "DHKEM-X25519-HKDF-SHA256",
      aead: "AES128GCM",
      kdf: "HKDF-SHA256"
    },
    signature: "Ed25519",
    name: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"
  },
  2: {
    hash: "SHA-256",
    hpke: {
      kem: "DHKEM-P256-HKDF-SHA256",
      aead: "AES128GCM",
      kdf: "HKDF-SHA256"
    },
    signature: "P256",
    name: "MLS_128_DHKEMP256_AES128GCM_SHA256_P256"
  },
  3: {
    hash: "SHA-256",
    hpke: {
      kem: "DHKEM-X25519-HKDF-SHA256",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA256"
    },
    signature: "Ed25519",
    name: "MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519"
  },
  4: {
    hash: "SHA-512",
    hpke: {
      kem: "DHKEM-X448-HKDF-SHA512",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed448",
    name: "MLS_256_DHKEMX448_AES256GCM_SHA512_Ed448"
  },
  5: {
    hash: "SHA-512",
    hpke: {
      kem: "DHKEM-P521-HKDF-SHA512",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "P521",
    name: "MLS_256_DHKEMP521_AES256GCM_SHA512_P521"
  },
  6: {
    hash: "SHA-512",
    hpke: {
      kem: "DHKEM-X448-HKDF-SHA512",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed448",
    name: "MLS_256_DHKEMX448_CHACHA20POLY1305_SHA512_Ed448"
  },
  7: {
    hash: "SHA-384",
    hpke: {
      kem: "DHKEM-P384-HKDF-SHA384",
      aead: "AES256GCM",
      kdf: "HKDF-SHA384"
    },
    signature: "P384",
    name: "MLS_256_DHKEMP384_AES256GCM_SHA384_P384"
  },
  77: {
    hash: "SHA-256",
    hpke: {
      kem: "ML-KEM-512",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_128_MLKEM512_AES128GCM_SHA256_Ed25519"
  },
  78: {
    hash: "SHA-256",
    hpke: {
      kem: "ML-KEM-512",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_128_MLKEM512_CHACHA20POLY1305_SHA256_Ed25519"
  },
  79: {
    hash: "SHA-384",
    hpke: {
      kem: "ML-KEM-768",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_256_MLKEM768_AES256GCM_SHA384_Ed25519"
  },
  80: {
    hash: "SHA-384",
    hpke: {
      kem: "ML-KEM-768",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_256_MLKEM768_CHACHA20POLY1305_SHA384_Ed25519"
  },
  81: {
    hash: "SHA-512",
    hpke: {
      kem: "ML-KEM-1024",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_256_MLKEM1024_AES256GCM_SHA512_Ed25519"
  },
  82: {
    hash: "SHA-512",
    hpke: {
      kem: "ML-KEM-1024",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_256_MLKEM1024_CHACHA20POLY1305_SHA512_Ed25519"
  },
  83: {
    hash: "SHA-512",
    hpke: {
      kem: "X-Wing",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_256_XWING_AES256GCM_SHA512_Ed25519"
  },
  84: {
    hash: "SHA-512",
    hpke: {
      kem: "X-Wing",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "Ed25519",
    name: "MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519"
  },
  85: {
    hash: "SHA-512",
    hpke: {
      kem: "ML-KEM-1024",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "ML-DSA-87",
    name: "MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87"
  },
  86: {
    hash: "SHA-512",
    hpke: {
      kem: "ML-KEM-1024",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "ML-DSA-87",
    name: "MLS_256_MLKEM1024_CHACHA20POLY1305_SHA512_MLDSA87"
  },
  87: {
    hash: "SHA-512",
    hpke: {
      kem: "X-Wing",
      aead: "AES256GCM",
      kdf: "HKDF-SHA512"
    },
    signature: "ML-DSA-87",
    name: "MLS_256_XWING_AES256GCM_SHA512_MLDSA87"
  },
  88: {
    hash: "SHA-512",
    hpke: {
      kem: "X-Wing",
      aead: "CHACHA20POLY1305",
      kdf: "HKDF-SHA512"
    },
    signature: "ML-DSA-87",
    name: "MLS_256_XWING_CHACHA20POLY1305_SHA512_MLDSA87"
  }
};

// node_modules/ts-mls/dist/src/crypto/signature.js
async function signWithLabel(signKey, label, content, s) {
  return s.sign(signKey, encode(composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]))([
    new TextEncoder().encode(`MLS 1.0 ${label}`),
    content
  ]));
}
async function verifyWithLabel(publicKey, label, content, signature, s) {
  return s.verify(publicKey, encode(composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]))([
    new TextEncoder().encode(`MLS 1.0 ${label}`),
    content
  ]), signature);
}

// node_modules/ts-mls/dist/src/protocolVersion.js
var protocolVersions = {
  mls10: 1
};
var protocolVersionEncoder = contramapBufferEncoder(uint16Encoder, (t) => protocolVersions[t]);
var encodeProtocolVersion = encode(protocolVersionEncoder);
var decodeProtocolVersion = mapDecoderOption(decodeUint16, enumNumberToKey(protocolVersions));

// node_modules/ts-mls/dist/src/capabilities.js
var capabilitiesEncoder = contramapBufferEncoders([
  varLenTypeEncoder(protocolVersionEncoder),
  varLenTypeEncoder(ciphersuiteEncoder),
  varLenTypeEncoder(uint16Encoder),
  varLenTypeEncoder(uint16Encoder),
  varLenTypeEncoder(credentialTypeEncoder)
], (cap) => [cap.versions, cap.ciphersuites, cap.extensions, cap.proposals, cap.credentials]);
var encodeCapabilities = encode(capabilitiesEncoder);
var decodeCapabilities = mapDecoders([
  decodeVarLenType(decodeProtocolVersion),
  decodeVarLenType(decodeCiphersuite),
  decodeVarLenType(decodeUint16),
  decodeVarLenType(decodeUint16),
  decodeVarLenType(decodeCredentialType)
], (versions, ciphersuites2, extensions, proposals, credentials) => ({
  versions,
  ciphersuites: ciphersuites2,
  extensions,
  proposals,
  credentials
}));

// node_modules/ts-mls/dist/src/leafNodeSource.js
var leafNodeSources = {
  key_package: 1,
  update: 2,
  commit: 3
};
var leafNodeSourceEncoder = contramapBufferEncoder(uint8Encoder, (t) => leafNodeSources[t]);
var encodeLeafNodeSource = encode(leafNodeSourceEncoder);
var decodeLeafNodeSource = mapDecoderOption(decodeUint8, enumNumberToKey(leafNodeSources));

// node_modules/ts-mls/dist/src/lifetime.js
var lifetimeEncoder = contramapBufferEncoders([uint64Encoder, uint64Encoder], (lt) => [lt.notBefore, lt.notAfter]);
var encodeLifetime = encode(lifetimeEncoder);
var decodeLifetime = mapDecoders([decodeUint64, decodeUint64], (notBefore, notAfter) => ({
  notBefore,
  notAfter
}));
var defaultLifetime = {
  notBefore: 0n,
  notAfter: 9223372036854775807n
};

// node_modules/ts-mls/dist/src/leafNode.js
var leafNodeDataEncoder = contramapBufferEncoders([varLenDataEncoder, varLenDataEncoder, credentialEncoder, capabilitiesEncoder], (data) => [data.hpkePublicKey, data.signaturePublicKey, data.credential, data.capabilities]);
var encodeLeafNodeData = encode(leafNodeDataEncoder);
var decodeLeafNodeData = mapDecoders([decodeVarLenData, decodeVarLenData, decodeCredential, decodeCapabilities], (hpkePublicKey, signaturePublicKey, credential, capabilities) => ({
  hpkePublicKey,
  signaturePublicKey,
  credential,
  capabilities
}));
var leafNodeInfoKeyPackageEncoder = contramapBufferEncoders([leafNodeSourceEncoder, lifetimeEncoder, varLenTypeEncoder(extensionEncoder)], (info) => ["key_package", info.lifetime, info.extensions]);
var encodeLeafNodeInfoKeyPackage = encode(leafNodeInfoKeyPackageEncoder);
var leafNodeInfoUpdateOmittedEncoder = contramapBufferEncoders([leafNodeSourceEncoder, varLenTypeEncoder(extensionEncoder)], (i) => [i.leafNodeSource, i.extensions]);
var encodeLeafNodeInfoUpdateOmitted = encode(leafNodeInfoUpdateOmittedEncoder);
var leafNodeInfoCommitOmittedEncoder = contramapBufferEncoders([leafNodeSourceEncoder, varLenDataEncoder, varLenTypeEncoder(extensionEncoder)], (info) => [info.leafNodeSource, info.parentHash, info.extensions]);
var encodeLeafNodeInfoCommitOmitted = encode(leafNodeInfoCommitOmittedEncoder);
var leafNodeInfoOmittedEncoder = (info) => {
  switch (info.leafNodeSource) {
    case "key_package":
      return leafNodeInfoKeyPackageEncoder(info);
    case "update":
      return leafNodeInfoUpdateOmittedEncoder(info);
    case "commit":
      return leafNodeInfoCommitOmittedEncoder(info);
  }
};
var encodeLeafNodeInfoOmitted = encode(leafNodeInfoOmittedEncoder);
var decodeLeafNodeInfoKeyPackage = mapDecoders([decodeLifetime, decodeVarLenType(decodeExtension)], (lifetime, extensions) => ({
  leafNodeSource: "key_package",
  lifetime,
  extensions
}));
var decodeLeafNodeInfoUpdateOmitted = mapDecoder(decodeVarLenType(decodeExtension), (extensions) => ({
  leafNodeSource: "update",
  extensions
}));
var decodeLeafNodeInfoCommitOmitted = mapDecoders([decodeVarLenData, decodeVarLenType(decodeExtension)], (parentHash, extensions) => ({
  leafNodeSource: "commit",
  parentHash,
  extensions
}));
var decodeLeafNodeInfoOmitted = flatMapDecoder(decodeLeafNodeSource, (leafNodeSource) => {
  switch (leafNodeSource) {
    case "key_package":
      return decodeLeafNodeInfoKeyPackage;
    case "update":
      return decodeLeafNodeInfoUpdateOmitted;
    case "commit":
      return decodeLeafNodeInfoCommitOmitted;
  }
});
var leafNodeInfoUpdateEncoder = contramapBufferEncoders([leafNodeInfoUpdateOmittedEncoder, varLenDataEncoder, uint32Encoder], (i) => [i, i.groupId, i.leafIndex]);
var encodeLeafNodeInfoUpdate = encode(leafNodeInfoUpdateEncoder);
var leafNodeInfoCommitEncoder = contramapBufferEncoders([leafNodeInfoCommitOmittedEncoder, varLenDataEncoder, uint32Encoder], (info) => [info, info.groupId, info.leafIndex]);
var encodeLeafNodeInfoCommit = encode(leafNodeInfoCommitEncoder);
var leafNodeInfoEncoder = (info) => {
  switch (info.leafNodeSource) {
    case "key_package":
      return leafNodeInfoKeyPackageEncoder(info);
    case "update":
      return leafNodeInfoUpdateEncoder(info);
    case "commit":
      return leafNodeInfoCommitEncoder(info);
  }
};
var encodeLeafNodeInfo = encode(leafNodeInfoEncoder);
var decodeLeafNodeInfoUpdate = mapDecoders([decodeLeafNodeInfoUpdateOmitted, decodeVarLenData, decodeUint32], (ln, groupId, leafIndex) => ({
  ...ln,
  groupId,
  leafIndex
}));
var decodeLeafNodeInfoCommit = mapDecoders([decodeLeafNodeInfoCommitOmitted, decodeVarLenData, decodeUint32], (ln, groupId, leafIndex) => ({
  ...ln,
  groupId,
  leafIndex
}));
var decodeLeafNodeInfo = flatMapDecoder(decodeLeafNodeSource, (leafNodeSource) => {
  switch (leafNodeSource) {
    case "key_package":
      return decodeLeafNodeInfoKeyPackage;
    case "update":
      return decodeLeafNodeInfoUpdate;
    case "commit":
      return decodeLeafNodeInfoCommit;
  }
});
var leafNodeTBSEncoder = contramapBufferEncoders([leafNodeDataEncoder, leafNodeInfoEncoder], (tbs) => [tbs, tbs]);
var encodeLeafNodeTBS = encode(leafNodeTBSEncoder);
var leafNodeEncoder = contramapBufferEncoders([leafNodeDataEncoder, leafNodeInfoOmittedEncoder, varLenDataEncoder], (leafNode) => [leafNode, leafNode, leafNode.signature]);
var encodeLeafNode = encode(leafNodeEncoder);
var decodeLeafNode = mapDecoders([decodeLeafNodeData, decodeLeafNodeInfoOmitted, decodeVarLenData], (data, info, signature) => ({
  ...data,
  ...info,
  signature
}));
var decodeLeafNodeKeyPackage = mapDecoderOption(decodeLeafNode, (ln) => ln.leafNodeSource === "key_package" ? ln : void 0);
var decodeLeafNodeCommit = mapDecoderOption(decodeLeafNode, (ln) => ln.leafNodeSource === "commit" ? ln : void 0);
var decodeLeafNodeUpdate = mapDecoderOption(decodeLeafNode, (ln) => ln.leafNodeSource === "update" ? ln : void 0);
function toTbs(leafNode, groupId, leafIndex) {
  switch (leafNode.leafNodeSource) {
    case "key_package":
      return { ...leafNode, leafNodeSource: leafNode.leafNodeSource };
    case "update":
      return { ...leafNode, leafNodeSource: leafNode.leafNodeSource, groupId, leafIndex };
    case "commit":
      return { ...leafNode, leafNodeSource: leafNode.leafNodeSource, groupId, leafIndex };
  }
}
async function signLeafNodeCommit(tbs, signaturePrivateKey, sig) {
  return {
    ...tbs,
    signature: await signWithLabel(signaturePrivateKey, "LeafNodeTBS", encode(leafNodeTBSEncoder)(tbs), sig)
  };
}
async function signLeafNodeKeyPackage(tbs, signaturePrivateKey, sig) {
  return {
    ...tbs,
    signature: await signWithLabel(signaturePrivateKey, "LeafNodeTBS", encode(leafNodeTBSEncoder)(tbs), sig)
  };
}
function verifyLeafNodeSignature(leaf, groupId, leafIndex, sig) {
  return verifyWithLabel(leaf.signaturePublicKey, "LeafNodeTBS", encode(leafNodeTBSEncoder)(toTbs(leaf, groupId, leafIndex)), leaf.signature, sig);
}
function verifyLeafNodeSignatureKeyPackage(leaf, sig) {
  return verifyWithLabel(leaf.signaturePublicKey, "LeafNodeTBS", encode(leafNodeTBSEncoder)(leaf), leaf.signature, sig);
}

// node_modules/ts-mls/dist/src/keyPackage.js
var keyPackageTBSEncoder = contramapBufferEncoders([protocolVersionEncoder, ciphersuiteEncoder, varLenDataEncoder, leafNodeEncoder, varLenTypeEncoder(extensionEncoder)], (keyPackageTBS) => [
  keyPackageTBS.version,
  keyPackageTBS.cipherSuite,
  keyPackageTBS.initKey,
  keyPackageTBS.leafNode,
  keyPackageTBS.extensions
]);
var encodeKeyPackageTBS = encode(keyPackageTBSEncoder);
var decodeKeyPackageTBS = mapDecoders([
  decodeProtocolVersion,
  decodeCiphersuite,
  decodeVarLenData,
  decodeLeafNodeKeyPackage,
  decodeVarLenType(decodeExtension)
], (version, cipherSuite, initKey, leafNode, extensions) => ({
  version,
  cipherSuite,
  initKey,
  leafNode,
  extensions
}));
var keyPackageEncoder = contramapBufferEncoders([keyPackageTBSEncoder, varLenDataEncoder], (keyPackage) => [keyPackage, keyPackage.signature]);
var encodeKeyPackage = encode(keyPackageEncoder);
var decodeKeyPackage = mapDecoders([decodeKeyPackageTBS, decodeVarLenData], (keyPackageTBS, signature) => ({
  ...keyPackageTBS,
  signature
}));
async function signKeyPackage(tbs, signKey, s) {
  return { ...tbs, signature: await signWithLabel(signKey, "KeyPackageTBS", encode(keyPackageTBSEncoder)(tbs), s) };
}
async function verifyKeyPackage(kp, s) {
  return verifyWithLabel(kp.leafNode.signaturePublicKey, "KeyPackageTBS", encode(keyPackageTBSEncoder)(kp), kp.signature, s);
}
function makeKeyPackageRef(value, h) {
  return refhash("MLS 1.0 KeyPackage Reference", encode(keyPackageEncoder)(value), h);
}
async function generateKeyPackageWithKey(credential, capabilities, lifetime, extensions, signatureKeyPair, cs, leafNodeExtensions) {
  const initKeys = await cs.hpke.generateKeyPair();
  const hpkeKeys = await cs.hpke.generateKeyPair();
  const privatePackage = {
    initPrivateKey: await cs.hpke.exportPrivateKey(initKeys.privateKey),
    hpkePrivateKey: await cs.hpke.exportPrivateKey(hpkeKeys.privateKey),
    signaturePrivateKey: signatureKeyPair.signKey
  };
  const leafNodeTbs = {
    leafNodeSource: "key_package",
    hpkePublicKey: await cs.hpke.exportPublicKey(hpkeKeys.publicKey),
    signaturePublicKey: signatureKeyPair.publicKey,
    extensions: leafNodeExtensions ?? [],
    credential,
    capabilities,
    lifetime
  };
  const tbs = {
    version: "mls10",
    cipherSuite: cs.name,
    initKey: await cs.hpke.exportPublicKey(initKeys.publicKey),
    leafNode: await signLeafNodeKeyPackage(leafNodeTbs, signatureKeyPair.signKey, cs.signature),
    extensions
  };
  return { publicPackage: await signKeyPackage(tbs, signatureKeyPair.signKey, cs.signature), privatePackage };
}
async function generateKeyPackage(credential, capabilities, lifetime, extensions, cs, leafNodeExtensions) {
  const sigKeys = await cs.signature.keygen();
  return generateKeyPackageWithKey(credential, capabilities, lifetime, extensions, sigKeys, cs, leafNodeExtensions);
}

// node_modules/ts-mls/dist/src/crypto/kdf.js
function expandWithLabel(secret, label, context, length, kdf) {
  return kdf.expand(secret, encode(composeBufferEncoders([uint16Encoder, varLenDataEncoder, varLenDataEncoder]))([
    length,
    new TextEncoder().encode(`MLS 1.0 ${label}`),
    context
  ]), length);
}
async function deriveSecret(secret, label, kdf) {
  return expandWithLabel(secret, label, new Uint8Array(), kdf.size, kdf);
}
async function deriveTreeSecret(secret, label, generation, length, kdf) {
  return expandWithLabel(secret, label, encode(uint32Encoder)(generation), length, kdf);
}

// node_modules/ts-mls/dist/src/presharedkey.js
var pskTypes = {
  external: 1,
  resumption: 2
};
var pskTypeEncoder = contramapBufferEncoder(uint8Encoder, (t) => pskTypes[t]);
var encodePskType = encode(pskTypeEncoder);
var decodePskType = mapDecoderOption(decodeUint8, enumNumberToKey(pskTypes));
var resumptionPSKUsages = {
  application: 1,
  reinit: 2,
  branch: 3
};
var resumptionPSKUsageEncoder = contramapBufferEncoder(uint8Encoder, (u) => resumptionPSKUsages[u]);
var encodeResumptionPSKUsage = encode(resumptionPSKUsageEncoder);
var decodeResumptionPSKUsage = mapDecoderOption(decodeUint8, enumNumberToKey(resumptionPSKUsages));
var encodePskInfoExternal = contramapBufferEncoders([pskTypeEncoder, varLenDataEncoder], (i) => [i.psktype, i.pskId]);
var encodePskInfoResumption = contramapBufferEncoders([pskTypeEncoder, resumptionPSKUsageEncoder, varLenDataEncoder, uint64Encoder], (info) => [info.psktype, info.usage, info.pskGroupId, info.pskEpoch]);
var decodePskInfoResumption = mapDecoders([decodeResumptionPSKUsage, decodeVarLenData, decodeUint64], (usage, pskGroupId, pskEpoch) => {
  return { usage, pskGroupId, pskEpoch };
});
var pskInfoEncoder = (info) => {
  switch (info.psktype) {
    case "external":
      return encodePskInfoExternal(info);
    case "resumption":
      return encodePskInfoResumption(info);
  }
};
var encodePskInfo = encode(pskInfoEncoder);
var decodePskInfo = flatMapDecoder(decodePskType, (psktype) => {
  switch (psktype) {
    case "external":
      return mapDecoder(decodeVarLenData, (pskId) => ({
        psktype,
        pskId
      }));
    case "resumption":
      return mapDecoder(decodePskInfoResumption, (resumption) => ({
        psktype,
        ...resumption
      }));
  }
});
var pskIdEncoder = contramapBufferEncoders([pskInfoEncoder, varLenDataEncoder], (pskid) => [pskid, pskid.pskNonce]);
var encodePskId = encode(pskIdEncoder);
var decodePskId = mapDecoders([decodePskInfo, decodeVarLenData], (info, pskNonce) => ({ ...info, pskNonce }));
var pskLabelEncoder = contramapBufferEncoders([pskIdEncoder, uint16Encoder, uint16Encoder], (label) => [label.id, label.index, label.count]);
var encodePskLabel = encode(pskLabelEncoder);
var decodePskLabel = mapDecoders([decodePskId, decodeUint16, decodeUint16], (id2, index, count) => ({ id: id2, index, count }));
async function updatePskSecret(secret, pskId, psk, index, count, impl) {
  const zeroes = new Uint8Array(impl.kdf.size);
  return impl.kdf.extract(await expandWithLabel(await impl.kdf.extract(zeroes, psk), "derived psk", encode(pskLabelEncoder)({ id: pskId, index, count }), impl.kdf.size, impl.kdf), secret);
}

// node_modules/ts-mls/dist/src/proposal.js
var addEncoder = contramapBufferEncoder(keyPackageEncoder, (a) => a.keyPackage);
var encodeAdd = encode(addEncoder);
var decodeAdd = mapDecoder(decodeKeyPackage, (keyPackage) => ({ keyPackage }));
var updateEncoder = contramapBufferEncoder(leafNodeEncoder, (u) => u.leafNode);
var encodeUpdate = encode(updateEncoder);
var decodeUpdate = mapDecoder(decodeLeafNodeUpdate, (leafNode) => ({ leafNode }));
var removeEncoder = contramapBufferEncoder(uint32Encoder, (r) => r.removed);
var encodeRemove = encode(removeEncoder);
var decodeRemove = mapDecoder(decodeUint32, (removed) => ({ removed }));
var pskEncoder = contramapBufferEncoder(pskIdEncoder, (p) => p.preSharedKeyId);
var encodePSK = encode(pskEncoder);
var decodePSK = mapDecoder(decodePskId, (preSharedKeyId) => ({ preSharedKeyId }));
var reinitEncoder = contramapBufferEncoders([varLenDataEncoder, protocolVersionEncoder, ciphersuiteEncoder, varLenTypeEncoder(extensionEncoder)], (r) => [r.groupId, r.version, r.cipherSuite, r.extensions]);
var encodeReinit = encode(reinitEncoder);
var decodeReinit = mapDecoders([decodeVarLenData, decodeProtocolVersion, decodeCiphersuite, decodeVarLenType(decodeExtension)], (groupId, version, cipherSuite, extensions) => ({ groupId, version, cipherSuite, extensions }));
var externalInitEncoder = contramapBufferEncoder(varLenDataEncoder, (e) => e.kemOutput);
var encodeExternalInit = encode(externalInitEncoder);
var decodeExternalInit = mapDecoder(decodeVarLenData, (kemOutput) => ({ kemOutput }));
var groupContextExtensionsEncoder = contramapBufferEncoder(varLenTypeEncoder(extensionEncoder), (g) => g.extensions);
var encodeGroupContextExtensions = encode(groupContextExtensionsEncoder);
var decodeGroupContextExtensions = mapDecoder(decodeVarLenType(decodeExtension), (extensions) => ({ extensions }));
var proposalAddEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, addEncoder], (p) => [p.proposalType, p.add]);
var encodeProposalAdd = encode(proposalAddEncoder);
var proposalUpdateEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, updateEncoder], (p) => [p.proposalType, p.update]);
var encodeProposalUpdate = encode(proposalUpdateEncoder);
var proposalRemoveEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, removeEncoder], (p) => [p.proposalType, p.remove]);
var encodeProposalRemove = encode(proposalRemoveEncoder);
var proposalPSKEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, pskEncoder], (p) => [p.proposalType, p.psk]);
var encodeProposalPSK = encode(proposalPSKEncoder);
var proposalReinitEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, reinitEncoder], (p) => [p.proposalType, p.reinit]);
var encodeProposalReinit = encode(proposalReinitEncoder);
var proposalExternalInitEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, externalInitEncoder], (p) => [p.proposalType, p.externalInit]);
var encodeProposalExternalInit = encode(proposalExternalInitEncoder);
var proposalGroupContextExtensionsEncoder = contramapBufferEncoders([defaultProposalTypeEncoder, groupContextExtensionsEncoder], (p) => [p.proposalType, p.groupContextExtensions]);
var encodeProposalGroupContextExtensions = encode(proposalGroupContextExtensionsEncoder);
var proposalCustomEncoder = contramapBufferEncoders([uint16Encoder, varLenDataEncoder], (p) => [p.proposalType, p.proposalData]);
var encodeProposalCustom = encode(proposalCustomEncoder);
var proposalEncoder = (p) => {
  switch (p.proposalType) {
    case "add":
      return proposalAddEncoder(p);
    case "update":
      return proposalUpdateEncoder(p);
    case "remove":
      return proposalRemoveEncoder(p);
    case "psk":
      return proposalPSKEncoder(p);
    case "reinit":
      return proposalReinitEncoder(p);
    case "external_init":
      return proposalExternalInitEncoder(p);
    case "group_context_extensions":
      return proposalGroupContextExtensionsEncoder(p);
    default:
      return proposalCustomEncoder(p);
  }
};
var encodeProposal = encode(proposalEncoder);
var decodeProposalAdd = mapDecoder(decodeAdd, (add5) => ({ proposalType: "add", add: add5 }));
var decodeProposalUpdate = mapDecoder(decodeUpdate, (update) => ({
  proposalType: "update",
  update
}));
var decodeProposalRemove = mapDecoder(decodeRemove, (remove) => ({
  proposalType: "remove",
  remove
}));
var decodeProposalPSK = mapDecoder(decodePSK, (psk) => ({ proposalType: "psk", psk }));
var decodeProposalReinit = mapDecoder(decodeReinit, (reinit) => ({
  proposalType: "reinit",
  reinit
}));
var decodeProposalExternalInit = mapDecoder(decodeExternalInit, (externalInit) => ({ proposalType: "external_init", externalInit }));
var decodeProposalGroupContextExtensions = mapDecoder(decodeGroupContextExtensions, (groupContextExtensions) => ({ proposalType: "group_context_extensions", groupContextExtensions }));
function decodeProposalCustom(proposalType) {
  return mapDecoder(decodeVarLenData, (proposalData) => ({ proposalType, proposalData }));
}
var decodeProposal = orDecoder(flatMapDecoder(decodeDefaultProposalType, (proposalType) => {
  switch (proposalType) {
    case "add":
      return decodeProposalAdd;
    case "update":
      return decodeProposalUpdate;
    case "remove":
      return decodeProposalRemove;
    case "psk":
      return decodeProposalPSK;
    case "reinit":
      return decodeProposalReinit;
    case "external_init":
      return decodeProposalExternalInit;
    case "group_context_extensions":
      return decodeProposalGroupContextExtensions;
  }
}), flatMapDecoder(decodeUint16, (n) => decodeProposalCustom(n)));

// node_modules/ts-mls/dist/src/proposalOrRefType.js
var proposalOrRefTypes = {
  proposal: 1,
  reference: 2
};
var proposalOrRefTypeEncoder = contramapBufferEncoder(uint8Encoder, (t) => proposalOrRefTypes[t]);
var encodeProposalOrRefType = encode(proposalOrRefTypeEncoder);
var decodeProposalOrRefType = mapDecoderOption(decodeUint8, enumNumberToKey(proposalOrRefTypes));
var proposalOrRefProposalEncoder = contramapBufferEncoders([proposalOrRefTypeEncoder, proposalEncoder], (p) => [p.proposalOrRefType, p.proposal]);
var encodeProposalOrRefProposal = encode(proposalOrRefProposalEncoder);
var proposalOrRefProposalRefEncoder = contramapBufferEncoders([proposalOrRefTypeEncoder, varLenDataEncoder], (r) => [r.proposalOrRefType, r.reference]);
var encodeProposalOrRefProposalRef = encode(proposalOrRefProposalRefEncoder);
var proposalOrRefEncoder = (input) => {
  switch (input.proposalOrRefType) {
    case "proposal":
      return proposalOrRefProposalEncoder(input);
    case "reference":
      return proposalOrRefProposalRefEncoder(input);
  }
};
var encodeProposalOrRef = encode(proposalOrRefEncoder);
var decodeProposalOrRef = flatMapDecoder(decodeProposalOrRefType, (proposalOrRefType) => {
  switch (proposalOrRefType) {
    case "proposal":
      return mapDecoder(decodeProposal, (proposal) => ({ proposalOrRefType, proposal }));
    case "reference":
      return mapDecoder(decodeVarLenData, (reference) => ({ proposalOrRefType, reference }));
  }
});

// node_modules/ts-mls/dist/src/crypto/hpke.js
function encryptWithLabel(publicKey, label, context, plaintext, hpke) {
  return hpke.seal(publicKey, plaintext, encode(composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]))([
    new TextEncoder().encode(`MLS 1.0 ${label}`),
    context
  ]), new Uint8Array());
}
function decryptWithLabel(privateKey, label, context, kemOutput, ciphertext, hpke) {
  return hpke.open(privateKey, kemOutput, ciphertext, encode(composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]))([
    new TextEncoder().encode(`MLS 1.0 ${label}`),
    context
  ]));
}

// node_modules/ts-mls/dist/src/groupContext.js
var groupContextEncoder = contramapBufferEncoders([
  protocolVersionEncoder,
  ciphersuiteEncoder,
  varLenDataEncoder,
  // groupId
  uint64Encoder,
  // epoch
  varLenDataEncoder,
  // treeHash
  varLenDataEncoder,
  // confirmedTranscriptHash
  varLenTypeEncoder(extensionEncoder)
], (gc) => [gc.version, gc.cipherSuite, gc.groupId, gc.epoch, gc.treeHash, gc.confirmedTranscriptHash, gc.extensions]);
var encodeGroupContext = encode(groupContextEncoder);
var decodeGroupContext = mapDecoders([
  decodeProtocolVersion,
  decodeCiphersuite,
  decodeVarLenData,
  // groupId
  decodeUint64,
  // epoch
  decodeVarLenData,
  // treeHash
  decodeVarLenData,
  // confirmedTranscriptHash
  decodeVarLenType(decodeExtension)
], (version, cipherSuite, groupId, epoch, treeHash2, confirmedTranscriptHash, extensions) => ({
  version,
  cipherSuite,
  groupId,
  epoch,
  treeHash: treeHash2,
  confirmedTranscriptHash,
  extensions
}));
async function extractEpochSecret(context, joinerSecret, kdf, pskSecret) {
  const psk = pskSecret === void 0 ? new Uint8Array(kdf.size) : pskSecret;
  const extracted = await kdf.extract(joinerSecret, psk);
  return expandWithLabel(extracted, "epoch", encode(groupContextEncoder)(context), kdf.size, kdf);
}
async function extractJoinerSecret(context, previousInitSecret, commitSecret, kdf) {
  const extracted = await kdf.extract(previousInitSecret, commitSecret);
  return expandWithLabel(extracted, "joiner", encode(groupContextEncoder)(context), kdf.size, kdf);
}

// node_modules/ts-mls/dist/src/nodeType.js
var nodeTypes = {
  leaf: 1,
  parent: 2
};
var nodeTypeEncoder = contramapBufferEncoder(uint8Encoder, (t) => nodeTypes[t]);
var encodeNodeType = encode(nodeTypeEncoder);
var decodeNodeType = mapDecoderOption(decodeUint8, enumNumberToKey(nodeTypes));

// node_modules/ts-mls/dist/src/parentNode.js
var parentNodeEncoder = contramapBufferEncoders([varLenDataEncoder, varLenDataEncoder, varLenTypeEncoder(uint32Encoder)], (node) => [node.hpkePublicKey, node.parentHash, node.unmergedLeaves]);
var encodeParentNode = encode(parentNodeEncoder);
var decodeParentNode = mapDecoders([decodeVarLenData, decodeVarLenData, decodeVarLenType(decodeUint32)], (hpkePublicKey, parentHash, unmergedLeaves) => ({
  hpkePublicKey,
  parentHash,
  unmergedLeaves
}));

// node_modules/ts-mls/dist/src/treemath.js
function toNodeIndex(n) {
  return n;
}
function toLeafIndex(n) {
  return n;
}
function log2(x) {
  if (x === 0)
    return 0;
  let k = 0;
  while (x >> k > 0) {
    k++;
  }
  return k - 1;
}
function level(nodeIndex) {
  if ((nodeIndex & 1) === 0)
    return 0;
  let k = 0;
  while ((nodeIndex >> k & 1) === 1) {
    k++;
  }
  return k;
}
function isLeaf(nodeIndex) {
  return nodeIndex % 2 == 0;
}
function leafToNodeIndex(leafIndex) {
  return toNodeIndex(leafIndex * 2);
}
function nodeToLeafIndex(nodeIndex) {
  return toLeafIndex(nodeIndex / 2);
}
function leafWidth(nodeWidth2) {
  return nodeWidth2 == 0 ? 0 : (nodeWidth2 - 1) / 2 + 1;
}
function nodeWidth(leafWidth2) {
  return leafWidth2 === 0 ? 0 : 2 * (leafWidth2 - 1) + 1;
}
function rootFromNodeWidth(nodeWidth2) {
  return toNodeIndex((1 << log2(nodeWidth2)) - 1);
}
function root(leafWidth2) {
  const w = nodeWidth(leafWidth2);
  return rootFromNodeWidth(w);
}
function left(nodeIndex) {
  const k = level(nodeIndex);
  if (k === 0)
    throw new InternalError("leaf node has no children");
  return toNodeIndex(nodeIndex ^ 1 << k - 1);
}
function right(nodeIndex) {
  const k = level(nodeIndex);
  if (k === 0)
    throw new InternalError("leaf node has no children");
  return toNodeIndex(nodeIndex ^ 3 << k - 1);
}
function parent(nodeIndex, leafWidth2) {
  if (nodeIndex === root(leafWidth2))
    throw new InternalError("root node has no parent");
  const k = level(nodeIndex);
  const b = nodeIndex >> k + 1 & 1;
  return toNodeIndex((nodeIndex | 1 << k) ^ b << k + 1);
}
function sibling(x, leafWidth2) {
  const p = parent(x, leafWidth2);
  return x < p ? right(p) : left(p);
}
function directPath(nodeIndex, leafWidth2) {
  const r = root(leafWidth2);
  if (nodeIndex === r)
    return [];
  const d = [];
  while (nodeIndex !== r) {
    nodeIndex = parent(nodeIndex, leafWidth2);
    d.push(nodeIndex);
  }
  return d;
}
function copath(nodeIndex, leafWidth2) {
  if (nodeIndex === root(leafWidth2))
    return [];
  const d = directPath(nodeIndex, leafWidth2);
  d.unshift(nodeIndex);
  d.pop();
  return d.map((y) => sibling(y, leafWidth2));
}
function isAncestor(childNodeIndex, ancestor, nodeWidth2) {
  return directPath(childNodeIndex, leafWidth(nodeWidth2)).includes(ancestor);
}

// node_modules/ts-mls/dist/src/ratchetTree.js
var nodeEncoder = (node) => {
  switch (node.nodeType) {
    case "parent":
      return contramapBufferEncoders([nodeTypeEncoder, parentNodeEncoder], (n) => [n.nodeType, n.parent])(node);
    case "leaf":
      return contramapBufferEncoders([nodeTypeEncoder, leafNodeEncoder], (n) => [n.nodeType, n.leaf])(node);
  }
};
var encodeNode = encode(nodeEncoder);
var decodeNode = flatMapDecoder(decodeNodeType, (nodeType) => {
  switch (nodeType) {
    case "parent":
      return mapDecoder(decodeParentNode, (parent2) => ({
        nodeType,
        parent: parent2
      }));
    case "leaf":
      return mapDecoder(decodeLeafNode, (leaf) => ({
        nodeType,
        leaf
      }));
  }
});
function getHpkePublicKey(n) {
  switch (n.nodeType) {
    case "parent":
      return n.parent.hpkePublicKey;
    case "leaf":
      return n.leaf.hpkePublicKey;
  }
}
function extendRatchetTree(tree) {
  const lastIndex = tree.length - 1;
  if (tree[lastIndex] === void 0) {
    throw new InternalError("The last node in the ratchet tree must be non-blank.");
  }
  const neededSize = nextFullBinaryTreeSize(tree.length);
  const copy = tree.slice();
  while (copy.length < neededSize) {
    copy.push(void 0);
  }
  return copy;
}
function nextFullBinaryTreeSize(n) {
  let d = 0;
  while ((1 << d + 1) - 1 < n) {
    d++;
  }
  return (1 << d + 1) - 1;
}
function stripBlankNodes(tree) {
  let lastNonBlank = tree.length - 1;
  while (lastNonBlank >= 0 && tree[lastNonBlank] === void 0) {
    lastNonBlank--;
  }
  return tree.slice(0, lastNonBlank + 1);
}
var ratchetTreeEncoder = contramapBufferEncoder(varLenTypeEncoder(optionalEncoder(nodeEncoder)), stripBlankNodes);
var encodeRatchetTree = encode(ratchetTreeEncoder);
var decodeRatchetTree = mapDecoder(decodeVarLenType(decodeOptional(decodeNode)), extendRatchetTree);
function findBlankLeafNodeIndex(tree) {
  const nodeIndex = tree.findIndex((node, nodeIndex2) => node === void 0 && isLeaf(toNodeIndex(nodeIndex2)));
  if (nodeIndex < 0)
    return void 0;
  else
    return toNodeIndex(nodeIndex);
}
function findBlankLeafNodeIndexOrExtend(tree) {
  const blankLeaf = findBlankLeafNodeIndex(tree);
  return blankLeaf === void 0 ? toNodeIndex(tree.length + 1) : blankLeaf;
}
function extendTree(tree, leafNode) {
  const newRoot = void 0;
  const insertedNodeIndex = toNodeIndex(tree.length + 1);
  const newTree = [
    ...tree,
    newRoot,
    { nodeType: "leaf", leaf: leafNode },
    ...new Array(tree.length - 1)
  ];
  return [newTree, insertedNodeIndex];
}
function addLeafNode(tree, leafNode) {
  const blankLeaf = findBlankLeafNodeIndex(tree);
  if (blankLeaf === void 0) {
    return extendTree(tree, leafNode);
  }
  const insertedLeafIndex = nodeToLeafIndex(blankLeaf);
  const dp = directPath(blankLeaf, leafWidth(tree.length));
  const copy = tree.slice();
  for (const nodeIndex of dp) {
    const node = tree[nodeIndex];
    if (node !== void 0) {
      const parentNode = node;
      const updated = {
        nodeType: "parent",
        parent: { ...parentNode.parent, unmergedLeaves: [...parentNode.parent.unmergedLeaves, insertedLeafIndex] }
      };
      copy[nodeIndex] = updated;
    }
  }
  copy[blankLeaf] = { nodeType: "leaf", leaf: leafNode };
  return [copy, blankLeaf];
}
function updateLeafNode(tree, leafNode, leafIndex) {
  const leafNodeIndex = leafToNodeIndex(leafIndex);
  const pathToBlank = directPath(leafNodeIndex, leafWidth(tree.length));
  const copy = tree.slice();
  for (const nodeIndex of pathToBlank) {
    const node = tree[nodeIndex];
    if (node !== void 0) {
      copy[nodeIndex] = void 0;
    }
  }
  copy[leafNodeIndex] = { nodeType: "leaf", leaf: leafNode };
  return copy;
}
function removeLeafNode(tree, removedLeafIndex) {
  const leafNodeIndex = leafToNodeIndex(removedLeafIndex);
  const pathToBlank = directPath(leafNodeIndex, leafWidth(tree.length));
  const copy = tree.slice();
  for (const nodeIndex of pathToBlank) {
    const node = tree[nodeIndex];
    if (node !== void 0) {
      copy[nodeIndex] = void 0;
    }
  }
  copy[leafNodeIndex] = void 0;
  return condenseRatchetTreeAfterRemove(copy);
}
function condenseRatchetTreeAfterRemove(tree) {
  return extendRatchetTree(stripBlankNodes(tree));
}
function resolution(tree, nodeIndex) {
  const node = tree[nodeIndex];
  if (node === void 0) {
    if (isLeaf(nodeIndex)) {
      return [];
    }
    const l = left(nodeIndex);
    const r = right(nodeIndex);
    const leftRes = resolution(tree, l);
    const rightRes = resolution(tree, r);
    return [...leftRes, ...rightRes];
  }
  if (isLeaf(nodeIndex)) {
    return [nodeIndex];
  }
  const unmerged = node.nodeType === "parent" ? node.parent.unmergedLeaves : [];
  return [nodeIndex, ...unmerged.map((u) => leafToNodeIndex(toLeafIndex(u)))];
}
function filteredDirectPath(leafIndex, tree) {
  const leafNodeIndex = leafToNodeIndex(leafIndex);
  const leafWidth2 = nodeToLeafIndex(toNodeIndex(tree.length));
  const cp = copath(leafNodeIndex, leafWidth2);
  return directPath(leafNodeIndex, leafWidth2).filter((_nodeIndex, n) => resolution(tree, cp[n]).length !== 0);
}
function filteredDirectPathAndCopathResolution(leafIndex, tree) {
  const leafNodeIndex = leafToNodeIndex(leafIndex);
  const lWidth = leafWidth(tree.length);
  const cp = copath(leafNodeIndex, lWidth);
  return directPath(leafNodeIndex, lWidth).reduce((acc, cur, n) => {
    const r = resolution(tree, cp[n]);
    if (r.length === 0)
      return acc;
    else
      return [...acc, { nodeIndex: cur, resolution: r }];
  }, []);
}
function removeLeaves(tree, leafIndices) {
  const copy = tree.slice();
  function shouldBeRemoved(leafIndex) {
    return leafIndices.find((x) => leafIndex === x) !== void 0;
  }
  for (const [i, n] of tree.entries()) {
    if (n !== void 0) {
      const nodeIndex = toNodeIndex(i);
      if (isLeaf(nodeIndex) && shouldBeRemoved(nodeToLeafIndex(nodeIndex))) {
        copy[i] = void 0;
      } else if (n.nodeType === "parent") {
        copy[i] = {
          ...n,
          parent: { ...n.parent, unmergedLeaves: n.parent.unmergedLeaves.filter((l) => !shouldBeRemoved(l)) }
        };
      }
    }
  }
  return condenseRatchetTreeAfterRemove(copy);
}
function traverseToRoot(tree, leafIndex, f) {
  const rootIndex = root(leafWidth(tree.length));
  let currentIndex = leafToNodeIndex(leafIndex);
  while (currentIndex != rootIndex) {
    currentIndex = parent(currentIndex, leafWidth(tree.length));
    const currentNode = tree[currentIndex];
    if (currentNode !== void 0) {
      if (currentNode.nodeType === "leaf") {
        throw new InternalError("Expected parent node");
      }
      const result = f(currentIndex, currentNode.parent);
      if (result !== void 0) {
        return [result, currentIndex];
      }
    }
  }
}
function findFirstNonBlankAncestor(tree, nodeIndex) {
  return traverseToRoot(tree, nodeToLeafIndex(nodeIndex), (nodeIndex2, _node) => nodeIndex2)?.[0] ?? root(leafWidth(tree.length));
}
function findLeafIndex(tree, leaf) {
  const foundIndex = tree.findIndex((node, nodeIndex) => {
    if (isLeaf(toNodeIndex(nodeIndex)) && node !== void 0) {
      if (node.nodeType === "parent")
        throw new InternalError("Found parent node in leaf node position");
      return constantTimeEqual(encode(leafNodeEncoder)(node.leaf), encode(leafNodeEncoder)(leaf));
    }
    return false;
  });
  return foundIndex === -1 ? void 0 : nodeToLeafIndex(toNodeIndex(foundIndex));
}
function getCredentialFromLeafIndex(ratchetTree, leafIndex) {
  const senderLeafNode = ratchetTree[leafToNodeIndex(leafIndex)];
  if (senderLeafNode === void 0 || senderLeafNode.nodeType === "parent")
    throw new ValidationError("Unable to find leafnode for leafIndex");
  return senderLeafNode.leaf.credential;
}
function getSignaturePublicKeyFromLeafIndex(ratchetTree, leafIndex) {
  const leafNode = ratchetTree[leafToNodeIndex(leafIndex)];
  if (leafNode === void 0 || leafNode.nodeType === "parent")
    throw new ValidationError("Unable to find leafnode for leafIndex");
  return leafNode.leaf.signaturePublicKey;
}

// node_modules/ts-mls/dist/src/treeHash.js
var leafNodeHashInputEncoder = contramapBufferEncoders([nodeTypeEncoder, uint32Encoder, optionalEncoder(leafNodeEncoder)], (input) => [input.nodeType, input.leafIndex, input.leafNode]);
var encodeLeafNodeHashInput = encode(leafNodeHashInputEncoder);
var decodeLeafNodeHashInput = mapDecoders([decodeUint32, decodeOptional(decodeLeafNode)], (leafIndex, leafNode) => ({
  nodeType: "leaf",
  leafIndex,
  leafNode
}));
var parentNodeHashInputEncoder = contramapBufferEncoders([nodeTypeEncoder, optionalEncoder(parentNodeEncoder), varLenDataEncoder, varLenDataEncoder], (input) => [input.nodeType, input.parentNode, input.leftHash, input.rightHash]);
var encodeParentNodeHashInput = encode(parentNodeHashInputEncoder);
var decodeParentNodeHashInput = mapDecoders([decodeOptional(decodeParentNode), decodeVarLenData, decodeVarLenData], (parentNode, leftHash, rightHash) => ({
  nodeType: "parent",
  parentNode,
  leftHash,
  rightHash
}));
var treeHashInputEncoder = (input) => {
  switch (input.nodeType) {
    case "leaf":
      return leafNodeHashInputEncoder(input);
    case "parent":
      return parentNodeHashInputEncoder(input);
  }
};
var encodeTreeHashInput = encode(treeHashInputEncoder);
var decodeTreeHashInput = flatMapDecoder(decodeNodeType, (nodeType) => {
  switch (nodeType) {
    case "leaf":
      return decodeLeafNodeHashInput;
    case "parent":
      return decodeParentNodeHashInput;
  }
});
async function treeHashRoot(tree, h) {
  return treeHash(tree, rootFromNodeWidth(tree.length), h);
}
async function treeHash(tree, subtreeIndex, h) {
  if (isLeaf(subtreeIndex)) {
    const leafNode = tree[subtreeIndex];
    if (leafNode?.nodeType === "parent")
      throw new InternalError("Somehow found parent node in leaf position");
    const input = encode(leafNodeHashInputEncoder)({
      nodeType: "leaf",
      leafIndex: nodeToLeafIndex(subtreeIndex),
      leafNode: leafNode?.leaf
    });
    return await h.digest(input);
  } else {
    const parentNode = tree[subtreeIndex];
    if (parentNode?.nodeType === "leaf")
      throw new InternalError("Somehow found leaf node in parent position");
    const leftHash = await treeHash(tree, left(subtreeIndex), h);
    const rightHash = await treeHash(tree, right(subtreeIndex), h);
    const input = {
      nodeType: "parent",
      parentNode: parentNode?.parent,
      leftHash,
      rightHash
    };
    return await h.digest(encode(parentNodeHashInputEncoder)(input));
  }
}

// node_modules/ts-mls/dist/src/parentHash.js
var parentHashInputEncoder = contramapBufferEncoders([varLenDataEncoder, varLenDataEncoder, varLenDataEncoder], (i) => [i.encryptionKey, i.parentHash, i.originalSiblingTreeHash]);
var encodeParentHashInput = encode(parentHashInputEncoder);
var decodeParentHashInput = mapDecoders([decodeVarLenData, decodeVarLenData, decodeVarLenData], (encryptionKey, parentHash, originalSiblingTreeHash) => ({
  encryptionKey,
  parentHash,
  originalSiblingTreeHash
}));
function validateParentHashCoverage(parentIndices, coverage) {
  for (const index of parentIndices) {
    if ((coverage[index] ?? 0) !== 1) {
      return false;
    }
  }
  return true;
}
async function verifyParentHashes(tree, h) {
  const parentNodes = tree.reduce((acc, cur, index) => {
    if (cur !== void 0 && cur.nodeType === "parent") {
      return [...acc, index];
    } else
      return acc;
  }, []);
  if (parentNodes.length === 0)
    return true;
  const coverage = await parentHashCoverage(tree, h);
  return validateParentHashCoverage(parentNodes, coverage);
}
function parentHashCoverage(tree, h) {
  return tree.reduce(async (acc, node, nodeIndex) => {
    let currentIndex = toNodeIndex(nodeIndex);
    if (!isLeaf(currentIndex) || node === void 0)
      return acc;
    let updated = { ...await acc };
    const rootIndex = root(leafWidth(tree.length));
    while (currentIndex !== rootIndex) {
      const currentNode = tree[currentIndex];
      if (currentNode === void 0) {
        continue;
      }
      const [parentHash, parentHashNodeIndex] = await calculateParentHash(tree, currentIndex, h);
      if (parentHashNodeIndex === void 0) {
        throw new InternalError("Reached root before completing parent hash coeverage");
      }
      const expectedParentHash = getParentHash(currentNode);
      if (expectedParentHash !== void 0 && constantTimeEqual(parentHash, expectedParentHash)) {
        const newCount = (updated[parentHashNodeIndex] ?? 0) + 1;
        updated = { ...updated, [parentHashNodeIndex]: newCount };
      } else {
        break;
      }
      currentIndex = parentHashNodeIndex;
    }
    return updated;
  }, Promise.resolve({}));
}
function getParentHash(node) {
  if (node.nodeType === "parent")
    return node.parent.parentHash;
  else if (node.leaf.leafNodeSource === "commit")
    return node.leaf.parentHash;
}
async function calculateParentHash(tree, nodeIndex, h) {
  const rootIndex = root(leafWidth(tree.length));
  if (nodeIndex === rootIndex) {
    return [new Uint8Array(), void 0];
  }
  const parentNodeIndex = findFirstNonBlankAncestor(tree, nodeIndex);
  const parentNode = tree[parentNodeIndex];
  if (parentNodeIndex === rootIndex && parentNode === void 0) {
    return [new Uint8Array(), parentNodeIndex];
  }
  const siblingIndex = nodeIndex < parentNodeIndex ? right(parentNodeIndex) : left(parentNodeIndex);
  if (parentNode === void 0 || parentNode.nodeType === "leaf")
    throw new InternalError("Expected non-blank parent Node");
  const removedUnmerged = removeLeaves(tree, parentNode.parent.unmergedLeaves);
  const originalSiblingTreeHash = await treeHash(removedUnmerged, siblingIndex, h);
  const input = {
    encryptionKey: parentNode.parent.hpkePublicKey,
    parentHash: parentNode.parent.parentHash,
    originalSiblingTreeHash
  };
  return [await h.digest(encode(parentHashInputEncoder)(input)), parentNodeIndex];
}

// node_modules/ts-mls/dist/src/hpkeCiphertext.js
var hpkeCiphertextEncoder = contramapBufferEncoders([varLenDataEncoder, varLenDataEncoder], (egs) => [egs.kemOutput, egs.ciphertext]);
var encodeHpkeCiphertext = encode(hpkeCiphertextEncoder);
var decodeHpkeCiphertext = mapDecoders([decodeVarLenData, decodeVarLenData], (kemOutput, ciphertext) => ({ kemOutput, ciphertext }));

// node_modules/ts-mls/dist/src/updatePath.js
var updatePathNodeEncoder = contramapBufferEncoders([varLenDataEncoder, varLenTypeEncoder(hpkeCiphertextEncoder)], (node) => [node.hpkePublicKey, node.encryptedPathSecret]);
var encodeUpdatePathNode = encode(updatePathNodeEncoder);
var decodeUpdatePathNode = mapDecoders([decodeVarLenData, decodeVarLenType(decodeHpkeCiphertext)], (hpkePublicKey, encryptedPathSecret) => ({ hpkePublicKey, encryptedPathSecret }));
var updatePathEncoder = contramapBufferEncoders([leafNodeEncoder, varLenTypeEncoder(updatePathNodeEncoder)], (path) => [path.leafNode, path.nodes]);
var encodeUpdatePath = encode(updatePathEncoder);
var decodeUpdatePath = mapDecoders([decodeLeafNodeCommit, decodeVarLenType(decodeUpdatePathNode)], (leafNode, nodes) => ({ leafNode, nodes }));
async function createUpdatePath(originalTree, senderLeafIndex, groupContext, signaturePrivateKey, cs) {
  const originalLeafNode = originalTree[leafToNodeIndex(senderLeafIndex)];
  if (originalLeafNode === void 0 || originalLeafNode.nodeType === "parent")
    throw new InternalError("Expected non-blank leaf node");
  const pathSecret = cs.rng.randomBytes(cs.kdf.size);
  const leafNodeSecret = await deriveSecret(pathSecret, "node", cs.kdf);
  const leafKeypair = await cs.hpke.deriveKeyPair(leafNodeSecret);
  const fdp = filteredDirectPathAndCopathResolution(senderLeafIndex, originalTree);
  const copy = originalTree.slice();
  const [ps, updatedTree] = await applyInitialTreeUpdate(fdp, pathSecret, senderLeafIndex, copy, cs);
  const treeWithHashes = await insertParentHashes(fdp, updatedTree, cs);
  const leafParentHash = await calculateParentHash(treeWithHashes, leafToNodeIndex(senderLeafIndex), cs.hash);
  const updatedLeafNodeTbs = {
    leafNodeSource: "commit",
    hpkePublicKey: await cs.hpke.exportPublicKey(leafKeypair.publicKey),
    extensions: originalLeafNode.leaf.extensions,
    capabilities: originalLeafNode.leaf.capabilities,
    credential: originalLeafNode.leaf.credential,
    signaturePublicKey: originalLeafNode.leaf.signaturePublicKey,
    parentHash: leafParentHash[0],
    groupId: groupContext.groupId,
    leafIndex: senderLeafIndex
  };
  const updatedLeafNode = await signLeafNodeCommit(updatedLeafNodeTbs, signaturePrivateKey, cs.signature);
  treeWithHashes[leafToNodeIndex(senderLeafIndex)] = {
    nodeType: "leaf",
    leaf: updatedLeafNode
  };
  const updatedTreeHash = await treeHashRoot(treeWithHashes, cs.hash);
  const updatedGroupContext = {
    ...groupContext,
    treeHash: updatedTreeHash,
    epoch: groupContext.epoch + 1n
  };
  const pathSecrets = ps.slice(0, ps.length - 1).reverse();
  const updatePathNodes = await Promise.all(pathSecrets.map(encryptSecretsForPath(originalTree, treeWithHashes, updatedGroupContext, cs)));
  const updatePath = { leafNode: updatedLeafNode, nodes: updatePathNodes };
  return [treeWithHashes, updatePath, pathSecrets, leafKeypair.privateKey];
}
function encryptSecretsForPath(originalTree, updatedTree, updatedGroupContext, cs) {
  return async (pathSecret) => {
    const key = getHpkePublicKey(updatedTree[pathSecret.nodeIndex]);
    const res = {
      hpkePublicKey: key,
      encryptedPathSecret: await Promise.all(pathSecret.sendTo.map(async (nodeIndex) => {
        const { ct, enc } = await encryptWithLabel(await cs.hpke.importPublicKey(getHpkePublicKey(originalTree[nodeIndex])), "UpdatePathNode", encode(groupContextEncoder)(updatedGroupContext), pathSecret.secret, cs.hpke);
        return { ciphertext: ct, kemOutput: enc };
      }))
    };
    return res;
  };
}
async function insertParentHashes(fdp, tree, cs) {
  for (let x = fdp.length - 1; x >= 0; x--) {
    const { nodeIndex } = fdp[x];
    const parentHash = await calculateParentHash(tree, nodeIndex, cs.hash);
    const currentNode = tree[nodeIndex];
    if (currentNode === void 0 || currentNode.nodeType === "leaf")
      throw new InternalError("Expected non-blank parent node");
    const updatedNode = { nodeType: "parent", parent: { ...currentNode.parent, parentHash: parentHash[0] } };
    tree[nodeIndex] = updatedNode;
  }
  return tree;
}
async function applyInitialTreeUpdate(fdp, pathSecret, senderLeafIndex, tree, cs) {
  return await fdp.reduce(async (acc, { nodeIndex, resolution: resolution2 }) => {
    const [pathSecrets, tree2] = await acc;
    const lastPathSecret = pathSecrets[0];
    const nextPathSecret = await deriveSecret(lastPathSecret.secret, "path", cs.kdf);
    const nextNodeSecret = await deriveSecret(nextPathSecret, "node", cs.kdf);
    const { publicKey } = await cs.hpke.deriveKeyPair(nextNodeSecret);
    tree2[nodeIndex] = {
      nodeType: "parent",
      parent: {
        hpkePublicKey: await cs.hpke.exportPublicKey(publicKey),
        parentHash: new Uint8Array(),
        unmergedLeaves: []
      }
    };
    return [[{ nodeIndex, secret: nextPathSecret, sendTo: resolution2 }, ...pathSecrets], tree2];
  }, Promise.resolve([[{ secret: pathSecret, nodeIndex: leafToNodeIndex(senderLeafIndex), sendTo: [] }], tree]));
}
async function applyUpdatePath(tree, senderLeafIndex, path, h, isExternal = false) {
  if (!isExternal) {
    const leafToUpdate = tree[leafToNodeIndex(senderLeafIndex)];
    if (leafToUpdate === void 0 || leafToUpdate.nodeType === "parent")
      throw new InternalError("Leaf node not defined or is parent");
    const leafNodePublicKeyNotNew = constantTimeEqual(leafToUpdate.leaf.hpkePublicKey, path.leafNode.hpkePublicKey);
    if (leafNodePublicKeyNotNew)
      throw new ValidationError("Public key in the LeafNode is the same as the committer's current leaf node");
  }
  const pathNodePublicKeysExistInTree = path.nodes.some((node) => tree.some((treeNode) => {
    return treeNode?.nodeType === "parent" ? constantTimeEqual(treeNode.parent.hpkePublicKey, node.hpkePublicKey) : false;
  }));
  if (pathNodePublicKeysExistInTree)
    throw new ValidationError("Public keys in the UpdatePath may not appear in a node of the new ratchet tree");
  const copy = tree.slice();
  copy[leafToNodeIndex(senderLeafIndex)] = { nodeType: "leaf", leaf: path.leafNode };
  const reverseFilteredDirectPath = filteredDirectPath(senderLeafIndex, tree).reverse();
  const reverseUpdatePath = path.nodes.slice().reverse();
  if (reverseUpdatePath.length !== reverseFilteredDirectPath.length) {
    throw new ValidationError("Invalid length of UpdatePath");
  }
  for (const [level2, nodeIndex] of reverseFilteredDirectPath.entries()) {
    const parentHash = await calculateParentHash(copy, nodeIndex, h);
    copy[nodeIndex] = {
      nodeType: "parent",
      parent: { hpkePublicKey: reverseUpdatePath[level2].hpkePublicKey, unmergedLeaves: [], parentHash: parentHash[0] }
    };
  }
  const leafParentHash = await calculateParentHash(copy, leafToNodeIndex(senderLeafIndex), h);
  if (!constantTimeEqual(leafParentHash[0], path.leafNode.parentHash))
    throw new ValidationError("Parent hash did not match the UpdatePath");
  return copy;
}
function firstCommonAncestor(tree, leafIndex, senderLeafIndex) {
  const fdp = filteredDirectPathAndCopathResolution(senderLeafIndex, tree);
  for (const { nodeIndex } of fdp) {
    if (isAncestor(leafToNodeIndex(leafIndex), nodeIndex, tree.length)) {
      return nodeIndex;
    }
  }
  throw new ValidationError("Could not find common ancestor");
}
function firstMatchAncestor(tree, leafIndex, senderLeafIndex, path) {
  const fdp = filteredDirectPathAndCopathResolution(senderLeafIndex, tree);
  for (const [n, { nodeIndex, resolution: resolution2 }] of fdp.entries()) {
    if (isAncestor(leafToNodeIndex(leafIndex), nodeIndex, tree.length)) {
      return { nodeIndex, resolution: resolution2, updateNode: path.nodes[n] };
    }
  }
  throw new ValidationError("Could not find common ancestor");
}

// node_modules/ts-mls/dist/src/commit.js
var commitEncoder = contramapBufferEncoders([varLenTypeEncoder(proposalOrRefEncoder), optionalEncoder(updatePathEncoder)], (commit) => [commit.proposals, commit.path]);
var encodeCommit = encode(commitEncoder);
var decodeCommit = mapDecoders([decodeVarLenType(decodeProposalOrRef), decodeOptional(decodeUpdatePath)], (proposals, path) => ({ proposals, path }));

// node_modules/ts-mls/dist/src/contentType.js
var contentTypes = {
  application: 1,
  proposal: 2,
  commit: 3
};
var contentTypeEncoder = contramapBufferEncoder(uint8Encoder, (t) => contentTypes[t]);
var encodeContentType = encode(contentTypeEncoder);
var decodeContentType = mapDecoderOption(decodeUint8, enumNumberToKey(contentTypes));

// node_modules/ts-mls/dist/src/wireformat.js
var wireformats = {
  mls_public_message: 1,
  mls_private_message: 2,
  mls_welcome: 3,
  mls_group_info: 4,
  mls_key_package: 5
};
var wireformatEncoder = (s) => contramapBufferEncoder(uint16Encoder, (t) => wireformats[t])(s);
var encodeWireformat = encode(wireformatEncoder);
var decodeWireformat = mapDecoderOption(decodeUint16, enumNumberToKey(wireformats));

// node_modules/ts-mls/dist/src/sender.js
var senderTypes = {
  member: 1,
  external: 2,
  new_member_proposal: 3,
  new_member_commit: 4
};
var senderTypeEncoder = contramapBufferEncoder(uint8Encoder, (t) => senderTypes[t]);
var encodeSenderType = encode(senderTypeEncoder);
var decodeSenderType = mapDecoderOption(decodeUint8, enumNumberToKey(senderTypes));
var senderEncoder = (s) => {
  switch (s.senderType) {
    case "member":
      return contramapBufferEncoders([senderTypeEncoder, uint32Encoder], (s2) => [s2.senderType, s2.leafIndex])(s);
    case "external":
      return contramapBufferEncoders([senderTypeEncoder, uint32Encoder], (s2) => [s2.senderType, s2.senderIndex])(s);
    case "new_member_proposal":
    case "new_member_commit":
      return senderTypeEncoder(s.senderType);
  }
};
var encodeSender = encode(senderEncoder);
var decodeSender = flatMapDecoder(decodeSenderType, (senderType) => {
  switch (senderType) {
    case "member":
      return mapDecoder(decodeUint32, (leafIndex) => ({
        senderType,
        leafIndex
      }));
    case "external":
      return mapDecoder(decodeUint32, (senderIndex) => ({
        senderType,
        senderIndex
      }));
    case "new_member_proposal":
      return mapDecoder(() => [void 0, 0], () => ({
        senderType
      }));
    case "new_member_commit":
      return mapDecoder(() => [void 0, 0], () => ({
        senderType
      }));
  }
});
function getSenderLeafNodeIndex(sender) {
  return sender.senderType === "member" ? sender.leafIndex : void 0;
}
var reuseGuardEncoder = (g) => [
  4,
  (offset, buffer) => {
    const view = new Uint8Array(buffer, offset, 4);
    view.set(g, 0);
  }
];
var encodeReuseGuard = encode(reuseGuardEncoder);
var decodeReuseGuard = (b, offset) => {
  return [b.subarray(offset, offset + 4), 4];
};
var senderDataEncoder = contramapBufferEncoders([uint32Encoder, uint32Encoder, reuseGuardEncoder], (s) => [s.leafIndex, s.generation, s.reuseGuard]);
var encodeSenderData = encode(senderDataEncoder);
var decodeSenderData = mapDecoders([decodeUint32, decodeUint32, decodeReuseGuard], (leafIndex, generation, reuseGuard) => ({
  leafIndex,
  generation,
  reuseGuard
}));
var senderDataAADEncoder = contramapBufferEncoders([varLenDataEncoder, uint64Encoder, contentTypeEncoder], (aad) => [aad.groupId, aad.epoch, aad.contentType]);
var encodeSenderDataAAD = encode(senderDataAADEncoder);
var decodeSenderDataAAD = mapDecoders([decodeVarLenData, decodeUint64, decodeContentType], (groupId, epoch, contentType) => ({
  groupId,
  epoch,
  contentType
}));
function sampleCiphertext(cs, ciphertext) {
  return ciphertext.length < cs.kdf.size ? ciphertext : ciphertext.subarray(0, cs.kdf.size);
}
async function expandSenderDataKey(cs, senderDataSecret, ciphertext) {
  const ciphertextSample = sampleCiphertext(cs, ciphertext);
  const keyLength = cs.hpke.keyLength;
  return await expandWithLabel(senderDataSecret, "key", ciphertextSample, keyLength, cs.kdf);
}
async function expandSenderDataNonce(cs, senderDataSecret, ciphertext) {
  const ciphertextSample = sampleCiphertext(cs, ciphertext);
  const keyLength = cs.hpke.nonceLength;
  return await expandWithLabel(senderDataSecret, "nonce", ciphertextSample, keyLength, cs.kdf);
}

// node_modules/ts-mls/dist/src/framedContent.js
var framedContentApplicationDataEncoder = contramapBufferEncoders([contentTypeEncoder, varLenDataEncoder], (f) => [f.contentType, f.applicationData]);
var encodeFramedContentApplicationData = encode(framedContentApplicationDataEncoder);
var framedContentProposalDataEncoder = contramapBufferEncoders([contentTypeEncoder, proposalEncoder], (f) => [f.contentType, f.proposal]);
var encodeFramedContentProposalData = encode(framedContentProposalDataEncoder);
var framedContentCommitDataEncoder = contramapBufferEncoders([contentTypeEncoder, commitEncoder], (f) => [f.contentType, f.commit]);
var encodeFramedContentCommitData = encode(framedContentCommitDataEncoder);
var framedContentInfoEncoder = (fc) => {
  switch (fc.contentType) {
    case "application":
      return framedContentApplicationDataEncoder(fc);
    case "proposal":
      return framedContentProposalDataEncoder(fc);
    case "commit":
      return framedContentCommitDataEncoder(fc);
  }
};
var encodeFramedContentInfo = encode(framedContentInfoEncoder);
var decodeFramedContentApplicationData = mapDecoder(decodeVarLenData, (applicationData) => ({ contentType: "application", applicationData }));
var decodeFramedContentProposalData = mapDecoder(decodeProposal, (proposal) => ({ contentType: "proposal", proposal }));
var decodeFramedContentCommitData = mapDecoder(decodeCommit, (commit) => ({
  contentType: "commit",
  commit
}));
var decodeFramedContentInfo = flatMapDecoder(decodeContentType, (contentType) => {
  switch (contentType) {
    case "application":
      return decodeFramedContentApplicationData;
    case "proposal":
      return decodeFramedContentProposalData;
    case "commit":
      return decodeFramedContentCommitData;
  }
});
function toTbs2(content, wireformat, context) {
  return { protocolVersion: context.version, wireformat, content, senderType: content.sender.senderType, context };
}
var framedContentEncoder = contramapBufferEncoders([varLenDataEncoder, uint64Encoder, senderEncoder, varLenDataEncoder, framedContentInfoEncoder], (fc) => [fc.groupId, fc.epoch, fc.sender, fc.authenticatedData, fc]);
var encodeFramedContent = encode(framedContentEncoder);
var decodeFramedContent = mapDecoders([decodeVarLenData, decodeUint64, decodeSender, decodeVarLenData, decodeFramedContentInfo], (groupId, epoch, sender, authenticatedData, info) => ({
  groupId,
  epoch,
  sender,
  authenticatedData,
  ...info
}));
var senderInfoEncoder = (info) => {
  switch (info.senderType) {
    case "member":
    case "new_member_commit":
      return groupContextEncoder(info.context);
    case "external":
    case "new_member_proposal":
      return encVoid;
  }
};
var encodeSenderInfo = encode(senderInfoEncoder);
var framedContentTBSEncoder = contramapBufferEncoders([protocolVersionEncoder, wireformatEncoder, framedContentEncoder, senderInfoEncoder], (f) => [f.protocolVersion, f.wireformat, f.content, f]);
var encodeFramedContentTBS = encode(framedContentTBSEncoder);
var encodeFramedContentAuthDataContent = (authData) => {
  switch (authData.contentType) {
    case "commit":
      return encodeFramedContentAuthDataCommit(authData);
    case "application":
    case "proposal":
      return encVoid;
  }
};
var encodeFramedContentAuthDataCommit = contramapBufferEncoder(varLenDataEncoder, (data) => data.confirmationTag);
var framedContentAuthDataEncoder = contramapBufferEncoders([varLenDataEncoder, encodeFramedContentAuthDataContent], (d) => [d.signature, d]);
var encodeFramedContentAuthData = encode(framedContentAuthDataEncoder);
var decodeFramedContentAuthDataCommit = mapDecoder(decodeVarLenData, (confirmationTag) => ({
  contentType: "commit",
  confirmationTag
}));
function decodeFramedContentAuthData(contentType) {
  switch (contentType) {
    case "commit":
      return mapDecoders([decodeVarLenData, decodeFramedContentAuthDataCommit], (signature, commitData) => ({
        signature,
        ...commitData
      }));
    case "application":
    case "proposal":
      return mapDecoder(decodeVarLenData, (signature) => ({
        signature,
        contentType
      }));
  }
}
async function verifyFramedContentSignature(signKey, wireformat, content, auth, context, s) {
  return verifyWithLabel(signKey, "FramedContentTBS", encode(framedContentTBSEncoder)(toTbs2(content, wireformat, context)), auth.signature, s);
}
function signFramedContentTBS(signKey, tbs, s) {
  return signWithLabel(signKey, "FramedContentTBS", encode(framedContentTBSEncoder)(tbs), s);
}
async function signFramedContentApplicationOrProposal(signKey, tbs, cs) {
  const signature = await signFramedContentTBS(signKey, tbs, cs.signature);
  return {
    contentType: tbs.content.contentType,
    signature
  };
}
function createConfirmationTag(confirmationKey, confirmedTranscriptHash, h) {
  return h.mac(confirmationKey, confirmedTranscriptHash);
}
function verifyConfirmationTag(confirmationKey, tag, confirmedTranscriptHash, h) {
  return h.verifyMac(confirmationKey, tag, confirmedTranscriptHash);
}
async function createContentCommitSignature(groupContext, wireformat, c, sender, authenticatedData, signKey, s) {
  const tbs = {
    protocolVersion: groupContext.version,
    wireformat,
    content: {
      contentType: "commit",
      commit: c,
      groupId: groupContext.groupId,
      epoch: groupContext.epoch,
      sender,
      authenticatedData
    },
    senderType: "member",
    context: groupContext
  };
  const signature = await signFramedContentTBS(signKey, tbs, s);
  return { framedContent: tbs.content, signature };
}

// node_modules/ts-mls/dist/src/authenticatedContent.js
var authenticatedContentEncoder = contramapBufferEncoders([wireformatEncoder, framedContentEncoder, framedContentAuthDataEncoder], (a) => [a.wireformat, a.content, a.auth]);
var encodeAuthenticatedContent = encode(authenticatedContentEncoder);
var decodeAuthenticatedContent = mapDecoders([
  decodeWireformat,
  flatMapDecoder(decodeFramedContent, (content) => {
    return mapDecoder(decodeFramedContentAuthData(content.contentType), (auth) => ({ content, auth }));
  })
], (wireformat, contentAuth) => ({
  wireformat,
  ...contentAuth
}));
var authenticatedContentTBMEncoder = contramapBufferEncoders([framedContentTBSEncoder, framedContentAuthDataEncoder], (t) => [t.contentTbs, t.auth]);
var encodeAuthenticatedContentTBM = encode(authenticatedContentTBMEncoder);
function createMembershipTag(membershipKey, tbm, h) {
  return h.mac(membershipKey, encode(authenticatedContentTBMEncoder)(tbm));
}
function verifyMembershipTag(membershipKey, tbm, tag, h) {
  return h.verifyMac(membershipKey, tag, encode(authenticatedContentTBMEncoder)(tbm));
}
function makeProposalRef(proposal, h) {
  return refhash("MLS 1.0 Proposal Reference", encode(authenticatedContentEncoder)(proposal), h);
}

// node_modules/ts-mls/dist/src/publicMessage.js
var publicMessageInfoEncoder = (info) => {
  switch (info.senderType) {
    case "member":
      return varLenDataEncoder(info.membershipTag);
    case "external":
    case "new_member_proposal":
    case "new_member_commit":
      return encVoid;
  }
};
var encodePublicMessageInfo = encode(publicMessageInfoEncoder);
function decodePublicMessageInfo(senderType) {
  switch (senderType) {
    case "member":
      return mapDecoder(decodeVarLenData, (membershipTag) => ({
        senderType,
        membershipTag
      }));
    case "external":
    case "new_member_proposal":
    case "new_member_commit":
      return succeedDecoder({ senderType });
  }
}
var publicMessageEncoder = contramapBufferEncoders([framedContentEncoder, framedContentAuthDataEncoder, publicMessageInfoEncoder], (msg) => [msg.content, msg.auth, msg]);
var encodePublicMessage = encode(publicMessageEncoder);
var decodePublicMessage = flatMapDecoder(decodeFramedContent, (content) => mapDecoders([decodeFramedContentAuthData(content.contentType), decodePublicMessageInfo(content.sender.senderType)], (auth, info) => ({
  ...info,
  content,
  auth
})));
function findSignaturePublicKey(ratchetTree, groupContext, framedContent) {
  switch (framedContent.sender.senderType) {
    case "member":
      return getSignaturePublicKeyFromLeafIndex(ratchetTree, toLeafIndex(framedContent.sender.leafIndex));
    case "external": {
      const sender = senderFromExtension(groupContext.extensions, framedContent.sender.senderIndex);
      if (sender === void 0)
        throw new ValidationError("Received external but no external_sender extension");
      return sender.signaturePublicKey;
    }
    case "new_member_proposal":
      if (framedContent.contentType !== "proposal")
        throw new ValidationError("Received new_member_proposal but contentType is not proposal");
      if (framedContent.proposal.proposalType !== "add")
        throw new ValidationError("Received new_member_proposal but proposalType was not add");
      return framedContent.proposal.add.keyPackage.leafNode.signaturePublicKey;
    case "new_member_commit": {
      if (framedContent.contentType !== "commit")
        throw new ValidationError("Received new_member_commit but contentType is not commit");
      if (framedContent.commit.path === void 0)
        throw new ValidationError("Commit contains no update path");
      return framedContent.commit.path.leafNode.signaturePublicKey;
    }
  }
}
function senderFromExtension(extensions, senderIndex) {
  const externalSenderExtensions = extensions.filter((ex) => ex.extensionType === "external_senders");
  const externalSenderExtension = externalSenderExtensions[senderIndex];
  if (externalSenderExtension !== void 0) {
    const externalSender = decodeExternalSender(externalSenderExtension.extensionData, 0);
    if (externalSender === void 0)
      throw new CodecError("Could not decode ExternalSender");
    return externalSender[0];
  }
}

// node_modules/ts-mls/dist/src/messageProtectionPublic.js
async function protectProposalPublic(signKey, membershipKey, groupContext, authenticatedData, proposal, leafIndex, cs) {
  const framedContent = {
    groupId: groupContext.groupId,
    epoch: groupContext.epoch,
    sender: { senderType: "member", leafIndex },
    contentType: "proposal",
    authenticatedData,
    proposal
  };
  const tbs = {
    protocolVersion: groupContext.version,
    wireformat: "mls_public_message",
    content: framedContent,
    senderType: "member",
    context: groupContext
  };
  const auth = await signFramedContentApplicationOrProposal(signKey, tbs, cs);
  const authenticatedContent = {
    wireformat: "mls_public_message",
    content: framedContent,
    auth
  };
  const msg = await protectPublicMessage(membershipKey, groupContext, authenticatedContent, cs);
  return { publicMessage: msg };
}
async function protectExternalProposalPublic(signKey, groupContext, authenticatedData, proposal, sender, cs) {
  const framedContent = {
    groupId: groupContext.groupId,
    epoch: groupContext.epoch,
    sender,
    contentType: "proposal",
    authenticatedData,
    proposal
  };
  const tbs = {
    protocolVersion: groupContext.version,
    wireformat: "mls_public_message",
    content: framedContent,
    senderType: sender.senderType,
    context: groupContext
  };
  const auth = await signFramedContentApplicationOrProposal(signKey, tbs, cs);
  const msg = {
    content: framedContent,
    auth,
    senderType: sender.senderType
  };
  return { publicMessage: msg };
}
async function protectPublicMessage(membershipKey, groupContext, content, cs) {
  if (content.content.contentType === "application")
    throw new UsageError("Can't make an application message public");
  if (content.content.sender.senderType == "member") {
    const authenticatedContent = {
      contentTbs: toTbs2(content.content, "mls_public_message", groupContext),
      auth: content.auth
    };
    const tag = await createMembershipTag(membershipKey, authenticatedContent, cs.hash);
    return {
      content: content.content,
      auth: content.auth,
      senderType: "member",
      membershipTag: tag
    };
  }
  return {
    content: content.content,
    auth: content.auth,
    senderType: content.content.sender.senderType
  };
}
async function unprotectPublicMessage(membershipKey, groupContext, ratchetTree, msg, cs, overrideSignatureKey) {
  if (msg.content.contentType === "application")
    throw new UsageError("Can't make an application message public");
  if (msg.senderType === "member") {
    const authenticatedContent = {
      contentTbs: toTbs2(msg.content, "mls_public_message", groupContext),
      auth: msg.auth
    };
    if (!await verifyMembershipTag(membershipKey, authenticatedContent, msg.membershipTag, cs.hash))
      throw new CryptoVerificationError("Could not verify membership");
  }
  const signaturePublicKey = overrideSignatureKey !== void 0 ? overrideSignatureKey : findSignaturePublicKey(ratchetTree, groupContext, msg.content);
  const signatureValid = await verifyFramedContentSignature(signaturePublicKey, "mls_public_message", msg.content, msg.auth, groupContext, cs.signature);
  if (!signatureValid)
    throw new CryptoVerificationError("Signature invalid");
  return {
    wireformat: "mls_public_message",
    content: msg.content,
    auth: msg.auth
  };
}

// node_modules/ts-mls/dist/src/externalProposal.js
async function proposeAddExternal(groupInfo, keyPackage, privateKeyPackage, cs, authenticatedData = new Uint8Array()) {
  const allExtensionsSupported = extensionsSupportedByCapabilities(groupInfo.groupContext.extensions, keyPackage.leafNode.capabilities);
  if (!allExtensionsSupported)
    throw new UsageError("client does not support every extension in the GroupContext");
  const proposal = {
    proposalType: "add",
    add: {
      keyPackage
    }
  };
  const result = await protectExternalProposalPublic(privateKeyPackage.signaturePrivateKey, groupInfo.groupContext, authenticatedData, proposal, { senderType: "new_member_proposal" }, cs);
  return {
    wireformat: "mls_public_message",
    version: groupInfo.groupContext.version,
    publicMessage: result.publicMessage
  };
}
async function proposeExternal(groupInfo, proposal, signaturePublicKey, signaturePrivateKey, cs, authenticatedData = new Uint8Array()) {
  const externalSenderExtensionIndex = groupInfo.groupContext.extensions.findIndex((ex) => {
    if (ex.extensionType !== "external_senders")
      return false;
    const decoded = decodeExternalSender(ex.extensionData, 0);
    if (decoded === void 0)
      throw new ValidationError("Could not decode external_sender extension");
    return constantTimeEqual(decoded[0].signaturePublicKey, signaturePublicKey);
  });
  if (externalSenderExtensionIndex === -1)
    throw new ValidationError("Could not find external_sender extension in groupContext.extensions");
  const result = await protectExternalProposalPublic(signaturePrivateKey, groupInfo.groupContext, authenticatedData, proposal, { senderType: "external", senderIndex: externalSenderExtensionIndex }, cs);
  return {
    wireformat: "mls_public_message",
    version: groupInfo.groupContext.version,
    publicMessage: result.publicMessage
  };
}

// node_modules/ts-mls/dist/src/requiredCapabilities.js
var requiredCapabilitiesEncoder = contramapBufferEncoders([varLenTypeEncoder(uint16Encoder), varLenTypeEncoder(uint16Encoder), varLenTypeEncoder(credentialTypeEncoder)], (rc) => [rc.extensionTypes, rc.proposalTypes, rc.credentialTypes]);
var encodeRequiredCapabilities = encode(requiredCapabilitiesEncoder);
var decodeRequiredCapabilities = mapDecoders([decodeVarLenType(decodeUint16), decodeVarLenType(decodeUint16), decodeVarLenType(decodeCredentialType)], (extensionTypes, proposalTypes, credentialTypes2) => ({ extensionTypes, proposalTypes, credentialTypes: credentialTypes2 }));

// node_modules/ts-mls/dist/src/authenticationService.js
var defaultAuthenticationService = {
  async validateCredential(_credential, _signaturePublicKey) {
    return true;
  }
};

// node_modules/ts-mls/dist/src/paddingConfig.js
var defaultPaddingConfig = { kind: "padUntilLength", padUntilLength: 256 };
function byteLengthToPad(encodedLength, config) {
  if (config.kind === "alwaysPad")
    return config.paddingLength;
  else
    return encodedLength >= config.padUntilLength ? 0 : config.padUntilLength - encodedLength;
}

// node_modules/ts-mls/dist/src/keyPackageEqualityConfig.js
var defaultKeyPackageEqualityConfig = {
  compareKeyPackages(a, b) {
    return constantTimeEqual(a.leafNode.signaturePublicKey, b.leafNode.signaturePublicKey);
  },
  compareKeyPackageToLeafNode(a, b) {
    return constantTimeEqual(a.leafNode.signaturePublicKey, b.signaturePublicKey);
  }
};

// node_modules/ts-mls/dist/src/lifetimeConfig.js
var defaultLifetimeConfig = {
  maximumTotalLifetime: 2628000n,
  // 1 month
  validateLifetimeOnReceive: false
};

// node_modules/ts-mls/dist/src/keyRetentionConfig.js
var defaultKeyRetentionConfig = {
  retainKeysForGenerations: 10,
  retainKeysForEpochs: 4,
  maximumForwardRatchetSteps: 200
};

// node_modules/ts-mls/dist/src/groupInfo.js
var groupInfoTBSEncoder = contramapBufferEncoders([groupContextEncoder, varLenTypeEncoder(extensionEncoder), varLenDataEncoder, uint32Encoder], (g) => [g.groupContext, g.extensions, g.confirmationTag, g.signer]);
var encodeGroupInfoTBS = encode(groupInfoTBSEncoder);
var decodeGroupInfoTBS = mapDecoders([decodeGroupContext, decodeVarLenType(decodeExtension), decodeVarLenData, decodeUint32], (groupContext, extensions, confirmationTag, signer) => ({
  groupContext,
  extensions,
  confirmationTag,
  signer
}));
var groupInfoEncoder = contramapBufferEncoders([groupInfoTBSEncoder, varLenDataEncoder], (g) => [g, g.signature]);
var encodeGroupInfo = encode(groupInfoEncoder);
var decodeGroupInfo = mapDecoders([decodeGroupInfoTBS, decodeVarLenData], (tbs, signature) => ({
  ...tbs,
  signature
}));
function ratchetTreeFromExtension(info) {
  const treeExtension = info.extensions.find((ex) => ex.extensionType === "ratchet_tree");
  if (treeExtension !== void 0) {
    const tree = decodeRatchetTree(treeExtension.extensionData, 0);
    if (tree === void 0)
      throw new CodecError("Could not decode RatchetTree");
    return tree[0];
  }
}
async function signGroupInfo(tbs, privateKey, s) {
  const signature = await signWithLabel(privateKey, "GroupInfoTBS", encode(groupInfoTBSEncoder)(tbs), s);
  return { ...tbs, signature };
}
function verifyGroupInfoSignature(gi, publicKey, s) {
  return verifyWithLabel(publicKey, "GroupInfoTBS", encode(groupInfoTBSEncoder)(gi), gi.signature, s);
}
async function verifyGroupInfoConfirmationTag(gi, joinerSecret, pskSecret, cs) {
  const epochSecret = await extractEpochSecret(gi.groupContext, joinerSecret, cs.kdf, pskSecret);
  const key = await deriveSecret(epochSecret, "confirm", cs.kdf);
  return cs.hash.verifyMac(key, gi.confirmationTag, gi.groupContext.confirmedTranscriptHash);
}
async function extractWelcomeSecret(joinerSecret, pskSecret, kdf) {
  return deriveSecret(await kdf.extract(joinerSecret, pskSecret), "welcome", kdf);
}

// node_modules/ts-mls/dist/src/keySchedule.js
var keyScheduleEncoder = contramapBufferEncoders([
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder,
  varLenDataEncoder
], (ks) => [
  new Uint8Array(),
  ks.senderDataSecret,
  new Uint8Array(),
  ks.exporterSecret,
  ks.externalSecret,
  ks.confirmationKey,
  ks.membershipKey,
  ks.resumptionPsk,
  ks.epochAuthenticator,
  ks.initSecret
]);
var encodeKeySchedule = encode(keyScheduleEncoder);
var decodeKeySchedule = mapDecoders([
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData,
  decodeVarLenData
], (_epochSecret, senderDataSecret, _encryptionSecret, exporterSecret, externalSecret, confirmationKey, membershipKey, resumptionPsk, epochAuthenticator, initSecret) => ({
  senderDataSecret,
  exporterSecret,
  externalSecret,
  confirmationKey,
  membershipKey,
  resumptionPsk,
  epochAuthenticator,
  initSecret
}));
async function mlsExporter(exporterSecret, label, context, length, cs) {
  const secret = await deriveSecret(exporterSecret, label, cs.kdf);
  const hash = await cs.hash.digest(context);
  return expandWithLabel(secret, "exported", hash, length, cs.kdf);
}
async function deriveKeySchedule(joinerSecret, pskSecret, groupContext, kdf) {
  const epochSecret = await extractEpochSecret(groupContext, joinerSecret, kdf, pskSecret);
  const encryptionSecret = await deriveSecret(epochSecret, "encryption", kdf);
  const keySchedule = await initializeKeySchedule(epochSecret, kdf);
  return [keySchedule, encryptionSecret];
}
async function initializeKeySchedule(epochSecret, kdf) {
  const newInitSecret = await deriveSecret(epochSecret, "init", kdf);
  const senderDataSecret = await deriveSecret(epochSecret, "sender data", kdf);
  const exporterSecret = await deriveSecret(epochSecret, "exporter", kdf);
  const externalSecret = await deriveSecret(epochSecret, "external", kdf);
  const confirmationKey = await deriveSecret(epochSecret, "confirm", kdf);
  const membershipKey = await deriveSecret(epochSecret, "membership", kdf);
  const resumptionPsk = await deriveSecret(epochSecret, "resumption", kdf);
  const epochAuthenticator = await deriveSecret(epochSecret, "authentication", kdf);
  const newKeySchedule = {
    initSecret: newInitSecret,
    senderDataSecret,
    exporterSecret,
    externalSecret,
    confirmationKey,
    membershipKey,
    resumptionPsk,
    epochAuthenticator
  };
  return newKeySchedule;
}
async function initializeEpoch(initSecret, commitSecret, groupContext, pskSecret, kdf) {
  const joinerSecret = await extractJoinerSecret(groupContext, initSecret, commitSecret, kdf);
  const welcomeSecret = await extractWelcomeSecret(joinerSecret, pskSecret, kdf);
  const [newKeySchedule, encryptionSecret] = await deriveKeySchedule(joinerSecret, pskSecret, groupContext, kdf);
  return { welcomeSecret, joinerSecret, encryptionSecret, keySchedule: newKeySchedule };
}

// node_modules/ts-mls/dist/src/secretTree.js
var generationSecretEncoder = contramapBufferEncoders([varLenDataEncoder, uint32Encoder, numberRecordEncoder(uint32Encoder, varLenDataEncoder)], (gs) => [gs.secret, gs.generation, gs.unusedGenerations]);
var decodeGenerationSecret = mapDecoders([decodeVarLenData, decodeUint32, decodeNumberRecord(decodeUint32, decodeVarLenData)], (secret, generation, unusedGenerations) => ({
  secret,
  generation,
  unusedGenerations
}));
var secretTreeNodeEncoder = contramapBufferEncoders([generationSecretEncoder, generationSecretEncoder], (node) => [node.handshake, node.application]);
var decodeSecretTreeNode = mapDecoders([decodeGenerationSecret, decodeGenerationSecret], (handshake, application) => ({
  handshake,
  application
}));
var secretTreeEncoder = varLenTypeEncoder(secretTreeNodeEncoder);
var decodeSecretTree = decodeVarLenType(decodeSecretTreeNode);
function allSecretTreeValues(tree) {
  const arr = new Array(tree.length * 2);
  for (const node of tree) {
    arr.push(node.application.secret);
    arr.push(node.handshake.secret);
    for (const gen of Object.values(node.application.unusedGenerations)) {
      arr.push(gen);
    }
    for (const gen of Object.values(node.handshake.unusedGenerations)) {
      arr.push(gen);
    }
  }
  return arr;
}
function scaffoldSecretTree(leafWidth2, encryptionSecret, kdf) {
  const tree = new Array(nodeWidth(leafWidth2));
  const rootIndex = root(leafWidth2);
  tree[rootIndex] = encryptionSecret;
  return deriveChildren(tree, rootIndex, kdf);
}
async function createSecretTree(leafWidth2, encryptionSecret, kdf) {
  const tree = await scaffoldSecretTree(leafWidth2, encryptionSecret, kdf);
  return await Promise.all(tree.map(async (secret) => {
    const application = await createRatchetRoot(secret, "application", kdf);
    const handshake = await createRatchetRoot(secret, "handshake", kdf);
    return { handshake, application };
  }));
}
async function deriveChildren(tree, nodeIndex, kdf) {
  if (isLeaf(nodeIndex))
    return tree;
  const l = left(nodeIndex);
  const r = right(nodeIndex);
  const parentSecret = tree[nodeIndex];
  if (parentSecret === void 0)
    throw new InternalError("Bad node index for secret tree");
  const leftSecret = await expandWithLabel(parentSecret, "tree", new TextEncoder().encode("left"), kdf.size, kdf);
  const rightSecret = await expandWithLabel(parentSecret, "tree", new TextEncoder().encode("right"), kdf.size, kdf);
  tree[l] = leftSecret;
  tree[r] = rightSecret;
  return deriveChildren(await deriveChildren(tree, l, kdf), r, kdf);
}
async function deriveNonce(secret, generation, cs) {
  return await deriveTreeSecret(secret, "nonce", generation, cs.hpke.nonceLength, cs.kdf);
}
async function deriveKey(secret, generation, cs) {
  return await deriveTreeSecret(secret, "key", generation, cs.hpke.keyLength, cs.kdf);
}
async function ratchetUntil(current, desiredGen, config, kdf) {
  const generationDifference = desiredGen - current.generation;
  if (generationDifference > config.maximumForwardRatchetSteps)
    throw new ValidationError("Desired generation too far in the future");
  const consumed = [];
  let result = { ...current };
  for (let i = 0; i < generationDifference; i++) {
    const nextSecret = await deriveTreeSecret(result.secret, "secret", result.generation, kdf.size, kdf);
    const [updated, old] = updateUnusedGenerations(result, config.retainKeysForGenerations);
    consumed.push(...old);
    result = {
      secret: nextSecret,
      generation: result.generation + 1,
      unusedGenerations: updated
    };
  }
  return [result, consumed];
}
function updateUnusedGenerations(s, retainGenerationsMax) {
  const withNew = { ...s.unusedGenerations, [s.generation]: s.secret };
  const generations = Object.keys(withNew);
  const result = generations.length >= retainGenerationsMax ? removeOldGenerations(withNew, retainGenerationsMax) : [withNew, []];
  return result;
}
function removeOldGenerations(unusedGenerations, max) {
  const generations = Object.keys(unusedGenerations).map(Number).sort((a, b) => a - b);
  const cutoff = generations.length - max;
  const consumed = new Array();
  const record = {};
  for (const [n, gen] of generations.entries()) {
    const value = unusedGenerations[gen];
    if (n < cutoff) {
      consumed.push(value);
    } else {
      record[gen] = value;
    }
  }
  return [record, consumed];
}
async function derivePrivateMessageNonce(secret, generation, reuseGuard, cs) {
  const nonce = await deriveNonce(secret, generation, cs);
  if (nonce.length >= 4 && reuseGuard.length >= 4) {
    for (let i = 0; i < 4; i++) {
      nonce[i] ^= reuseGuard[i];
    }
  } else
    throw new ValidationError("Reuse guard or nonce incorrect length");
  return nonce;
}
async function ratchetToGeneration(tree, senderData, contentType, config, cs) {
  const index = leafToNodeIndex(toLeafIndex(senderData.leafIndex));
  const node = tree[index];
  if (node === void 0)
    throw new InternalError("Bad node index for secret tree");
  const ratchet = ratchetForContentType(node, contentType);
  if (ratchet.generation > senderData.generation) {
    const desired = ratchet.unusedGenerations[senderData.generation];
    if (desired !== void 0) {
      const { [senderData.generation]: _, ...removedDesiredGen } = ratchet.unusedGenerations;
      const ratchetState = { ...ratchet, unusedGenerations: removedDesiredGen };
      return await createRatchetResultWithSecret(node, index, desired, senderData.generation, senderData.reuseGuard, tree, contentType, [], cs, ratchetState);
    }
    throw new ValidationError("Desired gen in the past");
  }
  const [currentSecret, consumed] = await ratchetUntil(ratchetForContentType(node, contentType), senderData.generation, config, cs.kdf);
  return createRatchetResult(node, index, currentSecret, senderData.reuseGuard, tree, contentType, consumed, cs);
}
async function consumeRatchet(tree, index, contentType, cs) {
  const node = tree[index];
  if (node === void 0)
    throw new InternalError("Bad node index for secret tree");
  const currentSecret = ratchetForContentType(node, contentType);
  const reuseGuard = cs.rng.randomBytes(4);
  return createRatchetResult(node, index, currentSecret, reuseGuard, tree, contentType, [], cs);
}
async function createRatchetResult(node, index, currentSecret, reuseGuard, tree, contentType, consumed, cs) {
  const nextSecret = await deriveTreeSecret(currentSecret.secret, "secret", currentSecret.generation, cs.kdf.size, cs.kdf);
  const ratchetState = { ...currentSecret, secret: nextSecret, generation: currentSecret.generation + 1 };
  return await createRatchetResultWithSecret(node, index, currentSecret.secret, currentSecret.generation, reuseGuard, tree, contentType, consumed, cs, ratchetState);
}
async function createRatchetResultWithSecret(node, index, secret, generation, reuseGuard, tree, contentType, consumed, cs, ratchetState) {
  const { nonce, key } = await createKeyAndNonce(secret, generation, reuseGuard, cs);
  const newNode = contentType === "application" ? { ...node, application: ratchetState } : { ...node, handshake: ratchetState };
  const newTree = tree.slice();
  newTree[index] = newNode;
  return {
    generation,
    reuseGuard,
    nonce,
    key,
    newTree,
    consumed: [...consumed, secret, key]
  };
}
async function createKeyAndNonce(secret, generation, reuseGuard, cs) {
  const key = await deriveKey(secret, generation, cs);
  const nonce = await derivePrivateMessageNonce(secret, generation, reuseGuard, cs);
  return { nonce, key };
}
function ratchetForContentType(node, contentType) {
  switch (contentType) {
    case "application":
      return node.application;
    case "proposal":
      return node.handshake;
    case "commit":
      return node.handshake;
  }
}
async function createRatchetRoot(node, label, kdf) {
  const secret = await expandWithLabel(node, label, new Uint8Array(), kdf.size, kdf);
  return { secret, generation: 0, unusedGenerations: {} };
}

// node_modules/ts-mls/dist/src/transcriptHash.js
var confirmedTranscriptHashInputEncoder = contramapBufferEncoders([wireformatEncoder, framedContentEncoder, varLenDataEncoder], (input) => [input.wireformat, input.content, input.signature]);
var encodeConfirmedTranscriptHashInput = encode(confirmedTranscriptHashInputEncoder);
var decodeConfirmedTranscriptHashInput = mapDecodersOption([decodeWireformat, decodeFramedContent, decodeVarLenData], (wireformat, content, signature) => {
  if (content.contentType === "commit")
    return {
      wireformat,
      content,
      signature
    };
  else
    return void 0;
});
function createConfirmedHash(interimTranscriptHash, input, hash) {
  const [len, write] = confirmedTranscriptHashInputEncoder(input);
  const buf = new ArrayBuffer(interimTranscriptHash.byteLength + len);
  const arr = new Uint8Array(buf);
  arr.set(interimTranscriptHash, 0);
  write(interimTranscriptHash.byteLength, buf);
  return hash.digest(arr);
}
function createInterimHash(confirmedHash, confirmationTag, hash) {
  const [len, write] = varLenDataEncoder(confirmationTag);
  const buf = new ArrayBuffer(confirmedHash.byteLength + len);
  const arr = new Uint8Array(buf);
  arr.set(confirmedHash, 0);
  write(confirmedHash.byteLength, buf);
  return hash.digest(arr);
}

// node_modules/ts-mls/dist/src/groupSecrets.js
var groupSecretsEncoder = contramapBufferEncoders([varLenDataEncoder, optionalEncoder(varLenDataEncoder), varLenTypeEncoder(pskIdEncoder)], (gs) => [gs.joinerSecret, gs.pathSecret, gs.psks]);
var encodeGroupSecrets = encode(groupSecretsEncoder);
var decodeGroupSecrets = mapDecoders([decodeVarLenData, decodeOptional(decodeVarLenData), decodeVarLenType(decodePskId)], (joinerSecret, pathSecret, psks) => ({ joinerSecret, pathSecret, psks }));

// node_modules/ts-mls/dist/src/welcome.js
var encryptedGroupSecretsEncoder = contramapBufferEncoders([varLenDataEncoder, hpkeCiphertextEncoder], (egs) => [egs.newMember, egs.encryptedGroupSecrets]);
var encodeEncryptedGroupSecrets = encode(encryptedGroupSecretsEncoder);
var decodeEncryptedGroupSecrets = mapDecoders([decodeVarLenData, decodeHpkeCiphertext], (newMember, encryptedGroupSecrets) => ({ newMember, encryptedGroupSecrets }));
var welcomeEncoder = contramapBufferEncoders([ciphersuiteEncoder, varLenTypeEncoder(encryptedGroupSecretsEncoder), varLenDataEncoder], (welcome) => [welcome.cipherSuite, welcome.secrets, welcome.encryptedGroupInfo]);
var encodeWelcome = encode(welcomeEncoder);
var decodeWelcome = mapDecoders([decodeCiphersuite, decodeVarLenType(decodeEncryptedGroupSecrets), decodeVarLenData], (cipherSuite, secrets, encryptedGroupInfo) => ({ cipherSuite, secrets, encryptedGroupInfo }));
function welcomeNonce(welcomeSecret, cs) {
  return expandWithLabel(welcomeSecret, "nonce", new Uint8Array(), cs.hpke.nonceLength, cs.kdf);
}
function welcomeKey(welcomeSecret, cs) {
  return expandWithLabel(welcomeSecret, "key", new Uint8Array(), cs.hpke.keyLength, cs.kdf);
}
async function encryptGroupInfo(groupInfo, welcomeSecret, cs) {
  const key = await welcomeKey(welcomeSecret, cs);
  const nonce = await welcomeNonce(welcomeSecret, cs);
  const encrypted = await cs.hpke.encryptAead(key, nonce, void 0, encode(groupInfoEncoder)(groupInfo));
  return encrypted;
}
async function decryptGroupInfo(w, joinerSecret, pskSecret, cs) {
  const welcomeSecret = await extractWelcomeSecret(joinerSecret, pskSecret, cs.kdf);
  const key = await welcomeKey(welcomeSecret, cs);
  const nonce = await welcomeNonce(welcomeSecret, cs);
  const decrypted = await cs.hpke.decryptAead(key, nonce, void 0, w.encryptedGroupInfo);
  const decoded = decodeGroupInfo(decrypted, 0);
  return decoded?.[0];
}
function encryptGroupSecrets(initKey, encryptedGroupInfo, groupSecrets, hpke) {
  return encryptWithLabel(initKey, "Welcome", encryptedGroupInfo, encode(groupSecretsEncoder)(groupSecrets), hpke);
}
async function decryptGroupSecrets(initPrivateKey, keyPackageRef, welcome, hpke) {
  const secret = welcome.secrets.find((s) => constantTimeEqual(s.newMember, keyPackageRef));
  if (secret === void 0)
    throw new ValidationError("No matching secret found");
  const decrypted = await decryptWithLabel(initPrivateKey, "Welcome", welcome.encryptedGroupInfo, secret.encryptedGroupSecrets.kemOutput, secret.encryptedGroupSecrets.ciphertext, hpke);
  return decodeGroupSecrets(decrypted, 0)?.[0];
}

// node_modules/ts-mls/dist/src/pathSecrets.js
function pathToPathSecrets(pathSecrets) {
  return pathSecrets.reduce((acc, cur) => ({
    ...acc,
    [cur.nodeIndex]: cur.secret
  }), {});
}
async function pathToRoot(tree, nodeIndex, pathSecret, kdf) {
  const rootIndex = root(leafWidth(tree.length));
  let currentIndex = nodeIndex;
  const pathSecrets = { [nodeIndex]: pathSecret };
  while (currentIndex != rootIndex) {
    const nextIndex = findFirstNonBlankAncestor(tree, currentIndex);
    const nextSecret = await deriveSecret(pathSecrets[currentIndex], "path", kdf);
    pathSecrets[nextIndex] = nextSecret;
    currentIndex = nextIndex;
  }
  return pathSecrets;
}

// node_modules/ts-mls/dist/src/privateKeyPath.js
var privateKeyPathEncoder = contramapBufferEncoders([uint32Encoder, numberRecordEncoder(uint32Encoder, varLenDataEncoder)], (pkp) => [pkp.leafIndex, pkp.privateKeys]);
var decodePrivateKeyPath = mapDecoders([decodeUint32, decodeNumberRecord(decodeUint32, decodeVarLenData)], (leafIndex, privateKeys) => ({
  leafIndex,
  privateKeys
}));
function mergePrivateKeyPaths(a, b) {
  return { ...a, privateKeys: { ...a.privateKeys, ...b.privateKeys } };
}
function updateLeafKey(path, newKey) {
  return { ...path, privateKeys: { ...path.privateKeys, [leafToNodeIndex(toLeafIndex(path.leafIndex))]: newKey } };
}
async function toPrivateKeyPath(pathSecrets, leafIndex, cs) {
  const asArray = await Promise.all(Object.entries(pathSecrets).map(async ([nodeIndex, pathSecret]) => {
    const nodeSecret = await deriveSecret(pathSecret, "node", cs.kdf);
    const { privateKey } = await cs.hpke.deriveKeyPair(nodeSecret);
    return [Number(nodeIndex), await cs.hpke.exportPrivateKey(privateKey)];
  }));
  const privateKeys = Object.fromEntries(asArray);
  return { leafIndex, privateKeys };
}

// node_modules/ts-mls/dist/src/unappliedProposals.js
var proposalWithSenderEncoder = contramapBufferEncoders([proposalEncoder, optionalEncoder(uint32Encoder)], (pws) => [pws.proposal, pws.senderLeafIndex]);
var decodeProposalWithSender = mapDecoders([decodeProposal, decodeOptional(decodeUint32)], (proposal, senderLeafIndex) => ({
  proposal,
  senderLeafIndex
}));
var unappliedProposalsEncoder = base64RecordEncoder(proposalWithSenderEncoder);
var decodeUnappliedProposals = decodeBase64Record(decodeProposalWithSender);
function addUnappliedProposal(ref, proposals, proposal, senderLeafIndex) {
  const r = bytesToBase64(ref);
  return {
    ...proposals,
    [r]: { proposal, senderLeafIndex }
  };
}

// node_modules/ts-mls/dist/src/pskIndex.js
var emptyPskIndex = {
  findPsk(_preSharedKeyId) {
    return void 0;
  }
};
async function accumulatePskSecret(groupedPsk, pskSearch, cs, zeroes) {
  return groupedPsk.reduce(async (acc, cur, index) => {
    const [previousSecret, ids] = await acc;
    const psk = pskSearch.findPsk(cur);
    if (psk === void 0)
      throw new ValidationError("Could not find pskId referenced in proposal");
    const pskSecret = await updatePskSecret(previousSecret, cur, psk, index, groupedPsk.length, cs);
    return [pskSecret, [...ids, cur]];
  }, Promise.resolve([zeroes, []]));
}

// node_modules/ts-mls/dist/src/util/addToMap.js
function addToMap(map, k, v) {
  const copy = new Map(map);
  copy.set(k, v);
  return copy;
}

// node_modules/ts-mls/dist/src/clientConfig.js
var defaultClientConfig = {
  keyRetentionConfig: defaultKeyRetentionConfig,
  lifetimeConfig: defaultLifetimeConfig,
  keyPackageEqualityConfig: defaultKeyPackageEqualityConfig,
  paddingConfig: defaultPaddingConfig,
  authService: defaultAuthenticationService
};

// node_modules/ts-mls/dist/src/util/array.js
function arraysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  return a.every((val, index) => val === b[index]);
}

// node_modules/ts-mls/dist/src/codec/string.js
var stringEncoder = contramapBufferEncoder(varLenDataEncoder, (s) => new TextEncoder().encode(s));
var encodeString = encode(stringEncoder);
var decodeString = mapDecoder(decodeVarLenData, (u) => new TextDecoder().decode(u));

// node_modules/ts-mls/dist/src/groupActiveState.js
var activeEncoder = contramapBufferEncoder(stringEncoder, () => "active");
var suspendedPendingReinitEncoder = contramapBufferEncoders([stringEncoder, reinitEncoder], (s) => ["suspendedPendingReinit", s.reinit]);
var removedFromGroupEncoder = contramapBufferEncoder(stringEncoder, () => "removedFromGroup");
var groupActiveStateEncoder = (state) => {
  switch (state.kind) {
    case "active":
      return activeEncoder(state);
    case "suspendedPendingReinit":
      return suspendedPendingReinitEncoder(state);
    case "removedFromGroup":
      return removedFromGroupEncoder(state);
  }
};
var decodeGroupActiveState = flatMapDecoder(decodeString, (kind) => {
  switch (kind) {
    case "active":
      return succeedDecoder({ kind: "active" });
    case "suspendedPendingReinit":
      return mapDecoder(decodeReinit, (reinit) => ({ kind: "suspendedPendingReinit", reinit }));
    case "removedFromGroup":
      return succeedDecoder({ kind: "removedFromGroup" });
    default:
      return failDecoder();
  }
});

// node_modules/ts-mls/dist/src/epochReceiverData.js
var epochReceiverDataEncoder = contramapBufferEncoders([varLenDataEncoder, secretTreeEncoder, ratchetTreeEncoder, varLenDataEncoder, groupContextEncoder], (erd) => [erd.resumptionPsk, erd.secretTree, erd.ratchetTree, erd.senderDataSecret, erd.groupContext]);
var decodeEpochReceiverData = mapDecoders([decodeVarLenData, decodeSecretTree, decodeRatchetTree, decodeVarLenData, decodeGroupContext], (resumptionPsk, secretTree, ratchetTree, senderDataSecret, groupContext) => ({
  resumptionPsk,
  secretTree,
  ratchetTree,
  senderDataSecret,
  groupContext
}));

// node_modules/ts-mls/dist/src/clientState.js
var groupStateEncoder = contramapBufferEncoders([
  groupContextEncoder,
  keyScheduleEncoder,
  secretTreeEncoder,
  ratchetTreeEncoder,
  privateKeyPathEncoder,
  varLenDataEncoder,
  unappliedProposalsEncoder,
  varLenDataEncoder,
  bigintMapEncoder(epochReceiverDataEncoder),
  groupActiveStateEncoder
], (state) => [
  state.groupContext,
  state.keySchedule,
  state.secretTree,
  state.ratchetTree,
  state.privatePath,
  state.signaturePrivateKey,
  state.unappliedProposals,
  state.confirmationTag,
  state.historicalReceiverData,
  state.groupActiveState
]);
var encodeGroupState = encode(groupStateEncoder);
var decodeGroupState = mapDecoders([
  decodeGroupContext,
  decodeKeySchedule,
  decodeSecretTree,
  decodeRatchetTree,
  decodePrivateKeyPath,
  decodeVarLenData,
  decodeUnappliedProposals,
  decodeVarLenData,
  decodeBigintMap(decodeEpochReceiverData),
  decodeGroupActiveState
], (groupContext, keySchedule, secretTree, ratchetTree, privatePath, signaturePrivateKey, unappliedProposals, confirmationTag, historicalReceiverData, groupActiveState) => ({
  groupContext,
  keySchedule,
  secretTree,
  ratchetTree,
  privatePath,
  signaturePrivateKey,
  unappliedProposals,
  confirmationTag,
  historicalReceiverData,
  groupActiveState
}));
var groupStateEncoderWithoutTree = contramapBufferEncoders([
  groupContextEncoder,
  keyScheduleEncoder,
  secretTreeEncoder,
  privateKeyPathEncoder,
  varLenDataEncoder,
  unappliedProposalsEncoder,
  varLenDataEncoder,
  bigintMapEncoder(epochReceiverDataEncoder),
  groupActiveStateEncoder
], (state) => [
  state.groupContext,
  state.keySchedule,
  state.secretTree,
  state.privatePath,
  state.signaturePrivateKey,
  state.unappliedProposals,
  state.confirmationTag,
  state.historicalReceiverData,
  state.groupActiveState
]);
var encodeGroupStateWithoutTree = encode(groupStateEncoderWithoutTree);
function checkCanSendApplicationMessages(state) {
  if (Object.keys(state.unappliedProposals).length !== 0)
    throw new UsageError("Cannot send application message with unapplied proposals");
  checkCanSendHandshakeMessages(state);
}
function checkCanSendHandshakeMessages(state) {
  if (state.groupActiveState.kind === "suspendedPendingReinit")
    throw new UsageError("Cannot send messages while Group is suspended pending reinit");
  else if (state.groupActiveState.kind === "removedFromGroup")
    throw new UsageError("Cannot send messages after being removed from group");
}
var emptyProposals = {
  add: [],
  update: [],
  remove: [],
  psk: [],
  reinit: [],
  external_init: [],
  group_context_extensions: []
};
function flattenExtensions(groupContextExtensions) {
  return groupContextExtensions.reduce((acc, { proposal }) => {
    return [...acc, ...proposal.groupContextExtensions.extensions];
  }, []);
}
async function validateProposals(p, committerLeafIndex, groupContext, config, authService, tree) {
  const containsUpdateByCommitter = p.update.some((o) => o.senderLeafIndex !== void 0 && o.senderLeafIndex === committerLeafIndex);
  if (containsUpdateByCommitter)
    return new ValidationError("Commit cannot contain an update proposal sent by committer");
  const containsRemoveOfCommitter = p.remove.some((o) => o.proposal.remove.removed === committerLeafIndex);
  if (containsRemoveOfCommitter)
    return new ValidationError("Commit cannot contain a remove proposal removing committer");
  const multipleUpdateRemoveForSameLeaf = p.update.some(({ senderLeafIndex: a }, indexA) => p.update.some(({ senderLeafIndex: b }, indexB) => a === b && indexA !== indexB) || p.remove.some((r) => r.proposal.remove.removed === a)) || p.remove.some((a, indexA) => p.remove.some((b, indexB) => b.proposal.remove.removed === a.proposal.remove.removed && indexA !== indexB) || p.update.some(({ senderLeafIndex }) => a.proposal.remove.removed === senderLeafIndex));
  if (multipleUpdateRemoveForSameLeaf)
    return new ValidationError("Commit cannot contain multiple update and/or remove proposals that apply to the same leaf");
  const multipleAddsContainSameKeypackage = p.add.some(({ proposal: a }, indexA) => p.add.some(({ proposal: b }, indexB) => config.compareKeyPackages(a.add.keyPackage, b.add.keyPackage) && indexA !== indexB));
  if (multipleAddsContainSameKeypackage)
    return new ValidationError("Commit cannot contain multiple Add proposals that contain KeyPackages that represent the same client");
  const addsContainExistingKeypackage = p.add.some(({ proposal }) => tree.some((node, nodeIndex) => node !== void 0 && node.nodeType === "leaf" && config.compareKeyPackageToLeafNode(proposal.add.keyPackage, node.leaf) && p.remove.every((r) => r.proposal.remove.removed !== nodeToLeafIndex(toNodeIndex(nodeIndex)))));
  if (addsContainExistingKeypackage)
    return new ValidationError("Commit cannot contain an Add proposal for someone already in the group");
  const everyLeafSupportsGroupExtensions = p.add.every(({ proposal }) => extensionsSupportedByCapabilities(groupContext.extensions, proposal.add.keyPackage.leafNode.capabilities));
  if (!everyLeafSupportsGroupExtensions)
    return new ValidationError("Added leaf node that doesn't support extension in GroupContext");
  const multiplePskWithSamePskId = p.psk.some((a, indexA) => p.psk.some((b, indexB) => constantTimeEqual(encode(pskIdEncoder)(a.proposal.psk.preSharedKeyId), encode(pskIdEncoder)(b.proposal.psk.preSharedKeyId)) && indexA !== indexB));
  if (multiplePskWithSamePskId)
    return new ValidationError("Commit cannot contain PreSharedKey proposals that reference the same PreSharedKeyID");
  const multipleGroupContextExtensions = p.group_context_extensions.length > 1;
  if (multipleGroupContextExtensions)
    return new ValidationError("Commit cannot contain multiple GroupContextExtensions proposals");
  const allExtensions = flattenExtensions(p.group_context_extensions);
  const requiredCapabilities = allExtensions.find((e) => e.extensionType === "required_capabilities");
  if (requiredCapabilities !== void 0) {
    const caps = decodeRequiredCapabilities(requiredCapabilities.extensionData, 0);
    if (caps === void 0)
      return new CodecError("Could not decode required_capabilities");
    const everyLeafSupportsCapabilities = tree.filter((n) => n !== void 0 && n.nodeType === "leaf").every((l) => capabiltiesAreSupported(caps[0], l.leaf.capabilities));
    if (!everyLeafSupportsCapabilities)
      return new ValidationError("Not all members support required capabilities");
    const allAdditionsSupportCapabilities = p.add.every((a) => capabiltiesAreSupported(caps[0], a.proposal.add.keyPackage.leafNode.capabilities));
    if (!allAdditionsSupportCapabilities)
      return new ValidationError("Commit contains add proposals of member without required capabilities");
  }
  return await validateExternalSenders(allExtensions, authService);
}
async function validateExternalSenders(extensions, authService) {
  const externalSenders = extensions.filter((e) => e.extensionType === "external_senders");
  for (const externalSender of externalSenders) {
    const decoded = decodeExternalSender(externalSender.extensionData, 0);
    if (decoded === void 0)
      return new CodecError("Could not decode external_senders");
    const validCredential = await authService.validateCredential(decoded[0].credential, decoded[0].signaturePublicKey);
    if (!validCredential)
      return new ValidationError("Could not validate external credential");
  }
}
function capabiltiesAreSupported(caps, cs) {
  return caps.credentialTypes.every((c) => cs.credentials.includes(c)) && caps.extensionTypes.every((e) => cs.extensions.includes(e)) && caps.proposalTypes.every((p) => cs.proposals.includes(p));
}
async function validateRatchetTree(tree, groupContext, config, authService, treeHash2, cs) {
  const hpkeKeys = /* @__PURE__ */ new Set();
  const signatureKeys = /* @__PURE__ */ new Set();
  const credentialTypes2 = /* @__PURE__ */ new Set();
  for (const [i, n] of tree.entries()) {
    const nodeIndex = toNodeIndex(i);
    if (n?.nodeType === "leaf") {
      if (!isLeaf(nodeIndex))
        return new ValidationError("Received Ratchet Tree is not structurally sound");
      const hpkeKey = bytesToBase64(n.leaf.hpkePublicKey);
      if (hpkeKeys.has(hpkeKey))
        return new ValidationError("hpke keys not unique");
      else
        hpkeKeys.add(hpkeKey);
      const signatureKey = bytesToBase64(n.leaf.signaturePublicKey);
      if (signatureKeys.has(signatureKey))
        return new ValidationError("signature keys not unique");
      else
        signatureKeys.add(signatureKey);
      credentialTypes2.add(n.leaf.credential.credentialType);
      const err = n.leaf.leafNodeSource === "key_package" ? await validateLeafNodeKeyPackage(n.leaf, groupContext, false, config, authService, cs.signature) : await validateLeafNodeUpdateOrCommit(n.leaf, nodeToLeafIndex(nodeIndex), groupContext, authService, cs.signature);
      if (err !== void 0)
        return err;
    } else if (n?.nodeType === "parent") {
      if (isLeaf(nodeIndex))
        return new ValidationError("Received Ratchet Tree is not structurally sound");
      const hpkeKey = bytesToBase64(n.parent.hpkePublicKey);
      if (hpkeKeys.has(hpkeKey))
        return new ValidationError("hpke keys not unique");
      else
        hpkeKeys.add(hpkeKey);
      for (const unmergedLeaf of n.parent.unmergedLeaves) {
        const leafIndex = toLeafIndex(unmergedLeaf);
        const dp = directPath(leafToNodeIndex(leafIndex), leafWidth(tree.length));
        const nodeIndex2 = leafToNodeIndex(leafIndex);
        if (tree[nodeIndex2]?.nodeType !== "leaf" && !dp.includes(toNodeIndex(i)))
          return new ValidationError("Unmerged leaf did not represent a non-blank descendant leaf node");
        for (const parentIdx of dp) {
          const dpNode = tree[parentIdx];
          if (dpNode !== void 0) {
            if (dpNode.nodeType !== "parent")
              return new InternalError("Expected parent node");
            if (!arraysEqual(dpNode.parent.unmergedLeaves, n.parent.unmergedLeaves))
              return new ValidationError("non-blank intermediate node must list leaf node in its unmerged_leaves");
          }
        }
      }
    }
  }
  for (const n of tree) {
    if (n?.nodeType === "leaf") {
      for (const credentialType of credentialTypes2) {
        if (!n.leaf.capabilities.credentials.includes(credentialType))
          return new ValidationError("LeafNode has credential that is not supported by member of the group");
      }
    }
  }
  const parentHashesVerified = await verifyParentHashes(tree, cs.hash);
  if (!parentHashesVerified)
    return new CryptoVerificationError("Unable to verify parent hash");
  if (!constantTimeEqual(treeHash2, await treeHashRoot(tree, cs.hash)))
    return new ValidationError("Unable to verify tree hash");
}
async function validateLeafNodeUpdateOrCommit(leafNode, leafIndex, groupContext, authService, s) {
  const signatureValid = await verifyLeafNodeSignature(leafNode, groupContext.groupId, leafIndex, s);
  if (!signatureValid)
    return new CryptoVerificationError("Could not verify leaf node signature");
  const commonError = await validateLeafNodeCommon(leafNode, groupContext, authService);
  if (commonError !== void 0)
    return commonError;
}
function throwIfDefined(err) {
  if (err !== void 0)
    throw err;
}
async function validateLeafNodeCommon(leafNode, groupContext, authService) {
  const credentialValid = await authService.validateCredential(leafNode.credential, leafNode.signaturePublicKey);
  if (!credentialValid)
    return new ValidationError("Could not validate credential");
  const requiredCapabilities = groupContext.extensions.find((e) => e.extensionType === "required_capabilities");
  if (requiredCapabilities !== void 0) {
    const caps = decodeRequiredCapabilities(requiredCapabilities.extensionData, 0);
    if (caps === void 0)
      return new CodecError("Could not decode required_capabilities");
    const leafSupportsCapabilities = capabiltiesAreSupported(caps[0], leafNode.capabilities);
    if (!leafSupportsCapabilities)
      return new ValidationError("LeafNode does not support required capabilities");
  }
  const extensionsSupported = extensionsSupportedByCapabilities(leafNode.extensions, leafNode.capabilities);
  if (!extensionsSupported)
    return new ValidationError("LeafNode contains extension not listed in capabilities");
}
async function validateLeafNodeKeyPackage(leafNode, groupContext, sentByClient, config, authService, s) {
  const signatureValid = await verifyLeafNodeSignatureKeyPackage(leafNode, s);
  if (!signatureValid)
    return new CryptoVerificationError("Could not verify leaf node signature");
  if (sentByClient || config.validateLifetimeOnReceive) {
    if (leafNode.leafNodeSource === "key_package") {
      const currentTime = BigInt(Math.floor(Date.now() / 1e3));
      if (leafNode.lifetime.notBefore > currentTime || leafNode.lifetime.notAfter < currentTime)
        return new ValidationError("Current time not within Lifetime");
    }
  }
  const commonError = await validateLeafNodeCommon(leafNode, groupContext, authService);
  if (commonError !== void 0)
    return commonError;
}
async function validateLeafNodeCredentialAndKeyUniqueness(tree, leafNode, existingLeafIndex) {
  const hpkeKeys = /* @__PURE__ */ new Set();
  const signatureKeys = /* @__PURE__ */ new Set();
  for (const [nodeIndex, node] of tree.entries()) {
    if (node?.nodeType === "leaf") {
      if (!node.leaf.capabilities.credentials.includes(leafNode.credential.credentialType)) {
        return new ValidationError("LeafNode has credential that is not supported by member of the group");
      }
      const hpkeKey = bytesToBase64(node.leaf.hpkePublicKey);
      if (hpkeKeys.has(hpkeKey))
        return new ValidationError("hpke keys not unique");
      else
        hpkeKeys.add(hpkeKey);
      const signatureKey = bytesToBase64(node.leaf.signaturePublicKey);
      if (signatureKeys.has(signatureKey) && existingLeafIndex !== nodeToLeafIndex(toNodeIndex(nodeIndex)))
        return new ValidationError("signature keys not unique");
      else
        signatureKeys.add(signatureKey);
    } else if (node?.nodeType === "parent") {
      const hpkeKey = bytesToBase64(node.parent.hpkePublicKey);
      if (hpkeKeys.has(hpkeKey))
        return new ValidationError("hpke keys not unique");
      else
        hpkeKeys.add(hpkeKey);
    }
  }
}
async function validateKeyPackage(kp, groupContext, tree, sentByClient, config, authService, s) {
  if (kp.cipherSuite !== groupContext.cipherSuite)
    return new ValidationError("Invalid CipherSuite");
  if (kp.version !== groupContext.version)
    return new ValidationError("Invalid mls version");
  const leafNodeConsistentWithTree = await validateLeafNodeCredentialAndKeyUniqueness(tree, kp.leafNode);
  if (leafNodeConsistentWithTree !== void 0)
    return leafNodeConsistentWithTree;
  const leafNodeError = await validateLeafNodeKeyPackage(kp.leafNode, groupContext, sentByClient, config, authService, s);
  if (leafNodeError !== void 0)
    return leafNodeError;
  const signatureValid = await verifyKeyPackage(kp, s);
  if (!signatureValid)
    return new CryptoVerificationError("Invalid keypackage signature");
  if (constantTimeEqual(kp.initKey, kp.leafNode.hpkePublicKey))
    return new ValidationError("Cannot have identicial init and encryption keys");
}
function validateReinit(allProposals, reinit, gc) {
  if (allProposals.length !== 1)
    return new ValidationError("Reinit proposal needs to be commited by itself");
  if (protocolVersions[reinit.version] < protocolVersions[gc.version])
    return new ValidationError("A ReInit proposal cannot use a version less than the version for the current group");
}
function validateExternalInit(grouped) {
  if (grouped.external_init.length > 1)
    return new ValidationError("Cannot contain more than one external_init proposal");
  if (grouped.remove.length > 1)
    return new ValidationError("Cannot contain more than one remove proposal");
  if (grouped.add.length > 0 || grouped.group_context_extensions.length > 0 || grouped.reinit.length > 0 || grouped.update.length > 0)
    return new ValidationError("Invalid proposals");
}
function validateRemove(remove, tree) {
  if (tree[leafToNodeIndex(toLeafIndex(remove.removed))] === void 0)
    return new ValidationError("Tried to remove empty leaf node");
}
async function applyProposals(state, proposals, committerLeafIndex, pskSearch, sentByClient, cs) {
  const allProposals = proposals.reduce((acc, cur) => {
    if (cur.proposalOrRefType === "proposal")
      return [...acc, { proposal: cur.proposal, senderLeafIndex: committerLeafIndex }];
    const p = state.unappliedProposals[bytesToBase64(cur.reference)];
    if (p === void 0)
      throw new ValidationError("Could not find proposal with supplied reference");
    return [...acc, p];
  }, []);
  const grouped = allProposals.reduce((acc, cur) => {
    if (typeof cur.proposal.proposalType === "number")
      return acc;
    const proposal = acc[cur.proposal.proposalType] ?? [];
    return { ...acc, [cur.proposal.proposalType]: [...proposal, cur] };
  }, emptyProposals);
  const zeroes = new Uint8Array(cs.kdf.size);
  const isExternalInit = grouped.external_init.length > 0;
  if (!isExternalInit) {
    if (grouped.reinit.length > 0) {
      const reinit = grouped.reinit.at(0).proposal.reinit;
      throwIfDefined(validateReinit(allProposals, reinit, state.groupContext));
      return {
        tree: state.ratchetTree,
        pskSecret: zeroes,
        pskIds: [],
        needsUpdatePath: false,
        additionalResult: {
          kind: "reinit",
          reinit
        },
        selfRemoved: false,
        allProposals
      };
    }
    throwIfDefined(await validateProposals(grouped, committerLeafIndex, state.groupContext, state.clientConfig.keyPackageEqualityConfig, state.clientConfig.authService, state.ratchetTree));
    const newExtensions = flattenExtensions(grouped.group_context_extensions);
    const [mutatedTree, addedLeafNodes] = await applyTreeMutations(state.ratchetTree, grouped, state.groupContext, sentByClient, state.clientConfig.authService, state.clientConfig.lifetimeConfig, cs.signature);
    const [updatedPskSecret, pskIds] = await accumulatePskSecret(grouped.psk.map((p) => p.proposal.psk.preSharedKeyId), pskSearch, cs, zeroes);
    const selfRemoved = mutatedTree[leafToNodeIndex(toLeafIndex(state.privatePath.leafIndex))] === void 0;
    const needsUpdatePath = allProposals.length === 0 || Object.values(grouped.update).length > 0 || Object.values(grouped.remove).length > 0;
    return {
      tree: mutatedTree,
      pskSecret: updatedPskSecret,
      additionalResult: {
        kind: "memberCommit",
        addedLeafNodes,
        extensions: newExtensions
      },
      pskIds,
      needsUpdatePath,
      selfRemoved,
      allProposals
    };
  } else {
    throwIfDefined(validateExternalInit(grouped));
    const treeAfterRemove = grouped.remove.reduce((acc, { proposal }) => {
      return removeLeafNode(acc, toLeafIndex(proposal.remove.removed));
    }, state.ratchetTree);
    const zeroes2 = new Uint8Array(cs.kdf.size);
    const [updatedPskSecret, pskIds] = await accumulatePskSecret(grouped.psk.map((p) => p.proposal.psk.preSharedKeyId), pskSearch, cs, zeroes2);
    const initProposal = grouped.external_init.at(0);
    const externalKeyPair = await cs.hpke.deriveKeyPair(state.keySchedule.externalSecret);
    const externalInitSecret = await importSecret(await cs.hpke.exportPrivateKey(externalKeyPair.privateKey), initProposal.proposal.externalInit.kemOutput, cs);
    return {
      needsUpdatePath: true,
      tree: treeAfterRemove,
      pskSecret: updatedPskSecret,
      pskIds,
      additionalResult: {
        kind: "externalCommit",
        externalInitSecret,
        newMemberLeafIndex: nodeToLeafIndex(findBlankLeafNodeIndexOrExtend(treeAfterRemove))
      },
      selfRemoved: false,
      allProposals
    };
  }
}
function makePskIndex(state, externalPsks) {
  return {
    findPsk(preSharedKeyId) {
      if (preSharedKeyId.psktype === "external") {
        return externalPsks[bytesToBase64(preSharedKeyId.pskId)];
      }
      if (state !== void 0 && constantTimeEqual(preSharedKeyId.pskGroupId, state.groupContext.groupId)) {
        if (preSharedKeyId.pskEpoch === state.groupContext.epoch)
          return state.keySchedule.resumptionPsk;
        else
          return state.historicalReceiverData.get(preSharedKeyId.pskEpoch)?.resumptionPsk;
      }
    }
  };
}
async function nextEpochContext(groupContext, wireformat, content, signature, updatedTreeHash, confirmationTag, h) {
  const interimTranscriptHash = await createInterimHash(groupContext.confirmedTranscriptHash, confirmationTag, h);
  const newConfirmedHash = await createConfirmedHash(interimTranscriptHash, { wireformat, content, signature }, h);
  return {
    ...groupContext,
    epoch: groupContext.epoch + 1n,
    treeHash: updatedTreeHash,
    confirmedTranscriptHash: newConfirmedHash
  };
}
async function joinGroup(welcome, keyPackage, privateKeys, pskSearch, cs, ratchetTree, resumingFromState, clientConfig = defaultClientConfig) {
  const res = await joinGroupWithExtensions(welcome, keyPackage, privateKeys, pskSearch, cs, ratchetTree, resumingFromState, clientConfig);
  return res[0];
}
async function joinGroupWithExtensions(welcome, keyPackage, privateKeys, pskSearch, cs, ratchetTree, resumingFromState, clientConfig = defaultClientConfig) {
  const keyPackageRef = await makeKeyPackageRef(keyPackage, cs.hash);
  const privKey = await cs.hpke.importPrivateKey(privateKeys.initPrivateKey);
  const groupSecrets = await decryptGroupSecrets(privKey, keyPackageRef, welcome, cs.hpke);
  if (groupSecrets === void 0)
    throw new CodecError("Could not decode group secrets");
  const zeroes = new Uint8Array(cs.kdf.size);
  const [pskSecret, pskIds] = await accumulatePskSecret(groupSecrets.psks, pskSearch, cs, zeroes);
  const gi = await decryptGroupInfo(welcome, groupSecrets.joinerSecret, pskSecret, cs);
  if (gi === void 0)
    throw new CodecError("Could not decode group info");
  const resumptionPsk = pskIds.find((id2) => id2.psktype === "resumption");
  if (resumptionPsk !== void 0) {
    if (resumingFromState === void 0)
      throw new ValidationError("No prior state passed for resumption");
    if (resumptionPsk.pskEpoch !== resumingFromState.groupContext.epoch)
      throw new ValidationError("Epoch mismatch");
    if (!constantTimeEqual(resumptionPsk.pskGroupId, resumingFromState.groupContext.groupId))
      throw new ValidationError("old groupId mismatch");
    if (gi.groupContext.epoch !== 1n)
      throw new ValidationError("Resumption must be started at epoch 1");
    if (resumptionPsk.usage === "reinit") {
      if (resumingFromState.groupActiveState.kind !== "suspendedPendingReinit")
        throw new ValidationError("Found reinit psk but no old suspended clientState");
      if (!constantTimeEqual(resumingFromState.groupActiveState.reinit.groupId, gi.groupContext.groupId))
        throw new ValidationError("new groupId mismatch");
      if (resumingFromState.groupActiveState.reinit.version !== gi.groupContext.version)
        throw new ValidationError("Version mismatch");
      if (resumingFromState.groupActiveState.reinit.cipherSuite !== gi.groupContext.cipherSuite)
        throw new ValidationError("Ciphersuite mismatch");
      if (!extensionsEqual(resumingFromState.groupActiveState.reinit.extensions, gi.groupContext.extensions))
        throw new ValidationError("Extensions mismatch");
    }
  }
  const allExtensionsSupported = extensionsSupportedByCapabilities(gi.groupContext.extensions, keyPackage.leafNode.capabilities);
  if (!allExtensionsSupported)
    throw new UsageError("client does not support every extension in the GroupContext");
  const tree = ratchetTreeFromExtension(gi) ?? ratchetTree;
  if (tree === void 0)
    throw new UsageError("No RatchetTree passed and no ratchet_tree extension");
  const signerNode = tree[leafToNodeIndex(toLeafIndex(gi.signer))];
  if (signerNode === void 0) {
    throw new ValidationError("Could not find signer leafNode");
  }
  if (signerNode.nodeType === "parent")
    throw new ValidationError("Expected non blank leaf node");
  const credentialVerified = await clientConfig.authService.validateCredential(signerNode.leaf.credential, signerNode.leaf.signaturePublicKey);
  if (!credentialVerified)
    throw new ValidationError("Could not validate credential");
  const groupInfoSignatureVerified = await verifyGroupInfoSignature(gi, signerNode.leaf.signaturePublicKey, cs.signature);
  if (!groupInfoSignatureVerified)
    throw new CryptoVerificationError("Could not verify groupInfo signature");
  if (gi.groupContext.cipherSuite !== keyPackage.cipherSuite)
    throw new ValidationError("cipher suite in the GroupInfo does not match the cipher_suite in the KeyPackage");
  throwIfDefined(await validateRatchetTree(tree, gi.groupContext, clientConfig.lifetimeConfig, clientConfig.authService, gi.groupContext.treeHash, cs));
  const newLeaf = findLeafIndex(tree, keyPackage.leafNode);
  if (newLeaf === void 0)
    throw new ValidationError("Could not find own leaf when processing welcome");
  const privateKeyPath = {
    leafIndex: newLeaf,
    privateKeys: { [leafToNodeIndex(newLeaf)]: privateKeys.hpkePrivateKey }
  };
  const ancestorNodeIndex = firstCommonAncestor(tree, newLeaf, toLeafIndex(gi.signer));
  const updatedPkp = groupSecrets.pathSecret === void 0 ? privateKeyPath : mergePrivateKeyPaths(await toPrivateKeyPath(await pathToRoot(tree, ancestorNodeIndex, groupSecrets.pathSecret, cs.kdf), newLeaf, cs), privateKeyPath);
  const [keySchedule, encryptionSecret] = await deriveKeySchedule(groupSecrets.joinerSecret, pskSecret, gi.groupContext, cs.kdf);
  const confirmationTagVerified = await verifyGroupInfoConfirmationTag(gi, groupSecrets.joinerSecret, pskSecret, cs);
  if (!confirmationTagVerified)
    throw new CryptoVerificationError("Could not verify confirmation tag");
  const secretTree = await createSecretTree(leafWidth(tree.length), encryptionSecret, cs.kdf);
  zeroOutUint8Array(encryptionSecret);
  zeroOutUint8Array(groupSecrets.joinerSecret);
  return [
    {
      groupContext: gi.groupContext,
      ratchetTree: tree,
      privatePath: updatedPkp,
      signaturePrivateKey: privateKeys.signaturePrivateKey,
      confirmationTag: gi.confirmationTag,
      unappliedProposals: {},
      keySchedule,
      secretTree,
      historicalReceiverData: /* @__PURE__ */ new Map(),
      groupActiveState: { kind: "active" },
      clientConfig
    },
    gi.extensions
  ];
}
async function createGroup(groupId, keyPackage, privateKeyPackage, extensions, cs, clientConfig = defaultClientConfig) {
  const ratchetTree = [{ nodeType: "leaf", leaf: keyPackage.leafNode }];
  const privatePath = {
    leafIndex: 0,
    privateKeys: { [0]: privateKeyPackage.hpkePrivateKey }
  };
  const confirmedTranscriptHash = new Uint8Array();
  const groupContext = {
    version: "mls10",
    cipherSuite: cs.name,
    epoch: 0n,
    treeHash: await treeHashRoot(ratchetTree, cs.hash),
    groupId,
    extensions,
    confirmedTranscriptHash
  };
  throwIfDefined(await validateExternalSenders(extensions, clientConfig.authService));
  const epochSecret = cs.rng.randomBytes(cs.kdf.size);
  const keySchedule = await initializeKeySchedule(epochSecret, cs.kdf);
  const confirmationTag = await createConfirmationTag(keySchedule.confirmationKey, confirmedTranscriptHash, cs.hash);
  const encryptionSecret = await deriveSecret(epochSecret, "encryption", cs.kdf);
  const secretTree = await createSecretTree(1, encryptionSecret, cs.kdf);
  zeroOutUint8Array(epochSecret);
  return {
    ratchetTree,
    keySchedule,
    secretTree,
    privatePath,
    signaturePrivateKey: privateKeyPackage.signaturePrivateKey,
    unappliedProposals: {},
    historicalReceiverData: /* @__PURE__ */ new Map(),
    groupContext,
    confirmationTag,
    groupActiveState: { kind: "active" },
    clientConfig
  };
}
async function exportSecret(publicKey, cs) {
  return cs.hpke.exportSecret(await cs.hpke.importPublicKey(publicKey), new TextEncoder().encode("MLS 1.0 external init secret"), cs.kdf.size, new Uint8Array());
}
async function importSecret(privateKey, kemOutput, cs) {
  return cs.hpke.importSecret(await cs.hpke.importPrivateKey(privateKey), new TextEncoder().encode("MLS 1.0 external init secret"), kemOutput, cs.kdf.size, new Uint8Array());
}
async function applyTreeMutations(ratchetTree, grouped, gc, sentByClient, authService, lifetimeConfig, s) {
  const treeAfterUpdate = await grouped.update.reduce(async (acc, { senderLeafIndex, proposal }) => {
    if (senderLeafIndex === void 0)
      throw new InternalError("No sender index found for update proposal");
    throwIfDefined(await validateLeafNodeUpdateOrCommit(proposal.update.leafNode, senderLeafIndex, gc, authService, s));
    throwIfDefined(await validateLeafNodeCredentialAndKeyUniqueness(ratchetTree, proposal.update.leafNode, senderLeafIndex));
    return updateLeafNode(await acc, proposal.update.leafNode, toLeafIndex(senderLeafIndex));
  }, Promise.resolve(ratchetTree));
  const treeAfterRemove = grouped.remove.reduce((acc, { proposal }) => {
    throwIfDefined(validateRemove(proposal.remove, ratchetTree));
    return removeLeafNode(acc, toLeafIndex(proposal.remove.removed));
  }, treeAfterUpdate);
  const [treeAfterAdd, addedLeafNodes] = await grouped.add.reduce(async (acc, { proposal }) => {
    throwIfDefined(await validateKeyPackage(proposal.add.keyPackage, gc, ratchetTree, sentByClient, lifetimeConfig, authService, s));
    const [tree, ws] = await acc;
    const [updatedTree, leafNodeIndex] = addLeafNode(tree, proposal.add.keyPackage.leafNode);
    return [
      updatedTree,
      [...ws, [nodeToLeafIndex(leafNodeIndex), proposal.add.keyPackage]]
    ];
  }, Promise.resolve([treeAfterRemove, []]));
  return [treeAfterAdd, addedLeafNodes];
}
async function processProposal(state, content, proposal, h) {
  const ref = await makeProposalRef(content, h);
  return {
    ...state,
    unappliedProposals: addUnappliedProposal(ref, state.unappliedProposals, proposal, getSenderLeafNodeIndex(content.content.sender))
  };
}
function addHistoricalReceiverData(state) {
  const withNew = addToMap(state.historicalReceiverData, state.groupContext.epoch, {
    secretTree: state.secretTree,
    ratchetTree: state.ratchetTree,
    senderDataSecret: state.keySchedule.senderDataSecret,
    groupContext: state.groupContext,
    resumptionPsk: state.keySchedule.resumptionPsk
  });
  const epochs = [...withNew.keys()];
  const result = epochs.length >= state.clientConfig.keyRetentionConfig.retainKeysForEpochs ? removeOldHistoricalReceiverData(withNew, state.clientConfig.keyRetentionConfig.retainKeysForEpochs) : [withNew, []];
  return result;
}
function removeOldHistoricalReceiverData(historicalReceiverData, max) {
  const sortedEpochs = [...historicalReceiverData.keys()].sort((a, b) => a < b ? -1 : 1);
  const cutoff = sortedEpochs.length - max;
  const toBeDeleted = new Array();
  const map = /* @__PURE__ */ new Map();
  for (const [n, epoch] of sortedEpochs.entries()) {
    const data = historicalReceiverData.get(epoch);
    if (n < cutoff) {
      toBeDeleted.push(...allSecretTreeValues(data.secretTree));
    } else {
      map.set(epoch, data);
    }
  }
  return [new Map(sortedEpochs.slice(-max).map((epoch) => [epoch, historicalReceiverData.get(epoch)])), []];
}

// node_modules/ts-mls/dist/src/privateMessage.js
var privateMessageEncoder = contramapBufferEncoders([varLenDataEncoder, uint64Encoder, contentTypeEncoder, varLenDataEncoder, varLenDataEncoder, varLenDataEncoder], (msg) => [msg.groupId, msg.epoch, msg.contentType, msg.authenticatedData, msg.encryptedSenderData, msg.ciphertext]);
var encodePrivateMessage = encode(privateMessageEncoder);
var decodePrivateMessage = mapDecoders([decodeVarLenData, decodeUint64, decodeContentType, decodeVarLenData, decodeVarLenData, decodeVarLenData], (groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext) => ({
  groupId,
  epoch,
  contentType,
  authenticatedData,
  encryptedSenderData,
  ciphertext
}));
var privateContentAADEncoder = contramapBufferEncoders([varLenDataEncoder, uint64Encoder, contentTypeEncoder, varLenDataEncoder], (aad) => [aad.groupId, aad.epoch, aad.contentType, aad.authenticatedData]);
var encodePrivateContentAAD = encode(privateContentAADEncoder);
var decodePrivateContentAAD = mapDecoders([decodeVarLenData, decodeUint64, decodeContentType, decodeVarLenData], (groupId, epoch, contentType, authenticatedData) => ({
  groupId,
  epoch,
  contentType,
  authenticatedData
}));
function decodePrivateMessageContent(contentType) {
  switch (contentType) {
    case "application":
      return decoderWithPadding(mapDecoders([decodeVarLenData, decodeVarLenData], (applicationData, signature) => ({
        contentType,
        applicationData,
        auth: { contentType, signature }
      })));
    case "proposal":
      return decoderWithPadding(mapDecoders([decodeProposal, decodeVarLenData], (proposal, signature) => ({
        contentType,
        proposal,
        auth: { contentType, signature }
      })));
    case "commit":
      return decoderWithPadding(mapDecoders([decodeCommit, decodeVarLenData, decodeFramedContentAuthDataCommit], (commit, signature, auth) => ({
        contentType,
        commit,
        auth: { ...auth, signature, contentType }
      })));
  }
}
function privateMessageContentEncoder(config) {
  return (msg) => {
    switch (msg.contentType) {
      case "application":
        return encoderWithPadding(contramapBufferEncoders([varLenDataEncoder, framedContentAuthDataEncoder], (m) => [m.applicationData, m.auth]), config)(msg);
      case "proposal":
        return encoderWithPadding(contramapBufferEncoders([proposalEncoder, framedContentAuthDataEncoder], (m) => [m.proposal, m.auth]), config)(msg);
      case "commit":
        return encoderWithPadding(contramapBufferEncoders([commitEncoder, framedContentAuthDataEncoder], (m) => [m.commit, m.auth]), config)(msg);
    }
  };
}
function encodePrivateMessageContent(config) {
  return encode(privateMessageContentEncoder(config));
}
async function decryptSenderData(msg, senderDataSecret, cs) {
  const key = await expandSenderDataKey(cs, senderDataSecret, msg.ciphertext);
  const nonce = await expandSenderDataNonce(cs, senderDataSecret, msg.ciphertext);
  const aad = {
    groupId: msg.groupId,
    epoch: msg.epoch,
    contentType: msg.contentType
  };
  const decrypted = await cs.hpke.decryptAead(key, nonce, encode(senderDataAADEncoder)(aad), msg.encryptedSenderData);
  return decodeSenderData(decrypted, 0)?.[0];
}
async function encryptSenderData(senderDataSecret, senderData, aad, ciphertext, cs) {
  const key = await expandSenderDataKey(cs, senderDataSecret, ciphertext);
  const nonce = await expandSenderDataNonce(cs, senderDataSecret, ciphertext);
  return await cs.hpke.encryptAead(key, nonce, encode(senderDataAADEncoder)(aad), encode(senderDataEncoder)(senderData));
}
function toAuthenticatedContent(content, msg, senderLeafIndex) {
  return {
    wireformat: "mls_private_message",
    content: {
      groupId: msg.groupId,
      epoch: msg.epoch,
      sender: {
        senderType: "member",
        leafIndex: senderLeafIndex
      },
      authenticatedData: msg.authenticatedData,
      ...content
    },
    auth: content.auth
  };
}
function encoderWithPadding(encoder, config) {
  return (t) => {
    const [len, write] = encoder(t);
    const totalLength = len + byteLengthToPad(len, config);
    return [
      totalLength,
      (offset, buffer) => {
        write(offset, buffer);
      }
    ];
  };
}
function decoderWithPadding(decoder) {
  return (bytes, offset) => {
    const result = decoder(bytes, offset);
    if (result === void 0)
      return void 0;
    const [decoded, innerOffset] = result;
    const paddingBytes = bytes.subarray(offset + innerOffset, bytes.length);
    const allZeroes = paddingBytes.every((byte2) => byte2 === 0);
    if (!allZeroes)
      return void 0;
    return [decoded, bytes.length];
  };
}

// node_modules/ts-mls/dist/src/messageProtection.js
async function protectApplicationData(signKey, senderDataSecret, applicationData, authenticatedData, groupContext, secretTree, leafIndex, paddingConfig, cs) {
  const tbs = {
    protocolVersion: groupContext.version,
    wireformat: "mls_private_message",
    content: {
      contentType: "application",
      applicationData,
      groupId: groupContext.groupId,
      epoch: groupContext.epoch,
      sender: {
        senderType: "member",
        leafIndex
      },
      authenticatedData
    },
    senderType: "member",
    context: groupContext
  };
  const auth = await signFramedContentApplicationOrProposal(signKey, tbs, cs);
  const content = {
    ...tbs.content,
    auth
  };
  const result = await protect(senderDataSecret, authenticatedData, groupContext, secretTree, content, leafIndex, paddingConfig, cs);
  return { newSecretTree: result.tree, privateMessage: result.privateMessage, consumed: result.consumed };
}
async function protectProposal(signKey, senderDataSecret, p, authenticatedData, groupContext, secretTree, leafIndex, paddingConfig, cs) {
  const tbs = {
    protocolVersion: groupContext.version,
    wireformat: "mls_private_message",
    content: {
      contentType: "proposal",
      proposal: p,
      groupId: groupContext.groupId,
      epoch: groupContext.epoch,
      sender: {
        senderType: "member",
        leafIndex
      },
      authenticatedData
    },
    senderType: "member",
    context: groupContext
  };
  const auth = await signFramedContentApplicationOrProposal(signKey, tbs, cs);
  const content = { ...tbs.content, auth };
  const protectResult = await protect(senderDataSecret, authenticatedData, groupContext, secretTree, content, leafIndex, paddingConfig, cs);
  const newSecretTree = protectResult.tree;
  const authenticatedContent = {
    wireformat: "mls_private_message",
    content,
    auth
  };
  const proposalRef = await makeProposalRef(authenticatedContent, cs.hash);
  return { privateMessage: protectResult.privateMessage, newSecretTree, proposalRef, consumed: protectResult.consumed };
}
async function protect(senderDataSecret, authenticatedData, groupContext, secretTree, content, leafIndex, config, cs) {
  const node = secretTree[leafToNodeIndex(toLeafIndex(leafIndex))];
  if (node === void 0)
    throw new InternalError("Bad node index for secret tree");
  const { newTree, generation, reuseGuard, nonce, key, consumed } = await consumeRatchet(secretTree, leafToNodeIndex(toLeafIndex(leafIndex)), content.contentType, cs);
  const aad = {
    groupId: groupContext.groupId,
    epoch: groupContext.epoch,
    contentType: content.contentType,
    authenticatedData
  };
  const ciphertext = await cs.hpke.encryptAead(key, nonce, encode(privateContentAADEncoder)(aad), encodePrivateMessageContent(config)(content));
  const senderData = {
    leafIndex,
    generation,
    reuseGuard
  };
  const senderAad = {
    groupId: groupContext.groupId,
    epoch: groupContext.epoch,
    contentType: content.contentType
  };
  const encryptedSenderData = await encryptSenderData(senderDataSecret, senderData, senderAad, ciphertext, cs);
  return {
    privateMessage: {
      groupId: groupContext.groupId,
      epoch: groupContext.epoch,
      encryptedSenderData,
      contentType: content.contentType,
      authenticatedData,
      ciphertext
    },
    tree: newTree,
    consumed
  };
}
async function unprotectPrivateMessage(senderDataSecret, msg, secretTree, ratchetTree, groupContext, config, cs, overrideSignatureKey) {
  const senderData = await decryptSenderData(msg, senderDataSecret, cs);
  if (senderData === void 0)
    throw new CodecError("Could not decode senderdata");
  validateSenderData(senderData, ratchetTree);
  const { key, nonce, newTree, consumed } = await ratchetToGeneration(secretTree, senderData, msg.contentType, config, cs);
  const aad = {
    groupId: msg.groupId,
    epoch: msg.epoch,
    contentType: msg.contentType,
    authenticatedData: msg.authenticatedData
  };
  const decrypted = await cs.hpke.decryptAead(key, nonce, encode(privateContentAADEncoder)(aad), msg.ciphertext);
  const pmc = decodePrivateMessageContent(msg.contentType)(decrypted, 0)?.[0];
  if (pmc === void 0)
    throw new CodecError("Could not decode PrivateMessageContent");
  const content = toAuthenticatedContent(pmc, msg, senderData.leafIndex);
  const signaturePublicKey = overrideSignatureKey !== void 0 ? overrideSignatureKey : getSignaturePublicKeyFromLeafIndex(ratchetTree, toLeafIndex(senderData.leafIndex));
  const signatureValid = await verifyFramedContentSignature(signaturePublicKey, "mls_private_message", content.content, content.auth, groupContext, cs.signature);
  if (!signatureValid)
    throw new CryptoVerificationError("Signature invalid");
  return { tree: newTree, content, consumed };
}
function validateSenderData(senderData, tree) {
  if (tree[leafToNodeIndex(toLeafIndex(senderData.leafIndex))]?.nodeType !== "leaf")
    return new ValidationError("SenderData did not point to a non-blank leaf node");
}

// node_modules/ts-mls/dist/src/createMessage.js
async function createProposal(state, publicMessage, proposal, cs, authenticatedData = new Uint8Array()) {
  if (publicMessage) {
    const result = await protectProposalPublic(state.signaturePrivateKey, state.keySchedule.membershipKey, state.groupContext, authenticatedData, proposal, state.privatePath.leafIndex, cs);
    const newState = await processProposal(state, { content: result.publicMessage.content, auth: result.publicMessage.auth, wireformat: "mls_public_message" }, proposal, cs.hash);
    return {
      newState,
      message: { wireformat: "mls_public_message", version: "mls10", publicMessage: result.publicMessage },
      consumed: []
    };
  } else {
    const result = await protectProposal(state.signaturePrivateKey, state.keySchedule.senderDataSecret, proposal, authenticatedData, state.groupContext, state.secretTree, state.privatePath.leafIndex, state.clientConfig.paddingConfig, cs);
    const newState = {
      ...state,
      secretTree: result.newSecretTree,
      unappliedProposals: addUnappliedProposal(result.proposalRef, state.unappliedProposals, proposal, state.privatePath.leafIndex)
    };
    return {
      newState,
      message: { wireformat: "mls_private_message", version: "mls10", privateMessage: result.privateMessage },
      consumed: result.consumed
    };
  }
}
async function createApplicationMessage(state, message, cs, authenticatedData = new Uint8Array()) {
  checkCanSendApplicationMessages(state);
  const result = await protectApplicationData(state.signaturePrivateKey, state.keySchedule.senderDataSecret, message, authenticatedData, state.groupContext, state.secretTree, state.privatePath.leafIndex, state.clientConfig.paddingConfig, cs);
  return {
    newState: { ...state, secretTree: result.newSecretTree },
    privateMessage: result.privateMessage,
    consumed: result.consumed
  };
}

// node_modules/ts-mls/dist/src/createCommit.js
async function createCommit(context, options) {
  const { state, pskIndex = makePskIndex(state, {}), cipherSuite } = context;
  const { wireAsPublicMessage = false, extraProposals = [], ratchetTreeExtension = false, authenticatedData = new Uint8Array(), groupInfoExtensions = [] } = options ?? {};
  checkCanSendHandshakeMessages(state);
  const wireformat = wireAsPublicMessage ? "mls_public_message" : "mls_private_message";
  const allProposals = bundleAllProposals(state, extraProposals);
  const res = await applyProposals(state, allProposals, toLeafIndex(state.privatePath.leafIndex), pskIndex, true, cipherSuite);
  if (res.additionalResult.kind === "externalCommit")
    throw new UsageError("Cannot create externalCommit as a member");
  const suspendedPendingReinit = res.additionalResult.kind === "reinit" ? res.additionalResult.reinit : void 0;
  const [tree, updatePath, pathSecrets, newPrivateKey] = res.needsUpdatePath ? await createUpdatePath(res.tree, toLeafIndex(state.privatePath.leafIndex), state.groupContext, state.signaturePrivateKey, cipherSuite) : [res.tree, void 0, [], void 0];
  const updatedExtensions = res.additionalResult.kind === "memberCommit" && res.additionalResult.extensions.length > 0 ? res.additionalResult.extensions : state.groupContext.extensions;
  const groupContextWithExtensions = { ...state.groupContext, extensions: updatedExtensions };
  const privateKeys = mergePrivateKeyPaths(newPrivateKey !== void 0 ? updateLeafKey(state.privatePath, await cipherSuite.hpke.exportPrivateKey(newPrivateKey)) : state.privatePath, await toPrivateKeyPath(pathToPathSecrets(pathSecrets), state.privatePath.leafIndex, cipherSuite));
  const lastPathSecret = pathSecrets.at(-1);
  const commitSecret = lastPathSecret === void 0 ? new Uint8Array(cipherSuite.kdf.size) : await deriveSecret(lastPathSecret.secret, "path", cipherSuite.kdf);
  const { signature, framedContent } = await createContentCommitSignature(state.groupContext, wireformat, { proposals: allProposals, path: updatePath }, { senderType: "member", leafIndex: state.privatePath.leafIndex }, authenticatedData, state.signaturePrivateKey, cipherSuite.signature);
  const treeHash2 = await treeHashRoot(tree, cipherSuite.hash);
  const updatedGroupContext = await nextEpochContext(groupContextWithExtensions, wireformat, framedContent, signature, treeHash2, state.confirmationTag, cipherSuite.hash);
  const epochSecrets = await initializeEpoch(state.keySchedule.initSecret, commitSecret, updatedGroupContext, res.pskSecret, cipherSuite.kdf);
  const confirmationTag = await createConfirmationTag(epochSecrets.keySchedule.confirmationKey, updatedGroupContext.confirmedTranscriptHash, cipherSuite.hash);
  const authData = {
    contentType: framedContent.contentType,
    signature,
    confirmationTag
  };
  const [commit, _newTree, consumedSecrets] = await protectCommit(wireAsPublicMessage, state, authenticatedData, framedContent, authData, cipherSuite);
  const welcome = await createWelcome(ratchetTreeExtension, updatedGroupContext, confirmationTag, state, tree, cipherSuite, epochSecrets, res, pathSecrets, groupInfoExtensions);
  const groupActiveState = res.selfRemoved ? { kind: "removedFromGroup" } : suspendedPendingReinit !== void 0 ? { kind: "suspendedPendingReinit", reinit: suspendedPendingReinit } : { kind: "active" };
  const [historicalReceiverData, consumedEpochData] = addHistoricalReceiverData(state);
  const newState = {
    groupContext: updatedGroupContext,
    ratchetTree: tree,
    secretTree: await createSecretTree(leafWidth(tree.length), epochSecrets.encryptionSecret, cipherSuite.kdf),
    keySchedule: epochSecrets.keySchedule,
    privatePath: privateKeys,
    unappliedProposals: {},
    historicalReceiverData,
    confirmationTag,
    signaturePrivateKey: state.signaturePrivateKey,
    groupActiveState,
    clientConfig: state.clientConfig
  };
  zeroOutUint8Array(commitSecret);
  zeroOutUint8Array(epochSecrets.encryptionSecret);
  zeroOutUint8Array(epochSecrets.joinerSecret);
  const consumed = [...consumedSecrets, ...consumedEpochData, state.keySchedule.initSecret];
  return { newState, welcome, commit, consumed };
}
function bundleAllProposals(state, extraProposals) {
  const refs = Object.keys(state.unappliedProposals).map((p) => ({
    proposalOrRefType: "reference",
    reference: base64ToBytes(p)
  }));
  const proposals = extraProposals.map((p) => ({ proposalOrRefType: "proposal", proposal: p }));
  return [...refs, ...proposals];
}
async function createWelcome(ratchetTreeExtension, groupContext, confirmationTag, state, tree, cs, epochSecrets, res, pathSecrets, extensions) {
  const groupInfo = ratchetTreeExtension ? await createGroupInfoWithRatchetTree(groupContext, confirmationTag, state, tree, extensions, cs) : await createGroupInfo(groupContext, confirmationTag, state, extensions, cs);
  const encryptedGroupInfo = await encryptGroupInfo(groupInfo, epochSecrets.welcomeSecret, cs);
  const encryptedGroupSecrets = res.additionalResult.kind === "memberCommit" ? await Promise.all(res.additionalResult.addedLeafNodes.map(([leafNodeIndex, keyPackage]) => {
    return createEncryptedGroupSecrets(tree, leafNodeIndex, state, pathSecrets, cs, keyPackage, encryptedGroupInfo, epochSecrets, res);
  })) : [];
  return encryptedGroupSecrets.length > 0 ? {
    cipherSuite: groupContext.cipherSuite,
    secrets: encryptedGroupSecrets,
    encryptedGroupInfo
  } : void 0;
}
async function createEncryptedGroupSecrets(tree, leafNodeIndex, state, pathSecrets, cs, keyPackage, encryptedGroupInfo, epochSecrets, res) {
  const nodeIndex = firstCommonAncestor(tree, leafNodeIndex, toLeafIndex(state.privatePath.leafIndex));
  const pathSecret = pathSecrets.find((ps) => ps.nodeIndex === nodeIndex);
  const pk = await cs.hpke.importPublicKey(keyPackage.initKey);
  const egs = await encryptGroupSecrets(pk, encryptedGroupInfo, { joinerSecret: epochSecrets.joinerSecret, pathSecret: pathSecret?.secret, psks: res.pskIds }, cs.hpke);
  const ref = await makeKeyPackageRef(keyPackage, cs.hash);
  return { newMember: ref, encryptedGroupSecrets: { kemOutput: egs.enc, ciphertext: egs.ct } };
}
async function createGroupInfo(groupContext, confirmationTag, state, extensions, cs) {
  const groupInfoTbs = {
    groupContext,
    extensions,
    confirmationTag,
    signer: state.privatePath.leafIndex
  };
  return signGroupInfo(groupInfoTbs, state.signaturePrivateKey, cs.signature);
}
async function createGroupInfoWithRatchetTree(groupContext, confirmationTag, state, tree, extensions, cs) {
  const encodedTree = encode(ratchetTreeEncoder)(tree);
  const gi = await createGroupInfo(groupContext, confirmationTag, state, [...extensions, { extensionType: "ratchet_tree", extensionData: encodedTree }], cs);
  return gi;
}
async function createGroupInfoWithExternalPub(state, extensions, cs) {
  const externalKeyPair = await cs.hpke.deriveKeyPair(state.keySchedule.externalSecret);
  const externalPub = await cs.hpke.exportPublicKey(externalKeyPair.publicKey);
  const gi = await createGroupInfo(state.groupContext, state.confirmationTag, state, [...extensions, { extensionType: "external_pub", extensionData: externalPub }], cs);
  return gi;
}
async function createGroupInfoWithExternalPubAndRatchetTree(state, extensions, cs) {
  const encodedTree = encode(ratchetTreeEncoder)(state.ratchetTree);
  const externalKeyPair = await cs.hpke.deriveKeyPair(state.keySchedule.externalSecret);
  const externalPub = await cs.hpke.exportPublicKey(externalKeyPair.publicKey);
  const gi = await createGroupInfo(state.groupContext, state.confirmationTag, state, [
    ...extensions,
    { extensionType: "external_pub", extensionData: externalPub },
    { extensionType: "ratchet_tree", extensionData: encodedTree }
  ], cs);
  return gi;
}
async function protectCommit(publicMessage, state, authenticatedData, content, authData, cs) {
  const wireformat = publicMessage ? "mls_public_message" : "mls_private_message";
  const authenticatedContent = {
    wireformat,
    content,
    auth: authData
  };
  if (publicMessage) {
    const msg = await protectPublicMessage(state.keySchedule.membershipKey, state.groupContext, authenticatedContent, cs);
    return [{ version: "mls10", wireformat: "mls_public_message", publicMessage: msg }, state.secretTree, []];
  } else {
    const res = await protect(state.keySchedule.senderDataSecret, authenticatedData, state.groupContext, state.secretTree, { ...content, auth: authData }, state.privatePath.leafIndex, state.clientConfig.paddingConfig, cs);
    return [
      { version: "mls10", wireformat: "mls_private_message", privateMessage: res.privateMessage },
      res.tree,
      res.consumed
    ];
  }
}
async function applyUpdatePathSecret(tree, privatePath, senderLeafIndex, gc, path, excludeNodes, cs) {
  const { nodeIndex: ancestorNodeIndex, resolution: resolution2, updateNode } = firstMatchAncestor(tree, toLeafIndex(privatePath.leafIndex), senderLeafIndex, path);
  for (const [i, nodeIndex] of filterNewLeaves(resolution2, excludeNodes).entries()) {
    if (privatePath.privateKeys[nodeIndex] !== void 0) {
      const key = await cs.hpke.importPrivateKey(privatePath.privateKeys[nodeIndex]);
      const ct = updateNode.encryptedPathSecret[i];
      const pathSecret = await decryptWithLabel(key, "UpdatePathNode", encode(groupContextEncoder)(gc), ct.kemOutput, ct.ciphertext, cs.hpke);
      return { nodeIndex: ancestorNodeIndex, pathSecret };
    }
  }
  throw new InternalError("No overlap between provided private keys and update path");
}
async function joinGroupExternal(groupInfo, keyPackage, privateKeys, resync, cs, tree, clientConfig = defaultClientConfig, authenticatedData = new Uint8Array()) {
  const externalPub = groupInfo.extensions.find((ex) => ex.extensionType === "external_pub");
  if (externalPub === void 0)
    throw new UsageError("Could not find external_pub extension");
  const allExtensionsSupported = extensionsSupportedByCapabilities(groupInfo.groupContext.extensions, keyPackage.leafNode.capabilities);
  if (!allExtensionsSupported)
    throw new UsageError("client does not support every extension in the GroupContext");
  const { enc, secret: initSecret } = await exportSecret(externalPub.extensionData, cs);
  const ratchetTree = ratchetTreeFromExtension(groupInfo) ?? tree;
  if (ratchetTree === void 0)
    throw new UsageError("No RatchetTree passed and no ratchet_tree extension");
  throwIfDefined(await validateRatchetTree(ratchetTree, groupInfo.groupContext, clientConfig.lifetimeConfig, clientConfig.authService, groupInfo.groupContext.treeHash, cs));
  const signaturePublicKey = getSignaturePublicKeyFromLeafIndex(ratchetTree, toLeafIndex(groupInfo.signer));
  const signerCredential = getCredentialFromLeafIndex(ratchetTree, toLeafIndex(groupInfo.signer));
  const credentialVerified = await clientConfig.authService.validateCredential(signerCredential, signaturePublicKey);
  if (!credentialVerified)
    throw new ValidationError("Could not validate credential");
  const groupInfoSignatureVerified = await verifyGroupInfoSignature(groupInfo, signaturePublicKey, cs.signature);
  if (!groupInfoSignatureVerified)
    throw new CryptoVerificationError("Could not verify groupInfo Signature");
  const formerLeafIndex = resync ? nodeToLeafIndex(toNodeIndex(ratchetTree.findIndex((n) => {
    if (n !== void 0 && n.nodeType === "leaf") {
      return clientConfig.keyPackageEqualityConfig.compareKeyPackageToLeafNode(keyPackage, n.leaf);
    }
    return false;
  }))) : void 0;
  const updatedTree = formerLeafIndex !== void 0 ? removeLeafNode(ratchetTree, formerLeafIndex) : ratchetTree;
  const [treeWithNewLeafNode, newLeafNodeIndex] = addLeafNode(updatedTree, keyPackage.leafNode);
  const [newTree, updatePath, pathSecrets, newPrivateKey] = await createUpdatePath(treeWithNewLeafNode, nodeToLeafIndex(newLeafNodeIndex), groupInfo.groupContext, privateKeys.signaturePrivateKey, cs);
  const privateKeyPath = updateLeafKey(await toPrivateKeyPath(pathToPathSecrets(pathSecrets), nodeToLeafIndex(newLeafNodeIndex), cs), await cs.hpke.exportPrivateKey(newPrivateKey));
  const lastPathSecret = pathSecrets.at(-1);
  const commitSecret = lastPathSecret === void 0 ? new Uint8Array(cs.kdf.size) : await deriveSecret(lastPathSecret.secret, "path", cs.kdf);
  const externalInitProposal = {
    proposalType: "external_init",
    externalInit: { kemOutput: enc }
  };
  const proposals = formerLeafIndex !== void 0 ? [{ proposalType: "remove", remove: { removed: formerLeafIndex } }, externalInitProposal] : [externalInitProposal];
  const pskSecret = new Uint8Array(cs.kdf.size);
  const { signature, framedContent } = await createContentCommitSignature(groupInfo.groupContext, "mls_public_message", { proposals: proposals.map((p) => ({ proposalOrRefType: "proposal", proposal: p })), path: updatePath }, {
    senderType: "new_member_commit"
  }, authenticatedData, privateKeys.signaturePrivateKey, cs.signature);
  const treeHash2 = await treeHashRoot(newTree, cs.hash);
  const groupContext = await nextEpochContext(groupInfo.groupContext, "mls_public_message", framedContent, signature, treeHash2, groupInfo.confirmationTag, cs.hash);
  const epochSecrets = await initializeEpoch(initSecret, commitSecret, groupContext, pskSecret, cs.kdf);
  const confirmationTag = await createConfirmationTag(epochSecrets.keySchedule.confirmationKey, groupContext.confirmedTranscriptHash, cs.hash);
  const state = {
    ratchetTree: newTree,
    groupContext,
    secretTree: await createSecretTree(leafWidth(newTree.length), epochSecrets.encryptionSecret, cs.kdf),
    privatePath: privateKeyPath,
    confirmationTag,
    historicalReceiverData: /* @__PURE__ */ new Map(),
    signaturePrivateKey: privateKeys.signaturePrivateKey,
    keySchedule: epochSecrets.keySchedule,
    unappliedProposals: {},
    groupActiveState: { kind: "active" },
    clientConfig
  };
  const authenticatedContent = {
    content: framedContent,
    auth: { signature, confirmationTag, contentType: "commit" },
    wireformat: "mls_public_message"
  };
  const msg = await protectPublicMessage(epochSecrets.keySchedule.membershipKey, groupContext, authenticatedContent, cs);
  zeroOutUint8Array(commitSecret);
  zeroOutUint8Array(initSecret);
  zeroOutUint8Array(epochSecrets.encryptionSecret);
  zeroOutUint8Array(epochSecrets.joinerSecret);
  return { publicMessage: msg, newState: state };
}
function filterNewLeaves(resolution2, excludeNodes) {
  const set = new Set(excludeNodes);
  return resolution2.filter((i) => !set.has(i));
}

// node_modules/ts-mls/dist/src/processMessages.js
async function processPrivateMessage(state, pm, pskSearch, cs, callback = acceptAll) {
  if (pm.epoch < state.groupContext.epoch) {
    const receiverData = state.historicalReceiverData.get(pm.epoch);
    if (receiverData !== void 0) {
      const result2 = await unprotectPrivateMessage(receiverData.senderDataSecret, pm, receiverData.secretTree, receiverData.ratchetTree, receiverData.groupContext, state.clientConfig.keyRetentionConfig, cs);
      const newHistoricalReceiverData = addToMap(state.historicalReceiverData, pm.epoch, {
        ...receiverData,
        secretTree: result2.tree
      });
      const newState = { ...state, historicalReceiverData: newHistoricalReceiverData };
      if (result2.content.content.contentType === "application") {
        return {
          kind: "applicationMessage",
          message: result2.content.content.applicationData,
          newState,
          consumed: result2.consumed
        };
      } else {
        throw new ValidationError("Cannot process commit or proposal from former epoch");
      }
    } else {
      throw new ValidationError("Cannot process message, epoch too old");
    }
  }
  const result = await unprotectPrivateMessage(state.keySchedule.senderDataSecret, pm, state.secretTree, state.ratchetTree, state.groupContext, state.clientConfig.keyRetentionConfig, cs);
  const updatedState = { ...state, secretTree: result.tree };
  if (result.content.content.contentType === "application") {
    return {
      kind: "applicationMessage",
      message: result.content.content.applicationData,
      newState: updatedState,
      consumed: result.consumed
    };
  } else if (result.content.content.contentType === "commit") {
    const { newState, actionTaken, consumed } = await processCommit(updatedState, result.content, "mls_private_message", pskSearch, callback, cs);
    return {
      kind: "newState",
      newState,
      actionTaken,
      consumed: [...result.consumed, ...consumed]
    };
  } else {
    const action = callback({
      kind: "proposal",
      proposal: {
        proposal: result.content.content.proposal,
        senderLeafIndex: getSenderLeafNodeIndex(result.content.content.sender)
      }
    });
    if (action === "reject")
      return {
        kind: "newState",
        newState: updatedState,
        actionTaken: action,
        consumed: result.consumed
      };
    else
      return {
        kind: "newState",
        newState: await processProposal(updatedState, result.content, result.content.content.proposal, cs.hash),
        actionTaken: action,
        consumed: result.consumed
      };
  }
}
async function processPublicMessage(state, pm, pskSearch, cs, callback = acceptAll) {
  if (pm.content.epoch < state.groupContext.epoch)
    throw new ValidationError("Cannot process message, epoch too old");
  const content = await unprotectPublicMessage(state.keySchedule.membershipKey, state.groupContext, state.ratchetTree, pm, cs);
  if (content.content.contentType === "proposal") {
    const action = callback({
      kind: "proposal",
      proposal: { proposal: content.content.proposal, senderLeafIndex: getSenderLeafNodeIndex(content.content.sender) }
    });
    if (action === "reject")
      return {
        newState: state,
        actionTaken: action,
        consumed: []
      };
    else
      return {
        newState: await processProposal(state, content, content.content.proposal, cs.hash),
        actionTaken: action,
        consumed: []
      };
  } else {
    return processCommit(state, content, "mls_public_message", pskSearch, callback, cs);
  }
}
async function processCommit(state, content, wireformat, pskSearch, callback, cs) {
  if (content.content.epoch !== state.groupContext.epoch)
    throw new ValidationError("Could not validate epoch");
  const senderLeafIndex = content.content.sender.senderType === "member" ? toLeafIndex(content.content.sender.leafIndex) : void 0;
  const result = await applyProposals(state, content.content.commit.proposals, senderLeafIndex, pskSearch, false, cs);
  const action = callback({ kind: "commit", senderLeafIndex, proposals: result.allProposals });
  if (action === "reject") {
    return { newState: state, actionTaken: action, consumed: [] };
  }
  if (content.content.commit.path !== void 0) {
    const committerLeafIndex = senderLeafIndex ?? (result.additionalResult.kind === "externalCommit" ? result.additionalResult.newMemberLeafIndex : void 0);
    if (committerLeafIndex === void 0)
      throw new ValidationError("Cannot verify commit leaf node because no commiter leaf index found");
    throwIfDefined(await validateLeafNodeUpdateOrCommit(content.content.commit.path.leafNode, committerLeafIndex, state.groupContext, state.clientConfig.authService, cs.signature));
    throwIfDefined(await validateLeafNodeCredentialAndKeyUniqueness(result.tree, content.content.commit.path.leafNode, committerLeafIndex));
  }
  if (result.needsUpdatePath && content.content.commit.path === void 0)
    throw new ValidationError("Update path is required");
  const groupContextWithExtensions = result.additionalResult.kind === "memberCommit" && result.additionalResult.extensions.length > 0 ? { ...state.groupContext, extensions: result.additionalResult.extensions } : state.groupContext;
  const [pkp, commitSecret, tree] = await applyTreeUpdate(content.content.commit.path, content.content.sender, result.tree, cs, state, groupContextWithExtensions, result.additionalResult.kind === "memberCommit" ? result.additionalResult.addedLeafNodes.map((l) => leafToNodeIndex(toLeafIndex(l[0]))) : [findBlankLeafNodeIndex(result.tree) ?? toNodeIndex(result.tree.length + 1)], cs.kdf);
  const newTreeHash = await treeHashRoot(tree, cs.hash);
  if (content.auth.contentType !== "commit")
    throw new ValidationError("Received content as commit, but not auth");
  const updatedGroupContext = await nextEpochContext(groupContextWithExtensions, wireformat, content.content, content.auth.signature, newTreeHash, state.confirmationTag, cs.hash);
  const initSecret = result.additionalResult.kind === "externalCommit" ? result.additionalResult.externalInitSecret : state.keySchedule.initSecret;
  const epochSecrets = await initializeEpoch(initSecret, commitSecret, updatedGroupContext, result.pskSecret, cs.kdf);
  const confirmationTagValid = await verifyConfirmationTag(epochSecrets.keySchedule.confirmationKey, content.auth.confirmationTag, updatedGroupContext.confirmedTranscriptHash, cs.hash);
  if (!confirmationTagValid)
    throw new CryptoVerificationError("Could not verify confirmation tag");
  const secretTree = await createSecretTree(leafWidth(tree.length), epochSecrets.encryptionSecret, cs.kdf);
  const suspendedPendingReinit = result.additionalResult.kind === "reinit" ? result.additionalResult.reinit : void 0;
  const groupActiveState = result.selfRemoved ? { kind: "removedFromGroup" } : suspendedPendingReinit !== void 0 ? { kind: "suspendedPendingReinit", reinit: suspendedPendingReinit } : { kind: "active" };
  const [historicalReceiverData, consumedEpochData] = addHistoricalReceiverData(state);
  zeroOutUint8Array(commitSecret);
  zeroOutUint8Array(epochSecrets.joinerSecret);
  zeroOutUint8Array(epochSecrets.encryptionSecret);
  const consumed = [...consumedEpochData, initSecret];
  return {
    newState: {
      ...state,
      secretTree,
      ratchetTree: tree,
      privatePath: pkp,
      groupContext: updatedGroupContext,
      keySchedule: epochSecrets.keySchedule,
      confirmationTag: content.auth.confirmationTag,
      historicalReceiverData,
      unappliedProposals: {},
      groupActiveState
    },
    actionTaken: action,
    consumed
  };
}
async function applyTreeUpdate(path, sender, tree, cs, state, groupContext, excludeNodes, kdf) {
  if (path === void 0)
    return [state.privatePath, new Uint8Array(kdf.size), tree];
  if (sender.senderType === "member") {
    const updatedTree = await applyUpdatePath(tree, toLeafIndex(sender.leafIndex), path, cs.hash);
    const [pkp, commitSecret] = await updatePrivateKeyPath(updatedTree, state, toLeafIndex(sender.leafIndex), { ...groupContext, treeHash: await treeHashRoot(updatedTree, cs.hash), epoch: groupContext.epoch + 1n }, path, excludeNodes, cs);
    return [pkp, commitSecret, updatedTree];
  } else {
    const [treeWithLeafNode, leafNodeIndex] = addLeafNode(tree, path.leafNode);
    const senderLeafIndex = nodeToLeafIndex(leafNodeIndex);
    const updatedTree = await applyUpdatePath(treeWithLeafNode, senderLeafIndex, path, cs.hash, true);
    const [pkp, commitSecret] = await updatePrivateKeyPath(updatedTree, state, senderLeafIndex, { ...groupContext, treeHash: await treeHashRoot(updatedTree, cs.hash), epoch: groupContext.epoch + 1n }, path, excludeNodes, cs);
    return [pkp, commitSecret, updatedTree];
  }
}
async function updatePrivateKeyPath(tree, state, leafNodeIndex, groupContext, path, excludeNodes, cs) {
  const secret = await applyUpdatePathSecret(tree, state.privatePath, leafNodeIndex, groupContext, path, excludeNodes, cs);
  const pathSecrets = await pathToRoot(tree, toNodeIndex(secret.nodeIndex), secret.pathSecret, cs.kdf);
  const newPkp = mergePrivateKeyPaths(state.privatePath, await toPrivateKeyPath(pathSecrets, state.privatePath.leafIndex, cs));
  const rootIndex = root(leafWidth(tree.length));
  const rootSecret = pathSecrets[rootIndex];
  if (rootSecret === void 0)
    throw new InternalError("Could not find secret for root");
  const commitSecret = await deriveSecret(rootSecret, "path", cs.kdf);
  return [newPkp, commitSecret];
}
async function processMessage(message, state, pskIndex, action, cs) {
  if (message.wireformat === "mls_public_message") {
    const result = await processPublicMessage(state, message.publicMessage, pskIndex, cs, action);
    return { ...result, kind: "newState" };
  } else
    return processPrivateMessage(state, message.privateMessage, emptyPskIndex, cs, action);
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/makeHashImpl.js
function makeHashImpl(sc, h) {
  return {
    async digest(data) {
      const result = await sc.digest(h, toBufferSource(data));
      return new Uint8Array(result);
    },
    async mac(key, data) {
      const result = await sc.sign("HMAC", await importMacKey(key, h), toBufferSource(data));
      return new Uint8Array(result);
    },
    async verifyMac(key, mac, data) {
      return sc.verify("HMAC", await importMacKey(key, h), toBufferSource(mac), toBufferSource(data));
    }
  };
}
function importMacKey(rawKey, h) {
  return crypto.subtle.importKey("raw", toBufferSource(rawKey), {
    name: "HMAC",
    hash: { name: h }
  }, false, ["sign", "verify"]);
}

// node_modules/@hpke/core/esm/mod.js
init_mod();

// node_modules/@hpke/core/esm/src/aeads/aesGcm.js
init_mod();
var AesGcmContext = class extends NativeAlgorithm {
  constructor(key) {
    super();
    Object.defineProperty(this, "_rawKey", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_key", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this._rawKey = key;
  }
  async seal(iv, data, aad) {
    await this._setupKey();
    const alg = {
      name: "AES-GCM",
      iv,
      additionalData: aad
    };
    const ct = await this._api.encrypt(alg, this._key, data);
    return ct;
  }
  async open(iv, data, aad) {
    await this._setupKey();
    const alg = {
      name: "AES-GCM",
      iv,
      additionalData: aad
    };
    const pt = await this._api.decrypt(alg, this._key, data);
    return pt;
  }
  async _setupKey() {
    if (this._key !== void 0) {
      return;
    }
    await this._setup();
    const key = await this._importKey(this._rawKey);
    new Uint8Array(this._rawKey).fill(0);
    this._key = key;
    return;
  }
  async _importKey(key) {
    return await this._api.importKey("raw", key, { name: "AES-GCM" }, true, AEAD_USAGES);
  }
};
var Aes128Gcm = class {
  constructor() {
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: AeadId.Aes128Gcm
    });
    Object.defineProperty(this, "keySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 16
    });
    Object.defineProperty(this, "nonceSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 12
    });
    Object.defineProperty(this, "tagSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 16
    });
  }
  createEncryptionContext(key) {
    return new AesGcmContext(key);
  }
};
var Aes256Gcm = class extends Aes128Gcm {
  constructor() {
    super(...arguments);
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: AeadId.Aes256Gcm
    });
    Object.defineProperty(this, "keySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
    Object.defineProperty(this, "nonceSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 12
    });
    Object.defineProperty(this, "tagSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 16
    });
  }
};

// node_modules/@hpke/core/esm/src/aeads/exportOnly.js
init_mod();

// node_modules/@hpke/core/esm/src/native.js
init_mod();

// node_modules/@hpke/core/esm/src/cipherSuiteNative.js
init_mod();

// node_modules/@hpke/core/esm/src/exporterContext.js
init_mod();

// node_modules/@hpke/core/esm/src/utils/emitNotSupported.js
init_mod();
function emitNotSupported() {
  return new Promise((_resolve, reject) => {
    reject(new NotSupportedError("Not supported"));
  });
}

// node_modules/@hpke/core/esm/src/exporterContext.js
var LABEL_SEC = new Uint8Array([115, 101, 99]);
var ExporterContextImpl = class {
  constructor(api, kdf, exporterSecret) {
    Object.defineProperty(this, "_api", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "exporterSecret", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_kdf", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this._api = api;
    this._kdf = kdf;
    this.exporterSecret = exporterSecret;
  }
  async seal(_data, _aad) {
    return await emitNotSupported();
  }
  async open(_data, _aad) {
    return await emitNotSupported();
  }
  async export(exporterContext, len) {
    if (exporterContext.byteLength > INPUT_LENGTH_LIMIT) {
      throw new InvalidParamError("Too long exporter context");
    }
    try {
      return await this._kdf.labeledExpand(this.exporterSecret, LABEL_SEC, new Uint8Array(exporterContext), len);
    } catch (e) {
      throw new ExportError(e);
    }
  }
};
var RecipientExporterContextImpl = class extends ExporterContextImpl {
};
var SenderExporterContextImpl = class extends ExporterContextImpl {
  constructor(api, kdf, exporterSecret, enc) {
    super(api, kdf, exporterSecret);
    Object.defineProperty(this, "enc", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this.enc = enc;
    return;
  }
};

// node_modules/@hpke/core/esm/src/recipientContext.js
init_mod();

// node_modules/@hpke/core/esm/src/encryptionContext.js
init_mod();
var EncryptionContextImpl = class extends ExporterContextImpl {
  constructor(api, kdf, params) {
    super(api, kdf, params.exporterSecret);
    Object.defineProperty(this, "_aead", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_nK", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_nN", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_nT", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_ctx", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    if (params.key === void 0 || params.baseNonce === void 0 || params.seq === void 0) {
      throw new Error("Required parameters are missing");
    }
    this._aead = params.aead;
    this._nK = this._aead.keySize;
    this._nN = this._aead.nonceSize;
    this._nT = this._aead.tagSize;
    const key = this._aead.createEncryptionContext(params.key);
    this._ctx = {
      key,
      baseNonce: params.baseNonce,
      seq: params.seq
    };
  }
  computeNonce(k) {
    const seqBytes = i2Osp(k.seq, k.baseNonce.byteLength);
    return xor(k.baseNonce, seqBytes).buffer;
  }
  incrementSeq(k) {
    if (k.seq > Number.MAX_SAFE_INTEGER) {
      throw new MessageLimitReachedError("Message limit reached");
    }
    k.seq += 1;
    return;
  }
};

// node_modules/@hpke/core/esm/src/mutex.js
var __classPrivateFieldGet = function(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = function(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _Mutex_locked;
var Mutex = class {
  constructor() {
    _Mutex_locked.set(this, Promise.resolve());
  }
  async lock() {
    let releaseLock;
    const nextLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    const previousLock = __classPrivateFieldGet(this, _Mutex_locked, "f");
    __classPrivateFieldSet(this, _Mutex_locked, nextLock, "f");
    await previousLock;
    return releaseLock;
  }
};
_Mutex_locked = /* @__PURE__ */ new WeakMap();

// node_modules/@hpke/core/esm/src/recipientContext.js
var __classPrivateFieldGet2 = function(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet2 = function(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _RecipientContextImpl_mutex;
var RecipientContextImpl = class extends EncryptionContextImpl {
  constructor() {
    super(...arguments);
    _RecipientContextImpl_mutex.set(this, void 0);
  }
  async open(data, aad = EMPTY.buffer) {
    __classPrivateFieldSet2(this, _RecipientContextImpl_mutex, __classPrivateFieldGet2(this, _RecipientContextImpl_mutex, "f") ?? new Mutex(), "f");
    const release = await __classPrivateFieldGet2(this, _RecipientContextImpl_mutex, "f").lock();
    let pt;
    try {
      pt = await this._ctx.key.open(this.computeNonce(this._ctx), data, aad);
    } catch (e) {
      throw new OpenError(e);
    } finally {
      release();
    }
    this.incrementSeq(this._ctx);
    return pt;
  }
};
_RecipientContextImpl_mutex = /* @__PURE__ */ new WeakMap();

// node_modules/@hpke/core/esm/src/senderContext.js
init_mod();
var __classPrivateFieldGet3 = function(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet3 = function(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _SenderContextImpl_mutex;
var SenderContextImpl = class extends EncryptionContextImpl {
  constructor(api, kdf, params, enc) {
    super(api, kdf, params);
    Object.defineProperty(this, "enc", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    _SenderContextImpl_mutex.set(this, void 0);
    this.enc = enc;
  }
  async seal(data, aad = EMPTY.buffer) {
    __classPrivateFieldSet3(this, _SenderContextImpl_mutex, __classPrivateFieldGet3(this, _SenderContextImpl_mutex, "f") ?? new Mutex(), "f");
    const release = await __classPrivateFieldGet3(this, _SenderContextImpl_mutex, "f").lock();
    let ct;
    try {
      ct = await this._ctx.key.seal(this.computeNonce(this._ctx), data, aad);
    } catch (e) {
      throw new SealError(e);
    } finally {
      release();
    }
    this.incrementSeq(this._ctx);
    return ct;
  }
};
_SenderContextImpl_mutex = /* @__PURE__ */ new WeakMap();

// node_modules/@hpke/core/esm/src/cipherSuiteNative.js
var LABEL_BASE_NONCE = new Uint8Array([
  98,
  97,
  115,
  101,
  95,
  110,
  111,
  110,
  99,
  101
]);
var LABEL_EXP = new Uint8Array([101, 120, 112]);
var LABEL_INFO_HASH = new Uint8Array([
  105,
  110,
  102,
  111,
  95,
  104,
  97,
  115,
  104
]);
var LABEL_KEY = new Uint8Array([107, 101, 121]);
var LABEL_PSK_ID_HASH = new Uint8Array([
  112,
  115,
  107,
  95,
  105,
  100,
  95,
  104,
  97,
  115,
  104
]);
var LABEL_SECRET = new Uint8Array([115, 101, 99, 114, 101, 116]);
var SUITE_ID_HEADER_HPKE = new Uint8Array([
  72,
  80,
  75,
  69,
  0,
  0,
  0,
  0,
  0,
  0
]);
var CipherSuiteNative = class extends NativeAlgorithm {
  /**
   * @param params A set of parameters for building a cipher suite.
   *
   * If the error occurred, throws {@link InvalidParamError}.
   *
   * @throws {@link InvalidParamError}
   */
  constructor(params) {
    super();
    Object.defineProperty(this, "_kem", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_kdf", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_aead", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_suiteId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    if (typeof params.kem === "number") {
      throw new InvalidParamError("KemId cannot be used");
    }
    this._kem = params.kem;
    if (typeof params.kdf === "number") {
      throw new InvalidParamError("KdfId cannot be used");
    }
    this._kdf = params.kdf;
    if (typeof params.aead === "number") {
      throw new InvalidParamError("AeadId cannot be used");
    }
    this._aead = params.aead;
    this._suiteId = new Uint8Array(SUITE_ID_HEADER_HPKE);
    this._suiteId.set(i2Osp(this._kem.id, 2), 4);
    this._suiteId.set(i2Osp(this._kdf.id, 2), 6);
    this._suiteId.set(i2Osp(this._aead.id, 2), 8);
    this._kdf.init(this._suiteId);
  }
  /**
   * Gets the KEM context of the ciphersuite.
   */
  get kem() {
    return this._kem;
  }
  /**
   * Gets the KDF context of the ciphersuite.
   */
  get kdf() {
    return this._kdf;
  }
  /**
   * Gets the AEAD context of the ciphersuite.
   */
  get aead() {
    return this._aead;
  }
  /**
   * Creates an encryption context for a sender.
   *
   * If the error occurred, throws {@link DecapError} | {@link ValidationError}.
   *
   * @param params A set of parameters for the sender encryption context.
   * @returns A sender encryption context.
   * @throws {@link EncapError}, {@link ValidationError}
   */
  async createSenderContext(params) {
    this._validateInputLength(params);
    await this._setup();
    const dh = await this._kem.encap(params);
    let mode;
    if (params.psk !== void 0) {
      mode = params.senderKey !== void 0 ? Mode.AuthPsk : Mode.Psk;
    } else {
      mode = params.senderKey !== void 0 ? Mode.Auth : Mode.Base;
    }
    return await this._keyScheduleS(mode, dh.sharedSecret, dh.enc, params);
  }
  /**
   * Creates an encryption context for a recipient.
   *
   * If the error occurred, throws {@link DecapError}
   * | {@link DeserializeError} | {@link ValidationError}.
   *
   * @param params A set of parameters for the recipient encryption context.
   * @returns A recipient encryption context.
   * @throws {@link DecapError}, {@link DeserializeError}, {@link ValidationError}
   */
  async createRecipientContext(params) {
    this._validateInputLength(params);
    await this._setup();
    const sharedSecret = await this._kem.decap(params);
    let mode;
    if (params.psk !== void 0) {
      mode = params.senderPublicKey !== void 0 ? Mode.AuthPsk : Mode.Psk;
    } else {
      mode = params.senderPublicKey !== void 0 ? Mode.Auth : Mode.Base;
    }
    return await this._keyScheduleR(mode, sharedSecret, params);
  }
  /**
   * Encrypts a message to a recipient.
   *
   * If the error occurred, throws `EncapError` | `MessageLimitReachedError` | `SealError` | `ValidationError`.
   *
   * @param params A set of parameters for building a sender encryption context.
   * @param pt A plain text as bytes to be encrypted.
   * @param aad Additional authenticated data as bytes fed by an application.
   * @returns A cipher text and an encapsulated key as bytes.
   * @throws {@link EncapError}, {@link MessageLimitReachedError}, {@link SealError}, {@link ValidationError}
   */
  async seal(params, pt, aad = EMPTY.buffer) {
    const ctx = await this.createSenderContext(params);
    return {
      ct: await ctx.seal(pt, aad),
      enc: ctx.enc
    };
  }
  /**
   * Decrypts a message from a sender.
   *
   * If the error occurred, throws `DecapError` | `DeserializeError` | `OpenError` | `ValidationError`.
   *
   * @param params A set of parameters for building a recipient encryption context.
   * @param ct An encrypted text as bytes to be decrypted.
   * @param aad Additional authenticated data as bytes fed by an application.
   * @returns A decrypted plain text as bytes.
   * @throws {@link DecapError}, {@link DeserializeError}, {@link OpenError}, {@link ValidationError}
   */
  async open(params, ct, aad = EMPTY.buffer) {
    const ctx = await this.createRecipientContext(params);
    return await ctx.open(ct, aad);
  }
  // private verifyPskInputs(mode: Mode, params: KeyScheduleParams) {
  //   const gotPsk = (params.psk !== undefined);
  //   const gotPskId = (params.psk !== undefined && params.psk.id.byteLength > 0);
  //   if (gotPsk !== gotPskId) {
  //     throw new Error('Inconsistent PSK inputs');
  //   }
  //   if (gotPsk && (mode === Mode.Base || mode === Mode.Auth)) {
  //     throw new Error('PSK input provided when not needed');
  //   }
  //   if (!gotPsk && (mode === Mode.Psk || mode === Mode.AuthPsk)) {
  //     throw new Error('Missing required PSK input');
  //   }
  //   return;
  // }
  async _keySchedule(mode, sharedSecret, params) {
    const pskId = params.psk === void 0 ? EMPTY : new Uint8Array(params.psk.id);
    const pskIdHash = await this._kdf.labeledExtract(EMPTY, LABEL_PSK_ID_HASH, pskId);
    const info = params.info === void 0 ? EMPTY : new Uint8Array(params.info);
    const infoHash = await this._kdf.labeledExtract(EMPTY, LABEL_INFO_HASH, info);
    const keyScheduleContext = new Uint8Array(1 + pskIdHash.byteLength + infoHash.byteLength);
    keyScheduleContext.set(new Uint8Array([mode]), 0);
    keyScheduleContext.set(new Uint8Array(pskIdHash), 1);
    keyScheduleContext.set(new Uint8Array(infoHash), 1 + pskIdHash.byteLength);
    const psk = params.psk === void 0 ? EMPTY : new Uint8Array(params.psk.key);
    const ikm = this._kdf.buildLabeledIkm(LABEL_SECRET, psk);
    const exporterSecretInfo = this._kdf.buildLabeledInfo(LABEL_EXP, keyScheduleContext, this._kdf.hashSize);
    const exporterSecret = await this._kdf.extractAndExpand(sharedSecret, ikm, exporterSecretInfo, this._kdf.hashSize);
    if (this._aead.id === AeadId.ExportOnly) {
      return { aead: this._aead, exporterSecret };
    }
    const keyInfo = this._kdf.buildLabeledInfo(LABEL_KEY, keyScheduleContext, this._aead.keySize);
    const key = await this._kdf.extractAndExpand(sharedSecret, ikm, keyInfo, this._aead.keySize);
    const baseNonceInfo = this._kdf.buildLabeledInfo(LABEL_BASE_NONCE, keyScheduleContext, this._aead.nonceSize);
    const baseNonce = await this._kdf.extractAndExpand(sharedSecret, ikm, baseNonceInfo, this._aead.nonceSize);
    return {
      aead: this._aead,
      exporterSecret,
      key,
      baseNonce: new Uint8Array(baseNonce),
      seq: 0
    };
  }
  async _keyScheduleS(mode, sharedSecret, enc, params) {
    const res = await this._keySchedule(mode, sharedSecret, params);
    if (res.key === void 0) {
      return new SenderExporterContextImpl(this._api, this._kdf, res.exporterSecret, enc);
    }
    return new SenderContextImpl(this._api, this._kdf, res, enc);
  }
  async _keyScheduleR(mode, sharedSecret, params) {
    const res = await this._keySchedule(mode, sharedSecret, params);
    if (res.key === void 0) {
      return new RecipientExporterContextImpl(this._api, this._kdf, res.exporterSecret);
    }
    return new RecipientContextImpl(this._api, this._kdf, res);
  }
  _validateInputLength(params) {
    if (params.info !== void 0 && params.info.byteLength > INFO_LENGTH_LIMIT) {
      throw new InvalidParamError("Too long info");
    }
    if (params.psk !== void 0) {
      if (params.psk.key.byteLength < MINIMUM_PSK_LENGTH) {
        throw new InvalidParamError(`PSK must have at least ${MINIMUM_PSK_LENGTH} bytes`);
      }
      if (params.psk.key.byteLength > INPUT_LENGTH_LIMIT) {
        throw new InvalidParamError("Too long psk.key");
      }
      if (params.psk.id.byteLength > INPUT_LENGTH_LIMIT) {
        throw new InvalidParamError("Too long psk.id");
      }
    }
    return;
  }
};

// node_modules/@hpke/core/esm/src/kems/dhkemNative.js
init_mod();
var DhkemP256HkdfSha256Native = class extends Dhkem {
  constructor() {
    const kdf = new HkdfSha256Native();
    const prim = new Ec(KemId.DhkemP256HkdfSha256, kdf);
    super(KemId.DhkemP256HkdfSha256, prim, kdf);
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: KemId.DhkemP256HkdfSha256
    });
    Object.defineProperty(this, "secretSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
    Object.defineProperty(this, "encSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 65
    });
    Object.defineProperty(this, "publicKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 65
    });
    Object.defineProperty(this, "privateKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
  }
};
var DhkemP384HkdfSha384Native = class extends Dhkem {
  constructor() {
    const kdf = new HkdfSha384Native();
    const prim = new Ec(KemId.DhkemP384HkdfSha384, kdf);
    super(KemId.DhkemP384HkdfSha384, prim, kdf);
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: KemId.DhkemP384HkdfSha384
    });
    Object.defineProperty(this, "secretSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 48
    });
    Object.defineProperty(this, "encSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 97
    });
    Object.defineProperty(this, "publicKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 97
    });
    Object.defineProperty(this, "privateKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 48
    });
  }
};
var DhkemP521HkdfSha512Native = class extends Dhkem {
  constructor() {
    const kdf = new HkdfSha512Native();
    const prim = new Ec(KemId.DhkemP521HkdfSha512, kdf);
    super(KemId.DhkemP521HkdfSha512, prim, kdf);
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: KemId.DhkemP521HkdfSha512
    });
    Object.defineProperty(this, "secretSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 64
    });
    Object.defineProperty(this, "encSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 133
    });
    Object.defineProperty(this, "publicKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 133
    });
    Object.defineProperty(this, "privateKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 64
    });
  }
};

// node_modules/@hpke/core/esm/src/native.js
var CipherSuite = class extends CipherSuiteNative {
};
var DhkemP256HkdfSha256 = class extends DhkemP256HkdfSha256Native {
};
var DhkemP384HkdfSha384 = class extends DhkemP384HkdfSha384Native {
};
var DhkemP521HkdfSha512 = class extends DhkemP521HkdfSha512Native {
};
var HkdfSha256 = class extends HkdfSha256Native {
};
var HkdfSha384 = class extends HkdfSha384Native {
};
var HkdfSha512 = class extends HkdfSha512Native {
};

// node_modules/@hpke/core/esm/src/kems/dhkemX25519.js
init_mod();

// node_modules/@hpke/core/esm/src/kems/dhkemPrimitives/x25519.js
init_mod();
var ALG_NAME = "X25519";
var PKCS8_ALG_ID_X25519 = new Uint8Array([
  48,
  46,
  2,
  1,
  0,
  48,
  5,
  6,
  3,
  43,
  101,
  110,
  4,
  34,
  4,
  32
]);
var BASE_POINT_X25519 = /* @__PURE__ */ (() => {
  const p = new Uint8Array(32);
  p[0] = 9;
  return p;
})();
var X25519 = class extends NativeAlgorithm {
  constructor(hkdf) {
    super();
    Object.defineProperty(this, "_hkdf", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_alg", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_nPk", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_nSk", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_nDh", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    Object.defineProperty(this, "_pkcs8AlgId", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this._alg = { name: ALG_NAME };
    this._hkdf = hkdf;
    this._nPk = 32;
    this._nSk = 32;
    this._nDh = 32;
    this._pkcs8AlgId = PKCS8_ALG_ID_X25519;
  }
  async serializePublicKey(key) {
    await this._setup();
    try {
      return await this._api.exportKey("raw", key);
    } catch (e) {
      throw new SerializeError(e);
    }
  }
  async deserializePublicKey(key) {
    await this._setup();
    try {
      return await this._importRawKey(key, true);
    } catch (e) {
      throw new DeserializeError(e);
    }
  }
  async serializePrivateKey(key) {
    await this._setup();
    try {
      const jwk = await this._api.exportKey("jwk", key);
      if (!("d" in jwk)) {
        throw new Error("Not private key");
      }
      return base64UrlToBytes(jwk["d"]).buffer;
    } catch (e) {
      throw new SerializeError(e);
    }
  }
  async deserializePrivateKey(key) {
    await this._setup();
    try {
      return await this._importRawKey(key, false);
    } catch (e) {
      throw new DeserializeError(e);
    }
  }
  async importKey(format, key, isPublic) {
    await this._setup();
    try {
      if (format === "raw") {
        return await this._importRawKey(key, isPublic);
      }
      if (key instanceof ArrayBuffer) {
        throw new Error("Invalid jwk key format");
      }
      return await this._importJWK(key, isPublic);
    } catch (e) {
      throw new DeserializeError(e);
    }
  }
  async generateKeyPair() {
    await this._setup();
    try {
      return await this._api.generateKey(ALG_NAME, true, KEM_USAGES);
    } catch (e) {
      throw new NotSupportedError(e);
    }
  }
  async deriveKeyPair(ikm) {
    await this._setup();
    try {
      const dkpPrk = await this._hkdf.labeledExtract(EMPTY, LABEL_DKP_PRK, new Uint8Array(ikm));
      const rawSk = await this._hkdf.labeledExpand(dkpPrk, LABEL_SK, EMPTY, this._nSk);
      const rawSkBytes = new Uint8Array(rawSk);
      const sk = await this._deserializePkcs8Key(rawSkBytes);
      rawSkBytes.fill(0);
      return {
        privateKey: sk,
        publicKey: await this.derivePublicKey(sk)
      };
    } catch (e) {
      throw new DeriveKeyPairError(e);
    }
  }
  async derivePublicKey(key) {
    await this._setup();
    try {
      const jwk = await this._api.exportKey("jwk", key);
      delete jwk["d"];
      delete jwk["key_ops"];
      return await this._api.importKey("jwk", jwk, this._alg, true, []);
    } catch {
      try {
        const bp = await this._api.importKey("raw", BASE_POINT_X25519.buffer, this._alg, true, []);
        const bits = await this._api.deriveBits({
          name: ALG_NAME,
          public: bp
        }, key, this._nPk * 8);
        return await this._api.importKey("raw", bits, this._alg, true, []);
      } catch (e) {
        throw new DeserializeError(e);
      }
    }
  }
  async dh(sk, pk) {
    await this._setup();
    try {
      const bits = await this._api.deriveBits({
        name: ALG_NAME,
        public: pk
      }, sk, this._nDh * 8);
      return bits;
    } catch (e) {
      throw new SerializeError(e);
    }
  }
  async _importRawKey(key, isPublic) {
    if (isPublic && key.byteLength !== this._nPk) {
      throw new Error("Invalid public key for the ciphersuite");
    }
    if (!isPublic && key.byteLength !== this._nSk) {
      throw new Error("Invalid private key for the ciphersuite");
    }
    if (isPublic) {
      return await this._api.importKey("raw", key, this._alg, true, []);
    }
    return await this._deserializePkcs8Key(new Uint8Array(key));
  }
  async _importJWK(key, isPublic) {
    if (typeof key.kty === "undefined" || key.kty !== "OKP") {
      throw new Error(`Invalid kty: ${key.crv}`);
    }
    if (typeof key.crv === "undefined" || key.crv !== ALG_NAME) {
      throw new Error(`Invalid crv: ${key.crv}`);
    }
    if (isPublic) {
      if (typeof key.d !== "undefined") {
        throw new Error("Invalid key: `d` should not be set");
      }
      return await this._api.importKey("jwk", key, this._alg, true, []);
    }
    if (typeof key.d === "undefined") {
      throw new Error("Invalid key: `d` not found");
    }
    return await this._api.importKey("jwk", key, this._alg, true, KEM_USAGES);
  }
  async _deserializePkcs8Key(k) {
    const pkcs8Key = new Uint8Array(this._pkcs8AlgId.length + k.length);
    pkcs8Key.set(this._pkcs8AlgId, 0);
    pkcs8Key.set(k, this._pkcs8AlgId.length);
    return await this._api.importKey("pkcs8", pkcs8Key, this._alg, true, KEM_USAGES);
  }
};

// node_modules/@hpke/core/esm/src/kems/dhkemX25519.js
var DhkemX25519HkdfSha256 = class extends Dhkem {
  constructor() {
    const kdf = new HkdfSha256Native();
    super(KemId.DhkemX25519HkdfSha256, new X25519(kdf), kdf);
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: KemId.DhkemX25519HkdfSha256
    });
    Object.defineProperty(this, "secretSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
    Object.defineProperty(this, "encSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
    Object.defineProperty(this, "publicKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
    Object.defineProperty(this, "privateKeySize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 32
    });
  }
};

// node_modules/@hpke/core/esm/src/kems/dhkemX448.js
init_mod();

// node_modules/@hpke/core/esm/src/kems/dhkemPrimitives/x448.js
init_mod();
var PKCS8_ALG_ID_X448 = new Uint8Array([
  48,
  70,
  2,
  1,
  0,
  48,
  5,
  6,
  3,
  43,
  101,
  111,
  4,
  58,
  4,
  56
]);

// node_modules/ts-mls/dist/src/crypto/implementation/hpke.js
async function makeGenericHpke(hpkealg, aead, cs) {
  return {
    async open(privateKey, kemOutput, ciphertext, info, aad) {
      try {
        const result = await cs.open({ recipientKey: privateKey, enc: bytesToArrayBuffer(kemOutput), info: bytesToArrayBuffer(info) }, bytesToArrayBuffer(ciphertext), aad ? bytesToArrayBuffer(aad) : new ArrayBuffer());
        return new Uint8Array(result);
      } catch (e) {
        throw new CryptoError(`${e}`);
      }
    },
    async seal(publicKey, plaintext, info, aad) {
      const result = await cs.seal({ recipientPublicKey: publicKey, info: bytesToArrayBuffer(info) }, bytesToArrayBuffer(plaintext), aad ? bytesToArrayBuffer(aad) : new ArrayBuffer());
      return {
        ct: new Uint8Array(result.ct),
        enc: new Uint8Array(result.enc)
      };
    },
    async exportSecret(publicKey, exporterContext, length, info) {
      const context = await cs.createSenderContext({ recipientPublicKey: publicKey, info: bytesToArrayBuffer(info) });
      return {
        enc: new Uint8Array(context.enc),
        secret: new Uint8Array(await context.export(bytesToArrayBuffer(exporterContext), length))
      };
    },
    async importSecret(privateKey, exporterContext, kemOutput, length, info) {
      try {
        const context = await cs.createRecipientContext({
          recipientKey: privateKey,
          info: bytesToArrayBuffer(info),
          enc: bytesToArrayBuffer(kemOutput)
        });
        return new Uint8Array(await context.export(bytesToArrayBuffer(exporterContext), length));
      } catch (e) {
        throw new CryptoError(`${e}`);
      }
    },
    async importPrivateKey(k) {
      try {
        const key = hpkealg.kem === "DHKEM-P521-HKDF-SHA512" ? prepadPrivateKeyP521(k) : k;
        return await cs.kem.deserializePrivateKey(bytesToArrayBuffer(key));
      } catch (e) {
        throw new CryptoError(`${e}`);
      }
    },
    async importPublicKey(k) {
      try {
        return await cs.kem.deserializePublicKey(bytesToArrayBuffer(k));
      } catch (e) {
        throw new CryptoError(`${e}`);
      }
    },
    async exportPublicKey(k) {
      return new Uint8Array(await cs.kem.serializePublicKey(k));
    },
    async exportPrivateKey(k) {
      return new Uint8Array(await cs.kem.serializePrivateKey(k));
    },
    async encryptAead(key, nonce, aad, plaintext) {
      return aead.encrypt(key, nonce, aad ? aad : new Uint8Array(), plaintext);
    },
    async decryptAead(key, nonce, aad, ciphertext) {
      try {
        return await aead.decrypt(key, nonce, aad ? aad : new Uint8Array(), ciphertext);
      } catch (e) {
        throw new CryptoError(`${e}`);
      }
    },
    async deriveKeyPair(ikm) {
      const kp = await cs.kem.deriveKeyPair(bytesToArrayBuffer(ikm));
      return { privateKey: kp.privateKey, publicKey: kp.publicKey };
    },
    async generateKeyPair() {
      const kp = await cs.kem.generateKeyPair();
      return { privateKey: kp.privateKey, publicKey: kp.publicKey };
    },
    keyLength: cs.aead.keySize,
    nonceLength: cs.aead.nonceSize
  };
}
function prepadPrivateKeyP521(k) {
  const lengthDifference = 66 - k.byteLength;
  return concatUint8Arrays(new Uint8Array(lengthDifference), k);
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/makeAead.js
async function makeAead(aeadAlg) {
  switch (aeadAlg) {
    case "AES128GCM":
      return [
        {
          encrypt(key, nonce, aad, plaintext) {
            return encryptAesGcm(key, nonce, aad, plaintext);
          },
          decrypt(key, nonce, aad, ciphertext) {
            return decryptAesGcm(key, nonce, aad, ciphertext);
          }
        },
        new Aes128Gcm()
      ];
    case "AES256GCM":
      return [
        {
          encrypt(key, nonce, aad, plaintext) {
            return encryptAesGcm(key, nonce, aad, plaintext);
          },
          decrypt(key, nonce, aad, ciphertext) {
            return decryptAesGcm(key, nonce, aad, ciphertext);
          }
        },
        new Aes256Gcm()
      ];
    case "CHACHA20POLY1305":
      try {
        const { Chacha20Poly1305: Chacha20Poly13052 } = await Promise.resolve().then(() => (init_mod2(), mod_exports));
        const { chacha20poly1305: chacha20poly13053 } = await Promise.resolve().then(() => (init_chacha2(), chacha_exports));
        return [
          {
            async encrypt(key, nonce, aad, plaintext) {
              return chacha20poly13053(key, nonce, aad).encrypt(plaintext);
            },
            async decrypt(key, nonce, aad, ciphertext) {
              return chacha20poly13053(key, nonce, aad).decrypt(ciphertext);
            }
          },
          new Chacha20Poly13052()
        ];
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/chacha20poly1305' is not installed. Please install it to use this feature.");
      }
  }
}
async function encryptAesGcm(key, nonce, aad, plaintext) {
  const cryptoKey = await crypto.subtle.importKey("raw", toBufferSource(key), { name: "AES-GCM" }, false, ["encrypt"]);
  const params = {
    name: "AES-GCM",
    iv: toBufferSource(nonce)
  };
  if (aad.length > 0) {
    params.additionalData = toBufferSource(aad);
  }
  const result = await crypto.subtle.encrypt(params, cryptoKey, toBufferSource(plaintext));
  return new Uint8Array(result);
}
async function decryptAesGcm(key, nonce, aad, ciphertext) {
  const cryptoKey = await crypto.subtle.importKey("raw", toBufferSource(key), { name: "AES-GCM" }, false, ["decrypt"]);
  const params = {
    name: "AES-GCM",
    iv: toBufferSource(nonce)
  };
  if (aad.length > 0) {
    params.additionalData = toBufferSource(aad);
  }
  const result = await crypto.subtle.decrypt(params, cryptoKey, toBufferSource(ciphertext));
  return new Uint8Array(result);
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/makeKdfImpl.js
function makeKdfImpl(k) {
  return {
    async extract(salt, ikm) {
      const result = await k.extract(bytesToArrayBuffer(salt), bytesToArrayBuffer(ikm));
      return new Uint8Array(result);
    },
    async expand(prk, info, len) {
      const result = await k.expand(bytesToArrayBuffer(prk), bytesToArrayBuffer(info), len);
      return new Uint8Array(result);
    },
    size: k.hashSize
  };
}
function makeKdf(kdfAlg) {
  switch (kdfAlg) {
    case "HKDF-SHA256":
      return new HkdfSha256();
    case "HKDF-SHA384":
      return new HkdfSha384();
    case "HKDF-SHA512":
      return new HkdfSha512();
  }
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/makeDhKem.js
async function makeDhKem(kemAlg) {
  switch (kemAlg) {
    case "DHKEM-P256-HKDF-SHA256":
      return new DhkemP256HkdfSha256();
    case "DHKEM-X25519-HKDF-SHA256":
      return new DhkemX25519HkdfSha256();
    case "DHKEM-X448-HKDF-SHA512": {
      try {
        const { DhkemX448HkdfSha512: DhkemX448HkdfSha5122 } = await import("@hpke/dhkem-x448");
        return new DhkemX448HkdfSha5122();
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/dhkem-x448' is not installed. Please install it to use this feature.");
      }
    }
    case "DHKEM-P521-HKDF-SHA512":
      return new DhkemP521HkdfSha512();
    case "DHKEM-P384-HKDF-SHA384":
      return new DhkemP384HkdfSha384();
    case "ML-KEM-512":
      try {
        const { MlKem512: MlKem5122 } = await import("@hpke/ml-kem");
        return new MlKem5122();
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/ml-kem' is not installed. Please install it to use this feature.");
      }
    case "ML-KEM-768":
      try {
        const { MlKem768: MlKem7682 } = await import("@hpke/ml-kem");
        return new MlKem7682();
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/ml-kem' is not installed. Please install it to use this feature.");
      }
    case "ML-KEM-1024":
      try {
        const { MlKem1024: MlKem10242 } = await import("@hpke/ml-kem");
        return new MlKem10242();
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/ml-kem' is not installed. Please install it to use this feature.");
      }
    case "X-Wing":
      try {
        const { XWing: XWing2 } = await Promise.resolve().then(() => (init_mod5(), mod_exports2));
        return new XWing2();
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/hybridkem-x-wing' is not installed. Please install it to use this feature.");
      }
  }
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/makeHpke.js
async function makeHpke(hpkealg) {
  const [aead, aeadInterface] = await makeAead(hpkealg.aead);
  const cs = new CipherSuite({
    kem: await makeDhKem(hpkealg.kem),
    kdf: makeKdf(hpkealg.kdf),
    aead: aeadInterface
  });
  return makeGenericHpke(hpkealg, aead, cs);
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/rng.js
var defaultRng = {
  randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }
};

// node_modules/ts-mls/dist/src/crypto/implementation/default/makeNobleSignatureImpl.js
function rawEd25519ToPKCS8(rawKey) {
  const oid = new Uint8Array([6, 3, 43, 101, 112]);
  const innerOctetString = new Uint8Array([4, 32, ...rawKey]);
  const privateKeyField = new Uint8Array([4, 34, ...innerOctetString]);
  const algorithmSeq = new Uint8Array([48, 5, ...oid]);
  const version = new Uint8Array([2, 1, 0]);
  const content = new Uint8Array([...version, ...algorithmSeq, ...privateKeyField]);
  return new Uint8Array([48, content.length, ...content]);
}
async function makeNobleSignatureImpl(alg) {
  switch (alg) {
    case "Ed25519": {
      const subtle = globalThis.crypto?.subtle;
      if (subtle !== void 0) {
        return {
          async sign(signKey, message) {
            const keyData = signKey.length === 32 ? rawEd25519ToPKCS8(signKey) : signKey;
            const key = await subtle.importKey("pkcs8", toBufferSource(keyData), "Ed25519", false, ["sign"]);
            const sig = await subtle.sign("Ed25519", key, toBufferSource(message));
            return new Uint8Array(sig);
          },
          async verify(publicKey, message, signature) {
            const key = await subtle.importKey("raw", toBufferSource(publicKey), "Ed25519", false, ["verify"]);
            return subtle.verify("Ed25519", key, toBufferSource(signature), toBufferSource(message));
          },
          async keygen() {
            const keyPair = await subtle.generateKey("Ed25519", true, ["sign", "verify"]);
            const publicKeyBuffer = await subtle.exportKey("raw", keyPair.publicKey);
            const privateKeyBuffer = await subtle.exportKey("pkcs8", keyPair.privateKey);
            const publicKey = new Uint8Array(publicKeyBuffer);
            const signKey = new Uint8Array(privateKeyBuffer);
            return { signKey, publicKey };
          }
        };
      }
      try {
        const { ed25519: ed255192 } = await Promise.resolve().then(() => (init_ed25519(), ed25519_exports));
        return {
          async sign(signKey, message) {
            return ed255192.sign(message, signKey);
          },
          async verify(publicKey, message, signature) {
            return ed255192.verify(signature, message, publicKey);
          },
          async keygen() {
            const signKey = ed255192.utils.randomSecretKey();
            return { signKey, publicKey: ed255192.getPublicKey(signKey) };
          }
        };
      } catch (err) {
        throw new DependencyError("Optional dependency '@noble/curves' is not installed. Please install it to use this feature.");
      }
    }
    case "Ed448":
      try {
        const { ed448: ed4482 } = await Promise.resolve().then(() => (init_ed448(), ed448_exports));
        return {
          async sign(signKey, message) {
            return ed4482.sign(message, signKey);
          },
          async verify(publicKey, message, signature) {
            return ed4482.verify(signature, message, publicKey);
          },
          async keygen() {
            const signKey = ed4482.utils.randomSecretKey();
            return { signKey, publicKey: ed4482.getPublicKey(signKey) };
          }
        };
      } catch (err) {
        throw new DependencyError("Optional dependency '@noble/curves' is not installed. Please install it to use this feature.");
      }
    case "P256":
      try {
        const { p256: p2562 } = await Promise.resolve().then(() => (init_nist(), nist_exports));
        return {
          async sign(signKey, message) {
            return p2562.sign(message, signKey, { prehash: true, format: "der", lowS: false });
          },
          async verify(publicKey, message, signature) {
            return p2562.verify(signature, message, publicKey, { prehash: true, format: "der", lowS: false });
          },
          async keygen() {
            const signKey = p2562.utils.randomSecretKey();
            return { signKey, publicKey: p2562.getPublicKey(signKey) };
          }
        };
      } catch (err) {
        throw new DependencyError("Optional dependency '@noble/curves' is not installed. Please install it to use this feature.");
      }
    case "P384":
      try {
        const { p384: p3842 } = await Promise.resolve().then(() => (init_nist(), nist_exports));
        return {
          async sign(signKey, message) {
            return p3842.sign(message, signKey, { prehash: true, format: "der", lowS: false });
          },
          async verify(publicKey, message, signature) {
            return p3842.verify(signature, message, publicKey, { prehash: true, format: "der", lowS: false });
          },
          async keygen() {
            const signKey = p3842.utils.randomSecretKey();
            return { signKey, publicKey: p3842.getPublicKey(signKey) };
          }
        };
      } catch (err) {
        throw new DependencyError("Optional dependency '@noble/curves' is not installed. Please install it to use this feature.");
      }
    case "P521":
      try {
        const { p521: p5212 } = await Promise.resolve().then(() => (init_nist(), nist_exports));
        return {
          async sign(signKey, message) {
            return p5212.sign(message, signKey, { prehash: true, format: "der", lowS: false });
          },
          async verify(publicKey, message, signature) {
            return p5212.verify(signature, message, publicKey, { prehash: true, format: "der", lowS: false });
          },
          async keygen() {
            const signKey = p5212.utils.randomSecretKey();
            return { signKey, publicKey: p5212.getPublicKey(signKey) };
          }
        };
      } catch (err) {
        throw new DependencyError("Optional dependency '@noble/curves' is not installed. Please install it to use this feature.");
      }
    case "ML-DSA-87":
      try {
        const { ml_dsa87: ml_dsa872 } = await Promise.resolve().then(() => (init_ml_dsa(), ml_dsa_exports));
        return {
          async sign(signKey, message) {
            return ml_dsa872.sign(message, signKey);
          },
          async verify(publicKey, message, signature) {
            return ml_dsa872.verify(signature, message, publicKey);
          },
          async keygen() {
            const keys = ml_dsa872.keygen(crypto.getRandomValues(new Uint8Array(32)));
            return { signKey: keys.secretKey, publicKey: keys.publicKey };
          }
        };
      } catch (err) {
        throw new DependencyError("Optional dependency '@noble/post-quantum' is not installed. Please install it to use this feature.");
      }
  }
}

// node_modules/ts-mls/dist/src/crypto/implementation/default/provider.js
var defaultCryptoProvider = {
  async getCiphersuiteImpl(cs) {
    const sc = crypto.subtle;
    return {
      kdf: makeKdfImpl(makeKdf(cs.hpke.kdf)),
      hash: makeHashImpl(sc, cs.hash),
      signature: await makeNobleSignatureImpl(cs.signature),
      hpke: await makeHpke(cs.hpke),
      rng: defaultRng,
      name: cs.name
    };
  }
};

// node_modules/ts-mls/dist/src/crypto/getCiphersuiteImpl.js
async function getCiphersuiteImpl(cs, provider = defaultCryptoProvider) {
  return provider.getCiphersuiteImpl(cs);
}

// node_modules/ts-mls/dist/src/resumption.js
async function reinitGroup(state, groupId, version, cipherSuite, extensions, cs) {
  const reinitProposal = {
    proposalType: "reinit",
    reinit: {
      groupId,
      version,
      cipherSuite,
      extensions
    }
  };
  return createCommit({
    state,
    pskIndex: makePskIndex(state, {}),
    cipherSuite: cs
  }, {
    extraProposals: [reinitProposal]
  });
}
async function reinitCreateNewGroup(state, keyPackage, privateKeyPackage, memberKeyPackages, groupId, cipherSuite, extensions, provider = defaultCryptoProvider) {
  const cs = await getCiphersuiteImpl(getCiphersuiteFromName(cipherSuite), provider);
  const newGroup = await createGroup(groupId, keyPackage, privateKeyPackage, extensions, cs);
  const addProposals = memberKeyPackages.map((kp) => ({
    proposalType: "add",
    add: { keyPackage: kp }
  }));
  const psk = makeResumptionPsk(state, "reinit", cs);
  const resumptionPsk = {
    proposalType: "psk",
    psk: {
      preSharedKeyId: psk.id
    }
  };
  return createCommit({
    state: newGroup,
    pskIndex: makePskIndex(state, {}),
    cipherSuite: cs
  }, {
    extraProposals: [...addProposals, resumptionPsk]
  });
}
function makeResumptionPsk(state, usage, cs) {
  const secret = state.keySchedule.resumptionPsk;
  const pskNonce = cs.rng.randomBytes(cs.kdf.size);
  const psk = {
    pskEpoch: state.groupContext.epoch,
    pskGroupId: state.groupContext.groupId,
    psktype: "resumption",
    pskNonce,
    usage
  };
  return { id: psk, secret };
}
async function branchGroup(state, keyPackage, privateKeyPackage, memberKeyPackages, newGroupId, cs) {
  const resumptionPsk = makeResumptionPsk(state, "branch", cs);
  const pskSearch = makePskIndex(state, {});
  const newGroup = await createGroup(newGroupId, keyPackage, privateKeyPackage, state.groupContext.extensions, cs);
  const addMemberProposals = memberKeyPackages.map((kp) => ({
    proposalType: "add",
    add: {
      keyPackage: kp
    }
  }));
  const branchPskProposal = {
    proposalType: "psk",
    psk: {
      preSharedKeyId: resumptionPsk.id
    }
  };
  return createCommit({
    state: newGroup,
    pskIndex: pskSearch,
    cipherSuite: cs
  }, {
    extraProposals: [...addMemberProposals, branchPskProposal]
  });
}
async function joinGroupFromBranch(oldState, welcome, keyPackage, privateKeyPackage, ratchetTree, cs) {
  const pskSearch = makePskIndex(oldState, {});
  return await joinGroup(welcome, keyPackage, privateKeyPackage, pskSearch, cs, ratchetTree, oldState);
}
async function joinGroupFromReinit(suspendedState, welcome, keyPackage, privateKeyPackage, ratchetTree, provider = defaultCryptoProvider) {
  const pskSearch = makePskIndex(suspendedState, {});
  if (suspendedState.groupActiveState.kind !== "suspendedPendingReinit")
    throw new UsageError("Cannot reinit because no init proposal found in last commit");
  const cs = await getCiphersuiteImpl(getCiphersuiteFromName(suspendedState.groupActiveState.reinit.cipherSuite), provider);
  return await joinGroup(welcome, keyPackage, privateKeyPackage, pskSearch, cs, ratchetTree, suspendedState);
}

// node_modules/@noble/hashes/utils.js
function isBytes7(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function anumber7(n, title = "") {
  if (typeof n !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(`${prefix}expected number, got ${typeof n}`);
  }
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
  }
}
function abytes7(value, length, title = "") {
  const bytes = isBytes7(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  return value;
}
function ahash3(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new TypeError("Hash must wrapped by utils.createHasher");
  anumber7(h.outputLen);
  anumber7(h.blockLen);
  if (h.outputLen < 1)
    throw new Error('"outputLen" must be >= 1');
  if (h.blockLen < 1)
    throw new Error('"blockLen" must be >= 1');
}
function aexists7(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput7(out, instance) {
  abytes7(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new RangeError('"digestInto() output" expected to be of length >=' + min);
  }
}
function clean7(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView5(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr3(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function createHasher6(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist5 = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi3(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj3(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD3 = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE7) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE7;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView5(this.buffer);
  }
  update(data) {
    aexists7(this);
    abytes7(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView5(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists7(this);
    aoutput7(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE7 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean7(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE7);
    this.process(view, 0);
    const oview = createView5(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE7);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV3 = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA384_IV3 = /* @__PURE__ */ Uint32Array.from([
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
]);
var SHA512_IV3 = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);

// node_modules/@noble/hashes/_u64.js
var U32_MASK645 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n5 = /* @__PURE__ */ BigInt(32);
function fromBig5(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK645), l: Number(n >> _32n5 & U32_MASK645) };
  return { h: Number(n >> _32n5 & U32_MASK645) | 0, l: Number(n & U32_MASK645) | 0 };
}
function split5(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig5(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var shrSH3 = (h, _l, s) => h >>> s;
var shrSL3 = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH3 = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL3 = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH3 = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL3 = (h, l, s) => h >>> s - 32 | l << 64 - s;
function add4(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L3 = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H3 = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L3 = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H3 = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L3 = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H3 = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/@noble/hashes/sha2.js
var SHA256_K3 = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W3 = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B3 = class extends HashMD3 {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D: D2, E, F: F2, G, H } = this;
    return [A, B, C, D2, E, F2, G, H];
  }
  // prettier-ignore
  set(A, B, C, D2, E, F2, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D2 | 0;
    this.E = E | 0;
    this.F = F2 | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W3[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W3[i - 15];
      const W2 = SHA256_W3[i - 2];
      const s0 = rotr3(W15, 7) ^ rotr3(W15, 18) ^ W15 >>> 3;
      const s1 = rotr3(W2, 17) ^ rotr3(W2, 19) ^ W2 >>> 10;
      SHA256_W3[i] = s1 + SHA256_W3[i - 7] + s0 + SHA256_W3[i - 16] | 0;
    }
    let { A, B, C, D: D2, E, F: F2, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr3(E, 6) ^ rotr3(E, 11) ^ rotr3(E, 25);
      const T1 = H + sigma1 + Chi3(E, F2, G) + SHA256_K3[i] + SHA256_W3[i] | 0;
      const sigma0 = rotr3(A, 2) ^ rotr3(A, 13) ^ rotr3(A, 22);
      const T2 = sigma0 + Maj3(A, B, C) | 0;
      H = G;
      G = F2;
      F2 = E;
      E = D2 + T1 | 0;
      D2 = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D2 = D2 + this.D | 0;
    E = E + this.E | 0;
    F2 = F2 + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D2, E, F2, G, H);
  }
  roundClean() {
    clean7(SHA256_W3);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean7(this.buffer);
  }
};
var _SHA2563 = class extends SHA2_32B3 {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV3[0] | 0;
  B = SHA256_IV3[1] | 0;
  C = SHA256_IV3[2] | 0;
  D = SHA256_IV3[3] | 0;
  E = SHA256_IV3[4] | 0;
  F = SHA256_IV3[5] | 0;
  G = SHA256_IV3[6] | 0;
  H = SHA256_IV3[7] | 0;
  constructor() {
    super(32);
  }
};
var K5122 = /* @__PURE__ */ (() => split5([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh2 = /* @__PURE__ */ (() => K5122[0])();
var SHA512_Kl2 = /* @__PURE__ */ (() => K5122[1])();
var SHA512_W_H2 = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L2 = /* @__PURE__ */ new Uint32Array(80);
var SHA2_64B2 = class extends HashMD3 {
  constructor(outputLen) {
    super(128, outputLen, 16, false);
  }
  // prettier-ignore
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H2[i] = view.getUint32(offset);
      SHA512_W_L2[i] = view.getUint32(offset += 4);
    }
    for (let i = 16; i < 80; i++) {
      const W15h = SHA512_W_H2[i - 15] | 0;
      const W15l = SHA512_W_L2[i - 15] | 0;
      const s0h = rotrSH3(W15h, W15l, 1) ^ rotrSH3(W15h, W15l, 8) ^ shrSH3(W15h, W15l, 7);
      const s0l = rotrSL3(W15h, W15l, 1) ^ rotrSL3(W15h, W15l, 8) ^ shrSL3(W15h, W15l, 7);
      const W2h = SHA512_W_H2[i - 2] | 0;
      const W2l = SHA512_W_L2[i - 2] | 0;
      const s1h = rotrSH3(W2h, W2l, 19) ^ rotrBH3(W2h, W2l, 61) ^ shrSH3(W2h, W2l, 6);
      const s1l = rotrSL3(W2h, W2l, 19) ^ rotrBL3(W2h, W2l, 61) ^ shrSL3(W2h, W2l, 6);
      const SUMl = add4L3(s0l, s1l, SHA512_W_L2[i - 7], SHA512_W_L2[i - 16]);
      const SUMh = add4H3(SUMl, s0h, s1h, SHA512_W_H2[i - 7], SHA512_W_H2[i - 16]);
      SHA512_W_H2[i] = SUMh | 0;
      SHA512_W_L2[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0; i < 80; i++) {
      const sigma1h = rotrSH3(Eh, El, 14) ^ rotrSH3(Eh, El, 18) ^ rotrBH3(Eh, El, 41);
      const sigma1l = rotrSL3(Eh, El, 14) ^ rotrSL3(Eh, El, 18) ^ rotrBL3(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L3(Hl, sigma1l, CHIl, SHA512_Kl2[i], SHA512_W_L2[i]);
      const T1h = add5H3(T1ll, Hh, sigma1h, CHIh, SHA512_Kh2[i], SHA512_W_H2[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH3(Ah, Al, 28) ^ rotrBH3(Ah, Al, 34) ^ rotrBH3(Ah, Al, 39);
      const sigma0l = rotrSL3(Ah, Al, 28) ^ rotrBL3(Ah, Al, 34) ^ rotrBL3(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add4(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L3(T1l, sigma0l, MAJl);
      Ah = add3H3(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add4(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add4(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add4(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add4(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add4(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add4(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add4(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add4(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean7(SHA512_W_H2, SHA512_W_L2);
  }
  destroy() {
    this.destroyed = true;
    clean7(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var _SHA5122 = class extends SHA2_64B2 {
  Ah = SHA512_IV3[0] | 0;
  Al = SHA512_IV3[1] | 0;
  Bh = SHA512_IV3[2] | 0;
  Bl = SHA512_IV3[3] | 0;
  Ch = SHA512_IV3[4] | 0;
  Cl = SHA512_IV3[5] | 0;
  Dh = SHA512_IV3[6] | 0;
  Dl = SHA512_IV3[7] | 0;
  Eh = SHA512_IV3[8] | 0;
  El = SHA512_IV3[9] | 0;
  Fh = SHA512_IV3[10] | 0;
  Fl = SHA512_IV3[11] | 0;
  Gh = SHA512_IV3[12] | 0;
  Gl = SHA512_IV3[13] | 0;
  Hh = SHA512_IV3[14] | 0;
  Hl = SHA512_IV3[15] | 0;
  constructor() {
    super(64);
  }
};
var _SHA3842 = class extends SHA2_64B2 {
  Ah = SHA384_IV3[0] | 0;
  Al = SHA384_IV3[1] | 0;
  Bh = SHA384_IV3[2] | 0;
  Bl = SHA384_IV3[3] | 0;
  Ch = SHA384_IV3[4] | 0;
  Cl = SHA384_IV3[5] | 0;
  Dh = SHA384_IV3[6] | 0;
  Dl = SHA384_IV3[7] | 0;
  Eh = SHA384_IV3[8] | 0;
  El = SHA384_IV3[9] | 0;
  Fh = SHA384_IV3[10] | 0;
  Fl = SHA384_IV3[11] | 0;
  Gh = SHA384_IV3[12] | 0;
  Gl = SHA384_IV3[13] | 0;
  Hh = SHA384_IV3[14] | 0;
  Hl = SHA384_IV3[15] | 0;
  constructor() {
    super(48);
  }
};
var sha2563 = /* @__PURE__ */ createHasher6(
  () => new _SHA2563(),
  /* @__PURE__ */ oidNist5(1)
);
var sha5123 = /* @__PURE__ */ createHasher6(
  () => new _SHA5122(),
  /* @__PURE__ */ oidNist5(3)
);
var sha3843 = /* @__PURE__ */ createHasher6(
  () => new _SHA3842(),
  /* @__PURE__ */ oidNist5(2)
);

// node_modules/@noble/hashes/hmac.js
var _HMAC3 = class {
  oHash;
  iHash;
  blockLen;
  outputLen;
  canXOF = false;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash3(hash);
    abytes7(key, void 0, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean7(pad);
  }
  update(buf) {
    aexists7(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists7(this);
    aoutput7(out, this);
    this.finished = true;
    const buf = out.subarray(0, this.outputLen);
    this.iHash.digestInto(buf);
    this.oHash.update(buf);
    this.oHash.digestInto(buf);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac3 = /* @__PURE__ */ (() => {
  const hmac_ = ((hash, key, message) => new _HMAC3(hash, key).update(message).digest());
  hmac_.create = (hash, key) => new _HMAC3(hash, key);
  return hmac_;
})();

// node_modules/ts-mls/dist/src/crypto/implementation/noble/makeHashImpl.js
function makeHashImpl2(h) {
  return {
    async digest(data) {
      switch (h) {
        case "SHA-256":
          return sha2563(data);
        case "SHA-384":
          return sha3843(data);
        case "SHA-512":
          return sha5123(data);
        default:
          throw new Error(`Unsupported hash algorithm: ${h}`);
      }
    },
    async mac(key, data) {
      switch (h) {
        case "SHA-256":
          return hmac3(sha2563, key, data);
        case "SHA-384":
          return hmac3(sha3843, key, data);
        case "SHA-512":
          return hmac3(sha5123, key, data);
        default:
          throw new Error(`Unsupported hash algorithm: ${h}`);
      }
    },
    async verifyMac(key, mac, data) {
      const expectedMac = await this.mac(key, data);
      return constantTimeEqual(mac, expectedMac);
    }
  };
}

// node_modules/@noble/ciphers/_polyval.js
init_utils2();
var BLOCK_SIZE = 16;
var ZEROS163 = /* @__PURE__ */ new Uint8Array(16);
var ZEROS323 = u323(ZEROS163);
var POLY = 225;
var mul2 = (s0, s1, s2, s3) => {
  const hiBit = s3 & 1;
  return {
    s3: s2 << 31 | s3 >>> 1,
    s2: s1 << 31 | s2 >>> 1,
    s1: s0 << 31 | s1 >>> 1,
    s0: s0 >>> 1 ^ POLY << 24 & -(hiBit & 1)
    // reduce % poly
  };
};
var swapLE = (n) => (n >>> 0 & 255) << 24 | (n >>> 8 & 255) << 16 | (n >>> 16 & 255) << 8 | n >>> 24 & 255 | 0;
function _toGHASHKey(k) {
  k.reverse();
  const hiBit = k[15] & 1;
  let carry = 0;
  for (let i = 0; i < k.length; i++) {
    const t = k[i];
    k[i] = t >>> 1 | carry;
    carry = (t & 1) << 7;
  }
  k[0] ^= -hiBit & 225;
  return k;
}
var estimateWindow = (bytes) => {
  if (bytes > 64 * 1024)
    return 8;
  if (bytes > 1024)
    return 4;
  return 2;
};
var GHASH = class {
  blockLen = BLOCK_SIZE;
  outputLen = BLOCK_SIZE;
  s0 = 0;
  s1 = 0;
  s2 = 0;
  s3 = 0;
  finished = false;
  t;
  W;
  windowSize;
  // We select bits per window adaptively based on expectedLength
  constructor(key, expectedLength) {
    abytes3(key, 16, "key");
    key = copyBytes3(key);
    const kView = createView3(key);
    let k0 = kView.getUint32(0, false);
    let k1 = kView.getUint32(4, false);
    let k2 = kView.getUint32(8, false);
    let k3 = kView.getUint32(12, false);
    const doubles = [];
    for (let i = 0; i < 128; i++) {
      doubles.push({ s0: swapLE(k0), s1: swapLE(k1), s2: swapLE(k2), s3: swapLE(k3) });
      ({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2(k0, k1, k2, k3));
    }
    const W = estimateWindow(expectedLength || 1024);
    if (![1, 2, 4, 8].includes(W))
      throw new Error("ghash: invalid window size, expected 2, 4 or 8");
    this.W = W;
    const bits = 128;
    const windows = bits / W;
    const windowSize = this.windowSize = 2 ** W;
    const items = [];
    for (let w = 0; w < windows; w++) {
      for (let byte2 = 0; byte2 < windowSize; byte2++) {
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        for (let j = 0; j < W; j++) {
          const bit = byte2 >>> W - j - 1 & 1;
          if (!bit)
            continue;
          const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
          s0 ^= d0, s1 ^= d1, s2 ^= d2, s3 ^= d3;
        }
        items.push({ s0, s1, s2, s3 });
      }
    }
    this.t = items;
  }
  _updateBlock(s0, s1, s2, s3) {
    s0 ^= this.s0, s1 ^= this.s1, s2 ^= this.s2, s3 ^= this.s3;
    const { W, t, windowSize } = this;
    let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
    const mask = (1 << W) - 1;
    let w = 0;
    for (const num of [s0, s1, s2, s3]) {
      for (let bytePos = 0; bytePos < 4; bytePos++) {
        const byte2 = num >>> 8 * bytePos & 255;
        for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
          const bit = byte2 >>> W * bitPos & mask;
          const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
          o0 ^= e0, o1 ^= e1, o2 ^= e2, o3 ^= e3;
          w += 1;
        }
      }
    }
    this.s0 = o0;
    this.s1 = o1;
    this.s2 = o2;
    this.s3 = o3;
  }
  update(data) {
    aexists3(this);
    abytes3(data);
    data = copyBytes3(data);
    const b32 = u323(data);
    const blocks = Math.floor(data.length / BLOCK_SIZE);
    const left2 = data.length % BLOCK_SIZE;
    for (let i = 0; i < blocks; i++) {
      this._updateBlock(b32[i * 4 + 0], b32[i * 4 + 1], b32[i * 4 + 2], b32[i * 4 + 3]);
    }
    if (left2) {
      ZEROS163.set(data.subarray(blocks * BLOCK_SIZE));
      this._updateBlock(ZEROS323[0], ZEROS323[1], ZEROS323[2], ZEROS323[3]);
      clean3(ZEROS323);
    }
    return this;
  }
  destroy() {
    const { t } = this;
    for (const elm of t) {
      elm.s0 = 0, elm.s1 = 0, elm.s2 = 0, elm.s3 = 0;
    }
  }
  digestInto(out) {
    aexists3(this);
    aoutput3(out, this);
    this.finished = true;
    const { s0, s1, s2, s3 } = this;
    const o32 = u323(out);
    o32[0] = s0;
    o32[1] = s1;
    o32[2] = s2;
    o32[3] = s3;
    return out;
  }
  digest() {
    const res = new Uint8Array(BLOCK_SIZE);
    this.digestInto(res);
    this.destroy();
    return res;
  }
};
var Polyval = class extends GHASH {
  constructor(key, expectedLength) {
    abytes3(key);
    const ghKey = _toGHASHKey(copyBytes3(key));
    super(ghKey, expectedLength);
    clean3(ghKey);
  }
  update(data) {
    aexists3(this);
    abytes3(data);
    data = copyBytes3(data);
    const b32 = u323(data);
    const left2 = data.length % BLOCK_SIZE;
    const blocks = Math.floor(data.length / BLOCK_SIZE);
    for (let i = 0; i < blocks; i++) {
      this._updateBlock(swapLE(b32[i * 4 + 3]), swapLE(b32[i * 4 + 2]), swapLE(b32[i * 4 + 1]), swapLE(b32[i * 4 + 0]));
    }
    if (left2) {
      ZEROS163.set(data.subarray(blocks * BLOCK_SIZE));
      this._updateBlock(swapLE(ZEROS323[3]), swapLE(ZEROS323[2]), swapLE(ZEROS323[1]), swapLE(ZEROS323[0]));
      clean3(ZEROS323);
    }
    return this;
  }
  digestInto(out) {
    aexists3(this);
    aoutput3(out, this);
    this.finished = true;
    const { s0, s1, s2, s3 } = this;
    const o32 = u323(out);
    o32[0] = s0;
    o32[1] = s1;
    o32[2] = s2;
    o32[3] = s3;
    return out.reverse();
  }
};
function wrapConstructorWithKey3(hashCons) {
  const hashC = (msg, key) => hashCons(key, msg.length).update(msg).digest();
  const tmp = hashCons(new Uint8Array(16), 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (key, expectedLength) => hashCons(key, expectedLength);
  return hashC;
}
var ghash = wrapConstructorWithKey3((key, expectedLength) => new GHASH(key, expectedLength));
var polyval = wrapConstructorWithKey3((key, expectedLength) => new Polyval(key, expectedLength));

// node_modules/@noble/ciphers/aes.js
init_utils2();
var BLOCK_SIZE2 = 16;
var BLOCK_SIZE32 = 4;
var EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE2);
var POLY2 = 283;
function validateKeyLength(key) {
  if (![16, 24, 32].includes(key.length))
    throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length=' + key.length);
}
function mul22(n) {
  return n << 1 ^ POLY2 & -(n >> 7);
}
function mul(a, b) {
  let res = 0;
  for (; b > 0; b >>= 1) {
    res ^= a & -(b & 1);
    a = mul22(a);
  }
  return res;
}
var sbox = /* @__PURE__ */ (() => {
  const t = new Uint8Array(256);
  for (let i = 0, x = 1; i < 256; i++, x ^= mul22(x))
    t[i] = x;
  const box = new Uint8Array(256);
  box[0] = 99;
  for (let i = 0; i < 255; i++) {
    let x = t[255 - i];
    x |= x << 8;
    box[t[i]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
  }
  clean3(t);
  return box;
})();
var rotr32_8 = (n) => n << 24 | n >>> 8;
var rotl32_8 = (n) => n << 8 | n >>> 24;
function genTtable(sbox2, fn) {
  if (sbox2.length !== 256)
    throw new Error("Wrong sbox length");
  const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
  const T1 = T0.map(rotl32_8);
  const T2 = T1.map(rotl32_8);
  const T3 = T2.map(rotl32_8);
  const T01 = new Uint32Array(256 * 256);
  const T23 = new Uint32Array(256 * 256);
  const sbox22 = new Uint16Array(256 * 256);
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const idx = i * 256 + j;
      T01[idx] = T0[i] ^ T1[j];
      T23[idx] = T2[i] ^ T3[j];
      sbox22[idx] = sbox2[i] << 8 | sbox2[j];
    }
  }
  return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
}
var tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
var xPowers = /* @__PURE__ */ (() => {
  const p = new Uint8Array(16);
  for (let i = 0, x = 1; i < 16; i++, x = mul22(x))
    p[i] = x;
  return p;
})();
function expandKeyLE(key) {
  abytes3(key);
  const len = key.length;
  validateKeyLength(key);
  const { sbox2 } = tableEncoding;
  const toClean = [];
  if (!isAligned323(key))
    toClean.push(key = copyBytes3(key));
  const k32 = u323(key);
  const Nk = k32.length;
  const subByte = (n) => applySbox(sbox2, n, n, n, n);
  const xk = new Uint32Array(len + 28);
  xk.set(k32);
  for (let i = Nk; i < xk.length; i++) {
    let t = xk[i - 1];
    if (i % Nk === 0)
      t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
    else if (Nk > 6 && i % Nk === 4)
      t = subByte(t);
    xk[i] = xk[i - Nk] ^ t;
  }
  clean3(...toClean);
  return xk;
}
function apply0123(T01, T23, s0, s1, s2, s3) {
  return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
}
function applySbox(sbox2, s0, s1, s2, s3) {
  return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
}
function encrypt(xk, s0, s1, s2, s3) {
  const { sbox2, T01, T23 } = tableEncoding;
  let k = 0;
  s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
  const rounds = xk.length / 4 - 2;
  for (let i = 0; i < rounds; i++) {
    const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
    const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
    const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
    const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
    s0 = t02, s1 = t12, s2 = t22, s3 = t32;
  }
  const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
  const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
  const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
  const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
  return { s0: t0, s1: t1, s2: t2, s3: t3 };
}
function ctr32(xk, isLE7, nonce, src, dst) {
  abytes3(nonce, BLOCK_SIZE2, "nonce");
  abytes3(src);
  dst = getOutput2(src.length, dst);
  const ctr = nonce;
  const c32 = u323(ctr);
  const view = createView3(ctr);
  const src32 = u323(src);
  const dst32 = u323(dst);
  const ctrPos = isLE7 ? 0 : 12;
  const srcLen = src.length;
  let ctrNum = view.getUint32(ctrPos, isLE7);
  let { s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]);
  for (let i = 0; i + 4 <= src32.length; i += 4) {
    dst32[i + 0] = src32[i + 0] ^ s0;
    dst32[i + 1] = src32[i + 1] ^ s1;
    dst32[i + 2] = src32[i + 2] ^ s2;
    dst32[i + 3] = src32[i + 3] ^ s3;
    ctrNum = ctrNum + 1 >>> 0;
    view.setUint32(ctrPos, ctrNum, isLE7);
    ({ s0, s1, s2, s3 } = encrypt(xk, c32[0], c32[1], c32[2], c32[3]));
  }
  const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
  if (start < srcLen) {
    const b32 = new Uint32Array([s0, s1, s2, s3]);
    const buf = u8(b32);
    for (let i = start, pos = 0; i < srcLen; i++, pos++)
      dst[i] = src[i] ^ buf[pos];
    clean3(b32);
  }
  return dst;
}
function computeTag3(fn, isLE7, key, data, AAD) {
  const aadLength = AAD ? AAD.length : 0;
  const h = fn.create(key, data.length + aadLength);
  if (AAD)
    h.update(AAD);
  const num = u64Lengths2(8 * data.length, 8 * aadLength, isLE7);
  h.update(data);
  h.update(num);
  const res = h.digest();
  clean3(num);
  return res;
}
var gcm = /* @__PURE__ */ wrapCipher2({ blockSize: 16, nonceLength: 12, tagLength: 16, varSizeNonce: true }, function aesgcm(key, nonce, AAD) {
  if (nonce.length < 8)
    throw new Error("aes/gcm: invalid nonce length");
  const tagLength = 16;
  function _computeTag(authKey, tagMask, data) {
    const tag = computeTag3(ghash, false, authKey, data, AAD);
    for (let i = 0; i < tagMask.length; i++)
      tag[i] ^= tagMask[i];
    return tag;
  }
  function deriveKeys() {
    const xk = expandKeyLE(key);
    const authKey = EMPTY_BLOCK.slice();
    const counter = EMPTY_BLOCK.slice();
    ctr32(xk, false, counter, counter, authKey);
    if (nonce.length === 12) {
      counter.set(nonce);
    } else {
      const nonceLen = EMPTY_BLOCK.slice();
      const view = createView3(nonceLen);
      view.setBigUint64(8, BigInt(nonce.length * 8), false);
      const g = ghash.create(authKey).update(nonce).update(nonceLen);
      g.digestInto(counter);
      g.destroy();
    }
    const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
    return { xk, authKey, counter, tagMask };
  }
  return {
    encrypt(plaintext) {
      const { xk, authKey, counter, tagMask } = deriveKeys();
      const out = new Uint8Array(plaintext.length + tagLength);
      const toClean = [xk, authKey, counter, tagMask];
      if (!isAligned323(plaintext))
        toClean.push(plaintext = copyBytes3(plaintext));
      ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
      const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
      toClean.push(tag);
      out.set(tag, plaintext.length);
      clean3(...toClean);
      return out;
    },
    decrypt(ciphertext) {
      const { xk, authKey, counter, tagMask } = deriveKeys();
      const toClean = [xk, authKey, tagMask, counter];
      if (!isAligned323(ciphertext))
        toClean.push(ciphertext = copyBytes3(ciphertext));
      const data = ciphertext.subarray(0, -tagLength);
      const passedTag = ciphertext.subarray(-tagLength);
      const tag = _computeTag(authKey, tagMask, data);
      toClean.push(tag);
      if (!equalBytes2(tag, passedTag))
        throw new Error("aes/gcm: invalid ghash tag");
      const out = ctr32(xk, false, counter, data);
      clean3(...toClean);
      return out;
    }
  };
});
function isBytes32(a) {
  return a instanceof Uint32Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint32Array";
}
function encryptBlock(xk, block) {
  abytes3(block, 16, "block");
  if (!isBytes32(xk))
    throw new Error("_encryptBlock accepts result of expandKeyLE");
  const b32 = u323(block);
  let { s0, s1, s2, s3 } = encrypt(xk, b32[0], b32[1], b32[2], b32[3]);
  b32[0] = s0, b32[1] = s1, b32[2] = s2, b32[3] = s3;
  return block;
}
function dbl(block) {
  let carry = 0;
  for (let i = BLOCK_SIZE2 - 1; i >= 0; i--) {
    const newCarry = (block[i] & 128) >>> 7;
    block[i] = block[i] << 1 | carry;
    carry = newCarry;
  }
  if (carry) {
    block[BLOCK_SIZE2 - 1] ^= 135;
  }
  return block;
}
function xorBlock(a, b) {
  if (a.length !== b.length)
    throw new Error("xorBlock: blocks must have same length");
  for (let i = 0; i < a.length; i++) {
    a[i] = a[i] ^ b[i];
  }
  return a;
}
var _CMAC = class {
  buffer;
  destroyed;
  k1;
  k2;
  xk;
  constructor(key) {
    abytes3(key);
    validateKeyLength(key);
    this.xk = expandKeyLE(key);
    this.buffer = new Uint8Array(0);
    this.destroyed = false;
    const L = new Uint8Array(BLOCK_SIZE2);
    encryptBlock(this.xk, L);
    this.k1 = dbl(L);
    this.k2 = dbl(new Uint8Array(this.k1));
  }
  update(data) {
    const { destroyed, buffer } = this;
    if (destroyed)
      throw new Error("CMAC instance was destroyed");
    abytes3(data);
    const newBuffer = new Uint8Array(buffer.length + data.length);
    newBuffer.set(buffer);
    newBuffer.set(data, buffer.length);
    this.buffer = newBuffer;
    return this;
  }
  // see https://www.rfc-editor.org/rfc/rfc4493.html#section-2.4
  digest() {
    if (this.destroyed)
      throw new Error("CMAC instance was destroyed");
    const { buffer } = this;
    const msgLen = buffer.length;
    let n = Math.ceil(msgLen / BLOCK_SIZE2);
    let flag;
    if (n === 0) {
      n = 1;
      flag = false;
    } else {
      flag = msgLen % BLOCK_SIZE2 === 0;
    }
    const lastBlockStart = (n - 1) * BLOCK_SIZE2;
    const lastBlockData = buffer.subarray(lastBlockStart);
    let m_last;
    if (flag) {
      m_last = xorBlock(new Uint8Array(lastBlockData), this.k1);
    } else {
      const padded = new Uint8Array(BLOCK_SIZE2);
      padded.set(lastBlockData);
      padded[lastBlockData.length] = 128;
      m_last = xorBlock(padded, this.k2);
    }
    let x = new Uint8Array(BLOCK_SIZE2);
    for (let i = 0; i < n - 1; i++) {
      const m_i = buffer.subarray(i * BLOCK_SIZE2, (i + 1) * BLOCK_SIZE2);
      xorBlock(x, m_i);
      encryptBlock(this.xk, x);
    }
    xorBlock(x, m_last);
    encryptBlock(this.xk, x);
    clean3(m_last);
    return x;
  }
  destroy() {
    const { buffer, destroyed, xk, k1, k2 } = this;
    if (destroyed)
      return;
    this.destroyed = true;
    clean3(buffer, xk, k1, k2);
  }
};
var cmac = (key, message) => new _CMAC(key).update(message).digest();
cmac.create = (key) => new _CMAC(key);

// node_modules/ts-mls/dist/src/crypto/implementation/noble/makeAead.js
async function makeAead2(aeadAlg) {
  switch (aeadAlg) {
    case "AES128GCM":
      return [
        {
          encrypt(key, nonce, aad, plaintext) {
            return encryptAesGcm2(key, nonce, aad, plaintext);
          },
          decrypt(key, nonce, aad, ciphertext) {
            return decryptAesGcm2(key, nonce, aad, ciphertext);
          }
        },
        new Aes128Gcm()
      ];
    case "AES256GCM":
      return [
        {
          encrypt(key, nonce, aad, plaintext) {
            return encryptAesGcm2(key, nonce, aad, plaintext);
          },
          decrypt(key, nonce, aad, ciphertext) {
            return decryptAesGcm2(key, nonce, aad, ciphertext);
          }
        },
        new Aes256Gcm()
      ];
    case "CHACHA20POLY1305":
      try {
        const { Chacha20Poly1305: Chacha20Poly13052 } = await Promise.resolve().then(() => (init_mod2(), mod_exports));
        const { chacha20poly1305: chacha20poly13053 } = await Promise.resolve().then(() => (init_chacha2(), chacha_exports));
        return [
          {
            async encrypt(key, nonce, aad, plaintext) {
              return chacha20poly13053(key, nonce, aad).encrypt(plaintext);
            },
            async decrypt(key, nonce, aad, ciphertext) {
              return chacha20poly13053(key, nonce, aad).decrypt(ciphertext);
            }
          },
          new Chacha20Poly13052()
        ];
      } catch (err) {
        throw new DependencyError("Optional dependency '@hpke/chacha20poly1305' is not installed. Please install it to use this feature.");
      }
  }
}
async function encryptAesGcm2(key, nonce, aad, plaintext) {
  const cipher = gcm(key, nonce, aad);
  return cipher.encrypt(plaintext);
}
async function decryptAesGcm2(key, nonce, aad, ciphertext) {
  const cipher = gcm(key, nonce, aad);
  return cipher.decrypt(ciphertext);
}

// node_modules/ts-mls/dist/src/crypto/implementation/noble/makeHpke.js
async function makeHpke2(hpkealg) {
  const [aead, aeadInterface] = await makeAead2(hpkealg.aead);
  const cs = new CipherSuite({
    kem: await makeDhKem(hpkealg.kem),
    kdf: makeKdf(hpkealg.kdf),
    aead: aeadInterface
  });
  return makeGenericHpke(hpkealg, aead, cs);
}

// node_modules/ts-mls/dist/src/crypto/implementation/noble/provider.js
var nobleCryptoProvider = {
  async getCiphersuiteImpl(cs) {
    return {
      kdf: makeKdfImpl(makeKdf(cs.hpke.kdf)),
      hash: makeHashImpl2(cs.hash),
      signature: await makeNobleSignatureImpl(cs.signature),
      hpke: await makeHpke2(cs.hpke),
      rng: defaultRng,
      name: cs.name
    };
  }
};

// node_modules/ts-mls/dist/src/message.js
var mlsPublicMessageEncoder = contramapBufferEncoders([wireformatEncoder, publicMessageEncoder], (msg) => [msg.wireformat, msg.publicMessage]);
var encodeMlsPublicMessage = encode(mlsPublicMessageEncoder);
var mlsWelcomeEncoder = contramapBufferEncoders([wireformatEncoder, welcomeEncoder], (wm) => [wm.wireformat, wm.welcome]);
var encodeMlsWelcome = encode(mlsWelcomeEncoder);
var mlsPrivateMessageEncoder = contramapBufferEncoders([wireformatEncoder, privateMessageEncoder], (pm) => [pm.wireformat, pm.privateMessage]);
var encodeMlsPrivateMessage = encode(mlsPrivateMessageEncoder);
var mlsGroupInfoEncoder = contramapBufferEncoders([wireformatEncoder, groupInfoEncoder], (gi) => [gi.wireformat, gi.groupInfo]);
var encodeMlsGroupInfo = encode(mlsGroupInfoEncoder);
var mlsKeyPackageEncoder = contramapBufferEncoders([wireformatEncoder, keyPackageEncoder], (kp) => [kp.wireformat, kp.keyPackage]);
var encodeMlsKeyPackage = encode(mlsKeyPackageEncoder);
var mlsMessageContentEncoder = (mc) => {
  switch (mc.wireformat) {
    case "mls_public_message":
      return mlsPublicMessageEncoder(mc);
    case "mls_welcome":
      return mlsWelcomeEncoder(mc);
    case "mls_private_message":
      return mlsPrivateMessageEncoder(mc);
    case "mls_group_info":
      return mlsGroupInfoEncoder(mc);
    case "mls_key_package":
      return mlsKeyPackageEncoder(mc);
  }
};
var encodeMlsMessageContent = encode(mlsMessageContentEncoder);
var decodeMlsMessageContent = flatMapDecoder(decodeWireformat, (wireformat) => {
  switch (wireformat) {
    case "mls_public_message":
      return mapDecoder(decodePublicMessage, (publicMessage) => ({ wireformat, publicMessage }));
    case "mls_welcome":
      return mapDecoder(decodeWelcome, (welcome) => ({ wireformat, welcome }));
    case "mls_private_message":
      return mapDecoder(decodePrivateMessage, (privateMessage) => ({ wireformat, privateMessage }));
    case "mls_group_info":
      return mapDecoder(decodeGroupInfo, (groupInfo) => ({ wireformat, groupInfo }));
    case "mls_key_package":
      return mapDecoder(decodeKeyPackage, (keyPackage) => ({ wireformat, keyPackage }));
  }
});
var mlsMessageEncoder = contramapBufferEncoders([protocolVersionEncoder, mlsMessageContentEncoder], (w) => [w.version, w]);
var encodeMlsMessage = encode(mlsMessageEncoder);
var decodeMlsMessage = mapDecoders([decodeProtocolVersion, decodeMlsMessageContent], (version, mc) => ({ ...mc, version }));

// node_modules/ts-mls/dist/src/grease.js
var greaseValues = [
  2570,
  6682,
  10794,
  14906,
  19018,
  23130,
  27242,
  31354,
  35466,
  39578,
  43690,
  47802,
  51914,
  56026,
  60138
];
var defaultGreaseConfig = {
  probabilityPerGreaseValue: 0.1
};
function grease(greaseConfig) {
  return greaseValues.filter(() => greaseConfig.probabilityPerGreaseValue > Math.random());
}
function greaseCiphersuites(greaseConfig) {
  return grease(greaseConfig).map((n) => n.toString());
}
function greaseCredentials(greaseConfig) {
  return grease(greaseConfig).map((n) => n.toString());
}
function greaseCapabilities(config, capabilities) {
  return {
    ciphersuites: [...capabilities.ciphersuites, ...greaseCiphersuites(config)],
    credentials: [...capabilities.credentials, ...greaseCredentials(config)],
    extensions: [...capabilities.extensions, ...grease(config)],
    proposals: [...capabilities.proposals, ...grease(config)],
    versions: capabilities.versions
  };
}

// node_modules/ts-mls/dist/src/defaultCapabilities.js
function defaultCapabilities() {
  return greaseCapabilities(defaultGreaseConfig, {
    versions: ["mls10"],
    ciphersuites: Object.keys(ciphersuites),
    extensions: [],
    proposals: [],
    credentials: ["basic", "x509"]
  });
}

// scripts/.ts-mls-entry.mjs
init_mod2();
init_mod5();
init_ed25519();
export {
  acceptAll,
  branchGroup,
  bytesToBase64,
  ciphersuites,
  contentTypes,
  createApplicationMessage,
  createCommit,
  createGroup,
  createGroupInfoWithExternalPub,
  createGroupInfoWithExternalPubAndRatchetTree,
  createProposal,
  credentialTypes,
  decodeExternalSender,
  decodeGroupState,
  decodeMlsMessage,
  decodeNode,
  decodeRatchetTree,
  decodeRequiredCapabilities,
  defaultAuthenticationService,
  defaultCapabilities,
  defaultCryptoProvider,
  defaultExtensionTypes,
  defaultKeyPackageEqualityConfig,
  defaultKeyRetentionConfig,
  defaultLifetime,
  defaultLifetimeConfig,
  defaultPaddingConfig,
  defaultProposalTypes,
  ed25519,
  emptyPskIndex,
  encodeExternalSender,
  encodeGroupState,
  encodeMlsMessage,
  encodeNode,
  encodeRatchetTree,
  encodeRequiredCapabilities,
  extendRatchetTree,
  filteredDirectPath,
  generateKeyPackage,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  joinGroupExternal,
  joinGroupFromBranch,
  joinGroupFromReinit,
  joinGroupWithExtensions,
  makePskIndex,
  mlsExporter,
  nobleCryptoProvider,
  processMessage,
  processPrivateMessage,
  processPublicMessage,
  proposeAddExternal,
  proposeExternal,
  protocolVersions,
  reinitCreateNewGroup,
  reinitGroup,
  resumptionPSKUsages,
  senderTypes,
  zeroOutUint8Array
};
