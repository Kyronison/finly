import { FormEvent, useState } from 'react';

import styles from './CategoryForm.module.css';

type CategoryType = 'INCOME' | 'EXPENSE';

interface Props {
  onCreated: () => void;
}

export function CategoryForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('EXPENSE');
  const [budget, setBudget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, budget: budget ? Number(budget) : null }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message ?? 'Не удалось создать категорию');
      }

      setName('');
      setBudget('');
      setType('EXPENSE');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Название</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Категория" required />
      </label>
      <label className={styles.field}>
        <span>Тип</span>
        <select value={type} onChange={(event) => setType(event.target.value as CategoryType)}>
          <option value="EXPENSE">Расход</option>
          <option value="INCOME">Доход</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Лимит в месяц, ₽</span>
        <input
          type="number"
          min="0"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          placeholder="Опционально"
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" className={styles.submit} disabled={isLoading}>
        {isLoading ? 'Создаю...' : 'Добавить категорию'}
      </button>
    </form>
  );
}
