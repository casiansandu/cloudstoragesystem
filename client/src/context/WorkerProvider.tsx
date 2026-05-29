import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { WorkerContext } from './WorkerContext';
import type { PromiseHandlers, WorkerContextType, WorkerResponse,  } from './WorkerContext';
import CryptoWorker from './crypto.worker?worker';

export const WorkerProvider = ({ children }: { children: React.ReactNode }) => {
  const workerRef = useRef<Worker | null>(null);
  const promisesRef = useRef<Map<string, PromiseHandlers>>(new Map());

  useEffect(() => {
    console.log("Spawn global crypto worker...");
    workerRef.current = new CryptoWorker();

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, type, result, error } = event.data;
      const handlers = promisesRef.current.get(id);
      if (handlers) {
        if (type === 'SUCCESS') handlers.resolve(result);
        else handlers.reject(new Error(error));
        promisesRef.current.delete(id);
      }
    };

    return () => {
      console.log("Terminating global worker...");
      workerRef.current?.terminate();
    };
  }, []);

  const sendToWorker = useCallback(<T,>(type: string, payload: any, transferables: Transferable[] = []): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) return reject(new Error("Worker not ready"));
      const id = crypto.randomUUID();
      promisesRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({ id, type, payload }, transferables);
    });
  }, []);

  const api = useMemo<WorkerContextType>(() => ({
    fullLogin: (username, password) => 
      sendToWorker('PERFORM_FULL_LOGIN', { username, password }),
    
    generateFileKey: (fileId) => 
      sendToWorker('GENERATE_FILE_KEY', { fileId }),
    
    encryptChunk: (fileId, chunkBuffer, chunkIndex) => 
      sendToWorker('ENCRYPT_CHUNK', { fileId, chunkBuffer, chunkIndex }, [chunkBuffer]),
    
    closeFile: (fileId) => 
      sendToWorker('CLOSE_FILE', { fileId }),

    getFileDecryptedNamesAndIds: (files) =>
      sendToWorker('GET_FILE_DECRYPTED_NAMES_AND_IDS', { files }),

    getSharedFileDecryptedNamesAndIds: (files) =>
      sendToWorker('GET_SHARED_FILE_DECRYPTED_NAMES_AND_IDS', { files }),

    hasAccessToFolder: (folderId) =>
      sendToWorker('HAS_ACCESS_TO_FOLDER', { folderId }),

    getFolderDecryptedNameAndId: (folders) =>
      sendToWorker('GET_FOLDER_NAMES_AND_IDS', { folders }),

    getSharedFiles: () =>
      sendToWorker('GET_SHARED_FILES', { files: [] }),

    getSharedFilesInFolder: (folderId) =>
      sendToWorker('GET_SHARED_FILES_IN_FOLDER', { folderId }),

    getFilesInFolder: (folderId) =>
      sendToWorker('GET_FILES_IN_FOLDER', { folderId }),

    getFoldersInFolder: (folderId) =>
      sendToWorker('GET_FOLDERS_IN_FOLDER', { folderId }),

    getSharedFoldersInFolder: (folderId) =>
      sendToWorker('GET_SHARED_FOLDERS_IN_FOLDER', { folderId }),

    createFolderForUser: ( name ) =>
      sendToWorker('CREATE_FOLDER', { name }),

    setCurrentFolder: (folderId, direction) =>
      sendToWorker('SET_CURRENT_FOLDER', { folderId, direction }),

    deleteFolder: (folderId) =>
      sendToWorker('DELETE_FOLDER', { folderId }),

    getCurrentFolderId: () =>
      sendToWorker('GET_CURRENT_FOLDER_ID', {}),

    uploadFile: (file) =>
      sendToWorker('UPLOAD_FILE', { file }),

    getChunkInfos: (fileId) =>
      sendToWorker('GET_CHUNK_INFOS', { fileId }),

    decryptChunk: (fileId, chunkId, chunkIndex) =>
      sendToWorker('GET_AND_DECRYPT_CHUNK', { fileId, chunkId, chunkIndex }),

    shareFile: (fileId, recipientUsername, share_duration) =>
      sendToWorker('SHARE_FILE', { fileId, recipientUsername, share_duration }),

    shareFolder: (payload) =>
      sendToWorker('SHARE_FOLDER', payload),

    registerUser: (username, email, password) =>
      sendToWorker('REGISTER_USER', { username, email, password}),
    
    getFolderParentIdAndName: (folderId) =>
      sendToWorker('GET_FOLDER_PARENT_ID_AND_NAME', { folderId }),

    getSharedFolderParentIdAndName: (folderId) =>
      sendToWorker('GET_SHARED_FOLDER_PARENT_ID_AND_NAME', { folderId }),

    logoutUser: () =>
      sendToWorker('LOGOUT_USER', {}),

    getPermissionsForFolder: (folderId) =>
      sendToWorker('GET_PERMISSIONS_FOR_FOLDER', { folderId }),

    getSharedFolders: () =>
      sendToWorker('GET_SHARED_FOLDERS', {}),

    getSharedFolderDecryptedNamesAndIds: (folders) =>
      sendToWorker('GET_SHARED_FOLDER_DECRYPTED_NAMES_AND_IDS', { folders }),

    getSharedFolderDecryptedNamesAndIdsInFolder: (folders) =>
      sendToWorker('GET_SHARED_FOLDER_DECRYPTED_NAMES_AND_IDS_IN_FOLDER', { folders }),


  }), [sendToWorker]);

  return (
    <WorkerContext.Provider value={api}>
      {children}
    </WorkerContext.Provider>
  );
};