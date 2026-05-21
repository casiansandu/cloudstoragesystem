import config from "../../../config/config";
import type { EncryptedUserFolder } from "../../utils/apiTypes";
import { bufferToHex, decrypt, hexToBuffer } from "../../../utils/crypto";

export const createFolderForUser = async (
  encrypted_folder_key_data: Uint8Array,
  parent_folder_id: string | null,
  encrypted_folder_name_data: Uint8Array | null,
): Promise<string> => {
  const res = await fetch(`${config.BACKENDURL}/folders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      encrypted_key_data: bufferToHex(encrypted_folder_key_data as BufferSource),
      parent_folder_id,
      encrypted_folder_name_data: bufferToHex(encrypted_folder_name_data as BufferSource),
    }),
  });
  const data = await res.json();
  console.log("Create folder response:", { message: data.message, success: data.success });

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
    return { parentId: "", parentName: "root" };
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
    parent_folder_key as BufferSource,
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

export const getFolderNamesAndIds = async (
  raw_folder_data: EncryptedUserFolder[],
  userArk: Uint8Array,
) => {
  const folders = await Promise.all(raw_folder_data.map(async (folder) => {
    const enc_folder_name_data = hexToBuffer(folder.encrypted_name_data);
    const enc_folder_name_nonce = enc_folder_name_data.slice(0, 12);
    const enc_folder_name_ciphertext = enc_folder_name_data.slice(12);

    const enc_folder_key_data = hexToBuffer(folder.encrypted_key_data);
    const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
    const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

    const folder_key = await decrypt(
      enc_folder_key_ciphertext,
      userArk as BufferSource,
      enc_folder_key_nonce,
    );

    const folder_name = new TextDecoder().decode(await decrypt(
      enc_folder_name_ciphertext,
      folder_key as BufferSource,
      enc_folder_name_nonce,
    ));

    return { id: folder.id, name: folder_name };
  }));

  return folders;
};
