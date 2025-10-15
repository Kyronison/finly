import { useMemo } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/MetricCard';
import { IncomeBreakdownList } from '@/components/IncomeBreakdownList';
import { CategoryForm } from '@/components/CategoryForm';
import { CategoryList } from '@/components/CategoryList';
import { ExpenseForm } from '@/components/ExpenseForm';
import { IncomeChart } from '@/components/IncomeChart';
import { useDashboardData } from '@/hooks/useDashboardData';
import { getAuthenticatedUser, type AuthenticatedUser } from '@/lib/getAuthenticatedUser';
import styles from '@/styles/Dashboard.module.css';

interface IncomeDashboardProps {
  user: AuthenticatedUser;
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export default function IncomeDashboardPage({ user }: IncomeDashboardProps) {
  const router = useRouter();
  const {
    timeframe,
    periodLabel,
    handleTimeframeChange,
    handleNavigate,
    canNavigateForward,
    analytics,
    expenses,
    incomeCategories,
    handleOperationsChanged,
  } = useDashboardData();

  const totalIncome = analytics.data?.totals?.income ?? 0;
  const monthlyPoints = useMemo(
    () => expenses.data?.monthly ?? [],
    [expenses.data?.monthly],
  );
  const monthsWithIncome = monthlyPoints.filter((point) => point.income > 0);
  const averageIncome =
    monthsWithIncome.length === 0
      ? 0
      : monthsWithIncome.reduce((sum, point) => sum + point.income, 0) / monthsWithIncome.length;

  const incomeTimeline = useMemo(
    () => monthlyPoints.map((point) => ({ date: point.date, income: point.income })),
    [monthlyPoints],
  );

  const topIncomeCategory = useMemo(() => {
    if (!incomeCategories.length) {
      return null;
    }
    return incomeCategories.reduce((best, current) => {
      const bestValue = best?.earned ?? 0;
      const currentValue = current.earned ?? 0;
      return currentValue > bestValue ? current : best;
    }, incomeCategories[0]);
  }, [incomeCategories]);

  const incomeBreakdown = useMemo(
    () =>
      incomeCategories
        .filter((category) => (category.earned ?? 0) > 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          amount: category.earned ?? 0,
          color: category.color,
        })),
    [incomeCategories],
  );

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <DashboardHeader
        title="Доходы"
        description="Отслеживайте источники доходов и их стабильность"
        periodLabel={periodLabel}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        onNavigate={handleNavigate}
        canNavigateForward={canNavigateForward}
      />

      <section className={styles.metricsGrid}>
        <MetricCard
          title="Всего доходов"
          value={formatCurrency(totalIncome)}
          subtitle="За выбранный период"
          accent="green"
        />
        <MetricCard
          title="Средние доходы"
          value={formatCurrency(averageIncome)}
          subtitle="Среднее по активным месяцам"
          accent="violet"
        />
        <MetricCard
          title="Ключевой источник"
          value={formatCurrency(topIncomeCategory?.earned ?? 0)}
          subtitle={topIncomeCategory?.name ?? 'Нет данных'}
          accent="orange"
        />
      </section>

      <section className={styles.gridSingle}>
        <IncomeChart data={incomeTimeline} />
      </section>

      <section className={styles.gridSingle}>
        <IncomeBreakdownList items={incomeBreakdown} />
      </section>

      <section className={styles.gridTwoColumn}>
        <CategoryForm mode="INCOME" onCreated={handleOperationsChanged} />
        <ExpenseForm
          mode="INCOME"
          categories={incomeCategories}
          allowUncategorized={false}
          onCreated={handleOperationsChanged}
        />
      </section>

      <section className={styles.gridSingle}>
        <CategoryList categories={incomeCategories} mode="INCOME" onChanged={handleOperationsChanged} />
      </section>

    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<IncomeDashboardProps> = async (context) => {
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
