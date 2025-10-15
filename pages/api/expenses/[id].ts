import type { NextApiRequest, NextApiResponse } from 'next';
import { CategoryType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PUT') {
    return updateExpense(req, res);
  }

  if (req.method === 'DELETE') {
    return deleteExpense(req, res);
  }

  res.setHeader('Allow', 'PUT,DELETE');
  return res.status(405).json({ message: 'Method not allowed' });
}

async function updateExpense(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Некорректный идентификатор' });
  }

  const current = await prisma.expense.findFirst({ where: { id, userId }, include: { category: true } });
  if (!current) {
    return res.status(404).json({ message: 'Трата не найдена' });
  }

  const { amount, categoryId, description, date } = req.body ?? {};

  const data: Record<string, unknown> = {};
  if (amount !== undefined) {
    const numericAmount = Number(amount);
    if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Сумма должна быть больше 0' });
    }
    data.amount = numericAmount;
  }

  if (description !== undefined) {
    data.description = description;
  }

  if (date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ message: 'Некорректная дата' });
    }
    data.date = parsed;
  }

  if (categoryId !== undefined) {
    const currentType = current.category?.type ?? CategoryType.EXPENSE;

    if (categoryId === null) {
      if (currentType === CategoryType.INCOME) {
        return res.status(400).json({ message: 'Доходы должны быть привязаны к категории' });
      }
      data.categoryId = null;
    } else {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) {
        return res.status(404).json({ message: 'Категория не найдена' });
      }

      if (category.type !== currentType) {
        return res
          .status(400)
          .json({ message: 'Нельзя менять тип операции, выберите подходящую категорию' });
      }

      data.categoryId = categoryId;
    }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data,
    include: { category: true },
  });

  return res.status(200).json({ expense: { ...updated, amount: Number(updated.amount) } });
}

async function deleteExpense(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Некорректный идентификатор' });
  }

  const current = await prisma.expense.findFirst({ where: { id, userId } });
  if (!current) {
    return res.status(404).json({ message: 'Трата не найдена' });
  }

  await prisma.expense.delete({ where: { id } });
  return res.status(200).json({ success: true });
}
