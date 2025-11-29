import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../config/config.ts";
import srp from "secure-remote-password/client"


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

  const post_register = () => {

    console.log("Registering user:", { username, email, salt, verifier });

    fetch(`${config.BACKENDURL}/auth/srpregister`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ username, email, salt, verifier })
    })
      .then(res => res.json())
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post_register();
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
