import type { ManifestData } from "../../utils/apiTypes";
import { bufferToHex, encrypt, generateMasterKey } from "../../../utils/crypto";
import { concatUint8 } from "../../utils/funcs";
import { expandKeyForData, expandKeyForManifest, expandKeyForName } from "./cryptoKeys";
import {
  startHybridUpload,
  handleChunkEncryption,
  uploadChunk,
  encryptManifest,
} from "../../components/UploadFileFeature/uploadFile";

type SessionFileKeyEntry = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

export const uploadFile = async (
  selectedFile: File,
  currentFolderId: string,
  currentFolderKey: Uint8Array,
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
) => {
  let file_id = "";
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

  const enc_file_name_data = await encrypt(selectedFile.name, fileNameKey as BufferSource);

  file_id = await startHybridUpload(
    enc_file_name_data,
    selectedFile,
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
    });

    chunk_index += 1;
  }

  const { encrypted_manifest_buffer, manifest_uuid } = await encryptManifest(
    file_id,
    manifest,
    fileManifestKey
  );

  await uploadChunk(encrypted_manifest_buffer, file_id, manifest_uuid);

  sessionFileKeys.set(file_id, {
    encrypted_file_key: enc_file_key_data,
    temp_decrypted_file_key: null,
  });

  return file_id;
};
