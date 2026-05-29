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
import { fetchChunk } from "../components/DownloadFileFeature/downloadFile";
import {
  getFileDecryptedNamesAndIds,
  getSharedFileDecryptedNamesAndIds,
} from "./worker/fileNameHandlers";
import {
  createFolderForUser,
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
  getAndDecryptChunk,
  getChunkInfos,
  getFilesInFolder,
  getSharedFiles,
  getSharedFilesInFolder,
} from "./worker/fileHandlers";
import {
  generateHybridSharedKey,
  getUserHybridKeys,
  getXwingKeyForFile as getXwingKeyForFileExternal,
  getXwingKeyForFolder as getXwingKeyForFolderExternal,
} from "./worker/shareCrypto";
import {
  performFullLogin,
  registerUser,
  type UserStateUpdate,
} from "./worker/authHandlers";
import { uploadFile } from "./worker/uploadHandlers";
import { expandKeyForName } from "./worker/cryptoKeys";

let user_rsa_private: CryptoKey | null = null;
let user_mlkem_public: Uint8Array | null = null;
let user_mlkem_private: Uint8Array | null = null;

let user_x25519_public: Uint8Array | null = null;
let user_x25519_private: Uint8Array | null = null;

let current_folder_key: Uint8Array | null = null;
let current_folder_id: string | null = null;
let user_ark: Uint8Array | null = null;

// Maps folderId -> { decryptedKey, parentId }
const sharedFolderCache = new Map<string, { key: Uint8Array; parentId: string }>();

