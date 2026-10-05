import type { ManifestData } from "../../utils/apiTypes";
import { bufferToHex, encrypt, generateMasterKey, hexToBuffer } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import { expandKeyForData, expandKeyForManifest, expandKeyForName } from "./cryptoKeys";
import {
  startHybridUpload,
  handleChunkEncryption,
  uploadChunk,
  encryptManifest,
} from "../../components/UploadFileFeature/uploadFile";
import { api } from "../../api";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";

type SessionFileKeyEntry = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const AEAD_OVERHEAD = 28; // 12 byte nonce + 16 byte tag
const UPLOAD_CONCURRENCY_LIMIT = 4;

const calculateManifestSize = (
  fileSize: number,
  chunkSize: number,
  aeadOverhead: number,
  encFileKeyHex: string
): number => {
  const totalChunks = Math.ceil(fileSize / chunkSize);

  const baseJsonStr = `{"file_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479","totalChunks":${totalChunks},"uploadedAt":"2026-06-08T12:00:00.000Z","encryptedFileKey":"${encFileKeyHex}","file_size":${fileSize},"chunkInfos":[]}`;
  const baseByteLength = new TextEncoder().encode(baseJsonStr).length;

  const maxIndexDigits = totalChunks.toString().length;
  const chunkHashPlaceholder = "0".repeat(64);
  const maxCiphertextLen = chunkSize + aeadOverhead;
  
  const dummyChunkStr = `{"index":${"9".repeat(maxIndexDigits)},"id":"f47ac10b-58cc-4372-a567-0e02b2c3d479","ciphertextLength":${maxCiphertextLen},"chunk_hash":"${chunkHashPlaceholder}"},`;
  const singleChunkByteLength = new TextEncoder().encode(dummyChunkStr).length;

  const plainTextByteLength = baseByteLength + (totalChunks * singleChunkByteLength);

  return plainTextByteLength + aeadOverhead + 64; 
};


export const uploadFile = async (
  selectedFile: File,
  currentFolderId: string,
  currentFolderKey: Uint8Array,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  ed25519_private: Uint8Array,
): Promise<string> => {
  let file_id = "";
  
  let startTime = performance.now();

  try { 

    const share_duration: number = 0;

    if (selectedFile.size === 0) {
      throw new Error("Cannot upload empty file.");
    } else if (selectedFile.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds the 10 GB limit.");
    }

    const file_size_bytes = selectedFile.size;
    const chunk_number = Math.ceil(file_size_bytes / CHUNK_SIZE);

    const _file_key = await generateMasterKey() as Uint8Array;
    const fileNameKey = expandKeyForName(_file_key);
    const fileDataKey = expandKeyForData(_file_key);
    const fileManifestKey = expandKeyForManifest(_file_key);

    const { nonce: enc_file_key_nonce, ciphertext: enc_file_key_ciphertext } =
      await encrypt(_file_key as BufferSource, currentFolderKey as BufferSource);

    const enc_file_key_data = bufferToHex(
      concatUint8(enc_file_key_nonce, enc_file_key_ciphertext) as BufferSource,
    );

    const totalChunkOverhead = chunk_number * AEAD_OVERHEAD;
    const encryptedChunksTotalSize = selectedFile.size + totalChunkOverhead;
    const manifest_size = calculateManifestSize(file_size_bytes, CHUNK_SIZE, AEAD_OVERHEAD, enc_file_key_data);

    if (manifest_size > CHUNK_SIZE) {
      throw new Error("Exceeds size limit, cannot upload file.");
    }

    const enc_file_name_data = await encrypt(selectedFile.name, fileNameKey as BufferSource);

    file_id = await startHybridUpload(
      enc_file_name_data,
      (encryptedChunksTotalSize + manifest_size),
      file_id,
      enc_file_key_data,
      share_duration,
      currentFolderId,
    );

    const manifest: ManifestData = {
      file_id: file_id,
      totalChunks: chunk_number,
      uploadedAt: new Date().toISOString(),
      encryptedFileKey: enc_file_key_data,
      file_size: file_size_bytes,
      chunkInfos: new Array(chunk_number),
    };

    const activeUploads = new Set<Promise<void>>();

    for (let chunk_index = 0; chunk_index < chunk_number; chunk_index++) {
      
      const uploadTask = (async () => {
        const { chunk_data_buffer, chunk_id } = await handleChunkEncryption(
          fileDataKey as BufferSource,
          chunk_index,
          file_id,
          CHUNK_SIZE,
          selectedFile,
        );

        await uploadChunk(chunk_data_buffer, file_id, chunk_id);

        manifest.chunkInfos[chunk_index] = {
          index: chunk_index,
          id: chunk_id,
          ciphertextLength: chunk_data_buffer.byteLength,
          chunk_hash: bufferToHex(sha256(new Uint8Array(chunk_data_buffer)) as BufferSource),
        };
      })();

      activeUploads.add(uploadTask);
      
      uploadTask.finally(() => activeUploads.delete(uploadTask));

      if (activeUploads.size >= UPLOAD_CONCURRENCY_LIMIT) {
        await Promise.race(activeUploads);
      }
    }

    await Promise.all(activeUploads);

    const { encrypted_manifest_buffer, manifest_uuid } = await encryptManifest(
      file_id,
      manifest,
      fileManifestKey
    );

    const signedManifest = ed25519.sign(new Uint8Array(encrypted_manifest_buffer), ed25519_private);
    await uploadChunk((concatUint8(encrypted_manifest_buffer, signedManifest).buffer) as ArrayBuffer, file_id, manifest_uuid);

    sessionFileKeys.set(file_id, {
      encrypted_file_key: enc_file_key_data,
      temp_decrypted_file_key: null,
    });

    let endTime = performance.now();
    console.log(`Total upload time for file: ${((endTime - startTime)/1000).toFixed(2)} s for file size ${(file_size_bytes / (1024 * 1024)).toFixed(2)} MB\
    (MB/S = ${(file_size_bytes / (endTime - startTime) * 1000 / (1024 * 1024)).toFixed(2)}),\
    ms/chunk = ${((endTime - startTime) / chunk_number).toFixed(2)} ms`);
    
  } catch (error) {
    console.error("Upload failed mid-way. Initiating cleanup.", error);
    
    if (file_id) {
      try {
        await api.files.delete(file_id);
        console.log(`Successfully cleaned up orphaned file: ${file_id}`);
      } catch (cleanupError) {
        console.error("Failed to clean up orphaned file on the server:", cleanupError);
      }
    }
    throw error; 
  }


  return file_id;
};