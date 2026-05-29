import { useEffect, useState } from "react";
import SharePopup from "../components/SharePopup";

export interface FolderSharePermissions {
  upload: boolean;
  delete: boolean;
  share: boolean;
}

interface ShareFolderPopupProps {
  open: boolean;
  onClose: () => void;
  onShare: (username: string, duration: number, permissions: FolderSharePermissions) => void;
}

const ShareFolderPopup = ({ open, onClose, onShare }: ShareFolderPopupProps) => {
  const [username, setUsername] = useState("");
  const [duration, setDuration] = useState("");
  const [permissions, setPermissions] = useState<FolderSharePermissions>({
    upload: false,
    delete: false,
    share: false
  });

  useEffect(() => {
    if (open) {
      setUsername("");
      setDuration("");
      setPermissions({
        upload: false,
        delete: false,
        share: false
      });
    }
  }, [open]);

  const handleShareClick = () => {
    const durationValue = Number(duration);
    onShare(username, durationValue, permissions);
  };

  return (
    <SharePopup triggered={open} multiple={false} onClose={onClose}>
      <h3>Share folder</h3>
      <form onSubmit={(e) => { e.preventDefault(); }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label>
            Recipient Username:
            <input
              type="text"
              name="folder-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Period (days):
            <input
              type="number"
              name="folder-period"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <div className="share-permissions">
            <label>
              <input
                type="checkbox"
                checked={permissions.delete}
                onChange={(e) => setPermissions((prev) => ({ ...prev, delete: e.target.checked }))}
              />
              Delete
            </label>
            <label>
              <input
                type="checkbox"
                checked={permissions.share}
                onChange={(e) => setPermissions((prev) => ({ ...prev, share: e.target.checked }))}
              />
              Share
            </label>
          </div>
        </div>
        <button type="submit" onClick={handleShareClick} style={{ marginTop: "10px" }}>
          Share
        </button>
      </form>
    </SharePopup>
  );
};

export default ShareFolderPopup;
