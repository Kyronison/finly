export type IncomeType = 'ACTIVE' | 'PASSIVE';

export interface IncomeItem {
  id: string;
  label: string;
  amount: number;
  type: IncomeType;
}

export interface ExpenseItem {
  id: string;
  label: string;
  amount: number;
}

export type AssetType = 'STOCK' | 'REAL_ESTATE' | 'BUSINESS';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  cashflow: number;
  details: string;
  incomeId?: string;
}

export interface Liability {
  id: string;
  name: string;
  balance: number;
  payment: number;
}

export interface Profession {
  id: string;
  name: string;
  salary: number;
  description: string;
  startingCash: number;
  goalNetWorth: number;
  goalPassiveIncome: number;
  expenses: ExpenseItem[];
}

export interface GameLogEntry {
  id: string;
  month: number;
  message: string;
}

export interface GameState {
  profession: Profession;
  month: number;
  cash: number;
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  assets: Asset[];
  liabilities: Liability[];
  log: GameLogEntry[];
}

interface BaseEvent {
  id: string;
  narrative: string;
}

export interface StockOpportunity extends BaseEvent {
  type: 'STOCK';
  company: string;
  sector: string;
  price: number;
  fairValue: number;
  expectedDividend: number;
  maxShares: number;
}

export interface RealEstateOpportunity extends BaseEvent {
  type: 'REAL_ESTATE';
  propertyType: string;
  price: number;
  downPayment: number;
  monthlyRent: number;
  monthlyExpenses: number;
  appreciation: number;
}

export interface BusinessOpportunity extends BaseEvent {
  type: 'BUSINESS';
  business: string;
  buyInCost: number;
  monthlyProfit: number;
  effortLevel: 'низкая' | 'средняя' | 'высокая';
}

export interface LifeEvent extends BaseEvent {
  type: 'LIFE';
  label: string;
  amount: number;
  category: 'expense_increase' | 'expense_decrease' | 'income_increase';
}

export interface WindfallEvent extends BaseEvent {
  type: 'WINDFALL';
  amount: number;
  source: string;
}

export type GameEvent =
  | StockOpportunity
  | RealEstateOpportunity
  | BusinessOpportunity
  | LifeEvent
  | WindfallEvent;
