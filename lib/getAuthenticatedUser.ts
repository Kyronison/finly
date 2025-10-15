import type { GetServerSidePropsContext } from 'next';
import jwt from 'jsonwebtoken';

import { authCookieName } from './auth';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export async function getAuthenticatedUser(
  context: GetServerSidePropsContext,
): Promise<AuthenticatedUser | null> {
  const { prisma } = await import('./prisma');
  const cookies = context.req.cookies ?? {};
  const token = cookies[authCookieName];
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'change-me') as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true },
    });

    return user ?? null;
  } catch (error) {
    return null;
  }
}
