import { useMemo } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { DashboardLayout } from '@/components/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/MetricCard';
import { BalanceTrendChart } from '@/components/BalanceTrendChart';
import { ExpenseImport, IncomeImport, TBankImport } from '@/components/ExpenseImport';
import { useDashboardData } from '@/hooks/useDashboardData';
import { getAuthenticatedUser, type AuthenticatedUser } from '@/lib/getAuthenticatedUser';
import styles from '@/styles/Dashboard.module.css';

interface BalanceDashboardProps {
  user: AuthenticatedUser;
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatMonth(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const normalized = value.length === 7 ? `${value}-01` : value.slice(0, 10);
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const label = format(parsed, 'LLLL yyyy', { locale: ru });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function BalanceDashboardPage({ user }: BalanceDashboardProps) {
  const router = useRouter();
  const {
    timeframe,
    periodLabel,
    handleTimeframeChange,
    handleNavigate,
    canNavigateForward,
    analytics,
    expenses,
    handleOperationsChanged,
  } = useDashboardData();

  const totalIncome = analytics.data?.totals?.income ?? 0;
  const totalExpenses = analytics.data?.totals?.expenses ?? 0;
  const balance = analytics.data?.totals?.balance ?? 0;
  const monthlyPoints = useMemo(
    () => expenses.data?.monthly ?? [],
    [expenses.data?.monthly],
  );

  const sortedMonthlyPoints = useMemo(
    () =>
      [...monthlyPoints].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [monthlyPoints],
  );

  const monthlyBalances = useMemo(() => {
    let runningBalance = 0;
    return sortedMonthlyPoints.map((point) => {
      runningBalance += point.income - point.expenses;
      return {
        date: point.date,
        balance: runningBalance,
      };
    });
  }, [sortedMonthlyPoints]);

  const bestMonth = useMemo(() => {
    if (!monthlyBalances.length) {
      return null;
    }
    return monthlyBalances.reduce((best, current) => (current.balance > best.balance ? current : best));
  }, [monthlyBalances]);

  const worstMonth = useMemo(() => {
    if (!monthlyBalances.length) {
      return null;
    }
    return monthlyBalances.reduce((worst, current) => (current.balance < worst.balance ? current : worst));
  }, [monthlyBalances]);

  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <DashboardHeader
        title="Баланс"
        description="Понимайте разницу между доходами и расходами"
        periodLabel={periodLabel}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        onNavigate={handleNavigate}
        canNavigateForward={canNavigateForward}
      />

      <section className={styles.metricsGrid}>
        <MetricCard
          title="Баланс периода"
          value={formatCurrency(balance)}
          subtitle="Доходы минус расходы"
          accent="violet"
        />
        <MetricCard
          title="Сберегаемость"
          value={`${Math.round(savingsRate)} %`}
          subtitle="Доля доходов, оставшихся после расходов"
          accent="green"
        />
        <MetricCard
          title="Лучший месяц"
          value={formatCurrency(bestMonth?.balance ?? 0)}
          subtitle={formatMonth(bestMonth?.date) || 'Нет данных'}
          accent="green"
        />
        <MetricCard
          title="Сложный месяц"
          value={formatCurrency(worstMonth?.balance ?? 0)}
          subtitle={formatMonth(worstMonth?.date) || 'Нет данных'}
          accent="orange"
        />
      </section>

      <section className={styles.gridSingle}>
        <BalanceTrendChart data={sortedMonthlyPoints} />
      </section>

      <section className={styles.gridSingle}>
        <div className={styles.balanceSummaryCard}>
          <h3>Соотношение доходов и расходов</h3>
          <p>
            Доходы: {formatCurrency(totalIncome)} • Расходы: {formatCurrency(totalExpenses)} • Баланс:{' '}
            {formatCurrency(balance)}
          </p>
        </div>
      </section>

      <section className={styles.gridSingle}>
        <div className={styles.importGrid}>
          <TBankImport onImported={handleOperationsChanged} />
          <ExpenseImport onImported={handleOperationsChanged} />
          <IncomeImport onImported={handleOperationsChanged} />
        </div>
      </section>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<BalanceDashboardProps> = async (context) => {
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
