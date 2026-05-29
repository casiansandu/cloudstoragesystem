import config from "../../../config/config";
import type { EncryptedUserFolder, FolderPermissions } from "../../utils/apiTypes";
import { bufferToHex, decrypt, hexToBuffer } from "../../../utils/crypto";
import { expandKeyForName } from "./cryptoKeys";
import { getXwingKeyForFolder } from "./shareCrypto";

export const createFolderForUser = async (
  encrypted_folder_key_data_ark: Uint8Array,
  encrypted_folder_key_data_parent: Uint8Array | null,
  parent_folder_id: string | null,
  encrypted_folder_name_data: Uint8Array | null,
): Promise<string> => {
  const res = await fetch(`${config.BACKENDURL}/folders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      encrypted_key_data_ark: bufferToHex(encrypted_folder_key_data_ark as BufferSource),
      encrypted_key_data_parent: encrypted_folder_key_data_parent ? bufferToHex(encrypted_folder_key_data_parent as BufferSource) : "",
      parent_folder_id: parent_folder_id ? parent_folder_id : "",
      encrypted_folder_name_data: bufferToHex(encrypted_folder_name_data as BufferSource),
    }),
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to create folder for user: " + data.message);
  }

  return data.data.folder_id;
};

export const getRootFolderId = async () => {
  const res = await fetch(`${config.BACKENDURL}/folders/root/id`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch root folder id: " + data.message);
  }

  return data.data.root_folder_id;
};

const fetchFolderData = async (folderId: string) => {
  const res = await fetch(`${config.BACKENDURL}/folders/${folderId}/data`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch folder info: " + data.message);
  }

  return data.data;
};

export const getFolderParentIdAndName = async (
  folderId: string,
  userArk: Uint8Array,
) => {
  const rootFolderId = await getRootFolderId();
  if (folderId === rootFolderId) {
    return { parentId: "", parentName: "" };
  }
  const folderData = await fetchFolderData(folderId);
  const parent_id = folderData.parent_id;

  const parentFolderData = await fetchFolderData(parent_id);

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
  const res = await fetch(`${config.BACKENDURL}/folders/${folderId}/folders`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch folders in folder: " + data.message);
  }

  return data.data.folders as EncryptedUserFolder[];
};

export const getFolderPermissions = async (folderId: string): Promise<FolderPermissions> => {
  const res = await fetch(`${config.BACKENDURL}/folders/${folderId}/permissions`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch folder permissions: " + data.message);
  }

  return data.data.permissions as FolderPermissions;
};

export const getFolderNamesAndIds = async (
  raw_folder_data: EncryptedUserFolder[],
  parentFolderKey: Uint8Array, // 1. Change this parameter name
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
        parentFolderKey as BufferSource, // 2. Use the parent folder key here!
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
  const res = await fetch(`${config.BACKENDURL}/folders/shared`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch shared folders: " + data.message);
  }

  return data.data.folders as EncryptedUserFolder[];
};

export const getSharedFoldersInFolder = async (folderId: string) => {
  const res = await fetch(`${config.BACKENDURL}/folders/${folderId}/shared/folders`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Failed to fetch shared folders in folder: " + data.message);
  }

  return data.data.folders as EncryptedUserFolder[];
};

export const getGrandParentKeyFromStack = async (
  encrypted_shared_folder_data_stack: { parentId: string, folderId: string, encryptedKeyData: Uint8Array }[],
  user_mlkem_private: Uint8Array,
  user_x25519_private: Uint8Array,
  user_x25519_public: Uint8Array
): Promise<Uint8Array> => {

  console.log("Getting parent key from stack, stack length: ", encrypted_shared_folder_data_stack.length);

  if (encrypted_shared_folder_data_stack.length === 0) {
    throw new Error("Encrypted shared folder data stack is empty, cannot find parent key for folder");
  }

  const original_shared_folder = encrypted_shared_folder_data_stack[0];

  const enc_folder_key_data = original_shared_folder.encryptedKeyData;
  const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
  const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

  const xwing_key = await getXwingKeyForFolder(original_shared_folder.folderId, user_mlkem_private, user_x25519_private, user_x25519_public);
  
  let folder_key = await decrypt(
    enc_folder_key_ciphertext,
    xwing_key as BufferSource,
    enc_folder_key_nonce,
  );

  let skip = false;

  if (encrypted_shared_folder_data_stack.length === 2) {
    skip = true;
  }

  console.log("got decrypted key from stack for original shared folder");
  if (!skip) {
    for (let i = 1; i < encrypted_shared_folder_data_stack.length - 2; i++) {
      const folder_data = encrypted_shared_folder_data_stack[i];

      const enc_folder_key_data = folder_data.encryptedKeyData;
      const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
      const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

      const next_folder_key = await decrypt(
        enc_folder_key_ciphertext,
        folder_key as BufferSource,
        enc_folder_key_nonce,
      );

      folder_key = next_folder_key;
      console.log("decrypted key at index" + i + " in stack");
    }
  }

  try {
    const key_to_decrypt = encrypted_shared_folder_data_stack[encrypted_shared_folder_data_stack.length - (2 - (skip == true ? 1 : 0))].encryptedKeyData;
    const key_nonce = key_to_decrypt.slice(0, 12);
    const key_ciphertext = key_to_decrypt.slice(12);
    const test_decryption = await decrypt(
      key_ciphertext,
      folder_key as BufferSource,
      key_nonce,
    );
    console.log("test decryption with final folder key succeeded, parent key should be correct");
  } catch (error) {
    console.error("Test decryption with final folder key failed, there might be an issue with the parent key decryption", error);
  }

  return folder_key;
};

export const getSharedFolderParentIdAndName = async (
  encrypted_shared_folder_data_stack: { parentId: string, folderId: string, encryptedKeyData: Uint8Array, encryptedNameData: string }[],
  user_mlkem_private: Uint8Array,
  user_x25519_private: Uint8Array,
  user_x25519_public: Uint8Array,
) => {
  
  const grandparent_key = await getGrandParentKeyFromStack(encrypted_shared_folder_data_stack, user_mlkem_private, user_x25519_private, user_x25519_public);

  const enc_parent_key_data = encrypted_shared_folder_data_stack[encrypted_shared_folder_data_stack.length - (2 - (encrypted_shared_folder_data_stack.length === 2 ? 1 : 0))].encryptedKeyData;
  const enc_parent_key_nonce = enc_parent_key_data.slice(0, 12);
  const enc_parent_key_ciphertext = enc_parent_key_data.slice(12);

  const parent_key = await decrypt(
    enc_parent_key_ciphertext,
    grandparent_key as BufferSource,
    enc_parent_key_nonce,
  );

  const enc_parent_name_data = hexToBuffer(encrypted_shared_folder_data_stack[encrypted_shared_folder_data_stack.length - (2 - (encrypted_shared_folder_data_stack.length === 2 ? 1 : 0))].encryptedNameData);
  const enc_parent_name_nonce = enc_parent_name_data.slice(0, 12);
  const enc_parent_name_ciphertext = enc_parent_name_data.slice(12);

  const parent_name = new TextDecoder().decode(await decrypt(
    enc_parent_name_ciphertext,
    expandKeyForName(parent_key) as BufferSource,
    enc_parent_name_nonce,
  ));

  return { parentId: encrypted_shared_folder_data_stack[encrypted_shared_folder_data_stack.length - (2 - (encrypted_shared_folder_data_stack.length === 2 ? 1 : 0))].parentId, parentName: parent_name };
};

export const getSharedFolderDecryptedNamesAndIds = async (
  rawFolderData: EncryptedUserFolder[],
  getXwingKeyForFolder: (folderId: string) => Promise<Uint8Array>,
) => {
  const folders = await Promise.all(rawFolderData.map(async (folder) => {
    try {
      const folder_key_data_string = rawFolderData.find(f => f.id === folder.id)?.encrypted_key_data;

      if (folder_key_data_string == undefined) {
        throw new Error("Folder key data not found in session for folder: " + folder.id);
      }
      const folder_key_data = hexToBuffer(folder_key_data_string);
      const folder_key_nonce = folder_key_data.slice(0, 12);
      const folder_key_ciphertext = folder_key_data.slice(12);

      const xwing_key = await getXwingKeyForFolder(folder.id);
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
