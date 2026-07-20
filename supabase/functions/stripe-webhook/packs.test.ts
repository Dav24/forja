import { assertEquals } from 'jsr:@std/assert';
import { creditAmountForPack } from './packs.ts';

Deno.test('creditAmountForPack devuelve la cantidad para un pack conocido', () => {
  assertEquals(creditAmountForPack('pack_3'), 3);
});

Deno.test('creditAmountForPack devuelve null para un pack desconocido', () => {
  assertEquals(creditAmountForPack('pack_inventado'), null);
});

Deno.test('creditAmountForPack devuelve null si no viene packId', () => {
  assertEquals(creditAmountForPack(undefined), null);
  assertEquals(creditAmountForPack(null), null);
});
