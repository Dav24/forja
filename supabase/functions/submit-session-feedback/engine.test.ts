import { assertEquals } from 'jsr:@std/assert';
import {
  classifyDirection,
  hasSustainedPattern,
  computeDeterministicAdjustment,
} from './engine.ts';

Deno.test('classifyDirection agrupa muy_facil/facil como facil', () => {
  assertEquals(classifyDirection('muy_facil'), 'facil');
  assertEquals(classifyDirection('facil'), 'facil');
});

Deno.test('classifyDirection agrupa dificil/muy_dificil como dificil', () => {
  assertEquals(classifyDirection('dificil'), 'dificil');
  assertEquals(classifyDirection('muy_dificil'), 'dificil');
});

Deno.test('classifyDirection trata justo como neutral', () => {
  assertEquals(classifyDirection('justo'), 'neutral');
});

Deno.test('hasSustainedPattern requiere al menos 3 sesiones', () => {
  assertEquals(hasSustainedPattern(['facil', 'facil']), null);
});

Deno.test('hasSustainedPattern detecta 3 sesiones fáciles seguidas', () => {
  assertEquals(hasSustainedPattern(['facil', 'muy_facil', 'facil']), 'facil');
});

Deno.test('hasSustainedPattern se rompe si aparece justo', () => {
  assertEquals(hasSustainedPattern(['facil', 'justo', 'facil']), null);
});

Deno.test('hasSustainedPattern se rompe con direcciones mixtas', () => {
  assertEquals(hasSustainedPattern(['facil', 'dificil', 'facil']), null);
});

Deno.test('computeDeterministicAdjustment sube peso 5% en direccion facil', () => {
  const result = computeDeterministicAdjustment('facil', { weightKg: 20, reps: 10 });
  assertEquals(result, { field: 'weight_kg', before: 20, after: 21 });
});

Deno.test('computeDeterministicAdjustment baja peso 5% en direccion dificil', () => {
  const result = computeDeterministicAdjustment('dificil', { weightKg: 20, reps: 10 });
  assertEquals(result, { field: 'weight_kg', before: 20, after: 19 });
});

Deno.test('computeDeterministicAdjustment usa reps cuando no hay peso (bodyweight)', () => {
  const up = computeDeterministicAdjustment('facil', { weightKg: null, reps: 10 });
  assertEquals(up, { field: 'reps', before: 10, after: 11 });
  const down = computeDeterministicAdjustment('dificil', { weightKg: null, reps: 10 });
  assertEquals(down, { field: 'reps', before: 10, after: 9 });
});

Deno.test('computeDeterministicAdjustment no baja reps de 1', () => {
  const result = computeDeterministicAdjustment('dificil', { weightKg: null, reps: 1 });
  assertEquals(result, { field: 'reps', before: 1, after: 1 });
});
