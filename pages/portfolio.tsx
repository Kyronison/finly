import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { GetServerSideProps } from "next";
import jwt from "jsonwebtoken";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useRouter } from "next/router";

import { DashboardLayout } from "@/components/DashboardLayout";
import { PortfolioChart } from "@/components/PortfolioChart";
import { PortfolioPositions } from "@/components/PortfolioPositions";
import { PortfolioOperations } from "@/components/PortfolioOperations";
import { PortfolioDividends } from "@/components/PortfolioDividends";
import { authCookieName } from "@/lib/auth";
import { ALL_ACCOUNTS_ID, ALL_ACCOUNTS_LABEL } from "@/lib/investAccounts";
import styles from "@/styles/Portfolio.module.css";
import ChatWidget from "./chatbase.tsx";

interface AccountPreview {
  brokerAccountId: string;
  brokerAccountType: string;
}

interface PortfolioResponse {
  connection: {
    id: string;
    accountId: string | null;
    brokerAccountType: string | null;
    lastSyncedAt: string | null;
    createdAt: string;
  } | null;
  positions: Array<{
    id: string;
    figi: string;
    ticker: string | null;
    name: string | null;
    instrumentType: string | null;
    balance: number;
    lot: number | null;
    averagePrice: number | null;
    expectedYield: number | null;
    expectedYieldPercent: number | null;
    currentPrice: number | null;
    investedAmount: number;
    currentValue: number;
    currency: string | null;
    brandLogoName: string | null;
  }>;
  operations: Array<{
    id: string;
    operationId: string;
    figi: string | null;
    ticker: string | null;
    instrumentType: string | null;
    operationType: string;
    payment: number | null;
    price: number | null;
    quantity: number | null;
    currency: string | null;
    date: string;
    description: string | null;
    commission: number | null;
  }>;
  dividends: Array<{
    id: string;
    figi: string | null;
    ticker: string | null;
    amount: number;
    currency: string | null;
    paymentDate: string;
  }>;
  dividendsByMonth: Array<{
    month: string;
    label: string;
    total: number;
    currency: string;
  }>;
  charts: Array<{
    currency: string;
    points: Array<
      { date: string; value: number; expectedYield?: number | null }
    >;
  }>;
}

interface PortfolioPageProps {
  user: { id: string; name: string; email: string };
}

