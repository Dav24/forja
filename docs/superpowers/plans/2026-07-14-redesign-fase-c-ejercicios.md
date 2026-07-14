# Rediseño Fase C: Fichas de ejercicio + registro de carga — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tocar un ejercicio en el detalle del plan abre una ficha con video real (MoveKit), técnica traducida y registro de carga por serie que alimenta una gráfica de progresión.

**Architecture:** Import único (script Node) de los 206 assets de `assets-import/` a un catálogo en DB + bucket de Storage. `generate-plan` recibe el catálogo completo y marca `exercise_slug` por ejercicio cuando hay match real. El cliente resuelve la ficha por slug: con match → video+técnica+registro; sin match → solo texto. El registro vive en `exercise_logs`, referenciado por posición en el JSONB del plan (no FK relacional), y la progresión se consulta por `exercise_slug` a través del tiempo.

**Tech Stack:** Supabase (Postgres + Storage + Edge Functions Deno), `expo-video` (nuevo), `react-native-svg` (ya en el proyecto, sparkline), `@gorhom/bottom-sheet` (ya en el proyecto), Claude Haiku para traducción del catálogo.

**Spec:** `docs/superpowers/specs/2026-07-14-redesign-fase-c-ejercicios-design.md`

## Global Constraints

- Fuente de assets: `assets-import/exercise-media/` (gitignorado) — 206 MP4 en `full-library-NTRkdOevZfhYISO5pBWekIctpb7YNr/`, 206 WebP en `full-library-posters/posters/`, metadata en `full-library-metadata/metadata.json`. Nombre de archivo = `slug` del JSON, sin excepciones.
- Modelo de traducción: `claude-haiku-4-5-20251001` (patrón ya usado en `translate-plan`: header `x-api-key`, `anthropic-version: 2023-06-01`).
- Colores/fuentes SIEMPRE vía `useTheme()`/`typography` — cero hex nuevos.
- Regla worklets: dentro de `useAnimatedStyle`/`useAnimatedProps` solo shared values capturados fuera.
- Claves i18n nuevas siempre es+en (`npm run check-i18n`).
- `exercise_slug` en el JSON de `schedule` pasa intacto por `translate-plan` sin cambio de código: `applyTranslation` copia cada ejercicio con `{ ...ex }` y solo sobreescribe `EXERCISE_FIELDS = ['name','muscle_group','technique_notes']` — `exercise_slug` no está en esa lista, así que sobrevive la traducción automáticamente. Verificado contra `supabase/functions/translate-plan/logic.ts` — no tocar ese archivo en este plan.
- Deps nativas con `npx expo install` (nunca instalar directo).
- Commits en español `feat(fase-c):`. Rama master. Dir: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.
- Docker vía `sg docker -c "..."`. Tras tocar EFs: `sg docker -c "docker restart supabase_edge_runtime_forja"` (o `supabase stop && start` si es una EF nueva — ver memoria del proyecto).

---

### Task 1: Migración 0011 — `exercise_catalog`, `exercise_logs`, bucket `exercise-media`

**Files:**
- Create: `supabase/migrations/0011_exercise_catalog.sql`

**Interfaces:**
- Produces: tablas `exercise_catalog(slug pk, name_en, name_es, primary_muscle, equipment, movement_pattern, difficulty, instructions_es text[], video_url, poster_url, created_at)` y `exercise_logs(id, user_id, workout_plan_id, day_number, exercise_order, exercise_slug null, set_number, kg null, reps null, bodyweight_lastre_kg null, recorded_at)`; bucket `exercise-media` (público).

- [ ] **Step 1: Escribir la migración**

