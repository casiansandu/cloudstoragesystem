import config from "../../../config/config";
import { hexToBuffer } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { sha3_256 } from "@noble/hashes/sha3.js";

export const getUserHybridKeys = async (
  recipient_username: string,
): Promise<{ recipient_mlkem_public: Uint8Array; recipient_x25519_public: Uint8Array }> => {
  const { recipient_mlkem_public, recipient_x25519_public } = await fetch(`${config.BACKENDURL}/users/keys/${recipient_username}/public_keys_bundle`,
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
};

export const getXwingKeyForFile = async (
  file_id: string,
  user_mlkem_private: Uint8Array | null,
  user_x25519_private: Uint8Array | null,
  user_x25519_public: Uint8Array | null,
) => {
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
