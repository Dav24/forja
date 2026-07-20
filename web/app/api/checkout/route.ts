import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import {
  createCheckoutSession,
  createCreditPackCheckoutSession,
  isValidUid,
  requestOrigin,
  type Billing,
} from '@/lib/checkout';

const VALID_PACKS = ['pack_3'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const uid = body?.uid;
  if (!isValidUid(uid)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const origin = requestOrigin(req.headers, req.nextUrl.origin);

  if (body?.kind === 'credit_pack') {
    const packId = body?.packId;
    if (!VALID_PACKS.includes(packId)) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    try {
      const { url } = await createCreditPackCheckoutSession(getStripe(), origin, { packId, uid });
      return NextResponse.json({ url });
    } catch (err) {
      console.error('checkout error:', err);
      return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
    }
  }

  const billing = body?.billing as Billing;
  const promo = typeof body?.promo === 'string' ? body.promo.trim().toUpperCase() : undefined;
  if (!['monthly', 'yearly'].includes(billing)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const { url } = await createCheckoutSession(getStripe(), origin, { billing, uid, promo: promo || undefined });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('checkout error:', err);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}
