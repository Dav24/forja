import Stripe from 'npm:stripe@18';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mapStripeStatus } from './status.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// En API versions nuevas current_period_end vive en el item; en viejas, en la subscription
function periodEnd(sub: Stripe.Subscription): string | null {
  const ts =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function userIdForSub(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();
  if (error) throw error; // transitorio → el catch del caller responde 500 y Stripe reintenta
  if (!data) console.error('webhook: sin user_id para subscription', sub.id);
  return data?.user_id ?? null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error('webhook: firma inválida', err);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id ?? session.client_reference_id;
        if (!userId) {
          // Bug nuestro: log + 200 para que Stripe no reintente infinito
          console.error('webhook: checkout.session.completed sin user_id', session.id);
          break;
        }
        if (session.mode !== 'subscription' || !session.subscription) break;
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'premium',
            status: mapStripeStatus(sub.status),
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subId,
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        // metadata.user_id en el CUSTOMER: el checkout solo marca la subscription,
        // y /api/portal busca por customer metadata
        await stripe.customers.update(session.customer as string, {
          metadata: { user_id: userId },
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdForSub(sub);
        if (!userId) break;
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: mapStripeStatus(sub.status),
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('stripe_subscription_id', sub.id);
        if (error) throw error;
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdForSub(sub);
        if (!userId) break;
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan: 'free',
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('stripe_subscription_id', sub.id);
        if (error) throw error;
        break;
      }
      // Otros eventos: 200 silencioso
    }
  } catch (err) {
    // Error transitorio (DB caída, etc.): 500 para que Stripe reintente
    console.error('webhook: error manejando', event.type, err);
    return new Response('handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
