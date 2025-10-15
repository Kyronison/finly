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
import { ExpenseTable } from '@/components/ExpenseTable';
import { IncomeHighlightsCard } from '@/components/IncomeHighlightsCard';
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
  const passiveIncomeTotal =
    analytics.data?.totals?.passiveIncome ?? expenses.data?.passiveIncome?.total ?? 0;
  const activeIncomeTotal =
    analytics.data?.totals?.activeIncome ?? totalIncome - passiveIncomeTotal;
  const monthlyPoints = useMemo(() => expenses.data?.monthly ?? [], [expenses.data?.monthly]);

  const incomeTimeline = useMemo(
    () => monthlyPoints.map((point) => ({ date: point.date, income: point.income })),
    [monthlyPoints],
  );

  const [latestPoint, previousPoint] = useMemo(() => {
    if (monthlyPoints.length === 0) {
      return [null, null] as const;
    }
    const latest = monthlyPoints[monthlyPoints.length - 1];
    const previous = monthlyPoints.length > 1 ? monthlyPoints[monthlyPoints.length - 2] : null;
    return [latest, previous] as const;
  }, [monthlyPoints]);

  const incomeDelta = latestPoint && previousPoint ? latestPoint.income - previousPoint.income : null;
  const incomeDeltaValue =
    incomeDelta === null
      ? '—'
      : `${incomeDelta > 0 ? '+' : ''}${Math.round(incomeDelta).toLocaleString('ru-RU')} ₽`;
  const incomeDeltaSubtitle = previousPoint ? 'к прошлому месяцу' : 'Нет данных для сравнения';

  const activeIncomeBreakdown = useMemo(
    () =>
      incomeCategories
        .filter((category) => (category.earned ?? 0) !== 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          amount: category.earned ?? 0,
          color: category.color,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6),
    [incomeCategories],
  );

  const passiveIncomeBreakdown = useMemo(
    () =>
      passiveIncomeTotal !== 0
        ? [
            {
              id: 'passive-investments',
              name: 'Пассивный доход (инвестиции)',
              amount: passiveIncomeTotal,
              color: '#22c55e',
            },
          ]
        : [],
    [passiveIncomeTotal],
  );

  const incomeBreakdown = useMemo(
    () => [...passiveIncomeBreakdown, ...activeIncomeBreakdown],
    [activeIncomeBreakdown, passiveIncomeBreakdown],
  );

  const topIncomeCategory = activeIncomeBreakdown[0] ?? passiveIncomeBreakdown[0] ?? null;

  const topIncomeHighlight = topIncomeCategory
    ? { name: topIncomeCategory.name, amount: topIncomeCategory.amount, color: topIncomeCategory.color }
    : null;

  const highlightTotal = topIncomeCategory?.id === 'passive-investments'
    ? totalIncome
    : activeIncomeTotal;

  const incomeOperations = expenses.data?.incomes ?? [];

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
          subtitle="За выбранный период (активные + пассивные)"
          accent="green"
        />
        <MetricCard
          title="Активные доходы"
          value={formatCurrency(activeIncomeTotal)}
          subtitle="Доходы по категориям"
          accent="violet"
        />
        <MetricCard
          title="Пассивный доход"
          value={formatCurrency(passiveIncomeTotal)}
          subtitle="Сводка по инвестициям"
          accent="green"
        />
        <MetricCard
          title="Динамика"
          value={incomeDeltaValue}
          subtitle={incomeDeltaSubtitle}
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
        <IncomeHighlightsCard topCategory={topIncomeHighlight} totalIncome={highlightTotal} />
      </section>

      <section className={styles.gridSingle}>
        <CategoryList categories={incomeCategories} mode="INCOME" onChanged={handleOperationsChanged} />
      </section>

      <section className={styles.gridTwoColumn}>
        <ExpenseForm
          mode="INCOME"
          categories={incomeCategories}
          allowUncategorized={false}
          onCreated={handleOperationsChanged}
        />
      </section>

      <section className={styles.gridSingle}>
        <ExpenseTable
          expenses={incomeOperations}
          categories={incomeCategories}
          onChanged={handleOperationsChanged}
          periodStart={expenses.data?.periodStart}
          periodEnd={expenses.data?.periodEnd}
          allowUncategorized={false}
          mode="INCOME"
        />
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
