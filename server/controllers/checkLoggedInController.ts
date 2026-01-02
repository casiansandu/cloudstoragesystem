import { Request, Response } from "express";
import { verifyJwt } from "../services/verifyJwt";
import { ApiErrorResponse, ApiSuccessResponse, LoginStatusResponse } from "../types";


export const checkLoginStatus = async (req: Request, res: Response<ApiSuccessResponse<LoginStatusResponse> | ApiErrorResponse>) => {
  const token = req.cookies?.token;

  try {
    const username = await verifyJwt(token);
    //console.log(username);
    if (username) {
      res.status(200).json({
        success: true,
        data: { isAuthenticated: true },
        message: "User is logged in",
      });
      return;
    }
  } catch {
    res.status(200).json({
      success: true,
      data: { isAuthenticated: false },
      message: "User is not logged in",
    });
    return;
  }
};
