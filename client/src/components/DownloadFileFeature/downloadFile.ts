import { sha256 } from "js-sha256";
import type { ManifestData } from "../../utils/apiTypes";
import config from "../../../config/config";
import { gen_uuidv5 } from "../../utils/funcs";
import { decrypt, decryptRSA, deriveChunkKey, hexToBuffer } from "../../../utils/crypto";
import streamSaver from "streamSaver";
import { getManifestKey } from "../UploadFileFeature/uploadFile";

const fetchChunk = async (file_id: string, chunk_id: string) => {

  const res = await fetch(`${config.BACKENDURL}/files/download/${file_id}/${chunk_id}`, {
    method: "GET",
    credentials: "include"
  });

  return (await res.arrayBuffer());
}

export const getManifestData = async (file_id: string): Promise<ManifestData> => {

  const manifest_name = sha256(file_id + "manifest");
  
  const manifest_data = await fetchChunk(file_id, gen_uuidv5(manifest_name));

  const wrapped_key = await getManifestKey(file_id);

  const enc_manifest_nonce = manifest_data.slice(0, 12);
  const enc_manifest_ciphertext = manifest_data.slice(12);

  const manifest_key = await decryptRSA(
    wrapped_key,
    hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
  );

  const manifest = (await decrypt(
    enc_manifest_ciphertext,
    manifest_key as BufferSource,
    enc_manifest_nonce
  ));

  const manifest_json: ManifestData = JSON.parse(new TextDecoder().decode(manifest));

  return manifest_json;
}

export const verifyOwnership = async (file_id: string) => {
  console.log("Verifying ownership for file:", file_id);

    const res = await fetch(`${config.BACKENDURL}/files/isowner/${file_id}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error("Ownership verification failed: " + data.message);
    }
    console.log("Ownership verified for file:", file_id, data.data);
}

export const hasAccess = async (file_id: string) => {
  console.log("Checking access for file:", file_id);
    const res = await fetch(`${config.BACKENDURL}/files/hasaccess/${file_id}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await res.json();
    
    if (!data.success) {
      throw new Error("Access check failed: " + data.message);
    }
    console.log("Access check for file:", file_id, data);
}

async function getFileKey(file_id: string): Promise<string> {
  await hasAccess(file_id);
  const res = await fetch(`${config.BACKENDURL}/files/${file_id}/key`, {
    method: "GET",
    credentials: "include"
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to get file key: " + data.message);
  }
  return data.data.encrypted_master_key;
}

export const downloadFile = async (file_id: string, file_name: string) => {
  console.log("Download initiated for file:", file_id);

  const manifest_json = await getManifestData(file_id);
  console.log("Manifest data retrieved for file:", file_id, manifest_json);

  const encrypted_file_key = await getFileKey(file_id);

  const file_key = await decryptRSA(
    hexToBuffer(encrypted_file_key) as BufferSource,
    hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
  );

  const fileStream = streamSaver.createWriteStream(file_name, {
    size:manifest_json.file_size
  });
  const writer = fileStream.getWriter();

  for (let chunkInfo of manifest_json.chunkInfos) {

    const chunk_data = await fetchChunk(file_id, chunkInfo.id);

    const chunk_key = await deriveChunkKey(
      file_key as BufferSource,
      chunkInfo.index,
      manifest_json.file_id
    );

    const chunk_nonce = chunk_data.slice(0, 12);
    const chunk_ciphertext = chunk_data.slice(12);

    const decrypted_chunk = await decrypt(
      chunk_ciphertext,
      chunk_key,
      chunk_nonce
    );

    await writer.write(decrypted_chunk);
    
  }
  await writer.close();
  console.log("[Download] Download complete successfully.");

}

