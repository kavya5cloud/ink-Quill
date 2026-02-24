import crypto from 'crypto';
import { ensureSchema, sql } from '../_lib/db';
import { createSession, hashPassword, setSessionCookie } from '../_lib/auth';
import { readJsonBody } from '../_lib/request';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL is not configured' });
  }

  await ensureSchema();

  const body = await readJsonBody<{ email?: string; password?: string }>(req);
  const { email, password } = body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  try {
    await sql`INSERT INTO users (id, email, password_hash) VALUES (${id}, ${email}, ${passwordHash})`;
    const sessionId = await createSession(id);
    setSessionCookie(res, sessionId);
    return res.status(200).json({ id, email });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
