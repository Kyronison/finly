import { timeframeOptions, Timeframe } from '@/hooks/useDashboardData';
import styles from '@/styles/Dashboard.module.css';

interface DashboardHeaderProps {
  title: string;
  description?: string;
  periodLabel: string;
  timeframe: Timeframe;
  onTimeframeChange: (value: Timeframe) => void;
  onNavigate: (direction: 'backward' | 'forward') => void;
  canNavigateForward: boolean;
}

export function DashboardHeader({
  title,
  description,
  periodLabel,
  timeframe,
  onTimeframeChange,
  onNavigate,
  canNavigateForward,
}: DashboardHeaderProps) {
  const showNavigator = timeframe !== 'ALL';

  return (
    <div className={styles.headerRow}>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        <p>Период: {periodLabel}</p>
      </div>
      <div className={styles.timeframeControls}>
        <div className={styles.timeframeGroup}>
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === timeframe
                  ? `${styles.timeframeButton} ${styles.timeframeButtonActive}`
                  : styles.timeframeButton
              }
              onClick={() => onTimeframeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {showNavigator ? (
          <div className={styles.navigator}>
            <button
              type="button"
              className={styles.navigatorButton}
              onClick={() => onNavigate('backward')}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.navigatorButton}
              onClick={() => onNavigate('forward')}
              disabled={!canNavigateForward}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
