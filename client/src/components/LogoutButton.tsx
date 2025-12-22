import { useNavigate } from "react-router-dom";

import config from "../../config/config";


export const LogoutButton = () => {

const navigate = useNavigate();

  const handleLogout = async () => {
    globalThis.sessionStorage.clear();
    globalThis.localStorage.clear();

    try {
      await fetch(`${config.BACKENDURL}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (err) {
      console.error("Logout failed on server, but client is cleared", err);
    }

    navigate("/login");
  };

  return (
    <button 
      onClick={handleLogout}
      className="btn btn-danger"
      style={{ padding: "8px 16px", cursor: "pointer" }}
    >
      Logout
    </button>
  );
};

