import config from "../../config/config";
import { useCallback, useEffect, useState } from "react";
import UploadFileButton from "../components/UploadFileButton";
import type { EncryptedUserFileNoKey, EncryptedUserFolder, FolderPermissions, UserFile, UserFolder } from "../utils/apiTypes";
import { LogoutButton } from "../components/LogoutButton";
import { useNavigate } from "react-router-dom";
import { verifyOwnership, hasAccess } from "../components/DownloadFileFeature/downloadFile";
import FileActionsBar from "../components/FileActionsBar";
import deleteFile from "../components/DeleteFileFeature/deleteFile";
import { useGlobalWorker } from "../context/WorkerContext";
import streamSaver from "streamSaver";
import CreateFolderButton from "../components/CreateFolderButton";
import FileList from "./FileList";
import FolderList from "./FolderList";
import ShareFilePopup from "./ShareFilePopup";
import ShareFolderPopup, { type FolderSharePermissions } from "./ShareFolderPopup";
import VirtualRootFolders from "./VirtualRootFolders";

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

  const [currentFolderParent, setCurrentFolderParent] = useState<UserFolder>({ id: "", name: "" });
  const [currentFolder, setCurrentFolder] = useState<UserFolder>({ id: "", name: "root" });
  const [activeFile, setActiveFile] = useState<UserFile>({ id: "", name: "" });
  const [activeFolder, setActiveFolder] = useState<UserFolder>({ id: "", name: "" });
  const [files, setFiles] = useState<UserFile[]>([]);
  const [sharedFiles, setSharedFiles] = useState<UserFile[]>([]);
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [sharedFolders, setSharedFolders] = useState<UserFolder[]>([]);
  const [authError, setAuthError] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [shareButtonPressed, setShareButtonPressed] = useState<boolean>(false);
  const [shareMultiple, setShareMultiple] = useState<boolean>(false);
  const [shareFolderPopupOpen, setShareFolderPopupOpen] = useState<boolean>(false);
  const [rootView, setRootView] = useState<"root" | "personal" | "shared">("root");
  const [sharedFolderPermissions, setSharedFolderPermissions] = useState<FolderPermissions | null>(null);
  const [personalRootFolder, setPersonalRootFolder] = useState<UserFolder>({ id: "", name: "root" });

  const navigate = useNavigate();

  // 🚨 Make it async
  const resetToVirtualRootState = useCallback(async () => {
    setRootView("root");
    setCurrentFolderParent({ id: "", name: "" });
    setCurrentFolder({ id: personalRootFolder.id, name: "root" });
    setActiveFile({ id: "", name: "" });
    setActiveFolder({ id: "", name: "" });
    setFiles([]);
    setFolders([]);
    setSharedFiles([]);
    setSharedFolders([]);
    setSelectedFiles(new Set());
    setSelectedFolderId("");
    setShareButtonPressed(false);
    setShareMultiple(false);
    setShareFolderPopupOpen(false);
    setSharedFolderPermissions(null);

    if (personalRootFolder.id) {
      await worker.setCurrentFolder(personalRootFolder.id, "up");
    }
  }, [personalRootFolder.id, worker]);
  const handleNavigateDown = async (folderId: string, folderName: string) => {
    const nextFolder = { id: folderId, name: folderName };

    await worker.setCurrentFolder(folderId, "down");
    
    setCurrentFolderParent(currentFolder);
    setCurrentFolder(nextFolder);
    setSelectedFiles(new Set());
    setSelectedFolderId("");
    
    await refreshFiles(folderId);
  }

  const handleNavigateUp = async () => {
    if (!currentFolderParent.id && rootView !== "root") {
      await resetToVirtualRootState();
      return;
    }

    const targetFolderId = currentFolderParent.id;
    const targetFolderName = currentFolderParent.name;

    await worker.setCurrentFolder(targetFolderId, "up");

    const parentResult = await worker.getFolderParentIdAndName(targetFolderId);
    
    setCurrentFolder({ id: targetFolderId, name: targetFolderName });
    setCurrentFolderParent({ id: parentResult.parentId, name: parentResult.parentName });
    setSelectedFiles(new Set());
    setSelectedFolderId("");

    await refreshFiles(targetFolderId);
  }


