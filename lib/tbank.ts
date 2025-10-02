import OpenAPI from '@tinkoff/invest-openapi-js-sdk';
import type {
  Operation,
  PortfolioPosition as OpenApiPortfolioPosition,
  UserAccount,
} from '@tinkoff/invest-openapi-js-sdk/build/domain';

import { prisma } from './prisma';

const DEFAULT_REST_URL = process.env.TBANK_INVEST_API_URL ?? 'https://api-invest.tinkoff.ru/openapi';
const DEFAULT_STREAM_URL =
  process.env.TBANK_INVEST_SOCKET_URL ?? 'wss://api-invest.tinkoff.ru/openapi/md/v1/md-openapi/ws';

function createClient(token: string) {
  return new OpenAPI({ apiURL: DEFAULT_REST_URL, secretToken: token, socketURL: DEFAULT_STREAM_URL });
}

function ensureArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function roundNumber(value: number | undefined | null, precision = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function aggregateTimeline(operations: Operation[]) {
  const daily = new Map<string, Map<string, number>>();
  operations.forEach((operation) => {
    if (!operation.date || typeof operation.payment !== 'number') return;
    const date = operation.date.slice(0, 10);
    const currency = operation.currency ?? 'RUB';
    const currencyBucket = daily.get(date) ?? new Map<string, number>();
    currencyBucket.set(currency, (currencyBucket.get(currency) ?? 0) + operation.payment);
    daily.set(date, currencyBucket);
  });

  const sortedDays = Array.from(daily.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const running = new Map<string, number>();
  const snapshots: Array<{ date: Date; currency: string; total: number; expectedYield?: number | null }> = [];

  sortedDays.forEach((day) => {
    const point = daily.get(day);
    if (!point) return;
    point.forEach((value, currency) => {
      const next = (running.get(currency) ?? 0) + value;
      running.set(currency, next);
      snapshots.push({ date: new Date(`${day}T00:00:00.000Z`), currency, total: roundNumber(next) ?? 0 });
    });
  });

  return snapshots;
}

async function enrichInstrumentMetadata(
  client: OpenAPI,
  positions: OpenApiPortfolioPosition[],
  operations: Operation[],
) {
  const cache = new Map<string, { ticker?: string; name?: string; instrumentType?: string }>();
  positions.forEach((position) => {
    cache.set(position.figi, {
      ticker: position.ticker ?? undefined,
      name: position.name,
      instrumentType: position.instrumentType,
    });
  });

  const missingFigis = new Set<string>();
  operations.forEach((operation) => {
    if (operation.figi && !cache.has(operation.figi)) {
      missingFigis.add(operation.figi);
    }
  });

  for (const figi of missingFigis) {
    try {
      const instrument = await client.searchOne({ figi });
      if (instrument) {
        cache.set(figi, {
          ticker: instrument.ticker ?? undefined,
          name: instrument.name ?? undefined,
          instrumentType: instrument.type ?? undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load instrument metadata', figi, error);
    }
  }

  return cache;
}

function resolveAccount(accounts: UserAccount[], requestedId?: string) {
  if (requestedId) {
    const match = accounts.find((account) => account.brokerAccountId === requestedId);
    if (!match) {
      const available = accounts.map((account) => account.brokerAccountId);
      throw Object.assign(new Error('Счёт не найден в списке, возвращённом T-Bank Invest API'), {
        code: 'ACCOUNT_NOT_FOUND',
        accounts: available,
      });
    }
    return match;
  }

  if (accounts.length === 0) {
    throw Object.assign(new Error('Аккаунты инвестиций не найдены. Проверьте токен доступа.'), {
      code: 'NO_ACCOUNTS',
    });
  }

  if (accounts.length === 1) {
    return accounts[0];
  }

  throw Object.assign(new Error('Нужно выбрать счёт для подключения'), {
    code: 'ACCOUNT_SELECTION_REQUIRED',
    accounts,
  });
}

export async function fetchAccountsPreview(token: string, client?: OpenAPI) {
  const instance = client ?? createClient(token);
  const { accounts } = await instance.accounts();
  return ensureArray(accounts);
}

export async function upsertPortfolioConnection({
  userId,
  token,
  accountId,
}: {
  userId: string;
  token: string;
  accountId?: string | null;
}) {
  const client = createClient(token);
  const accounts = await fetchAccountsPreview(token, client);
  const resolvedAccount = resolveAccount(accounts, accountId ?? undefined);
  client.setCurrentAccountId(resolvedAccount.brokerAccountId);

  // Test access by calling lightweight endpoint
  await client.portfolio();

  const connection = await prisma.portfolioConnection.upsert({
    where: { userId },
    update: {
      token,
      accountId: resolvedAccount.brokerAccountId,
      brokerAccountType: resolvedAccount.brokerAccountType,
    },
    create: {
      userId,
      token,
      accountId: resolvedAccount.brokerAccountId,
      brokerAccountType: resolvedAccount.brokerAccountType,
    },
  });

  return connection;
}

export async function syncTinkoffPortfolio(connectionId: string) {
  const connection = await prisma.portfolioConnection.findUnique({ where: { id: connectionId } });
  if (!connection) {
    throw new Error('Подключение не найдено');
  }

  const client = createClient(connection.token);
  const accounts = await fetchAccountsPreview(connection.token, client);
  const resolvedAccount = resolveAccount(accounts, connection.accountId ?? undefined);
  client.setCurrentAccountId(resolvedAccount.brokerAccountId);

  const [portfolio, currencies, operationsResponse] = await Promise.all([
    client.portfolio(),
    client.portfolioCurrencies().catch(() => ({ currencies: [] })),
    client.operations({
      from: new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString(),
      to: new Date().toISOString(),
    }),
  ]);

  const positions = ensureArray(portfolio.positions);
  const operations = ensureArray(operationsResponse.operations).filter((operation) => operation.status === 'Done');
  const instrumentsMeta = await enrichInstrumentMetadata(client, positions, operations);

  const snapshotsFromOperations = aggregateTimeline(operations);

  const currencyTotals = new Map<string, { total: number; yield: number }>();
  positions.forEach((position) => {
    const averagePrice = position.averagePositionPrice?.value ?? 0;
    const expectedYield = position.expectedYield?.value ?? 0;
    const currency = position.averagePositionPrice?.currency ?? 'RUB';
    const invested = averagePrice * position.balance;
    const total = invested + expectedYield;
    const bucket = currencyTotals.get(currency) ?? { total: 0, yield: 0 };
    bucket.total += total;
    bucket.yield += expectedYield;
    currencyTotals.set(currency, bucket);
  });

  ensureArray(currencies.currencies).forEach((currency) => {
    const bucket = currencyTotals.get(currency.currency) ?? { total: 0, yield: 0 };
    bucket.total += currency.balance;
    currencyTotals.set(currency.currency, bucket);
  });

  const snapshotNow = new Date();
  currencyTotals.forEach((value, currency) => {
    snapshotsFromOperations.push({
      date: snapshotNow,
      currency,
      total: roundNumber(value.total) ?? 0,
      expectedYield: roundNumber(value.yield),
    });
  });

  const positionRows = positions.map((position) => {
    const averagePrice = position.averagePositionPrice?.value ?? 0;
    const expectedYield = position.expectedYield?.value ?? 0;
    const invested = averagePrice * position.balance;
    const currentTotal = invested + expectedYield;
    const currentPrice = position.balance !== 0 ? currentTotal / position.balance : null;
    const expectedYieldPercent = invested !== 0 ? (expectedYield / invested) * 100 : null;
    return {
      connectionId,
      figi: position.figi,
      ticker: position.ticker ?? instrumentsMeta.get(position.figi)?.ticker ?? null,
      name: position.name ?? instrumentsMeta.get(position.figi)?.name ?? null,
      instrumentType: position.instrumentType ?? instrumentsMeta.get(position.figi)?.instrumentType ?? null,
      balance: position.balance,
      lot: position.lots,
      averagePositionPrice: roundNumber(averagePrice),
      expectedYield: roundNumber(expectedYield),
      expectedYieldPercent: roundNumber(expectedYieldPercent),
      currentPrice: roundNumber(currentPrice),
      currency: position.averagePositionPrice?.currency ?? null,
    };
  });

  const operationsRows = operations.map((operation) => {
    const instrument = operation.figi ? instrumentsMeta.get(operation.figi) : undefined;
    return {
      connectionId,
      operationId: operation.id,
      figi: operation.figi ?? null,
      ticker: instrument?.ticker ?? null,
      instrumentType: operation.instrumentType ?? instrument?.instrumentType ?? null,
      operationType: operation.operationType ?? operation.status,
      payment: roundNumber(operation.payment),
      price: roundNumber(operation.price),
      quantity: operation.quantityExecuted ?? operation.quantity ?? null,
      currency: operation.currency ?? null,
      date: new Date(operation.date),
      description: operation.operationType ?? operation.status,
      commission: roundNumber(operation.commission?.value),
    };
  });

  const dividendRows = operations
    .filter((operation) => operation.operationType === 'Dividend' || operation.operationType === 'Coupon')
    .map((operation) => {
      const instrument = operation.figi ? instrumentsMeta.get(operation.figi) : undefined;
      return {
        connectionId,
        figi: operation.figi ?? null,
        ticker: instrument?.ticker ?? null,
        amount: roundNumber(Math.abs(operation.payment)) ?? 0,
        currency: operation.currency ?? null,
        paymentDate: new Date(operation.date),
        recordDate: null,
      };
    });

  await prisma.$transaction(async (tx) => {
    await tx.portfolioSnapshot.deleteMany({ where: { connectionId } });
    await tx.portfolioPosition.deleteMany({ where: { connectionId } });
    await tx.portfolioOperation.deleteMany({ where: { connectionId } });
    await tx.portfolioDividend.deleteMany({ where: { connectionId } });

    if (snapshotsFromOperations.length > 0) {
      await tx.portfolioSnapshot.createMany({
        data: snapshotsFromOperations.map((snapshot) => ({
          connectionId,
          capturedAt: snapshot.date,
          currency: snapshot.currency,
          totalAmount: snapshot.total,
          expectedYield: snapshot.expectedYield ?? null,
        })),
      });
    }

    if (positionRows.length > 0) {
      await tx.portfolioPosition.createMany({ data: positionRows });
    }

    if (operationsRows.length > 0) {
      await tx.portfolioOperation.createMany({ data: operationsRows });
    }

    if (dividendRows.length > 0) {
      await tx.portfolioDividend.createMany({ data: dividendRows });
    }

    await tx.portfolioConnection.update({
      where: { id: connectionId },
      data: {
        accountId: resolvedAccount.brokerAccountId,
        brokerAccountType: resolvedAccount.brokerAccountType,
        lastSyncedAt: new Date(),
      },
    });
  });
}

export async function removePortfolioConnection(userId: string) {
  const connection = await prisma.portfolioConnection.findUnique({ where: { userId } });
  if (!connection) return;

  await prisma.$transaction([
    prisma.portfolioSnapshot.deleteMany({ where: { connectionId: connection.id } }),
    prisma.portfolioPosition.deleteMany({ where: { connectionId: connection.id } }),
    prisma.portfolioOperation.deleteMany({ where: { connectionId: connection.id } }),
    prisma.portfolioDividend.deleteMany({ where: { connectionId: connection.id } }),
    prisma.portfolioConnection.delete({ where: { id: connection.id } }),
  ]);
}
