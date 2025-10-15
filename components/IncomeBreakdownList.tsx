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

export function IncomeBreakdownList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Источники доходов</h3>
        <p className={styles.placeholder}>Добавьте доходы, чтобы увидеть распределение по категориям.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Источники доходов</h3>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.meta}>
              <span className={styles.dot} style={{ background: item.color ?? '#22c55e' }} />
              <div>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.amount}>{item.amount.toLocaleString('ru-RU')} ₽</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
