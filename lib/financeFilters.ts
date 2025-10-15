export interface CategorizedEntity {
  name?: string | null;
}

const TRANSFER_KEYWORDS = ['перевод', 'transfer', 'между счет', 'между счё'];

export function isTransferCategory(category?: CategorizedEntity | null): boolean {
  if (!category || !category.name) {
    return false;
  }

  const normalized = category.name.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return TRANSFER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function shouldIgnoreCategory(category?: CategorizedEntity | null): boolean {
  return isTransferCategory(category);
}
