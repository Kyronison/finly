import { FormEvent, useState } from 'react';

import styles from './ExpenseForm.module.css';

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  categories: CategoryOption[];
  onCreated: () => void;
}

export function ExpenseForm({ categories, onCreated }: Props) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
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
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Сумма</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Например, 4500"
            required
          />
        </label>
        <label className={styles.field}>
          <span>Категория</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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
          placeholder="Где и на что потратили?"
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" className={styles.submit} disabled={isLoading}>
        {isLoading ? 'Сохраняю...' : 'Добавить операцию'}
      </button>
    </form>
  );
}
