import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';

export function parseBoundary(value?: string) {
  if (!value) return null;

  const normalized = value.length === 7 ? `${value}-01` : value;
  const parsed = parseISO(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function resolvePeriod(startRaw?: string, endRaw?: string) {
  const now = new Date();
  const fallbackStart = startOfMonth(now);
  const fallbackEnd = endOfMonth(now);

  const parsedStart = parseBoundary(startRaw);
  const parsedEnd = parseBoundary(endRaw);

  let start = startOfMonth(parsedStart ?? fallbackStart);
  let end = endOfMonth(parsedEnd ?? fallbackEnd);

  if (start.getTime() > end.getTime()) {
    const tmp = start;
    start = startOfMonth(end);
    end = endOfMonth(tmp);
  }

  return { start, end };
}

export function buildTimelineRange(start: Date, monthsBack = 11) {
  return {
    from: startOfMonth(subMonths(start, monthsBack)),
    to: endOfMonth(start),
  };
}

export function enumerateMonths(from: Date, to: Date) {
  const months: Date[] = [];
  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addMonths(cursor, 1)) {
    months.push(cursor);
  }
  return months;
}

export function formatMonthKey(date: Date) {
  return format(date, 'yyyy-MM');
}
