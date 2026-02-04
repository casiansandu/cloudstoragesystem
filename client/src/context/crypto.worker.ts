import config from "../../config/config";
import srp from "secure-remote-password/client";
import type {
  SrpLoginStartResponse,
  SrpLoginVerifyResponse,
  GetUserKeysResponse,
  UserFile,
  ManifestData,
} from "../utils/apiTypes";
import {
  bufferToHex,
  hexToBuffer,
  decrypt,
  generateMasterKey,
  encrypt,
  deriveChunkKey,
  generateAsymKeyPair,
} from "../../utils/crypto";
import { concatUint8, gen_uuidv5 } from "../utils/funcs";
import { sha256 } from "js-sha256";
import { shareFileHybrid } from "../components/ShareFileFeature/shareFile";
import { fetchChunk } from "../components/DownloadFileFeature/downloadFile";
import {
  startHybridUpload,
  handleChunkEncryption,
  uploadChunk,
  encryptManifest,
} from "../components/UploadFileFeature/uploadFile";
import post_register from "../Register/registerUser";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { scrypt, scryptAsync } from "@noble/hashes/scrypt.js";

let user_rsa_private: CryptoKey | null = null;
let user_rsa_public: CryptoKey | null = null;

let user_mlkem_public: Uint8Array | null = null;
let user_mlkem_private: Uint8Array | null = null;

let user_x25519_public: Uint8Array | null = null;
let user_x25519_private: Uint8Array | null = null;

type keysData = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

const sessionFileKeys = new Map<string, keysData>();

export const getManifestData = async (
  file_id: string, fileManifestKey: Uint8Array
): Promise<ManifestData> => {
  if (!user_rsa_private) {
    throw new Error("User private key not initialized");
  }

  const manifest_name = sha256(file_id + "manifest");

  const manifest_data = await fetchChunk(file_id, gen_uuidv5(manifest_name));

  const enc_manifest_nonce = manifest_data.slice(0, 12);
  const enc_manifest_ciphertext = manifest_data.slice(12);

  const manifest = await decrypt(
    enc_manifest_ciphertext,
    fileManifestKey as BufferSource,
    enc_manifest_nonce,
  );

  const manifest_json: ManifestData = JSON.parse(
    new TextDecoder().decode(manifest),
  );

  return manifest_json;
};

const handleLastChunkAndManifest = async (
  encrypted_manifest_buffer: Uint8Array,
  chunk_data_buffer: Uint8Array,
  chunk_size: number,
  file_id: string,
  manifest_uuid: string,
) => {
  const manifest_data_len = encrypted_manifest_buffer.byteLength + 4;

  if (chunk_data_buffer.byteLength + manifest_data_len <= chunk_size) {
    const manifest_len = new Uint8Array(4);
    new DataView(manifest_len.buffer).setUint32(
      0,
      encrypted_manifest_buffer.byteLength,
      false,
    );

    const noise_len =
      chunk_size - (chunk_data_buffer.byteLength + manifest_data_len);

    let combined_chunk_buffer: Uint8Array;

    if (noise_len > 0) {
      const noise = crypto.getRandomValues(new Uint8Array(noise_len));
      const d1 = concatUint8(chunk_data_buffer, noise);
      const d2 = concatUint8(encrypted_manifest_buffer, manifest_len);
      combined_chunk_buffer = concatUint8(d1, d2);
    } else {
      const d1 = concatUint8(chunk_data_buffer, encrypted_manifest_buffer);
      combined_chunk_buffer = concatUint8(d1, manifest_len);
    }

    await uploadChunk(
      combined_chunk_buffer.buffer as ArrayBuffer,
      file_id,
      manifest_uuid,
    );
    console.log("Uploaded last chunk with manifest and noise");
  }
};

