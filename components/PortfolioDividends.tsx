import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import styles from './PortfolioDividends.module.css';

interface DividendRow {
  id: string;
  figi: string | null;
  ticker: string | null;
  amount: number;
  currency: string | null;
  paymentDate: string | Date;
}

interface MonthlySummary {
  month: string;
  label: string;
  total: number;
  currency: string;
}

interface Props {
  dividends: DividendRow[];
  summary: MonthlySummary[];
}

export function PortfolioDividends({ dividends, summary }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Дивиденды и выплаты</h3>
        <p className={styles.subtitle}>Фактические поступления по данным T-Bank Инвестиций</p>
      </div>

      <ul className={styles.summaryList}>
        {summary.map((item) => (
          <li key={`${item.month}-${item.currency}`} className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <span className={styles.summaryValue}>
              {item.total.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} {item.currency}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Инструмент</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {dividends.map((dividend) => (
              <tr key={dividend.id}>
                <td>{format(new Date(dividend.paymentDate), 'd MMM yyyy', { locale: ru }).replace('.', '')}</td>
                <td>{dividend.ticker ?? dividend.figi ?? '—'}</td>
                <td>
                  {dividend.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} {dividend.currency ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
