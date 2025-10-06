import { useEffect, useMemo, useState } from 'react';

import { ProgressBar } from '@/components/ProgressBar';

import { professions } from './constants';
import type {
  Asset,
  BusinessOpportunity,
  GameEvent,
  GameState,
  IncomeItem,
  LifeEvent,
  RealEstateOpportunity,
  StockOpportunity,
  WindfallEvent,
} from './types';
import styles from './CashflowGame.module.css';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value));

const createId = () => Math.random().toString(36).slice(2, 10);

const sumIncome = (incomes: IncomeItem[]) => incomes.reduce((total, income) => total + income.amount, 0);
const sumAssetsValue = (assets: Asset[]) => assets.reduce((total, asset) => total + asset.value, 0);
const sumLiabilities = (liabilities: GameState['liabilities']) =>
  liabilities.reduce((total, liability) => total + liability.balance, 0);
const sumExpenses = (expenses: GameState['expenses']) => expenses.reduce((total, expense) => total + expense.amount, 0);

const calculatePassiveIncome = (incomes: IncomeItem[]) =>
  incomes.filter((income) => income.type === 'PASSIVE').reduce((total, income) => total + income.amount, 0);

const calculateNetWorth = (state: GameState) => state.cash + sumAssetsValue(state.assets) - sumLiabilities(state.liabilities);

const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min);

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

type StockAction = { type: 'BUY_STOCK'; quantity: number } | { type: 'SKIP_STOCK' };
type RealEstateAction = { type: 'BUY_PROPERTY' } | { type: 'SKIP_PROPERTY' };
type BusinessAction = { type: 'BUY_BUSINESS' } | { type: 'SKIP_BUSINESS' };
type LifeAction = { type: 'ACKNOWLEDGE' };
type WindfallAction = { type: 'ACCEPT_WINDFALL' };

type GameAction = StockAction | RealEstateAction | BusinessAction | LifeAction | WindfallAction;

interface ApplyResult {
  state: GameState;
  summary: string;
}

const stockCatalog: Array<
  Omit<StockOpportunity, 'id' | 'price' | 'fairValue' | 'expectedDividend' | 'maxShares' | 'narrative'> & {
    price: [number, number];
    fairValue: [number, number];
    expectedDividend: [number, number];
    maxShares: [number, number];
    narrative: (event: StockOpportunity) => string;
  }
> = [
  {
    type: 'STOCK',
    company: 'АгроСбыт',
    sector: 'аграрный сектор',
    price: [18, 28],
    fairValue: [20, 34],
    expectedDividend: [0.6, 1.2],
    maxShares: [30, 160],
    narrative: (event) =>
      `Вы замечаете отчёт «${event.company}»: ${event.sector} ускоряется на фоне экспортных контрактов. Бумага торгуется по ${formatCurrency(
        event.price,
      )}, справедливая цена оценена в ${formatCurrency(event.fairValue)}. Компания платит дивиденды ${formatCurrency(
        event.expectedDividend,
      )} на акцию.`,
  },
  {
    type: 'STOCK',
    company: 'СеверПоток Логистикс',
    sector: 'логистика и контейнерные перевозки',
    price: [42, 68],
    fairValue: [48, 82],
    expectedDividend: [1.1, 2],
    maxShares: [20, 110],
    narrative: (event) =>
      `«${event.company}» расширяет сервис последней мили. Акции стоят ${formatCurrency(
        event.price,
      )}, аналитики считают справедливой стоимость ${formatCurrency(event.fairValue)}. Дивиденды составляют около ${formatCurrency(
        event.expectedDividend,
      )} на акцию в месяц.`,
  },
  {
    type: 'STOCK',
    company: 'НеонКод',
    sector: 'разработка корпоративного софта',
    price: [65, 110],
    fairValue: [72, 135],
    expectedDividend: [0.4, 1.4],
    maxShares: [10, 80],
    narrative: (event) =>
      `«${event.company}» выходит на рынки Ближнего Востока. Бумаги стоят ${formatCurrency(
        event.price,
      )}, справедливая цена оценивается в ${formatCurrency(event.fairValue)}. Менеджмент обещает buyback и дивиденды ${formatCurrency(
        event.expectedDividend,
      )}.`,
  },
];

const realEstateCatalog: Array<
  Omit<RealEstateOpportunity, 'id' | 'narrative'> & { narrative: (event: RealEstateOpportunity) => string }
