import {
  bufferToHex,
  decrypt,
  encrypt,
  generateAsymKeyPair,
  generateMasterKey,
  hexToBuffer,
} from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { expandKeyForName } from "./cryptoKeys";
import * as opaque from "@serenity-kit/opaque";
import { api } from "../../api/index";

export type UserStateUpdate = {
  user_mlkem_public: Uint8Array;
  user_mlkem_private: Uint8Array;
  user_x25519_public: Uint8Array;
  user_x25519_private: Uint8Array;
  current_folder_key: Uint8Array;
  current_folder_id: string;
  user_ark: Uint8Array;
  ed25519_private: Uint8Array;
};

const fetch_and_decrypt_user_ark = async (user_master_key: Uint8Array) => {
  const { encrypted_ark } = await api.users.getEncryptedArk();
  
  const fullArkBuffer = new Uint8Array(hexToBuffer(encrypted_ark));
  const enc_ark_nonce = fullArkBuffer.slice(0, 12);
  const enc_ark = fullArkBuffer.slice(12);

  const user_ark = await decrypt(
    enc_ark,
    user_master_key as BufferSource,
    enc_ark_nonce,
  );
  return user_ark;
}

export const initializeUserData = async (
  password: string,
): Promise<UserStateUpdate> => {
  
  const user_keys_info = await api.users.getKeys();

  const user_master_key = await scryptAsync(
    new TextEncoder().encode(password),
    hexToBuffer(user_keys_info.kdf_salt),
    { N: 16384, r: 8, p: 1, dkLen: 32 }
  );

  const user_ark = await fetch_and_decrypt_user_ark(user_master_key); 

  const { encrypted_seed } = await api.users.getEncryptedSeed();
  
  const fullSeedBuffer = new Uint8Array(hexToBuffer(encrypted_seed));
  const enc_seed_nonce = fullSeedBuffer.slice(0, 12);
  const enc_seed = fullSeedBuffer.slice(12);

  const decrypted_seed = await decrypt(
    enc_seed,
    user_master_key as BufferSource,
    enc_seed_nonce,
  );

  const ml_kem_keys = ml_kem768.keygen(decrypted_seed.slice(0, 64));

  const user_mlkem_private = ml_kem_keys.secretKey;
  const user_mlkem_public = ml_kem_keys.publicKey;

  const user_x25519_private = decrypted_seed.slice(64, 96);
  const user_x25519_public = x25519.getPublicKey(user_x25519_private);

  const ed25519_priv = decrypted_seed.slice(96, 128);

  const hasRootFolder = await api.folders.checkRootExists();

  let root_folder_key: Uint8Array;
  console.log("Root folder existence check:", hasRootFolder.id);

  if (hasRootFolder.exists) {
    const folderData = await api.folders.getData(hasRootFolder.id);
    
    const fullKeyData = new Uint8Array(hexToBuffer(folderData.encrypted_key_data));
    const root_folder_key_nonce = fullKeyData.slice(0, 12);
    const root_folder_key_ciphertext = fullKeyData.slice(12);

    root_folder_key = await decrypt(
      root_folder_key_ciphertext,
      user_ark as BufferSource,
      root_folder_key_nonce,
    );

    const { signature } = await api.folders.getSignature(hasRootFolder.id);

    const isValidSignature = ed25519.verify(
      hexToBuffer(signature),
      concatUint8(
        new TextEncoder().encode(""),
        hexToBuffer(folderData.encrypted_name_data),
        hexToBuffer(folderData.encrypted_key_data)
      ),
      ed25519.getPublicKey(ed25519_priv),
    );

    if (isValidSignature) {
      console.log("Valid signature for root folder data");
    } else {
      throw new Error("Invalid signature for root folder data");
    }

  } else {
    console.log("No root folder found for user, creating one...");
    root_folder_key = await generateMasterKey() as Uint8Array;
    const encrypted_name_data = await encrypt(new TextEncoder().encode("root"), expandKeyForName(root_folder_key) as BufferSource);
    const encrypted_root_folder_key = await encrypt(root_folder_key as BufferSource, user_ark as BufferSource);

    const signature = ed25519.sign(
      concatUint8(
        new TextEncoder().encode(""),
        concatUint8(encrypted_name_data.nonce, encrypted_name_data.ciphertext),
        concatUint8(encrypted_root_folder_key.nonce, encrypted_root_folder_key.ciphertext)
      ),
      ed25519_priv
    );

    await api.folders.create({
      parent_folder_id: "",
      encrypted_key_data_ark: bufferToHex(concatUint8(encrypted_root_folder_key.nonce, encrypted_root_folder_key.ciphertext) as BufferSource),
      encrypted_key_data_parent: "",
      encrypted_folder_name_data: bufferToHex(concatUint8(encrypted_name_data.nonce, encrypted_name_data.ciphertext) as BufferSource),
      signature: bufferToHex(signature as BufferSource),
    });
    console.log("Created root folder for user and signed its data.");
  }

  const current_folder_key = root_folder_key;

  const { root_folder_id: current_folder_id } = await api.folders.getRootId();
  console.log("Fetched root folder id:" + current_folder_id);

  return {
    user_mlkem_private,
    user_mlkem_public,
    user_x25519_private,
    user_x25519_public,
    current_folder_key,
    current_folder_id,
    user_ark,
    ed25519_private: ed25519_priv,
  };
};

