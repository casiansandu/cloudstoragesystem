import type { UserFile } from "../utils/apiTypes";
import MeatballMenu from "./MeatballMenu";
import './FileRow.css';

interface FileRowProps {
  file: UserFile;
  isSelected: boolean;
  isFolder?: boolean;
  onSelect: (id: string) => void;
  onDownload?: (file: UserFile) => void;
  onDelete?: (file: UserFile) => void;
  onShare?: (file: UserFile) => void;
  onNavigate?: (id: string) => void;
}

const FileRow = ({ file, isSelected, isFolder, onSelect, onDownload, onShare, onDelete, onNavigate }: FileRowProps) => {
  
  const handleRowClick = () => {
    if (isFolder && onNavigate) {
      onNavigate(file.id);
    } else {
      onSelect(file.id);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {// Handled in onSelect directly
  };

  return (
    <div className={`file-row ${isSelected ? 'selected' : ''}`} onClick={handleRowClick}>
      <div className="file-checkbox">
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={handleCheckboxChange}
          
          onClick={(e) => e.stopPropagation()} 
          
          onChangeCapture={() => onSelect(file.id)}
        />
      </div>
      <div className="file-name">
        {isFolder ? '📁 ' : '📄 '}
        {file.name}
      </div>
      <div className="file-actions">
        {!isFolder && (
        <MeatballMenu 
          actions={[
            { label: 'Download', onClick: () => onDownload?.(file) },
            { label: 'Delete', onClick: () => onDelete?.(file), variant: 'danger' },
            { label: 'Share', onClick: () => onShare?.(file) }
          ]} 
        />
        )}
      </div>
    </div>
  );
};

export default FileRow;
