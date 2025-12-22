

const getCrypto = (): Crypto => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    return (globalThis as any).crypto;
  }
  throw new Error("Web Crypto API not available. Use Node 19+ or a Secure Context (HTTPS).");
};

const cryptoAPI = getCrypto();
const subtle = cryptoAPI.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface EncryptedResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Converts a BufferSource (ArrayBuffer or TypedArray) to a Hex string.
 */
export const bufferToHex = (buffer: BufferSource): string => {
  let byteArray: Uint8Array;
  if (buffer instanceof Uint8Array) {
    byteArray = buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    byteArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    byteArray = new Uint8Array(buffer);
  }

  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Converts a Hex string back to a Uint8Array.
 */
export const hexToBuffer = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const match = hex.match(/.{1,2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map((byte) => Number.parseInt(byte, 16)));
};

/** 
  * Generates a random Master Key (256-bit AES key) and returns it as raw bytes.
  * Used for encrypting file contents.
  */
export const generateMasterKey = async (): Promise<BufferSource> => {
  const key: CryptoKey = await subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, 
    ["encrypt", "decrypt"]
  );
  
  const rawBuffer = await subtle.exportKey("raw", key);
  return rawBuffer;
};

export const generateAsymKeyPair = async (): Promise<{ publicKey: ArrayBuffer; privateKey: ArrayBuffer }> => {
  const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );

  const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return { publicKey, privateKey };
}


export const deriveKEK = async (password: string, salt: BufferSource): Promise<CryptoKey> => {
  const passwordKey: CryptoKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 600000, 
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false, 
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
};

/** 2. ENCRYPT (RSA-OAEP)
 * Encrypts data using RSA-OAEP with the provided public key.
 * @param data - The data to encrypt.
 * @param publicKey - The RSA public key.
 * @returns Encrypted data as Uint8Array.
 */
export const encryptRSA = async (
  data: BufferSource,
  publicKey: BufferSource
): Promise<Uint8Array> => {
  const cryptoKey = await subtle.importKey(
    "spki",
    publicKey,
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-256" }
    },
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    cryptoKey,
    data
  );
  return new Uint8Array(encryptedBuffer);
}

/** 5. DECRYPT (RSA-OAEP)
 * Decrypts data using RSA-OAEP with the provided private key.
 * @param ciphertext - The encrypted data to decrypt.
 * @param privateKey - The RSA private key.
 * @returns Decrypted data as Uint8Array.
 */
export const decryptRSA = async (
  ciphertext: BufferSource,
  privateKey: BufferSource
): Promise<Uint8Array> => {
  const cryptoKey = await subtle.importKey(
    "pkcs8",
    privateKey,
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-256" }
    },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await subtle.decrypt(
    {
      name: "RSA-OAEP"
    },
    cryptoKey,
    ciphertext
  );
  return new Uint8Array(decryptedBuffer);
}

/**
 * 3. ENCRYPT (AES-GCM)
 * Encrypts data using a generic key.
 * @param key - Can be a CryptoKey (for KEK) or BufferSource (raw bytes for MasterKey/FileKey)
 * @returns EncryptedResult containing ciphertext and nonce(12 bytes)
 */
export const encrypt = async (
  data: string | BufferSource,
  key: CryptoKey | BufferSource
): Promise<EncryptedResult> => {
  
  let cryptoKey: CryptoKey;

  // Check if 'key' is NOT a CryptoKey (i.e., it's raw bytes)
  if (!(key as CryptoKey).algorithm) {
    cryptoKey = await subtle.importKey(
      "raw",
      key as BufferSource,
      "AES-GCM",
      false,
      ["encrypt"]
    );
  } else {
    cryptoKey = key as CryptoKey;
  }

  let dataBuffer: BufferSource;
  if (typeof data === 'string') {
    dataBuffer = enc.encode(data);
  } else {
    dataBuffer = data;
  }

  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    dataBuffer
  );

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    nonce: iv,
  };
};

export async function deriveChunkKey(
  fileMasterKey: CryptoKey | BufferSource, 
  chunkIndex: number, 
  fileId: string
): Promise<CryptoKey> {
  const subtle = window.crypto.subtle;
  let hkdfKey: CryptoKey;

  if (fileMasterKey instanceof CryptoKey) {
    if (fileMasterKey.algorithm.name === "HKDF") {
      hkdfKey = fileMasterKey;
    } else {
      const rawBits = await subtle.exportKey("raw", fileMasterKey);
      hkdfKey = await subtle.importKey(
        "raw", 
        rawBits, 
        { name: "HKDF" }, 
        false, 
        ["deriveKey"]
      );
    }
  } else {
    hkdfKey = await subtle.importKey(
      "raw",
      fileMasterKey,
      { name: "HKDF" },
      false,
      ["deriveKey"]
    );
  }

  const encoder = new TextEncoder();
  const infoBuffer = encoder.encode(`file:${fileId}:chunk:${chunkIndex}`);

  return await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: infoBuffer
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * 4. DECRYPT (AES-GCM)
 * Decrypts data using a generic key.
 * @param ciphertext - The encrypted data to decrypt.
 * @param key - Can be a CryptoKey (for KEK) or BufferSource (raw bytes for MasterKey/FileKey)
 * @param iv - The nonce used during encryption (12 bytes).
 * @returns Decrypted data as Uint8Array.
 */
export const decrypt = async (
  ciphertext: BufferSource,
  key: CryptoKey | BufferSource,
  iv: BufferSource
): Promise<Uint8Array> => {
  // 1. Prepare the Key
  let cryptoKey: CryptoKey;

  if (!(key as CryptoKey).algorithm) {
    cryptoKey = await subtle.importKey(
      "raw",
      key as BufferSource,
      "AES-GCM",
      false,
      ["decrypt"]
    );
  } else {
    cryptoKey = key as CryptoKey;
  }

  try {
    const decryptedBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      ciphertext
    );
    return new Uint8Array(decryptedBuffer);
  } catch (error) {
    throw new Error("Decryption failed. Check key, nonce, or data integrity.");
  }
};