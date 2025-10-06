import type { NextApiRequest, NextApiResponse } from 'next';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const connection = await prisma.portfolioConnection.findUnique({
    where: { userId },
    select: {
      id: true,
      accountId: true,
      brokerAccountType: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  if (!connection) {
    return res.status(200).json({ connection: null });
  }

  const [positions, operations, dividends, snapshots] = await Promise.all([
    prisma.portfolioPosition.findMany({
      where: { connectionId: connection.id },
      orderBy: { expectedYieldPercent: 'asc' },
    }),
    prisma.portfolioOperation.findMany({
      where: { connectionId: connection.id },
      orderBy: { date: 'desc' },
      take: 200,
    }),
    prisma.portfolioDividend.findMany({
      where: { connectionId: connection.id },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.portfolioSnapshot.findMany({
      where: { connectionId: connection.id },
      orderBy: { capturedAt: 'asc' },
    }),
  ]);

  const formattedPositions = positions.map((position) => {
    const invested = (position.averagePositionPrice ?? 0) * position.balance;
    const currentValue =
      position.currentPrice != null
        ? position.currentPrice * position.balance
        : invested + (position.expectedYield ?? 0);

    return {
      id: position.id,
      figi: position.figi,
      ticker: position.ticker,
      name: position.name,
      instrumentType: position.instrumentType,
      balance: position.balance,
      lot: position.lot,
      averagePrice: position.averagePositionPrice,
      expectedYield: position.expectedYield,
      expectedYieldPercent: position.expectedYieldPercent,
      currentPrice: position.currentPrice,
      investedAmount: Math.round(invested * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
      currency: position.currency,
      brandLogoName: position.brandLogoName,
    };
  });

  const formattedOperations = operations.map((operation) => ({
    id: operation.id,
    operationId: operation.operationId,
    figi: operation.figi,
    ticker: operation.ticker,
    instrumentType: operation.instrumentType,
    operationType: operation.operationType,
    payment: operation.payment,
    price: operation.price,
    quantity: operation.quantity,
    currency: operation.currency,
    date: operation.date,
    description: operation.description,
    commission: operation.commission,
  }));

  const formattedDividends = dividends.map((dividend) => ({
    id: dividend.id,
    figi: dividend.figi,
    ticker: dividend.ticker,
    amount: dividend.amount,
    currency: dividend.currency,
    paymentDate: dividend.paymentDate,
  }));

  const dividendsByMonthMap = new Map<string, { total: number; currency: string }>();
  formattedDividends.forEach((dividend) => {
    const key = format(dividend.paymentDate, 'yyyy-MM');
    const mapKey = `${key}_${dividend.currency ?? 'RUB'}`;
    const bucket = dividendsByMonthMap.get(mapKey) ?? { total: 0, currency: dividend.currency ?? 'RUB' };
    bucket.total += dividend.amount;
    dividendsByMonthMap.set(mapKey, bucket);
  });

  const dividendsByMonth = Array.from(dividendsByMonthMap.entries())
    .map(([key, value]) => {
      const [month, currency] = key.split('_');
      const date = new Date(`${month}-01T00:00:00.000Z`);
      const label = format(date, 'LLLL yyyy', { locale: ru });
      return {
        month,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        total: Math.round(value.total * 100) / 100,
        currency,
      };
    })
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, 12);

  const charts = new Map<string, Array<{ date: string; value: number; expectedYield?: number | null }>>();
  snapshots.forEach((snapshot) => {
    const key = snapshot.currency;
    const bucket = charts.get(key) ?? [];
    bucket.push({
      date: snapshot.capturedAt.toISOString(),
      value: snapshot.totalAmount,
      expectedYield: snapshot.expectedYield,
    });
    charts.set(key, bucket);
  });

  return res.status(200).json({
    connection,
    positions: formattedPositions,
    operations: formattedOperations,
    dividends: formattedDividends,
    dividendsByMonth,
    charts: Array.from(charts.entries()).map(([currency, points]) => ({ currency, points })),
  });
}
