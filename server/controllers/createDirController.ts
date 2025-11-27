import { Response } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FILESYSTEM_ROOT } from '../config/config';
import { CreateDirRequest } from '../types';

export async function createDirController(
  req: CreateDirRequest,
  res: Response
): Promise<void> {
  const username = req.user;
  const { folderPath } = req.body;

  if (!username) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  if (!folderPath) {
    res.status(400).json({ error: 'folderPath is required' });
    return;
  }

  // Remove leading slashes to prevent path.join issues
  const safeFolderPath = folderPath.replace(/^\/+/, '');
  const usernameSpace = username;
  const fullPath = path.join(FILESYSTEM_ROOT, usernameSpace, safeFolderPath);

  try {
    await fs.mkdir(fullPath, { recursive: false });
    res.status(200).json({ message: `Successfully created directory ${folderPath}` });
  } catch (error) {
    const err = error as Error;
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

export default createDirController;
