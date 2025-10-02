import type { NextApiRequest, NextApiResponse } from 'next';
import { endOfMonth, formatISO, parseISO, startOfMonth, subDays } from 'date-fns';

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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const { month } = req.query;
  const { start, end } = resolveMonthRange(typeof month === 'string' ? month : undefined);

  const [categories, expenses] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.expense.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { category: true },
      orderBy: { date: 'desc' },
    }),
  ]);

  const totals = { income: 0, expenses: 0 };
  const byCategory = new Map<string, { category: (typeof categories)[number] | null; spent: number }>();
  const daySet = new Set<string>();

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    const key = expense.categoryId ?? 'uncategorized';
    const entry = byCategory.get(key);
    if (entry) {
      entry.spent += amount;
    } else {
      byCategory.set(key, { category: expense.category ?? null, spent: amount });
    }

    if (expense.category?.type === 'INCOME') {
      totals.income += amount;
    } else {
      totals.expenses += amount;
    }

    daySet.add(formatISO(expense.date, { representation: 'date' }));
  });

  const breakdown = categories
    .filter((category) => category.type === 'EXPENSE')
    .map((category) => {
      const spent = byCategory.get(category.id)?.spent ?? 0;
      return {
        id: category.id,
        name: category.name,
        color: category.color,
        spent,
        budget: category.budget,
        progress: category.budget ? Math.min(1, spent / category.budget) : null,
      };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);

  const uncategorized = byCategory.get('uncategorized');

  const streak = (() => {
    let current = 0;
    let pointer = new Date();
    for (let i = 0; i < 30; i += 1) {
      const key = formatISO(pointer, { representation: 'date' });
      if (daySet.has(key)) {
        current += 1;
      } else {
        break;
      }
      pointer = subDays(pointer, 1);
    }
    return current;
  })();

  return res.status(200).json({
    totals: {
      income: totals.income,
      expenses: totals.expenses,
      balance: totals.income - totals.expenses,
    },
    breakdown,
    uncategorized: uncategorized?.spent ?? 0,
    streak,
  });
}
