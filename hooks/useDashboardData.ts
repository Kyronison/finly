import { useCallback, useMemo, useState } from 'react';
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

const allTimeStartMonth = '1900-01';

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
      monthly: MonthlyDataPoint[];
      totals: { income: number; expenses: number };
      periodStart?: string;
      periodEnd?: string;
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
  }, [endMonth, startMonth]);

  const analytics = useSWR<AnalyticsResponse>(`/api/analytics/overview?${periodQuery}`);
  const categories = useSWR<{ categories: Category[]; allCategories?: Category[] }>(
    `/api/categories?${periodQuery}`,
  );
  const expenses = useSWR<{
    expenses: ExpenseItem[];
    monthly: MonthlyDataPoint[];
    totals: { income: number; expenses: number };
    periodStart?: string;
    periodEnd?: string;
  }>(`/api/expenses?${periodQuery}`);

  const allCategories = useMemo(
    () => categories.data?.allCategories ?? categories.data?.categories ?? [],
    [categories.data?.allCategories, categories.data?.categories],
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
