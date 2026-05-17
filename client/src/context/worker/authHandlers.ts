import config from "../../../config/config";
import srp from "secure-remote-password/client";
import type {
  GetUserKeysResponse,
  SrpLoginStartResponse,
  SrpLoginVerifyResponse,
} from "../../utils/apiTypes";
import {
  decrypt,
  encrypt,
  generateAsymKeyPair,
  generateMasterKey,
  hexToBuffer,
} from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import post_register from "../../Register/registerUser";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { createFolderForUser, getRootFolderId } from "./folderHandlers";

export type UserStateUpdate = {
  user_rsa_private: CryptoKey;
  user_rsa_public: CryptoKey;
  user_mlkem_public: Uint8Array;
  user_mlkem_private: Uint8Array;
  user_x25519_public: Uint8Array;
  user_x25519_private: Uint8Array;
  current_folder_key: Uint8Array;
  current_folder_id: string;
  user_ark: Uint8Array;
};

export const initializeUserData = async (
  username: string,
  password: string,
): Promise<UserStateUpdate> => {
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

  const user_rsa_private = await crypto.subtle.importKey(
    "pkcs8",
    decryptedPrivateKey as BufferSource,
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-256" },
    },
    false,
    ["decrypt"],
  );

  const user_rsa_public = await crypto.subtle.importKey(
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

  const user_ark = await decrypt(
    enc_ark,
    user_master_key as BufferSource,
    enc_ark_nonce,
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

  const decrypted_seed = await decrypt(
    enc_seed,
    user_master_key as BufferSource,
    enc_seed_nonce,
  );
  console.log("Decrypted user seed");

  const ml_kem_keys = ml_kem768.keygen(decrypted_seed.slice(0, 64));

  const user_mlkem_private = ml_kem_keys.secretKey;
  const user_mlkem_public = ml_kem_keys.publicKey;

  const user_x25519_private = decrypted_seed.slice(64);
  const user_x25519_public = x25519.getPublicKey(user_x25519_private);

  console.log("MKLEM and X25519 user keys initialized in worker.");

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
    )
      .then((res) => res.json())
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
    const encrypted_name_data = await encrypt(new TextEncoder().encode("root"), root_folder_key as BufferSource);
    const encrypted_root_folder_key = await encrypt(root_folder_key as BufferSource, user_ark as BufferSource);
    await createFolderForUser(
      concatUint8(encrypted_root_folder_key.nonce, encrypted_root_folder_key.ciphertext),
      null,
      concatUint8(encrypted_name_data.nonce, encrypted_name_data.ciphertext)
    );
    console.log("Created root folder for user");
  }

  const current_folder_key = root_folder_key;
  console.log("Derived and assigned root folder key for user.");

  const current_folder_id = await getRootFolderId();
  console.log("Fetched root folder id:" + current_folder_id);

  return {
    user_rsa_private,
    user_rsa_public,
    user_mlkem_private,
    user_mlkem_public,
    user_x25519_private,
    user_x25519_public,
    current_folder_key,
    current_folder_id,
    user_ark,
  };
};

export const performFullLogin = async (
  username: string,
  password: string,
): Promise<UserStateUpdate> => {
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

  return initializeUserData(username, password);
};

export const registerUser = async (
  username: string,
  password: string,
  email: string,
) => {
  const salt = srp.generateSalt();
  const _privateKey = srp.derivePrivateKey(salt, username, password);
  const verifier = srp.deriveVerifier(_privateKey);

  const { publicKey, privateKey } = await generateAsymKeyPair();
  console.log("Generated key pair for user");

  const seed = crypto.getRandomValues(new Uint8Array(96));
  const ark = crypto.getRandomValues(new Uint8Array(32));

  const mlkem_seed = seed.slice(0, 64);
  const x25519_priv = seed.slice(64);

  const { publicKey: mlkem_public } =
    ml_kem768.keygen(mlkem_seed);
  const x25519_public = x25519.getPublicKey(x25519_priv);

  const kdf_salt = crypto.getRandomValues(new Uint8Array(16));

  const user_master_key = await scryptAsync(
    new TextEncoder().encode(password),
    kdf_salt,
    { N: 16384, r: 8, p: 1, dkLen: 32 }
  );

  const encrypted_seed = await encrypt(seed, user_master_key as BufferSource);
  const encrypted_ark = await encrypt(ark, user_master_key as BufferSource);
  const encryptedPrivateKey = await encrypt(privateKey, user_master_key as BufferSource);

  const root_folder_key = hkdf(
    sha3_256,
    seed,
    undefined,
    hexToBuffer("root-folder-key-v1"),
    32
  );

  await encrypt(root_folder_key as BufferSource, user_master_key as BufferSource);

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
    concatUint8(mlkem_public, x25519_public),
    concatUint8(encrypted_seed.nonce, encrypted_seed.ciphertext),
    concatUint8(encrypted_ark.nonce, encrypted_ark.ciphertext),
  );

};
