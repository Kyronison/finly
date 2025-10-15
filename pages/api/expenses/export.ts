import type { NextApiRequest, NextApiResponse } from 'next';
import { format } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { resolvePeriod } from '@/lib/period';

function escapeCell(value: string | number | null | undefined) {
  const stringValue = value ?? '';
  const normalised = typeof stringValue === 'number' ? stringValue.toString() : String(stringValue);
  const escaped = normalised.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const { start, end } = resolvePeriod(
    typeof req.query.start === 'string' ? req.query.start : undefined,
    typeof req.query.end === 'string' ? req.query.end : undefined,
  );

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
    },
    include: { category: true },
    orderBy: { date: 'desc' },
  });

  const header = ['date', 'type', 'category', 'amount', 'description'];
  const rows = expenses.map((expense) => {
    const type = expense.category?.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const formattedDate = format(expense.date, 'yyyy-MM-dd');
    const categoryName = expense.category?.name ?? '';
    const amount = Number(expense.amount).toFixed(2);
    const description = expense.description ?? '';

    return [formattedDate, type, categoryName, amount, description];
  });

  const csvLines = [header, ...rows].map((row) => row.map(escapeCell).join(';'));
  const csvContent = `\uFEFF${csvLines.join('\n')}`;

  const filename = `finly-operations-${format(start, 'yyyyMMdd')}-${format(end, 'yyyyMMdd')}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
}
