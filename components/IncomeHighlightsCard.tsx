import styles from './IncomeHighlightsCard.module.css';

interface IncomeHighlight {
  name: string;
  amount: number;
  color?: string | null;
}

interface Props {
  topCategory: IncomeHighlight | null;
  totalIncome: number;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatShare(amount: number, total: number): string {
  if (total === 0) {
    return '0%';
  }

  const share = (amount / total) * 100;
  if (share === 0) return '0%';
  if (share < 1) return '<1%';
  return `${share.toFixed(share >= 10 ? 0 : 1)}%`;
}

export function IncomeHighlightsCard({ topCategory, totalIncome }: Props) {
  if (!topCategory) {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>Лидирующий источник</h3>
        <p className={styles.placeholder}>Добавьте доходы, чтобы увидеть ключевой источник.</p>
      </div>
    );
  }

  const shareLabel = formatShare(topCategory.amount, totalIncome);

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Лидирующий источник</h3>
      <div className={styles.highlight}>
        <span className={styles.dot} style={{ background: topCategory.color ?? '#22c55e' }} />
        <span className={styles.name}>{topCategory.name}</span>
      </div>
      <div className={styles.amount}>{formatCurrency(topCategory.amount)}</div>
      <span className={styles.caption}>Доля от всех доходов — {shareLabel}</span>
    </div>
  );
}
