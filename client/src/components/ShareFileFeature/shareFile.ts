import config from "../../../config/config";
import { bufferToHex, encryptRSA, hexToBuffer, decryptRSA, encrypt, decrypt } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import { api } from "../../api/index";
import { ed25519 } from "@noble/curves/ed25519.js";

export async function shareFileHybrid(
    file_id: string, 
    recipient_username: string, 
    encrypted_file_key: string, 
    xwing_key: Uint8Array,
    mlkem_ciphertext: Uint8Array,
    x25519_ephemeral_public: Uint8Array,
    share_duration: number,
    current_folder_key: Uint8Array,
    ed25519_private: Uint8Array
) {
    const file_key = await decrypt(
      hexToBuffer(encrypted_file_key).slice(12),
      current_folder_key as BufferSource,
      hexToBuffer(encrypted_file_key).slice(0, 12)
    );

    const encrypted_file_key_for_recipient = await encrypt(
        file_key as BufferSource,
        xwing_key as BufferSource,
    )

    const key = concatUint8(encrypted_file_key_for_recipient.nonce, encrypted_file_key_for_recipient.ciphertext);

    const signature = ed25519.sign(
        concatUint8(
            x25519_ephemeral_public,
            mlkem_ciphertext,
            key
        ),
        ed25519_private
    );

    const share_res = await api.files.shareHybrid({
        file_id,
        recipient_username,
        encrypted_file_key: bufferToHex(key as BufferSource),
        share_duration,
        mlkem_ciphertext: bufferToHex(mlkem_ciphertext as BufferSource),
        x25519_ephemeral_public: bufferToHex(x25519_ephemeral_public as BufferSource),
        signature: bufferToHex(signature as BufferSource),
    });

    console.log("Share file response:", { message: share_res.file_access_id });

    return share_res.file_access_id;
}