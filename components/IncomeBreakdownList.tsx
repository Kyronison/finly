import styles from './IncomeBreakdownList.module.css';

interface IncomeItem {
  id: string;
  name: string;
  amount: number;
  color?: string | null;
}

interface Props {
  items: IncomeItem[];
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

function formatShare(value: number): string {
  if (value === 0) return '0%';
  if (value < 1) return '<1%';
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function IncomeBreakdownList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Источники доходов</h3>
        </div>
        <p className={styles.placeholder}>Добавьте доходы, чтобы увидеть распределение по категориям.</p>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Источники доходов</h3>
        <div className={styles.summary}>
          <span>Категорий: {items.length}</span>
          <span>Всего: {formatCurrency(total)}</span>
        </div>
      </div>
      <ul className={styles.list}>
        {items.map((item) => {
          const share = total > 0 ? (item.amount / total) * 100 : 0;
          return (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.meta}>
                  <span className={styles.dot} style={{ background: item.color ?? '#22c55e' }} />
                  <span className={styles.name}>{item.name}</span>
                </div>
                <div className={styles.metrics}>
                  <span className={styles.amount}>{formatCurrency(item.amount)}</span>
                  <span className={styles.share}>{formatShare(share)}</span>
                </div>
              </div>
              <div className={styles.barWrapper}>
                <div className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${Math.min(100, share)}%`, background: item.color ?? '#22c55e' }}
                  />
                </div>
                <span className={styles.shareLabel}>Доля от всех доходов</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
