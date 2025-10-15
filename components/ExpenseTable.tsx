import { useEffect, useMemo, useState } from 'react';
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
  periodStart?: string;
  periodEnd?: string;
  allowUncategorized?: boolean;
}

export function ExpenseTable({
  expenses,
  categories,
  onChanged,
  periodStart,
  periodEnd,
  allowUncategorized = true,
}: Props) {
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [message, setMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [exportStart, setExportStart] = useState(periodStart ?? '');
  const [exportEnd, setExportEnd] = useState(periodEnd ?? '');

  const expenseOnly = useMemo(
    () => expenses.filter((expense) => expense.category?.type !== 'INCOME'),
    [expenses],
  );

  useEffect(() => {
    setExportStart(periodStart ?? '');
  }, [periodStart]);

  useEffect(() => {
    setExportEnd(periodEnd ?? '');
  }, [periodEnd]);

  const displayedExpenses = useMemo(() => expenseOnly.slice(0, 10), [expenseOnly]);
  const hasMoreExpenses = expenseOnly.length > displayedExpenses.length;

  async function updateExpense(id: string, payload: Record<string, unknown>) {
    setError('');
    setExportError('');
    setMessage('');
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
    const lines = [`Выберите категорию (номер).${allowUncategorized ? ' 0 — без категории.' : ''}`];
    if (options) {
      lines.push(options);
    }
    const input = window.prompt(lines.join('\n'), currentIndex.toString());
    if (input === null) return;

    const selected = Number(input);
    if (
      Number.isNaN(selected) ||
      selected < (allowUncategorized ? 0 : 1) ||
      selected > categories.length
    ) {
      setError('Некорректный выбор');
      return;
    }

    const categoryId = selected === 0 ? null : categories[selected - 1]?.id;
    if (!allowUncategorized && categoryId === null) {
      setError('Категория обязательна для этой операции');
      return;
    }
    if (selected !== 0 && !categoryId) {
      setError('Категория не найдена');
      return;
    }

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
    setExportError('');
    setMessage('');
    const response = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Не удалось удалить операцию');
      return;
    }
    onChanged();
  }

  function validateExportPeriod() {
    if (!exportStart || !exportEnd) {
      throw new Error('Укажите дату начала и окончания периода');
    }

    if (exportStart > exportEnd) {
      throw new Error('Дата начала не может быть позже даты окончания');
    }
  }

  async function handleExportAll() {
    try {
      validateExportPeriod();
    } catch (validationError) {
      setExportError(validationError instanceof Error ? validationError.message : 'Некорректный период');
      setMessage('');
      return;
    }

    setIsExporting(true);
    setExportError('');
    setMessage('');

    const params = new URLSearchParams();
    params.set('start', exportStart);
    params.set('end', exportEnd);

    try {
      const response = await fetch(`/api/expenses/export?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? 'Не удалось выгрузить операции');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finly-operations-${exportStart}-${exportEnd}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('Файл с операциями сохранён.');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Не удалось выгрузить операции');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteAll() {
    const confirmed = window.confirm('Удалить все операции без возможности восстановления?');
    if (!confirmed) return;

    setIsClearing(true);
    setError('');
    setExportError('');
    setMessage('');

    try {
      const response = await fetch('/api/expenses', { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? 'Не удалось удалить операции');
      }

      setMessage('Все операции удалены.');
      onChanged();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Не удалось удалить операции');
    } finally {
      setIsClearing(false);
    }
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
        {displayedExpenses.map((expense) => (
          <div key={expense.id} className={styles.row}>
            <span>{format(new Date(expense.date), 'd MMM', { locale: ru })}</span>
            <span>{expense.description || '—'}</span>
            <span>{expense.category?.name ?? 'Без категории'}</span>
            <span className={styles.amountCol}>
              {expense.amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
            </span>
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
        {displayedExpenses.length === 0 && (
          <div className={styles.emptyState}>За выбранный период нет операций</div>
        )}
      </div>
      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          <span>
            {displayedExpenses.length > 0
              ? `Показано операций: ${displayedExpenses.length} из ${expenseOnly.length}`
              : 'Нет операций для отображения'}
          </span>
          {hasMoreExpenses ? (
            <span className={styles.caption}>Выгрузите файл, чтобы посмотреть полный список.</span>
          ) : null}
        </div>
        <div className={styles.footerActions}>
          <div className={styles.exportControls}>
            <label className={styles.exportField}>
              <span>С</span>
              <input
                type="date"
                value={exportStart}
                onChange={(event) => setExportStart(event.target.value)}
              />
            </label>
            <label className={styles.exportField}>
              <span>По</span>
              <input type="date" value={exportEnd} onChange={(event) => setExportEnd(event.target.value)} />
            </label>
            <button type="button" onClick={handleExportAll} disabled={isExporting} className={styles.exportButton}>
              {isExporting ? 'Готовим файл…' : 'Выгрузить все операции'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleDeleteAll}
            className={styles.clearButton}
            disabled={isClearing || expenseOnly.length === 0}
          >
            {isClearing ? 'Удаляем…' : 'Удалить все операции'}
          </button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {exportError && <p className={styles.error}>{exportError}</p>}
      {message && <p className={styles.success}>{message}</p>}
    </div>
  );
}
