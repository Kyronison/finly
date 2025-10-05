import { useState } from 'react';

import { ProgressBar } from './ProgressBar';
import styles from './CategoryList.module.css';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget: number | null;
  spent?: number;
  earned?: number;
  progress?: number | null;
  color?: string | null;
}

interface Props {
  categories: Category[];
  onChanged: () => void;
}

export function CategoryList({ categories, onChanged }: Props) {
  const [error, setError] = useState('');

  async function updateCategory(id: string, payload: Record<string, unknown>) {
    setError('');
    const response = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message ?? 'Не удалось обновить категорию');
    }

    onChanged();
  }

  async function handleRename(id: string, currentName: string) {
    const next = window.prompt('Новое название категории', currentName);
    if (!next) return;
    try {
      await updateCategory(id, { name: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleBudget(id: string, currentBudget: number | null) {
    const value = window.prompt('Лимит в месяц (₽). Оставьте пустым, чтобы убрать лимит.', currentBudget?.toString() ?? '');
    if (value === null) return;
    const numeric = value === '' ? null : Number(value);
    if (numeric !== null && (Number.isNaN(numeric) || numeric < 0)) {
      setError('Некорректный лимит');
      return;
    }

    try {
      await updateCategory(id, { budget: numeric });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Удалить категорию? Операции останутся, но будут без категории.');
    if (!confirmed) return;
    setError('');

    const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Не удалось удалить категорию');
      return;
    }

    onChanged();
  }

  const expenseCategories = categories.filter((category) => category.type === 'EXPENSE');
  const incomeCategories = categories.filter((category) => category.type === 'INCOME');

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <header className={styles.header}>
          <span>Категории расходов</span>
          <span className={styles.caption}>Лимиты и прогресс расходов</span>
        </header>
        {expenseCategories.length ? (
          <div className={styles.list}>
            {expenseCategories.map((category) => (
              <div key={category.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.icon} style={{ background: category.color ?? '#272637' }} />
                  <div>
                    <div className={styles.name}>{category.name}</div>
                    <div className={styles.meta}>Расход</div>
                  </div>
                </div>
                <div className={styles.progressWrapper}>
                  <ProgressBar value={category.progress ?? 0} color={category.color ?? undefined} />
                  <div className={styles.progressText}>
                    {(category.spent ?? 0).toLocaleString('ru-RU')} ₽
                    {category.budget
                      ? ` из ${category.budget.toLocaleString('ru-RU')} ₽`
                      : ' • без лимита'}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={() => handleRename(category.id, category.name)}>
                    Переименовать
                  </button>
                  <button type="button" onClick={() => handleBudget(category.id, category.budget)}>
                    Лимит
                  </button>
                  <button type="button" className={styles.danger} onClick={() => handleDelete(category.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.placeholder}>Добавьте категории, чтобы следить за лимитами расходов.</p>
        )}
      </section>

      {incomeCategories.length ? (
        <section className={styles.section}>
          <header className={styles.header}>
            <span>Категории доходов</span>
            <span className={styles.caption}>Поступления за выбранный месяц</span>
          </header>
          <div className={styles.list}>
            {incomeCategories.map((category) => (
              <div key={category.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.icon} style={{ background: category.color ?? '#272637' }} />
                  <div>
                    <div className={styles.name}>{category.name}</div>
                    <div className={styles.meta}>Доход</div>
                  </div>
                </div>
                <div className={styles.incomeWrapper}>
                  <div className={styles.incomeValue}>
                    {(category.earned ?? 0).toLocaleString('ru-RU')} ₽
                  </div>
                  <div className={styles.incomeMeta}>Получено за месяц</div>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={() => handleRename(category.id, category.name)}>
                    Переименовать
                  </button>
                  <button type="button" onClick={() => handleBudget(category.id, category.budget)}>
                    Лимит
                  </button>
                  <button type="button" className={styles.danger} onClick={() => handleDelete(category.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
