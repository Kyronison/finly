import { FormEvent, useEffect, useState } from 'react';

import styles from './ExpenseForm.module.css';

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  categories: CategoryOption[];
  onCreated: () => void;
  mode?: 'EXPENSE' | 'INCOME';
  allowUncategorized?: boolean;
}

export function ExpenseForm({
  categories,
  onCreated,
  mode = 'EXPENSE',
  allowUncategorized = true,
}: Props) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(() => (allowUncategorized ? '' : categories[0]?.id ?? ''));
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowUncategorized && !categoryId) {
      setCategoryId(categories[0]?.id ?? '');
    }
  }, [allowUncategorized, categories, categoryId]);

  const title = mode === 'INCOME' ? 'Добавить доход' : 'Добавить расход';
  const caption =
    mode === 'INCOME'
      ? 'Запишите поступление средств и обновите метрики.'
      : 'Зафиксируйте новую трату, чтобы следить за бюджетом.';

  const submitLabel = mode === 'INCOME' ? 'Добавить доход' : 'Добавить расход';

  const amountPlaceholder = mode === 'INCOME' ? 'Например, 120000' : 'Например, 4500';
  const descriptionPlaceholder =
    mode === 'INCOME' ? 'Источник поступления или комментарий' : 'Где и на что потратили?';

  const requireCategorySelection = !allowUncategorized;

  const canSubmit =
    !isLoading && (!requireCategorySelection || (!!categoryId && categories.length > 0));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (requireCategorySelection && (!categoryId || categories.length === 0)) {
        throw new Error('Выберите категорию дохода');
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), categoryId: categoryId || null, description, date }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message ?? 'Не удалось добавить операцию');
      }

      setAmount('');
      setDescription('');
      if (allowUncategorized) {
        setCategoryId('');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <header className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.caption}>{caption}</p>
      </header>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Сумма</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={amountPlaceholder}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Категория</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={requireCategorySelection && categories.length === 0}
          >
            {allowUncategorized && <option value="">Без категории</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {requireCategorySelection && categories.length === 0 && (
            <span className={styles.hint}>Создайте категорию дохода, чтобы добавить запись.</span>
          )}
        </label>
        <label className={styles.field}>
          <span>Дата</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
      </div>
      <label className={styles.field}>
        <span>Комментарий</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={descriptionPlaceholder}
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" className={styles.submit} disabled={!canSubmit}>
        {isLoading ? 'Сохраняю...' : submitLabel}
      </button>
    </form>
  );
}