const initializeUserKeys = async (username: string, password: string) => {
  const user_keys_info = await fetch(`${config.BACKENDURL}/users/keys`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
    .then((res) => res.json() as Promise<GetUserKeysResponse>)
    .then(async (data) => {
      if (!data.success) {
        throw new Error(data.message);
      }
      console.log("Fetched user keys:", data);

      return data.data;
    });

  const user_master_key = await scryptAsync(
    new TextEncoder().encode(password), 
    hexToBuffer(user_keys_info.kdf_salt),
    { N: 16384, r: 8, p: 1, dkLen: 32 }
  );

  const private_key_data = new Uint8Array(
    hexToBuffer(user_keys_info.encrypted_user_rsa_private),
  );
  const private_key_nonce = private_key_data.slice(0, 12);
  const private_key_ciphertext = private_key_data.slice(12);

  const decryptedPrivateKey = await decrypt(
    private_key_ciphertext,
    user_master_key as BufferSource,
    private_key_nonce,
  );

  user_rsa_private = await crypto.subtle.importKey(
    "pkcs8",
    decryptedPrivateKey as BufferSource,
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-256" },
    },
    false,
    ["decrypt"],
  );

  user_rsa_public = await crypto.subtle.importKey(
    "spki",
    hexToBuffer(user_keys_info.user_rsa_public) as BufferSource,
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-256" },
    },
    false,
    ["encrypt"],
  );

  console.log("RSA user keys initialized in worker.");

  const { nonce: enc_seed_nonce, enc_seed } = await fetch(
    `${config.BACKENDURL}/users/keys/${username}/encrypted_seed`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        throw new Error("Failed to fetch user's encrypted seed");
      }
      const fullSeedBuffer = new Uint8Array(
        hexToBuffer(data.data.encrypted_seed),
      );

      return {
        nonce: fullSeedBuffer.slice(0, 12),
        enc_seed: fullSeedBuffer.slice(12),
      };
    });

  if (!user_master_key) {
    throw new Error("User master key not derived");
  }

  const decrypted_seed = await decrypt(enc_seed, user_master_key as BufferSource, enc_seed_nonce);
  console.log("Decrypted user seed");

  const ml_kem_keys = ml_kem768.keygen(decrypted_seed.slice(0, 64));

  user_mlkem_private = ml_kem_keys.secretKey;
  user_mlkem_public = ml_kem_keys.publicKey;

  user_x25519_private = decrypted_seed.slice(64);
  user_x25519_public = x25519.getPublicKey(user_x25519_private);

  console.log("MKLEM and X25519 user keys initialized in worker.");
};

const getUserHybridKeys = async (
  recipient_username: string,
): Promise<{ recipient_mlkem_public: Uint8Array; recipient_x25519_public: Uint8Array }> => {

  const {recipient_mlkem_public, recipient_x25519_public} = await fetch(`${config.BACKENDURL}/users/keys/${recipient_username}/public_keys_bundle`,
  {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  },
  )
  .then((res) => res.json())
  .then((data) => {
    if (!data.success) {
      throw new Error("Failed to fetch recipient's public keys: " + data.message);
    }
    const fullKeysBuffer = new Uint8Array(
      hexToBuffer(data.data.public_keys_bundle),
    );
    return {
      recipient_mlkem_public: fullKeysBuffer.slice(0, 1184),
      recipient_x25519_public: fullKeysBuffer.slice(1184),
    };
  });

  return { recipient_mlkem_public, recipient_x25519_public };
}

const getXwingKeyForFile = async (file_id: string) => {

  if (!user_mlkem_private || !user_x25519_private || !user_x25519_public) {
    throw new Error("User keys not initialized");
  }
  
  const { mlkem_ciphertext, x25519_ephemeral_public } = await fetch(
    `${config.BACKENDURL}/files/${file_id}/hybrid_info`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        throw new Error("Failed to fetch hybrid key data for file");
      }

      return {
        mlkem_ciphertext: hexToBuffer(data.data.mlkem_ciphertext),
        x25519_ephemeral_public: hexToBuffer(data.data.x25519_ephemeral_public),
      };
    });
  const mlkem_shared_secret = ml_kem768.decapsulate(
    mlkem_ciphertext,
    user_mlkem_private,
  );
  const x25519_shared_secret = x25519.getSharedSecret(
    user_x25519_private,
    x25519_ephemeral_public,
  );

  const xwing_key = sha3_256(concatUint8(
    new TextEncoder().encode("\\./^\\"),
    mlkem_shared_secret,
    x25519_shared_secret,
    x25519_ephemeral_public,
    user_x25519_public,
  ));

  return xwing_key;
};

