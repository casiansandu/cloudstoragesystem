import { Request, Response } from 'express';
import { getAllUsersService } from '../../services/users/getAllUsersService';
import { User } from '../../types';

interface GetAllUsersResponse {
  users: User[];
}

export async function getAllUsersController(
  _req: Request,
  res: Response<GetAllUsersResponse | { message: string }>
): Promise<void> {
  try {
    const users = await getAllUsersService();
    res.status(200).json({ users });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export default getAllUsersController;
