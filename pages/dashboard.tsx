import { useCallback, useMemo, useState, ChangeEvent } from 'react';
import type { GetServerSideProps } from 'next';
import jwt from 'jsonwebtoken';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import useSWR from 'swr';
import { useRouter } from 'next/router';

import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { SpendingChart } from '@/components/SpendingChart';
import { ExpenseForm } from '@/components/ExpenseForm';
import { ExpenseImport, IncomeImport } from '@/components/ExpenseImport';
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

export default function Dashboard({ user }: DashboardProps) {
  const router = useRouter();
  const defaultMonth = format(new Date(), 'yyyy-MM');
  const [startMonth, setStartMonth] = useState(defaultMonth);
  const [endMonth, setEndMonth] = useState(defaultMonth);

  const formatMonthLabel = useCallback((month: string) => {
    try {
      const parsed = new Date(`${month}-01T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return '';
      const formatted = format(parsed, 'LLLL yyyy', { locale: ru });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (error) {
      return '';
    }
  }, []);

  const periodLabel = useMemo(() => {
    const startLabel = formatMonthLabel(startMonth);
    const endLabel = formatMonthLabel(endMonth);

    if (!startLabel || !endLabel) return '';
    if (startLabel === endLabel) return startLabel;
    return `${startLabel} — ${endLabel}`;
  }, [endMonth, formatMonthLabel, startMonth]);

  const handleStartChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setStartMonth(value);
    setEndMonth((previous) => (previous < value ? value : previous));
  }, []);

  const handleEndChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEndMonth(value);
    setStartMonth((previous) => (previous > value ? value : previous));
  }, []);

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
    monthly: Array<{ date: string; income: number; expenses: number }>;
    totals: { income: number; expenses: number };
  }>(
    expensesKey,
  );

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

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <div className={styles.headerRow}>
        <div>
          <h1>Финансовый отчёт</h1>
          <p>Период: {periodLabel}</p>
        </div>
        <div className={styles.periodPickerGroup}>
          <label className={styles.periodPicker}>
            <span>Начало периода</span>
            <input type="month" value={startMonth} onChange={handleStartChange} />
          </label>
          <label className={styles.periodPicker}>
            <span>Конец периода</span>
            <input type="month" value={endMonth} onChange={handleEndChange} />
          </label>
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
        <SpendingChart data={expenses.data?.monthly ?? []} />
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

      <section className={styles.gridTwoColumn}>
        <ExpenseImport onImported={handleOperationsChanged} />
        <IncomeImport onImported={handleOperationsChanged} />
      </section>

      <section className={styles.gridSingle}>
        <ExpenseTable
          expenses={expenses.data?.expenses ?? []}
          categories={categories.data?.categories ?? []}
          onChanged={handleOperationsChanged}
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
