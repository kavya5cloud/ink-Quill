import crypto from 'crypto';
import { sql } from './db';

type ReqLike = { headers?: { cookie?: string } };
type ResLike = { setHeader: (name: string, value: string) => void };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashVerify = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashVerify, 'hex'));
}

function getCookie(req: ReqLike, key: string): string | null {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === key) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

export function setSessionCookie(res: ResLike, sessionId: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session_id=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

export function clearSessionCookie(res: ResLike) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export async function createSession(userId: string) {
  const id = crypto.randomUUID();
  await sql`INSERT INTO sessions (id, user_id) VALUES (${id}, ${userId})`;
  return id;
}

export async function getUserByRequest(req: ReqLike) {
  const sessionId = getCookie(req, 'session_id');
  if (!sessionId) return null;

  const result = await sql`
    SELECT users.id, users.email, users.created_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ${sessionId}
    LIMIT 1
  `;

  if (!result.rows.length) return null;
  return result.rows[0];
}

export async function deleteSessionFromRequest(req: ReqLike) {
  const sessionId = getCookie(req, 'session_id');
  if (!sessionId) return;
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}
