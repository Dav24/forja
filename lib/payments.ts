export type Billing = 'monthly' | 'yearly';

const PAYMENTS_URL = process.env.EXPO_PUBLIC_PAYMENTS_URL ?? 'https://pay.forja.fit';

export function buildPaymentURL(uid: string, billing: Billing, promoCode = ''): string {
  let url = `${PAYMENTS_URL}/?plan=premium&billing=${billing}&uid=${uid}`;
  const promo = promoCode.trim();
  if (promo) url += '&promo=' + encodeURIComponent(promo.toUpperCase());
  return url;
}

export function buildPortalURL(uid: string): string {
  return `${PAYMENTS_URL}/portal?uid=${uid}`;
}

export function buildCreditPackURL(uid: string): string {
  return `${PAYMENTS_URL}/credits/?uid=${uid}`;
}