const generateHybridSharedKey = async (
  recipient_mlkem_public: Uint8Array,
  recipient_x25519_public: Uint8Array,
) => {


  if (!user_mlkem_private || !user_x25519_private || !user_x25519_public) {
    throw new Error("User keys not initialized");
  }

  //mlkem shared secret using recipient's public mlkem key
  //the ciphertext will be stored in the db and the recipient can use it to decapsulate and get the shared secret
  const mlkem_encapsulation_result = ml_kem768.encapsulate(
    recipient_mlkem_public
  );

  const x25519_ephemeral = x25519.keygen();
  //ephemeral x25519 keypair for this sharing session made using ephemeral private x25519 key and recipient's public x25519 key
  const x25519_shared_secret = x25519.getSharedSecret(
    x25519_ephemeral.secretKey,
    recipient_x25519_public,
  );
  
  const xwing_key = sha3_256(concatUint8(
    new TextEncoder().encode("\\./^\\"),
    mlkem_encapsulation_result.sharedSecret, 
    x25519_shared_secret, 
    x25519_ephemeral.publicKey,
    recipient_x25519_public
  ));

  return { xwing_key, x25519_ephemeral_public: x25519_ephemeral.publicKey, mlkem_ciphertext: mlkem_encapsulation_result.cipherText };
}

const expandKeyForName = (key: Uint8Array) => {

  const usableKey = key instanceof Uint8Array ? key : new Uint8Array(key);

  const fileNameKey = hkdf(
    sha3_256,
    usableKey,
    undefined,
    new TextEncoder().encode("file-name-encryption"),
    32
  );

  return fileNameKey;
}

const expandKeyForData = (key: Uint8Array) => {

  const usableKey = key instanceof Uint8Array ? key : new Uint8Array(key);

  const fileDataKey = hkdf(
    sha3_256,
    usableKey,
    undefined,
    new TextEncoder().encode("file-chunk-encryption"),
    32
  );

  return fileDataKey;
}

const expandKeyForManifest = (key: Uint8Array) => {

  const usableKey = key instanceof Uint8Array ? key : new Uint8Array(key);
  const manifestKey = hkdf(
    sha3_256,
    usableKey,
    undefined,
    new TextEncoder().encode("file-manifest-encryption"),
    32
  );
  return manifestKey;
}


