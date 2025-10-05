import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Area,
  AreaChart,
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>Ритм доходов и расходов</h3>
          <p>Сравните помесячные поступления и траты за выбранный период</p>
        </div>
      </header>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={formatted} margin={{ left: 0, right: 0, top: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="chart-expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="chart-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
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
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#chart-expenses)"
              name="expenses"
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#chart-income)"
              name="income"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
