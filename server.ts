import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("blog.db");

// Initialize database
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Ensure posts table has user_id column for older DBs
try {
  db.prepare("SELECT user_id FROM posts LIMIT 1").get();
} catch {
  db.exec(`ALTER TABLE posts ADD COLUMN user_id TEXT;`);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashVerify = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashVerify, "hex"));
}

function createSession(userId: string) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (id, user_id) VALUES (?, ?)").run(id, userId);
  return id;
}

function getUserBySession(sessionId: string | undefined) {
  if (!sessionId) return null;
  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as { id: string; user_id: string } | undefined;
  if (!session) return null;
  const user = db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(session.user_id);
  return user || null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple cookie parser
  app.use((req: Request & { cookies?: Record<string, string> }, _res, next) => {
    const header = req.headers.cookie;
    const cookies: Record<string, string> = {};
    if (header) {
      header.split(";").forEach((pair) => {
        const [k, v] = pair.split("=").map((s) => s.trim());
        if (k) cookies[decodeURIComponent(k)] = decodeURIComponent(v || "");
      });
    }
    req.cookies = cookies;
    next();
  });

  // Attach current user from session cookie
  app.use((req: Request & { user?: any; cookies?: Record<string, string> }, _res, next: NextFunction) => {
    const sessionId = req.cookies?.session_id;
    const user = getUserBySession(sessionId);
    if (user) {
      req.user = user;
    }
    next();
  });

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Auth routes
  app.post("/api/auth/register", (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    try {
      const id = crypto.randomUUID();
      const password_hash = hashPassword(password);
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(id, email, password_hash);
      const sessionId = createSession(id);
      res
        .cookie("session_id", sessionId, {
          httpOnly: true,
          sameSite: "lax",
        } as any)
        .json({ id, email });
    } catch (e: any) {
      if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "Email already in use" });
      }
      console.error(e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as { id: string; email: string; password_hash: string } | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const sessionId = createSession(user.id);
    res
      .cookie("session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
      } as any)
      .json({ id: user.id, email: user.email });
  });

  app.post("/api/auth/logout", (req: Request & { cookies?: Record<string, string> }, res: Response) => {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    }
    res
      .clearCookie("session_id" as any)
      .status(204)
      .send();
  });

  app.get("/api/auth/me", (req: Request & { user?: any }, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
  });

  // API Routes
  app.get("/api/posts", (req: Request & { user?: any }, res: Response) => {
    const userId = req.user?.id;
    const posts = userId
      ? db.prepare("SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC").all(userId)
      : db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all();
    res.json(posts);
  });

  app.get("/api/posts/:id", (req, res) => {
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  app.post("/api/posts", (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Login required" });
    const { id, title, content, excerpt, status } = req.body;
    const stmt = db.prepare(`
      INSERT INTO posts (id, user_id, title, content, excerpt, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, req.user.id, title, content, excerpt, status);
    res.status(201).json({ id, title, content, excerpt, status });
  });

  app.put("/api/posts/:id", (req, res) => {
    const { title, content, excerpt, status } = req.body;
    const stmt = db.prepare(`
      UPDATE posts 
      SET title = ?, content = ?, excerpt = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(title, content, excerpt, status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: "Post not found" });
    res.json({ id: req.params.id, title, content, excerpt, status });
  });

  app.delete("/api/posts/:id", (req, res) => {
    console.log(`DELETE request for post: ${req.params.id}`);
    try {
      const stmt = db.prepare("DELETE FROM posts WHERE id = ?");
      const result = stmt.run(req.params.id);
      if (result.changes === 0) {
        console.log(`Post not found: ${req.params.id}`);
        return res.status(404).json({ error: "Post not found" });
      }
      console.log(`Post deleted: ${req.params.id}`);
      res.status(204).send();
    } catch (e: any) {
      console.error(`Error deleting post: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