> = [
  {
    type: 'REAL_ESTATE',
    propertyType: 'Апартаменты у набережной',
    price: 4_800_000,
    downPayment: 480_000,
    monthlyRent: 58_000,
    monthlyExpenses: 34_000,
    appreciation: 6,
    narrative: (event) =>
      `На вторичном рынке появляются ${event.propertyType.toLowerCase()} с полной отделкой. Продавец готов уступить при быстрой сделке, ожидаемый рост цен — ${event.appreciation}% в год.`,
  },
  {
    type: 'REAL_ESTATE',
    propertyType: 'Студия в коворкинге',
    price: 3_100_000,
    downPayment: 310_000,
    monthlyRent: 42_000,
    monthlyExpenses: 24_000,
    appreciation: 4,
    narrative: (event) =>
      `Развивающийся район предлагает ${event.propertyType.toLowerCase()} с действующим арендатором. Управляющая компания берёт фиксированную ставку, прогноз роста стоимости — ${event.appreciation}% в год.`,
  },
  {
    type: 'REAL_ESTATE',
    propertyType: 'Склад-кроссдокинг',
    price: 6_200_000,
    downPayment: 620_000,
    monthlyRent: 74_000,
    monthlyExpenses: 46_000,
    appreciation: 5,
    narrative: (event) =>
      `Логистический парк предлагает ${event.propertyType.toLowerCase()} вблизи нового шоссе. Подписан договор на 11 месяцев, прогноз роста аренды — ${event.appreciation}% ежегодно.`,
  },
];

const businessCatalog: Array<
  Omit<BusinessOpportunity, 'id' | 'narrative'> & { narrative: (event: BusinessOpportunity) => string }
> = [
  {
    type: 'BUSINESS',
    business: 'Франшиза кофе-поинта',
    buyInCost: 280_000,
    monthlyProfit: 22_000,
    effortLevel: 'средняя',
    narrative: (event) =>
      `Франчайзер предлагает ${event.business.toLowerCase()} в бизнес-центре. Требуется ${event.effortLevel} вовлечённость: 2-3 визита в неделю и контроль персонала.`,
  },
  {
    type: 'BUSINESS',
    business: 'Онлайн-курс по аналитике',
    buyInCost: 190_000,
    monthlyProfit: 18_000,
    effortLevel: 'низкая',
    narrative: (event) =>
      `Авторская команда ищет партнёра для продвижения. ${event.business} готов, нужно поддерживать трафик и продажи.`,
  },
  {
    type: 'BUSINESS',
    business: 'Мобильная автомойка',
    buyInCost: 350_000,
    monthlyProfit: 30_000,
    effortLevel: 'высокая',
    narrative: (event) =>
      `Партнёры предлагают долю в проекте «${event.business}». Потребуется ${event.effortLevel} вовлечённость: поиск парковок и найм сотрудников.`,
  },
];

const lifeEventsCatalog: Array<
  Omit<LifeEvent, 'id' | 'narrative'> & { narrative: (event: LifeEvent) => string }
> = [
  {
    type: 'LIFE',
    label: 'Рождение ребёнка',
    amount: 18_500,
    category: 'expense_increase',
    narrative: () => 'В семью приходит новый член, и ваш ежемесячный бюджет пополняется расходами на подгузники, одежду и кружки.',
  },
  {
    type: 'LIFE',
    label: 'Премия за проект',
    amount: 12_000,
    category: 'income_increase',
    narrative: () => 'Компания оценила ваши идеи и повышает ежемесячный оклад. Важно решить, пустить ли прибавку в потребление или в инвестиции.',
  },
  {
    type: 'LIFE',
    label: 'Закрытие кредита',
    amount: -8_000,
    category: 'expense_decrease',
    narrative: () => 'Вы закрываете один из кредитов досрочно. Бюджет освобождает часть ежемесячных платежей.',
  },
];

const windfallCatalog: Array<
  Omit<WindfallEvent, 'id' | 'narrative'> & { narrative: (event: WindfallEvent) => string }
> = [
  {
    type: 'WINDFALL',
    amount: 55_000,
    source: 'возврат налога за инвестиционный вычет',
    narrative: (event) => `На счёт поступает ${formatCurrency(event.amount)} — ${event.source}. Можно направить в подушку безопасности или инвестиции.`,
  },
  {
    type: 'WINDFALL',
    amount: 24_000,
    source: 'кэшбэк по корпоративной карте',
    narrative: (event) => `Банк начисляет ${formatCurrency(event.amount)} кэшбэка. Это шанс ускорить достижение цели или закрыть часть долга.`,
  },
  {
    type: 'WINDFALL',
    amount: 80_000,
    source: 'продажа старой машины',
    narrative: (event) => `Вы продаёте авто и получаете ${formatCurrency(event.amount)}. Решите, распределить ли сумму между долгами и инвестициями.`,
  },
];

