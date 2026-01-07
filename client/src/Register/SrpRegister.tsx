import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../config/config.ts";
import srp from "secure-remote-password/client"
import type { AuthCheckResponse } from "../utils/apiTypes";
import { useGlobalWorker } from "../context/WorkerContext.ts";

export const SrpRegister = () => {


  const worker = useGlobalWorker();
  
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const salt = srp.generateSalt();
  const _privateKey = srp.derivePrivateKey(salt, username, password);
  const verifier = srp.deriveVerifier(_privateKey);

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

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await worker.registerUser(username, email, password);

    if (result.success) {
      alert("Registered successfully");
      navigate("/login");
    } else {
      alert("Unable to register");
    }

    // console.log("Generated key pair");
    // const { publicKey, privateKey } = await generateAsymKeyPair();
    // console.log(publicKey.byteLength)
    // //A, a

    // const encryptionSalt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    // //salt for KEK derivation

    // const kek = await deriveKEK(password, encryptionSalt);
    // //key encryption key

    // const encryptedPrivateKey = await encrypt(privateKey, kek);
    // //encrypted private key with kek
    
    // //server stores username, email, srp_salt, srp_verifier, encryption_salt, encryption_public_key, encrypted_private_key
    // await post_register(
    //   username, 
    //   email, 
    //   salt, 
    //   verifier,
    //   encryptionSalt,
    //   concatUint8(encryptedPrivateKey.nonce, encryptedPrivateKey.ciphertext),
    //   new Uint8Array(publicKey)
    // );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="inputEmail" className="form-label">Email address</label>
        <input
          type="email"
          className="form-control"
          id="inputEmail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="inputUsername" className="form-label">Username</label>
        <input
          type="text"
          className="form-control"
          id="inputUsername"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
        />
      </div>

      <button type="submit" className="btn btn-primary">Submit</button>
    </form>
  );
};