```sql
-- Fase C del rediseño: catálogo de ejercicios (MoveKit) + registro de carga.
-- exercise_catalog se puebla UNA vez por script de import (service role);
-- lectura pública porque es contenido compartido, no dato de usuario.
create table exercise_catalog (
  slug text primary key,
  name_en text not null,
  name_es text not null,
  primary_muscle text not null,
  equipment text not null,
  movement_pattern text not null,
  difficulty text not null,
  instructions_es text[] not null,
  video_url text not null,
  poster_url text not null,
  created_at timestamptz not null default now()
);

alter table exercise_catalog enable row level security;

create policy "exercise_catalog_public_read" on exercise_catalog
  for select to authenticated using (true);

-- exercise_logs: registro por serie. Sin FK relacional al ejercicio dentro
-- del plan porque workout_plans.schedule vive en JSONB — se referencia por
-- posición (day_number, exercise_order), igual que ya hace el cliente hoy.
create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan_id uuid not null references workout_plans(id) on delete cascade,
  day_number int not null,
  exercise_order int not null,
  exercise_slug text null references exercise_catalog(slug) on delete set null,
  set_number int not null,
  kg numeric null,
  reps int null,
  bodyweight_lastre_kg numeric null,
  recorded_at timestamptz not null default now()
);

alter table exercise_logs enable row level security;

create policy "exercise_logs_owner_select" on exercise_logs
  for select to authenticated using (user_id = auth.uid());

create policy "exercise_logs_owner_insert" on exercise_logs
  for insert to authenticated with check (user_id = auth.uid());

create index exercise_logs_slug_idx on exercise_logs(exercise_slug, recorded_at);
create index exercise_logs_plan_idx on exercise_logs(workout_plan_id, day_number, exercise_order);

-- Bucket público (mismo patrón que 0008_avatars_bucket.sql): lectura pública,
-- solo el script de import (service role) escribe.
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;

create policy "exercise_media_public_read" on storage.objects
  for select using (bucket_id = 'exercise-media');
```

- [ ] **Step 2: Aplicar la migración**

Run: `sg docker -c "supabase migration up"`
Expected: aplica `0011_exercise_catalog.sql` sin errores.

- [ ] **Step 3: Verificar**

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select count(*) from information_schema.tables where table_name in ('exercise_catalog','exercise_logs');\""`
Expected: `2`.

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select id, public from storage.buckets where id='exercise-media';\""`
Expected: 1 fila, `public = t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0011_exercise_catalog.sql
git commit -m "feat(fase-c): migración 0011 — exercise_catalog, exercise_logs y bucket exercise-media"
```

---

### Task 2: Script de importación del catálogo MoveKit

**Files:**
- Create: `scripts/import-exercise-catalog.mjs`

**Interfaces:**
- Consumes: `assets-import/exercise-media/full-library-metadata/metadata.json`, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`ANTHROPIC_API_KEY` de `supabase/.env`.
- Produces: 206 filas en `exercise_catalog`, 412 archivos en el bucket `exercise-media` (ruta `videos/{slug}.mp4`, `posters/{slug}.webp`).

- [ ] **Step 1: Crear el script**

```js
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

    const { data: videoUrlData } = supabase.storage.from('exercise-media').getPublicUrl(`videos/${slug}.mp4`);
    const { data: posterUrlData } = supabase.storage.from('exercise-media').getPublicUrl(`posters/${slug}.webp`);

    const { error } = await supabase.from('exercise_catalog').upsert({
      slug,
      name_en: name,
      name_es: nameEs,
      primary_muscle: primaryMuscles[0] ?? 'General',
      equipment: equipment[0] ?? 'Bodyweight',
      movement_pattern: movementPattern[0] ?? 'Isolation',
      difficulty,
      instructions_es: instructionsEs,
      video_url: videoUrlData.publicUrl,
      poster_url: posterUrlData.publicUrl,
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
```

- [ ] **Step 2: Verificar que `@supabase/supabase-js` está disponible para Node** (el proyecto usa el paquete JSR en Edge Functions; para el script de Node hace falta el paquete npm)

Run: `cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npm ls @supabase/supabase-js 2>&1 | head -5`
Expected: si no aparece, instalar con `npm install --save-dev @supabase/supabase-js` (paquete npm estándar, no nativo — no requiere `expo install`).

- [ ] **Step 3: Correr el import contra Supabase local**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja"
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY supabase/.env | cut -d= -f2)
export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY supabase/.env | cut -d= -f2)
node scripts/import-exercise-catalog.mjs
```

Expected: 206 líneas de progreso terminando en "OK — ..." cada una, cierre con "exercise_catalog tiene 206 filas." Puede tardar varios minutos (206 llamadas a Haiku + 412 subidas). Si se corta a la mitad, volver a correr el mismo comando — es idempotente (retoma donde quedó, sube lo que falte y salta lo ya traducido).

- [ ] **Step 4: Verificar en DB**

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select count(*) from exercise_catalog;\""`
Expected: `206`.

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select slug, name_es, equipment, video_url from exercise_catalog limit 3;\""`
Expected: 3 filas con `name_es` en español real (no vacío, no igual a `name_en`) y `video_url` con formato `http://127.0.0.1:54321/storage/v1/object/public/exercise-media/videos/...`.

