import FileRow from "../components/FileRow";

interface VirtualRootFoldersProps {
  onOpenPersonal: () => void;
  onOpenShared: () => void;
}

const VirtualRootFolders = ({ onOpenPersonal, onOpenShared }: VirtualRootFoldersProps) => {
  return (
    <>
      <FileRow
        file={{ id: "__personal__", name: "Personal" }}
        isFolder={true}
        isSelected={false}
        hideCheckbox={true}
        onSelect={() => {}}
        onNavigate={onOpenPersonal}
      />
      <FileRow
        file={{ id: "__shared__", name: "Shared" }}
        isFolder={true}
        isSelected={false}
        hideCheckbox={true}
        onSelect={() => {}}
        onNavigate={onOpenShared}
      />
    </>
  );
};

export default VirtualRootFolders;
