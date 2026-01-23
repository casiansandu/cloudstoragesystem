import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import srp from "secure-remote-password/client"
import { useGlobalWorker } from "../context/WorkerContext.ts";

export const SrpRegister = () => {


  const worker = useGlobalWorker();
  
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  // const salt = srp.generateSalt();
  // const _privateKey = srp.derivePrivateKey(salt, username, password);
  // const verifier = srp.deriveVerifier(_privateKey);

  // useEffect(() => {
  //   const logoutUser = async () => {
  //     const logoutResult = await worker.logoutUser();
  //     if (!logoutResult.success) {
  //       console.error("Logout failed in worker");
  //     }
  //   };

  //   logoutUser();
  // });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await worker.registerUser(username, email, password);

      if (result?.success) {
        alert("Registered successfully");
        navigate("/login");
      } else {
        alert("Unable to register");
      }
    }
    catch (err: any) {
      alert(`Registration failed: ${err.message || err}`);
      await worker.logoutUser();
      console.error(err);
    }
    

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
