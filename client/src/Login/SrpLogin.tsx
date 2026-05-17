import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalWorker } from "../context/WorkerContext";

export const SrpLogin = () => {
  const worker = useGlobalWorker();

  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const performSrpLogin = async () => {
    setIsLoading(true);
    try {
      const logoutResult = await worker.logoutUser();
      if (!logoutResult.success) {
        throw new Error("Logout failed in worker");
      }
      
      const loginResult = await worker.fullLogin(username, password);
      if (!loginResult.success) {
        throw new Error("Login failed in worker");
      // }
      // const fileKeysResult = await worker.getFileKeys();
      // if (!fileKeysResult.success) {
      //   throw new Error("Fetching file keys failed in worker");
      }
      
      alert("Login successful");
      navigate("/home");

    } catch (err: any) {
      alert(`Login failed: ${err.message || err}`);
      await worker.logoutUser();
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
      
      <div className="mt-3">
        <p>Don't have an account?</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/register")}
          disabled={isLoading}
        >
          Go to Register
        </button>
      </div>
    </form>
  );
};