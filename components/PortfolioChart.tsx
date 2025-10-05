import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import styles from './PortfolioChart.module.css';

interface Point {
  date: string;
  value: number;
  expectedYield?: number | null;
}

interface Series {
  currency: string;
  points: Point[];
}

interface Props {
  series: Series[];
}

type Timeframe = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';

const timeframeOptions: Array<{ value: Timeframe; label: string; days?: number }> = [
  { value: '1D', label: 'День', days: 1 },
  { value: '1W', label: 'Неделя', days: 7 },
  { value: '1M', label: 'Месяц', days: 30 },
  { value: '6M', label: '6 месяцев', days: 182 },
  { value: '1Y', label: 'Год', days: 365 },
  { value: 'ALL', label: 'Все время' },
];

export function PortfolioChart({ series }: Props) {
  const hasData = series.some((item) => item.points.length > 0);
  const [selectedCurrency, setSelectedCurrency] = useState(series[0]?.currency ?? 'RUB');
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');

  const activeSeries = useMemo(() => {
    if (!series.length) return undefined;
    const match = series.find((item) => item.currency === selectedCurrency) ?? series[0];
    const points = [...match.points].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return { ...match, points };
  }, [series, selectedCurrency]);

  const filteredPoints = useMemo(() => {
    if (!activeSeries) return [];
    if (timeframe === 'ALL') return activeSeries.points;

    const daysLimit = timeframeOptions.find((option) => option.value === timeframe)?.days;
    if (!daysLimit) return activeSeries.points;

    const latestDate = new Date(activeSeries.points[activeSeries.points.length - 1]?.date ?? Date.now());
    const earliestAllowed = new Date(latestDate);
    earliestAllowed.setDate(latestDate.getDate() - (daysLimit - 1));

    const sliced = activeSeries.points.filter((point) => new Date(point.date) >= earliestAllowed);
    if (sliced.length === 0) {
      return activeSeries.points.slice(-1);
    }

    return sliced;
  }, [activeSeries, timeframe]);

  const latestPoint = filteredPoints[filteredPoints.length - 1];

  const { minValue, maxValue } = useMemo(() => {
    if (!filteredPoints.length) {
      return { minValue: 0, maxValue: 0 };
    }

    const values = filteredPoints.map((point) => point.value);
    return { minValue: Math.min(...values), maxValue: Math.max(...values) };
  }, [filteredPoints]);

  const yAxisDomain = useMemo(() => {
    if (!filteredPoints.length) return ['auto', 'auto'] as const;

    const range = maxValue - minValue;
    if (range === 0) {
      const padding = Math.max(maxValue * 0.05, 1);
      return [minValue - padding, maxValue + padding] as const;
    }

    const padding = range * 0.1;
    return [minValue - padding, maxValue + padding] as const;
  }, [filteredPoints, maxValue, minValue]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Стоимость портфеля</h3>
          <p className={styles.subtitle}>Ежедневная динамика по данным T-Bank Инвестиций</p>
        </div>
        {hasData ? (
          <div className={styles.controls}>
            {series.length > 1 && (
              <select
                className={styles.select}
                value={activeSeries?.currency}
                onChange={(event) => setSelectedCurrency(event.target.value)}
              >
                {series.map((item) => (
                  <option key={item.currency} value={item.currency}>
                    {item.currency}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.timeframeGroup}>
              {timeframeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    option.value === timeframe
                      ? `${styles.timeframeButton} ${styles.timeframeButtonActive}`
                      : styles.timeframeButton
                  }
                  onClick={() => setTimeframe(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {latestPoint ? (
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Текущая стоимость</span>
                <span className={styles.metricValue}>
                  {latestPoint.value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}{' '}
                  {activeSeries?.currency}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.chartWrapper}>
        {hasData && activeSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredPoints}>
              <defs>
                <linearGradient id={`portfolio-${activeSeries.currency}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                tickFormatter={(value: string) =>
                  format(new Date(value), 'd MMM', { locale: ru }).replace('.', '')
                }
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.5)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => value.toLocaleString('ru-RU')}
                width={90}
                domain={yAxisDomain}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(10, 8, 18, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                }}
                formatter={(value: number) => [
                  `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${activeSeries.currency}`,
                  'Стоимость',
                ]}
                labelFormatter={(label) =>
                  format(new Date(label), 'd MMMM yyyy', { locale: ru }).replace('.', '')
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#38bdf8"
                strokeWidth={2}
                fill={`url(#portfolio-${activeSeries.currency})`}
                baseValue="dataMin"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className={styles.subtitle}>
            Нет данных для отображения графика. Подключите портфель и выполните синхронизацию.
          </p>
        )}
      </div>
    </div>
  );
}
