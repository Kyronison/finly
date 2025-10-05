import type { NextApiRequest, NextApiResponse } from 'next';
import { CategoryType } from '@prisma/client';
import { endOfMonth, parseISO, startOfMonth } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

function resolveMonthRange(month?: string) {
  if (!month) {
    const now = new Date();
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }

  const parsed = parseISO(`${month}-01`);
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }

  return { start: startOfMonth(parsed), end: endOfMonth(parsed) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return getCategories(req, res);
  }

  if (req.method === 'POST') {
    return createCategory(req, res);
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).json({ message: 'Method not allowed' });
}

async function getCategories(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { month } = req.query;
  const { start, end } = resolveMonthRange(typeof month === 'string' ? month : undefined);

  const [categories, operations] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        categoryId: { not: null },
      },
      include: { category: true },
    }),
  ]);

  const totalsByCategory = new Map<string, { income: number; expenses: number }>();
  operations.forEach((operation) => {
    if (!operation.categoryId || !operation.category) return;
    const amount = Number(operation.amount);
    const bucket = totalsByCategory.get(operation.categoryId) ?? { income: 0, expenses: 0 };
    if (operation.category.type === CategoryType.INCOME) {
      bucket.income += amount;
    } else {
      bucket.expenses += amount;
    }
    totalsByCategory.set(operation.categoryId, bucket);
  });

  const enriched = categories.map((category) => {
    const bucket = totalsByCategory.get(category.id) ?? { income: 0, expenses: 0 };
    const spent = bucket.expenses;
    const earned = bucket.income;
    const budget = category.budget ?? undefined;
    const progress =
      category.type === CategoryType.EXPENSE && budget ? Math.min(1, spent / budget) : null;
    return {
      ...category,
      spent,
      earned,
      progress,
    };
  });

  return res.status(200).json({ categories: enriched });
}

async function createCategory(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { name, type, budget, color } = req.body ?? {};

  if (!name) {
    return res.status(400).json({ message: 'Название категории обязательно' });
  }

  const normalizedType = type === 'INCOME' ? CategoryType.INCOME : CategoryType.EXPENSE;
  const parsedBudget = typeof budget === 'number' ? Math.max(0, Math.round(budget)) : null;
  const palette = ['#f97316', '#4f46e5', '#22d3ee', '#ff6b6b', '#39d98a', '#facc15', '#a855f7'];

  const category = await prisma.category.create({
    data: {
      name,
      type: normalizedType,
      budget: parsedBudget,
      color: color || palette[Math.floor(Math.random() * palette.length)],
      userId,
    },
  });

  return res.status(201).json({ category });
}
