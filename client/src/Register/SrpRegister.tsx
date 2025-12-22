import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../config/config.ts";
import srp from "secure-remote-password/client"
import { generateMasterKey, deriveKEK, encrypt, bufferToHex, generateAsymKeyPair } from "../../utils/crypto.ts";
import type { AuthCheckResponse, SrpRegisterResponse } from "../utils/apiTypes";
import { concatUint8 } from "../utils/funcs.ts";

export const SrpRegister = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const salt = srp.generateSalt();
  const privateKey = srp.derivePrivateKey(salt, username, password);
  const verifier = srp.deriveVerifier(privateKey);

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

  const post_register = async (
    encryptionSalt: Uint8Array, 
    encryptedPrivateKey: Uint8Array,
    publicKey: Uint8Array, 
    encryptedDirKey: Uint8Array,
    nonce: Uint8Array) => {

    console.log("Registering user:", { username, email });

    fetch(`${config.BACKENDURL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ 
        username, 
        email, 
        srp_salt: salt, 
        srp_verifier: verifier, 
        encryption_salt: bufferToHex(encryptionSalt as BufferSource),
        encryption_public_key: bufferToHex(publicKey as BufferSource),
        encrypted_private_key: bufferToHex(encryptedPrivateKey as BufferSource),
        encrypted_directory_key: bufferToHex(encryptedDirKey as BufferSource),
        encryption_nonce: bufferToHex(nonce as BufferSource) })
    })
      .then(res => res.json() as Promise<SrpRegisterResponse>)
      .then(data => {
        console.log(data)
        if (data.success) {
            alert("Registered successfully")
            navigate("/login")
        } else {
            alert("Unable to register: " + data.message)
        }
      })
      .catch(err => console.error(err));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Generated key pair");
    const { publicKey, privateKey } = await generateAsymKeyPair();
    console.log(publicKey.byteLength)
    //A, a

    const encryptionSalt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    //salt for KEK derivation

    const kek = await deriveKEK(password, encryptionSalt);
    //key encryption key

    const encryptedPrivateKey = await encrypt(privateKey, kek);
    //encrypted private key with kek
    
    //server stores enc_kek(a), A, encryption salt, and nonce
    const dir_key = await generateMasterKey()
    const encrypted_dir_key = await encrypt(dir_key, kek);
    await post_register(
      encryptionSalt,
      concatUint8(encryptedPrivateKey.nonce, encryptedPrivateKey.ciphertext),
      new Uint8Array(publicKey),
      concatUint8(encrypted_dir_key.nonce, encrypted_dir_key.ciphertext),
      encryptedPrivateKey.nonce
    );
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
