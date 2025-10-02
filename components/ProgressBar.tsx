import styles from './ProgressBar.module.css';

interface Props {
  value: number;
  color?: string;
}

export function ProgressBar({ value, color }: Props) {
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <div className={styles.track}>
      <div className={styles.fill} style={{ width: `${safeValue * 100}%`, background: color }} />
    </div>
  );
}
