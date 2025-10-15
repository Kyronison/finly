import { useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import styles from './BalanceTrendChart.module.css';

interface MonthlyPoint {
  date: string;
  income: number;
  expenses: number;
}

interface Props {
  data: MonthlyPoint[];
}

export function BalanceTrendChart({ data }: Props) {
  const sorted = useMemo(
    () =>
      [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data],
  );

  const chartData = useMemo(() => {
    let runningBalance = 0;
    return sorted.map((point) => {
      const parsed = new Date(point.date);
      const labelRaw = format(parsed, 'LLLL yyyy', { locale: ru });
      const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
      const delta = point.income - point.expenses;
      runningBalance += delta;
      return {
        ...point,
        label,
        balance: runningBalance,
        delta,
      };
    });
  }, [sorted]);

  const averageBalance = useMemo(() => {
    if (chartData.length === 0) {
      return 0;
    }
    const total = chartData.reduce((sum, point) => sum + point.balance, 0);
    return total / chartData.length;
  }, [chartData]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>Баланс доходов и расходов</h3>
          <p>Следите за помесячной разницей между доходами и расходами</p>
        </div>
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>Средний баланс</span>
          <span className={styles.summaryValue}>
            {Math.round(averageBalance).toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </header>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.5)"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} width={60} />
            <Tooltip
              contentStyle={{
                background: 'rgba(10, 8, 18, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
              }}
              formatter={(value: number, name: string) => {
                const formatted = `${Math.round(value).toLocaleString('ru-RU')} ₽`;
                if (name === 'balance') {
                  return [formatted, 'Накопленный баланс'];
                }
                if (name === 'income') {
                  return [formatted, 'Доходы'];
                }
                if (name === 'expenses') {
                  return [formatted, 'Расходы'];
                }
                return [formatted, name];
              }}
              labelFormatter={(label) => label}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#38bdf8"
              fill="rgba(56, 189, 248, 0.2)"
              name="Накопленный баланс"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#22c55e"
              fill="rgba(34, 197, 94, 0.12)"
              name="Доходы"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#f97316"
              fill="rgba(249, 115, 22, 0.12)"
              name="Расходы"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
