import styles from './StreakCard.module.css';

interface Props {
  streak: number;
}

export function StreakCard({ streak }: Props) {
  return (
    <div className={styles.card}>
      <h3>Игровой прогресс</h3>
      <p>
        Вы отмечали финансовые действия {streak} {decline(streak, ['день подряд', 'дня подряд', 'дней подряд'])}. Продолжайте streak,
        чтобы удерживать целевую аллокацию и получать больше очков.
      </p>
      <div className={styles.badge}>{streak}</div>
    </div>
  );
}

function decline(value: number, forms: [string, string, string]) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
