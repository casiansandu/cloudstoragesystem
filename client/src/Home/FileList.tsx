import type { UserFile } from "../utils/apiTypes";
import FileRow from "../components/FileRow";

interface FileListProps {
  files: UserFile[];
  selectedFiles: Set<string>;
  onSelectFile: (id: string) => void;
  onDownload: (file: UserFile) => void;
  onDelete: (file: UserFile) => void;
  onShare: (file: UserFile) => void;
}

const FileList = ({
  files,
  selectedFiles,
  onSelectFile,
  onDownload,
  onDelete,
  onShare
}: FileListProps) => {
  return (
    <>
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          isSelected={selectedFiles.has(file.id)}
          onSelect={onSelectFile}
          onDownload={onDownload}
          onShare={() => onShare(file)}
          onDelete={onDelete}
        />
      ))}
    </>
  );
};

export default FileList;
