'use client';

import { ChangeEvent, ReactNode, useMemo, useRef, useState } from 'react';

import { TBankIcon } from './icons/TBankIcon';

import styles from './ExpenseImport.module.css';

type Mode = 'EXPENSE' | 'INCOME';

interface Props {
  onImported: () => void;
}

interface ImportCardProps extends Props {
  endpoint: string;
  description: string;
  title: string;
  type: Mode;
  icon?: ReactNode;
  parser?: (content: string) => ParseResult;
  hint?: string;
  renderSummary?: (result: ImportResponse, localSkipped: number) => ReactNode;
}

interface ParsedOperation {
  date: string;
  categoryName: string | null;
  amount: number;
  description: string | null;
}

interface ImportResponse {
  created: number;
  skipped: number;
  categoriesCreated: number;
}

interface ParseResult<T = ParsedOperation> {
  operations: T[];
  skipped: number;
}

interface ParsedTBankOperation extends ParsedOperation {
  type: Mode;
}

interface ImportBreakdown {
  created: number;
  skipped: number;
  categoriesCreated: number;
}

interface TBankImportResponse extends ImportResponse {
  breakdown: {
    expenses: ImportBreakdown;
    incomes: ImportBreakdown;
  };
}

function normaliseHeader(value: string): string {
  return value.replace(/^"|"$/g, '').trim().toLowerCase();
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes('\t')) return '\t';
  if (headerLine.includes(';')) return ';';
  return ',';
}

function parseAmount(raw: string): number | null {
  const normalised = raw.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!normalised) return null;
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[./-]/).filter(Boolean);
  if (parts.length < 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  const day = Number(dayStr);
  const month = Number(monthStr);
  let year = Number(yearStr);

  if (!Number.isInteger(day) || !Number.isInteger(month)) {
    return null;
  }

  if (yearStr.length === 2) {
    year += year < 50 ? 2000 : 1900;
  }

  if (!Number.isInteger(year)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function findHeaderIndex(cells: string[], keywords: string[]): number {
  return cells.findIndex((cell) => keywords.some((keyword) => cell.includes(keyword)));
}

function parseTable(content: string): ParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { operations: [], skipped: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = lines[0].split(delimiter).map(normaliseHeader);

  const dateIndex = findHeaderIndex(headerCells, ['дата', 'date']);
  const categoryIndex = findHeaderIndex(headerCells, ['катег', 'стат', 'доход', 'расход', 'article']);
  const amountIndex = findHeaderIndex(headerCells, ['стоим', 'сумм', 'amount', 'price']);
  const commentIndex = findHeaderIndex(headerCells, ['коммент', 'опис', 'note', 'comment']);

  const operations: ParsedOperation[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim());

    const dateValue = dateIndex >= 0 ? cells[dateIndex] ?? '' : '';
    const categoryValue = categoryIndex >= 0 ? cells[categoryIndex] ?? '' : '';
    const amountValue = amountIndex >= 0 ? cells[amountIndex] ?? '' : '';
    const commentValue = commentIndex >= 0 ? cells[commentIndex] ?? '' : '';

    const amount = parseAmount(amountValue);
    const date = parseDate(dateValue);

    if (!amount || !date) {
      skipped += 1;
      continue;
    }

    operations.push({
      amount,
      date,
      categoryName: categoryValue ? categoryValue.trim() : null,
      description: commentValue ? commentValue.trim() : null,
    });
  }

  return { operations, skipped };
}

function parseSignedAmount(raw: string): number | null {
  const normalised = raw.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!normalised) return null;
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }
  return amount;
}

function parseTBankDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const [datePart] = trimmed.split(/[ T]/);
  if (!datePart) return null;

  const separators = datePart.includes('.') ? /[.]/ : /[-/]/;
  const parts = datePart.split(separators).filter(Boolean);
  if (parts.length < 3) return null;

  let day: number;
  let month: number;
  let year: number;

  if (parts[0].length === 4) {
    [year, month, day] = parts.map((value) => Number(value));
  } else {
    [day, month, year] = parts.map((value) => Number(value));
  }

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseTBankTable(content: string): ParseResult<ParsedTBankOperation> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { operations: [], skipped: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = lines[0].split(delimiter).map(normaliseHeader);

  const dateIndex = findHeaderIndex(headerCells, ['дата операции', 'дата платежа', 'operation date', 'date']);
  const categoryIndex = findHeaderIndex(headerCells, ['катег', 'category']);
  const amountIndex = findHeaderIndex(headerCells, ['сумма платеж', 'сумма операции', 'amount']);
  const commentIndex = findHeaderIndex(headerCells, ['опис', 'назначение', 'comment']);

  const operations: ParsedTBankOperation[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim());

    const dateRaw = dateIndex >= 0 ? cells[dateIndex] ?? '' : '';
    const amountRaw = amountIndex >= 0 ? cells[amountIndex] ?? '' : '';

    const date = parseTBankDate(dateRaw);
    const signedAmount = parseSignedAmount(amountRaw);

    if (!date || signedAmount === null) {
      skipped += 1;
      continue;
    }

    const type: Mode = signedAmount < 0 ? 'EXPENSE' : 'INCOME';
    const amount = Math.abs(signedAmount);

    if (amount === 0) {
      skipped += 1;
      continue;
    }

    const categoryValue = categoryIndex >= 0 ? cells[categoryIndex] ?? '' : '';
    const commentValue = commentIndex >= 0 ? cells[commentIndex] ?? '' : '';

    operations.push({
      type,
      amount,
      date,
      categoryName: categoryValue ? categoryValue.trim() : null,
      description: commentValue ? commentValue.trim() : null,
    });
  }

  return { operations, skipped };
}

