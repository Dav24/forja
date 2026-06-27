import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Receiver } from 'npm:@upstash/qstash@^2';

interface NotificationTarget {
  user_id: string;
  expo_push_token: string;
  plan: string;
  sub_status: string;
  current_period_end: string | null;
  goal_type: string | null;
  target_weight_kg: string | null; // NUMERIC comes as string from Supabase
  target_date: string | null;      // DATE comes as string YYYY-MM-DD
  last_activity: string | null;    // TIMESTAMPTZ comes as ISO string
  first_weight: string | null;
  current_weight: string | null;
}

interface NotificationPayload {
  type: 'progress_update' | 'missed_workout' | 'goal_milestone';
  title: string;
  body: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: string };
  sound: 'default';
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function isPremium(target: NotificationTarget): boolean {
  if (target.plan !== 'premium') return false;
  if (target.sub_status !== 'active' && target.sub_status !== 'trialing') return false;
  if (target.current_period_end && new Date(target.current_period_end) < new Date()) return false;
  return true;
}

function daysSince(isoDate: string | null): number {
  if (!isoDate) return 999;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

function decideNotification(target: NotificationTarget): NotificationPayload | null {
  const premium = isPremium(target);
  const inactive = daysSince(target.last_activity);

  // Skip churned users (>5 days inactive)
  if (inactive > 5) return null;

  if (premium) {
    // Check goal milestone (only for weight-related goals with a target)
    if (
      (target.goal_type === 'weight_loss' || target.goal_type === 'muscle_gain') &&
      target.target_weight_kg &&
      target.first_weight &&
      target.current_weight
    ) {
      const firstW = parseFloat(target.first_weight);
      const currentW = parseFloat(target.current_weight);
      const targetW = parseFloat(target.target_weight_kg);
      const totalChange = Math.abs(firstW - targetW);
      const achieved = Math.abs(firstW - currentW);
      if (totalChange > 0 && achieved / totalChange >= 1.0) {
        return {
          type: 'goal_milestone',
          title: '¡Lo lograste! 🏆',
          body: 'Alcanzaste tu meta de peso. ¡Es momento de celebrar!',
        };
      }
    }

    // Check target date milestone (≤7 days remaining)
    if (target.target_date) {
      const daysToGoal = (new Date(target.target_date).getTime() - Date.now()) / 86_400_000;
      if (daysToGoal >= 0 && daysToGoal <= 7) {
        const daysLeft = Math.ceil(daysToGoal);
        return {
          type: 'goal_milestone',
          title: '¡Tu meta se acerca!',
          body: `Quedan ${daysLeft} días. Memo revisa tu progreso contigo.`,
        };
      }
    }

    // Re-engagement (premium)
    if (inactive >= 2) {
      return {
        type: 'missed_workout',
        title: '2 días sin entrenar',
        body: 'Tu racha está en riesgo. Memo tiene tu plan listo.',
      };
    }

    // Daily greeting
    return {
      type: 'progress_update',
      title: '¡Hola, forjador! 💪',
      body: 'Memo está aquí. ¿Qué vamos a trabajar hoy?',
    };
  }

  // Free users
  if (inactive >= 2) {
    return {
      type: 'missed_workout',
      title: 'Te extrañamos 🔥',
      body: 'Memo tiene un mensaje para ti. ¿Volvemos?',
    };
  }

  return {
    type: 'progress_update',
    title: '¡Hola, forjador! 💪',
    body: 'Memo está aquí. ¿Qué vamos a trabajar hoy?',
  };
}

async function sendBatch(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN')
          ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Expo API HTTP ${res.status}:`, text);
      throw new Error(`Expo Push API failed: ${res.status}`);
    }
    const json = await res.json() as { data: ExpoTicket[] };
    tickets.push(...(json.data ?? []));
  }
  return tickets;
}

Deno.serve(async (req: Request) => {
  // Verify QStash signature (skippable for local dev)
  const skipVerify = Deno.env.get('SKIP_QSTASH_VERIFY') === 'true';
  if (!skipVerify) {
    const receiver = new Receiver({
      currentSigningKey: Deno.env.get('QSTASH_CURRENT_SIGNING_KEY')!,
      nextSigningKey: Deno.env.get('QSTASH_NEXT_SIGNING_KEY')!,
    });
    const signature = req.headers.get('Upstash-Signature') ?? '';
    const body = await req.text();
    try {
      await receiver.verify({ signature, body });
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data: targets, error } = await supabase
    .rpc('get_notification_targets') as { data: NotificationTarget[] | null; error: unknown };

  if (error || !targets) {
    console.error('Failed to fetch notification targets:', error);
    return new Response(JSON.stringify({ error: 'DB query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build message list and correlate index to target
  const selected: Array<{ target: NotificationTarget; payload: NotificationPayload }> = [];
  for (const target of targets) {
    const payload = decideNotification(target);
    if (payload) selected.push({ target, payload });
  }

  if (selected.length === 0) {
    return new Response(JSON.stringify({ sent: 0, cleaned: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages: ExpoMessage[] = selected.map(({ target, payload }) => ({
    to: target.expo_push_token,
    title: payload.title,
    body: payload.body,
    data: { type: payload.type },
    sound: 'default',
  }));

  const tickets = await sendBatch(messages);

  // Fetch users who already received a notification today
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const successUserIds = selected
    .filter((_, i) => tickets[i]?.status === 'ok')
    .map(({ target }) => target.user_id);

  const { data: alreadySent } = successUserIds.length > 0
    ? await supabase
        .from('notifications')
        .select('user_id')
        .in('user_id', successUserIds)
        .gte('sent_at', `${today}T00:00:00Z`)
        .lt('sent_at', `${today}T23:59:59Z`)
    : { data: [] };

  const alreadySentIds = new Set((alreadySent ?? []).map((r: { user_id: string }) => r.user_id));

  // Process tickets
  const invalidUserIds: string[] = [];
  const notificationInserts: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
  }> = [];

  tickets.forEach((ticket, i) => {
    const entry = selected[i];
    if (!entry) return;
    const { target, payload } = entry;

    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      invalidUserIds.push(target.user_id);
    } else if (ticket.status === 'ok' && !alreadySentIds.has(target.user_id)) {
      notificationInserts.push({
        user_id: target.user_id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
      });
    }
  });

  // Clean invalid tokens
  if (invalidUserIds.length > 0) {
    const { error: cleanErr } = await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .in('id', invalidUserIds);
    if (cleanErr) console.error('Failed to clean tokens:', cleanErr);
  }

  // Insert successful notifications
  if (notificationInserts.length > 0) {
    const { error: insertErr } = await supabase.from('notifications').insert(notificationInserts);
    if (insertErr) console.error('Failed to insert notifications:', insertErr);
  }

  return new Response(
    JSON.stringify({ sent: notificationInserts.length, cleaned: invalidUserIds.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
