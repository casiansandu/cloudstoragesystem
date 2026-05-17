import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/config';

export async function noAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies.token as string;

  if (!token) {
    next();
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    res.status(403).json({ message: 'Already logged in', success: false });
  } catch {
    next();
  }
}

export default noAuthMiddleware;
