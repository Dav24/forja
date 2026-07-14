#!/usr/bin/env node
// Import único del catálogo MoveKit (206 ejercicios) a Supabase.
// Idempotente: re-correr no duplica (ON CONFLICT DO UPDATE) ni re-traduce
// lo ya insertado (skip si el slug ya existe con name_es).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ROOT = new URL('../assets-import/exercise-media/', import.meta.url);
const METADATA_PATH = new URL('full-library-metadata/metadata.json', ROOT);
const VIDEO_DIR = new URL('full-library-NTRkdOevZfhYISO5pBWekIctpb7YNr/', ROOT);
const POSTER_DIR = new URL('full-library-posters/posters/', ROOT);

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SERVICE_ROLE_KEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno');
if (!ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en el entorno');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Traduce name + instructions[] en UNA llamada a Haiku (texto plano
// delimitado, no JSON — más barato y sin riesgo de que el modelo rompa
// estructura). Formato de salida: primera línea = nombre, resto = pasos.
async function translateExercise(nameEn, instructionsEn) {
  const prompt = `Traduce al español natural y en tono de entrenador (marca "Forja"/"Vulcano" no se traduce si aparece).
Responde EXACTAMENTE en este formato, sin explicaciones:
NOMBRE: <nombre del ejercicio traducido>
PASOS:
- <paso 1 traducido>
- <paso 2 traducido>
(un guion por paso, mismo número de pasos que el original)

Nombre original: ${nameEn}
Pasos originales:
${instructionsEn.map((s) => `- ${s}`).join('\n')}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';

  const nameMatch = text.match(/NOMBRE:\s*(.+)/);
  const stepsBlock = text.split('PASOS:')[1] ?? '';
  const steps = stepsBlock
    .split('\n')
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);

  if (!nameMatch || steps.length === 0) {
    throw new Error(`Traducción con formato inesperado para "${nameEn}": ${text.slice(0, 200)}`);
  }
  return { nameEs: nameMatch[1].trim(), instructionsEs: steps };
}

async function uploadIfMissing(bucketPath, localUrl, contentType) {
  const { data: existing } = await supabase.storage.from('exercise-media').list(bucketPath.split('/')[0], {
    search: bucketPath.split('/')[1],
  });
  if (existing?.some((f) => bucketPath.endsWith(f.name))) return;

  const bytes = readFileSync(localUrl);
  const { error } = await supabase.storage
    .from('exercise-media')
    .upload(bucketPath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Error subiendo ${bucketPath}: ${error.message}`);
}

async function main() {
  const exercises = JSON.parse(readFileSync(METADATA_PATH, 'utf-8'));
  console.log(`Importando ${exercises.length} ejercicios...`);

  const { data: already } = await supabase.from('exercise_catalog').select('slug');
  const doneSlugs = new Set((already ?? []).map((r) => r.slug));

  let count = 0;
  for (const ex of exercises) {
    count++;
    const { slug, name, primaryMuscles, equipment, movementPattern, difficulty, instructions } = ex;
    process.stdout.write(`[${count}/${exercises.length}] ${slug}... `);

    await uploadIfMissing(`videos/${slug}.mp4`, new URL(`${slug}.mp4`, VIDEO_DIR), 'video/mp4');
    await uploadIfMissing(`posters/${slug}.webp`, new URL(`${slug}.webp`, POSTER_DIR), 'image/webp');

    if (doneSlugs.has(slug)) {
      console.log('ya en catálogo, solo verificado storage.');
      continue;
    }

    const { nameEs, instructionsEs } = await translateExercise(name, instructions);

    // Se guarda la RUTA relativa dentro del bucket, no la URL pública absoluta:
    // getPublicUrl() la arma con el SUPABASE_URL de ESTE script (127.0.0.1 en
    // dev), que no coincide con el host que usa la app (LAN IP para llegar a
    // un teléfono físico) ni con el host de producción. El cliente construye
    // la URL completa en el momento de leer, con su propio host correcto.
    const { error } = await supabase.from('exercise_catalog').upsert({
      slug,
      name_en: name,
      name_es: nameEs,
      primary_muscle: primaryMuscles[0] ?? 'General',
      equipment: equipment[0] ?? 'Bodyweight',
      movement_pattern: movementPattern[0] ?? 'Isolation',
      difficulty,
      instructions_es: instructionsEs,
      video_url: `videos/${slug}.mp4`,
      poster_url: `posters/${slug}.webp`,
    }, { onConflict: 'slug' });

    if (error) throw new Error(`Error insertando ${slug}: ${error.message}`);
    console.log(`OK — "${nameEs}"`);
  }

  const { count: total } = await supabase.from('exercise_catalog').select('*', { count: 'exact', head: true });
  console.log(`\nListo. exercise_catalog tiene ${total} filas.`);
}

main().catch((err) => {
  console.error('FALLÓ:', err.message);
  process.exit(1);
});
