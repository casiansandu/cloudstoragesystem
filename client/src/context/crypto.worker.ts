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
  getFolderNamesAndIds,
  getFolderParentIdAndName,
  getFoldersInFolder,
} from "./worker/folderHandlers";
import {
  getAndDecryptChunk,
  getChunkInfos,
  getFilesInFolder,
  getSharedFiles,
} from "./worker/fileHandlers";
import {
  generateHybridSharedKey,
  getUserHybridKeys,
  getXwingKeyForFile as getXwingKeyForFileExternal,
} from "./worker/shareCrypto";
import {
  performFullLogin,
  registerUser,
  type UserStateUpdate,
} from "./worker/authHandlers";
import { uploadFile } from "./worker/uploadHandlers";

let user_rsa_private: CryptoKey | null = null;
let user_mlkem_public: Uint8Array | null = null;
let user_mlkem_private: Uint8Array | null = null;

let user_x25519_public: Uint8Array | null = null;
let user_x25519_private: Uint8Array | null = null;

let current_folder_key: Uint8Array | null = null;
let current_folder_id: string | null = null;
let user_ark: Uint8Array | null = null;

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
      console.log(1, { current_folder_id, current_folder_key });
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

    if (folder_id === current_folder_id) {
      return { result: { success: true } };
    }

    current_folder_id = folder_id;

    const res = await fetch(
      `${config.BACKENDURL}/folders/${folder_id}/data`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    const data = await res.json();

    if (!data.success) {
      throw new Error("Failed to fetch folder key data: " + data.message);
    }

    const enc_folder_key_data = hexToBuffer(data.data.encrypted_key_data);
    const enc_folder_key_nonce = enc_folder_key_data.slice(0, 12);
    const enc_folder_key_ciphertext = enc_folder_key_data.slice(12);

    current_folder_key = await decrypt(
      enc_folder_key_ciphertext,
      user_ark as BufferSource,
      enc_folder_key_nonce,
    );

    return { result: { success: true } };
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
  GET_FOLDER_NAMES_AND_IDS: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const raw_folder_data: EncryptedUserFolder[] = payload.folders;

    if (!raw_folder_data || raw_folder_data.length === 0) {
      return { result: { folders: [] } };
    }

    if (!user_ark) {
      throw new Error("User ark not initialized");
    }

    const folders = await getFolderNamesAndIds(
      raw_folder_data,
      user_ark,
    );

    return { result: { folders } };
  },
  GET_SHARED_FILES: async () => {
    const files = await getSharedFiles(sessionFileKeys);

    return { result: { files } };
  },
  CREATE_FOLDER: async (payload) => {
    if (!current_folder_key) {
      throw new Error("Current folder key not initialized");
    }

    const folder_name: string = payload.name;
    const parent_folder_id: string | null = current_folder_id;
    const new_folder_key = await generateMasterKey() as Uint8Array;

    const encrypted_folder_key_data = await encrypt(new_folder_key as BufferSource, user_ark as BufferSource);
    const encrypted_folder_name_data = await encrypt(folder_name, new_folder_key as BufferSource);

    const new_folder_id = await createFolderForUser(
      concatUint8(encrypted_folder_key_data.nonce, encrypted_folder_key_data.ciphertext),
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

    console.log("Xwing key generated for sharing");

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
  GET_CURRENT_FOLDER_ID: async () => {
    if (!current_folder_id) {
      console.log(2, { current_folder_id });
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