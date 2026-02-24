import { ensureSchema, sql } from '../_lib/db';
import { createSession, setSessionCookie, verifyPassword } from '../_lib/auth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL is not configured' });
  }

  await ensureSchema();

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
  const user = result.rows[0] as { id: string; email: string; password_hash: string } | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = await createSession(user.id);
  setSessionCookie(res, sessionId);
  return res.status(200).json({ id: user.id, email: user.email });
}
