import { encryptChacha } from './crypto.js?';
import { bin2base64, base642bin } from './lib.js?';


self.onmessage = async (event) => {
  const { action, fileBuffer, dhkey, blob, key } = event.data;

  try {
    if (action === 'encryptBlob') {
      // Handle blob encryption for avatars
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const b64Plain = bin2base64(bytes);
      const cipherB64 = encryptChacha(key, b64Plain);
      const cipherBin = base642bin(cipherB64);

      if (!cipherB64) {
        throw new Error("Encryption returned null or undefined.");
      }

      const encryptedBlob = new Blob([cipherBin], { type: 'application/octet-stream' });
      self.postMessage({ blob: encryptedBlob });

    } else {
      // Legacy file buffer encryption
      const bytes = new Uint8Array(fileBuffer);
      const b64Plain = bin2base64(bytes);

      const cipherB64 = encryptChacha(dhkey, b64Plain);
      const cipherBin = base642bin(cipherB64);


      if (!cipherB64) {
        throw new Error("Encryption returned null or undefined.");
      }

      self.postMessage({ cipherBin }, [cipherBin.buffer]);
    }

  } catch (error) {
    self.postMessage({ error: `Encryption failed: ${error.message}` });
  }
};