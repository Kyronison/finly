import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
  const chartData = summary
    .map((item) => {
      const date = new Date(`${item.month}-01T00:00:00.000Z`);
      const shortLabel = format(date, 'LLL yy', { locale: ru }).replace('.', '');
      return { ...item, shortLabel };
    })
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Дивиденды и выплаты</h3>
        <p className={styles.subtitle}>Фактические поступления по данным T-Bank Инвестиций</p>
      </div>

      {chartData.length ? (
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                stroke="rgba(255, 255, 255, 0.5)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.5)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => value.toLocaleString('ru-RU')}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(10, 8, 18, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                }}
                formatter={(value: number, _name, payload) => [
                  `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${payload?.payload?.currency ?? ''}`,
                  'Дивиденды',
                ]}
                labelFormatter={(label, payload) =>
                  payload && payload[0]
                    ? format(new Date(`${payload[0].payload.month}-01T00:00:00.000Z`), 'LLLL yyyy', {
                        locale: ru,
                      }).replace('.', '')
                    : label
                }
              />
              <Bar dataKey="total" radius={[10, 10, 0, 0]} fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

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
