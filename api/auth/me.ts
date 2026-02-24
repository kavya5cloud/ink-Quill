import { getUserByRequest } from '../_lib/auth';
import { ensureSchema } from '../_lib/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ error: 'POSTGRES_URL is not configured' });
  }

  await ensureSchema();
  const user = await getUserByRequest(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.status(200).json(user);
}
