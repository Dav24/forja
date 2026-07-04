import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createCheckoutSession, isValidUid, type Billing } from '@/lib/checkout';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const billing = body?.billing as Billing;
  const uid = body?.uid;
  const promo = typeof body?.promo === 'string' ? body.promo.trim().toUpperCase() : undefined;

  if (!['monthly', 'yearly'].includes(billing) || !isValidUid(uid)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const { url } = await createCheckoutSession(getStripe(), req.nextUrl.origin, {
      billing,
      uid,
      promo: promo || undefined,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('checkout error:', err);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}
