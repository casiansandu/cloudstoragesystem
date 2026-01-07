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
  publicKey: Uint8Array
) => {
  console.log("Registering user:", { username, email });

  fetch(`${config.BACKENDURL}/auth/register`, {
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
      encryption_salt: bufferToHex(encryptionSalt as BufferSource),
      encryption_public_key: bufferToHex(publicKey as BufferSource),
      encrypted_private_key: bufferToHex(encryptedPrivateKey as BufferSource),
    }),
  })
    .then((res) => res.json() as Promise<SrpRegisterResponse>)
    .then((data) => {
      if (!data.success) {
        throw new Error("Registration failed: " + data.message);
      }
    })
    .catch((err) => console.error(err));
};

export default post_register;
