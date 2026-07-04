import { assertEquals } from 'jsr:@std/assert';
import { mapStripeStatus } from './status.ts';

Deno.test('mapea estados de Stripe al CHECK de la tabla subscriptions', () => {
  assertEquals(mapStripeStatus('active'), 'active');
  assertEquals(mapStripeStatus('trialing'), 'trialing');
  assertEquals(mapStripeStatus('past_due'), 'past_due');
  assertEquals(mapStripeStatus('unpaid'), 'past_due');
  assertEquals(mapStripeStatus('canceled'), 'canceled');
  assertEquals(mapStripeStatus('incomplete'), 'incomplete');
  assertEquals(mapStripeStatus('incomplete_expired'), 'incomplete');
  assertEquals(mapStripeStatus('algo_nuevo_de_stripe'), 'incomplete');
});