type keysData = {
  encrypted_file_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

const sessionFileKeys = new Map<string, keysData>();

export const getManifestData = async (
  file_id: string, fileManifestKey: Uint8Array
): Promise<ManifestData> => {

  const manifest_name = sha256(file_id + "manifest");

  const manifest_data = await fetchChunk(file_id, gen_uuidv5(manifest_name));

  const enc_manifest_nonce = manifest_data.slice(0, 12);
  const enc_manifest_ciphertext = manifest_data.slice(12);

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

const getXwingKeyForFile = async (file_id: string) => {
  return getXwingKeyForFileExternal(
    file_id,
    user_mlkem_private,
    user_x25519_private,
    user_x25519_public,
  );
};

const getXwingKeyForFolder = async (folder_id: string) => {
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
  user_rsa_private = update.user_rsa_private;
  user_mlkem_private = update.user_mlkem_private;
  user_mlkem_public = update.user_mlkem_public;
  user_x25519_private = update.user_x25519_private;
  user_x25519_public = update.user_x25519_public;
  current_folder_key = update.current_folder_key;
  current_folder_id = update.current_folder_id;
  user_ark = update.user_ark;

  console.log("User state applied in worker");
};

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
    );

    return { result: { success: true, fileId } };
  },
  GET_CHUNK_INFOS: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const file_id: string = payload.fileId;

    const result = await getChunkInfos(
      file_id,
      sessionFileKeys,
      current_folder_key,
      getXwingKeyForFile,
      getManifestData,
    );

    return { result };
  },
  GET_AND_DECRYPT_CHUNK: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const decrypted_chunk = await getAndDecryptChunk(
      payload.fileId,
      payload.chunkId,
      payload.chunkIndex,
      sessionFileKeys,
      current_folder_key,
      getXwingKeyForFile,
    );

    return {
      result: { decryptedChunk: decrypted_chunk },
      transfer: [decrypted_chunk.buffer],
    };
  },
  SET_CURRENT_FOLDER: async (payload) => {
    const folder_id: string = payload.folderId;
    const direction= payload.direction;

    if (folder_id === current_folder_id) {
      return { result: { success: true } };
    }

    if (direction != "up" && direction != "down" && direction != "up_shared" && direction != "down_shared") {
      throw new Error("Invalid navigation direction: " + direction);
    }
    let res;
    res = await fetch(
      `${config.BACKENDURL}/folders/${folder_id}/access_type`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    const get_access_type_res = (await res.json());

    if (!get_access_type_res.success) {
      throw new Error("Failed to get folder access type: " + get_access_type_res.message);
    }

    const access_type = get_access_type_res.data.access_type;
    console.log("moving ", direction, " into ", access_type, " folder");

    let data;
    res = await fetch(
      `${config.BACKENDURL}/folders/${folder_id}/data`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    data = await res.json();
    
    if (!data.success) {
      throw new Error("Failed to fetch folder key data: " + data.message);
    }

    const enc_folder_key_data = hexToBuffer(data.data.encrypted_key_data);
    const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
    const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

    if (access_type === "owner") {
      
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

      } else if ((direction === "down" || direction === "down_shared") && data.data.encrypted_key_data_parent) {
        
        const enc_parent_data = hexToBuffer(data.data.encrypted_key_data_parent);
        
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
      const res = await fetch(
        `${config.BACKENDURL}/hasaccess/${folder_id}/`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );
      const data = await res.json();
      if (!data.success) {
        return { result: { hasAccess: false } };
      }
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
      getXwingKeyForFile,
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

    // Pass current_folder_key instead of user_ark!
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

    const res = await fetch(`${config.BACKENDURL}/folders/${parentId}/data`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    
    const data = await res.json();

    if (!data.success) throw new Error("Failed to fetch parent folder data");

    const enc_parent_name_data = hexToBuffer(data.data.encrypted_name_data);
    
    const parentName = new TextDecoder().decode(await decrypt(
      enc_parent_name_data.slice(12),
      expandKeyForName(parentCache.key) as BufferSource,
      enc_parent_name_data.slice(0, 12)
    ));

    return { result: { parentId, parentName } };
  },
  CREATE_FOLDER: async (payload) => {
    if (!current_folder_key || !current_folder_id) {
      throw new Error("Current folder key or id not initialized");
    }

    const folder_name: string = payload.name;
    const parent_folder_id: string = current_folder_id;
    const new_folder_key = await generateMasterKey() as Uint8Array;

    console.log(bufferToHex(new_folder_key as BufferSource));

    const encrypted_folder_key_data_ark = await encrypt(new_folder_key as BufferSource, user_ark as BufferSource);
    const encrypted_folder_key_data_parent = await encrypt(new_folder_key as BufferSource, current_folder_key as BufferSource);

    const encrypted_folder_name_data = await encrypt(folder_name, expandKeyForName(new_folder_key) as BufferSource);

    const new_folder_id = await createFolderForUser(
      concatUint8(encrypted_folder_key_data_ark.nonce, encrypted_folder_key_data_ark.ciphertext),
      concatUint8(encrypted_folder_key_data_parent.nonce, encrypted_folder_key_data_parent.ciphertext),
      parent_folder_id,
      concatUint8(encrypted_folder_name_data.nonce, encrypted_folder_name_data.ciphertext)
    );

    return { result: { success: true, folderId: new_folder_id } };
  },
  SHARE_FILE: async (payload) => {

    const file_id: string = payload.fileId;
    const recipient_username: string = payload.recipientUsername;
    const share_duration: number = payload.share_duration;

    const { recipient_x25519_public, recipient_mlkem_public } = await getUserHybridKeys(recipient_username);

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
    );

    if (!shareData.success) {
      throw new Error("Failed to share file: " + shareData.message);
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

    const { recipient_x25519_public, recipient_mlkem_public } = await getUserHybridKeys(recipient_username);

    const { xwing_key, x25519_ephemeral_public, mlkem_ciphertext } =
      await generateHybridSharedKey(
        recipient_mlkem_public,
        recipient_x25519_public,
      );

    console.log("Xwing key generated for sharing file");

    const encrypted_folder_key_response = await fetch(
      `${config.BACKENDURL}/folders/${folder_id}/encrypted_key`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    ).then(res => res.json());

    if (!encrypted_folder_key_response.success) {
      throw new Error("Failed to fetch encrypted folder key: " + encrypted_folder_key_response.message);
    }

    const { encrypted_key_data } = encrypted_folder_key_response.data;

    const encrypted_folder_key_data = hexToBuffer(encrypted_key_data);
    const enc_folder_key_nonce = encrypted_folder_key_data.slice(0, 12);
    const enc_folder_key_ciphertext = encrypted_folder_key_data.slice(12);

    const folder_key = await decrypt(
      enc_folder_key_ciphertext,
      user_ark as BufferSource,
      enc_folder_key_nonce,
    );

    const encrypted_folder_key = await encrypt(folder_key as BufferSource, xwing_key as BufferSource);
    
    const shareData = await fetch(`${config.BACKENDURL}/folders/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        folder_id,
        recipient_username,
        encrypted_folder_key: bufferToHex(concatUint8(encrypted_folder_key.nonce, encrypted_folder_key.ciphertext) as BufferSource),
        share_duration,
        mlkem_ciphertext: bufferToHex(mlkem_ciphertext as BufferSource),
        x25519_ephemeral_public: bufferToHex(x25519_ephemeral_public as BufferSource),
        permissions,
      }),
    }).then(res => res.json());

    if (!shareData.success) {
      throw new Error("Failed to share folder: " + shareData.message);
    }

    console.log("Folder shared successfully with access id" + shareData.data.folder_access_id);

    return { result: { success: true } };
  },
  DELETE_FOLDER: async (payload) => {
    const folder_id: string = payload.folderId;
    const res = await fetch(`${config.BACKENDURL}/folders/${folder_id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error("Failed to delete folder: " + data.message);
    }
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
    user_rsa_private = null;
    user_mlkem_public = null;
    user_mlkem_private = null;
    user_x25519_public = null;
    user_x25519_private = null;
    user_ark = null;
    current_folder_key = null;
    current_folder_id = null;
    sharedFolderCache.clear();

    sessionFileKeys.clear();

    await fetch(`${config.BACKENDURL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    return { result: { success: true } };
  },
  CLOSE_FILE: async (payload) => {
    const file_id = payload.fileId;

    const entry = sessionFileKeys.get(file_id);
    if (entry) {
      entry.temp_decrypted_file_key = null;
    }

    return { result: { success: true } };
  },
};

let messageQueue: Promise<void> = Promise.resolve();

globalThis.onmessage = (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  messageQueue = messageQueue.then(async () => {
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
  }).catch((queueError) => {
    console.error("Critical worker queue failure:", queueError);
  });
};