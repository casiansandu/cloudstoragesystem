import { useState, type ChangeEvent } from 'react';
import { useGlobalWorker } from '../context/WorkerContext';
import Button from './Button';

interface UploadFileButtonProps {
  onUploadSuccess?: () => void;
}

const EncryptedUpload = ({ onUploadSuccess } : UploadFileButtonProps) => {

    const worker = useGlobalWorker();
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>("No file selected");
    const [status, setStatus] = useState<string>("");

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
            setSelectedFileName(event.target.files[0].name);
            setStatus(""); 
        } else {
            setSelectedFileName("No file selected");
        }
    };

    const onFileUpload = async () => {
        if (!selectedFile) {
            alert("Please select a file first!");
            return;
        }

        try {
            
            setStatus("Uploading...");

            //const result = await worker.uploadFile(selectedFile);
            const result = await worker.uploadFile(selectedFile);
            if (!result.success) {
                throw new Error("Upload failed in worker");
            }

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
        <div className="action-card">
            <div className="action-title">Encrypt & upload</div>
            <div className="action-row">
                <label className="file-picker" htmlFor="upload-input">
                    Browse file
                </label>
                <input
                    id="upload-input"
                    className="file-input"
                    type="file"
                    onChange={onFileChange}
                />
                <div className="file-name" title={selectedFileName}>
                    {selectedFileName}
                </div>
                <Button func={onFileUpload} color="primary">
                    Upload
                </Button>
            </div>
            {status && <div className="status-text">Status: {status}</div>}
        </div>
    );
};

export default EncryptedUpload;


