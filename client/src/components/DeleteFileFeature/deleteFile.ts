import config from "../../../config/config";

export default async function deleteFile(file_id: string) {

  const res = await fetch(`${config.BACKENDURL}/files/${file_id}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await res.json();

  console.log("Delete file response:", data);

  if (!data.success) {
    throw new Error(`Failed to delete file ${file_id}: ${data.message}`);
  }
}
