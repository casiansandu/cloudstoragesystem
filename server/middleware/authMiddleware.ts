import { Response, NextFunction } from 'express';
import { verifyJWT } from '../services/decodeJwtToken';
import { AuthenticatedRequest } from '../types';

export async function verifyAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const { username } = await verifyJWT(token);
    req.user = username;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid session' });
  }
}

export default verifyAuthMiddleware;
