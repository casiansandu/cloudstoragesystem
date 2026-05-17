import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { JWT_SECRET } from '../config/config';
import jwt from 'jsonwebtoken';

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.token as string;

  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const { id, username } = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    req.user = {id, username};
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

export default authMiddleware;
