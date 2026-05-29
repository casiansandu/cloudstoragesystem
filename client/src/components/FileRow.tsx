import type { UserFile } from "../utils/apiTypes";
import MeatballMenu from "./MeatballMenu";
import './FileRow.css';

interface FileRowProps {
  file: UserFile;
  isSelected: boolean;
  isFolder?: boolean;
  hideCheckbox?: boolean;
  onSelect: (id: string) => void;
  onDownload?: (file: UserFile) => void;
  onDelete?: (file: UserFile) => void;
  onShare?: (file: UserFile) => void;
  onNavigate?: (id: string) => void;
}

const FileRow = ({ file, isSelected, isFolder, hideCheckbox, onSelect, onDownload, onShare, onDelete, onNavigate }: FileRowProps) => {
  
  const handleRowClick = () => {
    if (isFolder && onNavigate) {
      onNavigate(file.id);
    } else {
      onSelect(file.id);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {// Handled in onSelect directly
  };

  const actions = [] as { label: string; onClick: () => void; variant?: 'default' | 'danger' }[];

  if (!isFolder && onDownload) actions.push({ label: 'Download', onClick: () => onDownload(file) });

  if (isFolder) {
    if (onShare) actions.push({ label: 'Share', onClick: () => onShare(file) });
    if (onDelete) actions.push({ label: 'Delete', onClick: () => onDelete(file), variant: 'danger' });
  } else {
    if (onDelete) actions.push({ label: 'Delete', onClick: () => onDelete(file), variant: 'danger' });
    if (onShare) actions.push({ label: 'Share', onClick: () => onShare(file) });
  }

  return (
    <div className={`file-row ${isSelected ? 'selected' : ''}`} onClick={handleRowClick}>
      <div className="file-checkbox">
        {!hideCheckbox && (
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={handleCheckboxChange}
            
            onClick={(e) => e.stopPropagation()} 
            
            onChangeCapture={() => onSelect(file.id)}
          />
        )}
      </div>
      <div className="file-name">
        {isFolder ? '📁 ' : '📄 '}
        {file.name}
      </div>
      <div className="file-actions">
        {actions.length > 0 && (
          <MeatballMenu actions={actions} />
        )}
      </div>
    </div>
  );
};

export default FileRow;
