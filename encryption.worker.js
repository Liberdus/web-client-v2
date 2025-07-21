import { encryptChacha } from './crypto.js?';
import { bin2base64 } from './lib.js?';

self.onmessage = async (event) => {
  const { fileBuffer, dhkey } = event.data;

  try {
    const bytes = new Uint8Array(fileBuffer);
    const b64Plain = bin2base64(bytes);

    const cipherB64 = encryptChacha(dhkey, b64Plain);

    if (!cipherB64) {
      throw new Error("Encryption returned null or undefined.");
    }

    self.postMessage({ encryptedFileBuffer: cipherB64 });;

  } catch (error) {
    self.postMessage({ error: `Encryption failed: ${error.message}` });
  }
};