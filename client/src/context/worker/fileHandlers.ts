import type { EncryptedUserFileNoKey, ManifestData } from "../../utils/apiTypes";
import { decrypt, deriveChunkKey, hexToBuffer } from "../../../utils/crypto";
import { expandKeyForData, expandKeyForManifest } from "./cryptoKeys";
import { api } from "../../api/index";

type SessionFileKeyEntry = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
  file_key_for_download?: CryptoKey | null;
};

type GetManifestData = (fileId: string, fileManifestKey: Uint8Array) => Promise<ManifestData>;

type getXwingKeyForFileAndVerifySig = (fileId: string, encrypted_file_key: Uint8Array) => Promise<Uint8Array>;

export const getFilesInFolder = async (
  folderId: string,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
) => {
  // REFACTORED TO API
  const { files: files_with_keys } = await api.folders.getFiles(folderId);

  for (const file of files_with_keys) {
    sessionFileKeys.set(file.id, {
      // Mapping from the API type which uses encrypted_key_data
      encrypted_file_key: file.encrypted_key_data,
      temp_decrypted_file_key: null,
    });
  }

  const files = files_with_keys.map(file => ({ id: file.id, encrypted_name_data: file.encrypted_name_data })) as EncryptedUserFileNoKey[];

  return files;
};

export const getSharedFiles = async (
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
) => {
  const { files: temp_files } = await api.files.getShared();

  const files_to_return: EncryptedUserFileNoKey[] = [];

  for (const file of temp_files) {
    const encrypted_file_key = file.encrypted_file_key;
    if (!encrypted_file_key) {
      throw new Error("Missing encrypted file key for shared file: " + file.id);
    }
    sessionFileKeys.set(file.id, {
      encrypted_file_key: encrypted_file_key,
      temp_decrypted_file_key: null,
    });
    files_to_return.push({ id: file.id, encrypted_name_data: file.encrypted_name_data });
  }

  return files_to_return;
};

export const getSharedFilesInFolder = async (
  folderId: string,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
) => {
  // REFACTORED TO API
  const { files: files_with_keys } = await api.folders.getSharedFiles(folderId);

  for (const file of files_with_keys) {
    const encrypted_file_key = file.encrypted_file_key;
    if (!encrypted_file_key) {
      throw new Error("Missing encrypted file key for shared file: " + file.id);
    }
    sessionFileKeys.set(file.id, {
      encrypted_file_key: encrypted_file_key,
      temp_decrypted_file_key: null,
    });
  }

  const files = files_with_keys.map(file => ({
    id: file.id,
    encrypted_name_data: file.encrypted_name_data,
  })) as EncryptedUserFileNoKey[];

  return files;
};

export const getChunkInfos = async (
  fileId: string,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  currentFolderKey: Uint8Array,
  getXwingKeyForFileAndVerifySig: getXwingKeyForFileAndVerifySig,
  getManifestData: GetManifestData,
) => {
  if (!sessionFileKeys.get(fileId)) {
    throw new Error("File session data not found for file: " + fileId);
  }
  const encrypted_file_key = sessionFileKeys.get(fileId)?.encrypted_file_key;
  if (!encrypted_file_key) {
    throw new Error("File key not found in session for file: " + fileId);
  }

  let file_key: Uint8Array;

  const enc_file_key_data = hexToBuffer(encrypted_file_key);
  const file_key_nonce = enc_file_key_data.slice(0, 12);
  const file_key_ciphertext = enc_file_key_data.slice(12);
  try {
    file_key = await decrypt(
      file_key_ciphertext,
      currentFolderKey as BufferSource,
      file_key_nonce,
    );
  } catch (normal_error) {
    try {
      const xwing_key = await getXwingKeyForFileAndVerifySig(fileId, hexToBuffer(encrypted_file_key));
      file_key = await decrypt(
        file_key_ciphertext,
        xwing_key as BufferSource,
        file_key_nonce,
      );
    } catch (xwing_error) {
      console.warn(`Decryption of file key for file ${fileId} failed.`, {
        normal_error,
        xwing_error,
      });
      throw new Error("Failed to decrypt file key for file: " + fileId);
    }
  }
  const fileManifestKey = expandKeyForManifest(file_key);

  const manifest_json = await getManifestData(fileId, fileManifestKey);

  const file_size = manifest_json.file_size;

  return { fileSize: file_size, chunk_infos: manifest_json.chunkInfos };
};

export const decryptChunk = async (
  encrypted_chunk_data: ArrayBuffer,
  fileId: string,
  chunkIndex: number,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  currentFolderKey: Uint8Array,
  getXwingKeyForFileAndVerifySig: getXwingKeyForFileAndVerifySig,
  is_personal_file: boolean,
  is_shared_sub_file: boolean,
) => {
  if (!sessionFileKeys.get(fileId)) {
    throw new Error("File session data not found for file: " + fileId);
  }

  const file_master_key_encrypted =
    sessionFileKeys.get(fileId)?.encrypted_file_key;

  if (!file_master_key_encrypted) {
    throw new Error(
      "File master key not found in session for file: " + fileId,
    );
  }

  if (!sessionFileKeys.get(fileId)?.file_key_for_download) {
    let raw_file_key: BufferSource;

    const enc_file_key_data = hexToBuffer(file_master_key_encrypted);
    const enc_file_key_nonce = enc_file_key_data.slice(0, 12);
    const enc_file_key_ciphertext = enc_file_key_data.slice(12);

    try {
      if (is_personal_file || is_shared_sub_file) {
        raw_file_key = expandKeyForData(await decrypt(
          enc_file_key_ciphertext,
          currentFolderKey as BufferSource,
          enc_file_key_nonce,
        )) as BufferSource;
      } else {
        const xwing_key = await getXwingKeyForFileAndVerifySig(fileId, hexToBuffer(file_master_key_encrypted));
        raw_file_key = expandKeyForData(await decrypt(
          enc_file_key_ciphertext,
          xwing_key as BufferSource,
          enc_file_key_nonce,
        )) as BufferSource;

      }
    } catch (error) {
      console.warn(`Decryption of file key for file ${fileId} failed.`, {
        error,
      });
      throw new Error("Failed to decrypt file key for file: " + fileId);
    }

    sessionFileKeys.get(fileId)!.file_key_for_download = await crypto.subtle.importKey(
      "raw",
      raw_file_key,
      { name: "HKDF" },
      false,
      ["deriveKey"]
    );
  }

  const chunk_key = await deriveChunkKey(
    sessionFileKeys.get(fileId)!.file_key_for_download!,
    chunkIndex,
    fileId,
  );

  const chunkView = new Uint8Array(encrypted_chunk_data);
  const chunk_nonce = chunkView.subarray(0, 12);
  const chunk_ciphertext = chunkView.subarray(12);

  const decrypted_chunk = await decrypt(
    chunk_ciphertext,
    chunk_key,
    chunk_nonce,
  );

  return decrypted_chunk;
};