import { useCallback, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import jwt from 'jsonwebtoken';
import { addMonths, format, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import useSWR from 'swr';
import { useRouter } from 'next/router';

import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { SpendingChart } from '@/components/SpendingChart';
import { ExpenseForm } from '@/components/ExpenseForm';
import { ExpenseImport, IncomeImport, TBankImport } from '@/components/ExpenseImport';
import { ExpenseTable } from '@/components/ExpenseTable';
import { CategoryForm } from '@/components/CategoryForm';
import { CategoryList } from '@/components/CategoryList';
import { BreakdownList } from '@/components/BreakdownList';
import { StreakCard } from '@/components/StreakCard';
import { authCookieName } from '@/lib/auth';
import styles from '@/styles/Dashboard.module.css';

interface DashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget: number | null;
  spent?: number;
  progress?: number | null;
  color?: string | null;
}

interface ExpenseItem {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  category?: {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
  } | null;
}

interface MonthlyDataPoint {
  date: string;
  income: number;
  expenses: number;
  expenseBreakdown: Array<{
    id: string;
    name: string;
    color: string | null;
    amount: number;
  }>;
}

interface AnalyticsResponse {
  totals: {
    income: number;
    expenses: number;
    balance: number;
  };
  breakdown: Array<{
    id: string;
    name: string;
    spent: number;
    budget: number | null;
    color?: string | null;
    progress: number | null;
  }>;
  uncategorized: number;
  streak: number;
}

type Timeframe = '6M' | '1Y' | '3Y' | 'ALL';

const timeframeOptions: Array<{ value: Timeframe; label: string }> = [
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: '3Y', label: '3Y' },
  { value: 'ALL', label: 'All time' },
];

const timeframeDurations: Record<Exclude<Timeframe, 'ALL'>, number> = {
  '6M': 6,
  '1Y': 12,
  '3Y': 36,
};

const allTimeStartMonth = '1900-01';

