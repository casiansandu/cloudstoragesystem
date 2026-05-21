import config from "../../../config/config";
import { bufferToHex, hexToBuffer, encrypt, decrypt } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";

export async function shareFileHybrid(
    file_id: string, 
    recipient_username: string, 
    encrypted_file_key: string, 
    xwing_key: Uint8Array,
    mlkem_ciphertext: Uint8Array,
    x25519_ephemeral_public: Uint8Array,
    share_duration: number,
    current_folder_key: Uint8Array
) {
    
    const res = await fetch(`${config.BACKENDURL}/users/keys/${recipient_username}/public_key`, {
        method: "GET",
        credentials: "include"
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : null;

    console.log("Fetch public key response:", {message: data?.message, success: data?.success});

    if (!res.ok) {
        const message = data?.message ? String(data.message) : `HTTP ${res.status}`;
        throw new Error(`Failed to fetch public key for user ${recipient_username}: ${message}`);
    }

    if (!data?.success) {
        throw new Error(`Failed to fetch public key for user ${recipient_username}: ${data?.message || "unknown error"}`);
    }

    const file_key = await decrypt(
      hexToBuffer(encrypted_file_key).slice(12),
      current_folder_key as BufferSource,
      hexToBuffer(encrypted_file_key).slice(0, 12)
    );

    const encrypted_file_key_for_recipient = await encrypt(
        file_key as BufferSource,
        xwing_key as BufferSource,
    )

    const shareRes = await fetch(`${config.BACKENDURL}/files/share_hybrid`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            file_id,
            recipient_username,
            encrypted_file_key: bufferToHex(concatUint8(encrypted_file_key_for_recipient.nonce, encrypted_file_key_for_recipient.ciphertext) as BufferSource),
            share_duration,
            mlkem_ciphertext: bufferToHex(mlkem_ciphertext as BufferSource),
            x25519_ephemeral_public: bufferToHex(x25519_ephemeral_public as BufferSource),
        }),
        credentials: "include"
    });

    const shareData = await shareRes.json();

    console.log("Share file response:", {message: shareData.message, success: shareData.success});

    return shareData;

}