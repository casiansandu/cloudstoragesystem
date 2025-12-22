import { sha256 } from "js-sha256";
import {
  bufferToHex,
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

async function startUpload(enc_file_name_data: EncryptedResult, selectedFile: File, file_id: string) : Promise<string> {
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
        }),
        credentials: "include"
    }).then(res => res.json()).then((data: FileUploadResponse) => {

        if (!data.success) {
            throw new Error("Failed to start upload: " + data.message);
        }

        if (!data.data?.file_id) {
            throw new Error("Received bad data: " + data.message);
        }

        file_id = data.data.file_id;
        console.log("Upload started: for file ", file_id);
        
    });
    return file_id;
}

async function uploadChunk(bytes: ArrayBuffer, chunkId: string): Promise<number> {
  const res = await fetch(`${config.BACKENDURL}/files/upload/chunk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Chunk-Id': chunkId,
    },
    credentials: 'include',
    body: bytes
  });

  const data: FileUploadResponse = await res.json();

  if (!data.data?.stored_bytes) {
    throw new Error("No data returned from server for chunk " + chunkId);
  }

  if (!data.success) {
    throw new Error(`Chunk upload failed for chunk ${chunkId}: ${data.message}`);
  }

  console.log(`data received for chunk ${chunkId}: `, data.data);

  return data.data.stored_bytes; 
}

async function uploadManifest(file_id: string, manifest: ManifestData, public_key: string): Promise<string> {
        const manifest_name = sha256(file_id + "manifest");

        const manifest_key = await generateMasterKey();
        const enc_manifest = await encrypt(JSON.stringify(manifest), manifest_key);

        const wrapped_manifest_key = (await encryptRSA(
            manifest_key,
            hexToBuffer(public_key) as BufferSource
        )) as BufferSource;

        const enc_manifest_nonce_and_ciphertext = concatUint8(
            enc_manifest.nonce,
            enc_manifest.ciphertext
        );

        const enc_manifest_blob = concatUint8(
            wrapped_manifest_key as Uint8Array, // 256 bytes
            enc_manifest_nonce_and_ciphertext // 12 + manifest bytes
        );

        const enc_manifest_buffer = enc_manifest_blob.buffer.slice(
            enc_manifest_blob.byteOffset,
            enc_manifest_blob.byteOffset + enc_manifest_blob.byteLength
        ) as ArrayBuffer;
        const manifest_uuid = gen_uuidv5(manifest_name);

        await uploadChunk(enc_manifest_buffer, manifest_uuid);
        return manifest_uuid;
}

async function handleChunkEncryption(
    file_key: BufferSource, 
    chunk_index: number, 
    file_id: string, 
    chunk_size: number, 
    selectedFile: File, 
    manifest: ManifestData, 
    chunk_number: number
){
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

    const bytes_stored = await uploadChunk(chunk_data_buffer, chunk_id);

    console.log(
      `Uploaded chunk ${
        chunk_index + 1
      }/${chunk_number}, bytes stored: ${bytes_stored}`
    );

    manifest.chunkInfos.push({
      index: chunk_index,
      id: chunk_id,
      ciphertextLength: enc_chunk.ciphertext.byteLength,
    });

}

export default async function uploadFile(selectedFile: File) {
  let file_id = "";

  const directory_key = sessionStorage.getItem("decrypted_directory_key");
  if (!directory_key) {
    throw new Error("No directory key found in session storage");
  }

  const public_key = sessionStorage.getItem("encryption_public_key");
  if (!public_key) {
    throw new Error("No public key found in session storage");
  }

  const enc_file_name_data = await encrypt(
    selectedFile.name,
    hexToBuffer(directory_key) as BufferSource
  );

  file_id = await startUpload(enc_file_name_data, selectedFile, file_id);

  const chunk_size = 5 * 1024 * 1024; // 5 MB
  const chunk_number = Math.ceil(selectedFile.size / chunk_size);

  const file_key = await generateMasterKey();
  const enc_file_key = bufferToHex(
    (await encryptRSA(
      file_key,
      hexToBuffer(public_key) as BufferSource
    )) as BufferSource
  );

  const manifest: ManifestData = {
    file_id: file_id,
    totalChunks: chunk_number,
    uploadedAt: new Date().toISOString(),
    encryptedFileKey: enc_file_key,
    chunkInfos: [],
  };

  let chunk_index = 0;

  while (chunk_index < chunk_number) {
    
    await handleChunkEncryption(
      file_key as BufferSource,
      chunk_index,
      file_id,
      chunk_size,
      selectedFile,
      manifest,
      chunk_number
    );

    chunk_index += 1;
  }

  const manifest_uuid = await uploadManifest(file_id, manifest, public_key);

  console.log("manifest uploaded: ", manifest_uuid)
    
}
