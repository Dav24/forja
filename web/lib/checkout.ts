import type Stripe from 'stripe';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Billing = 'monthly' | 'yearly';

export function isValidUid(uid: unknown): uid is string {
  return typeof uid === 'string' && UUID_RE.test(uid);
}

export function priceIdFor(billing: Billing): string {
  const id =
    billing === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
  if (!id) throw new Error(`Falta STRIPE_PRICE_${billing === 'monthly' ? 'MONTHLY' : 'YEARLY'}`);
  return id;
}

// req.nextUrl.origin devuelve la dirección de bind del server (p.ej. 0.0.0.0 en dev
// con -H 0.0.0.0), no el Host que usó el cliente — las success/cancel URLs saldrían
// inalcanzables. El origin real viene de los headers.
export function requestOrigin(headers: Headers, fallback: string): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return fallback;
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export async function resolvePromo(stripe: Stripe, code: string): Promise<string | null> {
  const found = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  return found.data[0]?.id ?? null;
}

export async function createCheckoutSession(
  stripe: Stripe,
  origin: string,
  p: { billing: Billing; uid: string; promo?: string },
): Promise<{ url: string }> {
  const promoId = p.promo ? await resolvePromo(stripe, p.promo) : null;
  const cancelParams = new URLSearchParams({ plan: 'premium', billing: p.billing, uid: p.uid });
  if (p.promo) cancelParams.set('promo', p.promo);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceIdFor(p.billing), quantity: 1 }],
    client_reference_id: p.uid,
    metadata: { user_id: p.uid },
    subscription_data: { metadata: { user_id: p.uid } },
    payment_method_collection: 'if_required',
    // Stripe no permite discounts + allow_promotion_codes juntos
    ...(promoId ? { discounts: [{ promotion_code: promoId }] } : { allow_promotion_codes: true }),
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?${cancelParams.toString()}`,
  });
  return { url: session.url! };
}

export function packPriceIdFor(packId: string): string {
  const envKey = `STRIPE_PRICE_CREDIT_PACK_${packId.replace('pack_', '')}`;
  const id = process.env[envKey];
  if (!id) throw new Error(`Falta ${envKey}`);
  return id;
}

export async function createCreditPackCheckoutSession(
  stripe: Stripe,
  origin: string,
  p: { packId: string; uid: string },
): Promise<{ url: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: packPriceIdFor(p.packId), quantity: 1 }],
    client_reference_id: p.uid,
    metadata: { user_id: p.uid, credit_pack: p.packId },
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/credits/?uid=${p.uid}`,
  });
  return { url: session.url! };
}
