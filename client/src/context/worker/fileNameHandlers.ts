import type { EncryptedUserFileNoKey } from "../../utils/apiTypes";
import { decrypt, hexToBuffer } from "../../../utils/crypto";
import { expandKeyForName } from "./cryptoKeys";

type SessionFileKeyEntry = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

export const getFileDecryptedNamesAndIds = async (
  rawFileData: EncryptedUserFileNoKey[],
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  currentFolderKey: Uint8Array,
) => {
  const files = await Promise.all(rawFileData.map(async (file) => {
    try {
      const file_key_data_string = sessionFileKeys.get(file.id)?.encrypted_file_key;

      if (file_key_data_string == undefined) {
        throw new Error("File key data not found in session for file: " + file.id);
      }
      const file_key_data = hexToBuffer(file_key_data_string);
      const file_key_nonce = file_key_data.slice(0, 12);
      const file_key_ciphertext = file_key_data.slice(12);

      const file_key = await decrypt(
        file_key_ciphertext,
        currentFolderKey as BufferSource,
        file_key_nonce,
      );

      const enc_file_name_data = hexToBuffer(file.encrypted_name_data);
      const enc_file_name_nonce = enc_file_name_data.slice(0, 12);
      const enc_file_name_ciphertext = enc_file_name_data.slice(12);

      const file_name = new TextDecoder().decode(await decrypt(
        enc_file_name_ciphertext,
        expandKeyForName(file_key) as BufferSource,
        enc_file_name_nonce,
      ));

      return { id: file.id, name: file_name };
    } catch (error) {
      console.error("Error decrypting file name for file:", file.id, error);
      return { id: file.id, name: "Decryption failed" };
    }
  }));

  return files;
};

export const getSharedFileDecryptedNamesAndIds = async (
  rawFileData: EncryptedUserFileNoKey[],
  sessionFileKeys: Map<string, SessionFileKeyEntry>,
  getXwingKeyForFile: (fileId: string) => Promise<Uint8Array>,
) => {
  const files = await Promise.all(rawFileData.map(async (file) => {
    try {
      const file_key_data_string = sessionFileKeys.get(file.id)?.encrypted_file_key;

      if (file_key_data_string == undefined) {
        throw new Error("File key data not found in session for file: " + file.id);
      }
      const file_key_data = hexToBuffer(file_key_data_string);
      const file_key_nonce = file_key_data.slice(0, 12);
      const file_key_ciphertext = file_key_data.slice(12);

      const xwing_key = await getXwingKeyForFile(file.id);
      const file_key = await decrypt(
        file_key_ciphertext,
        xwing_key as BufferSource,
        file_key_nonce,
      );

      const enc_file_name_data = hexToBuffer(file.encrypted_name_data);
      const enc_file_name_nonce = enc_file_name_data.slice(0, 12);
      const enc_file_name_ciphertext = enc_file_name_data.slice(12);

      const file_name = new TextDecoder().decode(await decrypt(
        enc_file_name_ciphertext,
        expandKeyForName(file_key) as BufferSource,
        enc_file_name_nonce,
      ));

      return { id: file.id, name: file_name };
    } catch (error) {
      console.error("Error decrypting shared file name for file:", file.id, error);
      return { id: file.id, name: "Decryption failed" };
    }
  }));

  return files;
};
