import config from "../../config/config";
import { useCallback, useEffect, useState, useRef } from "react";
import UploadFileButton from "../components/UploadFileButton";
import type { EncryptedUserFileNoKey, EncryptedUserFolder, UserFile, UserFolder } from "../utils/apiTypes";
import { LogoutButton } from "../components/LogoutButton";
import { useNavigate } from "react-router-dom";
import { verifyOwnership, hasAccess } from "../components/DownloadFileFeature/downloadFile";
import FileRow from "../components/FileRow";
import FileActionsBar from "../components/FileActionsBar";
import deleteFile from "../components/DeleteFileFeature/deleteFile";
import SharePopup from "../components/SharePopup";
import { useGlobalWorker } from "../context/WorkerContext";
import streamSaver from "streamSaver";
import CreateFolderButton from "../components/CreateFolderButton";

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
  const didInitRef = useRef(false);
  
  const [currentFolderParent, setCurrentFolderParent] = useState<UserFolder>({ id: "", name: "" });
  const [currentFolder, setCurrentFolder] = useState<UserFolder>({ id: "", name: "root" });
  const [activeFile, setActiveFile] = useState<UserFile>({ id: "", name: "" });
  const [files, setFiles] = useState<UserFile[]>([]);
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [authError, setAuthError] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [shareButtonPressed, setShareButtonPressed] = useState<boolean>(false);
  const [shareMultiple, setShareMultiple] = useState<boolean>(false);

  const navigate = useNavigate();

  const handleNavigateDown = async (folderId: string, folderName: string) => {
    const nextFolder = { id: folderId, name: folderName };

    await worker.setCurrentFolder(folderId);
    
    setCurrentFolderParent(currentFolder);
    setCurrentFolder(nextFolder);
    
    await refreshFiles(folderId);
}

  const handleNavigateUp = async () => {
    await worker.setCurrentFolder(currentFolderParent.id);

    setCurrentFolder(currentFolderParent);
    const parentResult = (await worker.getFolderParentIdAndName(currentFolderParent.id));
    setCurrentFolderParent({ id: parentResult.parentId, name: parentResult.parentName });

    await refreshFiles(currentFolderParent.id);
  }

  const refreshFiles = useCallback(async (folderId: string) => {

    try {
      const filesData: EncryptedUserFileNoKey[] = (await worker.getFilesInFolder(folderId)).files;
      const decryptedFileNamesWithIds: UserFile[] = ((await worker.getFileDecryptedNamesAndIds(filesData)).files);

      const parentResult = (await worker.getFolderParentIdAndName(folderId));
      if (parentResult.parentId == "") {
        const sharedFilesData: EncryptedUserFileNoKey[] = (await worker.getSharedFiles()).files;
        console.log("Shared files data:", sharedFilesData);
        if (sharedFilesData.length > 0) {
          const decryptedSharedFileNamesWithIds: UserFile[] = ((await worker.getSharedFileDecryptedNamesAndIds(sharedFilesData)).files);
          if (decryptedSharedFileNamesWithIds.length > 0) {
            decryptedFileNamesWithIds.push(...decryptedSharedFileNamesWithIds);
          }
        }
      }
      setFiles(decryptedFileNamesWithIds);

      const foldersData: EncryptedUserFolder[] = (await worker.getFoldersInFolder(folderId)).folders;
      const decryptedFolderNamesWithIds: UserFolder[] = ((await worker.getFolderDecryptedNameAndId(foldersData)).folders);

      setFolders(decryptedFolderNamesWithIds);
    } catch (error) {
      console.error("Error refreshing files:", error);
    }
  }, [worker]);

  useEffect(() => {

    let isMounted = true;

    const verifyAndLoad = async () => {
      const isAuthenticated = await getAuth();

      if (!isMounted) return;

      if (isAuthenticated) {
        try {
          const rootFolderId = await worker.getCurrentFolderId();
          if (!isMounted) return;

          if (rootFolderId.folderId) {
            console.log("Current folder ID on initial load:", rootFolderId.folderId);
            setCurrentFolder({ id: rootFolderId.folderId, name: "root" });
            refreshFiles(rootFolderId.folderId);
          } else {
            console.warn("No current folder ID found on initial load");
          }
        } catch (error) {
          console.error("Error fetching current folder ID on initial load:", error);
        }
      } else {
        setAuthError(true);
        navigate("/login");
      }
    };

    verifyAndLoad();

    return () => { isMounted = false; };
  }, [navigate, refreshFiles, worker]); // dependency

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
  if (!currentFolder.id) {
      return alert("Current folder not loaded. Please log out and try again.");
  }

  if (globalThis.confirm(`Are you sure you want to delete ${file.name}?`)) {
      try {
        await verifyOwnership(file.id);
        await deleteFile(file.id);

        refreshFiles(currentFolder.id);
        handleClearSelection();
      } catch (error) {
        console.error("Error deleting file:", error);
        alert("Failed to delete file: " + (error as Error).message);
      }
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
    if (!currentFolder.id) {
      return alert("Current folder not loaded. Please log out and try again.");
    }

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
      refreshFiles(currentFolder.id);
      handleClearSelection();
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
      alert("File shared successfully.");
    } catch (error) {
      console.error("Error sharing file:", error);
      alert("Failed to share file: " + (error as Error).message);
    }
    setShareButtonPressed(false);
  };

  const handleBulkShare = async () => {
    for (const fileId of selectedFiles) {
      try {
        await verifyOwnership(fileId);

        const username = usernameShareRef.current?.value;
        let share_duration = Number(shareDurationRef.current?.value);

        if (share_duration < 0) {
          return alert("Please enter a valid sharing period in days");
        } else share_duration ??= 0;
        if (!username) return alert("Please enter a username");

        console.log(`Sharing ${selectedFiles.size} files to ${username}`);

        await worker.shareFile(fileId, username, share_duration);
        alert("File shared successfully.");
      } catch (error) {
        console.error("Error sharing file:", error);
        alert("Failed to share file ID " + fileId + ": " + (error as Error).message);
      }
    }
    handleClearSelection();
    setShareButtonPressed(false);
  };


  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '20px' }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <LogoutButton />
      </div>
      <h1>List of stored files {currentFolder.name ? `- ${currentFolder.name}` : ''}</h1>
      { authError ? (
        <p style={{ color: 'red' }}>Authentication error. Please log in again.</p>
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

            {folders.map((folder) => (
              <FileRow 
                key={folder.id} 
                file={{ id: folder.id, name: folder.name }} 
                isFolder={true}
                isSelected={false} 
                onSelect={() => {}}
                onNavigate={(id) => handleNavigateDown(id, folder.name)}
              />
            ))}

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
            
            {currentFolderParent.id && (
                 <div className="file-row" onClick={() => handleNavigateUp()} style={{cursor: 'pointer'}}> 
                    <div className="file-name" style={{ paddingLeft: '40px' }}>..</div>
                 </div>
            )}

            {files?.length === 0 && folders?.length === 0 && (
              <p>No files found.</p>
            )}
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
      <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
        <CreateFolderButton currentFolderId={currentFolder.id} onFolderCreated={() => refreshFiles(currentFolder.id)} />
        <UploadFileButton onUploadSuccess={() => refreshFiles(currentFolder.id)} />
      </div>
    </div>
  );
}
