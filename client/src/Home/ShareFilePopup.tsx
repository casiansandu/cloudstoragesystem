import { useEffect, useState } from "react";
import SharePopup from "../components/SharePopup";

interface ShareFilePopupProps {
  open: boolean;
  multiple: boolean;
  onClose: () => void;
  onShare: (username: string, duration: number) => void;
  onShareBulk: (username: string, duration: number) => void;
}

const ShareFilePopup = ({ open, multiple, onClose, onShare, onShareBulk }: ShareFilePopupProps) => {
  const [username, setUsername] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    if (open) {
      setUsername("");
      setDuration("");
    }
  }, [open]);

  const handleShareClick = () => {
    const durationValue = Number(duration);
    if (multiple) {
      onShareBulk(username, durationValue);
    } else {
      onShare(username, durationValue);
    }
  };

  return (
    <SharePopup triggered={open} multiple={multiple} onClose={onClose}>
      <h3>Share files</h3>
      <form onSubmit={(e) => { e.preventDefault(); }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label>
            Recipient Username:
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Period (days):
            <input
              type="number"
              name="period"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>
        <button type="submit" onClick={handleShareClick} style={{ marginTop: "10px" }}>
          Share
        </button>
      </form>
    </SharePopup>
  );
};

export default ShareFilePopup;
