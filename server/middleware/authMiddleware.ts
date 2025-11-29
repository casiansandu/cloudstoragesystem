import { Response, NextFunction } from 'express';
import { verifyJwtToken } from '../services/verifyJwt';
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
    const { username } = await verifyJwtToken(token);
    req.user = username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

export default verifyAuthMiddleware;
