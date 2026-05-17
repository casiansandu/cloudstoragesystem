import config from "../../../config/config";

export const verifyOwnership = async (file_id: string) => {
    const res = await fetch(`${config.BACKENDURL}/files/isowner/${file_id}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await res.json();

    if (!data.data.isOwner) {
      throw new Error("Ownership verification failed: " + data.message);
    }

}

export const hasAccess = async (file_id: string) => {
    const res = await fetch(`${config.BACKENDURL}/files/hasaccess/${file_id}`, {
      method: "GET",
      credentials: "include"
    });
    const data = await res.json();
    
    if (!data.success) {
      throw new Error("Access check failed: " + data.message);
    }

}

export const fetchChunk = async (file_id: string, chunk_id: string) => {

  const res = await fetch(`${config.BACKENDURL}/files/download/${file_id}/${chunk_id}`, {
    method: "GET",
    credentials: "include"
  });

  return (await res.arrayBuffer());
}