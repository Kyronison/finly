import type { NextApiRequest, NextApiResponse } from 'next';

import { requireAuth } from '@/lib/auth';
import { createPaymentLink, type PaymentProvider } from '@/lib/payments';

function getBaseUrl(req: NextApiRequest) {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.length > 0) {
    return originHeader;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const { amount, provider, description, customerEmail } = req.body ?? {};

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    res.status(400).json({ message: 'Сумма платежа должна быть числом' });
    return;
  }

  if (provider !== 'tinkoff' && provider !== 'sberpay') {
    res.status(400).json({ message: 'Укажите провайдера оплаты tinkoff или sberpay' });
    return;
  }

  const baseUrl = getBaseUrl(req);
  const successUrl = `${baseUrl}/dashboard?payment=success`;
  const failUrl = `${baseUrl}/dashboard/subscription?payment=failed`;

  try {
    const paymentUrl = await createPaymentLink({
      amount,
      provider: provider as PaymentProvider,
      description: description ?? 'Подписка на Автопилот',
      successUrl,
      failUrl,
      customerEmail,
    });

    res.status(200).json({ paymentUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать оплату';
    res.status(500).json({ message });
  }
}
