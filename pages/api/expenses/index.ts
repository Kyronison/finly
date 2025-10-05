import type { NextApiRequest, NextApiResponse } from 'next';
import { addMonths, endOfMonth, format, formatISO, parseISO, startOfMonth } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

function parseBoundary(value?: string) {
  if (!value) return null;

  const normalized = value.length === 7 ? `${value}-01` : value;
  const parsed = parseISO(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function resolvePeriod(startRaw?: string, endRaw?: string) {
  const now = new Date();
  const fallbackStart = startOfMonth(now);
  const fallbackEnd = endOfMonth(now);

  const parsedStart = parseBoundary(startRaw);
  const parsedEnd = parseBoundary(endRaw);

  let start = startOfMonth(parsedStart ?? fallbackStart);
  let end = endOfMonth(parsedEnd ?? fallbackEnd);

  if (start.getTime() > end.getTime()) {
    const tmp = start;
    start = startOfMonth(end);
    end = endOfMonth(tmp);
  }

  return { start, end };
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

  const { start, end } = resolvePeriod(
    typeof req.query.start === 'string' ? req.query.start : undefined,
    typeof req.query.end === 'string' ? req.query.end : undefined,
  );

  const operations = await prisma.expense.findMany({
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

  operations.forEach((expense) => {
    if (expense.category?.type === 'INCOME') {
      totals.income += Number(expense.amount);
    } else {
      totals.expenses += Number(expense.amount);
    }
  });

  const monthlyTotals = new Map<
    string,
    {
      date: Date;
      income: number;
      expenses: number;
    }
  >();

  operations.forEach((operation) => {
    const monthKey = format(operation.date, 'yyyy-MM');
    const bucket =
      monthlyTotals.get(monthKey) ?? {
        date: startOfMonth(operation.date),
        income: 0,
        expenses: 0,
      };

    const amount = Number(operation.amount);
    if (operation.category?.type === 'INCOME') {
      bucket.income += amount;
    } else {
      bucket.expenses += amount;
    }

    monthlyTotals.set(monthKey, bucket);
  });

  const timelineStart = startOfMonth(start);
  const timelineEnd = endOfMonth(end);
  const monthly: Array<{ date: string; income: number; expenses: number }> = [];

  for (
    let cursor = timelineStart;
    cursor.getTime() <= timelineEnd.getTime();
    cursor = addMonths(cursor, 1)
  ) {
    const monthKey = format(cursor, 'yyyy-MM');
    const bucket = monthlyTotals.get(monthKey);
    monthly.push({
      date: formatISO(startOfMonth(cursor), { representation: 'date' }),
      income: bucket?.income ?? 0,
      expenses: bucket?.expenses ?? 0,
    });
  }

  return res.status(200).json({
    expenses: operations.map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
    totals,
    monthly,
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