const createStockEvent = (): StockOpportunity => {
  const template = pickRandom(stockCatalog);
  const price = Math.round(randomBetween(template.price));
  const fairValue = Math.round(randomBetween(template.fairValue));
  const expectedDividend = Math.round(randomBetween(template.expectedDividend) * 100) / 100;
  const maxShares = Math.round(randomBetween(template.maxShares));
  const event: StockOpportunity = {
    id: createId(),
    type: 'STOCK',
    company: template.company,
    sector: template.sector,
    price,
    fairValue,
    expectedDividend,
    maxShares: Math.max(maxShares, 5),
    narrative: '',
  };
  event.narrative = template.narrative(event);
  return event;
};

const createRealEstateEvent = (): RealEstateOpportunity => {
  const template = pickRandom(realEstateCatalog);
  const event: RealEstateOpportunity = {
    ...template,
    id: createId(),
    narrative: template.narrative(template),
  };
  return event;
};

const createBusinessEvent = (): BusinessOpportunity => {
  const template = pickRandom(businessCatalog);
  const event: BusinessOpportunity = {
    ...template,
    id: createId(),
    narrative: template.narrative(template),
  };
  return event;
};

const createLifeEvent = (): LifeEvent => {
  const template = pickRandom(lifeEventsCatalog);
  const event: LifeEvent = {
    ...template,
    id: createId(),
    narrative: template.narrative(template),
  };
  return event;
};

const createWindfallEvent = (): WindfallEvent => {
  const template = pickRandom(windfallCatalog);
  const event: WindfallEvent = {
    ...template,
    id: createId(),
    narrative: template.narrative(template),
  };
  return event;
};

const generateEvent = (state: GameState): GameEvent => {
  const roll = Math.random();
  const passiveShare = calculatePassiveIncome(state.incomes) / Math.max(sumIncome(state.incomes), 1);

  if (roll < 0.28) {
    return createStockEvent();
  }

  if (roll < 0.52) {
    return createRealEstateEvent();
  }

  if (roll < 0.72) {
    return createBusinessEvent();
  }

  if (roll < 0.9) {
    // Если пассивный доход уже высокий, чаще предлагаем жизненные изменения
    if (passiveShare > 0.35 && Math.random() < 0.5) {
      return createLifeEvent();
    }
    return createWindfallEvent();
  }

  return createLifeEvent();
};

const getAdvisorSuggestion = (state: GameState, event: GameEvent) => {
  const totalIncome = sumIncome(state.incomes);
  const totalExpenses = sumExpenses(state.expenses);
  const cashFlow = totalIncome - totalExpenses;
  const passiveIncome = calculatePassiveIncome(state.incomes);
  const reserveMonths = totalExpenses > 0 ? state.cash / totalExpenses : Infinity;
  const netWorth = calculateNetWorth(state);

  switch (event.type) {
    case 'STOCK': {
      const discount = ((event.fairValue - event.price) / event.fairValue) * 100;
      if (reserveMonths < 2) {
        return `Запас прочности ${reserveMonths.toFixed(1)} мес. Перед покупкой акций стоит усилить подушку безопасности.`;
      }
      if (discount > 8) {
        return `Акция торгуется со скидкой ${discount.toFixed(1)}%. Можно купить часть, но оставьте кеш на новые идеи.`;
      }
      if (cashFlow < 0) {
        return 'Текущий денежный поток отрицательный. Имеет смысл сначала стабилизировать бюджет.';
      }
      return 'Инвестируйте аккуратно: разделите покупку на несколько месяцев и отслеживайте отчётность компании.';
    }
    case 'REAL_ESTATE': {
      if (state.cash < event.downPayment) {
        return 'Нужно накопить первоначальный взнос — подумайте о временной цели накопления.';
      }
      const netCashflow = event.monthlyRent - event.monthlyExpenses;
      if (netCashflow > 0 && reserveMonths >= 3) {
        return `Арендный поток ${formatCurrency(netCashflow)} в месяц увеличит пассивный доход до ${formatCurrency(
          passiveIncome + netCashflow,
        )}. Проверьте, готовы ли к управлению.`;
      }
      return 'Сделка на грани безубыточности. Взвесьте, готовы ли к рискам простоя и дополнительным расходам.';
    }
    case 'BUSINESS': {
      if (state.cash < event.buyInCost) {
        return 'Для входа не хватает капитала — оцените возможность привлечь партнёра или подождать лучшую сделку.';
      }
      if (event.effortLevel === 'высокая') {
        return 'Потребуется серьёзная вовлечённость. Подумайте, есть ли свободное время без ущерба основной работе.';
      }
      if (reserveMonths >= 3 && cashFlow > 0) {
        return `Потенциальный поток ${formatCurrency(event.monthlyProfit)}. Зафиксируйте KPI и автоматизируйте операционные задачи.`;
      }
      return 'Вложение выглядит интересно, но убедитесь, что текущий денежный поток выдержит просадку в первые месяцы.';
    }
    case 'LIFE': {
      if (event.category === 'expense_increase') {
        return 'Новый расход. Проверьте страховку, автоматизируйте накопления и пересоберите бюджет.';
      }
      if (event.category === 'income_increase') {
        return 'Направьте прибавку на ускорение целей: пополните резерв или увеличьте долю инвестиций.';
      }
      return 'Освободившийся расход можно направить на досрочное погашение других долгов или инвестиции.';
    }
    case 'WINDFALL': {
      if (cashFlow < 0) {
        return 'Используйте внезапный доход, чтобы закрыть дефицит бюджета и нарастить подушку.';
      }
      if (netWorth < state.profession.goalNetWorth / 2) {
        return 'Распределите сумму: часть в резерв, часть в инвестиции с умеренным риском.';
      }
      return 'Можно направить большую долю в инвестпортфель, но оставьте немного на гибкость и удовольствие.';
    }
    default:
      return '';
  }
};

