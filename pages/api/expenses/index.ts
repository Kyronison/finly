import type { NextApiRequest, NextApiResponse } from 'next';
import { endOfMonth, formatISO, parseISO, startOfMonth } from 'date-fns';

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
    return listExpenses(req, res);
  }

  if (req.method === 'POST') {
    return createExpense(req, res);
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).json({ message: 'Method not allowed' });
}

async function listExpenses(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { month } = req.query;
  const { start, end } = resolveMonthRange(typeof month === 'string' ? month : undefined);

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
    },
    include: { category: true },
    orderBy: { date: 'desc' },
  });

  const totals = {
    income: 0,
    expenses: 0,
  };

  const daily = new Map<string, number>();

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    if (expense.category?.type === 'INCOME') {
      totals.income += amount;
    } else {
      totals.expenses += amount;
    }

    const key = formatISO(expense.date, { representation: 'date' });
    daily.set(key, (daily.get(key) ?? 0) + amount);
  });

  return res.status(200).json({
    expenses: expenses.map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
    totals,
    daily: Array.from(daily.entries()).map(([date, value]) => ({ date, value })),
  });
}

async function createExpense(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { amount, categoryId, description, date } = req.body ?? {};
  const numericAmount = Number(amount);

  if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Сумма должна быть больше 0' });
  }

  let parsedDate: Date;
  if (date) {
    parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Некорректная дата' });
    }
  } else {
    parsedDate = new Date();
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
  }

  const expense = await prisma.expense.create({
    data: {
      amount: numericAmount,
      categoryId: categoryId ?? null,
      description: description ?? null,
      date: parsedDate,
      userId,
    },
    include: { category: true },
  });

  return res.status(201).json({ expense: { ...expense, amount: Number(expense.amount) } });
}