export default function Dashboard({ user }: DashboardProps) {
  const router = useRouter();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [timeframe, setTimeframe] = useState<Timeframe>('6M');
  const [anchorMonth, setAnchorMonth] = useState(currentMonth);

  const formatMonthLabel = useCallback((month: string) => {
    try {
      if (!month) return '';
      const normalized = month.length === 7 ? `${month}-01` : month.slice(0, 10);
      const parsed = new Date(`${normalized}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return '';
      const formatted = format(parsed, 'LLLL yyyy', { locale: ru });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (error) {
      return '';
    }
  }, []);

  const startMonth = useMemo(() => {
    if (timeframe === 'ALL') {
      return allTimeStartMonth;
    }

    const months = timeframeDurations[timeframe];
    const anchorDate = new Date(`${anchorMonth}-01T00:00:00`);
    const startDate = subMonths(anchorDate, Math.max(months - 1, 0));
    return format(startDate, 'yyyy-MM');
  }, [anchorMonth, timeframe]);

  const endMonth = useMemo(() => {
    if (timeframe === 'ALL') {
      return currentMonth;
    }

    return anchorMonth;
  }, [anchorMonth, currentMonth, timeframe]);

  const periodQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('start', startMonth);
    params.set('end', endMonth);
    return params.toString();
  }, [startMonth, endMonth]);

  const analyticsKey = `/api/analytics/overview?${periodQuery}`;
  const categoriesKey = `/api/categories?${periodQuery}`;
  const expensesKey = `/api/expenses?${periodQuery}`;

  const analytics = useSWR<AnalyticsResponse>(analyticsKey);
  const categories = useSWR<{ categories: Category[] }>(categoriesKey);
  const expenses = useSWR<{
    expenses: ExpenseItem[];
    monthly: MonthlyDataPoint[];
    totals: { income: number; expenses: number };
  }>(
    expensesKey,
  );

  const periodLabel = useMemo(() => {
    if (timeframe === 'ALL') {
      const monthly = expenses.data?.monthly ?? [];
      if (monthly.length === 0) {
        return 'За всё время';
      }

      const firstWithData = monthly.find((point) => point.income !== 0 || point.expenses !== 0);
      const lastWithData = [...monthly]
        .reverse()
        .find((point) => point.income !== 0 || point.expenses !== 0);

      const first = formatMonthLabel(firstWithData?.date ?? monthly[0].date);
      const last = formatMonthLabel(lastWithData?.date ?? monthly[monthly.length - 1].date);

      if (!first || !last) {
        return 'За всё время';
      }

      return first === last ? first : `${first} — ${last}`;
    }

    const startLabel = formatMonthLabel(startMonth);
    const endLabel = formatMonthLabel(endMonth);

    if (!startLabel || !endLabel) return '';
    if (startLabel === endLabel) return startLabel;
    return `${startLabel} — ${endLabel}`;
  }, [endMonth, expenses.data?.monthly, formatMonthLabel, startMonth, timeframe]);

  const handleTimeframeChange = useCallback(
    (value: Timeframe) => {
      setTimeframe(value);
      setAnchorMonth((previous) => {
        if (value === 'ALL') {
          return currentMonth;
        }

        return previous > currentMonth ? currentMonth : previous;
      });
    },
    [currentMonth],
  );

  const handleNavigate = useCallback(
    (direction: 'backward' | 'forward') => {
      if (timeframe === 'ALL') return;

      const months = timeframeDurations[timeframe];
      if (!months) return;

      setAnchorMonth((previous) => {
        const anchorDate = new Date(`${previous}-01T00:00:00`);
        const shifted =
          direction === 'backward' ? subMonths(anchorDate, months) : addMonths(anchorDate, months);
        const candidate = format(shifted, 'yyyy-MM');

        if (direction === 'forward' && candidate > currentMonth) {
          return currentMonth;
        }

        return candidate;
      });
    },
    [currentMonth, timeframe],
  );

  const canNavigateForward = timeframe !== 'ALL' && anchorMonth < currentMonth;

  const expenseCategories = useMemo(
    () => (categories.data?.categories ?? []).filter((category) => category.type === 'EXPENSE'),
    [categories.data],
  );

  const incomeCategories = useMemo(
    () => (categories.data?.categories ?? []).filter((category) => category.type === 'INCOME'),
    [categories.data],
  );

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  const handleOperationsChanged = useCallback(() => {
    expenses.mutate();
    analytics.mutate();
    categories.mutate();
  }, [analytics, categories, expenses]);

  const chartCategories = useMemo(() => {
    const usedCategoryIds = new Set<string>();
    (expenses.data?.monthly ?? []).forEach((point) => {
      point.expenseBreakdown.forEach((item) => {
        if (item.id) {
          usedCategoryIds.add(item.id);
        }
      });
    });

    return (categories.data?.categories ?? []).filter((category) =>
      usedCategoryIds.has(category.id),
    );
  }, [categories.data?.categories, expenses.data?.monthly]);

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <div className={styles.headerRow}>
        <div>
          <h1>Финансовый отчёт</h1>
          <p>Период: {periodLabel}</p>
        </div>
        <div className={styles.timeframeControls}>
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
                onClick={() => handleTimeframeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {timeframe !== 'ALL' ? (
            <div className={styles.navigator}>
              <button
                type="button"
                className={styles.navigatorButton}
                onClick={() => handleNavigate('backward')}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.navigatorButton}
                onClick={() => handleNavigate('forward')}
                disabled={!canNavigateForward}
              >
                ›
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <section className={styles.metricsGrid}>
        <MetricCard
          title="Доход"
          value={`${Math.round(analytics.data?.totals?.income ?? 0).toLocaleString('ru-RU')} ₽`}
          subtitle="Синхронизировано за период"
          accent="green"
        />
        <MetricCard
          title="Расходы"
          value={`${Math.round(analytics.data?.totals?.expenses ?? 0).toLocaleString('ru-RU')} ₽`}
          subtitle="Сравните с лимитами категорий"
          accent="orange"
        />
        <MetricCard
          title="Баланс"
          value={`${Math.round(analytics.data?.totals?.balance ?? 0).toLocaleString('ru-RU')} ₽`}
          subtitle="План откладываний и кэш-флоу"
          accent="violet"
        />
      </section>

      <section className={styles.gridSingle}>
        <SpendingChart data={expenses.data?.monthly ?? []} categories={chartCategories} />
      </section>

      <section className={styles.gridSingle}>
        <BreakdownList items={analytics.data?.breakdown ?? []} />
      </section>

      <section className={styles.gridTwoColumn}>
        <CategoryForm onCreated={() => categories.mutate()} />
        <StreakCard streak={analytics.data?.streak ?? 0} />
      </section>

      <section className={styles.gridSingle}>
        <CategoryList categories={categories.data?.categories ?? []} onChanged={() => categories.mutate()} />
      </section>

      <section className={styles.gridTwoColumn}>
        <ExpenseForm categories={expenseCategories} onCreated={handleOperationsChanged} />
        <ExpenseForm
          mode="INCOME"
          categories={incomeCategories}
          allowUncategorized={false}
          onCreated={handleOperationsChanged}
        />
      </section>

      <section className={styles.gridSingle}>
        <div className={styles.importGrid}>
          <ExpenseImport onImported={handleOperationsChanged} />
          <IncomeImport onImported={handleOperationsChanged} />
          <TBankImport onImported={handleOperationsChanged} />
        </div>
      </section>

      <section className={styles.gridSingle}>
        <ExpenseTable
          expenses={expenses.data?.expenses ?? []}
          categories={categories.data?.categories ?? []}
          onChanged={handleOperationsChanged}
          periodStart={expenses.data?.periodStart}
          periodEnd={expenses.data?.periodEnd}
        />
      </section>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const { prisma } = await import('@/lib/prisma');
  const cookies = context.req.cookies ?? {};
  const token = cookies[authCookieName];
  if (!token) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'change-me') as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }

    return { props: { user } };
  } catch (error) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
};
