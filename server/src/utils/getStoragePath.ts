import crypto from 'node:crypto';
import path from 'node:path';
import config from '../../config/config';

const SALT = process.env.FOLDER_NAMING_SECRET || "default_unsafe_salt";

export const getStoragePath = (file_id: string) => {
    const folderName = crypto
        .createHmac('sha256', SALT)
        .update(file_id)
        .digest('hex');

    return path.join(config.FILESYSTEM_ROOT, folderName);
};