Run: `curl -s -o /dev/null -w "%{http_code}\n" "$(sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -tAc \"select video_url from exercise_catalog limit 1;\"")"`
Expected: `200` (el video es descargable públicamente).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-exercise-catalog.mjs package.json package-lock.json
git commit -m "feat(fase-c): script de import del catálogo MoveKit — 206 ejercicios verificados en DB y Storage"
```

---

### Task 3: `generate-plan` — catálogo en el prompt + `exercise_slug`

**Files:**
- Modify: `supabase/functions/generate-plan/index.ts`

**Interfaces:**
- Produces: cada ejercicio del JSON de `schedule` gana el campo `exercise_slug: string | null`.

- [ ] **Step 1: Leer el catálogo compacto al construir el prompt**

En `supabase/functions/generate-plan/index.ts`, DESPUÉS de resolver `language` (busca la línea `const language: 'es' | 'en' = ...`) y ANTES de armar `prompt = buildPlanPrompt(...)`, agregar:

```ts
    const { data: catalogRows } = await supabase
      .from('exercise_catalog')
      .select('slug, name_es, name_en, equipment');
    const catalogBlock = (catalogRows ?? [])
      .map((r) => `${r.slug}|${language === 'en' ? r.name_en : r.name_es}|${r.equipment}`)
      .join('\n');
