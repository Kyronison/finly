import { endOfMonth, startOfMonth, subDays } from 'date-fns';

import { prisma } from './prisma';
import { enumerateMonths, formatMonthKey } from './period';

interface PassiveIncomeByMonth {
  month: string;
  amount: number;
}

interface CurrencyState {
  entries: Array<{ date: Date; total: number }>;
  index: number;
  previousValue: number | null;
}

export interface PassiveIncomeSummary {
  total: number;
  byMonth: PassiveIncomeByMonth[];
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function calculatePassiveIncomeSummary(
  userId: string,
  start: Date,
  end: Date,
): Promise<PassiveIncomeSummary> {
  const connections = await prisma.portfolioConnection.findMany({
    where: { userId },
    select: { id: true },
  });

  if (connections.length === 0) {
    const months = enumerateMonths(startOfMonth(start), endOfMonth(end));
    return {
      total: 0,
      byMonth: months.map((monthDate) => ({ month: formatMonthKey(monthDate), amount: 0 })),
    };
  }

  const connectionIds = connections.map((connection) => connection.id);
  const boundaryStart = subDays(startOfMonth(start), 1);
  const boundaryEnd = endOfMonth(end);

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: {
      connectionId: { in: connectionIds },
      capturedAt: { gte: boundaryStart, lte: boundaryEnd },
    },
    orderBy: { capturedAt: 'asc' },
  });

  const contributionByMonth = new Map<string, number>();

  const operations = await prisma.portfolioOperation.findMany({
    where: {
      connectionId: { in: connectionIds },
      date: { gte: boundaryStart, lte: boundaryEnd },
    },
    select: {
      date: true,
      payment: true,
      figi: true,
    },
  });

  operations.forEach((operation) => {
    if (operation.figi) return;
    const amount = operation.payment;
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount === 0) {
      return;
    }

    const monthKey = formatMonthKey(operation.date);
    const current = contributionByMonth.get(monthKey) ?? 0;
    contributionByMonth.set(monthKey, current + amount);
  });

  const currencyStates = new Map<string, CurrencyState>();

  snapshots.forEach((snapshot) => {
    const currency = snapshot.currency?.toUpperCase?.() ?? 'RUB';
    const state = currencyStates.get(currency) ?? { entries: [], index: 0, previousValue: null };
    state.entries.push({ date: snapshot.capturedAt, total: snapshot.totalAmount });
    currencyStates.set(currency, state);
  });

  currencyStates.forEach((state) => {
    state.entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  const months = enumerateMonths(startOfMonth(start), endOfMonth(end));
  const monthlyTotals = new Map<string, number>();

  months.forEach((monthDate) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthKey = formatMonthKey(monthDate);

    let monthSum = 0;

    currencyStates.forEach((state) => {
      const { entries } = state;

      while (state.index < entries.length && entries[state.index].date.getTime() < monthStart.getTime()) {
        state.previousValue = entries[state.index].total;
        state.index += 1;
      }

      let firstInMonth: number | null = null;
      let lastInMonth: number | null = null;

      while (state.index < entries.length && entries[state.index].date.getTime() <= monthEnd.getTime()) {
        const value = entries[state.index].total;
        if (firstInMonth == null) {
          firstInMonth = value;
        }
        lastInMonth = value;
        state.index += 1;
      }

      let startValue = state.previousValue;
      if (startValue == null) {
        startValue = firstInMonth;
      }

      const endValue = lastInMonth ?? startValue;
      state.previousValue = endValue ?? state.previousValue;

      if (startValue != null && endValue != null) {
        monthSum += endValue - startValue;
      } else if (endValue != null) {
        monthSum += endValue;
      }
    });

    const contribution = contributionByMonth.get(monthKey) ?? 0;
    monthlyTotals.set(monthKey, roundAmount(monthSum - contribution));
  });

  const total = roundAmount(
    Array.from(monthlyTotals.values()).reduce((sum, value) => sum + value, 0),
  );

  return {
    total,
    byMonth: months.map((monthDate) => {
      const monthKey = formatMonthKey(monthDate);
      return {
        month: monthKey,
        amount: monthlyTotals.get(monthKey) ?? 0,
      };
    }),
  };
}
