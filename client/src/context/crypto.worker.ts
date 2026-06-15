import config from "../../config/config";
import type {
  ManifestData,
  EncryptedUserFolder,
  EncryptedUserFileNoKey,
} from "../utils/apiTypes";
import {
  hexToBuffer,
  decrypt,
  generateMasterKey,
  encrypt,
  bufferToHex,
} from "../../utils/crypto";
import { concatUint8, gen_uuidv5 } from "../utils/funcs";
import { sha256 } from "js-sha256";
import { shareFileHybrid } from "../components/ShareFileFeature/shareFile";
import {
  getFileDecryptedNamesAndIds,
  getSharedFileDecryptedNamesAndIds,
} from "./worker/fileNameHandlers";
import {
  getFolderPermissions,
  getFolderNamesAndIds,
  getFolderParentIdAndName,
  getFoldersInFolder,
  getSharedFolders,
  getSharedFoldersInFolder,
  getSharedFolderDecryptedNamesAndIds,
  getSharedFolderDecryptedNamesAndIdsInFolder,
} from "./worker/folderHandlers";
import {
  decryptChunk,
  getChunkInfos,
  getFilesInFolder,
  getSharedFiles,
  getSharedFilesInFolder,
} from "./worker/fileHandlers";
import {
  generateHybridSharedKey,
  getUserPublicKeys,
  getXwingKeyForFileAndVerifySig as getXwingKeyForFileAndVerifySigExternal,
  getXwingKeyForFolder as getXwingKeyForFolderExternal,
} from "./worker/shareCrypto";
import {
  performFullLogin,
  registerUser,
  type UserStateUpdate,
} from "./worker/authHandlers";
import { uploadFile } from "./worker/uploadHandlers";
import { expandKeyForName } from "./worker/cryptoKeys";
import { ed25519 } from "@noble/curves/ed25519.js";

import { api } from "../api/index";

let ed25519_private: Uint8Array | null = null;

let user_mlkem_public: Uint8Array | null = null;
let user_mlkem_private: Uint8Array | null = null;

let user_x25519_public: Uint8Array | null = null;
let user_x25519_private: Uint8Array | null = null;

let current_folder_key: Uint8Array | null = null;
let current_folder_id: string | null = null;
let user_ark: Uint8Array | null = null;

const sharedFolderCache = new Map<string, { key: Uint8Array; parentId: string }>();

type keysData = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

const sessionFileKeys = new Map<string, keysData>();

export const getManifestDataAndVerify = async (
  file_id: string, fileManifestKey: Uint8Array
): Promise<ManifestData> => {

  const manifest_name = sha256(file_id + "manifest");

  const manifest_data = (await api.files.downloadChunk(file_id, gen_uuidv5(manifest_name)));
  const signed_data_length = manifest_data.byteLength - 64;
  
  // verifying manifest signature before decryption to avoid unnecessary crypto operations if the manifest has been tampered with
  const signed_data = manifest_data.slice(0, signed_data_length); // [Nonce + Ciphertext]
  const manifest_signature = manifest_data.slice(signed_data_length); // The last 64 bytes

  const { owner_id } = await api.files.getOwnerId(file_id);
  const { ed25519_public } = await getUserPublicKeys(owner_id);

  const is_valid_signature = ed25519.verify(
    new Uint8Array(manifest_signature),
    new Uint8Array(signed_data), 
    ed25519_public
  );

  if (!is_valid_signature) {
    throw new Error("Invalid manifest signature. The manifest data may have been tampered with.");  
  }

  console.log("Manifest signature valid for file: ", file_id);

  const enc_manifest_nonce = manifest_data.slice(0, 12);
  const enc_manifest_ciphertext = manifest_data.slice(12, signed_data_length);

  const manifest = await decrypt(
    enc_manifest_ciphertext,
    fileManifestKey as BufferSource,
    enc_manifest_nonce,
  );

  const manifest_json: ManifestData = JSON.parse(
    new TextDecoder().decode(manifest),
  );

  return manifest_json;
};

