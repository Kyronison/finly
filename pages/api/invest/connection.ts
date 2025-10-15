import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import {
  fetchAccountsPreview,
  removePortfolioConnection,
  syncTinkoffPortfolio,
  upsertPortfolioConnection,
} from '@/lib/tbank';
import { ALL_ACCOUNTS_ID, ALL_ACCOUNTS_LABEL } from '@/lib/investAccounts';

function withAllAccountsOption(accounts: Awaited<ReturnType<typeof fetchAccountsPreview>>) {
  if (accounts.length <= 1) {
    return accounts;
  }

  if (accounts.some((account) => account.brokerAccountId === ALL_ACCOUNTS_ID)) {
    return accounts;
  }

  return [
    ...accounts,
    {
      brokerAccountId: ALL_ACCOUNTS_ID,
      brokerAccountType: ALL_ACCOUNTS_LABEL,
      name: ALL_ACCOUNTS_LABEL,
      status: null,
      accessLevel: null,
    },
  ];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return getConnection(req, res);
  }

  if (req.method === 'POST') {
    return connect(req, res);
  }

  if (req.method === 'DELETE') {
    return disconnect(req, res);
  }

  res.setHeader('Allow', 'GET,POST,DELETE');
  return res.status(405).json({ message: 'Метод не поддерживается' });
}

async function getConnection(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const connection = await prisma.portfolioConnection.findUnique({
    where: { userId },
    select: {
      id: true,
      accountId: true,
      brokerAccountType: true,
      createdAt: true,
      updatedAt: true,
      lastSyncedAt: true,
    },
  });

  if (!connection) {
    return res.status(200).json({ connection: null });
  }

  return res.status(200).json({
    connection: {
      ...connection,
      hasToken: true,
    },
  });
}

async function connect(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { token, accountId } = req.body ?? {};
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ message: 'Укажите токен доступа из настроек T-Bank Инвестиций' });
  }

  try {
    const connection = await upsertPortfolioConnection({ userId, token: token.trim(), accountId: accountId ?? undefined });
    await syncTinkoffPortfolio(connection.id);
    const fresh = await prisma.portfolioConnection.findUnique({
      where: { id: connection.id },
      select: {
        id: true,
        accountId: true,
        brokerAccountType: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      connection: fresh,
    });
  } catch (error: unknown) {
    const code = getErrorCode(error);

    if (code === 'ACCOUNT_SELECTION_REQUIRED') {
      const preview = withAllAccountsOption(await fetchAccountsPreview(token.trim()));
      return res.status(400).json({
        message: 'Выберите счёт для подключения',
        requiresAccountSelection: true,
        accounts: preview,
      });
    }

    if (code === 'ACCOUNT_NOT_FOUND') {
      const preview = withAllAccountsOption(await fetchAccountsPreview(token.trim()));
      return res.status(400).json({
        message: 'Указанный счёт не найден. Выберите один из доступных.',
        requiresAccountSelection: true,
        accounts: preview,
      });
    }

    if (code === 'NO_ACCOUNTS') {
      return res.status(400).json({
        message: 'T-Bank Инвестиции не вернули ни одного счёта. Проверьте, что токен создан правильно.',
      });
    }

    console.error('Failed to connect portfolio', error);
    return res.status(500).json({ message: 'Не удалось подключить портфель. Попробуйте ещё раз позже.' });
  }
}

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: string }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

async function disconnect(req: NextApiRequest, res: NextApiResponse) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  await removePortfolioConnection(userId);
  return res.status(200).json({ success: true });
}
