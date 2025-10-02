import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import styles from './SpendingChart.module.css';

interface DataPoint {
  date: string;
  value: number;
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
          <h3>Ритм расходов</h3>
          <p>На графике отражены траты по дням выбранного месяца</p>
        </div>
      </header>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={formatted} margin={{ left: 0, right: 0, top: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
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
              formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Расходы']}
              labelFormatter={(label) => `День ${label}`}
            />
            <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#colorSpend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
