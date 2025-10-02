import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { removeSensitiveUserFields, setAuthCookie, signToken } from '@/lib/auth';

const DEFAULT_CATEGORIES: Array<{
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  budget: number | null;
}> = [
  { name: 'Зарплата', type: 'INCOME', color: '#39d98a', budget: null },
  { name: 'Инвестиции', type: 'EXPENSE', color: '#f5a524', budget: 30000 },
  { name: 'Продукты', type: 'EXPENSE', color: '#ff6b6b', budget: 20000 },
  { name: 'Транспорт', type: 'EXPENSE', color: '#4f46e5', budget: 8000 },
  { name: 'Развлечения', type: 'EXPENSE', color: '#f97316', budget: 12000 },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password, name } = req.body ?? {};

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, имя и пароль обязательны' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      categories: {
        create: DEFAULT_CATEGORIES,
      },
    },
    include: {
      categories: true,
    },
  });

  const token = signToken({ userId: user.id });
  setAuthCookie(res, token);

  return res.status(201).json({ user: removeSensitiveUserFields(user) });
}