const handleNavigateDownShared = async (folderId: string, folderName: string) => {
    const nextFolder = { id: folderId, name: folderName };

    await worker.setCurrentFolder(folderId, "down_shared");
    
    setCurrentFolderParent(currentFolder);
    setCurrentFolder(nextFolder);
    setSelectedFiles(new Set());
    setSelectedFolderId("");
    
    await refreshSharedFiles(folderId);
  }

  const handleNavigateUpShared = async () => {
    if (rootView === "shared" && !currentFolder.id) {
      await resetToVirtualRootState();
      return;
    }

    if (!currentFolderParent.id) {
      setCurrentFolder({ id: "", name: "Shared" });
      setCurrentFolderParent({ id: "", name: "" });
      setSelectedFiles(new Set());
      setSelectedFolderId("");
      await refreshSharedFiles("");
      return;
    }

    const targetFolderId = currentFolderParent.id;
    const targetFolderName = currentFolderParent.name;

    // 1. Move the worker UP first!
    await worker.setCurrentFolder(targetFolderId, "up_shared");
    
    // 2. Now ask the worker for the new parent
    const parentResult = await worker.getSharedFolderParentIdAndName(currentFolder.id);

    if (!parentResult.parentId && parentResult.parentName === "") {
      setCurrentFolderParent({ id: "", name: "" });
    } else {
      setCurrentFolderParent({ id: parentResult.parentId, name: parentResult.parentName });
    }

    setCurrentFolder({ id: targetFolderId, name: targetFolderName });
    setSelectedFiles(new Set());
    setSelectedFolderId("");

    await refreshSharedFiles(targetFolderId);
  }

  const refreshFiles = useCallback(async (folderId: string) => {
    const hasAccessToCurrentFolder = await worker.hasAccessToFolder(folderId);
    if (!hasAccessToCurrentFolder) {
      alert("You do not have access to this folder.");
      return;
    }

    try {
      const filesData: EncryptedUserFileNoKey[] = (await worker.getFilesInFolder(folderId)).files;
      const decryptedFileNamesWithIds: UserFile[] = ((await worker.getFileDecryptedNamesAndIds(filesData)).files);
      setFiles(decryptedFileNamesWithIds);
      const foldersData: EncryptedUserFolder[] = (await worker.getFoldersInFolder(folderId)).folders;
      const decryptedFolderNamesWithIds: UserFolder[] = ((await worker.getFolderDecryptedNameAndId(foldersData)).folders);

      setFolders(decryptedFolderNamesWithIds);
      setSharedFiles([]);
      setSharedFolders([]);
    } catch (error) {
      console.error("Error refreshing files:", error);
    }
  }, [worker]);

  const refreshSharedFiles = useCallback(async (folderId?: string) => {
    try {
      const targetFolderId = folderId ?? currentFolder.id;

      if (!targetFolderId) {
        console.log("No target folder ID provided, fetching shared root contents");
        const sharedFoldersRes = await worker.getSharedFolders();
        const decryptedSharedFolders = (await worker.getSharedFolderDecryptedNamesAndIds(sharedFoldersRes.folders)).folders;
        setSharedFolders(decryptedSharedFolders);

        const sharedFilesData: EncryptedUserFileNoKey[] = (await worker.getSharedFiles()).files;
        if (sharedFilesData.length > 0) {
          const decryptedSharedFileNamesWithIds: UserFile[] = ((await worker.getSharedFileDecryptedNamesAndIds(sharedFilesData)).files);
          setSharedFiles(decryptedSharedFileNamesWithIds);
        } else {
          setSharedFiles([]);
        }
      } else {
        console.log("Fetching shared contents for folder ID:", targetFolderId);
        const sharedFoldersRes = await worker.getSharedFoldersInFolder(targetFolderId);
        const decryptedSharedFolders = (await worker.getSharedFolderDecryptedNamesAndIdsInFolder(sharedFoldersRes.folders)).folders;
        setSharedFolders(decryptedSharedFolders);

        const sharedFilesData: EncryptedUserFileNoKey[] = (await worker.getSharedFilesInFolder(targetFolderId)).files;
        if (sharedFilesData.length > 0) {
          const decryptedSharedFileNamesWithIds: UserFile[] = ((await worker.getFileDecryptedNamesAndIds(sharedFilesData)).files);
          setSharedFiles(decryptedSharedFileNamesWithIds);
        } else {
          setSharedFiles([]);
        }
      }
      setFiles([]);
      setFolders([]);
    } catch (error) {
      console.error("Error refreshing shared files:", error);
    }
  }, [currentFolder.id, worker]);

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
            setPersonalRootFolder({ id: rootFolderId.folderId, name: "root" });
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
  }, [navigate, refreshFiles, worker]);

  useEffect(() => {
    if (rootView !== "shared") {
      setSharedFolderPermissions(null);
      return;
    }

    if (!currentFolder.id) {
      setSharedFolderPermissions(null);
      return;
    }

    let isActive = true;

    worker.getPermissionsForFolder(currentFolder.id)
      .then((res) => {
        if (isActive) setSharedFolderPermissions(res.permissions);
      })
      .catch((error) => {
        console.error("Error fetching folder permissions:", error);
        if (isActive) setSharedFolderPermissions(null);
      });

    return () => {
      isActive = false;
    };
  }, [currentFolder.id, currentFolderParent.id, rootView, worker]);

  if (authError) return null;

  const handleSelect = (id: string) => {
    if (selectedFolderId) {
      setSelectedFolderId("");
    }
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedFiles(newSelection);
  };

  const handleSelectFolder = (id: string) => {
    if (selectedFiles.size > 0) {
      setSelectedFiles(new Set());
    }
    setSelectedFolderId((prev) => (prev === id ? "" : id));
  };

  const handleClearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFolderId("");
  };

  const handleDownload = async (file: UserFile) => {
    try {
      if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_download) {
        alert("You do not have permission to download from this folder.");
        return;
      }
      
      try {
        await hasAccess(file.id);
      } catch (error) {
        if (rootView === "shared") {
          if (!sharedFolderPermissions?.can_download) {
            alert("You do not have permission to download this file.");
            return;
          }
        }
      }

      console.log("Starting download for file:", file);
      try {
        const manifest_data = await worker.getChunkInfos(file.id);
        const fileStream = streamSaver.createWriteStream(file.name, { size: manifest_data.fileSize });
        const writer = fileStream.getWriter();

        try {
          for (const chunkInfo of manifest_data.chunks) {
            const decryption_res = await worker.decryptChunk(file.id, chunkInfo.id, chunkInfo.index);
            await writer.write(decryption_res.decryptedChunk);
          }
          await writer.close();
          console.log("[Download] Download complete successfully.");
        } finally {
          // THIS MUST ALWAYS RUN, even if decryption throws an error
          await worker.closeFile(file.id); 
        }
      } catch (error) {
        console.error("Error downloading file:", error);
        alert("Failed to download file: " + (error as Error).message);
      }
    } catch (error) {
      console.error("Error checking download permissions:", error);
      alert("Failed to check download permissions: " + (error as Error).message);
    }
    
  };

  const handleDelete = async (file: UserFile) => {
  if (!currentFolder.id) {
      return alert("Current folder not loaded. Please log out and try again.");
  }

  if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_delete) {
      return alert("You do not have permission to delete in this folder.");
  }

  if (globalThis.confirm(`Are you sure you want to delete ${file.name}?`)) {
      try {
        if (rootView !== "shared") {
          await verifyOwnership(file.id);
        }
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
    if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_download) {
      alert("You do not have permission to download from this folder.");
      return;
    }
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

    if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_delete) {
      return alert("You do not have permission to delete in this folder.");
    }

    if (globalThis.confirm(`Are you sure you want to delete ${selectedFiles.size} files?`)) {
      const filesToDelete = files.filter(f => selectedFiles.has(f.id));
      console.log("Deleting files:", filesToDelete);
      for (const file of filesToDelete) {
        try {
          if (rootView !== "shared") {
            await verifyOwnership(file.id);
          }
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

  const handleShare = async (username: string, shareDuration: number) => {

    try {
      if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_share) {
        alert("You do not have permission to share from this folder.");
        return;
      }

      if (rootView !== "shared") {
        await verifyOwnership(activeFile.id);
      }

      const share_duration = Number(shareDuration);

      if (Number.isNaN(share_duration) || share_duration < 0) {
        return alert("Please enter a valid sharing period in days");
      }

      if (!username) return alert("Please enter a username");

      console.log(`Sharing file ${activeFile.id} to ${username}`);

      await worker.shareFile(activeFile.id, username, share_duration);
      alert("File shared successfully.");
    } catch (error) {
      console.error("Error sharing file:", error);
      alert("Failed to share file: " + (error as Error).message);
    }
    setShareButtonPressed(false);
    handleClearSelection();
  };

  const handleFolderShare = async (username: string, duration: number, permissions: FolderSharePermissions) => {
    console.log("Folder share", {
      folderId: activeFolder.id,
      username,
      duration,
      permissions
    });

    if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_share) {
      alert("You do not have permission to share from this folder.");
      return;
    }

    try {
      await worker.shareFolder({
        folderId: activeFolder.id,
        recipientUsername: username,
        shareDuration: duration,
        permissions: {
          can_download: true,
          can_upload: false,
          can_share: permissions.share,
          can_delete: permissions.delete
        }
      });
    } catch (error) {
      console.error("Error sharing folder:", error);
      alert("Failed to share folder: " + (error as Error).message);
    }

    setShareFolderPopupOpen(false);
    handleClearSelection();
  };

  const handleDeleteFolder = (_folder: UserFolder) => {
    if (!currentFolder.id) {
      refreshSharedFiles();
    }

    if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_delete) {
      return alert("You do not have permission to delete in this folder.");
    }

    if (globalThis.confirm(`Are you sure you want to delete the folder ${_folder.name} and all its contents?`)) {
      worker.deleteFolder(_folder.id)
        .then(() => {
          refreshFiles(currentFolder.id);
          handleClearSelection();
        })
        .catch((error) => {
          console.error("Error deleting folder:", error);
          alert("Failed to delete folder: " + (error as Error).message);
        });
    }
  };

  const handleBulkShare = async (username: string, shareDuration: number) => {
    for (const fileId of selectedFiles) {
      try {
        if (rootView === "shared" && currentFolder.id && !sharedFolderPermissions?.can_share) {
          alert("You do not have permission to share from this folder.");
          return;
        }

        if (rootView !== "shared") {
          await verifyOwnership(fileId);
        }

        const share_duration = Number(shareDuration);

        if (Number.isNaN(share_duration) || share_duration < 0) {
          return alert("Please enter a valid sharing period in days");
        }
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

  const handleOpenPersonal = async () => { 
    setRootView("personal");
    setCurrentFolderParent({ id: "", name: "" });
    setCurrentFolder({ id: personalRootFolder.id, name: "root" });
    setSharedFolderPermissions(null);
    setSharedFiles([]);
    setSharedFolders([]);
    handleClearSelection();
    
    if (personalRootFolder.id) {
      await worker.setCurrentFolder(personalRootFolder.id, "up"); 
      await refreshFiles(personalRootFolder.id);
    }
  };

  const handleOpenShared = () => {
    setRootView("shared");
    setCurrentFolder({ id: "", name: "Shared" });
    setCurrentFolderParent({ id: "", name: "" });
    handleClearSelection();
    setActiveFile({ id: "", name: "" });
    setActiveFolder({ id: "", name: "" });
    setSharedFolderPermissions(null);
    refreshSharedFiles("");
  };

  const isPersonalRoot = rootView !== "shared" && !currentFolderParent.id;
  const isVirtualRoot = rootView === "root" && isPersonalRoot;
  const currentViewLabel = rootView === "root" ? currentFolder.name : rootView === "personal" ? "Personal" : "Shared";

  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '20px' }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <LogoutButton />
      </div>
      <h1>List of stored files {currentViewLabel ? `- ${currentViewLabel}` : ''}</h1>
      { authError ? (
        <p style={{ color: 'red' }}>Authentication error. Please log in again.</p>
      ) : (
        <div className="home-layout">
          <div className="home-main">
            <FileActionsBar 
              selectedCount={selectedFiles.size}
              onDownload={handleBulkDownload}
              onDelete={handleBulkDelete}
              onShare={() => { setShareMultiple(true); setShareButtonPressed(true); }}
              onClearSelection={handleClearSelection}
            />
            <div className="file-list">
              {isVirtualRoot ? (
                <VirtualRootFolders onOpenPersonal={handleOpenPersonal} onOpenShared={handleOpenShared} />
              ) : rootView === "shared" ? (
                <>
                  {sharedFiles.length === 0 && sharedFolders.length === 0 ? (
                    <p>No shared items found.</p>
                  ) : (
                    <>
                      <FileList
                        files={sharedFiles}
                        selectedFiles={selectedFiles}
                        onSelectFile={handleSelect}
                        onDownload={handleDownload}
                        onShare={(file) => { setActiveFile(file); setShareMultiple(false); setShareButtonPressed(true); }}
                        onDelete={handleDelete}
                      />

                      <FolderList
                        folders={sharedFolders}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={handleSelectFolder}
                        onNavigateDown={handleNavigateDownShared}
                        onShareFolder={(folder) => {
                          setActiveFolder({ id: folder.id, name: folder.name });
                          setShareFolderPopupOpen(true);
                        }}
                        onDeleteFolder={(folder) => handleDeleteFolder(folder)}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <FolderList
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={handleSelectFolder}
                    onNavigateDown={handleNavigateDown}
                    onShareFolder={(folder) => {
                      setActiveFolder({ id: folder.id, name: folder.name });
                      setShareFolderPopupOpen(true);
                    }}
                    onDeleteFolder={(folder) => handleDeleteFolder(folder)}
                  />

                  <FileList
                    files={files}
                    selectedFiles={selectedFiles}
                    onSelectFile={handleSelect}
                    onDownload={handleDownload}
                    onShare={(file) => { setActiveFile(file); setShareMultiple(false); setShareButtonPressed(true); }}
                    onDelete={handleDelete}
                  />
                </>
              )}
              
              {(currentFolderParent.id || (!currentFolderParent.id && rootView !== "root")) && (
                   <div className="file-row" onClick={() => rootView === "shared" ? handleNavigateUpShared() : handleNavigateUp()} style={{cursor: 'pointer'}}> 
                      <div className="file-name" style={{ paddingLeft: '40px' }}>..</div>
                   </div>
              )}

              {!isVirtualRoot && rootView !== "shared" && files?.length === 0 && folders?.length === 0 && (
                <p>No files found.</p>
              )}
            </div>

            <ShareFilePopup
              open={shareButtonPressed}
              multiple={shareMultiple}
              onClose={() => setShareButtonPressed(false)}
              onShare={handleShare}
              onShareBulk={handleBulkShare}
            />

            <ShareFolderPopup
              open={shareFolderPopupOpen}
              onClose={() => setShareFolderPopupOpen(false)}
              onShare={handleFolderShare}
            />
          </div>
          <div className="home-side">
            <div className="side-title">Quick actions</div>
            {(rootView === "personal" || (rootView === "shared" && sharedFolderPermissions?.can_upload)) ? (
              <div className="side-actions">
                <CreateFolderButton currentFolderId={currentFolder.id} onFolderCreated={() => 
                  rootView === "shared" ? (currentFolder.id ? refreshSharedFiles(currentFolder.id) : refreshSharedFiles()) :
                  refreshFiles(currentFolder.id)

                  } />
                <UploadFileButton onUploadSuccess={() => 
                  
                  rootView === "shared" ? (currentFolder.id ? refreshSharedFiles(currentFolder.id) : refreshSharedFiles()) :
                  refreshFiles(currentFolder.id)
                  } />
              </div>
            ) : (
              <div className="side-muted">No actions available here.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
