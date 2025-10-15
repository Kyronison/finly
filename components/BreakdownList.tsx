import { useMemo } from 'react';

import styles from './BreakdownList.module.css';
import { ProgressBar } from './ProgressBar';

interface BreakdownItem {
  id: string;
  name: string;
  spent: number;
  budget: number | null;
  color?: string | null;
  progress: number | null;
}

interface Props {
  items: BreakdownItem[];
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

function formatShare(value: number): string {
  if (value === 0) return '0%';
  if (value < 1) return '<1%';
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function BreakdownList({ items }: Props) {
  const sortedItems = useMemo(() => [...items].sort((a, b) => b.spent - a.spent), [items]);
  const total = sortedItems.reduce((sum, item) => sum + item.spent, 0);

  if (sortedItems.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Топ расходов</h3>
        </div>
        <p className={styles.placeholder}>Добавьте расходы, чтобы увидеть распределение по категориям.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Топ расходов</h3>
        <div className={styles.summary}>
          <span>Категорий: {sortedItems.length}</span>
          <span>Всего: {formatCurrency(total)}</span>
        </div>
      </div>
      <ul className={styles.list}>
        {sortedItems.map((item) => {
          const share = total > 0 ? (item.spent / total) * 100 : 0;
          const limitLabel = item.budget ? `Лимит ${formatCurrency(item.budget)}` : 'Лимит не задан';
          let statusLabel: string | null = null;
          let statusTone: 'positive' | 'negative' | 'muted' = 'muted';

          if (item.budget) {
            const remaining = item.budget - item.spent;
            statusTone = remaining >= 0 ? 'positive' : 'negative';
            statusLabel = remaining >= 0 ? `Остаток ${formatCurrency(remaining)}` : `Перерасход ${formatCurrency(Math.abs(remaining))}`;
          } else {
            statusLabel = 'Категория без лимита';
          }

          return (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.meta}>
                  <span className={styles.dot} style={{ background: item.color ?? '#6366f1' }} />
                  <span className={styles.name}>{item.name}</span>
                </div>
                <div className={styles.metrics}>
                  <span className={styles.amount}>{formatCurrency(item.spent)}</span>
                  <span className={styles.share}>{formatShare(share)}</span>
                </div>
              </div>
              <div className={styles.progressBlock}>
                <ProgressBar value={share / 100} color={item.color ?? undefined} />
                <div className={styles.captionRow}>
                  <span className={styles.caption}>Доля от всех расходов</span>
                  <span className={styles.caption}>{formatShare(share)}</span>
                </div>
                <div className={styles.captionRow}>
                  <span className={`${styles.status} ${styles[statusTone]}`}>{statusLabel}</span>
                  <span className={styles.caption}>{limitLabel}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