const applyStockAction = (state: GameState, event: StockOpportunity, action: StockAction): ApplyResult => {
  if (action.type === 'SKIP_STOCK') {
    return { state, summary: `Вы пропустили возможность с акцией «${event.company}».` };
  }

  const cost = event.price * action.quantity;
  const dividendIncome = event.expectedDividend * action.quantity;

  if (action.quantity <= 0 || cost > state.cash) {
    return { state, summary: 'Сделка не состоялась: недостаточно средств.' };
  }

  const assetId = createId();
  const incomeId = createId();

  const updatedState: GameState = {
    ...state,
    cash: state.cash - cost,
    assets: [
      ...state.assets,
      {
        id: assetId,
        name: `${event.company}`,
        type: 'STOCK',
        value: cost,
        cashflow: dividendIncome,
        details: `${action.quantity} шт. по ${formatCurrency(event.price)}`,
        incomeId,
      },
    ],
    incomes: [
      ...state.incomes,
      {
        id: incomeId,
        label: `Дивиденды ${event.company}`,
        amount: dividendIncome,
        type: 'PASSIVE',
      },
    ],
  };

  const summary = `Куплено ${action.quantity} шт. «${event.company}» за ${formatCurrency(cost)}. Ожидаемый пассивный доход ${formatCurrency(
    dividendIncome,
  )} в месяц.`;

  return { state: updatedState, summary };
};

const applyRealEstateAction = (
  state: GameState,
  event: RealEstateOpportunity,
  action: RealEstateAction,
): ApplyResult => {
  if (action.type === 'SKIP_PROPERTY') {
    return { state, summary: `Вы пропустили объект «${event.propertyType}».` };
  }

  if (state.cash < event.downPayment) {
    return { state, summary: 'Недостаточно средств для первоначального взноса.' };
  }

  const assetId = createId();
  const incomeId = createId();
  const expenseId = createId();
  const liabilityId = createId();

  const updatedState: GameState = {
    ...state,
    cash: state.cash - event.downPayment,
    assets: [
      ...state.assets,
      {
        id: assetId,
        name: event.propertyType,
        type: 'REAL_ESTATE',
        value: event.price,
        cashflow: event.monthlyRent - event.monthlyExpenses,
        details: `Взнос ${formatCurrency(event.downPayment)}, аренда ${formatCurrency(event.monthlyRent)}`,
        incomeId,
      },
    ],
    incomes: [
      ...state.incomes,
      {
        id: incomeId,
        label: `Аренда: ${event.propertyType}`,
        amount: event.monthlyRent,
        type: 'PASSIVE',
      },
    ],
    expenses: [
      ...state.expenses,
      {
        id: expenseId,
        label: `Обслуживание: ${event.propertyType}`,
        amount: event.monthlyExpenses,
      },
    ],
    liabilities: [
      ...state.liabilities,
      {
        id: liabilityId,
        name: `Ипотека: ${event.propertyType}`,
        balance: Math.max(event.price - event.downPayment, 0),
        payment: event.monthlyExpenses,
      },
    ],
  };

  const netCashflow = event.monthlyRent - event.monthlyExpenses;
  const summary = `Вы вложились в ${event.propertyType}. Чистый поток ${formatCurrency(netCashflow)} в месяц после обслуживания.`;

  return { state: updatedState, summary };
};

