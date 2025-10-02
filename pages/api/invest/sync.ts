import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { syncTinkoffPortfolio } from '@/lib/tbank';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const connection = await prisma.portfolioConnection.findUnique({ where: { userId } });
  if (!connection) {
    return res.status(404).json({ message: 'Сначала подключите инвестиционный портфель' });
  }

  try {
    await syncTinkoffPortfolio(connection.id);
    const fresh = await prisma.portfolioConnection.findUnique({
      where: { id: connection.id },
      select: { id: true, lastSyncedAt: true },
    });

    return res.status(200).json({
      connection: fresh,
    });
  } catch (error) {
    console.error('Failed to sync portfolio', error);
    return res.status(500).json({ message: 'Не удалось синхронизировать портфель. Попробуйте позже.' });
  }
}
