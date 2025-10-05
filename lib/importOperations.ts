import { CategoryType } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export interface OperationInput {
  amount: number;
  categoryName: string | null;
  description: string | null;
  date: string;
}

export type OperationKind = 'EXPENSE' | 'INCOME';

interface ImportOperationsOptions {
  userId: string;
  operations: OperationInput[];
  type: OperationKind;
  requireCategory?: boolean;
}

interface ImportOperationsBaseResult {
  created: number;
  categoriesCreated: number;
  skipped: number;
}

export type ImportOperationsResult =
  | (ImportOperationsBaseResult & { nothingToImport: true })
  | (ImportOperationsBaseResult & { nothingToImport?: false });

const palette = ['#f97316', '#4f46e5', '#22d3ee', '#ff6b6b', '#39d98a', '#facc15', '#a855f7'];

function pickColor(index: number): string {
  return palette[index % palette.length];
}

function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function importOperations({
  operations,
  userId,
  type,
  requireCategory = false,
}: ImportOperationsOptions): Promise<ImportOperationsResult> {
  const categoryType = type === 'INCOME' ? CategoryType.INCOME : CategoryType.EXPENSE;

  const prepared: Array<{
    amount: number;
    date: Date;
    categoryName: string | null;
    description: string | null;
  }> = [];

  let skipped = 0;

  for (const op of operations) {
    const amount = Number(op?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped += 1;
      continue;
    }

    const parsedDate = op?.date ? new Date(op.date) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      skipped += 1;
      continue;
    }

    const description = typeof op?.description === 'string' && op.description.trim().length > 0 ? op.description.trim() : null;
    const categoryName =
      typeof op?.categoryName === 'string' && op.categoryName.trim().length > 0 ? normalizeCategoryName(op.categoryName) : null;

    if (requireCategory && !categoryName) {
      skipped += 1;
      continue;
    }

    prepared.push({ amount, date: parsedDate, categoryName, description });
  }

  if (prepared.length === 0) {
    return { created: 0, categoriesCreated: 0, skipped, nothingToImport: true };
  }

  const existingCategories = await prisma.category.findMany({
    where: {
      userId,
      type: categoryType,
    },
  });

  const categoryMap = new Map<string, { id: string }>();
  existingCategories.forEach((category) => {
    categoryMap.set(normalizeCategoryName(category.name).toLowerCase(), { id: category.id });
  });

  const categoriesToCreate: string[] = [];
  const categoriesToCreateKeys = new Set<string>();
  prepared.forEach((item) => {
    if (!item.categoryName) return;
    const key = normalizeCategoryName(item.categoryName).toLowerCase();
    if (!categoryMap.has(key) && !categoriesToCreateKeys.has(key)) {
      categoriesToCreate.push(item.categoryName);
      categoriesToCreateKeys.add(key);
    }
  });

  const createdCategories: string[] = [];

  for (let i = 0; i < categoriesToCreate.length; i += 1) {
    const name = categoriesToCreate[i];
    const category = await prisma.category.create({
      data: {
        name,
        type: categoryType,
        userId,
        color: pickColor(i + existingCategories.length),
      },
    });
    categoryMap.set(normalizeCategoryName(name).toLowerCase(), { id: category.id });
    createdCategories.push(category.id);
  }

  let createdOperations = 0;

  for (const item of prepared) {
    let categoryId: string | null = null;
    if (item.categoryName) {
      const key = normalizeCategoryName(item.categoryName).toLowerCase();
      const category = categoryMap.get(key);
      if (!category) {
        const created = await prisma.category.create({
          data: {
            name: item.categoryName,
            type: categoryType,
            userId,
            color: pickColor(createdCategories.length + existingCategories.length),
          },
        });
        categoryMap.set(key, { id: created.id });
        createdCategories.push(created.id);
        categoryId = created.id;
      } else {
        categoryId = category.id;
      }
    }

    await prisma.expense.create({
      data: {
        amount: item.amount,
        categoryId,
        description: item.description,
        date: item.date,
        userId,
      },
    });
    createdOperations += 1;
  }

  return {
    created: createdOperations,
    categoriesCreated: createdCategories.length,
    skipped,
  };
}
