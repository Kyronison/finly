import { useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  type AuthenticatedUser,
  getAuthenticatedUser,
} from "@/lib/getAuthenticatedUser";
import type { PaymentProvider } from "@/lib/payments";
import styles from "@/styles/Subscription.module.css";

interface SubscriptionPageProps {
  user: AuthenticatedUser;
}

const MONTHLY_PRICE = 990;

export default function SubscriptionPage({ user }: SubscriptionPageProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(() => {
    const paymentStatus = Array.isArray(router.query.payment)
      ? router.query.payment[0]
      : router.query.payment;

    if (paymentStatus === "success") {
      return "Оплата прошла успешно";
    }
    if (paymentStatus === "failed") {
      return "Оплата не была завершена";
    }
    return null;
  });
  const [loadingProvider, setLoadingProvider] = useState<PaymentProvider | null>(
    null,
  );

  const planDescription = useMemo(
    () => [
      "Импорт банковских выписок и брокерских операций",
      "Расширенная аналитика расходов и пассивов",
      "Календарь платежей и прогноз cashflow",
    ],
    [],
  );

  async function handlePayment(provider: PaymentProvider) {
    setError(null);
    setStatus(null);
    setLoadingProvider(provider);

    try {
      const response = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: MONTHLY_PRICE,
          provider,
          customerEmail: user.email,
          description: "Подписка на Автопилот",
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        setError(errorBody.message ?? "Не удалось создать оплату");
        setLoadingProvider(null);
        return;
      }

      const data = await response.json() as { paymentUrl?: string };
      if (!data.paymentUrl) {
        setError("Провайдер оплаты не вернул ссылку");
        setLoadingProvider(null);
        return;
      }

      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка оплаты");
      setLoadingProvider(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      <DashboardHeader
        title="Подписка"
        description="Оплата доступа через Сбер или Тинькофф"
        periodLabel="Подписка"
        timeframe="ALL"
        onTimeframeChange={() => {}}
        onNavigate={() => {}}
        canNavigateForward
      />

      <div className={styles.page}>
        {(status || error) && (
          <div className={`${styles.status} ${status ? styles.success : styles.error}`}>
            {status ?? error}
          </div>
        )}

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardBadge}>Месяц</span>
              <h3 className={styles.cardTitle}>Автопилот PRO</h3>
            </div>
            <p className={styles.cardDescription}>
              Включает импорт выписок, портфель, задачи, cashflow и квесты.
              Выберите удобный банк для оплаты подписки.
            </p>
            <div className={styles.priceRow}>
              <div className={styles.price}>{MONTHLY_PRICE.toLocaleString("ru-RU")}</div>
              <div className={styles.pricePeriod}>₽ в месяц</div>
            </div>
            <ul className={styles.list}>
              {planDescription.map((item) => (
                <li key={item} className={styles.listItem}>
                  {item}
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => handlePayment("sberpay")}
                disabled={loadingProvider !== null}
              >
                {loadingProvider === "sberpay" ? "Создаём счёт..." : "Оплатить через Сбер"}
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={() => handlePayment("tinkoff")}
                disabled={loadingProvider !== null}
              >
                {loadingProvider === "tinkoff" ? "Готовим ссылку..." : "Оплатить через Тинькофф"}
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardBadge}>Поддержка</span>
              <h3 className={styles.cardTitle}>Подключение платежей</h3>
            </div>
            <p className={styles.cardDescription}>
              Для работы в проде укажите ключи провайдера в переменных окружения
              (TINKOFF_TERMINAL_KEY, TINKOFF_SECRET_KEY, SBER_USERNAME, SBER_PASSWORD).
            </p>
            <div className={styles.helper}>
              Ссылки формируются прямо в API. Мы вернёмся на дашборд после успешной оплаты.
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<SubscriptionPageProps> = async (context) => {
  const user = await getAuthenticatedUser(context.req);

  if (!user) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return {
    props: { user },
  };
};
