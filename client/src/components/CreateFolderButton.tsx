import { useState } from 'react';
import config from '../../config/config';
import { useGlobalWorker } from '../context/WorkerContext';

interface CreateFolderButtonProps {
  currentFolderId: string;
  onFolderCreated: () => void;
}

const CreateFolderButton = ({ currentFolderId, onFolderCreated }: CreateFolderButtonProps) => {

  const worker = useGlobalWorker();

  const handleCreateFolder = async () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;

    try {
      const folder_id = await worker.createFolderForUser(
        folderName
      );
      onFolderCreated();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder: " + (error as Error).message);
    }
  };

  return (
    <div>
      <h4>Create Folder</h4>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleCreateFolder}>
          Create New Folder
        </button>
      </div>
    </div>
  );
};

export default CreateFolderButton;
