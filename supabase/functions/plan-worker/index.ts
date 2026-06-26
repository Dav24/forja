// plan-worker: se invocará via QStash cuando esté configurado (Paso 15).
// Por ahora generate-plan procesa todo sincrónicamente.
// Este archivo es el receptor del webhook de QStash para procesamiento async futuro.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // TODO: validar firma QStash cuando esté configurado
  // const signature = req.headers.get('upstash-signature');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { job_id } = await req.json();
  if (!job_id) {
    return new Response(JSON.stringify({ error: 'missing job_id' }), { status: 400 });
  }

  const { data: job } = await supabase
    .from('async_jobs')
    .select('*')
    .eq('id', job_id)
    .single();

  if (!job) {
    return new Response(JSON.stringify({ error: 'job not found' }), { status: 404 });
  }

  console.log(`plan-worker: procesando job ${job_id} tipo ${job.type}`);

  return new Response(JSON.stringify({ ok: true, job_id }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
