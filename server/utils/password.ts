import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  const result = await bcrypt.compare(password, hashedPassword);
  return result;
}
