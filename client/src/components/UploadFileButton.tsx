import { useState, type ChangeEvent } from 'react';
import uploadFile from './UploadFileFeature/uploadFile';

interface UploadFileButtonProps {
  onUploadSuccess?: () => void;
}

const EncryptedUpload = ({ onUploadSuccess } : UploadFileButtonProps) => {
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<string>("");

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
            
            setStatus("Uploading...");

            await uploadFile(selectedFile);

            setStatus("Upload successful!");

            if (onUploadSuccess) {
                onUploadSuccess();
            }            

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

export default EncryptedUpload;


