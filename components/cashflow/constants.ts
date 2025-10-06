import { Profession } from './types';

const createExpense = (label: string, amount: number, id: string) => ({ id, label, amount });

export const professions: Profession[] = [
  {
    id: 'developer',
    name: 'Продуктовый аналитик',
    salary: 185_000,
    description:
      'Работает в крупной технологической компании, получает опционы и заботится о карьерном росте. Ищет баланс между комфортом и инвестициями.',
    startingCash: 160_000,
    goalNetWorth: 900_000,
    goalPassiveIncome: 95_000,
    expenses: [
      createExpense('Ипотека', 48_000, 'mortgage'),
      createExpense('Кредит за авто', 14_500, 'car-loan'),
      createExpense('Еда и бытовые расходы', 28_000, 'living'),
      createExpense('Образование и саморазвитие', 10_000, 'education'),
      createExpense('Развлечения и путешествия', 12_000, 'lifestyle'),
      createExpense('Налоги и страхование', 9_500, 'insurance'),
    ],
  },
  {
    id: 'teacher',
    name: 'Преподаватель экономики',
    salary: 95_000,
    description:
      'Ведёт курсы по финансовой грамотности и подрабатывает репетитором. Цель — накопить капитал для открытия онлайн-школы.',
    startingCash: 70_000,
    goalNetWorth: 600_000,
    goalPassiveIncome: 55_000,
    expenses: [
      createExpense('Аренда квартиры', 32_000, 'rent'),
      createExpense('Транспорт и связь', 8_500, 'transport'),
      createExpense('Продукты и быт', 22_000, 'groceries'),
      createExpense('Кредиты', 6_000, 'loans'),
      createExpense('Развлечения', 6_500, 'fun'),
      createExpense('Дети и образование', 11_000, 'kids'),
    ],
  },
  {
    id: 'doctor',
    name: 'Врач-реаниматолог',
    salary: 140_000,
    description:
      'Чередует смены в частной и государственной клиниках, поэтому доход нестабилен. Хочет создать подушку безопасности и вложиться в недвижимость.',
    startingCash: 110_000,
    goalNetWorth: 750_000,
    goalPassiveIncome: 70_000,
    expenses: [
      createExpense('Ипотека', 38_000, 'mortgage'),
      createExpense('Обслуживание кредита на обучение', 9_500, 'student-loan'),
      createExpense('Расходы на семью', 24_000, 'family'),
      createExpense('Транспорт', 7_500, 'transport'),
      createExpense('Продукты и досуг', 21_000, 'groceries'),
      createExpense('Страхование', 8_000, 'insurance'),
    ],
  },
  {
    id: 'designer',
    name: 'Фриланс-дизайнер',
    salary: 120_000,
    description:
      'Занимается digital-продуктами и берёт проекты на зарубежных заказчиков. Основной вызов — колебания дохода и высокий налог на самозанятость.',
    startingCash: 95_000,
    goalNetWorth: 680_000,
    goalPassiveIncome: 60_000,
    expenses: [
      createExpense('Аренда студии и жилья', 45_000, 'rent'),
      createExpense('Налоги и взносы', 18_000, 'taxes'),
      createExpense('Техника и подписки', 12_500, 'gear'),
      createExpense('Продукты', 19_000, 'food'),
      createExpense('Путешествия и вдохновение', 15_000, 'travel'),
      createExpense('Образование', 6_500, 'education'),
    ],
  },
];
