import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

const config: Config = {
  PORT: process.env.PORT || '3000',
  JWT_SECRET: process.env.JWT_SECRET || '',
  DB_NAME: process.env.DB_NAME || '',
  DB_USERNAME: process.env.DB_USERNAME || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  FILESYSTEM_ROOT: process.env.FILESYSTEM_ROOT || '',
  REDIS_URL: process.env.REDIS_URL || '',
  FOLDER_NAMING_SECRET: process.env.FOLDER_NAMING_SECRET || '',
};

// Validate required environment variables
const requiredEnvVars: (keyof Config)[] = ['JWT_SECRET', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD', 'FILESYSTEM_ROOT', 'REDIS_URL', 'FOLDER_NAMING_SECRET'];
const missingEnvVars = requiredEnvVars.filter(key => !config[key]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const { PORT, JWT_SECRET, DB_NAME, DB_USERNAME, DB_PASSWORD, FILESYSTEM_ROOT, REDIS_URL, FOLDER_NAMING_SECRET } = config;
export default config;
