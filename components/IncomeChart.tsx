import { useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import styles from './SpendingChart.module.css';

interface Props {
  data: Array<{
    date: string;
    income: number;
  }>;
}

export function IncomeChart({ data }: Props) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data],
  );

  const firstMeaningfulIndex = sorted.findIndex((point) => point.income !== 0);
  const prepared = firstMeaningfulIndex > 0 ? sorted.slice(firstMeaningfulIndex) : sorted;

  const formatted = prepared.map((point) => {
    const parsed = new Date(point.date);
    const labelRaw = format(parsed, 'LLLL yyyy', { locale: ru });
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
    return {
      label,
      income: point.income,
    };
  });

  const lastSix = formatted.slice(-6);

  const averageIncome = useMemo(() => {
    if (lastSix.length === 0) {
      return 0;
    }
    const total = lastSix.reduce((sum, point) => sum + point.income, 0);
    return total / lastSix.length;
  }, [lastSix]);

  const latestPoint = formatted[formatted.length - 1];
  const previousPoint = formatted[formatted.length - 2];
  const incomeChange = latestPoint && previousPoint ? latestPoint.income - previousPoint.income : 0;

  const formatCurrency = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;

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
          <h3>Динамика доходов</h3>
          <p>Отслеживайте, как меняются поступления по месяцам</p>
        </div>
      </header>
      <div className={styles.summary}>
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
          <AreaChart data={formatted} margin={{ left: 0, right: 0, top: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
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
            <Tooltip
              contentStyle={{
                background: 'rgba(10, 8, 18, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
              }}
              formatter={(value: number) => [`${Math.round(value).toLocaleString('ru-RU')} ₽`, 'Доходы']}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#22c55e"
              fill="url(#incomeGradient)"
              strokeWidth={2}
              name="Доходы"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
