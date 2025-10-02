import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'finly_token';
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface AuthTokenPayload {
  userId: string;
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_MAX_AGE });
}

export function setAuthCookie(res: NextApiResponse, token: string) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_MAX_AGE}`);
}

export function clearAuthCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function getTokenFromRequest(req: NextApiRequest) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(cookieHeader.split(';').map((pair) => pair.trim().split('=')));
  return cookies[COOKIE_NAME] ?? null;
}

export function getUserIdFromRequest(req: NextApiRequest): string | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

export function requireAuth(req: NextApiRequest, res: NextApiResponse): string | null {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }
  return userId;
}

export function removeSensitiveUserFields<T extends { passwordHash?: string }>(user: T) {
  if (!user) return user;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

export const authCookieName = COOKIE_NAME;