const getXwingKeyForFileAndVerifySig = async (file_id: string, encrypted_file_key: Uint8Array) => {

  if (!user_mlkem_private || !user_x25519_private || !user_x25519_public || !ed25519_private || !encrypted_file_key) {
    throw new Error("User keys not initialized");
  }

  return getXwingKeyForFileAndVerifySigExternal(
    file_id,
    user_mlkem_private,
    user_x25519_private,
    user_x25519_public,
    encrypted_file_key,
    ed25519_private,
  );

};

const getXwingKeyForFolder = async (folder_id: string) => {
  if (!user_mlkem_private || !user_x25519_private || !user_x25519_public || !ed25519_private) {
    throw new Error("User keys not initialized");
  }
  return getXwingKeyForFolderExternal(
    folder_id,
    user_mlkem_private,
    user_x25519_private,
    user_x25519_public,
  );
};

type HandlerResult = {
  result: any;
  transfer?: Transferable[];
};

const applyUserState = (update: UserStateUpdate) => {
  user_mlkem_private = update.user_mlkem_private;
  user_mlkem_public = update.user_mlkem_public;
  user_x25519_private = update.user_x25519_private;
  user_x25519_public = update.user_x25519_public;
  current_folder_key = update.current_folder_key;
  current_folder_id = update.current_folder_id;
  user_ark = update.user_ark;
  ed25519_private = update.ed25519_private;

  console.log("User state applied in worker");
};

let file_to_download_info: { file_id: string, fileSize: number, personal: boolean, shared_sub_file: boolean, chunk_infos: { id: string, index: number, ciphertextLength: number, chunk_hash: string }[] } | null = null;

