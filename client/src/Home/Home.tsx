import config from "../../config/config"
import { useCallback, useEffect, useState } from "react";
import UploadFileButton from "../components/UploadFileButton";
import type { GetAllUserFilesResponse, UserFile, ManifestData } from "../utils/apiTypes";
import { LogoutButton } from "../components/LogoutButton";
import { decrypt, decryptRSA, deriveChunkKey, hexToBuffer } from "../../utils/crypto";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { gen_uuidv5 } from "../utils/funcs";
import { sha256 } from "js-sha256";
import streamSaver from 'streamSaver';

const getFiles = async () => {
  try {
    const res = await fetch(`${config.BACKENDURL}/files/all`, {
      method: "GET",
      credentials: "include"
    });
    const data: GetAllUserFilesResponse = await res.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    console.log("Fetched files:", data.data);
    return data;
  } catch (error) {
    console.error("Error fetching files:", error);
    return;
  }
}

const fetchChunk = async (uuid: string) => {

  const res = await fetch(`${config.BACKENDURL}/files/chunk/${uuid}`, {
    method: "GET",
    credentials: "include"
  });

  return (await res.arrayBuffer());
}




const downloadFile = async (file_id: string, file_name: string) => {
  console.log("Download initiated for file:", file_id);

  const manifest_name = sha256(file_id + "manifest");
  
  const manifest_data = await fetchChunk(gen_uuidv5(manifest_name));

  const wrapped_key = manifest_data.slice(0, 256);
  const enc_manifest_nonce = manifest_data.slice(256, 256 + 12);
  const enc_manifest_ciphertext = manifest_data.slice(256 + 12);
  const manifest_key = await decryptRSA(
    wrapped_key,
    hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
  );

  const manifest = (await decrypt(
    enc_manifest_ciphertext,
    manifest_key as BufferSource,
    enc_manifest_nonce
  ));

  const manifest_json: ManifestData = JSON.parse(new TextDecoder().decode(manifest));

  console.log("Manifest data:", manifest_json);

  const file_key = await decryptRSA(
    hexToBuffer(manifest_json.encryptedFileKey) as BufferSource,
    hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
  );

  const fileStream = streamSaver.createWriteStream(file_name);
  const writer = fileStream.getWriter();

  for (let chunkInfo of manifest_json.chunkInfos) {

    const chunk_data = await fetchChunk(chunkInfo.id);

    const chunk_key = await deriveChunkKey(
      file_key as BufferSource,
      chunkInfo.index,
      manifest_json.file_id
    );

    const chunk_nonce = chunk_data.slice(0, 12);
    const chunk_ciphertext = chunk_data.slice(12);

    const decrypted_chunk = await decrypt(
      chunk_ciphertext,
      chunk_key,
      chunk_nonce
    );

    await writer.write(decrypted_chunk);

    //console.log(`Downloaded and decrypted chunk ${chunkInfo.index}, 
    // size: ${decrypted_chunk.byteLength} bytes: `, decrypted_chunk);
    
  }
  await writer.close();
  console.log("[Download] Download complete successfully.");

}

export const Home = () => {

  const [files, setFiles] = useState<UserFile[]>([]);
  const [authError, setAuthError] = useState<boolean>(false);

  useEffect(() => {

    refreshFiles()
  }, []);

  const navigate = useNavigate();

  const refreshFiles = useCallback(async () => {

    const dir_key = sessionStorage.getItem("decrypted_directory_key");
  
    if (!dir_key) {
      await fetch(`${config.BACKENDURL}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      navigate("/login");
      setAuthError(true);
      return;
    }

    try {
      const data: GetAllUserFilesResponse | undefined = await getFiles();
      if (!data) {
        setFiles([]);
        return;
      }
      
      if (!data.success) {
        throw new Error(data.message);
      }

      const rawFiles = data.data.files;

      const directoryKeyBuffer = hexToBuffer(dir_key) as BufferSource;

      const decryptedFilesPromise = rawFiles.map(async (file) => {
        try {
          const enc_name_data = hexToBuffer(file.name);
          const nonce = enc_name_data.slice(0, 12);
          const ciphertext = enc_name_data.slice(12);

          const decrypted_name_buffer = await decrypt(
            ciphertext,
            directoryKeyBuffer,
            nonce
          );
          
          const decryptedName = new TextDecoder().decode(decrypted_name_buffer);
          return { ...file, id: file.id, name: decryptedName };
        } catch (error) {
          console.error("Decryption failed for:", file.name , error);
          return file; 
        }
      });

      const finalFiles = await Promise.all(decryptedFilesPromise);
      setFiles(finalFiles);

    } catch (error) {
      console.error("Error refreshing files:", error);
    }
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '20px' }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <LogoutButton />
      </div>
      <h1>List of stored files</h1>
      { authError ? (
        <p style={{ color: 'red' }}>Authentication error. Please log in again.</p>
      ) :
      files?.length === 0 ? (
        <p>No files found.</p>
      ) : (
        <ul>
          {
          files.map((file) => (
            <li key={file.id}>
              <Button func={async () => await downloadFile(file.id, file.name)}>{file.name}</Button>
            </li>
          ))}
        </ul>
      )}
      <UploadFileButton onUploadSuccess={refreshFiles} />
    </div>
  );
}