function ImportCard({
  endpoint,
  description,
  icon,
  onImported,
  title,
  type,
  parser,
  hint: hintOverride,
  renderSummary,
}: ImportCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [localSkipped, setLocalSkipped] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hint = useMemo(() => {
    if (hintOverride) {
      return hintOverride;
    }

    if (type === 'INCOME') {
      return 'Категория обязательна для каждой строки.';
    }
    return 'Категория может быть пустой — мы сохраним расход без неё.';
  }, [hintOverride, type]);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setResult(null);
    setLocalSkipped(0);

    try {
      const text = await file.text();
      const parse = parser ?? parseTable;
      const parsed = parse(text);
      if (parsed.operations.length === 0) {
        throw new Error('Не удалось найти операции в файле. Проверьте формат столбцов.');
      }

      setLocalSkipped(parsed.skipped);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: parsed.operations }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? 'Не удалось импортировать операции');
      }

      const payload = (await response.json()) as ImportResponse;
      setResult(payload);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          {icon ? <span className={styles.icon}>{icon}</span> : null}
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p className={styles.caption}>{description}</p>
      </header>

      <div className={styles.actions}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
          disabled={isLoading}
        />
        <button
          type="button"
          className={styles.uploadButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? 'Импортирую…' : 'Выбрать файл'}
        </button>
        <span className={styles.hint}>
          Требуются столбцы «Дата», «Категория», «Стоимость», «Комментарий». {hint}
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.summary}>
          {renderSummary ? (
            renderSummary(result, localSkipped)
          ) : (
            <>
              <span>
                Импортировано: <strong>{result.created}</strong>
              </span>
              <span>
                Создано категорий: <strong>{result.categoriesCreated}</strong>
              </span>
              <span>
                Пропущено: <strong>{result.skipped + localSkipped}</strong>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ExpenseImport({ onImported }: Props) {
  return (
    <ImportCard
      title="Импорт расходов"
      description="Загрузите CSV или TSV-файл с датой, категорией, суммой и комментарием — мы импортируем траты и создадим категории, если их ещё нет."
      endpoint="/api/expenses/import"
      type="EXPENSE"
      onImported={onImported}
    />
  );
}

export function IncomeImport({ onImported }: Props) {
  return (
    <ImportCard
      title="Импорт доходов"
      description="Загрузите CSV или TSV-файл с датой, категорией, суммой и комментарием — недостающие категории доходов создадутся автоматически."
      endpoint="/api/incomes/import"
      type="INCOME"
      onImported={onImported}
    />
  );
}

export function TBankImport({ onImported }: Props) {
  return (
    <ImportCard
      title="Т-Банк"
      description="Загрузите выгрузку операций из Т-Банка — мы разделим поступления и расходы и сопоставим категории."
      endpoint="/api/expenses/import-tbank"
      type="EXPENSE"
      icon={<TBankIcon width={32} height={32} />}
      parser={parseTBankTable}
      hint="Поддерживаются CSV- и TSV-файлы из интернет-банка Т-Банка."
      renderSummary={(result, localSkipped) => {
        const payload = result as TBankImportResponse;
        const expenses = payload.breakdown?.expenses;
        const incomes = payload.breakdown?.incomes;

        return (
          <>
            <span>
              Импортировано: <strong>{result.created}</strong>
              {expenses && incomes ? (
                <span className={styles.muted}>
                  {' '}(расходы {expenses.created}, доходы {incomes.created})
                </span>
              ) : null}
            </span>
            <span>
              Создано категорий: <strong>{result.categoriesCreated}</strong>
            </span>
            <span>
              Пропущено: <strong>{result.skipped + localSkipped}</strong>
            </span>
          </>
        );
      }}
      onImported={onImported}
    />
  );
}
