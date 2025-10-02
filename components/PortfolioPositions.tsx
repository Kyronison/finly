import styles from './PortfolioPositions.module.css';

interface PositionRow {
  id: string;
  figi: string;
  ticker: string | null;
  name: string | null;
  instrumentType: string | null;
  balance: number;
  lot: number | null;
  averagePrice: number | null;
  expectedYield: number | null;
  expectedYieldPercent: number | null;
  currentPrice: number | null;
  investedAmount: number;
  currentValue: number;
  currency: string | null;
}

interface Props {
  positions: PositionRow[];
}

export function PortfolioPositions({ positions }: Props) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Позиции портфеля</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Инструмент</th>
              <th>Кол-во</th>
              <th>Средняя цена</th>
              <th>Инвестировано</th>
              <th>Текущая стоимость</th>
              <th>Доходность</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const yieldValue = (position.currentValue ?? 0) - (position.investedAmount ?? 0);
              const yieldPercent = position.expectedYieldPercent ?? (position.investedAmount
                ? (yieldValue / position.investedAmount) * 100
                : 0);
              const isPositive = yieldValue >= 0;
              return (
                <tr key={position.id}>
                  <td>
                    <div>
                      <div>{position.ticker ?? position.figi}</div>
                      <div className={styles.badge}>{position.instrumentType ?? '—'}</div>
                    </div>
                  </td>
                  <td>
                    {position.balance.toLocaleString('ru-RU')} лотов
                    {position.lot ? ` · ${position.lot} шт.` : ''}
                  </td>
                  <td>
                    {position.averagePrice != null
                      ? `${position.averagePrice.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${position.currency ?? ''}`
                      : '—'}
                  </td>
                  <td>
                    {`${position.investedAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${
                      position.currency ?? ''
                    }`}
                  </td>
                  <td>
                    {`${position.currentValue.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${
                      position.currency ?? ''
                    }`}
                  </td>
                  <td className={isPositive ? styles.yieldPositive : styles.yieldNegative}>
                    {`${yieldValue.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${position.currency ?? ''}`} ·
                    {` ${yieldPercent.toFixed(2)}%`}
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
