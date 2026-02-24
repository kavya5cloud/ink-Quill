import { clearSessionCookie, deleteSessionFromRequest } from '../_lib/auth';
import { ensureSchema } from '../_lib/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL is not configured' });
  }

  await ensureSchema();
  await deleteSessionFromRequest(req);
  clearSessionCookie(res);
  return res.status(204).send('');
}
