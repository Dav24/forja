#!/usr/bin/env node
// Verifica: (1) paridad de claves es<->en, (2) claves t() usadas que no existen,
// (3) copy en español sin migrar (heurística: acentos/¿¡ en código de UI).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no .pathname: la ruta del repo tiene espacios ("Physis Labs")
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NAMESPACES = ['common', 'auth', 'onboarding', 'home', 'chat', 'plans', 'progress', 'profile', 'settings'];
const SRC_DIRS = ['app', 'components', 'hooks', 'constants', 'lib'];
const allowlist = JSON.parse(readFileSync(join(ROOT, 'scripts/check-i18n-allowlist.json'), 'utf8'));

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? flatten(v, key) : [key];
  });
}

function loadNs(lang) {
  const out = {};
  for (const ns of NAMESPACES) {
    out[ns] = new Set(flatten(JSON.parse(readFileSync(join(ROOT, `locales/${lang}/${ns}.json`), 'utf8'))));
  }
  return out;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|ts)$/.test(name) && !name.endsWith('.d.ts')) yield p;
  }
}

const es = loadNs('es');
const en = loadNs('en');
const errors = [];

// (1) Paridad
for (const ns of NAMESPACES) {
  for (const k of es[ns]) if (!en[ns].has(k)) errors.push(`[paridad] en/${ns}.json falta: ${k}`);
  for (const k of en[ns]) if (!es[ns].has(k)) errors.push(`[paridad] es/${ns}.json falta: ${k}`);
}

// (2) Claves usadas vs definidas
const KEY_RE = /\bt\(\s*['"]([A-Za-z0-9_.:-]+)['"]/g;
const LABELKEY_RE = /\b(?:labelKey|titleKey|descriptionKey)\s*:\s*['"]([A-Za-z0-9_.:-]+)['"]/g;
const files = SRC_DIRS.flatMap((d) => [...walk(join(ROOT, d))]);
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  for (const re of [KEY_RE, LABELKEY_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const raw = m[1];
      if (raw.includes(':')) {
        const [ns, key] = [raw.slice(0, raw.indexOf(':')), raw.slice(raw.indexOf(':') + 1)];
        if (!NAMESPACES.includes(ns)) { errors.push(`[clave] ${rel}: namespace desconocido '${ns}' en '${raw}'`); continue; }
        if (!es[ns].has(key)) errors.push(`[clave] ${rel}: '${raw}' no existe en es/${ns}.json`);
      } else if (!NAMESPACES.some((ns) => es[ns].has(raw))) {
        errors.push(`[clave] ${rel}: '${raw}' no existe en ningún namespace`);
      }
    }
  }
}

// (3) Copy español sin migrar (solo UI: app/ y components/)
const SPANISH_RE = /['"`>][^'"`<\n]*[áéíóúñÁÉÍÓÚÑ¿¡][^'"`<\n]*/;
for (const file of files) {
  const rel = relative(ROOT, file);
  if (!/^(app|components)\//.test(rel)) continue;
  if (allowlist.files.includes(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (allowlist.patterns.some((p) => line.includes(p))) return;
    if (SPANISH_RE.test(line)) errors.push(`[copy] ${rel}:${i + 1}: posible español sin migrar: ${t.slice(0, 80)}`);
  });
}

if (errors.length) {
  console.error(`check-i18n: ${errors.length} problema(s):\n` + errors.join('\n'));
  process.exit(1);
}
console.log('check-i18n: OK');
