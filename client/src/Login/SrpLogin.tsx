import React, { use, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../config/config";
import srp from "secure-remote-password/client";

export const SrpLogin = () => {

  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${config.BACKENDURL}/auth/status`, {
          credentials: "include"
        });
        const data = await res.json();
        if (data.isAuthenticated) {
          navigate("/home");
        }
      } catch {
        // Not logged in, stay on login page
      }
    };

    checkAuth();
  }, [navigate]);

  const performSrpLogin = async () => {
    setIsLoading(true);
    try {
      const { public: client_public, secret: client_secret } = srp.generateEphemeral();

      const startRes = await fetch(`${config.BACKENDURL}/auth/login/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, client_public }),
      });

      const startData = await startRes.json();
      if (!startData.success) throw new Error(startData.message);

      console.log("Received start data:", startData);

      const loginSessionId = startData.data.loginSessionId;

      const privateKey = srp.derivePrivateKey(startData.data.salt, username, password);
      
      const clientSession = srp.deriveSession(
        client_secret,
        startData.data.server_public,
        startData.data.salt,
        username,
        privateKey
      );

      const verifyRes = await fetch(`${config.BACKENDURL}/auth/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_session_proof: clientSession.proof, loginSessionId
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) throw new Error(verifyData.message);

      srp.verifySession(
        client_public,
        clientSession,
        verifyData.data.server_session_proof
      );

      alert("Login successful");
      navigate("/home");

    } catch (err: any) {
      alert(`Login failed: ${err.message || err}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSrpLogin();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="inputUsername" className="form-label">Username</label>
        <input
          type="text"
          className="form-control"
          id="inputUsername"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="inputPassword" className="form-label">Password</label>
        <input
          type="password"
          className="form-control"
          id="inputPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={isLoading}>
        {isLoading ? "Verifying..." : "Submit"}
      </button>
    </form>
  );
};