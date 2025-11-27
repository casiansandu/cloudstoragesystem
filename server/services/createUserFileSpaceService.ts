import { promises as fs } from 'fs';

interface CreateUserFileSpaceParams {
  username: string;
}

export async function createUserFileSpace({ username }: CreateUserFileSpaceParams): Promise<string> {
  const folderName = `./FileSpace/${username}/`;

  await fs.mkdir(folderName, { recursive: true });

  return folderName;
}

export default createUserFileSpace;
