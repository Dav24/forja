import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { isValidUid } from '@/lib/checkout';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const uid = body?.uid;
  if (!isValidUid(uid)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const stripe = getStripe();
    const found = await stripe.customers.search({
      query: `metadata['user_id']:'${uid}'`,
      limit: 1,
    });
    const customer = found.data[0];
    if (!customer) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 404 });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: req.nextUrl.origin,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('portal error:', err);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}
