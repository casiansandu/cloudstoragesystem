import { useState, type ChangeEvent } from 'react';
import { deriveChunkKey, encrypt, generateMasterKey } from '../../utils/crypto';
import config from '../../config/config';

type ManifestData = {
  filename: string;
  totalChunks: number;
  uploadedAt: string;
  encryptedFileKeyBase64: string; 
  chunkInfos: {
    index: number;
    ciphertextLength: number;
    ciphertextHashBase64: string;
  }[];
};

const CompactEncryptedUpload = () => {
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<string>("");

    // Type the event properly as an Input Change Event
    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
            setStatus(""); 
        }
    };

    const onFileUpload = async () => {
        if (!selectedFile) {
            alert("Please select a file first!");
            return;
        }

        try {
            //setStatus("Encrypting...");
            //setStatus("Uploading...");
            
            let file_id = "";

            await fetch(`${config.BACKENDURL}files/upload/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: "/",
                    file_size: 2048,
                }),
                credentials: "include"
            }).then(res => res.json()).then(data => {
                file_id = data.data.file_id
                console.log("Upload started: for file ", file_id);
            })

            
            const buffer = await selectedFile.arrayBuffer();
            const file_data_uint8 = new Uint8Array(buffer);

            const chunk_size = 1 * 1024 * 1024; // 1 MB
            const chunk_number = Math.ceil(selectedFile.size / chunk_size);
            
            const file_master_key = await generateMasterKey();

            let chunk_index = 0;
            while (chunk_index < chunk_number) {
                const chunk_key = await deriveChunkKey(
                    file_master_key,
                    chunk_index,
                    "file_id_placeholder"
                );

                const chunk_start = chunk_index * chunk_size;
                const chunk_end = Math.min(chunk_start + chunk_size, selectedFile.size);

                const file_chunk = file_data_uint8.slice(chunk_start, chunk_end);
                console.log(`Uploading chunk ${chunk_index + 1} / ${chunk_number}`);


                const enc_chunk = await encrypt(file_chunk, chunk_key);

                console.log(enc_chunk.ciphertext);
                chunk_index += 1;
            }
            
            

            setStatus("File Uploaded Successfully!");

            console.log(file_data_uint8.length);

        } catch (error) {
            console.error("Error uploading file:", error);
            setStatus("Error occurred during upload");
        }
    };

    return (
        <div>
            <h4>Encrypt & Upload</h4>
            
            <div>
                {/* File Input */}
                <input type="file" onChange={onFileChange} />
                
                <br /><br />

                <button onClick={onFileUpload}>
                    Upload!
                </button>
            </div>
            
            {status && <p style={{ fontWeight: 'bold', color: 'blue' }}>Status: {status}</p>}
            
            
        </div>
    );
};

export default CompactEncryptedUpload;