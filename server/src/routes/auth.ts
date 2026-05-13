import { Router } from "express";
import jwt from "jsonwebtoken";

interface AuthConfig {
  authUsername: string;
  authPassword: string;
  jwtSecret: string;
}

export function createAuthRouter(config: AuthConfig): Router {
  const router = Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    if (username !== config.authUsername || password !== config.authPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: "7d" });
    res.json({ token });
  });

  return router;
}
