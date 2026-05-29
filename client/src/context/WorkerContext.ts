import { createContext, useContext } from 'react';
import type { EncryptedUserFileNoKey, EncryptedUserFolder, FolderPermissions, UserFile } from '../utils/apiTypes';

export type WorkerResponse = { id: string; type: 'SUCCESS' | 'ERROR'; result?: any; error?: string };
export type PromiseHandlers = { resolve: (value: any) => void; reject: (reason?: any) => void };

export interface WorkerContextType {
  fullLogin: (username: string, password: string) => Promise<{ success: boolean }>;
  generateFileKey: (fileId: string) => Promise<{ wrappedKeyBuffer: ArrayBuffer }>;
  encryptChunk: (fileId: string, chunkBuffer: ArrayBuffer, chunkIndex: number) => Promise<{ iv: Uint8Array, ciphertext: Uint8Array }>;
  closeFile: (fileId: string) => Promise<void>;
  //getFileKeys: () => Promise<{ success: boolean }>;
  uploadFile: (file: File) => Promise<{ success: boolean }>;
  getChunkInfos: (fileId: string) => Promise<{ fileSize: number, chunks: { id: string, index: number, ciphertextLength: number }[] }>;

  createFolderForUser: (name: string) => Promise<{ success: boolean, folderId: string }>;
  deleteFolder: (folderId: string) => Promise<{ success: boolean }>;

  getFileDecryptedNamesAndIds: (files: EncryptedUserFileNoKey[]) => Promise<{files: UserFile[]}>;
  getFilesInFolder: (folderId: string) => Promise<{ files: EncryptedUserFileNoKey[] }>;

  getFoldersInFolder: (folderId: string) => Promise<{ folders: EncryptedUserFolder[] }>;
  getSharedFolders: () => Promise<{ folders: EncryptedUserFolder[] }>;
  getSharedFoldersInFolder: (folderId: string) => Promise<{ folders: EncryptedUserFolder[] }>;
  getFolderDecryptedNameAndId: (folders: EncryptedUserFolder[]) => Promise<{ folders: { id: string, name: string }[] }>;
  hasAccessToFolder: (folderId: string) => Promise<{ hasAccess: boolean }>;
  getSharedFolderDecryptedNamesAndIds: (folders: EncryptedUserFolder[]) => Promise<{ folders: { id: string, name: string }[] }>;
  getSharedFolderDecryptedNamesAndIdsInFolder: (folders: EncryptedUserFolder[]) => Promise<{ folders: { id: string, name: string }[] }>;

  setCurrentFolder: (folderId: string, direction: "up" | "down" | "up_shared" | "down_shared") => Promise<{ success: boolean }>;
  getCurrentFolderId: () => Promise<{ folderId: string }>;

  getFolderParentIdAndName: (folderId: string) => Promise<{ parentId: string, parentName: string }>;
  getSharedFolderParentIdAndName: (folderId: string) => Promise<{ parentId: string, parentName: string }>;

  decryptChunk: (fileId: string, chunkId: string, chunkIndex: number) => Promise<{ decryptedChunk: Uint8Array}>;
  shareFile: (fileId: string, recipientUsername: string, share_duration: number) => Promise<{ success: boolean }>;
  shareFolder: (payload: {
    folderId: string;
    recipientUsername: string;
    shareDuration: number;
    permissions: FolderPermissions;
  }) => Promise<{ success: boolean }>;
  registerUser: (username: string, email: string, password: string) => Promise<{ success: boolean }>;
  logoutUser: () => Promise<{ success: boolean }>;

  getSharedFiles: () => Promise<{ files: EncryptedUserFileNoKey[] }>;
  getSharedFilesInFolder: (folderId: string) => Promise<{ files: EncryptedUserFileNoKey[] }>;
  getSharedFileDecryptedNamesAndIds: (files: EncryptedUserFileNoKey[]) => Promise<{ files: UserFile[] }>;
  getPermissionsForFolder: (folderId: string) => Promise<{ permissions: FolderPermissions }>;
}
export const WorkerContext = createContext<WorkerContextType | null>(null);

export const useGlobalWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) throw new Error("useGlobalWorker must be used within a WorkerProvider");
  return context;
};