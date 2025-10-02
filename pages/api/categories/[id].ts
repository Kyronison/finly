import type { NextApiRequest, NextApiResponse } from 'next';
import { CategoryType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PUT') {
    return updateCategory(req, res);
  }

  if (req.method === 'DELETE') {
    return deleteCategory(req, res);
  }

  res.setHeader('Allow', 'PUT,DELETE');
  return res.status(405).json({ message: 'Method not allowed' });
}

async function updateCategory(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Некорректный идентификатор' });
  }

  const { name, type, budget, color } = req.body ?? {};

  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (type) data.type = type === 'INCOME' ? CategoryType.INCOME : CategoryType.EXPENSE;
  if (color) data.color = color;
  if (budget !== undefined) data.budget = budget === null ? null : Math.max(0, Math.round(Number(budget)));

  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) {
    return res.status(404).json({ message: 'Категория не найдена' });
  }

  const updated = await prisma.category.update({
    where: { id },
    data,
  });

  return res.status(200).json({ category: updated });
}

async function deleteCategory(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Некорректный идентификатор' });
  }

  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) {
    return res.status(404).json({ message: 'Категория не найдена' });
  }

  await prisma.category.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
