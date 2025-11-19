import { useEffect } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";

import { AuthForm } from "@/components/AuthForm";
import styles from "@/styles/Home.module.css";

export default function Home() {
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR("/api/auth/session");

  useEffect(() => {
    if (data?.user) {
      router.replace("/dashboard");
    }
  }, [data, router]);

  return (
    <div className={styles.hero}>
      <div className={styles.left}>
        <span className={styles.badge}>10 минут в месяц</span>
        <h1>Автопилот финансов и инвестиций</h1>
        <p>
          Импорт выписок, мультипортфель, прогнозы кеш-флоу и игровые челленджи.
          Без рутины и «серой зоны» советов. Не является индивидуальной
          инвестиционной рекомендацией.
        </p>
        <ul className={styles.list}>
          <li>Импорт PDF/API и авто-классификация доходов и расходов</li>
          <li>Целевые аллокации и подсказки при отклонениях</li>
          <li>Игровые квесты, рейтинги и streak за финансовые действия</li>
        </ul>
      </div>
      <div className={styles.right}>
        {!isLoading && !data?.user && <AuthForm onSuccess={() => mutate()} />}
      </div>
    </div>
  );
}
