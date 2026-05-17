import config from "../../../config/config";
import type { EncryptedUserFile, EncryptedUserFileNoKey, ManifestData } from "../../utils/apiTypes";
import { decrypt, deriveChunkKey, hexToBuffer } from "../../../utils/crypto";
import { fetchChunk } from "../../components/DownloadFileFeature/downloadFile";
import { expandKeyForData, expandKeyForManifest } from "./cryptoKeys";

type SessionFileKeyEntry = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

type GetManifestData = (fileId: string, fileManifestKey: Uint8Array) => Promise<ManifestData>;

type GetXwingKeyForFile = (fileId: string) => Promise<Uint8Array>;

export const getFilesInFolder = async (
  folderId: string,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
) => {
  const res = await fetch(`${config.BACKENDURL}/folders/${folderId}/files`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch files in folder: " + data.message);
  }
  const files_with_keys = data.data.files as EncryptedUserFile[];

  for (const file of files_with_keys) {
    sessionFileKeys.set(file.id, {
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
  const files: EncryptedUserFileNoKey[] = await fetch(
    `${config.BACKENDURL}/files/shared`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    },
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        throw new Error("Failed to fetch shared files: " + data.message);
      }

      const temp_files = data.data.files;
      const files_to_return: EncryptedUserFileNoKey[] = [];
      for (const file of temp_files) {
        sessionFileKeys.set(file.id, {
          encrypted_file_key: file.encrypted_file_key,
          temp_decrypted_file_key: null,
        });
        files_to_return.push({ id: file.id, encrypted_name_data: file.encrypted_name_data });
      }

      return files_to_return;
    });

  return files;
};

export const getChunkInfos = async (
  fileId: string,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  currentFolderKey: Uint8Array,
  getXwingKeyForFile: GetXwingKeyForFile,
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
      const xwing_key = await getXwingKeyForFile(fileId);
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

  return { fileSize: file_size, chunks: manifest_json.chunkInfos };
};

export const getAndDecryptChunk = async (
  fileId: string,
  chunkId: string,
  chunkIndex: number,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  currentFolderKey: Uint8Array,
  getXwingKeyForFile: GetXwingKeyForFile,
) => {
  if (!sessionFileKeys.get(fileId)) {
    throw new Error("File session data not found for file: " + fileId);
  }

  const chunk_data = await fetchChunk(fileId, chunkId);

  const file_master_key_encrypted =
    sessionFileKeys.get(fileId)?.encrypted_file_key;

  if (!file_master_key_encrypted) {
    throw new Error(
      "File master key not found in session for file: " + fileId,
    );
  }

  let file_key =
    sessionFileKeys.get(fileId)!.temp_decrypted_file_key;

  if (!file_key) {
    const enc_file_key_data = hexToBuffer(file_master_key_encrypted);
    const enc_file_key_nonce = enc_file_key_data.slice(0, 12);
    const enc_file_key_ciphertext = enc_file_key_data.slice(12);

    try {
      file_key = expandKeyForData(await decrypt(
        enc_file_key_ciphertext,
        currentFolderKey as BufferSource,
        enc_file_key_nonce,
      )) as BufferSource;
    }
    catch (normal_error) {
      try {
        const xwing_key = await getXwingKeyForFile(fileId);
        file_key = expandKeyForData(await decrypt(
          enc_file_key_ciphertext,
          xwing_key as BufferSource,
          enc_file_key_nonce,
        )) as BufferSource;
      } catch (xwing_error) {
        console.warn(`Decryption of file key for file ${fileId} failed.`, {
          normal_error, xwing_error,
        });
        throw new Error("Failed to decrypt file key for file: " + fileId);
      }
    }

    sessionFileKeys.get(fileId)!.temp_decrypted_file_key =
      file_key;
  }

  const chunk_key = await deriveChunkKey(
    file_key,
    chunkIndex,
    fileId,
  );

  const chunk_nonce = chunk_data.slice(0, 12);
  const chunk_ciphertext = chunk_data.slice(12);

  const decrypted_chunk = await decrypt(
    chunk_ciphertext,
    chunk_key,
    chunk_nonce,
  );

  return decrypted_chunk;
};
