import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth';
import { importOperations } from '@/lib/importOperations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const { operations } = req.body ?? {};

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ message: 'Список операций пуст' });
  }

  const result = await importOperations({
    operations,
    userId,
    type: 'EXPENSE',
  });

  if (result.nothingToImport) {
    return res.status(400).json({ message: 'Не осталось валидных операций для импорта', skipped: result.skipped });
  }

  return res.status(201).json(result);
}
