import type { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "../types/index.js";

export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiResponse<null>>,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: "An unexpected error occurred",
  });
}
