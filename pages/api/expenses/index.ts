import type { NextApiRequest, NextApiResponse } from 'next';
import { formatISO, startOfMonth } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { buildTimelineRange, enumerateMonths, formatMonthKey, resolvePeriod } from '@/lib/period';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return listExpenses(req, res);
  }

  if (req.method === 'POST') {
    return createExpense(req, res);
  }

  if (req.method === 'DELETE') {
    return deleteAllExpenses(req, res);
  }

  res.setHeader('Allow', 'GET,POST,DELETE');
  return res.status(405).json({ message: 'Method not allowed' });
}

async function listExpenses(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { start, end } = resolvePeriod(
    typeof req.query.start === 'string' ? req.query.start : undefined,
    typeof req.query.end === 'string' ? req.query.end : undefined,
  );

  const [rawExpenses, timelineExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      include: { category: true },
      orderBy: { date: 'desc' },
    }),
    (async () => {
      const { from, to } = buildTimelineRange(start);
      return prisma.expense.findMany({
        where: {
          userId,
          date: {
            gte: from,
            lte: to,
          },
        },
        include: { category: true },
      });
    })(),
  ]);

  const totals = {
    income: 0,
    expenses: 0,
  };

  rawExpenses.forEach((expense) => {
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

  timelineExpenses.forEach((operation) => {
    const monthKey = formatMonthKey(operation.date);
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

  const { from: timelineStart, to: timelineEnd } = buildTimelineRange(start);
  const monthly: Array<{ date: string; income: number; expenses: number }> = [];

  enumerateMonths(timelineStart, timelineEnd).forEach((cursor) => {
    const monthKey = formatMonthKey(cursor);
    const bucket = monthlyTotals.get(monthKey);
    monthly.push({
      date: formatISO(startOfMonth(cursor), { representation: 'date' }),
      income: bucket?.income ?? 0,
      expenses: bucket?.expenses ?? 0,
    });
  });

  const expenses = rawExpenses.map((item) => ({
    ...item,
    amount: Number(item.amount),
  }));

  return res.status(200).json({
    expenses,
    totals,
    monthly,
    periodStart: formatISO(start, { representation: 'date' }),
    periodEnd: formatISO(end, { representation: 'date' }),
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

async function deleteAllExpenses(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const result = await prisma.expense.deleteMany({ where: { userId } });

  return res.status(200).json({ deleted: result.count });
}