export const performFullLogin = async (
  username: string,
  password: string,
): Promise<UserStateUpdate> => {
  
  const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password });

  const start_data = await api.auth.loginOpaqueStart({
    username,
    startLoginRequest,
  });

  const { loginResponse, loginSessionId } = start_data;

  const loginResult = opaque.client.finishLogin({
    clientLoginState,
    loginResponse,
    password,
  });

  if (!loginResult) throw new Error("Login failed locally: Invalid password or corrupted envelope.");

  const { finishLoginRequest } = loginResult;

  await api.auth.loginOpaqueVerify({
    finishLoginRequest,
    loginSessionId,
  });

  return initializeUserData(password);
};

export const registerUser = async (
  username: string,
  password: string,
  email: string,
) => {
  const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password });

  const initData = await api.auth.registerOpaqueInit({
    username,
    registrationRequest
  });

  const { registrationRecord } = opaque.client.finishRegistration({
    clientRegistrationState,
    registrationResponse: initData.registrationResponse,
    password,
  });

  // seed for both ML-KEM and X25519 key generation, and ARK, all encrypted with user master key derived from password
  const seed = crypto.getRandomValues(new Uint8Array(128));
  const ark = crypto.getRandomValues(new Uint8Array(32));

  // from seed get mlkem seed and x25519 private key
  const mlkem_seed = seed.slice(0, 64);
  const x25519_priv = seed.slice(64, 96);
  const ed25519_priv = seed.slice(96, 128);

  // derive public keys
  const { publicKey: mlkem_public } = ml_kem768.keygen(mlkem_seed);
  const x25519_public = x25519.getPublicKey(x25519_priv);
  const ed25519_public = ed25519.getPublicKey(ed25519_priv);

  // salt for scrypt KDF to encrypt seed, ARK, and user RSA private key
  const kdf_salt = crypto.getRandomValues(new Uint8Array(16));

  // scrypt to derive user master key from password and salt
  const user_master_key = await scryptAsync(
    new TextEncoder().encode(password),
    kdf_salt,
    { N: 16384, r: 8, p: 1, dkLen: 32 }
  );

  // encrypt seed and ARK with user master key
  const encrypted_seed = await encrypt(seed, user_master_key as BufferSource);
  const encrypted_ark = await encrypt(ark, user_master_key as BufferSource);

  await api.auth.registerOpaqueFinish({
    username,
    email,
    registrationRecord,
    kdf_salt: bufferToHex(kdf_salt),
    public_keys_bundle: bufferToHex(concatUint8(mlkem_public, x25519_public, ed25519_public) as BufferSource),
    encrypted_seed: bufferToHex(concatUint8(encrypted_seed.nonce, encrypted_seed.ciphertext) as BufferSource),
    encrypted_ark: bufferToHex(concatUint8(encrypted_ark.nonce, encrypted_ark.ciphertext) as BufferSource),
  });
};