const applyBusinessAction = (state: GameState, event: BusinessOpportunity, action: BusinessAction): ApplyResult => {
  if (action.type === 'SKIP_BUSINESS') {
    return { state, summary: `Вы решили не входить в «${event.business}».` };
  }

  if (state.cash < event.buyInCost) {
    return { state, summary: 'Для покупки доли не хватает средств.' };
  }

  const assetId = createId();
  const incomeId = createId();

  const updatedState: GameState = {
    ...state,
    cash: state.cash - event.buyInCost,
    assets: [
      ...state.assets,
      {
        id: assetId,
        name: event.business,
        type: 'BUSINESS',
        value: event.buyInCost,
        cashflow: event.monthlyProfit,
        details: `Доля с ${event.effortLevel} вовлечённостью`,
        incomeId,
      },
    ],
    incomes: [
      ...state.incomes,
      {
        id: incomeId,
        label: `Поток: ${event.business}`,
        amount: event.monthlyProfit,
        type: 'PASSIVE',
      },
    ],
  };

  const summary = `Вы инвестировали в ${event.business} за ${formatCurrency(event.buyInCost)}. Поток ${formatCurrency(
    event.monthlyProfit,
  )} в месяц.`;

  return { state: updatedState, summary };
};

const applyLifeAction = (state: GameState, event: LifeEvent): ApplyResult => {
  if (event.category === 'income_increase') {
    const incomeId = createId();
    const updatedState: GameState = {
      ...state,
      incomes: [
        ...state.incomes,
        {
          id: incomeId,
          label: event.label,
          amount: event.amount,
          type: 'ACTIVE',
        },
      ],
    };
    return { state: updatedState, summary: `Доход увеличился: ${event.label} на ${formatCurrency(event.amount)}.` };
  }

  const expenseId = createId();
  const updatedState: GameState = {
    ...state,
    expenses: [
      ...state.expenses,
      {
        id: expenseId,
        label: event.label,
        amount: event.amount,
      },
    ],
  };

  const change = event.amount >= 0 ? 'увеличились' : 'сократились';
  return { state: updatedState, summary: `Расходы ${change} на ${formatCurrency(Math.abs(event.amount))}.` };
};

const applyWindfallAction = (state: GameState, event: WindfallEvent): ApplyResult => {
  const updatedState: GameState = {
    ...state,
    cash: state.cash + event.amount,
  };
  return { state: updatedState, summary: `Получен внезапный доход ${formatCurrency(event.amount)} (${event.source}).` };
};

const applyEventAction = (state: GameState, event: GameEvent, action: GameAction): ApplyResult => {
  switch (event.type) {
    case 'STOCK':
      return applyStockAction(state, event, action as StockAction);
    case 'REAL_ESTATE':
      return applyRealEstateAction(state, event, action as RealEstateAction);
    case 'BUSINESS':
      return applyBusinessAction(state, event, action as BusinessAction);
    case 'LIFE':
      return applyLifeAction(state, event);
    case 'WINDFALL':
      return applyWindfallAction(state, event);
    default:
      return { state, summary: '' };
  }
};

const advanceMonth = (state: GameState, summary: string): GameState => {
  const totalIncome = sumIncome(state.incomes);
  const totalExpenses = sumExpenses(state.expenses);
  const cashFlow = totalIncome - totalExpenses;
  const nextCash = state.cash + cashFlow;
  const nextState: GameState = {
    ...state,
    cash: nextCash,
    month: state.month + 1,
    log: [
      {
        id: createId(),
        month: state.month,
        message: `${summary} Денежный поток месяца: ${formatCurrency(cashFlow)}. Баланс ${formatCurrency(
          nextCash,
        )}. Капитал ${formatCurrency(calculateNetWorth({ ...state, cash: nextCash }))}.`,
      },
      ...state.log,
    ].slice(0, 12),
  };
  return nextState;
};

