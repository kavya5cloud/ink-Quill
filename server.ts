import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("blog.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/posts", (req, res) => {
    const posts = db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all();
    res.json(posts);
  });

  app.get("/api/posts/:id", (req, res) => {
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  app.post("/api/posts", (req, res) => {
    const { id, title, content, excerpt, status } = req.body;
    const stmt = db.prepare(`
      INSERT INTO posts (id, title, content, excerpt, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, content, excerpt, status);
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
