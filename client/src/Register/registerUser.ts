import config from "../../config/config";
import { bufferToHex } from "../../utils/crypto";
import type { SrpRegisterResponse } from "../utils/apiTypes";

const post_register = async (
  username: string,
  email: string,
  srp_salt: string,
  srp_verifier: string,
  encryptionSalt: Uint8Array,
  encryptedPrivateKey: Uint8Array,
  publicKey: Uint8Array,
  public_keys_bundle: Uint8Array,
  encrypted_seed: Uint8Array
) => {
  console.log("Registering user:", { username, email });

  const res = await fetch(`${config.BACKENDURL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      username,
      email,
      srp_salt: srp_salt.toString(),
      srp_verifier: srp_verifier.toString(),
      kdf_salt: bufferToHex(encryptionSalt as BufferSource),
      user_rsa_public: bufferToHex(publicKey as BufferSource),
      encrypted_user_rsa_private: bufferToHex(encryptedPrivateKey as BufferSource),
      public_keys_bundle: bufferToHex(public_keys_bundle as BufferSource),
      encrypted_seed: bufferToHex(encrypted_seed as BufferSource),
    }),
  });

  const data: SrpRegisterResponse = await res.json();

  if (!data.success) {
    throw new Error(`Registration failed: ${data.message}`);
  }
};

export default post_register;
