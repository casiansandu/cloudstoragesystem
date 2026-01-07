import { sha256 } from "js-sha256";
import {
  bufferToHex,
  decryptRSA,
  deriveChunkKey,
  encrypt,
  encryptRSA,
  generateMasterKey,
  hexToBuffer,
  type EncryptedResult,
} from "../../../utils/crypto";
import type { FileUploadResponse, ManifestData } from "../../utils/apiTypes";
import { concatUint8, gen_uuidv5 } from "../../utils/funcs";
import config from "../../../config/config";
import { v4 as uuidv4 } from "uuid";


async function getManifestKeyFromBackend(file_id: string): Promise<BufferSource> {
  const res = await fetch(`${config.BACKENDURL}/files/${file_id}/manifest_key`, {
    method: "GET",
    credentials: "include"
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to get manifest key: " + data.message);
  }
  return hexToBuffer(data.data.encrypted_manifest_key) as BufferSource;
}

export async function startUpload(enc_file_name_data: EncryptedResult, selectedFile: File, file_id: string, enc_file_key: string, public_key: CryptoKey) : Promise<string> {

  const manifest_key = await generateMasterKey();

  const wrapped_manifest_key = (await encryptRSA(
      manifest_key,
      public_key
  )) as BufferSource;

  await fetch(`${config.BACKENDURL}/files/upload/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          name: bufferToHex(concatUint8(
              new Uint8Array(enc_file_name_data.nonce),
              new Uint8Array(enc_file_name_data.ciphertext)
          ) as BufferSource),
          path: "/",
          file_size: selectedFile.size,
          encrypted_file_key: enc_file_key,
          encrypted_manifest_key: bufferToHex(wrapped_manifest_key)
      }),
      credentials: "include"
  }).then(res => res.json()).then((data: FileUploadResponse) => {

      file_id = data.data?.file_id?? "";
      //const access_id = data.data?.access_id?? "";

      if (!data.success) {
          throw new Error("Failed to start upload: " + data.message);
      }

      if (!data.data?.file_id) {
          throw new Error("No file ID returned from server" + data.message);
      }

      if (!data.data?.access_id) {
          throw new Error("No access ID returned from server" + data.message);
      }

      
  });
  return file_id;
}

async function uploadChunk(bytes: ArrayBuffer, file_id: string, chunk_id: string): Promise<number> {
  const res = await fetch(`${config.BACKENDURL}/files/upload/${file_id}/${chunk_id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream'
    },
    credentials: 'include',
    body: bytes
  });

  const data: FileUploadResponse = await res.json();

  if (!data.data?.stored_bytes) {
    throw new Error("No data returned from server for chunk " + chunk_id);
  }

  if (!data.success) {
    throw new Error(`Chunk upload failed for chunk ${chunk_id}: ${data.message}`);
  }

  return data.data.stored_bytes; 
}

export async function uploadManifest(file_id: string, manifest: ManifestData, public_key: CryptoKey, private_key: CryptoKey): Promise<{ manifest_uuid: string, wrapped_manifest_key: string }> {
  const manifest_name = sha256(file_id + "manifest");

  const encrypted_manifest_key = await getManifestKeyFromBackend(file_id);

  if (!encrypted_manifest_key) {
      throw new Error("No manifest key found for file: " + file_id);
  }

  if (!private_key) {
      throw new Error("User private key not initialized");
  }

  const manifest_key = await decryptRSA(
      encrypted_manifest_key,
      private_key
  ) as BufferSource;

  const enc_manifest = await encrypt(JSON.stringify(manifest), manifest_key);

  const wrapped_manifest_key = (await encryptRSA(
      manifest_key,
      public_key
  )) as BufferSource;

  const enc_manifest_nonce_and_ciphertext = concatUint8(
      enc_manifest.nonce,
      enc_manifest.ciphertext
  );

  const enc_manifest_buffer = enc_manifest_nonce_and_ciphertext.buffer.slice(
      enc_manifest_nonce_and_ciphertext.byteOffset,
      enc_manifest_nonce_and_ciphertext.byteOffset + enc_manifest_nonce_and_ciphertext.byteLength
  ) as ArrayBuffer;
  const manifest_uuid = gen_uuidv5(manifest_name);

  await uploadChunk(enc_manifest_buffer, file_id, manifest_uuid);
  return { manifest_uuid, wrapped_manifest_key : bufferToHex(wrapped_manifest_key) };
}

export async function handleChunkEncryption(
    file_key: BufferSource, 
    chunk_index: number, 
    file_id: string, 
    chunk_size: number, 
    selectedFile: File, 
    manifest: ManifestData, 
    chunk_number: number
){
    console.log(chunk_index + "/" + chunk_number);
    const chunk_id = uuidv4();

    const chunk_key = await deriveChunkKey(file_key, chunk_index, file_id);

    const chunk_start = chunk_index * chunk_size;
    const chunk_end = Math.min(chunk_start + chunk_size, selectedFile.size);

    const file_chunk = selectedFile.slice(chunk_start, chunk_end);
    const file_chunk_arraybuffer = await file_chunk.arrayBuffer();

    const enc_chunk = await encrypt(file_chunk_arraybuffer, chunk_key);

    const chunk_data_uint8 = concatUint8(
      enc_chunk.nonce, // 12 bytes
      enc_chunk.ciphertext
    );

    const chunk_data_buffer = chunk_data_uint8.buffer.slice(
      chunk_data_uint8.byteOffset,
      chunk_data_uint8.byteOffset + chunk_data_uint8.byteLength
    ) as ArrayBuffer;

    await uploadChunk(chunk_data_buffer, file_id, chunk_id);

    manifest.chunkInfos.push({
      index: chunk_index,
      id: chunk_id,
      ciphertextLength: enc_chunk.ciphertext.byteLength,
    });

}

