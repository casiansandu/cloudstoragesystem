import config from "../../config/config"
import { useCallback, useEffect, useState, useRef } from "react";
import UploadFileButton from "../components/UploadFileButton";
import type { GetAllUserFilesResponse, UserFile, UserFolder } from "../utils/apiTypes";
import { LogoutButton } from "../components/LogoutButton";
import { useNavigate } from "react-router-dom";
import { verifyOwnership, hasAccess } from "../components/DownloadFileFeature/downloadFile";
import FileRow from "../components/FileRow";
import FileActionsBar from "../components/FileActionsBar";
import deleteFile from "../components/DeleteFileFeature/deleteFile";
import SharePopup from "../components/SharePopup";
import { useGlobalWorker } from "../context/WorkerContext";
import streamSaver from "streamSaver";

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


export const Home = () => {

  const worker = useGlobalWorker();

  const usernameShareRef = useRef<HTMLInputElement>(null);
  const shareDurationRef = useRef<HTMLInputElement>(null);
  
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

      const decryptedFiles = await worker.getFileNames(rawFiles);

      const finalFiles = decryptedFiles.files;
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

      if (isAuthenticated) {
        refreshFiles();
      } else {
        setAuthError(true);
        navigate("/login");
      }
    };

    verifyAndLoad();

    return () => { isMounted = false; };
  }, [navigate]); // dependency

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
    try {
      await hasAccess(file.id);

      const manifest_data = (await worker.getChunkInfos(file.id));
      const chunk_infos = manifest_data.chunks;
      const file_size = manifest_data.fileSize;

      const fileStream = streamSaver.createWriteStream(file.name, {
        size:file_size
      });
      const writer = fileStream.getWriter();

      for (const chunkInfo of chunk_infos) {
        const decryption_res = await worker.decryptChunk(file.id, chunkInfo.id, chunkInfo.index);

        await writer.write(decryption_res.decryptedChunk);
      }

      await writer.close();
      await worker.closeFile(file.id);
      console.log("[Download] Download complete successfully.");
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file: " + (error as Error).message);
    }
    
  };

  const handleDelete = async (file: UserFile) => {
  if (globalThis.confirm(`Are you sure you want to delete ${file.name}?`)) {
      try {
        await verifyOwnership(file.id);
        await deleteFile(file.id);

        refreshFiles();
        handleClearSelection();
      } catch (error) {
        console.error("Error deleting file:", error);
        alert("Failed to delete file: " + (error as Error).message);
      }
    }
  };

  const handleShare = async () => {

    try {
      await verifyOwnership(activeFile.id);

      const username = usernameShareRef.current?.value;
      let share_duration = Number(shareDurationRef.current?.value);

      if (share_duration < 0) {
        return alert("Please enter a valid sharing period in days");
      } else share_duration ??= 0;

      if (!username) return alert("Please enter a username");

      console.log(`Sharing file ${activeFile.id} to ${username}`);

      await worker.shareFile(activeFile.id, username, share_duration);
    } catch (error) {
      console.error("Error sharing file:", error);
      alert("Failed to share file: " + (error as Error).message);
    }
  };

  const handleBulkDownload = async () => {
    const filesToDownload = files.filter(f => selectedFiles.has(f.id));
    for (const file of filesToDownload) {
      try {
        await handleDownload(file);
      } catch (error) {
        console.error("Error downloading file:", error);
        alert("Failed to download file " + file.name + ": " + (error as Error).message);
      }
    }
    handleClearSelection();
  };

  const handleBulkDelete = async () => {
    if (globalThis.confirm(`Are you sure you want to delete ${selectedFiles.size} files?`)) {
      const filesToDelete = files.filter(f => selectedFiles.has(f.id));
      console.log("Deleting files:", filesToDelete);
      for (const file of filesToDelete) {
        try {
          await verifyOwnership(file.id);
          await deleteFile(file.id);
        } catch (error) {
          console.error("Error deleting file:", error);
          alert(`Failed to delete file ${file.name}: ` + (error as Error).message);
        }
      }
      refreshFiles();
      handleClearSelection();
    }
  };

  const handleBulkShare = async () => {
    const username = usernameShareRef.current?.value;
    let share_duration = Number(shareDurationRef.current?.value);

    if (share_duration < 0) {
      return alert("Please enter a valid sharing period in days");
    } else share_duration ??= 0;
    if (!username) return alert("Please enter a username");

    console.log(`Sharing ${selectedFiles.size} files to ${username}`);
    for (const fileId of selectedFiles) {
      try {
        await verifyOwnership(fileId);

        await worker.shareFile(fileId, username, share_duration);
      } catch (error) {
        console.error("Error sharing file:", error);
        alert("Failed to share file ID " + fileId + ": " + (error as Error).message);
      }
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label>
                      Recipient Username:
                      <input type="text" name="username" ref={usernameShareRef} style={{ display: 'block', width: '100%' }} />
                    </label>
                    <label>
                      Period (days):
                      <input type="number" name="period" ref={shareDurationRef} style={{ display: 'block', width: '100%' }} />
                    </label>
                  </div>
                  <button type="submit" onClick={shareMultiple ? handleBulkShare : handleShare} style={{ marginTop: '10px' }}>Share</button>
                </form>
          </SharePopup>

        </div>
      )}
      <UploadFileButton onUploadSuccess={refreshFiles} />
    </div>
  );
}
