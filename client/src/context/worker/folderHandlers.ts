import type { EncryptedUserFolder, FolderPermissions } from "../../utils/apiTypes";
import { decrypt, hexToBuffer } from "../../../utils/crypto";
import { expandKeyForName } from "./cryptoKeys";
import { getXwingKeyForFolder } from "./shareCrypto";
import { api } from "../../api/index";

export const getFolderParentIdAndName = async (
  folderId: string,
  userArk: Uint8Array,
) => {
  const rootFolderId = await api.folders.getRootId();
  if (rootFolderId.root_folder_id === folderId) {
    return { parentId: "", parentName: "" };
  }
  
  const folderData = await api.folders.getData(folderId);
  const parent_id = folderData.parent_id;

  if (!parent_id) {
    return { parentId: "", parentName: "" }; // Safety check
  }

  const parentFolderData = await api.folders.getData(parent_id);

  const enc_parent_folder_key_data = hexToBuffer(parentFolderData.encrypted_key_data);
  const enc_parent_folder_key_nonce = enc_parent_folder_key_data.slice(0, 12);
  const enc_parent_folder_key_ciphertext = enc_parent_folder_key_data.slice(12);
  const parent_folder_key = await decrypt(
    enc_parent_folder_key_ciphertext,
    userArk as BufferSource,
    enc_parent_folder_key_nonce,
  );

  const enc_parent_folder_name_data = hexToBuffer(parentFolderData.encrypted_name_data);
  const enc_parent_folder_name_nonce = enc_parent_folder_name_data.slice(0, 12);
  const enc_parent_folder_name_ciphertext = enc_parent_folder_name_data.slice(12);
  const parent_folder_name_dec = new TextDecoder().decode(await decrypt(
    enc_parent_folder_name_ciphertext,
    expandKeyForName(parent_folder_key) as BufferSource,
    enc_parent_folder_name_nonce,
  ));

  return { parentId: parent_id, parentName: parent_folder_name_dec };
};

export const getFoldersInFolder = async (folderId: string) => {
  const { folders } = await api.folders.getSubfolders(folderId);
  return folders as EncryptedUserFolder[];
};

export const getFolderPermissions = async (folderId: string): Promise<FolderPermissions> => {
  const { permissions } = await api.folders.getPermissions(folderId);
  return permissions;
};

export const getFolderNamesAndIds = async (
  raw_folder_data: EncryptedUserFolder[],
  parentFolderKey: Uint8Array, 
) => {
  const folders = await Promise.all(raw_folder_data.map(async (folder) => {
    try {
      const enc_folder_name_data = hexToBuffer(folder.encrypted_name_data);
      const enc_folder_name_nonce = enc_folder_name_data.slice(0, 12);
      const enc_folder_name_ciphertext = enc_folder_name_data.slice(12);

      const enc_folder_key_data = hexToBuffer(folder.encrypted_key_data);
      const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
      const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

      const folder_key = await decrypt(
        enc_folder_key_ciphertext,
        parentFolderKey as BufferSource, 
        enc_folder_key_nonce,
      );

      const folder_name = new TextDecoder().decode(await decrypt(
        enc_folder_name_ciphertext,
        expandKeyForName(folder_key) as BufferSource,
        enc_folder_name_nonce,
      ));

      return { id: folder.id, name: folder_name };
      
    } catch (error) {
      console.error(`Error decrypting personal folder name for folder ID: ${folder.id}`, error);
      return { id: folder.id, name: "Decryption Failed (Corrupted)" };
    }
  }));

  return folders;
};

export const getSharedFolders = async () => {
  const { folders } = await api.folders.getShared();
  return folders as EncryptedUserFolder[];
};

export const getSharedFoldersInFolder = async (folderId: string) => {
  const { folders } = await api.folders.getSharedSubfolders(folderId);
  return folders as EncryptedUserFolder[];
};

export const getSharedFolderDecryptedNamesAndIds = async (
  rawFolderData: EncryptedUserFolder[],
  getXwingKeyForFolder: (folderId: string, encryptedFolderKeyData: Uint8Array) => Promise<Uint8Array>,
) => {
  const folders = await Promise.all(rawFolderData.map(async (folder) => {
    try {
      
      const folder_key_data_string = folder.encrypted_key_data;

      if (!folder_key_data_string) {
        throw new Error("Folder key data not found in session for folder: " + folder.id);
      }
      const folder_key_data = hexToBuffer(folder_key_data_string);
      const folder_key_nonce = folder_key_data.slice(0, 12);
      const folder_key_ciphertext = folder_key_data.slice(12);

      const xwing_key = await getXwingKeyForFolder(folder.id, folder_key_data);
      const folder_key = await decrypt(
        folder_key_ciphertext,
        xwing_key as BufferSource,
        folder_key_nonce,
      );

      const enc_folder_name_data = hexToBuffer(folder.encrypted_name_data);
      const enc_folder_name_nonce = enc_folder_name_data.slice(0, 12);
      const enc_folder_name_ciphertext = enc_folder_name_data.slice(12);

      const folder_name = new TextDecoder().decode(await decrypt(
        enc_folder_name_ciphertext,
        expandKeyForName(folder_key) as BufferSource,
        enc_folder_name_nonce,
      ));

      return { id: folder.id, name: folder_name };
    } catch (error) {
      console.error("Error decrypting shared folder name for folder:", folder.id, error);
      return { id: folder.id, name: "Decryption failed" };
    }
  }));

  return folders;
};

export const getSharedFolderDecryptedNamesAndIdsInFolder = async (
  rawFolderData: EncryptedUserFolder[],
  parentFolderKey: Uint8Array,
) => {
  const folders = await Promise.all(rawFolderData.map(async (folder) => {
    try {
      const enc_folder_key_data = hexToBuffer(folder.encrypted_key_data);
      const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
      const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

      const folder_key = await decrypt(
        enc_folder_key_ciphertext,
        parentFolderKey as BufferSource,
        enc_folder_key_nonce,
      );

      const enc_folder_name_data = hexToBuffer(folder.encrypted_name_data);
      const enc_folder_name_nonce = enc_folder_name_data.slice(0, 12);
      const enc_folder_name_ciphertext = enc_folder_name_data.slice(12);

      const folder_name = new TextDecoder().decode(await decrypt(
        enc_folder_name_ciphertext,
        expandKeyForName(folder_key) as BufferSource,
        enc_folder_name_nonce,
      ));

      return { id: folder.id, name: folder_name };
    } catch (error) {
      console.error("Error decrypting shared subfolder name for folder:", folder.id, error);
      return { id: folder.id, name: "Decryption failed" };
    }
  }));

  return folders;
};