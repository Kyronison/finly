import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import styles from './ExpenseTable.module.css';

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  date: string | Date;
  category?: {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
  } | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  expenses: Expense[];
  categories: CategoryOption[];
  onChanged: () => void;
}

export function ExpenseTable({ expenses, categories, onChanged }: Props) {
  const [error, setError] = useState('');

  async function updateExpense(id: string, payload: Record<string, unknown>) {
    setError('');
    const response = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message ?? 'Не удалось обновить операцию');
    }

    onChanged();
  }

  async function handleEdit(expense: Expense) {
    const nextAmount = window.prompt('Новая сумма', expense.amount.toString());
    if (nextAmount === null) return;
    const numeric = Number(nextAmount);
    if (!numeric || Number.isNaN(numeric) || numeric <= 0) {
      setError('Некорректная сумма');
      return;
    }

    const nextDescription = window.prompt('Комментарий', expense.description ?? '') ?? expense.description ?? '';

    try {
      await updateExpense(expense.id, { amount: numeric, description: nextDescription });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleChangeCategory(expense: Expense) {
    const options = categories
      .map((category, index) => `${index + 1}. ${category.name}`)
      .join('\n');
    const currentIndex = expense.category
      ? categories.findIndex((category) => category.id === expense.category?.id) + 1
      : 0;
    const input = window.prompt(
      `Выберите категорию (номер). 0 — без категории.\n${options}`,
      currentIndex.toString(),
    );
    if (input === null) return;

    const selected = Number(input);
    if (Number.isNaN(selected) || selected < 0 || selected > categories.length) {
      setError('Некорректный выбор');
      return;
    }

    const categoryId = selected === 0 ? null : categories[selected - 1]?.id;

    try {
      await updateExpense(expense.id, { categoryId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDelete(expense: Expense) {
    const confirmed = window.confirm('Удалить операцию?');
    if (!confirmed) return;
    setError('');
    const response = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Не удалось удалить операцию');
      return;
    }
    onChanged();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span>Операции</span>
        <span className={styles.caption}>Журнал транзакций за выбранный период</span>
      </header>
      <div className={styles.table}>
        <div className={styles.rowHead}>
          <span>Дата</span>
          <span>Описание</span>
          <span>Категория</span>
          <span className={styles.amountCol}>Сумма</span>
          <span className={styles.actionsCol}>Действия</span>
        </div>
        {expenses.map((expense) => (
          <div key={expense.id} className={styles.row}>
            <span>{format(new Date(expense.date), 'd MMM', { locale: ru })}</span>
            <span>{expense.description || '—'}</span>
            <span>{expense.category?.name ?? 'Без категории'}</span>
            <span className={styles.amountCol}>{expense.amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}</span>
            <span className={styles.actionsCol}>
              <button type="button" onClick={() => handleEdit(expense)}>
                Изменить
              </button>
              <button type="button" onClick={() => handleChangeCategory(expense)}>
                Категория
              </button>
              <button type="button" className={styles.danger} onClick={() => handleDelete(expense)}>
                Удалить
              </button>
            </span>
          </div>
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
