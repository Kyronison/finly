import Image from 'next/image';
import { useState } from 'react';

import styles from './PortfolioPositions.module.css';

interface PositionRow {
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
}

interface Props {
  positions: PositionRow[];
}

const fallbackLogos: Record<string, { url: string; companyName: string }> = {
  ROSN: {
    url: 'https://beststocks.ru/api/file/stock/logos/RU:ROSN.png',
    companyName: 'Роснефть',
  },
  RNFT: {
    url: 'https://beststocks.ru/api/file/stock/logos/RU:RNFT.png',
    companyName: 'Сургутнефтегаз',
  },
  TATN: {
    url: 'https://beststocks.ru/api/file/stock/logos/RU:TATN.png',
    companyName: 'Татнефть',
  },
  GAZP: {
    url: 'https://beststocks.ru/api/file/stock/logos/RU:GAZP.png',
    companyName: 'Газпром',
  },
  SBER: {
    url: 'https://beststocks.ru/api/file/stock/logos/RU:SBER.png',
    companyName: 'Сбер',
  },
  LKOH: {
    url: 'https://beststocks.ru/api/file/stock/logos/RU:LKOH.png',
    companyName: 'Лукойл',
  },
};

const instrumentTypeLabels: Record<string, string> = {
  share: 'Акция',
  bond: 'Облигация',
  currency: 'Валюта',
  etf: 'Фонд',
  future: 'Фьючерс',
  option: 'Опцион',
};

function getInstrumentTypeLabel(type: string | null) {
  if (!type) return '—';
  const normalized = type.toLowerCase();
  return instrumentTypeLabels[normalized] ?? type;
}

function getInstrumentLogo(position: PositionRow) {
  const logoName = position.brandLogoName?.trim();
  if (logoName) {
    const baseName = logoName.replace(/\.png$/i, '');
    if (baseName) {
      return {
        url: `https://invest-brands.cdn-tinkoff.ru/${baseName}x160.png`,
        label: position.name ?? position.ticker ?? position.figi,
      };
    }
  }

  const ticker = position.ticker?.trim().toUpperCase();
  if (ticker && fallbackLogos[ticker]) {
    return {
      url: fallbackLogos[ticker].url,
      label: fallbackLogos[ticker].companyName,
    };
  }

  return null;
}

function InstrumentLogo({ position }: { position: PositionRow }) {
  const [showImage, setShowImage] = useState(true);
  const logo = getInstrumentLogo(position);
  const instrumentName = logo?.label ?? position.name ?? position.ticker ?? position.figi;
  const logoUrl = logo?.url;

  const fallbackLetters = (instrumentName ?? '—')
    .replace(/[^A-Za-zА-Яа-я0-9]/g, '')
    .slice(0, 2)
    .toUpperCase()
    || '—';

  if (!logoUrl || !showImage) {
    return (
      <div
        className={styles.instrumentLogo}
        role="img"
        aria-label={instrumentName ?? 'Инструмент портфеля'}
      >
        {fallbackLetters}
      </div>
    );
  }

  return (
    <div className={styles.instrumentLogo}>
      <Image
        src={logoUrl}
        alt={instrumentName ?? 'Инструмент портфеля'}
        width={40}
        height={40}
        onError={() => setShowImage(false)}
      />
    </div>
  );
}

export function PortfolioPositions({ positions }: Props) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Позиции портфеля</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Инструмент</th>
              <th>Кол-во</th>
              <th>Средняя цена</th>
              <th>Инвестировано</th>
              <th>Текущая стоимость</th>
              <th>Доходность</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const yieldValue = (position.currentValue ?? 0) - (position.investedAmount ?? 0);
              const yieldPercent = position.expectedYieldPercent ?? (position.investedAmount
                ? (yieldValue / position.investedAmount) * 100
                : 0);
              const isPositive = yieldValue >= 0;
              const instrumentLabel = getInstrumentTypeLabel(position.instrumentType);
              return (
                <tr key={position.id}>
                  <td>
                    <div className={styles.instrumentCell}>
                      <InstrumentLogo position={position} />
                      <div>
                        <div>{position.ticker ?? position.figi}</div>
                        <div className={styles.badge}>{instrumentLabel}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {position.balance.toLocaleString('ru-RU')} лотов
                    {position.lot ? ` · ${position.lot} шт.` : ''}
                  </td>
                  <td>
                    {position.averagePrice != null
                      ? `${position.averagePrice.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${position.currency ?? ''}`
                      : '—'}
                  </td>
                  <td>
                    {`${position.investedAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${
                      position.currency ?? ''
                    }`}
                  </td>
                  <td>
                    {`${position.currentValue.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${
                      position.currency ?? ''
                    }`}
                  </td>
                  <td className={isPositive ? styles.yieldPositive : styles.yieldNegative}>
                    {`${yieldValue.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${position.currency ?? ''}`} ·
                    {` ${yieldPercent.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
