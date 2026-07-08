import { createClient } from 'jsr:@supabase/supabase-js@2';
import { deleteAccount } from './logic.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user }, error: authError } = await anon.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

  try {
    await deleteAccount(
      {
        getSubscription: async (uid) => {
          const { data, error } = await admin
            .from('subscriptions')
            .select('stripe_subscription_id, status')
            .eq('user_id', uid)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        cancelStripeSubscription: async (subId) => {
          if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            if (body?.error?.code === 'resource_missing') return; // ya no existe en Stripe: ok
            throw new Error(`Stripe cancel failed: ${res.status}`);
          }
        },
        removeAvatar: async (uid) => {
          // remove no falla si el objeto no existe; otros errores tampoco deben
          // bloquear el borrado de la cuenta (el bucket se limpia por mantenimiento)
          await admin.storage.from('avatars').remove([`${uid}.jpg`]).catch(() => {});
        },
        deleteUser: async (uid) => {
          const { error } = await admin.auth.admin.deleteUser(uid);
          if (error) throw error;
        },
      },
      user.id
    );
  } catch (err) {
    console.error('delete-account failed:', err);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la cuenta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