```

- [ ] **Step 2: Pasar `catalogBlock` a `buildPlanPrompt`**

En la llamada a `buildPlanPrompt({...})`, agregar el campo `catalogBlock,` al objeto de argumentos (junto a `language,`).

En la firma de `buildPlanPrompt` (busca `function buildPlanPrompt(userData: {`), agregar el campo al tipo:

```ts
  catalogBlock: string;
```

- [ ] **Step 3: Agregar el bloque de instrucción al prompt y el campo al schema**

Dentro de `buildPlanPrompt`, justo ANTES de la línea `FORMATO JSON REQUERIDO (responde EXACTAMENTE así):`, insertar (usando template string, respetando el estilo del resto de la función):

```ts
CATÁLOGO DE EJERCICIOS CON ANIMACIÓN REAL (usa el slug exacto cuando haya coincidencia):
${userData.catalogBlock}

Para CADA ejercicio del plan: revisa primero si existe una coincidencia real en el catálogo de arriba (mismo movimiento, aunque el nombre no sea idéntico) — si existe, usa exactamente ese "slug" en el campo "exercise_slug" y usa su nombre. Si el ejercicio es específico de cardio, running, ciclismo, natación o deporte de balón y NO tiene equivalente en el catálogo, escríbelo libremente y deja "exercise_slug" en null. Nunca fuerces una coincidencia falsa.

`;
```

En el bloque `FORMATO JSON REQUERIDO`, dentro del ejemplo de cada ejercicio (busca `"name": "Press de banca con barra",`), agregar la línea `"exercise_slug": "barbell-bench-press-slug-o-null",` justo después de `"name"`.

- [ ] **Step 4: Guardar `source_language` sigue igual; el nuevo campo pasa tal cual al insert** (el INSERT ya guarda `schedule: planData.schedule ?? []` completo — `exercise_slug` viaja dentro de cada ejercicio del JSON sin cambios adicionales en el INSERT).

- [ ] **Step 5: Reiniciar y verificar tipos**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja" && sleep 3`
Run: `npx tsc --noEmit` (desde la raíz del proyecto RN — el archivo de la EF es Deno pero cualquier tipo compartido debe seguir compilando; si no hay tipos compartidos tocados, este comando solo confirma que no se rompió nada del lado cliente)
Expected: limpio.

- [ ] **Step 6: Verificación E2E real con el usuario de prueba**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja"
ANON=$(grep -oP 'EXPO_PUBLIC_SUPABASE_ANON_KEY=\K.*' .env.local)
TOKEN=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"test-planfix@forja.test","password":"Test1234!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://127.0.0.1:54321/functions/v1/generate-plan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"days_per_week":4,"minutes_per_session":60,"equipment":"gym con máquinas y pesas libres","modality":"gym_strength","secondary_modalities":[]}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
schedule = d.get('plan', {}).get('schedule', [])
exercises = [ex for day in schedule for ex in day.get('exercises', [])]
with_slug = [ex for ex in exercises if ex.get('exercise_slug')]
print(f'{len(exercises)} ejercicios totales, {len(with_slug)} con exercise_slug')
for ex in with_slug[:3]: print(' -', ex['exercise_slug'], '→', ex['name'])
"
```

Expected: al menos 1 ejercicio con `exercise_slug` no nulo (perfil `gym_strength` debería dar varios). Nota: consume 1 plan del límite free del usuario de prueba — si ya lo agotó, usar `plans_count` o crear otro usuario de prueba con goal activo.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/generate-plan/index.ts
git commit -m "feat(fase-c): generate-plan selecciona ejercicios del catálogo MoveKit (exercise_slug)"
```

---

### Task 4: Hooks de cliente — catálogo y registro de carga

**Files:**
- Create: `hooks/useExerciseCatalog.ts`
- Create: `hooks/useExerciseLogs.ts`

**Interfaces:**
- Produces:
  - `useExerciseCatalogEntry(slug: string | null): { data: ExerciseCatalogEntry | undefined; isLoading: boolean }` — `ExerciseCatalogEntry = { slug, name_es, primary_muscle, equipment, movement_pattern, difficulty, instructions_es: string[], video_url, poster_url }`.
  - `useLogExerciseSets(): { mutateAsync: (input: LogSetsInput) => Promise<void> }` — `LogSetsInput = { workoutPlanId: string; dayNumber: number; exerciseOrder: number; exerciseSlug: string | null; sets: { setNumber: number; kg?: number; reps?: number; bodyweightLastreKg?: number }[] }`.
  - `useExerciseProgression(slug: string | null): { data: { recorded_at: string; kg: number | null; reps: number | null; bodyweight_lastre_kg: number | null }[] | undefined }` — últimos registros de ESE `exercise_slug` (de cualquier plan), ordenados por fecha ascendente, limit 10.

- [ ] **Step 1: Crear `hooks/useExerciseCatalog.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ExerciseCatalogEntry {
  slug: string;
  name_es: string;
  primary_muscle: string;
  equipment: string;
  movement_pattern: string;
  difficulty: string;
  instructions_es: string[];
  video_url: string;
  poster_url: string;
}

export function useExerciseCatalogEntry(slug: string | null) {
  return useQuery<ExerciseCatalogEntry | undefined>({
    queryKey: ['exercise_catalog', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_catalog')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data ?? undefined;
    },
  });
}
```

- [ ] **Step 2: Crear `hooks/useExerciseLogs.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export interface LogSetsInput {
  workoutPlanId: string;
  dayNumber: number;
  exerciseOrder: number;
  exerciseSlug: string | null;
  sets: { setNumber: number; kg?: number; reps?: number; bodyweightLastreKg?: number }[];
}

export function useLogExerciseSets() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogSetsInput) => {
      const rows = input.sets.map((s) => ({
        user_id: user!.id,
        workout_plan_id: input.workoutPlanId,
        day_number: input.dayNumber,
        exercise_order: input.exerciseOrder,
        exercise_slug: input.exerciseSlug,
        set_number: s.setNumber,
        kg: s.kg ?? null,
        reps: s.reps ?? null,
        bodyweight_lastre_kg: s.bodyweightLastreKg ?? null,
      }));
      const { error } = await supabase.from('exercise_logs').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.exerciseSlug) {
        queryClient.invalidateQueries({ queryKey: ['exercise_progression', variables.exerciseSlug] });
      }
    },
  });
}

export function useExerciseProgression(slug: string | null) {
  return useQuery({
    queryKey: ['exercise_progression', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('recorded_at, kg, reps, bodyweight_lastre_kg')
        .eq('exercise_slug', slug!)
        .order('recorded_at', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add hooks/useExerciseCatalog.ts hooks/useExerciseLogs.ts
git commit -m "feat(fase-c): hooks de catálogo, registro de carga y progresión por ejercicio"
```

---

### Task 5: `Stepper` — control ±incremento con valor tecleable y snap

**Files:**
- Create: `components/ui/Stepper.tsx`

**Interfaces:**
- Produces: `<Stepper value={number} onChange={(v: number) => void} unit={string} step={number} decimals={number} min={number}>` — controlado; internamente muestra un `TextInput` que al perder foco redondea al múltiplo más cercano de `step` (mínimo `min`), igual que el prototipo v7 (67→67.5, 70→70.0, reps 10.7→11, entrada inválida conserva el valor previo).

- [ ] **Step 1: Crear el componente**

```tsx
import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/lib/theme';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step: number;
  decimals: number;
  min?: number;
}

// Botones ±step Y captura directa: teclear "67" con step=2.5 → snap a "67.5";
// "70" → "70.0"; con step=1/decimals=0, "10.7" → "11". Entrada inválida
// conserva el valor previo. Puerto del stepper del prototipo v7.
export function Stepper({ value, onChange, unit, step, decimals, min = 0 }: StepperProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(value.toFixed(decimals));

  useEffect(() => {
    setText(value.toFixed(decimals));
  }, [value, decimals]);

  function snap(raw: string): number {
    const n = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(n)) return value;
    return Math.max(min, Math.round(n / step) * step);
  }

  function commit(raw: string) {
    const snapped = snap(raw);
    onChange(snapped);
    setText(snapped.toFixed(decimals));
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 11,
        padding: 3,
      }}
    >
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - step))}
        style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
      >
        <Text style={{ color: colors.primaryText, fontSize: 17, fontFamily: 'Inter-Regular' }}>−</Text>
      </TouchableOpacity>
      <View style={{ minWidth: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setText(value.toFixed(decimals))}
          onBlur={() => commit(text)}
          onSubmitEditing={() => commit(text)}
          keyboardType="decimal-pad"
          style={{
            width: 42,
            textAlign: 'right',
            color: colors.text,
            fontFamily: 'JetBrainsMono-Medium',
            fontSize: 13.5,
            padding: 0,
          }}
        />
        <Text style={{ fontSize: 9.5, color: colors.textFaint, fontFamily: 'Inter-Regular' }}>{unit}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onChange(value + step)}
        style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
      >
        <Text style={{ color: colors.primaryText, fontSize: 17, fontFamily: 'Inter-Regular' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Stepper.tsx
git commit -m "feat(fase-c): Stepper con valor tecleable y snap al incremento"
```

---

### Task 6: `ExerciseSheet` — ficha de ejercicio con video, técnica, registro y sparkline

**Files:**
- Create: `components/plans/ExerciseSheet.tsx`
- Modify: `locales/es/plans.json`, `locales/en/plans.json`

**Interfaces:**
- Consumes: `useExerciseCatalogEntry`, `useLogExerciseSets`, `useExerciseProgression` (Task 4); `Stepper` (Task 5).
- Produces: `<ExerciseSheet ref={sheetRef} exercise={{ order, name, muscle_group, sets, reps, rest_seconds, technique_notes, exercise_slug }} context={{ workoutPlanId, dayNumber }} />` — `sheetRef.current?.expand()` la abre (patrón `Sheet`/`BottomSheet` del proyecto).

- [ ] **Step 1: Claves i18n nuevas** (`plans.json`, dentro de un objeto nuevo `exerciseSheet`)

es:
```json
  "exerciseSheet": {
    "demoTag": "DEMO · animación real",
    "noVideoNote": "Sin animación disponible para este ejercicio — sigue las notas de técnica.",
    "logTitle": "Registra tu carga de hoy",
    "logTitleBodyweight": "Registra reps y lastre de hoy",
    "noLogNote": "Ejercicio de preparación — sin registro de carga.",
    "save": "GUARDAR SERIES",
    "saved": "Series guardadas",
    "set": "S{{n}}",
    "kg": "kg",
    "reps": "reps",
    "lastre": "kg lastre",
    "progressionLabel": "Progresión"
  }
```

en:
```json
  "exerciseSheet": {
    "demoTag": "DEMO · real animation",
    "noVideoNote": "No animation available for this exercise — follow the technique notes.",
    "logTitle": "Log today's load",
    "logTitleBodyweight": "Log today's reps and added weight",
    "noLogNote": "Warm-up exercise — no load tracking.",
    "save": "SAVE SETS",
    "saved": "Sets saved",
    "set": "S{{n}}",
    "kg": "kg",
    "reps": "reps",
    "lastre": "kg added",
    "progressionLabel": "Progression"
  }
```

- [ ] **Step 2: Crear el componente**

```tsx
import { forwardRef, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Sheet } from '@/components/ui/Sheet';
import { Stepper } from '@/components/ui/Stepper';
import { useTheme } from '@/lib/theme';
import { useExerciseCatalogEntry } from '@/hooks/useExerciseCatalog';
import { useExerciseProgression, useLogExerciseSets } from '@/hooks/useExerciseLogs';

interface ScheduleExercise {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
  exercise_slug?: string | null;
}

interface ExerciseSheetProps {
  exercise: ScheduleExercise | null;
  workoutPlanId: string;
  dayNumber: number;
}

type RegisterKind = 'kg' | 'bodyweight' | 'none';

function registerKind(equipment: string | undefined, movementPattern: string | undefined): RegisterKind {
  if (!equipment) return 'none';
  if (movementPattern === 'Mobility' || movementPattern === 'Stretch') return 'none';
  if (equipment === 'Bodyweight') return 'bodyweight';
  return 'kg';
}

function Sparkline({ points }: { points: number[] }) {
  const { colors } = useTheme();
  const w = 260;
  const h = 46;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const coords = points.map((v, i) => {
    const x = 6 + i * ((w - 12) / (points.length - 1));
    const y = max === min ? h / 2 : h - 8 - ((v - min) / (max - min)) * (h - 16);
    return { x, y };
  });
  const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  return (
    <Svg width={w} height={h}>
      <Path d={path} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={colors.primary} />
    </Svg>
  );
}

export const ExerciseSheet = forwardRef<BottomSheet, ExerciseSheetProps>(function ExerciseSheet(
  { exercise, workoutPlanId, dayNumber },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation('plans');
  const slug = exercise?.exercise_slug ?? null;
  const { data: catalogEntry } = useExerciseCatalogEntry(slug);
  const { data: progression } = useExerciseProgression(slug);
  const { mutateAsync: logSets, isPending } = useLogExerciseSets();
  const [saved, setSaved] = useState(false);

  const player = useVideoPlayer(catalogEntry?.video_url ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  const kind = registerKind(catalogEntry?.equipment, catalogEntry?.movement_pattern);
  const numSets = exercise?.sets ?? 0;
  const [values, setValues] = useState<{ kg: number; reps: number; lastre: number }[]>([]);

  const rows = useMemo(() => {
    if (values.length === numSets) return values;
    const lastKg = progression?.[progression.length - 1]?.kg ?? 20;
    const lastReps = progression?.[progression.length - 1]?.reps ?? 10;
    const lastLastre = progression?.[progression.length - 1]?.bodyweight_lastre_kg ?? 0;
    return Array.from({ length: numSets }, () => ({ kg: lastKg, reps: lastReps, lastre: lastLastre }));
  }, [values, numSets, progression]);

  if (!exercise) return <Sheet ref={ref} snapPoints={['1%']} />;

  const sparklinePoints = (progression ?? [])
    .map((p) => (kind === 'kg' ? p.kg : kind === 'bodyweight' ? p.reps : null))
    .filter((v): v is number => v != null);

  async function handleSave() {
    await logSets({
      workoutPlanId,
      dayNumber,
      exerciseOrder: exercise!.order,
      exerciseSlug: slug,
      sets: rows.map((r, i) => ({
        setNumber: i + 1,
        kg: kind === 'kg' ? r.kg : undefined,
        reps: kind !== 'none' ? r.reps : undefined,
        bodyweightLastreKg: kind === 'bodyweight' ? r.lastre : undefined,
      })),
    });
    setSaved(true);
  }

  return (
    <Sheet ref={ref} snapPoints={['85%']} scrollable>
      <View style={{ paddingTop: 8 }}>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 25, color: colors.text }}>
          {catalogEntry?.name_es ?? exercise.name}
        </Text>
        <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.textFaint, marginTop: 4 }}>
          {exercise.sets}×{exercise.reps} · {exercise.rest_seconds}s
        </Text>

        {slug ? (
          <View style={{ borderRadius: 18, overflow: 'hidden', marginTop: 14, height: 210, backgroundColor: colors.backgroundAlt }}>
            {catalogEntry ? (
              <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
            ) : (
              <Image source={{ uri: catalogEntry?.poster_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            )}
            <Text
              style={{
                position: 'absolute', top: 10, left: 12,
                fontSize: 9.5, letterSpacing: 1.4, color: colors.textFaint,
                fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase',
              }}
            >
              {t('exerciseSheet.demoTag')}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12.5, marginTop: 14 }}>
            {t('exerciseSheet.noVideoNote')}
          </Text>
        )}

        {(catalogEntry?.instructions_es ?? (exercise.technique_notes ? [exercise.technique_notes] : [])).map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 9, marginTop: 8 }}>
            <Text style={{ color: colors.primary }}>✓</Text>
            <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Regular', fontSize: 12.5, lineHeight: 18 }}>{step}</Text>
          </View>
        ))}

        {kind === 'none' ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 16 }}>
            {t('exerciseSheet.noLogNote')}
          </Text>
        ) : (
          <>
            <Text style={{ fontSize: 10, letterSpacing: 1.2, color: colors.textFaint, marginTop: 18, fontFamily: 'SpaceGrotesk-Bold' }}>
              {kind === 'bodyweight' ? t('exerciseSheet.logTitleBodyweight') : t('exerciseSheet.logTitle')}
            </Text>
            {rows.map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ width: 30, color: colors.textFaint, fontFamily: 'JetBrainsMono-Medium', fontSize: 11 }}>
                  {t('exerciseSheet.set', { n: i + 1 })}
                </Text>
                {kind === 'kg' ? (
                  <Stepper
                    value={row.kg} step={2.5} decimals={1} unit={t('exerciseSheet.kg')}
                    onChange={(v) => setValues((prev) => { const next = [...rows]; next[i] = { ...next[i], kg: v }; return next; })}
                  />
                ) : (
                  <Stepper
                    value={row.lastre} step={2.5} decimals={1} unit={t('exerciseSheet.lastre')}
                    onChange={(v) => setValues((prev) => { const next = [...rows]; next[i] = { ...next[i], lastre: v }; return next; })}
                  />
                )}
                <Stepper
                  value={row.reps} step={1} decimals={0} unit={t('exerciseSheet.reps')}
                  onChange={(v) => setValues((prev) => { const next = [...rows]; next[i] = { ...next[i], reps: v }; return next; })}
                />
              </View>
            ))}
            {sparklinePoints.length >= 2 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1.2, color: colors.textFaint, marginBottom: 6, fontFamily: 'SpaceGrotesk-Bold' }}>
                  {t('exerciseSheet.progressionLabel')}
                </Text>
                <Sparkline points={sparklinePoints} />
              </View>
            ) : null}
            <View
              onTouchEnd={handleSave}
              style={{
                marginTop: 16, backgroundColor: colors.primary, borderRadius: 14,
                paddingVertical: 13, alignItems: 'center', opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={{ color: colors.onPrimary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5 }}>
                  {saved ? t('exerciseSheet.saved') : t('exerciseSheet.save')}
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
});
```

**Nota de verificación para el implementador:** `useVideoPlayer(catalogEntry?.video_url ?? null, ...)` asume que el hook reacciona cuando `catalogEntry` pasa de `undefined` (query cargando) a tener `video_url` (query resuelta) — el `source` cambia de `null` a una URL real entre renders del mismo componente. Verificar este comportamiento contra la versión instalada de `expo-video` (correr el Step 3 primero, leer `node_modules/expo-video/build/VideoPlayer.types.d.ts` o la doc oficial). **Si el player NO recarga solo al cambiar `source`:** reemplazar por `const player = useVideoPlayer(null); useEffect(() => { if (catalogEntry?.video_url) { player.replace(catalogEntry.video_url); player.loop = true; player.play(); } }, [catalogEntry?.video_url, player]);` — patrón estándar de expo-video para fuentes dinámicas. Documentar en el reporte cuál de los dos patrones se usó y por qué.

- [ ] **Step 3: Instalar `expo-video`**

Run: `npx expo install expo-video`
Expected: agrega `expo-video` a package.json en versión compatible con SDK 56 (`~56.x`).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml components/plans/ExerciseSheet.tsx locales/es/plans.json locales/en/plans.json
git commit -m "feat(fase-c): ExerciseSheet — video real, técnica, registro adaptativo y sparkline"
```

---

### Task 7: Cablear la ficha en el detalle del plan

**Files:**
- Modify: `app/(app)/plans/workout/[id].tsx`

**Interfaces:**
- Consumes: `ExerciseSheet` (Task 6).

- [ ] **Step 1: Hacer cada fila de ejercicio tocable y abrir la ficha**

En `app/(app)/plans/workout/[id].tsx`:

1. Imports nuevos: `import { useRef, useState } from 'react';` (ya existe `useState` — solo agregar `useRef` al import existente de React si falta) y `import type BottomSheet from '@gorhom/bottom-sheet'; import { ExerciseSheet } from '@/components/plans/ExerciseSheet';`.
2. Dentro del componente, junto a `const [expandedDay, setExpandedDay] = useState<number | null>(null);`, agregar:

```ts
  const exerciseSheetRef = useRef<BottomSheet>(null);
  const [activeExercise, setActiveExercise] = useState<{ exercise: Exercise; dayNumber: number } | null>(null);
```

3. El `Exercise` type ya tiene los campos base — agregar el campo opcional nuevo:

```ts
type Exercise = {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
  exercise_slug?: string | null;
};
```

4. En el `map` de `day.exercises` (busca `{day.exercises.map((ex, ei) => (`), envolver el `<View key={ei}>` existente con un `TouchableOpacity` (ya está importado `TouchableOpacity` en el archivo):

```tsx
                  {day.exercises.map((ex, ei) => (
                    <TouchableOpacity
                      key={ei}
                      activeOpacity={0.7}
                      onPress={() => {
                        setActiveExercise({ exercise: ex, dayNumber: day.day_number });
                        exerciseSheetRef.current?.expand();
                      }}
                    >
```

Y cerrar con `</TouchableOpacity>` en vez del `</View>` que cerraba ese bloque (mantener TODO el contenido interno intacto — solo cambia el tag contenedor de `View` a `TouchableOpacity`).

5. Justo antes del `</ScrollView>` de cierre, agregar el ícono de "play" al lado del chip de sets×reps existente (busca el `<View style={{ flexDirection: 'row', gap: 4 }}>` de los chips) — agregar un tercer elemento en esa fila:

```tsx
                          <View style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="play" size={10} color={colors.primary} style={{ marginLeft: 1 }} />
                          </View>
```

6. Después del `</ScrollView>` y antes del `</SafeAreaView>` de cierre, montar la ficha:

```tsx
      <ExerciseSheet
        ref={exerciseSheetRef}
        exercise={activeExercise?.exercise ?? null}
        workoutPlanId={plan.id}
        dayNumber={activeExercise?.dayNumber ?? 0}
      />
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/plans/workout/[id].tsx"
git commit -m "feat(fase-c): filas de ejercicio tocables abren la ficha con video y registro"
```

---

### Task 8: Verificación final + docs

**Files:**
- Modify: `forja-docs.md`

- [ ] **Step 1: Verificación estática completa**

Run: `npx tsc --noEmit && npm run check-i18n && (cd supabase/functions && deno test translate-plan/logic.test.ts delete-account/logic.test.ts)`
Expected: tsc limpio, check-i18n OK, 16/16.

- [ ] **Step 2: Documentar** — agregar al final de `forja-docs.md`:

```markdown
## Fase C del rediseño — fichas de ejercicio (MoveKit)

Catálogo `exercise_catalog` (206 ejercicios, licencia comercial MoveKit) poblado una
vez por `scripts/import-exercise-catalog.mjs` desde `assets-import/exercise-media/`
(gitignorado) hacia el bucket `exercise-media` + traducción con Haiku. `generate-plan`
recibe el catálogo completo en el prompt y marca `exercise_slug` por ejercicio SOLO
cuando hay coincidencia real (cardio/deporte sin match queda sin slug — fallback a
solo-texto en la ficha). Ficha de ejercicio (`ExerciseSheet`): video real vía
`expo-video`, técnica traducida, registro de carga adaptativo por `equipment`
(`Stepper` con snap al incremento) y sparkline de progresión (`exercise_logs`,
consultado por `exercise_slug` a través del tiempo — sobrevive a regenerar el plan).
Spec: `docs/superpowers/specs/2026-07-14-redesign-fase-c-ejercicios-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add forja-docs.md
git commit -m "docs: fichas de ejercicio de la Fase C en forja-docs"
```

- [ ] **Step 4: E2E humano en Expo Go (lo ejecuta el usuario)**

1. Detalle de un plan con exercise_slug (generado en Task 3) → tocar un ejercicio con match → video real reproduciéndose en loop, técnica traducida visible.
2. Tocar un ejercicio SIN match (o de un plan de running/fútbol si existe) → ficha sin video, con la nota de fallback.
3. Registrar 3 series de un ejercicio de barra/mancuerna → steppers en kg, botones ±2.5 y teclear un valor con snap (probar "67" → "67.5").
4. Registrar uno de peso corporal (ej. dominadas) → steppers en "kg lastre" + reps.
5. Guardar, volver a abrir el mismo ejercicio en otro momento (o el mismo plan) → tras 2+ registros históricos del mismo `exercise_slug`, aparece la sparkline.
6. Un ejercicio de calentamiento/movilidad → sin sección de registro, solo nota informativa.

No commitear nada aquí; fallos se abren como fixes puntuales.
