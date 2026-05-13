import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, jwtSecret);
      (req as any).user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}
