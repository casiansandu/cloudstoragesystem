import config from "../../config/config"
import { useCallback, useEffect, useState, useRef } from "react";
import UploadFileButton from "../components/UploadFileButton";
import type { GetAllUserFilesResponse, UserFile } from "../utils/apiTypes";
import { LogoutButton } from "../components/LogoutButton";
import { decrypt, hexToBuffer, bufferToHex, decryptRSA } from "../../utils/crypto";
import { useNavigate } from "react-router-dom";
import { downloadFile, verifyOwnership, getManifestData, hasAccess } from "../components/DownloadFileFeature/downloadFile";
import FileRow from "../components/FileRow";
import FileActionsBar from "../components/FileActionsBar";
import deleteFile from "../components/DeleteFileFeature/deleteFile";
import shareFile from "../components/ShareFileFeature/shareFile";
import SharePopup from "../components/SharePopup";

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

const getAuth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${config.BACKENDURL}/auth/status`, {
      method: "GET",
      credentials: "include"
    });
    
    if (!res.ok) return false; 

    const data = await res.json();
    return data.data?.isAuthenticated === true;
  } catch (error) {
    console.error("Auth check failed:", error);
    return false;
  }
}

const getFileKey = async (file_id: string): Promise<string> => {
  await hasAccess(file_id);

  const res = await fetch(`${config.BACKENDURL}/files/${file_id}/key`, {
    method: "GET",
    credentials: "include"
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error("Failed to get file key: " + data.message);
  }
  
  return data.data.encrypted_master_key;
}

export const Home = () => {

  const usernameShareRef = useRef<HTMLInputElement>(null);
  
  const [activeFile, setActiveFile] = useState<UserFile>({ id: "", name: "" });
  const [files, setFiles] = useState<UserFile[]>([]);
  const [authError, setAuthError] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [shareButtonPressed, setShareButtonPressed] = useState<boolean>(false);
  const [shareMultiple, setShareMultiple] = useState<boolean>(false);

  const navigate = useNavigate();

  const refreshFiles = useCallback(async () => {

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

      const decryptedFilesPromise = rawFiles.map(async (file) => {
        try {
          const encrypted_file_master_key = await getFileKey(file.id);

          const file_master_key = bufferToHex(await decryptRSA(
            hexToBuffer(encrypted_file_master_key) as BufferSource,
            hexToBuffer(globalThis.sessionStorage.getItem("decrypted_private_key")!) as BufferSource
          ) as BufferSource);

          const masteryKeyBuffer = hexToBuffer(file_master_key) as BufferSource;

          const enc_name_data = hexToBuffer(file.name);
          const nonce = enc_name_data.slice(0, 12);
          const ciphertext = enc_name_data.slice(12);

          const decrypted_name_buffer = await decrypt(
            ciphertext,
            masteryKeyBuffer,
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


  useEffect(() => {
    let isMounted = true;

    const verifyAndLoad = async () => {
      
      const isAuthenticated = await getAuth();

      if (!isMounted) return;

      if (!isAuthenticated) {
        setAuthError(true);
        navigate("/login");
      } else {
        refreshFiles();
      }
    };

    verifyAndLoad();

    return () => { isMounted = false; };
  }, [navigate]); // navigate is a dependency

  // Optional: Prevent the UI from flashing before redirect
  if (authError) return null;


  

  const handleSelect = (id: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedFiles(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedFiles(new Set());
  };

  const handleDownload = async (file: UserFile) => {
    await downloadFile(file.id, file.name);
  };

  const handleDelete = async (file: UserFile) => {
    if (globalThis.confirm(`Are you sure you want to delete ${file.name}?`)) {
        await verifyOwnership(file.id);
        await deleteFile(file.id);

        refreshFiles();
        handleClearSelection();
    }
  };

  const handleBulkDownload = async () => {
    const filesToDownload = files.filter(f => selectedFiles.has(f.id));
    for (const file of filesToDownload) {
      await verifyOwnership(file.id);

      await downloadFile(file.id, file.name);
    }
    handleClearSelection();
  };

  const handleBulkDelete = async () => {
    if (globalThis.confirm(`Are you sure you want to delete ${selectedFiles.size} files?`)) {
      const filesToDelete = files.filter(f => selectedFiles.has(f.id));
      console.log("Deleting files:", filesToDelete);
      for (const file of filesToDelete) {
        await deleteFile(file.id);
      }
      refreshFiles();
      handleClearSelection();
    }
  };

  const handleShare = async () => {

    await verifyOwnership(activeFile.id);

    const username = usernameShareRef.current?.value;
    if (!username) return alert("Please enter a username");

    console.log(`Sharing file ${activeFile.id} to ${username}`);
    await shareFile(activeFile.id, username);
    
  };

  const handleBulkShare = async () => {
    const username = usernameShareRef.current?.value;
    if (!username) return alert("Please enter a username");

    console.log(`Sharing ${selectedFiles.size} files to ${username}`);
    for (const fileId of selectedFiles) {
      await shareFile(fileId, username);
    }
    
    handleClearSelection();
  };


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
        <div>
          <FileActionsBar 
            selectedCount={selectedFiles.size}
            onDownload={handleBulkDownload}
            onDelete={handleBulkDelete}
            onShare={() => { setShareMultiple(true); setShareButtonPressed(true); }}
            onClearSelection={handleClearSelection}
          />
          <div className="file-list">
            {files.map((file) => (
              <FileRow 
                key={file.id} 
                file={file} 
                isSelected={selectedFiles.has(file.id)} 
                onSelect={handleSelect}
                onDownload={handleDownload}
                onShare={() => { setActiveFile(file); setShareMultiple(false); setShareButtonPressed(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>

          <SharePopup triggered={shareButtonPressed} multiple={shareMultiple} onClose={() => setShareButtonPressed(false)}>
                <h3>
                  Share files
                </h3>
                <form onSubmit={(e) => {e.preventDefault();}}>
                  <label>
                    Recipient Username:
                    <input type="text" name="username" ref={usernameShareRef} />
                  </label>
                  <button type="submit" onClick={shareMultiple ? handleBulkShare : handleShare}>Share</button>
                </form>
          </SharePopup>

        </div>
      )}
      <UploadFileButton onUploadSuccess={refreshFiles} />
    </div>
  );
}
