import path from 'path';
import { promises as fs } from 'fs';
import { Response, NextFunction } from 'express';
import { FILESYSTEM_ROOT } from '../config/config.js';
import { CreateDirRequest } from '../types/index.js';

export async function checkFolderExists(
  req: CreateDirRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
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

    const userSpace = `/${username}`;
    const locationInUserSpace = path.join(userSpace, folderPath);
    const locationInFileSystem = path.join(FILESYSTEM_ROOT, locationInUserSpace);
    const folderParentDir = path.dirname(locationInFileSystem);

    try {
      const statParent = await fs.stat(folderParentDir);
      if (!statParent.isDirectory()) {
        res.status(400).json({ error: `${path.dirname(folderPath)} is not a directory` });
        return;
      }
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        res.status(400).json({ error: `${path.dirname(folderPath)} does not exist` });
        return;
      }
      res.status(500).json({ error: 'Server error checking parent folder' });
      return;
    }

    try {
      const statFolder = await fs.stat(locationInFileSystem);
      if (statFolder.isDirectory()) {
        res.status(400).json({ error: `Folder ${folderPath} already exists!` });
        return;
      }
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        res.status(500).json({ error: 'Server error checking folder' });
        return;
      }
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
}

export default checkFolderExists;
