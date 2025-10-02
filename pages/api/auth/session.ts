import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest, removeSensitiveUserFields } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(200).json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { categories: true },
  });

  return res.status(200).json({ user: user ? removeSensitiveUserFields(user) : null });
}
