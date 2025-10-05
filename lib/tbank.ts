import './networkTls';

import { fetch as undiciFetch } from 'undici';

import { prisma } from './prisma';

const TBANK_API_INVALID_BASE_URL_CODE = 'TBANK_API_INVALID_BASE_URL';
const TBANK_API_PACKAGE = 'tinkoff.public.invest.api.contract.v1';

const fetchImpl: typeof fetch = (globalThis.fetch ?? undiciFetch) as typeof fetch;

function removeTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function resolveUrl(name: string, fallback: string, allowedProtocols: string[]) {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return removeTrailingSlash(fallback);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch (error) {
    throw Object.assign(new Error(`Переменная окружения ${name} должна содержать корректный URL.`), {
      code: TBANK_API_INVALID_BASE_URL_CODE,
      cause: error,
    });
  }

  if (!allowedProtocols.includes(parsed.protocol)) {
    const allowed = allowedProtocols.map((protocol) => protocol.replace(/:$/, '')).join(', ');
    throw Object.assign(
      new Error(`Переменная окружения ${name} должна использовать один из протоколов: ${allowed}.`),
      { code: TBANK_API_INVALID_BASE_URL_CODE },
    );
  }

  return removeTrailingSlash(parsed.toString());
}

export const TBANK_INVEST_API_URL = resolveUrl(
  'TBANK_INVEST_API_URL',
  'https://invest-public-api.tbank.ru/rest',
  ['https:'],
);
export const TBANK_INVEST_SOCKET_URL = resolveUrl(
  'TBANK_INVEST_SOCKET_URL',
  'wss://invest-public-api.tbank.ru/ws',
  ['wss:', 'ws:'],
);

const TBANK_REST_BASE_URL = removeTrailingSlash(TBANK_INVEST_API_URL);

function createInvalidBaseUrlError(cause: unknown) {
  return Object.assign(
    new Error(
      'Получен неожиданный ответ от T-Bank Invest API. Проверьте настройку TBANK_INVEST_API_URL/TBANK_INVEST_SOCKET_URL.',
    ),
    {
      code: TBANK_API_INVALID_BASE_URL_CODE,
      cause,
    },
  );
}

type ApiMoneyValue = {
  currency?: string | null;
  units?: number | string | null;
  nano?: number | string | null;
};

type ApiQuotation = {
  units?: number | string | null;
  nano?: number | string | null;
};

type ApiAccount = {
  id?: string | null;
  type?: string | null;
  name?: string | null;
  status?: string | null;
  accessLevel?: string | null;
};

type GetAccountsResponse = {
  accounts?: ApiAccount[] | null;
};

type ApiPortfolioPosition = {
  figi?: string | null;
  instrumentType?: string | null;
  quantity?: ApiQuotation | null;
  quantityLots?: ApiQuotation | null;
  averagePositionPrice?: ApiMoneyValue | null;
  currentPrice?: ApiMoneyValue | null;
};

type PortfolioResponse = {
  positions?: ApiPortfolioPosition[] | null;
};

type PositionsResponse = {
  money?: ApiMoneyValue[] | null;
};

type ApiOperationTrade = {
  price?: ApiMoneyValue | null;
  quantity?: number | string | null;
};

type ApiOperation = {
  id?: string | null;
  currency?: string | null;
  payment?: ApiMoneyValue | null;
  price?: ApiMoneyValue | null;
  state?: string | null;
  quantity?: number | string | null;
  quantityRest?: number | string | null;
  figi?: string | null;
  instrumentType?: string | null;
  date?: string | null;
  type?: string | null;
  description?: string | null;
  operationType?: string | null;
  trades?: ApiOperationTrade[] | null;
  commission?: ApiMoneyValue | null;
};

type OperationsResponse = {
  operations?: ApiOperation[] | null;
};

type Instrument = {
  figi?: string | null;
  ticker?: string | null;
  name?: string | null;
  instrumentType?: string | null;
  lot?: number | string | null;
  currency?: string | null;
};

type InstrumentResponse = {
  instrument?: Instrument | null;
};

type AccountPreview = {
  brokerAccountId: string;
  brokerAccountType: string | null;
  name: string | null;
  status: string | null;
  accessLevel: string | null;
};

