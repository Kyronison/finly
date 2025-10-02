import { ReactNode } from 'react';
import Link from 'next/link';

import styles from './DashboardLayout.module.css';

interface Props {
  user: {
    name: string;
    email: string;
  };
  onLogout: () => void;
  children: ReactNode;
}

export function DashboardLayout({ user, onLogout, children }: Props) {
  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>Автопилот</div>
        <nav className={styles.nav}>
          <Link href="/dashboard" className={styles.navItem}>
            Отчёт
          </Link>
          <Link href="/portfolio" className={styles.navItem}>
            Инвестиции
          </Link>
        </nav>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{user.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userEmail}>{user.email}</div>
          </div>
        </div>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Выйти
        </button>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
