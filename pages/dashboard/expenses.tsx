import { useMemo } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/MetricCard';
import { SpendingChart } from '@/components/SpendingChart';
import { BreakdownList } from '@/components/BreakdownList';
import { CategoryForm } from '@/components/CategoryForm';
import { CategoryList } from '@/components/CategoryList';
import { StreakCard } from '@/components/StreakCard';
import { ExpenseForm } from '@/components/ExpenseForm';
import { ExpenseTable } from '@/components/ExpenseTable';
import { useDashboardData } from '@/hooks/useDashboardData';
import { getAuthenticatedUser, type AuthenticatedUser } from '@/lib/getAuthenticatedUser';
import styles from '@/styles/Dashboard.module.css';

interface DashboardPageProps {
  user: AuthenticatedUser;
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export default function ExpensesDashboardPage({ user }: DashboardPageProps) {
  const router = useRouter();
  const {
    timeframe,
    periodLabel,
    handleTimeframeChange,
    handleNavigate,
    canNavigateForward,
    analytics,
    expenses,
    chartCategories,
    expenseCategories,
    allCategories,
    handleOperationsChanged,
  } = useDashboardData();

  const totalExpenses = analytics.data?.totals?.expenses ?? 0;
  const monthlyPoints = useMemo(
    () => expenses.data?.monthly ?? [],
    [expenses.data?.monthly],
  );
  const monthsWithExpenses = monthlyPoints.filter((point) => point.expenses > 0);
  const averageExpenses =
    monthsWithExpenses.length === 0
      ? 0
      : monthsWithExpenses.reduce((sum, point) => sum + point.expenses, 0) /
        monthsWithExpenses.length;

  const [latestPoint, previousPoint] = useMemo(() => {
    if (monthlyPoints.length === 0) {
      return [null, null];
    }
    const latest = monthlyPoints[monthlyPoints.length - 1];
    const previous = monthlyPoints.length > 1 ? monthlyPoints[monthlyPoints.length - 2] : null;
    return [latest, previous];
  }, [monthlyPoints]);

  const expenseDelta = latestPoint && previousPoint ? latestPoint.expenses - previousPoint.expenses : null;
  const expenseDeltaValue =
    expenseDelta === null
      ? '—'
      : `${expenseDelta > 0 ? '+' : ''}${Math.round(expenseDelta).toLocaleString('ru-RU')} ₽`;
  const expenseDeltaSubtitle = previousPoint ? 'к прошлому месяцу' : 'Нет данных для сравнения';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <DashboardHeader
        title="Расходы"
        description="Контроль расходов по категориям и динамике"
        periodLabel={periodLabel}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        onNavigate={handleNavigate}
        canNavigateForward={canNavigateForward}
      />

      <section className={styles.metricsGrid}>
        <MetricCard
          title="Всего расходов"
          value={formatCurrency(totalExpenses)}
          subtitle="За выбранный период"
          accent="orange"
        />
        <MetricCard
          title="Средние расходы"
          value={formatCurrency(averageExpenses)}
          subtitle="Среднее по активным месяцам"
          accent="violet"
        />
        <MetricCard
          title="Динамика"
          value={expenseDeltaValue}
          subtitle={expenseDeltaSubtitle}
          accent="green"
        />
      </section>

      <section className={styles.gridSingle}>
        <SpendingChart data={monthlyPoints} categories={chartCategories} />
      </section>

      <section className={styles.gridSingle}>
        <BreakdownList items={analytics.data?.breakdown ?? []} />
      </section>

      <section className={styles.gridTwoColumn}>
        <CategoryForm onCreated={handleOperationsChanged} />
        <StreakCard streak={analytics.data?.streak ?? 0} />
      </section>

      <section className={styles.gridSingle}>
        <CategoryList
          categories={expenseCategories}
          mode="EXPENSES"
          onChanged={handleOperationsChanged}
        />
      </section>

      <section className={styles.gridTwoColumn}>
        <ExpenseForm categories={expenseCategories} onCreated={handleOperationsChanged} />
      </section>

      <section className={styles.gridSingle}>
        <ExpenseTable
          expenses={expenses.data?.expenses ?? []}
          categories={allCategories}
          onChanged={handleOperationsChanged}
          periodStart={expenses.data?.periodStart}
          periodEnd={expenses.data?.periodEnd}
        />
      </section>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<DashboardPageProps> = async (context) => {
  const user = await getAuthenticatedUser(context);
  if (!user) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return { props: { user } };
};
