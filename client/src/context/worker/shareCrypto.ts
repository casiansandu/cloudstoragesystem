import { hexToBuffer } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { x25519, ed25519 } from "@noble/curves/ed25519.js";
import { api } from "../../api/index";
import { sha3_256 } from "@noble/hashes/sha3.js";

export const getUserPublicKeys = async (
  recipient_id: string,
): Promise<{ recipient_mlkem_public: Uint8Array; recipient_x25519_public: Uint8Array, ed25519_public: Uint8Array }> => {

  const { public_keys_bundle } = await api.users.getPublicKeyBundle(recipient_id);

  return {
    recipient_mlkem_public: hexToBuffer(public_keys_bundle).slice(0, 1184),
    recipient_x25519_public: hexToBuffer(public_keys_bundle).slice(1184, 1184 + 32),
    ed25519_public: hexToBuffer(public_keys_bundle).slice(1184 + 32, 1184 + 32 + 32),
  };
};

export const getXwingKeyForFileAndVerifySig = async (
  file_id: string,
  user_mlkem_private: Uint8Array | null,
  user_x25519_private: Uint8Array | null,
  user_x25519_public: Uint8Array | null,
  encrypted_file_key: Uint8Array,
  ed25519_private: Uint8Array | null,
) => {
  if (!user_mlkem_private || !user_x25519_private || !user_x25519_public || !ed25519_private || !encrypted_file_key) {
    throw new Error("User keys not initialized");
  }

    const { mlkem_ciphertext, x25519_ephemeral_public } = await api.files.getHybridInfo(file_id);

    const { signature } = await api.files.getSignature(file_id);

    const { sharing_user_id } = await api.files.getSharingUserId(file_id);

    const { ed25519_public } = await getUserPublicKeys(sharing_user_id);

    const isValidSignature = ed25519.verify(
      hexToBuffer(signature),
      concatUint8(
        hexToBuffer(x25519_ephemeral_public),
        hexToBuffer(mlkem_ciphertext),
        encrypted_file_key
      ),
      ed25519_public,
    );

    if (isValidSignature) {
      console.log("Valid signature for hybrid key data");
    } else {
      throw new Error("Invalid signature for hybrid key data");
    }

  const mlkem_shared_secret = ml_kem768.decapsulate(
    hexToBuffer(mlkem_ciphertext),
    user_mlkem_private,
  );
  const x25519_shared_secret = x25519.getSharedSecret(
    user_x25519_private,
    hexToBuffer(x25519_ephemeral_public),
  );

  const xwing_key = sha3_256(concatUint8(
    new TextEncoder().encode("\\.//^\\"),
    mlkem_shared_secret,
    x25519_shared_secret,
    hexToBuffer(x25519_ephemeral_public),
    user_x25519_public,
  ));

  return xwing_key;
};

export const getXwingKeyForFolder = async (
  folder_id: string,
  user_mlkem_private: Uint8Array | null,
  user_x25519_private: Uint8Array | null,
  user_x25519_public: Uint8Array | null,
) => {
  if (!user_mlkem_private || !user_x25519_private || !user_x25519_public) {
    throw new Error("User keys not initialized");
  }

  const { mlkem_ciphertext, x25519_ephemeral_public } = await api.folders.getHybridInfo(folder_id);

  const mlkem_shared_secret = ml_kem768.decapsulate(
    hexToBuffer(mlkem_ciphertext),
    user_mlkem_private,
  );
  const x25519_shared_secret = x25519.getSharedSecret(
    user_x25519_private,
    hexToBuffer(x25519_ephemeral_public),
  );

  const xwing_key = sha3_256(concatUint8(
    new TextEncoder().encode("\\.//^\\"),
    mlkem_shared_secret,
    x25519_shared_secret,
    hexToBuffer(x25519_ephemeral_public),
    user_x25519_public,
  ));

  return xwing_key;
};

export const generateHybridSharedKey = async (
  recipient_mlkem_public: Uint8Array,
  recipient_x25519_public: Uint8Array,
) => {
  const mlkem_encapsulation_result = ml_kem768.encapsulate(
    recipient_mlkem_public,
  );

  const x25519_ephemeral = x25519.keygen();
  const x25519_shared_secret = x25519.getSharedSecret(
    x25519_ephemeral.secretKey,
    recipient_x25519_public,
  );

  const xwing_key = sha3_256(concatUint8(
    new TextEncoder().encode("\\.//^\\"),
    mlkem_encapsulation_result.sharedSecret,
    x25519_shared_secret,
    x25519_ephemeral.publicKey,
    recipient_x25519_public,
  ));

  return {
    xwing_key,
    x25519_ephemeral_public: x25519_ephemeral.publicKey,
    mlkem_ciphertext: mlkem_encapsulation_result.cipherText,
  };
};
