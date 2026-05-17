import config from "../../config/config";
import srp from "secure-remote-password/client";
import type {
  SrpLoginStartResponse,
  SrpLoginVerifyResponse,
  GetUserKeysResponse,
  ManifestData,
  EncryptedUserFile,
  EncryptedUserFolder,
  EncryptedUserFileNoKey,
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

let current_folder_key: Uint8Array | null = null;
let current_folder_id: string | null = null;
let current_folder_parent_id: string | null = null;

let user_ark: Uint8Array | null = null;

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

const initializeUserData = async (username: string, password: string) => {
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
      console.log("Fetched user keys");

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

  if (!user_master_key) {
    throw new Error("User master key not derived");
  }

  const { nonce: enc_ark_nonce, enc_ark } = await fetch(
    `${config.BACKENDURL}/users/keys/${username}/encrypted_ark`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        throw new Error("Failed to fetch user's encrypted ark");
      }
      const fullArkBuffer = new Uint8Array(
        hexToBuffer(data.data.encrypted_ark),
      );

      return {
        nonce: fullArkBuffer.slice(0, 12),
        enc_ark: fullArkBuffer.slice(12),
      };
    });
  
  user_ark = await decrypt(
    enc_ark, 
    user_master_key as BufferSource, 
    enc_ark_nonce
  );

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

  const decrypted_seed = await decrypt(enc_seed, user_master_key as BufferSource, enc_seed_nonce);
  console.log("Decrypted user seed");

  const ml_kem_keys = ml_kem768.keygen(decrypted_seed.slice(0, 64));

  user_mlkem_private = ml_kem_keys.secretKey;
  user_mlkem_public = ml_kem_keys.publicKey;

  user_x25519_private = decrypted_seed.slice(64);
  user_x25519_public = x25519.getPublicKey(user_x25519_private);

  console.log("MKLEM and X25519 user keys initialized in worker.");


  // const root_folder_key = hkdf(
  //   sha3_256,
  //   decrypted_seed,
  //   undefined,//no salt needed since seed is already high entropy and unique per user
  //   hexToBuffer("root-folder-key-v1") as BufferSource as Uint8Array,
  //   32
  // ); old


  const hasRootFolder = await fetch(`${config.BACKENDURL}/folders/root/exists`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  .then(res => res.json());

  let root_folder_key: Uint8Array;

  if (!hasRootFolder.success) {
    throw new Error("Failed to check for root folder existence: " + hasRootFolder.message);
  }
  console.log("Root folder existence check:", hasRootFolder.data.id);
  if (hasRootFolder.data.exists) {
    const { nonce: root_folder_key_nonce, root_folder_key_ciphertext } = await fetch(
      `${config.BACKENDURL}/folders/${hasRootFolder.data.id}/data`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    ).then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error("Failed to fetch users' root folder key data: " + data.message);
        }
        const fullKeyData = new Uint8Array(
          hexToBuffer(data.data.encrypted_key_data),
        );

        return {
          nonce: fullKeyData.slice(0, 12),
          root_folder_key_ciphertext: fullKeyData.slice(12),
        };
    });

    root_folder_key = await decrypt(
      root_folder_key_ciphertext,
      user_ark as BufferSource,
      root_folder_key_nonce,
    );
  } else {
    console.log("No root folder found for user, creating one...");
    root_folder_key = await generateMasterKey() as Uint8Array;
    const encrypted_name_data = await encrypt(new TextEncoder().encode("root") as BufferSource, root_folder_key as BufferSource);
    // const encrypted_root_folder_key = await encrypt(root_folder_key as BufferSource, user_master_key as BufferSource);
    const encrypted_root_folder_key = await encrypt(root_folder_key as BufferSource, user_ark as BufferSource);
    await createFolderForUser(
      concatUint8(encrypted_root_folder_key.nonce, encrypted_root_folder_key.ciphertext),
      null,
      concatUint8(encrypted_name_data.nonce, encrypted_name_data.ciphertext)
    );
    console.log("Created root folder for user");
  }

  current_folder_key = root_folder_key;
  console.log("Derived and assigned root folder key for user.");

  current_folder_id = await getRootFolderId();
  console.log("Fetched root folder id:" + current_folder_id);
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
    new TextEncoder().encode("\\.//^\\"),
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
    new TextEncoder().encode("\\.//^\\"),
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

