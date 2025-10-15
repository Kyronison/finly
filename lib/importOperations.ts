import { CategoryType, Prisma } from '@prisma/client';

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

function makeOperationKey(date: Date, amount: number): string {
  const day = date.toISOString().slice(0, 10);
  const normalizedAmount = amount.toFixed(2);
  return `${day}:${normalizedAmount}`;
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
    key: string;
  }> = [];

  let skipped = 0;
  const seenInBatch = new Set<string>();

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

    const key = makeOperationKey(parsedDate, amount);
    if (seenInBatch.has(key)) {
      skipped += 1;
      continue;
    }

    seenInBatch.add(key);
    prepared.push({ amount, date: parsedDate, categoryName, description, key });
  }

  if (prepared.length === 0) {
    return { created: 0, categoriesCreated: 0, skipped, nothingToImport: true };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingCategories = await tx.category.findMany({
      where: {
        userId,
        type: categoryType,
      },
    });

    const existingKeys = new Set<string>();

    if (prepared.length > 0) {
      const dates = prepared.map((item) => item.date.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      const where: Prisma.ExpenseWhereInput =
        type === 'INCOME'
          ? {
              userId,
              date: {
                gte: minDate,
                lte: maxDate,
              },
              category: { type: categoryType },
            }
          : {
              userId,
              date: {
                gte: minDate,
                lte: maxDate,
              },
              OR: [{ category: { type: categoryType } }, { categoryId: null }],
            };

      const existingOperations = await tx.expense.findMany({
        where,
        select: { amount: true, date: true },
      });

      existingOperations.forEach((operation) => {
        existingKeys.add(makeOperationKey(new Date(operation.date), Number(operation.amount)));
      });
    }

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

    let createdCategoriesCount = 0;
    let nextColorIndex = existingCategories.length;

    for (let i = 0; i < categoriesToCreate.length; i += 1) {
      const name = categoriesToCreate[i];
      const category = await tx.category.create({
        data: {
          name,
          type: categoryType,
          userId,
          color: pickColor(nextColorIndex),
        },
      });
      nextColorIndex += 1;
      createdCategoriesCount += 1;
      categoryMap.set(normalizeCategoryName(name).toLowerCase(), { id: category.id });
    }

    const operationsToCreate: Array<{
      amount: number;
      categoryId: string | null;
      description: string | null;
      date: Date;
      userId: string;
    }> = [];

    for (const item of prepared) {
      if (existingKeys.has(item.key)) {
        skipped += 1;
        continue;
      }

      let categoryId: string | null = null;
      if (item.categoryName) {
        const key = normalizeCategoryName(item.categoryName).toLowerCase();
        const category = categoryMap.get(key);
        if (!category) {
          const created = await tx.category.create({
            data: {
              name: item.categoryName,
              type: categoryType,
              userId,
              color: pickColor(nextColorIndex),
            },
          });
          nextColorIndex += 1;
          createdCategoriesCount += 1;
          categoryMap.set(key, { id: created.id });
          categoryId = created.id;
        } else {
          categoryId = category.id;
        }
      }

      operationsToCreate.push({
        amount: item.amount,
        categoryId,
        description: item.description,
        date: item.date,
        userId,
      });

      existingKeys.add(item.key);
    }

    if (operationsToCreate.length === 0) {
      return { created: 0, categoriesCreated: createdCategoriesCount };
    }

    const createdOperations = await tx.expense.createMany({ data: operationsToCreate });

    return {
      created: createdOperations.count,
      categoriesCreated: createdCategoriesCount,
    };
  });

  return {
    ...result,
    skipped,
  };
}
