import config from "../../../config/config";
import { bufferToHex, decryptRSA, encryptRSA, hexToBuffer } from "../../../utils/crypto";
import { getManifestData } from "../DownloadFileFeature/downloadFile";
import { getManifestKey } from "../UploadFileFeature/uploadFile";

async function shareFile(file_id: string, recipient_username: string) {
    
    const manifest_data = await getManifestData(file_id);
    const encrypted_manifest_key = await getManifestKey(file_id);

    const manifest_key = await decryptRSA(
        encrypted_manifest_key,
        hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
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
      hexToBuffer(manifest_data.encryptedFileKey) as BufferSource,
      hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
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
            encrypted_manifest_key: bufferToHex(encrypted_manifest_key_for_recipient as BufferSource)
        }),
        credentials: "include"
    });

    const shareData = await shareRes.json();

    console.log("Share file response:", shareData);

}

export default shareFile;