import { Request, Response } from "express";
import { verifyJwtToken } from "../services/verifyJwt";

export const checkLoginStatus = async (req: Request, res: Response) => {
  const token = req.cookies?.token;

  try {
    const username = await verifyJwtToken(token);
    console.log(username);
    if (username) {
      res.status(200).json({
        success: true,
        isAuthenticated: true,
        message: "User is logged in",
      });
    }
  } catch {
    res.status(200).json({
      success: true,
      isAuthenticated: false,
      message: "User is not logged in",
    });
  }
};
