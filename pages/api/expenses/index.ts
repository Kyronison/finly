import type { NextApiRequest, NextApiResponse } from 'next';
import { CategoryType } from '@prisma/client';
import { formatISO, startOfMonth } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { enumerateMonths, formatMonthKey, resolvePeriod } from '@/lib/period';
import { shouldIgnoreCategory } from '@/lib/financeFilters';

const UNCATEGORIZED_CATEGORY_ID = 'uncategorized';

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

  const rawExpenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
    },
    include: { category: true },
    orderBy: { date: 'desc' },
  });

  const filteredRawExpenses = rawExpenses.filter((expense) => !shouldIgnoreCategory(expense.category));

  const totals = {
    income: 0,
    expenses: 0,
  };

  filteredRawExpenses.forEach((expense) => {
    if (expense.category?.type === 'INCOME') {
      totals.income += Number(expense.amount);
    } else {
      totals.expenses += Number(expense.amount);
    }
  });

  const expenseOperations = filteredRawExpenses.filter((expense) => expense.category?.type !== 'INCOME');
  const incomeOperations = filteredRawExpenses.filter((expense) => expense.category?.type === 'INCOME');

  const monthlyTotals = new Map<
    string,
    {
      date: Date;
      income: number;
      expenses: number;
      expensesByCategory: Map<
        string,
        {
          amount: number;
          name: string;
          color: string | null;
        }
      >;
    }
  >();

  filteredRawExpenses.forEach((operation) => {
    const monthKey = formatMonthKey(operation.date);
    const bucket =
      monthlyTotals.get(monthKey) ?? {
        date: startOfMonth(operation.date),
        income: 0,
        expenses: 0,
        expensesByCategory: new Map(),
      };

    const amount = Number(operation.amount);
    if (operation.category?.type === 'INCOME') {
      bucket.income += amount;
    } else {
      bucket.expenses += amount;
      const categoryId = operation.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
      const previous = bucket.expensesByCategory.get(categoryId);
      bucket.expensesByCategory.set(categoryId, {
        amount: (previous?.amount ?? 0) + amount,
        name:
          operation.category?.name ??
          previous?.name ??
          (categoryId === UNCATEGORIZED_CATEGORY_ID ? 'Без категории' : 'Другая категория'),
        color: operation.category?.color ?? previous?.color ?? null,
      });
    }

    monthlyTotals.set(monthKey, bucket);
  });

  const monthly: Array<{
    date: string;
    income: number;
    expenses: number;
    expenseBreakdown: Array<{
      id: string;
      name: string;
      color: string | null;
      amount: number;
    }>;
  }> = [];

  enumerateMonths(start, end).forEach((cursor) => {
    const monthKey = formatMonthKey(cursor);
    const bucket = monthlyTotals.get(monthKey);
    monthly.push({
      date: formatISO(startOfMonth(cursor), { representation: 'date' }),
      income: bucket?.income ?? 0,
      expenses: bucket?.expenses ?? 0,
      expenseBreakdown: bucket
        ? Array.from(bucket.expensesByCategory.entries()).map(([id, info]) => ({
            id,
            name: info.name,
            color: info.color,
            amount: info.amount,
          }))
        : [],
    });
  });

  const expenses = expenseOperations.map((item) => ({
    ...item,
    amount: Number(item.amount),
  }));

  const incomes = incomeOperations.map((item) => ({
    ...item,
    amount: Number(item.amount),
  }));

  return res.status(200).json({
    expenses,
    incomes,
    totals,
    monthly,
    periodStart: formatISO(start, { representation: 'date' }),
    periodEnd: formatISO(end, { representation: 'date' }),
  });
}

async function createExpense(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { amount, categoryId, description, date, type } = req.body ?? {};
  const numericAmount = Number(amount);

  const normalizedType =
    typeof type === 'string' && type.toUpperCase() === 'INCOME'
      ? CategoryType.INCOME
      : CategoryType.EXPENSE;

  if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Сумма должна быть больше 0' });
  }

  if (normalizedType === CategoryType.INCOME && !categoryId) {
    return res.status(400).json({ message: 'Доходы должны быть привязаны к категории' });
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

    if (category.type !== normalizedType) {
      return res
        .status(400)
        .json({ message: 'Категория не соответствует выбранному типу операции' });
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