export default function PortfolioPage({ user }: PortfolioPageProps) {
  const router = useRouter();
  const { data, mutate } = useSWR<PortfolioResponse>("/api/invest/portfolio");
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [availableAccounts, setAvailableAccounts] = useState<AccountPreview[]>(
    [],
  );
  const [requiresAccountSelection, setRequiresAccountSelection] = useState(
    false,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const totals = useMemo(() => {
    const positions = data?.positions ?? [];
    const invested = positions.reduce(
      (acc, item) => acc + (item.investedAmount ?? 0),
      0,
    );
    const current = positions.reduce(
      (acc, item) => acc + (item.currentValue ?? 0),
      0,
    );
    const yieldValue = current - invested;
    return { invested, current, yieldValue };
  }, [data?.positions]);

  const dividendsTotal = useMemo(() => {
    return (data?.dividends ?? []).reduce((acc, item) => acc + item.amount, 0);
  }, [data?.dividends]);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invest/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accountId: accountId || undefined }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? "Не удалось подключить портфель");
        if (
          payload.requiresAccountSelection && Array.isArray(payload.accounts)
        ) {
          const accounts = payload.accounts as AccountPreview[];
          setAvailableAccounts(accounts);
          setRequiresAccountSelection(true);
          if (!accountId && data?.connection?.accountId === ALL_ACCOUNTS_ID) {
            const hasAllAccountsOption = accounts.some((account) =>
              account.brokerAccountId === ALL_ACCOUNTS_ID
            );
            if (hasAllAccountsOption) {
              setAccountId(ALL_ACCOUNTS_ID);
            }
          }
        }
        return;
      }

      setToken("");
      setAccountId("");
      setAvailableAccounts([]);
      setRequiresAccountSelection(false);
      await mutate();
    } catch (err) {
      console.error(err);
      setError("Во время подключения произошла ошибка. Попробуйте снова.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/invest/sync", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.message ?? "Не удалось обновить данные портфеля");
        return;
      }
      await mutate();
    } catch (err) {
      console.error(err);
      setError("Во время синхронизации произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await fetch("/api/invest/connection", { method: "DELETE" });
      setAvailableAccounts([]);
      setRequiresAccountSelection(false);
      setToken("");
      setAccountId("");
      await mutate();
    } catch (err) {
      console.error(err);
      setError("Не удалось отключить портфель. Попробуйте снова.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const lastSyncedLabel = data?.connection?.lastSyncedAt
    ? formatDistanceToNow(new Date(data.connection.lastSyncedAt), {
      addSuffix: true,
      locale: ru,
    })
    : null;

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <ChatWidget />
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <div>
            <h1>Инвестиционный портфель</h1>
            <p>Управляйте активами, синхронизированными с T-Bank Инвест API</p>
          </div>
          {data?.connection
            ? (
              <div className={styles.statusRow}>
                <span>
                  Счёт: {data.connection.accountId === ALL_ACCOUNTS_ID
                    ? ALL_ACCOUNTS_LABEL
                    : data.connection.accountId ?? "—"}
                </span>
                <span>
                  Тип: {data.connection.accountId === ALL_ACCOUNTS_ID
                    ? ALL_ACCOUNTS_LABEL
                    : data.connection.brokerAccountType ?? "—"}
                </span>
                <span>
                  Последняя синхронизация:{" "}
                  {lastSyncedLabel ?? "ещё не выполнялась"}
                </span>
              </div>
            )
            : null}
        </div>

        <section className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Текущая стоимость</span>
            <span className={styles.metricValue}>
              {totals.current.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
              })} ₽
            </span>
            <span className={styles.metricDelta}>
              Инвестировано: {totals.invested.toLocaleString("ru-RU")} ₽
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Накопленный результат</span>
            <span className={styles.metricValue}>
              {totals.yieldValue.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
              })} ₽
            </span>
            <span className={styles.metricDelta}>
              {totals.invested > 0
                ? `Доходность: ${
                  ((totals.yieldValue / totals.invested) * 100).toFixed(2)
                }%`
                : "Доходность: —"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Дивиденды (история)</span>
            <span className={styles.metricValue}>
              {dividendsTotal.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
              })} ₽
            </span>
            <span className={styles.metricDelta}>
              Последние 12 месяцев:{" "}
              {data?.dividendsByMonth?.[0]?.total?.toLocaleString("ru-RU") ??
                "—"} ₽
            </span>
          </div>
        </section>

        <section className={styles.layoutFull}>
          <div className={styles.connectCard}>
            <div>
              <h2 className={styles.connectTitle}>
                Подключение T-Bank Invest API
              </h2>
              <p className={styles.connectSubtitle}>
                Используйте персональный токен из настроек брокера. Мы сохраняем
                токен только для синхронизации и не передаём его третьим лицам.
              </p>
            </div>

            <form className={styles.connectForm} onSubmit={handleConnect}>
              <input
                className={styles.input}
                type="password"
                placeholder="Секретный токен"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required={!data?.connection}
              />
              {requiresAccountSelection && (
                <select
                  className={styles.input}
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  required
                >
                  <option value="">Выберите счёт</option>
                  {availableAccounts.map((account) => {
                    const isAllAccounts =
                      account.brokerAccountId === ALL_ACCOUNTS_ID;
                    const label = isAllAccounts
                      ? ALL_ACCOUNTS_LABEL
                      : account.brokerAccountType
                      ? `${account.brokerAccountId} · ${account.brokerAccountType}`
                      : account.brokerAccountId;
                    return (
                      <option
                        key={account.brokerAccountId}
                        value={account.brokerAccountId}
                      >
                        {label}
                      </option>
                    );
                  })}
                </select>
              )}

              {error ? <span className={styles.error}>{error}</span> : null}

              <div className={styles.buttonRow}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {data?.connection ? "Обновить токен" : "Подключить портфель"}
                </button>
                {data?.connection
                  ? (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleSync}
                        disabled={isSyncing}
                      >
                        {isSyncing
                          ? "Синхронизация..."
                          : "Синхронизировать сейчас"}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={handleDisconnect}
                      >
                        Отключить портфель
                      </button>
                    </>
                  )
                  : null}
              </div>
            </form>
          </div>

          <PortfolioChart series={data?.charts ?? []} />
        </section>

        <section className={styles.layoutGrid}>
          <PortfolioPositions positions={data?.positions ?? []} />
          <PortfolioDividends
            dividends={data?.dividends ?? []}
            summary={data?.dividendsByMonth ?? []}
          />
        </section>

        <section className={styles.layoutFull}>
          <PortfolioOperations operations={data?.operations ?? []} />
        </section>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<PortfolioPageProps> =
  async (context) => {
    const { prisma } = await import("@/lib/prisma");
    const cookies = context.req.cookies ?? {};
    const token = cookies[authCookieName];
    if (!token) {
      return {
        redirect: {
          destination: "/",
          permanent: false,
        },
      };
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET ?? "change-me",
      ) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        return {
          redirect: {
            destination: "/",
            permanent: false,
          },
        };
      }

      return { props: { user } };
    } catch (error) {
      return {
        redirect: {
          destination: "/",
          permanent: false,
        },
      };
    }
  };
