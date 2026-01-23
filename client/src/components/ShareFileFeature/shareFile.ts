import config from "../../../config/config";
import { bufferToHex, encryptRSA, hexToBuffer, decryptRSA, encrypt, decrypt } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";

export async function shareFile(
    file_id: string, 
    recipient_username: string, 
    encrypted_file_key: string, 
    encrypted_manifest_key: string, 
    userPrivateKey: CryptoKey,
    share_duration: number
) {
    
    const manifest_key = await decryptRSA(
        hexToBuffer(encrypted_manifest_key) as BufferSource,
        userPrivateKey
    );

    const res = await fetch(`${config.BACKENDURL}/users/keys/${recipient_username}/public_key`, {
        method: "GET",
        credentials: "include"
    });

    const data = await res.json();

    console.log("Fetch public key response:", data);

    if (!data.success) {
        throw new Error(`Failed to fetch public key for user ${recipient_username}: ${data.message}`);
    }

    const recipient_public_key = data.data.encryption_public_key;

    const encrypted_manifest_key_for_recipient = await encryptRSA(
        manifest_key as BufferSource,
        hexToBuffer(recipient_public_key) as BufferSource
    );

    const file_key = await decryptRSA(
      hexToBuffer(encrypted_file_key) as BufferSource,
      userPrivateKey
    );

    const encrypted_file_key_for_recipient = await encryptRSA(
        file_key as BufferSource,
        hexToBuffer(recipient_public_key) as BufferSource
    );

    const shareRes = await fetch(`${config.BACKENDURL}/files/share`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            file_id,
            recipient_username,
            encrypted_file_key: bufferToHex(encrypted_file_key_for_recipient as BufferSource),
            encrypted_manifest_key: bufferToHex(encrypted_manifest_key_for_recipient as BufferSource),
            share_duration
        }),
        credentials: "include"
    });

    const shareData = await shareRes.json();

    console.log("Share file response:", shareData);

}


export async function shareFileHybrid(
    file_id: string, 
    recipient_username: string, 
    encrypted_file_key: string, 
    encrypted_manifest_key: string, 
    xwing_key: Uint8Array,
    mlkem_ciphertext: Uint8Array,
    x25519_ephemeral_public: Uint8Array,
    userPrivateKey: CryptoKey,
    share_duration: number,
    xwing_personal: Uint8Array
) {
    
    const manifest_key = await decryptRSA(
        hexToBuffer(encrypted_manifest_key) as BufferSource,
        userPrivateKey
    );

    const res = await fetch(`${config.BACKENDURL}/users/keys/${recipient_username}/public_key`, {
        method: "GET",
        credentials: "include"
    });

    const data = await res.json();

    console.log("Fetch public key response:", data);

    if (!data.success) {
        throw new Error(`Failed to fetch public key for user ${recipient_username}: ${data.message}`);
    }

    const recipient_public_key = data.data.encryption_public_key;

    const encrypted_manifest_key_for_recipient = await encryptRSA(
        manifest_key as BufferSource,
        hexToBuffer(recipient_public_key) as BufferSource
    );

    const file_key = await decrypt(
      hexToBuffer(encrypted_file_key).slice(12),
      xwing_personal as BufferSource,
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
            encrypted_manifest_key: bufferToHex(encrypted_manifest_key_for_recipient as BufferSource),
            share_duration,
            mlkem_ciphertext: bufferToHex(mlkem_ciphertext as BufferSource),
            x25519_ephemeral_public: bufferToHex(x25519_ephemeral_public as BufferSource),
        }),
        credentials: "include"
    });

    const shareData = await shareRes.json();

    console.log("Share file response:", shareData);

}