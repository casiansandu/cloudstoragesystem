import React from "react";
import "./SharePopup.css";

function SharePopup(props: {triggered: boolean, multiple: boolean, onClose: () => void, children: React.ReactNode}) {
  return props.triggered ? (
    <div className="share-popup">
        <div className="share-popup-content">
            {props.children}
            <button className="close-btn" onClick={props.onClose}>Close</button>
        </div>
    </div>
  ) : "";
}

export default SharePopup;