const createInitialState = (professionId: string): GameState => {
  const profession = professions.find((item) => item.id === professionId) ?? professions[0];
  const incomeId = createId();
  return {
    profession,
    month: 1,
    cash: profession.startingCash,
    incomes: [
      {
        id: incomeId,
        label: 'Зарплата',
        amount: profession.salary,
        type: 'ACTIVE',
      },
    ],
    expenses: profession.expenses.map((expense) => ({ ...expense })),
    assets: [],
    liabilities: [],
    log: [
      {
        id: createId(),
        month: 0,
        message: `Вы выбрали профессию «${profession.name}». Стартовый капитал ${formatCurrency(
          profession.startingCash,
        )}. Цель — капитал ${formatCurrency(profession.goalNetWorth)} и пассивный доход ${formatCurrency(
          profession.goalPassiveIncome,
        )}.`,
      },
    ],
  };
};

export function CashflowGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [advisorMessage, setAdvisorMessage] = useState('');
  const [stockQuantity, setStockQuantity] = useState(0);

  useEffect(() => {
    setStockQuantity(0);
  }, [currentEvent?.id]);

  const handleStart = (professionId: string) => {
    const initialState = createInitialState(professionId);
    const event = generateEvent(initialState);
    setGameState(initialState);
    setCurrentEvent(event);
    setAdvisorMessage(getAdvisorSuggestion(initialState, event));
  };

  const handleAction = (action: GameAction) => {
    if (!gameState || !currentEvent) return;

    const { state: afterEvent, summary } = applyEventAction(gameState, currentEvent, action);
    const advancedState = advanceMonth(afterEvent, summary);
    const nextEvent = generateEvent(advancedState);

    setGameState(advancedState);
    setCurrentEvent(nextEvent);
    setAdvisorMessage(getAdvisorSuggestion(advancedState, nextEvent));
  };

  const derived = useMemo(() => {
    if (!gameState) {
      return null;
    }

    const totalIncome = sumIncome(gameState.incomes);
    const totalExpenses = sumExpenses(gameState.expenses);
    const passiveIncome = calculatePassiveIncome(gameState.incomes);
    const cashFlow = totalIncome - totalExpenses;
    const netWorth = calculateNetWorth(gameState);
    const reserveMonths = totalExpenses > 0 ? gameState.cash / totalExpenses : Infinity;

    return {
      totalIncome,
      totalExpenses,
      passiveIncome,
      cashFlow,
      netWorth,
      reserveMonths,
      incomeList: gameState.incomes,
      expenseList: gameState.expenses,
      assets: gameState.assets,
      liabilities: gameState.liabilities,
    };
  }, [gameState]);

  if (!gameState || !currentEvent || !derived) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Cashflow тренажёр с ИИ-наставником</h1>
          <p className={styles.subtitle}>
            Выберите профессию и проживите 5–7 лет финансовых решений в ускоренном темпе. Каждый месяц вас ждут рыночные
            события, жизненные повороты и советы виртуального наставника.
          </p>
        </div>
        <div className={styles.selectorGrid}>
          {professions.map((profession) => (
            <button
              type="button"
              key={profession.id}
              className={styles.professionCard}
              onClick={() => handleStart(profession.id)}
            >
              <div>
                <div className={styles.professionName}>{profession.name}</div>
                <p className={styles.professionMeta}>{profession.description}</p>
              </div>
              <div className={styles.professionMeta}>
                <span className={styles.tag}>Зарплата {formatCurrency(profession.salary)}</span>
                <span className={styles.tag}>Капитал {formatCurrency(profession.goalNetWorth)}</span>
                <span className={styles.tag}>Пассивный поток {formatCurrency(profession.goalPassiveIncome)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const { totalIncome, totalExpenses, passiveIncome, cashFlow, netWorth, reserveMonths } = derived;
  const goalNetWorth = gameState.profession.goalNetWorth;
  const goalPassiveIncome = gameState.profession.goalPassiveIncome;
  const netWorthProgress = Math.min(netWorth / goalNetWorth, 1);
  const passiveProgress = Math.min(passiveIncome / goalPassiveIncome, 1);

  const renderEventControls = () => {
    switch (currentEvent.type) {
      case 'STOCK': {
        const maxAffordableShares = Math.min(
          currentEvent.maxShares,
          Math.floor(gameState.cash / currentEvent.price),
        );
        const safeQuantity = Math.min(stockQuantity, maxAffordableShares);
        const totalCost = currentEvent.price * safeQuantity;
        const expectedIncome = currentEvent.expectedDividend * safeQuantity;
        const discount = ((currentEvent.fairValue - currentEvent.price) / currentEvent.fairValue) * 100;
        return (
          <>
            <div className={styles.eventStats}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Цена</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.price)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Справедливая</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.fairValue)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Дивиденды/акция</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.expectedDividend)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Дисконт</span>
                <span className={styles.statValue}>{`${discount.toFixed(1)}%`}</span>
              </div>
            </div>
            <div className={styles.controls}>
              <input
                type="range"
                min={0}
                max={Math.max(maxAffordableShares, 0)}
                value={safeQuantity}
                step={1}
                onChange={(event) => setStockQuantity(Math.max(0, Math.floor(Number(event.target.value))))}
                className={styles.rangeInput}
              />
              <input
                type="number"
                min={0}
                max={Math.max(maxAffordableShares, 0)}
                step={1}
                value={safeQuantity}
                onChange={(event) => setStockQuantity(Math.max(0, Math.floor(Number(event.target.value))))}
                className={styles.numberInput}
              />
              <button
                type="button"
                className={styles.primaryButton}
                disabled={safeQuantity <= 0 || totalCost > gameState.cash}
                onClick={() => handleAction({ type: 'BUY_STOCK', quantity: safeQuantity })}
              >
                Купить на {formatCurrency(totalCost)}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleAction({ type: 'SKIP_STOCK' })}
              >
                Пропустить
              </button>
            </div>
            <div className={styles.balanceSummary}>
              <div className={styles.balanceRow}>
                <span>Ожидаемый поток</span>
                <strong>{formatCurrency(expectedIncome)}</strong>
              </div>
              <div className={styles.balanceRow}>
                <span>Доступно средств</span>
                <strong>{formatCurrency(gameState.cash - totalCost)}</strong>
              </div>
            </div>
          </>
        );
      }
      case 'REAL_ESTATE': {
        const netCashflow = currentEvent.monthlyRent - currentEvent.monthlyExpenses;
        const canAfford = gameState.cash >= currentEvent.downPayment;
        return (
          <>
            <div className={styles.eventStats}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Стоимость</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.price)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Первоначальный взнос</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.downPayment)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Аренда</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.monthlyRent)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Платежи</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.monthlyExpenses)}</span>
              </div>
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!canAfford}
                onClick={() => handleAction({ type: 'BUY_PROPERTY' })}
              >
                Купить объект
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleAction({ type: 'SKIP_PROPERTY' })}
              >
                Пропустить
              </button>
            </div>
            <div className={styles.balanceSummary}>
              <div className={styles.balanceRow}>
                <span>Чистый поток</span>
                <strong>{formatCurrency(netCashflow)}</strong>
              </div>
              <div className={styles.balanceRow}>
                <span>Останется наличных</span>
                <strong>{formatCurrency(gameState.cash - currentEvent.downPayment)}</strong>
              </div>
            </div>
          </>
        );
      }
      case 'BUSINESS': {
        return (
          <>
            <div className={styles.eventStats}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Стоимость входа</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.buyInCost)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Потенциал</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.monthlyProfit)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Вовлечённость</span>
                <span className={styles.statValue}>{currentEvent.effortLevel}</span>
              </div>
            </div>
            <div className={styles.controls}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={gameState.cash < currentEvent.buyInCost}
                onClick={() => handleAction({ type: 'BUY_BUSINESS' })}
              >
                Инвестировать
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleAction({ type: 'SKIP_BUSINESS' })}
              >
                Пропустить
              </button>
            </div>
          </>
        );
      }
      case 'LIFE': {
        return (
          <>
            <div className={styles.eventStats}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Изменение</span>
                <span className={styles.statValue}>
                  {currentEvent.amount >= 0 ? '+' : ''}
                  {formatCurrency(currentEvent.amount)}
                </span>
              </div>
            </div>
            <div className={styles.controls}>
              <button type="button" className={styles.primaryButton} onClick={() => handleAction({ type: 'ACKNOWLEDGE' })}>
                Продолжить
              </button>
            </div>
          </>
        );
      }
      case 'WINDFALL': {
        return (
          <>
            <div className={styles.eventStats}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Сумма</span>
                <span className={styles.statValue}>{formatCurrency(currentEvent.amount)}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Источник</span>
                <span className={styles.statValue}>{currentEvent.source}</span>
              </div>
            </div>
            <div className={styles.controls}>
              <button type="button" className={styles.primaryButton} onClick={() => handleAction({ type: 'ACCEPT_WINDFALL' })}>
                Принять
              </button>
            </div>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.boardLayout}>
        <div className={`${styles.column} ${styles.leftColumn}`}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Доходы</h2>
            <ul className={styles.list}>
              {derived.incomeList.map((income) => (
                <li key={income.id} className={styles.listItem}>
                  <span className={styles.listItemLabel}>
                    {income.label}
                    {income.type === 'PASSIVE' && <span className={styles.passivePill}>пассивно</span>}
                  </span>
                  <strong>{formatCurrency(income.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Расходы</h2>
            <ul className={styles.list}>
              {derived.expenseList.map((expense) => (
                <li key={expense.id} className={styles.listItem}>
                  <span>{expense.label}</span>
                  <strong className={expense.amount < 0 ? styles.negative : undefined}>
                    {formatCurrency(expense.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          {derived.assets.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Активы</h2>
              <ul className={styles.list}>
                {derived.assets.map((asset) => (
                  <li key={asset.id} className={styles.listItem}>
                    <span>
                      {asset.name}
                      <span className={styles.itemDetails}>{asset.details}</span>
                    </span>
                    <strong>{formatCurrency(asset.value)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {derived.liabilities.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Пассивы</h2>
              <ul className={styles.list}>
                {derived.liabilities.map((liability) => (
                  <li key={liability.id} className={styles.listItem}>
                    <span>
                      {liability.name}
                      <span className={styles.itemDetails}>Остаток {formatCurrency(liability.balance)}</span>
                    </span>
                    <strong>{formatCurrency(liability.payment)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className={`${styles.column} ${styles.centerColumn}`}>
          <div className={styles.eventCard}>
            <div className={styles.eventHeader}>
              <span className={styles.tag}>Месяц {gameState.month}</span>
              <h2 className={styles.eventTitle}>
                {currentEvent.type === 'STOCK' && `Фондовый рынок: ${currentEvent.company}`}
                {currentEvent.type === 'REAL_ESTATE' && `Недвижимость: ${currentEvent.propertyType}`}
                {currentEvent.type === 'BUSINESS' && `Бизнес: ${currentEvent.business}`}
                {currentEvent.type === 'LIFE' && currentEvent.label}
                {currentEvent.type === 'WINDFALL' && 'Внезапный доход'}
              </h2>
              <p className={styles.eventNarrative}>{currentEvent.narrative}</p>
            </div>
            {renderEventControls()}
          </div>
          <div className={styles.advisor}>
            <span className={styles.advisorLabel}>Совет ИИ-наставника</span>
            <p className={styles.advisorMessage}>{advisorMessage}</p>
          </div>
        </div>
        <div className={`${styles.column} ${styles.rightColumn}`}>
          <div className={`${styles.section} ${styles.progressCard}`}>
            <h2 className={styles.sectionTitle}>Прогресс</h2>
            <div className={styles.progressRow}>
              <div className={styles.progressHeader}>
                <span>Капитал {formatCurrency(netWorth)}</span>
                <span>Цель {formatCurrency(goalNetWorth)}</span>
              </div>
              <ProgressBar value={netWorthProgress} />
            </div>
            <div className={styles.progressRow}>
              <div className={styles.progressHeader}>
                <span>Пассивный доход {formatCurrency(passiveIncome)}</span>
                <span>Цель {formatCurrency(goalPassiveIncome)}</span>
              </div>
              <ProgressBar value={passiveProgress} />
            </div>
            <div className={styles.balanceSummary}>
              <div className={styles.balanceRow}>
                <span>Всего доходов</span>
                <strong>{formatCurrency(totalIncome)}</strong>
              </div>
              <div className={styles.balanceRow}>
                <span>Всего расходов</span>
                <strong>{formatCurrency(totalExpenses)}</strong>
              </div>
              <div className={styles.balanceRow}>
                <span>Денежный поток</span>
                <strong>{formatCurrency(cashFlow)}</strong>
              </div>
              <div className={styles.balanceRow}>
                <span>Свободные средства</span>
                <strong>{formatCurrency(gameState.cash)}</strong>
              </div>
              <div className={styles.balanceRow}>
                <span>Финансовая подушка</span>
                <strong>{reserveMonths === Infinity ? '∞' : `${reserveMonths.toFixed(1)} мес.`}</strong>
              </div>
            </div>
          </div>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Журнал решений</h2>
            <div className={styles.logList}>
              {gameState.log.map((entry) => (
                <div key={entry.id} className={styles.logItem}>
                  <span className={styles.logMonth}>Месяц {entry.month}</span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
