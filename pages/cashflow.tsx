import Head from 'next/head';

import { CashflowGame } from '@/components/cashflow/CashflowGame';

export default function CashflowPage() {
  return (
    <>
      <Head>
        <title>Cashflow тренажёр — Finly Autopilot</title>
        <meta
          name="description"
          content="Интерактивный тренажёр по финансовой грамотности на основе игры Денежный поток Роберта Кийосаки, дополненный советами ИИ-наставника."
        />
      </Head>
      <CashflowGame />
    </>
  );
}
