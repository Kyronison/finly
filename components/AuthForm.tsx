import { FormEvent, useState } from 'react';

import styles from './AuthForm.module.css';

type Mode = 'login' | 'register';

interface Props {
  onSuccess: () => void;
}

export function AuthForm({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message ?? 'Не удалось выполнить действие');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.toggleWrapper}>
        <button
          type="button"
          className={mode === 'login' ? styles.activeToggle : styles.toggle}
          onClick={() => setMode('login')}
        >
          Вход
        </button>
        <button
          type="button"
          className={mode === 'register' ? styles.activeToggle : styles.toggle}
          onClick={() => setMode('register')}
        >
          Регистрация
        </button>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        {mode === 'register' && (
          <label className={styles.field}>
            <span>Имя</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Как вас зовут?"
              required
            />
          </label>
        )}
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@email.ru"
            required
          />
        </label>
        <label className={styles.field}>
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Не менее 6 символов"
            minLength={6}
            required
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.submit} disabled={isLoading}>
          {isLoading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </form>
      <p className={styles.hint}>
        «Автопилот финансов» — образовательный сервис и инструмент учёта. Не является индивидуальной инвестиционной
        рекомендацией.
      </p>
    </div>
  );
}
