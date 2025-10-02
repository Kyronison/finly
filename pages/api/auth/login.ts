import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { removeSensitiveUserFields, setAuthCookie, signToken } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email и пароль обязательны' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { categories: true },
  });

  if (!user) {
    return res.status(401).json({ message: 'Неверные учетные данные' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Неверные учетные данные' });
  }

  const token = signToken({ userId: user.id });
  setAuthCookie(res, token);

  return res.status(200).json({ user: removeSensitiveUserFields(user) });
}
