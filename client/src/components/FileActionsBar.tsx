import './FileActionsBar.css';
import Button from './Button';

interface FileActionsBarProps {
  selectedCount: number;
  onDownload: () => void;
  onDelete: () => void;
  onShare: () => void;
  onClearSelection: () => void;
}

const FileActionsBar = ({ selectedCount, onDownload, onDelete, onShare, onClearSelection }: FileActionsBarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="file-actions-bar">
      <div className="selection-info">
        {selectedCount} selected
        <button className="clear-selection-btn" onClick={onClearSelection}>X</button>
      </div>
      <div className="action-buttons">
        <Button func={onDownload} color="primary">Download</Button>
        <div style={{ width: '10px' }}></div>
        <Button func={onDelete} color="danger">Delete</Button>
        <div style={{ width: '10px' }}></div>
        <Button func={onShare} color="secondary">Share</Button>
      </div>
    </div>
  );
};

export default FileActionsBar;
