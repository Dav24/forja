// supabase/functions/generate-plan/credits.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { decideCreditGate } from './credits.ts';

Deno.test('premium: siempre unlimited sin importar cuota o saldo', () => {
  assertEquals(decideCreditGate({ isPremium: true, quotaExceeded: true, creditBalance: 0 }), 'unlimited');
  assertEquals(decideCreditGate({ isPremium: true, quotaExceeded: false, creditBalance: 0 }), 'unlimited');
});

Deno.test('free dentro de cuota: within_quota, no toca créditos', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: false, creditBalance: 0 }), 'within_quota');
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: false, creditBalance: 5 }), 'within_quota');
});

Deno.test('free sobre cuota con saldo: needs_credit', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: true, creditBalance: 1 }), 'needs_credit');
});

Deno.test('free sobre cuota sin saldo: blocked', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: true, creditBalance: 0 }), 'blocked');
});
