import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../config/config";
import srp from "secure-remote-password/client";
import type {
  AuthCheckResponse,
  SrpLoginStartResponse,
  SrpLoginVerifyResponse,
  GetUserKeysResponse
} from "../utils/apiTypes";
import { bufferToHex, deriveKEK, hexToBuffer, decrypt } from "../../utils/crypto";
import { useGlobalWorker, WorkerContext } from "../context/WorkerContext";
import {logout} from "../components/LogoutButton";

export const SrpLogin = () => {
  const worker = useGlobalWorker();

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
        const data: AuthCheckResponse = await res.json();
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
      // const { public: client_public, secret: client_secret } = srp.generateEphemeral();

      // const startRes = await fetch(`${config.BACKENDURL}/auth/login/start`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   credentials: "include",
      //   body: JSON.stringify({ username, client_public }),
      // });

      // const startData: SrpLoginStartResponse = await startRes.json();
      // if (!startData.success) throw new Error(startData.message);

      // const loginSessionId = startData.data.loginSessionId;

      // const privateKey = srp.derivePrivateKey(startData.data.salt, username, password);
      
      // const clientSession = srp.deriveSession(
      //   client_secret,
      //   startData.data.server_public,
      //   startData.data.salt,
      //   username,
      //   privateKey
      // );

      // const verifyRes = await fetch(`${config.BACKENDURL}/auth/login/verify`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   credentials: "include",
      //   body: JSON.stringify({
      //     client_session_proof: clientSession.proof, loginSessionId
      //   }),
      // });

      // const verifyData: SrpLoginVerifyResponse = await verifyRes.json();
      // if (!verifyData.success) throw new Error(verifyData.message);

      // srp.verifySession(
      //   client_public,
      //   clientSession,
      //   verifyData.data.server_session_proof
      // );

      // await fetch(`${config.BACKENDURL}/users/keys`, {
      //     method: "GET",
      //     headers: { "Content-Type": "application/json" },
      //     credentials: "include",
      // }).then(res => res.json() as Promise<GetUserKeysResponse>).then(async data => {

      //     if (!data.success) {
      //       throw new Error(data.message);
      //     }
      //     console.log("Fetched file encryption keys:", data);
      //     try {
      //       const kek = await deriveKEK(
      //         password,
      //         Uint8Array.from(hexToBuffer(data.data.encryption_salt))
      //       );

      //       const private_key_data = new Uint8Array(hexToBuffer(data.data.encrypted_private_key));
      //       const private_key_nonce = private_key_data.slice(0, 12);
      //       const private_key_ciphertext = private_key_data.slice(12);

      //       const decryptedPrivateKey = await decrypt(
      //         private_key_ciphertext,
      //         kek,
      //         private_key_nonce
      //       );

      //       globalThis.sessionStorage.setItem("decrypted_private_key", bufferToHex(new Uint8Array(decryptedPrivateKey)));
      //       globalThis.sessionStorage.setItem("encryption_public_key", data.data.encryption_public_key);
      //     } catch (err) {
      //       console.error("Error decrypting keys:", err);
      //       return;
      //     }
          
      //   });

      const loginResult = await worker.fullLogin(username, password);
      if (!loginResult.success) {
        throw new Error("Login failed in worker");
      }
      const fileKeysResult = await worker.getFileKeys();
      if (!fileKeysResult.success) {
        throw new Error("Fetching file keys failed in worker");
      }
      
      alert("Login successful");
      navigate("/home");

    } catch (err: any) {
      alert(`Login failed: ${err.message || err}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

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