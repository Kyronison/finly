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

export function BreakdownList({ items }: Props) {
  return (
    <div className={styles.container}>
      <h3>Топ расходов</h3>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.meta}>
              <span className={styles.dot} style={{ background: item.color ?? '#6366f1' }} />
              <div>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.amount}>{item.spent.toLocaleString('ru-RU')} ₽</div>
              </div>
            </div>
            <div className={styles.progress}>
              <ProgressBar value={item.progress ?? 0} color={item.color ?? undefined} />
              <span className={styles.caption}>
                {item.budget ? `Лимит ${item.budget.toLocaleString('ru-RU')} ₽` : 'Лимит не задан'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
