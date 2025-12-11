import config from "../../config/config"
import React, { use, useEffect, useState } from "react";
import UploadFileButton from "../components/UploadFileButton";
import type { GetAllUserFilesResponse, UserFile } from "../utils/apiTypes";
import { LogoutButton } from "../components/LogoutButton";

export const Home = () => {

  const [files, setFiles] = useState<UserFile[]>([]);

  const getFiles = async () => {
    try {
      const res = await fetch(`${config.BACKENDURL}/files/all`, {
        method: "GET",
        credentials: "include"
      });
      const data: GetAllUserFilesResponse = await res.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      console.log("Fetched files:", data.data);
      return data.data.files;
    } catch (error) {
      console.error("Error fetching files:", error);
      return [];
    }
  }

  useEffect(() => {
    const fetchFiles = async () => {
      const fetchedFiles = await getFiles();
      setFiles(fetchedFiles);
    };

    fetchFiles();
  }, []);

  return (
  <>
    <h1>List of stored files</h1>
    {files?.length === 0 ? (
      <p>No files found.</p>
    ) : (
      <ul>
        {files.map((file, index) => (
          <li key={index}>{file.filename}</li>
        ))}
      </ul>
    )}
    <UploadFileButton>
      
    </UploadFileButton>
    <LogoutButton />
  </>
);
}
