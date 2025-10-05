import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
  const formatted = data
    .map((point) => ({ ...point, label: new Date(point.date).getDate() }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>Ритм доходов и расходов</h3>
          <p>Сравните ежедневные поступления и траты выбранного месяца</p>
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
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} width={60} />
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
              labelFormatter={(label) => `День ${label}`}
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
