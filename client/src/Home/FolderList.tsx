import type { UserFolder } from "../utils/apiTypes";
import FileRow from "../components/FileRow";

interface FolderListProps {
  folders: UserFolder[];
  selectedFolderId: string;
  onSelectFolder: (id: string) => void;
  onNavigateDown: (id: string, name: string) => void;
  onShareFolder: (folder: UserFolder) => void;
  onDeleteFolder: (folder: UserFolder) => void;
}

const FolderList = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onNavigateDown,
  onShareFolder,
  onDeleteFolder
}: FolderListProps) => {
  return (
    <>
      {folders.map((folder) => (
        <FileRow
          key={folder.id}
          file={{ id: folder.id, name: folder.name }}
          isFolder={true}
          isSelected={selectedFolderId === folder.id}
          onSelect={onSelectFolder}
          onNavigate={(id) => onNavigateDown(id, folder.name)}
          onShare={() => onShareFolder(folder)}
          onDelete={() => onDeleteFolder(folder)}
        />
      ))}
    </>
  );
};

export default FolderList;
