import type { NextApiRequest, NextApiResponse } from 'next';

import { requireAuth } from '@/lib/auth';
import { importOperations, type ImportOperationsResult, type OperationInput } from '@/lib/importOperations';

interface TBankOperationInput extends OperationInput {
  type: 'EXPENSE' | 'INCOME';
}

function mapOperations(operations: TBankOperationInput[]): OperationInput[] {
  return operations.map(({ amount, categoryName, date, description }) => ({
    amount,
    categoryName,
    date,
    description,
  }));
}

function summarize(result: ImportOperationsResult | undefined) {
  if (!result) {
    return { created: 0, categoriesCreated: 0, skipped: 0 };
  }

  return {
    created: 'nothingToImport' in result && result.nothingToImport ? 0 : result.created,
    categoriesCreated: result.categoriesCreated,
    skipped: result.skipped,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const { operations } = req.body as { operations?: TBankOperationInput[] };

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ message: 'Список операций пуст' });
  }

  const expenseOperations = operations.filter((operation) => operation?.type !== 'INCOME');
  const incomeOperations = operations.filter((operation) => operation?.type === 'INCOME');

  if (expenseOperations.length === 0 && incomeOperations.length === 0) {
    return res.status(400).json({ message: 'Список операций пуст' });
  }

  const results: ImportOperationsResult[] = [];

  let expenseResult: ImportOperationsResult | undefined;
  if (expenseOperations.length > 0) {
    expenseResult = await importOperations({
      operations: mapOperations(expenseOperations),
      userId,
      type: 'EXPENSE',
    });
    results.push(expenseResult);
  }

  let incomeResult: ImportOperationsResult | undefined;
  if (incomeOperations.length > 0) {
    incomeResult = await importOperations({
      operations: mapOperations(incomeOperations),
      userId,
      type: 'INCOME',
    });
    results.push(incomeResult);
  }

  const created = results.reduce((total, current) => {
    if ('nothingToImport' in current && current.nothingToImport) {
      return total;
    }
    return total + current.created;
  }, 0);

  const categoriesCreated = results.reduce((total, current) => total + current.categoriesCreated, 0);
  const skipped = results.reduce((total, current) => total + current.skipped, 0);

  const nothingToImport =
    results.length > 0 && results.every((item) => 'nothingToImport' in item && item.nothingToImport);

  const breakdown = {
    expenses: summarize(expenseResult),
    incomes: summarize(incomeResult),
  };

  if (nothingToImport) {
    return res
      .status(400)
      .json({ message: 'Не осталось валидных операций для импорта', skipped, breakdown, created, categoriesCreated });
  }

  return res.status(201).json({ created, categoriesCreated, skipped, breakdown });
}
