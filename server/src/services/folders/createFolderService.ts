import db from '../../db/db';
import { folders, folderAccess } from '../../db/schema';
type DatabaseRunner = Omit<typeof db, '$client'>;

export async function createFolderService(
    user_id: string, 
    encrypted_key_data_ark: string, 
    encrypted_key_data_parent: string, 
    parent_folder_id?: string, 
    encrypted_folder_name_data?: string,
    tx: DatabaseRunner = db
): Promise<{ folder_id: string, access_id: string }> {

    const [insertedFolder] = await tx
        .insert(folders)
        .values({
            parentId: parent_folder_id || null,
            encryptedNameData: encrypted_folder_name_data || null,
            encryptedKeyDataArk: encrypted_key_data_ark,
            encryptedKeyDataParentFolder: encrypted_key_data_parent,
            ownerId: user_id,
        })
        .returning({ folder_id: folders.id });

    const [insertedAccess] = await tx
        .insert(folderAccess)
        .values({
            folderId: insertedFolder.folder_id,
            userId: user_id,
            encryptedFolderKey: encrypted_key_data_parent,
            shareDuration: 0,
            canDownload: true,
            canUpload: true,
            canShare: true,
            canDelete: true,
        })
        .returning({ access_id: folderAccess.accessId });

    return { folder_id: insertedFolder.folder_id, access_id: insertedAccess.access_id };
}