const createFolderForUser = async (encrypted_folder_key_data: Uint8Array, parent_folder_id: string | null, encrypted_folder_name_data: Uint8Array | null)
: Promise<string> => {
  const res = await fetch(`${config.BACKENDURL}/folders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      encrypted_key_data: bufferToHex(encrypted_folder_key_data as BufferSource),
      parent_folder_id,
      encrypted_folder_name_data: bufferToHex(encrypted_folder_name_data as BufferSource),
    }),
  });
  const data = await res.json();
  console.log("Create folder response:", {message: data.data.message, success: data.success});

  if (!data.success) {
    throw new Error("Failed to create folder for user: " + data.data.message);
  }

  return data.data.id;
}

const getRootFolderId = async () => {

  const res = await fetch(`${config.BACKENDURL}/folders/root/id`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch root folder id: " + data.message);
  }

  return data.data.root_folder_id;
  
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

        await initializeUserData(username, password);

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
        const ark = crypto.getRandomValues(new Uint8Array(32));

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

        const encrypted_ark = await encrypt(ark, user_master_key as BufferSource);
        //encrypt ark with user master key

        const encryptedPrivateKey = await encrypt(privateKey, user_master_key as BufferSource);
        //encrypted private key with user master key


        const root_folder_key = hkdf(
          sha3_256,
          seed,
          undefined,//no salt needed since seed is already high entropy and unique per user
          hexToBuffer("root-folder-key-v1") as BufferSource as Uint8Array,
          32
        );
        //derive root folder key from seed with different context info

        const encrypted_root_folder_key = await encrypt(root_folder_key as BufferSource, user_master_key as BufferSource);
        //encrypt root folder key with user master key

        const user_id = await post_register(
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
          concatUint8(mlkem_public, x25519_public),
          concatUint8(encrypted_seed.nonce, encrypted_seed.ciphertext),
          concatUint8(encrypted_ark.nonce, encrypted_ark.ciphertext),
        );

        //root folder creation
        //await createFolderForUser(concatUint8(encrypted_root_folder_key.nonce, encrypted_root_folder_key.ciphertext), null, null);
        //console.log("Created root folder for user:", user_id);

        result = { success: true };

        break;
      }

      case "UPLOAD_FILE": {

        if (!current_folder_id || !current_folder_key) {
          throw new Error("Current folder data not initialized");
        }

        const selectedFile: File = payload.file;
        let file_id = "";
        const share_duration: number = 0; // indefinite time

        if (selectedFile.size === 0) {
          throw new Error("Cannot upload empty file.");
        } else if (selectedFile.size > 10 * 1024 * 1024 * 1024) {
          throw new Error("File size exceeds the 10 GB limit.");
        }

        // if (!user_mlkem_public || !user_x25519_public) {
        //   throw new Error("User hybrid public keys not initialized");
        // }

        const file_size_bytes = selectedFile.size;

        const chunk_size = 5 * 1024 * 1024; // 5 MB
        const chunk_number = Math.ceil(file_size_bytes / chunk_size);

        const _file_key = await generateMasterKey() as Uint8Array;

        const fileNameKey = expandKeyForName(_file_key);
        const fileDataKey = expandKeyForData(_file_key);
        const fileManifestKey = expandKeyForManifest(_file_key);

        // const { xwing_key, x25519_ephemeral_public, mlkem_ciphertext } =
        //   await generateHybridSharedKey(
        //     user_mlkem_public,
        //     user_x25519_public,
        //   );

        // const { nonce: enc_file_key_nonce, ciphertext: enc_file_key_ciphertext } =
        //   await encrypt(_file_key as BufferSource, xwing_key as BufferSource);

        const { nonce: enc_file_key_nonce, ciphertext: enc_file_key_ciphertext } = 
          await encrypt(_file_key as BufferSource, current_folder_key as BufferSource);

        const enc_file_key_data = bufferToHex(
          concatUint8(enc_file_key_nonce, enc_file_key_ciphertext) as BufferSource,
        );

        const enc_file_name_data = await encrypt(selectedFile.name, fileNameKey as BufferSource);

        file_id = await startHybridUpload(
          enc_file_name_data,
          selectedFile,
          file_id,
          enc_file_key_data,
          share_duration,
          current_folder_id,
        );

        const manifest: ManifestData = {
          file_id: file_id,
          totalChunks: chunk_number,
          uploadedAt: new Date().toISOString(),
          encryptedFileKey: enc_file_key_data,
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
          encrypted_file_key: enc_file_key_data,
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

        let file_key: Uint8Array;

        const enc_file_key_data = hexToBuffer(encrypted_file_key);
        const file_key_nonce = enc_file_key_data.slice(0, 12);
        const file_key_ciphertext = enc_file_key_data.slice(12);
        try {
          file_key = await decrypt(
            file_key_ciphertext,
            current_folder_key as BufferSource,
            file_key_nonce,
          );
        } catch (normal_error) {
          try {
            const xwing_key = await getXwingKeyForFile(file_id);
            file_key = await decrypt(
              file_key_ciphertext,
              xwing_key as BufferSource,
              file_key_nonce,
            );
          } catch (xwing_error) {
            console.warn(`Decryption of file key for file ${file_id} failed.`, {
              normal_error,
              xwing_error,
            });
            throw new Error("Failed to decrypt file key for file: " + file_id);
          }
        }
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

        let file_key =
          sessionFileKeys.get(file_id)!.temp_decrypted_file_key;

        if (!file_key) {
          const enc_file_key_data = hexToBuffer(file_master_key_encrypted);
          const enc_file_key_nonce = enc_file_key_data.slice(0, 12);
          const enc_file_key_ciphertext = enc_file_key_data.slice(12);

          try {
            file_key = expandKeyForData(await decrypt(
              enc_file_key_ciphertext,
              current_folder_key as BufferSource,
              enc_file_key_nonce,
            )) as BufferSource;
          }
          catch (normal_error) {
            try {
              const xwing_key = await getXwingKeyForFile(file_id);
              file_key = expandKeyForData(await decrypt(
                enc_file_key_ciphertext,
                xwing_key as BufferSource,
                enc_file_key_nonce,
              )) as BufferSource;
            } catch (xwing_error) {
              console.warn(`Decryption of file key for file ${file_id} failed.`, {
                normal_error, xwing_error,
              });
              throw new Error("Failed to decrypt file key for file: " + file_id);
            }
          }
          
          sessionFileKeys.get(file_id)!.temp_decrypted_file_key =
             file_key;
        }

        const chunk_key = await deriveChunkKey(
          file_key,
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

      case "SET_CURRENT_FOLDER": {

        const folder_id: string = payload.folderId;

        if (folder_id === current_folder_id) {
          result = { success: true };
          break;
        }

        current_folder_id = folder_id;

        const res = await fetch(
          `${config.BACKENDURL}/folders/${folder_id}/data`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );
        const data = await res.json();

        if (!data.success) {
          throw new Error("Failed to fetch folder key data: " + data.message);
        }

        const enc_folder_key_data = hexToBuffer(data.data.encrypted_key_data);
        const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
        const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

        current_folder_key = await decrypt(
          enc_folder_key_ciphertext,
          user_ark as BufferSource,
          enc_folder_key_nonce,
        );


        result = { success: true };
        break;
      }

      case "GET_FOLDER_PARENT_ID_AND_NAME": {

        const folder_id: string = payload.folderId;

        if (!current_folder_key) {
          throw new Error("Current folder key not initialized");
        }

        const root_folder_id = await getRootFolderId();
        if (folder_id === root_folder_id) {
          result = { parentId: "", parentName: "root" };
          break;
        }

        let parent_folder_key: Uint8Array;

        const { parent_id } = await fetch(
          `${config.BACKENDURL}/folders/${folder_id}/data`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        )
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) {
              throw new Error("Failed to fetch parent folder info: " + data.message);
            }
            return {
              parent_id: data.data.parent_id,
              encrypted_key_data: data.data.encrypted_key_data,
              encrypted_name_data: data.data.encrypted_name_data,
            };
          });

        const parent_folder_name = await fetch(
          `${config.BACKENDURL}/folders/${parent_id}/data`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        )
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) {
              throw new Error("Failed to fetch parent folder name: " + data.message);
            }
            return { encrypted_name_data: data.data.encrypted_name_data, encrypted_key_data: data.data.encrypted_key_data };
          });
        
        const enc_parent_folder_key_data = hexToBuffer(parent_folder_name.encrypted_key_data);
        const enc_parent_folder_key_nonce = enc_parent_folder_key_data.slice(0, 12);
        const enc_parent_folder_key_ciphertext = enc_parent_folder_key_data.slice(12);
        parent_folder_key = await decrypt(
          enc_parent_folder_key_ciphertext,
          user_ark as BufferSource,
          enc_parent_folder_key_nonce,
        );

        const enc_parent_folder_name_data = hexToBuffer(parent_folder_name.encrypted_name_data);
        const enc_parent_folder_name_nonce = enc_parent_folder_name_data.slice(0, 12);
        const enc_parent_folder_name_ciphertext = enc_parent_folder_name_data.slice(12);
        const parent_folder_name_dec = new TextDecoder().decode(await decrypt(
          enc_parent_folder_name_ciphertext,
          parent_folder_key as BufferSource,
          enc_parent_folder_name_nonce,
        ) as BufferSource);



        result = { parentId: parent_id, parentName: parent_folder_name_dec };
        break;
      }

      case "GET_FOLDERS_IN_FOLDER": {

        if (!current_folder_key) {
          throw new Error("Current folder key not initialized");
        }
        let folder_id: string = payload.folderId;

        if (folder_id == "") {
          folder_id = current_folder_id as string;
        }

        const res = await fetch(
          `${config.BACKENDURL}/folders/${folder_id}/folders`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );
        const data = await res.json();

        if (!data.success) {
          throw new Error("Failed to fetch folders in folder: " + data.message);
        }
        const folders = data.data.folders as EncryptedUserFolder[];

        result = { folders };
        break;
      }

      case "GET_FILES_IN_FOLDER": {

        if (!current_folder_key) {
          throw new Error("Current folder key not initialized");
        }
        let folder_id: string = payload.folderId;

        if (folder_id == "") {
          folder_id = current_folder_id as string;
        }

        const res = await fetch(
          `${config.BACKENDURL}/folders/${folder_id}/files`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );
        const data = await res.json();

        if (!data.success) {
          throw new Error("Failed to fetch files in folder: " + data.message);
        }
        const files_with_keys = data.data.files as EncryptedUserFile[];

        for (const file of files_with_keys) {
          sessionFileKeys.set(file.id, {
            encrypted_file_key: file.encrypted_key_data,
            temp_decrypted_file_key: null,
          });
        }

        const files = files_with_keys.map(file => ({ id: file.id, encrypted_name_data: file.encrypted_name_data })) as EncryptedUserFileNoKey[];

        result = { files };
        break;
      }

      case "GET_DECRYPTED_FILE_NAMES_AND_IDS": {

        if (!current_folder_key) {
          throw new Error("Current folder key not initialized");
        }

        let raw_file_data: EncryptedUserFileNoKey[] = payload.files;

        if (!raw_file_data || raw_file_data.length === 0) {
          result = { files: [] };
          break;
        }
        const files = await Promise.all(raw_file_data.map(async (file) => {
          const file_key_data_string = sessionFileKeys.get(file.id)?.encrypted_file_key;

          if (file_key_data_string == undefined) {
            throw new Error("File key data not found in session for file: " + file.id);
          }
          const file_key_data = hexToBuffer(file_key_data_string);
          const file_key_nonce = file_key_data.slice(0, 12);
          const file_key_ciphertext = file_key_data.slice(12);

          let file_key: Uint8Array;
          
          
          try {
            file_key = await decrypt(
              file_key_ciphertext,
              current_folder_key as BufferSource,
              file_key_nonce,
            );
          }
          catch (normal_error) {
            console.warn(`Decryption of file key for normal file ${file.id} failed.`, {
              normal_error,              });
            throw new Error("Failed to decrypt file key for file: " + file.id);
          }
          

          const enc_file_name_data = hexToBuffer(file.encrypted_name_data);
          const enc_file_name_nonce = enc_file_name_data.slice(0, 12);
          const enc_file_name_ciphertext = enc_file_name_data.slice(12);

          let file_name: string;
          try {
            file_name = new TextDecoder().decode(await decrypt(
              enc_file_name_ciphertext,
              expandKeyForName(file_key) as BufferSource,
              enc_file_name_nonce,
            ));

          } catch (error) {
            console.error("Error decrypting file name for file:", file.id, error);
            file_name = "Decryption failed";
          }

          return { id: file.id, name: file_name };
        }));

        result = { files };
        break;
      }

      case "GET_DECRYPTED_SHARED_FILE_NAMES_AND_IDS": {

        let raw_file_data: EncryptedUserFileNoKey[] = payload.files;

        if (!raw_file_data || raw_file_data.length === 0) {
          result = { files: [] };
          break;
        }
        const files = await Promise.all(raw_file_data.map(async (file) => {
          const file_key_data_string = sessionFileKeys.get(file.id)?.encrypted_file_key;

          if (file_key_data_string == undefined) {
            throw new Error("File key data not found in session for file: " + file.id);
          }
          const file_key_data = hexToBuffer(file_key_data_string);
          const file_key_nonce = file_key_data.slice(0, 12);
          const file_key_ciphertext = file_key_data.slice(12);

          let file_key: Uint8Array;
          
          const xwing_key = await getXwingKeyForFile(file.id);
          try {
            file_key = await decrypt(
              file_key_ciphertext,
              xwing_key as BufferSource,
              file_key_nonce,
            );
          }
            catch (xwing_error) {
              console.warn(`Decryption of file key for shared file ${file.id} with xwing key failed.`, {
                xwing_error,
              });
              throw new Error("Failed to decrypt file key for shared file: " + file.id);
            }
          

          const enc_file_name_data = hexToBuffer(file.encrypted_name_data);
          const enc_file_name_nonce = enc_file_name_data.slice(0, 12);
          const enc_file_name_ciphertext = enc_file_name_data.slice(12);

          let file_name: string;
          try {
            file_name = new TextDecoder().decode(await decrypt(
              enc_file_name_ciphertext,
              expandKeyForName(file_key) as BufferSource,
              enc_file_name_nonce,
            ));

          } catch (error) {
            console.error("Error decrypting file name for file:", file.id, error);
            file_name = "Decryption failed";
          }

          return { id: file.id, name: file_name };
        }));

        result = { files };
        break;
      } 
      
      case "GET_FOLDER_NAMES_AND_IDS": {

        if (!current_folder_key) {
          throw new Error("Current folder key not initialized");
        }

        let raw_folder_data: EncryptedUserFolder[] = payload.folders;

        if (!raw_folder_data || raw_folder_data.length === 0) {
          result = { folders: [] };
          break;
        }

        const folders = await Promise.all(raw_folder_data.map(async (folder) => {
          const enc_folder_name_data = hexToBuffer(folder.encrypted_name_data);
          const enc_folder_name_nonce = enc_folder_name_data.slice(0, 12);
          const enc_folder_name_ciphertext = enc_folder_name_data.slice(12);

          const enc_folder_key_data = hexToBuffer(folder.encrypted_key_data);
          const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
          const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

          const folder_key = await decrypt(
            enc_folder_key_ciphertext,
            user_ark as BufferSource,
            enc_folder_key_nonce,
          );

          const folder_name = new TextDecoder().decode(await decrypt(
            enc_folder_name_ciphertext,
            folder_key as BufferSource,
            enc_folder_name_nonce,
          ) as BufferSource);

          return { id: folder.id, name: folder_name };
        }));

        result = { folders };
        break;
      }

      case "GET_SHARED_FILES": {
        

        const files: EncryptedUserFileNoKey[] = await fetch(
          `${config.BACKENDURL}/files/shared`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        )
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) {
              throw new Error("Failed to fetch shared files: " + data.message);
            }

            const temp_files =  data.data.files;
            const files_to_return: EncryptedUserFileNoKey[] = [];
            for (const file of temp_files) {
              sessionFileKeys.set(file.id, {
                encrypted_file_key: file.encrypted_file_key,
                temp_decrypted_file_key: null,
              });
              files_to_return.push({ id: file.id, encrypted_name_data: file.encrypted_name_data });
            }

            return files_to_return;
          });

        result = { files };

        break;
      }

      case "CREATE_FOLDER": {

        if (!current_folder_key) {
          throw new Error("Current folder key not initialized");
        }

        const folder_name: string = payload.name;
        const parent_folder_id: string | null = current_folder_id;
        const new_folder_key = await generateMasterKey() as Uint8Array;

        const encrypted_folder_key_data = await encrypt(new_folder_key as BufferSource, user_ark as BufferSource);
        const encrypted_folder_name_data = await encrypt(folder_name, new_folder_key as BufferSource);

        const new_folder_id = await createFolderForUser(
          concatUint8(encrypted_folder_key_data.nonce, encrypted_folder_key_data.ciphertext),
          parent_folder_id,
          concatUint8(encrypted_folder_name_data.nonce, encrypted_folder_name_data.ciphertext)
        );

        result = { success: true, folderId: new_folder_id };
        break;
      }

      case "SHARE_FILE": {

        if (!user_mlkem_private || !user_x25519_private || !user_x25519_public || !user_mlkem_public) {
          throw new Error("User keys not initialized");
        }

        const file_id: string = payload.fileId;
        const recipient_username: string = payload.recipientUsername;
        const share_duration: number = payload.share_duration;

        const { recipient_x25519_public, recipient_mlkem_public } = await getUserHybridKeys(recipient_username);

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

        //const xwing_personal = await getXwingKeyForFile(file_id);


        await shareFileHybrid(
          file_id,
          recipient_username,
          encrypted_file_key,
          xwing_key,
          mlkem_ciphertext,
          x25519_ephemeral_public,
          share_duration,
          current_folder_key as Uint8Array,
        );

        result = { success: true };
        break;

      }

      case "GET_CURRENT_FOLDER_ID": {

        if (!current_folder_id) {
          throw new Error("Current folder data not initialized");
        }

        result = { folderId: current_folder_id };
        break;
      }

      case "LOGOUT_USER": {
        user_rsa_private = null;
        user_rsa_public = null;
        user_mlkem_public = null;
        user_mlkem_private = null;
        user_x25519_public = null;
        user_x25519_private = null;
        user_ark = null;
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