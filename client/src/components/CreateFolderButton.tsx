import { useGlobalWorker } from '../context/WorkerContext';
import Button from './Button';

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
    <div className="action-card">
      <div className="action-title">New folder</div>
      <div className="action-row">
        <Button func={handleCreateFolder} color="secondary">
          Create folder
        </Button>
      </div>
    </div>
  );
};

export default CreateFolderButton;