globalThis.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    let result;

    switch (type) {
      case "PERFORM_FULL_LOGIN": {
        const username = payload.username;
        const password = payload.password;

        const { public: client_public, secret: client_secret } =
          srp.generateEphemeral();

        const startRes = await fetch(`${config.BACKENDURL}/auth/login/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, client_public }),
        });

        const startData: SrpLoginStartResponse = await startRes.json();
        if (!startData.success) throw new Error(startData.message);

        const loginSessionId = startData.data.loginSessionId;

        const privateKey = srp.derivePrivateKey(
          startData.data.salt,
          username,
          password,
        );

        const clientSession = srp.deriveSession(
          client_secret,
          startData.data.server_public,
          startData.data.salt,
          username,
          privateKey,
        );

        const verifyRes = await fetch(
          `${config.BACKENDURL}/auth/login/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              client_session_proof: clientSession.proof,
              loginSessionId,
            }),
          },
        );

        const verifyData: SrpLoginVerifyResponse = await verifyRes.json();
        if (!verifyData.success) throw new Error(verifyData.message);

        srp.verifySession(
          client_public,
          clientSession,
          verifyData.data.server_session_proof,
        );

        await initializeUserKeys(username, password);

        result = { success: true };

        break;
      }

      case "REGISTER_USER": {
        const username = payload.username;
        const password = payload.password;
        const email = payload.email;

        const salt = srp.generateSalt();
        const _privateKey = srp.derivePrivateKey(salt, username, password);
        const verifier = srp.deriveVerifier(_privateKey);

        const { publicKey, privateKey } = await generateAsymKeyPair();
        console.log("Generated key pair for user");
        //A, a

        const seed = crypto.getRandomValues(new Uint8Array(96));

        const mlkem_seed = seed.slice(0, 64); // first 64 bytes
        const x25519_priv = seed.slice(64); // last 32 bytes

        const { secretKey: mlkem_secret, publicKey: mlkem_public } =
          ml_kem768.keygen(mlkem_seed);
        const x25519_public = x25519.getPublicKey(x25519_priv);

        const kdf_salt = crypto.getRandomValues(new Uint8Array(16));
        //salt for user master key derivation

        const user_master_key = await scryptAsync(
          new TextEncoder().encode(password),
          kdf_salt,
          { N: 16384, r: 8, p: 1, dkLen: 32 }
        );
        //derive better password with scrypt

        const encrypted_seed = await encrypt(seed, user_master_key as BufferSource);
        //encrypt seed with user master key

        const encryptedPrivateKey = await encrypt(privateKey, user_master_key as BufferSource);
        //encrypted private key with user master key

        //server stores enc_{user_master_key}(a), A, encryption salt, and nonce

        console.log(
          bufferToHex(encrypted_seed.nonce as BufferSource),
          bufferToHex(encrypted_seed.ciphertext as BufferSource),
        );

        await post_register(
          username,
          email,
          salt,
          verifier,
          kdf_salt,
          concatUint8(
            encryptedPrivateKey.nonce,
            encryptedPrivateKey.ciphertext,
          ),
          new Uint8Array(publicKey),
          concatUint8( mlkem_public, x25519_public),
          concatUint8(encrypted_seed.nonce, encrypted_seed.ciphertext),
        );

        result = { success: true };

        break;
      }

      case "GET_FILE_KEYS": {

        const user_file_keys = await fetch(
          `${config.BACKENDURL}/users/file-keys`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        )
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) {
              throw new Error("Failed to fetch user file keys: " + data.message);
            }
            return data.data.fileKeysData as {
              file_id: string;
              encrypted_file_key: string;
            }[];
          });

        for (const {
          file_id,
          encrypted_file_key,
        } of user_file_keys) {
          sessionFileKeys.set(file_id, {
            encrypted_file_key,
            temp_decrypted_file_key: null,
          });
        }
        result = { success: true };
        break;
      }

      case "GET_FILE_NAMES": {

        const files = payload.files as UserFile[];

        const decryptedFilesPromise = files.map(async (file) => {
          try {
            const file_key = sessionFileKeys.get(
              file.id,
            )?.encrypted_file_key;

            if (!file_key) {
              throw new Error(
                "File master key not found in session for file: " + file.id,
              );
            }

            const xwing_key = await getXwingKeyForFile(file.id);

            const decrypted_file_key = (await decrypt(
              hexToBuffer(file_key).slice(12),
              xwing_key as BufferSource,
              hexToBuffer(file_key).slice(0, 12)
            )) as BufferSource;

            const file_name_key = expandKeyForName(decrypted_file_key as Uint8Array);

            const enc_name_data = hexToBuffer(file.name);
            const nonce = enc_name_data.slice(0, 12);
            const ciphertext = enc_name_data.slice(12);

            const decrypted_name_buffer = await decrypt(
              ciphertext,
              file_name_key as BufferSource,
              nonce,
            );

            const decryptedName = new TextDecoder().decode(
              decrypted_name_buffer,
            );

            return { ...file, id: file.id, name: decryptedName };
          } catch (error) {
            console.error("Decryption failed for:", file.name, error);
            return ({ id: file.id, name: "File data could not be recovered" });
          }
        });

        result = { files: await Promise.all(decryptedFilesPromise) };

        break;
      }

      case "UPLOAD_FILE": {
        const selectedFile: File = payload.file;
        let file_id = "";
        const share_duration: number = 0; // indefinite time

        if (selectedFile.size === 0) {
          throw new Error("Cannot upload empty file.");
        } else if (selectedFile.size > 10 * 1024 * 1024 * 1024) {
          throw new Error("File size exceeds the 10 GB limit.");
        }

        if (!user_mlkem_public || !user_x25519_public) {
          throw new Error("User hybrid public keys not initialized");
        }

        const file_size_bytes = selectedFile.size;

        const chunk_size = 5 * 1024 * 1024; // 5 MB
        const chunk_number = Math.ceil(file_size_bytes / chunk_size);

        const _file_key = await generateMasterKey() as Uint8Array;

        const fileNameKey = expandKeyForName(_file_key);
        const fileDataKey = expandKeyForData(_file_key);
        const fileManifestKey = expandKeyForManifest(_file_key);

        const { xwing_key, x25519_ephemeral_public, mlkem_ciphertext } =
          await generateHybridSharedKey(
            user_mlkem_public,
            user_x25519_public,
          );

        const { nonce: enc_file_key_nonce, ciphertext: enc_file_key_ciphertext } =
          await encrypt(_file_key as BufferSource, xwing_key as BufferSource);

        const enc_file_key = bufferToHex(
          concatUint8(enc_file_key_nonce, enc_file_key_ciphertext) as BufferSource,
        );

        const enc_file_name_data = await encrypt(selectedFile.name, fileNameKey as BufferSource);

        file_id = await startHybridUpload(
          enc_file_name_data,
          selectedFile,
          file_id,
          enc_file_key,
          x25519_ephemeral_public,
          mlkem_ciphertext,
          share_duration,
        );

        const manifest: ManifestData = {
          file_id: file_id,
          totalChunks: chunk_number,
          uploadedAt: new Date().toISOString(),
          encryptedFileKey: enc_file_key,
          file_size: file_size_bytes,
          chunkInfos: [],
        };

        let chunk_index = 0;

        while (chunk_index < chunk_number) {
          const { chunk_data_buffer, chunk_id } = await handleChunkEncryption(
            fileDataKey as BufferSource,
            chunk_index,
            file_id,
            chunk_size,
            selectedFile,
            chunk_number,
          );

          await uploadChunk(chunk_data_buffer, file_id, chunk_id);

          manifest.chunkInfos.push({
            index: chunk_index,
            id: chunk_id,
            ciphertextLength: chunk_data_buffer.byteLength,
          });

          chunk_index += 1;
        }

        const {
          encrypted_manifest_buffer,
          manifest_uuid,
        } = await encryptManifest(
          file_id,
          manifest,
          fileManifestKey
        );

        await uploadChunk(encrypted_manifest_buffer, file_id, manifest_uuid);

        sessionFileKeys.set(file_id, {
          encrypted_file_key: enc_file_key,
          temp_decrypted_file_key: null,
        });

        result = { success: true, fileId: file_id };
        break;
      }

      case "GET_CHUNK_INFOS": {
        
        if (!user_mlkem_private || !user_x25519_private || !user_x25519_public) {
          throw new Error("User keys not initialized");
        }

        const file_id: string = payload.fileId;

        if (!sessionFileKeys.get(file_id)) {
          throw new Error("File session data not found for file: " + file_id);
        }
        const encrypted_file_key = sessionFileKeys.get(file_id)?.encrypted_file_key;
        if (!encrypted_file_key) {
          throw new Error("File key not found in session for file: " + file_id);
        }

        const xwing_key = await getXwingKeyForFile(file_id) as BufferSource;

        const file_key = await decrypt(
          hexToBuffer(encrypted_file_key).slice(12),
          xwing_key,
          hexToBuffer(encrypted_file_key).slice(0, 12)
        );

        const fileManifestKey = expandKeyForManifest(file_key);

        const manifest_json = await getManifestData(file_id, fileManifestKey);
        const file_size = manifest_json.file_size;

        result = { fileSize: file_size, chunks: manifest_json.chunkInfos };
        break;
      }

      case "GET_AND_DECRYPT_CHUNK": {

        if (!user_mlkem_private || !user_x25519_private || !user_x25519_public || !user_mlkem_public) {
          throw new Error("User keys not initialized");
        }

        const file_id: string = payload.fileId;
        const chunk_id: string = payload.chunkId;
        const chunk_index = payload.chunkIndex;

        if (!sessionFileKeys.get(file_id)) {
          throw new Error("File session data not found for file: " + file_id);
        }

        const chunk_data = await fetchChunk(file_id, chunk_id);

        const file_master_key_encrypted =
          sessionFileKeys.get(file_id)?.encrypted_file_key;

        if (!file_master_key_encrypted) {
          throw new Error(
            "File master key not found in session for file: " + file_id,
          );
        }

        let file_master_key =
          sessionFileKeys.get(file_id)!.temp_decrypted_file_key;

        if (!file_master_key) {
          const enc_file_key_data = hexToBuffer(file_master_key_encrypted);
          const enc_file_key_nonce = enc_file_key_data.slice(0, 12);
          const enc_file_key_ciphertext = enc_file_key_data.slice(12);

          const xwing_key = await getXwingKeyForFile(file_id);

          file_master_key = expandKeyForData(await decrypt(
            enc_file_key_ciphertext,
            xwing_key as BufferSource,
            enc_file_key_nonce,
          )) as BufferSource;
          sessionFileKeys.get(file_id)!.temp_decrypted_file_key =
             file_master_key;
        }

        const chunk_key = await deriveChunkKey(
          file_master_key,
          chunk_index,
          file_id,
        );

        const chunk_nonce = chunk_data.slice(0, 12);
        const chunk_ciphertext = chunk_data.slice(12);

        const decrypted_chunk = await decrypt(
          chunk_ciphertext,
          chunk_key,
          chunk_nonce,
        );

        result = { decryptedChunk: decrypted_chunk };

        self.postMessage(
          {
            id,
            type: "SUCCESS",
            result,
          },
          {
            transfer: [decrypted_chunk.buffer],
          },
        );
        console.log("decrypted chunk", chunk_index);
        //console.log(decrypted_chunk.byteLength);// prevent double, hand over memory to main thread -> len 0
        return;
      }

      case "SHARE_FILE": {

        if (!user_mlkem_private || !user_x25519_private || !user_x25519_public || !user_mlkem_public) {
          throw new Error("User keys not initialized");
        }

        const file_id: string = payload.fileId;
        const recipient_username: string = payload.recipientUsername;
        const share_duration: number = payload.share_duration;

        const { recipient_x25519_public, recipient_mlkem_public} = await getUserHybridKeys(recipient_username);

        const { xwing_key, x25519_ephemeral_public, mlkem_ciphertext } =
          await generateHybridSharedKey(
            recipient_mlkem_public,
            recipient_x25519_public,
          );

        console.log("Xwing key generated for sharing");

        const encrypted_file_key = sessionFileKeys.get(
          payload.fileId,
        )?.encrypted_file_key;
        if (!encrypted_file_key) {
          throw new Error(
            "File session data not found for file: " + payload.fileId,
          );
        }

        const xwing_personal = await getXwingKeyForFile(file_id);

        await shareFileHybrid(
          file_id,
          recipient_username,
          encrypted_file_key,
          xwing_key,
          mlkem_ciphertext,
          x25519_ephemeral_public,
          share_duration,
          xwing_personal
        );

        result = { success: true };
        break;

      }

      case "LOGOUT_USER": {
        user_rsa_private = null;
        user_rsa_public = null;
        user_mlkem_public = null;
        user_mlkem_private = null;
        user_x25519_public = null;
        user_x25519_private = null;
        sessionFileKeys.clear();

        await fetch(`${config.BACKENDURL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });

        result = { success: true };
        break;
      }

      case "CLOSE_FILE": {
        const file_id = payload.fileId;

        const entry = sessionFileKeys.get(file_id);
        if (entry) {
          entry.temp_decrypted_file_key = null;
        }

        result = { success: true };
        break;
      }

      default:
        throw new Error(`Unknown command: ${type}`);
    }

    self.postMessage({ id, type: "SUCCESS", result });
  } catch (err: any) {
    self.postMessage({
      id,
      type: "ERROR",
      result: { success: false },
      error: err.message,
    });
  }
};

export {};