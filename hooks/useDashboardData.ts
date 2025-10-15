import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import useSWR from 'swr';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget: number | null;
  spent?: number;
  earned?: number;
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
  passiveIncome: number;
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
    passiveIncome?: number;
    activeIncome?: number;
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
  passiveIncome?: {
    total: number;
    byMonth: Array<{ month: string; amount: number }>;
  };
}

export type Timeframe = '6M' | '1Y' | '3Y' | 'ALL';

export const timeframeOptions: Array<{ value: Timeframe; label: string }> = [
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

export interface DashboardData {
  timeframe: Timeframe;
  periodLabel: string;
  handleTimeframeChange: (value: Timeframe) => void;
  handleNavigate: (direction: 'backward' | 'forward') => void;
  canNavigateForward: boolean;
  analytics: ReturnType<typeof useSWR<AnalyticsResponse>>;
  categories: ReturnType<
    typeof useSWR<{ categories: Category[]; allCategories?: Category[] }>
  >;
  expenses: ReturnType<
    typeof useSWR<{
      expenses: ExpenseItem[];
      incomes: ExpenseItem[];
      monthly: MonthlyDataPoint[];
      totals: { income: number; expenses: number; passiveIncome?: number; activeIncome?: number };
      periodStart?: string;
      periodEnd?: string;
      passiveIncome?: { total: number; byMonth: Array<{ month: string; amount: number }> };
    }>
  >;
  expenseCategories: Category[];
  incomeCategories: Category[];
  handleOperationsChanged: () => void;
}

export function useDashboardData(): DashboardData {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [timeframe, setTimeframe] = useState<Timeframe>('6M');
  const [anchorMonth, setAnchorMonth] = useState(currentMonth);
  const [allTimeStartMonth, setAllTimeStartMonth] = useState<string | null>(null);

  const normalizeMonth = useCallback((value?: string | null) => {
    if (!value) {
      return null;
    }

    if (value.length >= 7) {
      const candidate = value.length === 7 ? value : value.slice(0, 7);
      const isoDate = `${candidate}-01T00:00:00`;
      const parsed = new Date(isoDate);
      if (!Number.isNaN(parsed.getTime())) {
        return candidate;
      }
    }

    return null;
  }, []);

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
      return allTimeStartMonth ?? '1900-01';
    }

    const months = timeframeDurations[timeframe];
    const anchorDate = new Date(`${anchorMonth}-01T00:00:00`);
    const startDate = subMonths(anchorDate, Math.max(months - 1, 0));
    return format(startDate, 'yyyy-MM');
  }, [allTimeStartMonth, anchorMonth, timeframe]);

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
  }, [endMonth, startMonth]);

  const analytics = useSWR<AnalyticsResponse>(`/api/analytics/overview?${periodQuery}`);
  const categories = useSWR<{ categories: Category[]; allCategories?: Category[] }>(
    `/api/categories?${periodQuery}`,
  );
  const expenses = useSWR<{
    expenses: ExpenseItem[];
    incomes: ExpenseItem[];
    monthly: MonthlyDataPoint[];
    totals: { income: number; expenses: number; passiveIncome?: number; activeIncome?: number };
    periodStart?: string;
    periodEnd?: string;
    passiveIncome?: { total: number; byMonth: Array<{ month: string; amount: number }> };
  }>(`/api/expenses?${periodQuery}`);

  const allCategories = useMemo(
    () => categories.data?.allCategories ?? categories.data?.categories ?? [],
    [categories.data?.allCategories, categories.data?.categories],
  );

  const periodLabel = useMemo(() => {
    if (timeframe === 'ALL') {
      const monthly = expenses.data?.monthly ?? [];
      const monthsWithActivity = monthly.filter(
        (point) =>
          point.income !== 0 || point.expenses !== 0 || (point.passiveIncome ?? 0) !== 0,
      );

      const firstWithData = monthsWithActivity[0] ?? monthly[0];
      const lastWithData = monthsWithActivity.length
        ? monthsWithActivity[monthsWithActivity.length - 1]
        : monthly[monthly.length - 1];

      const fallbackFirst =
        normalizeMonth(expenses.data?.periodStart) ?? normalizeMonth(allTimeStartMonth);
      const fallbackLast = normalizeMonth(expenses.data?.periodEnd) ?? normalizeMonth(currentMonth);

      const first = formatMonthLabel(
        normalizeMonth(firstWithData?.date) ?? fallbackFirst ?? firstWithData?.date ?? '',
      );
      const last = formatMonthLabel(
        normalizeMonth(lastWithData?.date) ?? fallbackLast ?? lastWithData?.date ?? '',
      );

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
  }, [
    allTimeStartMonth,
    currentMonth,
    endMonth,
    expenses.data?.monthly,
    expenses.data?.periodEnd,
    expenses.data?.periodStart,
    formatMonthLabel,
    normalizeMonth,
    startMonth,
    timeframe,
  ]);

  useEffect(() => {
    if (timeframe !== 'ALL') {
      if (allTimeStartMonth !== null) {
        setAllTimeStartMonth(null);
      }
      return;
    }

    const monthly = expenses.data?.monthly ?? [];
    const operations = [...(expenses.data?.expenses ?? []), ...(expenses.data?.incomes ?? [])];
    const passiveIncomeMonths = expenses.data?.passiveIncome?.byMonth ?? [];

    const collectedMonths: string[] = [];

    const collect = (value?: string | null) => {
      const normalized = normalizeMonth(value);
      if (!normalized) return;
      collectedMonths.push(normalized);
    };

    monthly.forEach((point) => {
      if (point.income !== 0 || point.expenses !== 0 || (point.passiveIncome ?? 0) !== 0) {
        collect(point.date);
      }
    });

    operations.forEach((operation) => collect(operation.date));

    passiveIncomeMonths
      .filter((entry) => entry.amount !== 0)
      .forEach((entry) => collect(entry.month));

    if (collectedMonths.length === 0) {
      return;
    }

    const earliest = collectedMonths.reduce((min, current) => (current < min ? current : min));
    if (earliest !== allTimeStartMonth) {
      setAllTimeStartMonth(earliest);
    }
  }, [allTimeStartMonth, expenses.data, normalizeMonth, timeframe]);

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
    () => allCategories.filter((category) => category.type === 'EXPENSE'),
    [allCategories],
  );

  const incomeCategories = useMemo(
    () => allCategories.filter((category) => category.type === 'INCOME'),
    [allCategories],
  );

  const handleOperationsChanged = useCallback(() => {
    expenses.mutate();
    analytics.mutate();
    categories.mutate();
  }, [analytics, categories, expenses]);

  return {
    timeframe,
    periodLabel,
    handleTimeframeChange,
    handleNavigate,
    canNavigateForward,
    analytics,
    categories,
    expenses,
    expenseCategories,
    incomeCategories,
    handleOperationsChanged,
  };
}
