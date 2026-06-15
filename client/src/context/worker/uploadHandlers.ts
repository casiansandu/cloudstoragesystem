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

const calculateManifestSize = (
  fileSize: number,
  chunkSize: number,
  aeadOverhead: number,
  encFileKeyHex: string
): number => {
  const totalChunks = Math.ceil(fileSize / chunkSize);

  const dummyUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const dummyIsoDate = "2026-06-08T12:00:00.000Z";
  
  const chunk_hash_placeholder = "0".repeat(64); 

  const dummyChunkInfos = [];
  for (let i = 0; i < totalChunks; i++) {
    const isLastChunk = i === totalChunks - 1;
    let plainChunkSize = chunkSize;

    if (isLastChunk) {
      const remainder = fileSize % chunkSize;
      plainChunkSize = remainder === 0 ? chunkSize : remainder;
    }

    dummyChunkInfos.push({
      index: i,
      id: dummyUuid, 
      ciphertextLength: plainChunkSize + aeadOverhead, 
      chunk_hash: chunk_hash_placeholder,
    });
  }

  const dummyManifest = {
    file_id: dummyUuid, 
    totalChunks: totalChunks,
    uploadedAt: dummyIsoDate,
    encryptedFileKey: encFileKeyHex, 
    file_size: fileSize,
    chunkInfos: dummyChunkInfos,
  };

  const jsonString = JSON.stringify(dummyManifest);
  const plainTextByteLength = new TextEncoder().encode(jsonString).length;

  // Exact AES-GCM envelope payload + 64 bytes for Ed25519 signature
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
  try { 
    const share_duration: number = 0;

    if (selectedFile.size === 0) {
      throw new Error("Cannot upload empty file.");
    } else if (selectedFile.size > 10 * 1024 * 1024 * 1024) {
      throw new Error("File size exceeds the 10 GB limit.");
    }

    const file_size_bytes = selectedFile.size;

    const chunk_size = 5 * 1024 * 1024;
    const chunk_number = Math.ceil(file_size_bytes / chunk_size);

    const _file_key = await generateMasterKey() as Uint8Array;
    const fileNameKey = expandKeyForName(_file_key);
    const fileDataKey = expandKeyForData(_file_key);
    const fileManifestKey = expandKeyForManifest(_file_key);

    const { nonce: enc_file_key_nonce, ciphertext: enc_file_key_ciphertext } =
      await encrypt(_file_key as BufferSource, currentFolderKey as BufferSource);

    const enc_file_key_data = bufferToHex(
      concatUint8(enc_file_key_nonce, enc_file_key_ciphertext) as BufferSource,
    );

    const AEAD_OVERHEAD = 28; // 12 byte nonce + 16 byte tag
    const totalChunkOverhead = chunk_number * AEAD_OVERHEAD;
    const encryptedChunksTotalSize = selectedFile.size + totalChunkOverhead;
    const manifest_size = calculateManifestSize(file_size_bytes, chunk_size, AEAD_OVERHEAD, enc_file_key_data);

    if (manifest_size > chunk_size) {
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
      chunkInfos: [],
    };

    let chunk_index = 0;

    while (chunk_index < chunk_number) {
      const { chunk_data_buffer, chunk_id } = await handleChunkEncryption(
        fileDataKey as BufferSource,
        chunk_index,
        file_id,
        chunk_size,
        selectedFile,
        chunk_number,
      );

      await uploadChunk(chunk_data_buffer, file_id, chunk_id);

      manifest.chunkInfos.push({
        index: chunk_index,
        id: chunk_id,
        ciphertextLength: chunk_data_buffer.byteLength,
        chunk_hash: bufferToHex(sha256(new Uint8Array(chunk_data_buffer)) as BufferSource),
      });

      chunk_index += 1;
    }

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
