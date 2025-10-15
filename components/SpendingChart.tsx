import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import styles from './SpendingChart.module.css';

interface DataPoint {
  date: string;
  income: number;
  expenses: number;
}

interface Props {
  data: DataPoint[];
}

export function SpendingChart({ data }: Props) {
  const sorted = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const firstMeaningfulIndex = sorted.findIndex(
    (point) => point.income !== 0 || point.expenses !== 0,
  );

  const prepared =
    firstMeaningfulIndex > 0 ? sorted.slice(firstMeaningfulIndex) : sorted;

  const formatted = prepared.map((point) => {
    const parsed = new Date(point.date);
    const labelRaw = format(parsed, 'LLLL yyyy', { locale: ru });
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
    return {
      ...point,
      label,
    };
  });

  const lastSix = formatted.slice(-6);

  const average = (points: typeof formatted, key: 'income' | 'expenses') => {
    if (points.length === 0) {
      return 0;
    }

    const total = points.reduce((sum, point) => sum + point[key], 0);
    return total / points.length;
  };

  const averageExpenses = average(lastSix, 'expenses');
  const averageIncome = average(lastSix, 'income');

  const latestPoint = formatted[formatted.length - 1];
  const previousPoint = formatted[formatted.length - 2];

  const expensesChange =
    latestPoint && previousPoint
      ? latestPoint.expenses - previousPoint.expenses
      : 0;
  const incomeChange =
    latestPoint && previousPoint ? latestPoint.income - previousPoint.income : 0;

  const formatCurrency = (value: number) =>
    `${Math.round(value).toLocaleString('ru-RU')} ₽`;

  const formatChange = (value: number) => {
    if (!previousPoint) {
      return '—';
    }

    if (value === 0) {
      return '0 ₽';
    }

    const rounded = Math.round(Math.abs(value));
    const amount = `${rounded.toLocaleString('ru-RU')} ₽`;
    return value > 0 ? `+${amount}` : `-${amount}`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>Ритм доходов и расходов</h3>
          <p>Сравните помесячные поступления и траты за выбранный период</p>
        </div>
      </header>
      <div className={styles.summary}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Средние расходы (6 мес.)</span>
          <span className={styles.statValue}>{formatCurrency(averageExpenses)}</span>
          <span
            className={`${styles.statChange} ${
              expensesChange > 0
                ? styles.statChangeNegative
                : expensesChange < 0
                ? styles.statChangePositive
                : ''
            }`}
          >
            {formatChange(expensesChange)} к прошлому месяцу
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Средние доходы (6 мес.)</span>
          <span className={styles.statValue}>{formatCurrency(averageIncome)}</span>
          <span
            className={`${styles.statChange} ${
              incomeChange > 0
                ? styles.statChangePositive
                : incomeChange < 0
                ? styles.statChangeNegative
                : ''
            }`}
          >
            {formatChange(incomeChange)} к прошлому месяцу
          </span>
        </div>
      </div>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={formatted} margin={{ left: 0, right: 0, top: 20, bottom: 0 }} barGap={12}>
            <defs>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.5)"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} width={60} />
            <Brush
              dataKey="label"
              height={28}
              stroke="rgba(255, 255, 255, 0.3)"
              travellerWidth={10}
              fill="rgba(255, 255, 255, 0.04)"
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(10, 8, 18, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
              }}
              formatter={(value: number, name: string) => {
                const title = name === 'expenses' ? 'Расходы' : 'Доходы';
                return [`${value.toLocaleString('ru-RU')} ₽`, title];
              }}
              labelFormatter={(label) => label}
            />
            <Legend
              wrapperStyle={{ paddingTop: 12 }}
              formatter={(value) => (value === 'expenses' ? 'Расходы' : 'Доходы')}
            />
            <Bar dataKey="expenses" fill="#ef4444" radius={[6, 6, 0, 0]} name="expenses" />
            <Bar dataKey="income" fill="#22c55e" radius={[6, 6, 0, 0]} name="income" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
