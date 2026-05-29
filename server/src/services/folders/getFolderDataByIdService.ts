import db from '../../db/db';
import { eq } from 'drizzle-orm';
import { folders } from '../../db/schema';
import { getFolderAccessForUserService } from './getFolderAccessForUserService';

export async function getFolderDataByIdService(user_id: string, folder_id: string) {
    const access_info = await getFolderAccessForUserService(user_id, folder_id);
    
    const [result] = await db
        .select({ 
            folder_id: folders.id,
            parent_id: folders.parentId, 
            encrypted_name_data: folders.encryptedNameData, 
            encrypted_key_data_ark: folders.encryptedKeyDataArk,
            encrypted_key_data_parent: folders.encryptedKeyDataParentFolder,
        })
        .from(folders)
        .where(eq(folders.id, folder_id))
        .limit(1);

    if (!result) {
        throw new Error('Folder not found');
    }

    let correct_encrypted_key = "";

    if (access_info.accessType === "owner") {
        correct_encrypted_key = result.encrypted_key_data_ark;
        
    } else if (access_info.accessType === "shared") {
        correct_encrypted_key = access_info.encryptedFolderKey;
        
    } else if (access_info.accessType === "shared_subfolder") {
        correct_encrypted_key = result.encrypted_key_data_parent;
    }

    return { 
        folder_id: result.folder_id, 
        parent_id: result.parent_id, 
        // We pass the dynamically chosen key back as the main data property
        encrypted_key_data: correct_encrypted_key, 
        encrypted_key_data_parent: result.encrypted_key_data_parent, 
        encrypted_name_data: result.encrypted_name_data 
    };
}