import crypto from 'crypto';

export type PaymentProvider = 'tinkoff' | 'sberpay';

interface PaymentRequest {
  amount: number;
  provider: PaymentProvider;
  description: string;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  orderId?: string;
}

function ensureEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не найдено обязательное окружение ${name}`);
  }
  return value;
}

function buildTinkoffToken(fields: Record<string, unknown>) {
  const filtered = Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const tokenString = filtered
    .sort(([keyA], [keyB]) => (keyA < keyB ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('');
  return crypto.createHash('sha256').update(tokenString).digest('hex');
}

async function initTinkoffPayment(request: PaymentRequest) {
  const TerminalKey = ensureEnv('TINKOFF_TERMINAL_KEY');
  const SecretKey = ensureEnv('TINKOFF_SECRET_KEY');

  const amountInKopecks = Math.round(request.amount * 100);
  const orderId = request.orderId ?? crypto.randomUUID();

  const payload = {
    Amount: amountInKopecks,
    OrderId: orderId,
    Description: request.description,
    TerminalKey,
    SuccessURL: request.successUrl,
    FailURL: request.failUrl,
    PayType: 'O',
  } as const;

  const token = buildTinkoffToken({ ...payload, Password: SecretKey });

  const response = await fetch('https://securepay.tinkoff.ru/v2/Init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, Token: token }),
  });

  if (!response.ok) {
    throw new Error(`Tinkoff API вернул статус ${response.status}`);
  }

  const data = await response.json() as { Success?: boolean; PaymentURL?: string; Message?: string; Details?: string };

  if (!data.Success || !data.PaymentURL) {
    throw new Error(data.Message ?? data.Details ?? 'Не удалось создать сессию оплаты в Тинькофф');
  }

  return data.PaymentURL;
}

async function initSberPayment(request: PaymentRequest) {
  const userName = ensureEnv('SBER_USERNAME');
  const password = ensureEnv('SBER_PASSWORD');

  const amountInKopecks = Math.round(request.amount * 100);
  const orderId = request.orderId ?? crypto.randomUUID();

  const params = new URLSearchParams({
    userName,
    password,
    amount: String(amountInKopecks),
    orderNumber: orderId,
    returnUrl: request.successUrl,
    failUrl: request.failUrl,
    description: request.description,
    language: 'ru',
  });

  if (request.customerEmail) {
    params.set('email', request.customerEmail);
  }

  const endpoint = process.env.SBER_ENDPOINT ?? 'https://securepayments.sberbank.ru/payment/rest/register.do';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Sber API вернул статус ${response.status}`);
  }

  const data = await response.json() as { errorCode?: string; errorMessage?: string; formUrl?: string };

  if (data.errorCode || !data.formUrl) {
    throw new Error(data.errorMessage ?? 'Не удалось создать ссылку на оплату в Сбере');
  }

  return data.formUrl;
}

export async function createPaymentLink(request: PaymentRequest) {
  if (request.amount <= 0 || !Number.isFinite(request.amount)) {
    throw new Error('Сумма должна быть положительным числом');
  }

  switch (request.provider) {
    case 'tinkoff':
      return initTinkoffPayment(request);
    case 'sberpay':
      return initSberPayment(request);
    default:
      throw new Error('Неизвестный провайдер оплаты');
  }
}