type NormalizedPosition = {
  figi: string;
  instrumentType: string | null;
  balance: number;
  lot: number | null;
  averagePrice: number | null;
  currentPrice: number | null;
  currency: string | null;
};

type NormalizedOperation = {
  id: string;
  figi: string | null;
  instrumentType: string | null;
  operationType: string;
  rawOperationType: string | null;
  payment: number | null;
  price: number | null;
  quantity: number | null;
  currency: string | null;
  date: string;
  description: string | null;
  state: string;
  commission: number | null;
};

type InstrumentMeta = {
  ticker?: string;
  name?: string;
  instrumentType?: string;
  lot?: number | null;
  currency?: string | null;
};

async function callRest<TResponse>(
  token: string,
  service: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  const url = `${TBANK_REST_BASE_URL}/${TBANK_API_PACKAGE}.${service}/${method}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch (error) {
    throw createInvalidBaseUrlError(error);
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch (error) {
    throw createInvalidBaseUrlError(error);
  }

  let parsed: unknown = {};
  if (raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw createInvalidBaseUrlError(error);
    }
  }

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed && 'message' in parsed && typeof (parsed as { message?: string }).message === 'string'
        ? (parsed as { message?: string }).message
        : `T-Bank Invest API вернул ошибку ${response.status}`;
    const error = Object.assign(new Error(message), { status: response.status });
    if (response.status === 401 || response.status === 403) {
      (error as { code?: string }).code = 'UNAUTHORIZED';
    }
    throw error;
  }

  return parsed as TResponse;
}

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function parseNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function moneyValueToNumber(value?: ApiMoneyValue | null): number | null {
  if (!value) return null;
  const units = parseNumber(value.units);
  const nano = parseNumber(value.nano);
  if (units == null && nano == null) return null;
  return (units ?? 0) + (nano ?? 0) / 1_000_000_000;
}

function quotationToNumber(value?: ApiQuotation | null): number | null {
  if (!value) return null;
  const units = parseNumber(value.units);
  const nano = parseNumber(value.nano);
  if (units == null && nano == null) return null;
  return (units ?? 0) + (nano ?? 0) / 1_000_000_000;
}

function roundNumber(value: number | null | undefined, precision = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function humanizeOperationType(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith('OPERATION_TYPE_')) {
    const rest = value.replace('OPERATION_TYPE_', '').toLowerCase();
    return rest
      .split('_')
      .filter((part) => part.length > 0)
      .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ');
  }
  return value;
}

function normalizeOperation(operation: ApiOperation): NormalizedOperation | null {
  if (!operation.id || !operation.date) return null;
  const state = operation.state ?? 'OPERATION_STATE_UNSPECIFIED';
  const rawOperationType = operation.operationType ?? null;
  const payment = moneyValueToNumber(operation.payment);
  const price = moneyValueToNumber(operation.price);
  const quantity = parseNumber(operation.quantity);
  const quantityRest = parseNumber(operation.quantityRest);
  const executedQuantity = quantity != null ? quantity - (quantityRest ?? 0) : null;
  const commission = moneyValueToNumber(operation.commission);

  return {
    id: operation.id,
    figi: operation.figi ?? null,
    instrumentType: operation.instrumentType ?? null,
    operationType:
      humanizeOperationType(rawOperationType) ?? operation.type ?? humanizeOperationType(state) ?? 'Operation',
    rawOperationType,
    payment,
    price,
    quantity: executedQuantity ?? quantity ?? null,
    currency: operation.currency ?? operation.payment?.currency ?? null,
    date: operation.date,
    description: operation.description ?? operation.type ?? humanizeOperationType(rawOperationType),
    state,
    commission,
  };
}

function normalizePortfolioPosition(position: ApiPortfolioPosition): NormalizedPosition | null {
  if (!position.figi) return null;
  const balance = quotationToNumber(position.quantity);
  if (balance == null) return null;

  return {
    figi: position.figi,
    instrumentType: position.instrumentType ?? null,
    balance,
    lot: quotationToNumber(position.quantityLots),
    averagePrice: moneyValueToNumber(position.averagePositionPrice),
    currentPrice: moneyValueToNumber(position.currentPrice),
    currency: position.currentPrice?.currency ?? position.averagePositionPrice?.currency ?? null,
  };
}

function aggregateTimeline(operations: NormalizedOperation[]) {
  const daily = new Map<string, Map<string, number>>();
  operations.forEach((operation) => {
    if (!operation.date || typeof operation.payment !== 'number' || Number.isNaN(operation.payment)) return;
    const date = operation.date.slice(0, 10);
    const currency = operation.currency ?? 'RUB';
    const bucket = daily.get(date) ?? new Map<string, number>();
    bucket.set(currency, (bucket.get(currency) ?? 0) + operation.payment);
    daily.set(date, bucket);
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
  token: string,
  positions: NormalizedPosition[],
  operations: NormalizedOperation[],
) {
  const cache = new Map<string, InstrumentMeta>();

  positions.forEach((position) => {
    cache.set(position.figi, {
      instrumentType: position.instrumentType ?? undefined,
      lot: position.lot ?? undefined,
      currency: position.currency ?? undefined,
    });
  });

  operations.forEach((operation) => {
    if (operation.figi && !cache.has(operation.figi)) {
      cache.set(operation.figi, { instrumentType: operation.instrumentType ?? undefined });
    }
  });

  const requiredFigis = new Set<string>();
  positions.forEach((position) => requiredFigis.add(position.figi));
  operations.forEach((operation) => {
    if (operation.figi) requiredFigis.add(operation.figi);
  });

  const figiList: string[] = [];
  requiredFigis.forEach((value) => {
    figiList.push(value);
  });

  for (const figi of figiList) {
    const existing = cache.get(figi);
    if (existing && existing.ticker) continue;

    try {
      const instrumentResponse = await callRest<InstrumentResponse>(token, 'InstrumentsService', 'GetInstrumentBy', {
        idType: 'INSTRUMENT_ID_TYPE_FIGI',
        id: figi,
      });
      const instrument = instrumentResponse.instrument;
      if (instrument) {
        cache.set(figi, {
          ticker: instrument.ticker ?? undefined,
          name: instrument.name ?? undefined,
          instrumentType: instrument.instrumentType ?? existing?.instrumentType ?? undefined,
          lot: parseNumber(instrument.lot),
          currency: instrument.currency ?? existing?.currency ?? undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load instrument metadata', figi, error);
    }
  }

  return cache;
}

function resolveAccount(accounts: AccountPreview[], requestedId?: string) {
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

export async function fetchAccountsPreview(token: string) {
  const response = await callRest<GetAccountsResponse>(token, 'UsersService', 'GetAccounts', {});
  return ensureArray(response.accounts)
    .map((account) => ({
      brokerAccountId: account.id?.trim() ?? '',
      brokerAccountType: account.type ?? null,
      name: account.name ?? null,
      status: account.status ?? null,
      accessLevel: account.accessLevel ?? null,
    }))
    .filter((account) => account.brokerAccountId.length > 0);
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
  const accounts = await fetchAccountsPreview(token);
  const resolvedAccount = resolveAccount(accounts, accountId ?? undefined);

  await callRest<PortfolioResponse>(token, 'OperationsService', 'GetPortfolio', {
    accountId: resolvedAccount.brokerAccountId,
  });

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

  const accounts = await fetchAccountsPreview(connection.token);
  const resolvedAccount = resolveAccount(accounts, connection.accountId ?? undefined);

  const [portfolioResponse, positionsResponse, operationsResponse] = await Promise.all([
    callRest<PortfolioResponse>(connection.token, 'OperationsService', 'GetPortfolio', {
      accountId: resolvedAccount.brokerAccountId,
    }),
    callRest<PositionsResponse>(connection.token, 'OperationsService', 'GetPositions', {
      accountId: resolvedAccount.brokerAccountId,
    }),
    callRest<OperationsResponse>(connection.token, 'OperationsService', 'GetOperations', {
      accountId: resolvedAccount.brokerAccountId,
      from: new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString(),
      to: new Date().toISOString(),
      state: 'OPERATION_STATE_EXECUTED',
    }),
  ]);

  const positions = ensureArray(portfolioResponse.positions)
    .map(normalizePortfolioPosition)
    .filter((position): position is NormalizedPosition => Boolean(position));

  const operations = ensureArray(operationsResponse.operations)
    .map(normalizeOperation)
    .filter(
      (operation): operation is NormalizedOperation =>
        operation != null && operation.state === 'OPERATION_STATE_EXECUTED',
    );

  const instrumentMeta = await enrichInstrumentMetadata(connection.token, positions, operations);

  const snapshotsFromOperations = aggregateTimeline(operations);

  const currencyTotals = new Map<string, { total: number; yield: number }>();
  positions.forEach((position) => {
    const averagePriceValue = position.averagePrice ?? 0;
    const currentPriceValue = position.currentPrice ?? null;
    const invested = averagePriceValue * position.balance;
    const currentTotal = currentPriceValue != null ? currentPriceValue * position.balance : invested;
    const expectedYieldValue = currentTotal - invested;
    const currency = position.currency ?? 'RUB';
    const bucket = currencyTotals.get(currency) ?? { total: 0, yield: 0 };
    bucket.total += currentTotal;
    bucket.yield += expectedYieldValue;
    currencyTotals.set(currency, bucket);
  });

  ensureArray(positionsResponse.money).forEach((currencyPosition) => {
    const amount = moneyValueToNumber(currencyPosition);
    if (amount == null) return;
    const currency = currencyPosition?.currency ?? 'RUB';
    const bucket = currencyTotals.get(currency) ?? { total: 0, yield: 0 };
    bucket.total += amount;
    currencyTotals.set(currency, bucket);
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
    const meta = instrumentMeta.get(position.figi);
    const lotSize = meta?.lot && meta.lot > 0 ? meta.lot : null;
    const lotCount =
      position.lot != null
        ? position.lot
        : lotSize != null && lotSize > 0
          ? position.balance / lotSize
          : null;
    const averagePriceValue = position.averagePrice ?? 0;
    const currentPriceValue = position.currentPrice ?? null;
    const invested = averagePriceValue * position.balance;
    const currentTotal = currentPriceValue != null ? currentPriceValue * position.balance : invested;
    const expectedYieldValue = currentTotal - invested;
    const expectedYieldPercent = invested !== 0 ? (expectedYieldValue / invested) * 100 : null;

    return {
      connectionId,
      figi: position.figi,
      ticker: meta?.ticker ?? null,
      name: meta?.name ?? null,
      instrumentType: position.instrumentType ?? meta?.instrumentType ?? null,
      balance: position.balance,
      lot: lotCount != null ? roundNumber(lotCount, 4) : null,
      averagePositionPrice: roundNumber(position.averagePrice),
      expectedYield: roundNumber(expectedYieldValue),
      expectedYieldPercent: roundNumber(expectedYieldPercent),
      currentPrice: roundNumber(currentPriceValue),
      currency: position.currency ?? meta?.currency ?? null,
    };
  });

  const operationsRows = operations.map((operation) => {
    const meta = operation.figi ? instrumentMeta.get(operation.figi) : undefined;
    return {
      connectionId,
      operationId: operation.id,
      figi: operation.figi ?? null,
      ticker: meta?.ticker ?? null,
      instrumentType: operation.instrumentType ?? meta?.instrumentType ?? null,
      operationType: operation.operationType,
      payment: roundNumber(operation.payment),
      price: roundNumber(operation.price),
      quantity: roundNumber(operation.quantity),
      currency: operation.currency ?? meta?.currency ?? null,
      date: new Date(operation.date),
      description: operation.description ?? operation.operationType,
      commission: roundNumber(operation.commission),
    };
  });

  const dividendRows = operations
    .filter((operation) => {
      const type = operation.rawOperationType ?? operation.operationType;
      return (
        type === 'OPERATION_TYPE_DIVIDEND' ||
        type === 'OPERATION_TYPE_COUPON' ||
        type === 'Dividend' ||
        type === 'Coupon'
      );
    })
    .map((operation) => {
      const meta = operation.figi ? instrumentMeta.get(operation.figi) : undefined;
      const amount = typeof operation.payment === 'number' ? Math.abs(operation.payment) : 0;
      return {
        connectionId,
        figi: operation.figi ?? null,
        ticker: meta?.ticker ?? null,
        amount: roundNumber(amount) ?? 0,
        currency: operation.currency ?? meta?.currency ?? null,
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
