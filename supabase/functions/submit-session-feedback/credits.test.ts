import { assertEquals } from 'jsr:@std/assert';
import { decideModificationCreditGate } from './credits.ts';

Deno.test('premium siempre es unlimited', () => {
  const result = decideModificationCreditGate({
    isPremium: true, modificationsCount: 99, freeLimit: 3, creditBalance: 0,
  });
  assertEquals(result, 'unlimited');
});

Deno.test('free dentro del tope es within_quota', () => {
  const result = decideModificationCreditGate({
    isPremium: false, modificationsCount: 2, freeLimit: 3, creditBalance: 0,
  });
  assertEquals(result, 'within_quota');
});

Deno.test('free en el tope con saldo es needs_credit', () => {
  const result = decideModificationCreditGate({
    isPremium: false, modificationsCount: 3, freeLimit: 3, creditBalance: 2,
  });
  assertEquals(result, 'needs_credit');
});

Deno.test('free en el tope sin saldo es blocked', () => {
  const result = decideModificationCreditGate({
    isPremium: false, modificationsCount: 3, freeLimit: 3, creditBalance: 0,
  });
  assertEquals(result, 'blocked');
});
