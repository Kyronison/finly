# Finly Autopilot

One-page веб-приложение «Автопилот финансов и инвестиций» на Next.js + Prisma + SQLite.

## Возможности

- Регистрация и вход по email/паролю с хранением пароля в хеше.
- Автоматическое создание базовых категорий и тёмный геймифицированный интерфейс.
- Учёт категорий (лимиты, цвета, типы доход/расход) с изменением и удалением.
- Учёт расходов/доходов, редактирование сумм, комментариев и категорий.
- Дашборд с графиком расходов по дням, топом категорий и streak игровых действий.
- REST API на Node.js (через API routes Next.js) и база SQLite/Prisma.

## Стек

- Next.js 14 (React 18, pages router)
- TypeScript
- Prisma ORM + SQLite
- Recharts для графиков, SWR для работы с API

## Запуск

```bash
npm install
# Настройте переменные окружения
cp .env.example .env

# Инициализируйте базу (потребуется Prisma CLI)
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

npm run dev
```

Приложение будет доступно по адресу [http://localhost:3000](http://localhost:3000).

## Переменные окружения

- `DATABASE_URL` — путь к базе SQLite (по умолчанию `file:./dev.db`).
- `JWT_SECRET` — секрет для подписи токенов (обязательно заменить в продакшене).

## Структура

- `pages/api/**` — REST API (аутентификация, категории, расходы, аналитика).
- `components/**` — UI-компоненты дашборда и форм.
- `prisma/schema.prisma` — описание базы данных.
- `styles/**` — глобальные и модульные стили.

## Линтинг

```bash
npm run lint
```

## Скриншоты

Для получения скриншотов используйте `npm run dev` и инструменты браузера.
