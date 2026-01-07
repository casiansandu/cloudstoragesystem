import { createContext, useContext } from 'react';
import type { UserFile } from '../utils/apiTypes';

export type WorkerResponse = { id: string; type: 'SUCCESS' | 'ERROR'; result?: any; error?: string };
export type PromiseHandlers = { resolve: (value: any) => void; reject: (reason?: any) => void };

export interface WorkerContextType {
  fullLogin: (username: string, password: string) => Promise<{ success: boolean }>;
  generateFileKey: (fileId: string) => Promise<{ wrappedKeyBuffer: ArrayBuffer }>;
  encryptChunk: (fileId: string, chunkBuffer: ArrayBuffer, chunkIndex: number) => Promise<{ iv: Uint8Array, ciphertext: Uint8Array }>;
  closeFile: (fileId: string) => Promise<void>;
  getFileKeys: () => Promise<{ success: boolean }>;
  getFileNames: (files: UserFile[]) => Promise<{files: UserFile[]}>;
  uploadFile: (file: File) => Promise<{ success: boolean }>;
  getChunkInfos: (fileId: string) => Promise<{ fileSize: number, chunks: { id: string, index: number, ciphertextLength: number }[] }>;
  decryptChunk: (fileId: string, chunkId: string, chunkIndex: number) => Promise<{ decryptedChunk: Uint8Array}>;
  shareFile: (fileId: string, recipientUsername: string) => Promise<{ success: boolean }>;
}
export const WorkerContext = createContext<WorkerContextType | null>(null);

export const useGlobalWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) throw new Error("useGlobalWorker must be used within a WorkerProvider");
  return context;
};