import { getUserByRequest } from '../_lib/auth';
import { ensureSchema, sql } from '../_lib/db';
import { readJsonBody } from '../_lib/request';

export default async function handler(req: any, res: any) {
  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL is not configured' });
  }

  await ensureSchema();
  const id = req.query?.id;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  if (req.method === 'GET') {
    const postResult = await sql`SELECT * FROM posts WHERE id = ${id} LIMIT 1`;
    const post = postResult.rows[0] as any;
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const user = await getUserByRequest(req);
    if (!user && post.status !== 'published') {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (user && post.user_id && post.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json(post);
  }

  if (req.method === 'PUT') {
    const user = await getUserByRequest(req);
    if (!user) return res.status(401).json({ error: 'Login required' });

    const body = await readJsonBody<{ title?: string; content?: string; excerpt?: string; status?: string }>(req);
    const { title, content, excerpt, status } = body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const postStatus = status === 'published' ? 'published' : 'draft';

    const result = await sql`
      UPDATE posts
      SET title = ${title}, content = ${content}, excerpt = ${excerpt || ''}, status = ${postStatus}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `;

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.status(200).json({ id, title, content, excerpt: excerpt || '', status: postStatus });
  }

  if (req.method === 'DELETE') {
    const user = await getUserByRequest(req);
    if (!user) return res.status(401).json({ error: 'Login required' });

    const result = await sql`DELETE FROM posts WHERE id = ${id} AND user_id = ${user.id} RETURNING id`;
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.status(204).send('');
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
