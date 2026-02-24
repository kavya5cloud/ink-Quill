import crypto from 'crypto';
import { getUserByRequest } from '../_lib/auth';
import { ensureSchema, sql } from '../_lib/db';

export default async function handler(req: any, res: any) {
  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL is not configured' });
  }

  await ensureSchema();

  if (req.method === 'GET') {
    const user = await getUserByRequest(req);

    if (user) {
      const posts = await sql`SELECT * FROM posts WHERE user_id = ${user.id} ORDER BY created_at DESC`;
      return res.status(200).json(posts.rows);
    }

    const posts = await sql`SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC`;
    return res.status(200).json(posts.rows);
  }

  if (req.method === 'POST') {
    const user = await getUserByRequest(req);
    if (!user) return res.status(401).json({ error: 'Login required' });

    const { id, title, content, excerpt, status } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const postId = id || crypto.randomUUID();
    const postStatus = status === 'published' ? 'published' : 'draft';

    await sql`
      INSERT INTO posts (id, user_id, title, content, excerpt, status)
      VALUES (${postId}, ${user.id}, ${title}, ${content}, ${excerpt || ''}, ${postStatus})
    `;

    return res.status(201).json({ id: postId, title, content, excerpt: excerpt || '', status: postStatus });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