const handlers: Record<string, (payload: any) => Promise<HandlerResult>> = {
  PERFORM_FULL_LOGIN: async (payload) => {
    const username = payload.username;
    const password = payload.password;

    const userState = await performFullLogin(username, password);
    applyUserState(userState);

    return { result: { success: true } };
  },
  REGISTER_USER: async (payload) => {
    await registerUser(payload.username, payload.password, payload.email);
    return { result: { success: true } };
  },
  UPLOAD_FILE: async (payload) => {
    if (!current_folder_id || !current_folder_key) {
      throw new Error("Current folder data not initialized");
    }

    const fileId = await uploadFile(
      payload.file,
      current_folder_id,
      current_folder_key,
      sessionFileKeys,
      ed25519_private as Uint8Array,
    );

    return { result: { success: true, fileId } };
  },
  LOAD_CHUNK_INFOS: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    if (!payload.fileId || payload.fileId === "") {
      throw new Error("Invalid file ID");
    }

    if (payload.is_personal_file === undefined) {
      throw new Error("Missing is_personal_file flag in payload");
    }

    const file_id = payload.fileId;
    const is_personal_file = payload.is_personal_file;

    const chunk_infos_res = await getChunkInfos(
      file_id,
      sessionFileKeys,
      current_folder_key,
      getXwingKeyForFileAndVerifySig,
      getManifestDataAndVerify,
    );

    let sharedSubFile = false;
    const { root_folder_id } = await api.folders.getRootId();
    if (!is_personal_file && current_folder_id !== root_folder_id) {
      sharedSubFile = true;
    }

    file_to_download_info = { 
      file_id, 
      fileSize: chunk_infos_res.fileSize, 
      personal: is_personal_file,
      shared_sub_file: sharedSubFile,
      chunk_infos: chunk_infos_res.chunk_infos 
    };

    return { 
      result: { 
        success: true, 
        file_size: chunk_infos_res.fileSize,
        chunk_infos: chunk_infos_res.chunk_infos
      } 
    };
  },
  DECRYPT_CHUNK_VERIFY_HASH: async (payload: { chunkIndex: number; encryptedData: ArrayBuffer; chunkHash: string }) => {
    if (!current_folder_key) throw new Error("Folder key not initialized");
    if (!file_to_download_info) throw new Error("File info not loaded");
    
    if (payload.chunkIndex === undefined || !payload.encryptedData || !payload.chunkHash) {
      throw new Error("Invalid payload for decrypting chunk");
    }

    const recalculated_hash = sha256(payload.encryptedData);

    if (recalculated_hash !== payload.chunkHash) {
      console.error("Chunk hash mismatch! Possible data corruption or tampering.");
      throw new Error("Chunk hash mismatch. Data integrity cannot be verified.");
    }

    const chunk_index = payload.chunkIndex;
    const file_id = file_to_download_info.file_id;

    const decrypted_chunk = await decryptChunk(
      payload.encryptedData, 
      file_id,
      chunk_index,
      sessionFileKeys,
      current_folder_key,
      getXwingKeyForFileAndVerifySig,
      file_to_download_info.personal,
      file_to_download_info.shared_sub_file
    );

    return {
      result: { chunkData: decrypted_chunk },
      transfer: [decrypted_chunk.buffer],
    };
  },
  GET_AND_DECRYPT_CHUNK: async (payload: { chunkIndex: number }) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    if (!file_to_download_info) {
      throw new Error("File to download info not loaded for file");
    }

    const chunk_index = payload.chunkIndex;

    if (chunk_index < 0 || chunk_index >= file_to_download_info.chunk_infos.length) {
      throw new Error("Invalid chunk index requested: " + chunk_index);
    }

    const file_id = file_to_download_info.file_id;
    const chunk_id = file_to_download_info.chunk_infos[chunk_index].id;

    const encrypted_chunk = await api.files.downloadChunk(file_id, chunk_id);

    const decrypted_chunk =
    await decryptChunk(
      encrypted_chunk,
      file_id,
      chunk_index,
      sessionFileKeys,
      current_folder_key,
      getXwingKeyForFileAndVerifySig,
      file_to_download_info.personal,
      file_to_download_info.shared_sub_file
    );

    return {
      result: { chunkData: decrypted_chunk },
      transfer: [decrypted_chunk.buffer],
    };
  },
  SET_CURRENT_FOLDER: async (payload) => {
    
    const folder_id: string = payload.folderId;
    const direction = payload.direction;

    if (folder_id === current_folder_id) {
      return { result: { success: true } };
    }

    if (direction != "up" && direction != "down" && direction != "up_shared" && direction != "down_shared") {
      throw new Error("Invalid navigation direction: " + direction);
    }

    if (ed25519_private === null) {
      throw new Error("User ed25519 not initialized");
    }

    const { access_type } = await api.folders.getAccessType(folder_id);
    console.log("moving ", direction, " into ", access_type, " folder");

    const folderData = await api.folders.getData(folder_id);
    const enc_folder_key_data = hexToBuffer(folderData.encrypted_key_data);
    const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
    const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

    if (access_type === "owner") {
      
      let safe_parent_id = folderData.parent_id || "";
      const { signature } = await api.folders.getSignature(folder_id);

      const isValidSignature = ed25519.verify(
        hexToBuffer(signature),
        concatUint8(
          new TextEncoder().encode(safe_parent_id),
          concatUint8(
            hexToBuffer(folderData.encrypted_name_data), 
            enc_folder_key_data
          )
        ),
        ed25519.getPublicKey(ed25519_private),
      );

      if (isValidSignature) {
        console.log("Valid signature for folder data of folder: ", folder_id);
      } else {
        throw new Error("Invalid signature for folder data of folder: " + folder_id);
      }

      if (direction === "up" || direction === "up_shared") {
        
        const cachedFolder = sharedFolderCache.get(folder_id);
        
        if (cachedFolder) {
          current_folder_key = cachedFolder.key;
        } else {
          current_folder_key = await decrypt(
            enc_folder_key_ciphertext,
            user_ark as BufferSource,
            enc_folder_key_nonce,
          );
          
          sharedFolderCache.set(folder_id, { 
            key: current_folder_key, 
            parentId: "" 
          });
        }

      } else if ((direction === "down" || direction === "down_shared") && folderData.encrypted_key_data_parent) {
        
        const enc_parent_data = hexToBuffer(folderData.encrypted_key_data_parent);
        
        current_folder_key = await decrypt(
          enc_parent_data.slice(12),
          current_folder_key as BufferSource, 
          enc_parent_data.slice(0, 12)
        );

        if (current_folder_id) {
          sharedFolderCache.set(folder_id, { 
            key: current_folder_key, 
            parentId: current_folder_id 
          });
        }

      } else {
        current_folder_key = await decrypt(
          enc_folder_key_ciphertext,
          user_ark as BufferSource,
          enc_folder_key_nonce,
        );
      }
      
    } else if (access_type === "shared") {

      const { signature } = await api.folders.getSignature(folder_id);

      const folder_owner = await api.folders.getOwnerId(folder_id);
      const { ed25519_public: folder_owner_ed25519_public } = await getUserPublicKeys(folder_owner.owner_id);



      const { x25519_ephemeral_public, mlkem_ciphertext } = await api.folders.getHybridInfo(folder_id);

      const encrypted_folder_key_buffer = hexToBuffer(folderData.encrypted_key_data);
      const serialized_permissions = new TextEncoder().encode(
        JSON.stringify(await getFolderPermissions(folder_id))
      );

      const isValidSignature = ed25519.verify(
        hexToBuffer(signature),
        concatUint8(
          hexToBuffer(x25519_ephemeral_public),
          hexToBuffer(mlkem_ciphertext),
          encrypted_folder_key_buffer,
          serialized_permissions
        ),
        folder_owner_ed25519_public,
      );

      if (isValidSignature) {
        console.log("Valid signature for folder data of folder: ", folder_id);
      } else {
        throw new Error("Invalid signature for folder data of folder: " + folder_id);
      }

      const xwing_key = await getXwingKeyForFolder(folder_id);
      
      current_folder_key = await decrypt(
        enc_folder_key_ciphertext,
        xwing_key as BufferSource,
        enc_folder_key_nonce,
      );

      sharedFolderCache.set(folder_id, { key: current_folder_key, parentId: "" });

     } else if (access_type === "shared_subfolder") {
      
      if (direction === "down_shared" || direction === "down") {
        
        current_folder_key = await decrypt(
          enc_folder_key_ciphertext,
          current_folder_key as BufferSource,
          enc_folder_key_nonce,
        );
        
        sharedFolderCache.set(folder_id, { 
          key: current_folder_key, 
          parentId: current_folder_id as string 
        });

      } else if (direction === "up_shared" || direction === "up") {
        
        const cachedFolder = sharedFolderCache.get(folder_id);
        
        if (!cachedFolder) {
           throw new Error("Shared folder key not found in memory. Please navigate from the shared root.");
        }
        
        current_folder_key = cachedFolder.key;
      }
      
    } else {
      throw new Error("Unknown folder access type: " + access_type);
    }

    current_folder_id = folder_id;
    return { result: { success: true } };
  },
  HAS_ACCESS_TO_FOLDER: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }
    let folder_id: string = payload.folderId;

    if (folder_id == "") {
      return { result: { hasAccess: false} };
    }

    if (folder_id === current_folder_id) {
      return { result: { hasAccess: true } };
    }
    
    try {
      await api.folders.checkAccess(folder_id);
      return { result: { hasAccess: true } };
    } catch (error) {
      console.error("Error checking folder access:", error);
      return { result: { hasAccess: false } };
    }
  },
  GET_FOLDER_PARENT_ID_AND_NAME: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    if (!user_ark) {
      throw new Error("User ark not initialized");
    }

    const result = await getFolderParentIdAndName(
      payload.folderId,
      user_ark,
    );

    return { result };
  },
  GET_FOLDERS_IN_FOLDER: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }
    let folder_id: string = payload.folderId;

    if (folder_id == "") {
      folder_id = current_folder_id as string;
    }

    const folders = await getFoldersInFolder(folder_id);

    return { result: { folders } };
  },
  GET_SHARED_FOLDERS: async () => {

    const folders: EncryptedUserFolder[] = await getSharedFolders();

    return { result: { folders } };

  },
  GET_SHARED_FOLDERS_IN_FOLDER: async (payload) => {
    const folders: EncryptedUserFolder[] = await getSharedFoldersInFolder(payload.folderId);

    return { result: { folders } };
  },
  GET_PERMISSIONS_FOR_FOLDER: async (payload) => {
    const permissions = await getFolderPermissions(payload.folderId);

    return { result: { permissions } };
  },
  GET_FILES_IN_FOLDER: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }
    let folder_id: string = payload.folderId;

    if (folder_id == "") {
      folder_id = current_folder_id as string;
    }

    const files = await getFilesInFolder(
      folder_id,
      sessionFileKeys,
    );

    return { result: { files } };
  },
  GET_FILE_DECRYPTED_NAMES_AND_IDS: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const raw_file_data: EncryptedUserFileNoKey[] = payload.files;

    if (!raw_file_data || raw_file_data.length === 0) {
      return { result: { files: [] } };
    }
    const files = await getFileDecryptedNamesAndIds(
      raw_file_data,
      sessionFileKeys,
      current_folder_key,
    );

    return { result: { files } };
  },
  GET_SHARED_FILE_DECRYPTED_NAMES_AND_IDS: async (payload) => {
    const raw_file_data: EncryptedUserFileNoKey[] = payload.files;

    if (!raw_file_data || raw_file_data.length === 0) {
      return { result: { files: [] } };
    }
    const files = await getSharedFileDecryptedNamesAndIds(
      raw_file_data,
      sessionFileKeys,
      getXwingKeyForFileAndVerifySig,
    );

    return { result: { files } };
  },
  GET_SHARED_FILES_IN_FOLDER: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const files = await getSharedFilesInFolder(
      payload.folderId,
      sessionFileKeys,
    );

    return { result: { files } };
  },
  GET_SHARED_FOLDER_DECRYPTED_NAMES_AND_IDS: async (payload) => {
    
    const raw_folder_data: EncryptedUserFolder[] = payload.folders;

    if (!raw_folder_data || raw_folder_data.length === 0) {
      return { result: { folders: [] } };
    }
    const folders = await getSharedFolderDecryptedNamesAndIds(
      raw_folder_data,
      getXwingKeyForFolder,
    );

    return { result: { folders } };
  },
  GET_SHARED_FOLDER_DECRYPTED_NAMES_AND_IDS_IN_FOLDER: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const raw_folder_data: EncryptedUserFolder[] = payload.folders;

    if (!raw_folder_data || raw_folder_data.length === 0) {
      return { result: { folders: [] } };
    }

    const folders = await getSharedFolderDecryptedNamesAndIdsInFolder(
      raw_folder_data,
      current_folder_key,
    );

    return { result: { folders } };
  },
  GET_FOLDER_NAMES_AND_IDS: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const raw_folder_data: EncryptedUserFolder[] = payload.folders;

    if (!raw_folder_data || raw_folder_data.length === 0) {
      return { result: { folders: [] } };
    }

    const folders = await getFolderNamesAndIds(
      raw_folder_data,
      current_folder_key, 
    );

    return { result: { folders } };
  },
  GET_SHARED_FILES: async () => {
    const files = await getSharedFiles(sessionFileKeys);

    return { result: { files } };
  },
  GET_SHARED_FOLDER_PARENT_ID_AND_NAME: async () => {
    if (!current_folder_id) throw new Error("Current folder ID is null");

    const cachedData = sharedFolderCache.get(current_folder_id);
    
    if (!cachedData || !cachedData.parentId) {
      return { result: { parentId: "", parentName: "" } };
    }

    const parentId = cachedData.parentId;
    const parentCache = sharedFolderCache.get(parentId);

    if (!parentCache) {
      console.warn("Parent folder key missing from cache. User likely refreshed the page.");
      return { result: { parentId: parentId, parentName: "Shared Folder (Return to Root)" } };
    }

    // --- REFACTORED TO API ---
    const parentFolderData = await api.folders.getData(parentId);
    const enc_parent_name_data = hexToBuffer(parentFolderData.encrypted_name_data);
    
    const parentName = new TextDecoder().decode(await decrypt(
      enc_parent_name_data.slice(12),
      expandKeyForName(parentCache.key) as BufferSource,
      enc_parent_name_data.slice(0, 12)
    ));

    return { result: { parentId, parentName } };
  },
  CREATE_FOLDER: async (payload) => {
    if (!current_folder_key || !current_folder_id || !ed25519_private) {
      throw new Error("Current folder data or keys not initialized");
    }

    const folder_name: string = payload.name;
    const parent_folder_id: string = current_folder_id;
    const new_folder_key = await generateMasterKey() as Uint8Array;

    const encrypted_folder_key_data_ark = await encrypt(new_folder_key as BufferSource, user_ark as BufferSource);
    const encrypted_folder_key_data_parent = await encrypt(new_folder_key as BufferSource, current_folder_key as BufferSource);
    const encrypted_folder_name_data = await encrypt(folder_name, expandKeyForName(new_folder_key) as BufferSource);

    const safe_parent_id = parent_folder_id || ""; 
    
    const signature = ed25519.sign(
      concatUint8(
        new TextEncoder().encode(safe_parent_id),
        concatUint8(encrypted_folder_name_data.nonce, encrypted_folder_name_data.ciphertext),
        concatUint8(encrypted_folder_key_data_ark.nonce, encrypted_folder_key_data_ark.ciphertext)
      ),
      ed25519_private
    );

    const { folder_id } = await api.folders.create({
      parent_folder_id,
      encrypted_key_data_ark: bufferToHex(concatUint8(encrypted_folder_key_data_ark.nonce, encrypted_folder_key_data_ark.ciphertext) as BufferSource),
      encrypted_key_data_parent: bufferToHex(concatUint8(encrypted_folder_key_data_parent.nonce, encrypted_folder_key_data_parent.ciphertext) as BufferSource),
      encrypted_folder_name_data: bufferToHex(concatUint8(encrypted_folder_name_data.nonce, encrypted_folder_name_data.ciphertext) as BufferSource),
      signature: bufferToHex(signature as BufferSource)
    });

    return { result: { success: true, folderId: folder_id } };
  },
  SHARE_FILE: async (payload) => {

    const file_id: string = payload.fileId;
    const recipient_username: string = payload.recipientUsername;
    const share_duration: number = payload.share_duration;

    const { user_id } = await api.users.getUserId(recipient_username);

    const { recipient_x25519_public, recipient_mlkem_public } = await getUserPublicKeys(user_id);

    const { xwing_key, x25519_ephemeral_public, mlkem_ciphertext } =
      await generateHybridSharedKey(
        recipient_mlkem_public,
        recipient_x25519_public,
      );

    console.log("Xwing key generated for sharing file");

    const encrypted_file_key = sessionFileKeys.get(
      payload.fileId,
    )?.encrypted_file_key;
    if (!encrypted_file_key) {
      throw new Error(
        "File session data not found for file: " + payload.fileId,
      );
    }

    const shareData = await shareFileHybrid(
      file_id,
      recipient_username,
      encrypted_file_key,
      xwing_key,
      mlkem_ciphertext,
      x25519_ephemeral_public,
      share_duration,
      current_folder_key as Uint8Array,
      ed25519_private as Uint8Array,
    );

    if (!shareData) {
      throw new Error("Failed to share file");
    }

    return { result: { success: true } };
  },
  SHARE_FOLDER: async (payload) => {

    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const folder_id: string = payload.folderId;
    const recipient_username: string = payload.recipientUsername;
    const share_duration: number = payload.shareDuration;
    let permissions = payload.permissions;

    permissions.can_download = true

    const { permissions: fetchedPermissions } = await api.folders.getPermissions(folder_id);

    if (!fetchedPermissions.can_share) {
      throw new Error("You don't have permission to share this folder.");
    }

    const { access_type } = await api.folders.getAccessType(folder_id);

    const { user_id } = await api.users.getUserId(recipient_username); // recipient user id

    const { recipient_x25519_public, recipient_mlkem_public } = await getUserPublicKeys(user_id);

    const { xwing_key, x25519_ephemeral_public, mlkem_ciphertext } =
      await generateHybridSharedKey(
        recipient_mlkem_public,
        recipient_x25519_public,
      );

    console.log("Xwing key generated for sharing file");

    const { encrypted_key_data } = await api.folders.getEncryptedKey(folder_id);

    const encrypted_folder_key_data = hexToBuffer(encrypted_key_data);
    const enc_folder_key_nonce = encrypted_folder_key_data.slice(0, 12);
    const enc_folder_key_ciphertext = encrypted_folder_key_data.slice(12);

    let folder_key: Uint8Array;
    if (access_type === "owner") {
      folder_key = await decrypt(
        enc_folder_key_ciphertext,
        user_ark as BufferSource,
        enc_folder_key_nonce,
      );
    } else if (access_type === "shared") {
      const xwing_key_personal = await getXwingKeyForFolder(folder_id);

      folder_key = await decrypt(
        enc_folder_key_ciphertext,
        xwing_key_personal as BufferSource,
        enc_folder_key_nonce,
      );
    } else if (access_type === "shared_subfolder") {
      folder_key = await decrypt(
        enc_folder_key_ciphertext,
        current_folder_key as BufferSource,
        enc_folder_key_nonce,
      );
    } else {
      throw new Error("Unknown folder access type: " + access_type);
    }

    const encrypted_folder_key = await encrypt(folder_key as BufferSource, xwing_key as BufferSource);
    const encrypted_folder_key_buffer = concatUint8(encrypted_folder_key.nonce, encrypted_folder_key.ciphertext);

    const serialized_permissions = new TextEncoder().encode(JSON.stringify(permissions));

    const signature = ed25519.sign(
      concatUint8(
        x25519_ephemeral_public,
        mlkem_ciphertext,
        encrypted_folder_key_buffer,
        serialized_permissions
      ),
      ed25519_private as Uint8Array
    );
    
    const shareData = await api.folders.shareHybrid({
      folder_id,
      recipient_username,
      encrypted_folder_key: bufferToHex(encrypted_folder_key_buffer as BufferSource),
      share_duration,
      mlkem_ciphertext: bufferToHex(mlkem_ciphertext as BufferSource),
      x25519_ephemeral_public: bufferToHex(x25519_ephemeral_public as BufferSource),
      permissions,
      signature: bufferToHex(signature as BufferSource),
    });

    console.log("Folder shared successfully with access id" + shareData.folder_access_id);

    return { result: { success: true } };
  },
  DELETE_FOLDER: async (payload) => {
    const folder_id: string = payload.folderId;
    
    // --- REFACTORED TO API ---
    await api.folders.delete(folder_id);
    
    sharedFolderCache.delete(folder_id);

    return { result: { success: true } };
  },
  GET_CURRENT_FOLDER_ID: async () => {
    if (!current_folder_id) {
      throw new Error("Current folder data not initialized");
    }

    return { result: { folderId: current_folder_id } };
  },
  LOGOUT_USER: async () => {
    user_mlkem_public = null;
    user_mlkem_private = null;
    user_x25519_public = null;
    user_x25519_private = null;
    user_ark = null;
    current_folder_key = null;
    current_folder_id = null;
    sharedFolderCache.clear();

    sessionFileKeys.clear();

    // --- REFACTORED TO API ---
    await api.auth.logout();

    return { result: { success: true } };
  },
  CLOSE_FILE: async (payload) => {
    const file_id = payload.fileId;
    file_to_download_info = null;

    const entry = sessionFileKeys.get(file_id);
    if (entry) {
      entry.temp_decrypted_file_key = null;
    }

    return { result: { success: true } };
  },
};

globalThis.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    const handler = handlers[type];
    if (!handler) {
      throw new Error(`Unknown command: ${type}`);
    }

    const { result, transfer } = await handler(payload);
    
    if (transfer && transfer.length > 0) {
      self.postMessage({ id, type: "SUCCESS", result }, { transfer });
    } else {
      self.postMessage({ id, type: "SUCCESS", result });
    }
  } catch (err: any) {
    self.postMessage({
      id,
      type: "ERROR",
      result: { success: false },
      error: err.message,
    });
  }
};