import { ReactNode } from 'react';
import clsx from 'clsx';

import styles from './MetricCard.module.css';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  accent?: 'green' | 'orange' | 'violet';
  icon?: ReactNode;
}

export function MetricCard({ title, value, subtitle, accent = 'violet', icon }: Props) {
  return (
    <div className={clsx(styles.card, styles[accent])}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
