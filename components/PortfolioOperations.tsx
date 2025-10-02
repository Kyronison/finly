import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import styles from './PortfolioOperations.module.css';

interface OperationRow {
  id: string;
  operationId: string;
  figi: string | null;
  ticker: string | null;
  instrumentType: string | null;
  operationType: string;
  payment: number | null;
  price: number | null;
  quantity: number | null;
  currency: string | null;
  date: string | Date;
  description: string | null;
  commission: number | null;
}

interface Props {
  operations: OperationRow[];
}

export function PortfolioOperations({ operations }: Props) {
  const formatDate = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    return format(date, "d MMM yyyy, HH:mm", { locale: ru }).replace('.', '');
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Последние операции</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th>Инструмент</th>
              <th>Сумма</th>
              <th>Цена</th>
              <th>Количество</th>
              <th>Комиссия</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => {
              const amount = operation.payment ?? 0;
              const isPositive = amount >= 0;
              return (
                <tr key={operation.id}>
                  <td>{formatDate(operation.date)}</td>
                  <td>
                    <span className={styles.operationType}>{operation.operationType}</span>
                  </td>
                  <td>{operation.ticker ?? operation.figi ?? '—'}</td>
                  <td className={isPositive ? styles.positive : styles.negative}>
                    {amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} {operation.currency ?? ''}
                  </td>
                  <td>
                    {operation.price != null
                      ? `${operation.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${operation.currency ?? ''}`
                      : '—'}
                  </td>
                  <td>{operation.quantity != null ? operation.quantity : '—'}</td>
                  <td>
                    {operation.commission != null
                      ? `${operation.commission.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${operation.currency ?? ''}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
