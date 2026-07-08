import { assertEquals, assertRejects } from 'jsr:@std/assert';
import { deleteAccount, type DeleteDeps } from './logic.ts';

function makeDeps(overrides: Partial<DeleteDeps> = {}) {
  const calls: string[] = [];
  const deps: DeleteDeps = {
    getSubscription: async () => null,
    cancelStripeSubscription: async () => { calls.push('cancel'); },
    removeAvatar: async () => { calls.push('avatar'); },
    deleteUser: async () => { calls.push('delete'); },
    ...overrides,
  };
  return { deps, calls };
}

Deno.test('sin suscripción: borra avatar y usuario, no llama a Stripe', async () => {
  const { deps, calls } = makeDeps();
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls, ['avatar', 'delete']);
});

Deno.test('con suscripción activa en Stripe: cancela ANTES de borrar', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: 'sub_123', status: 'active' }),
  });
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls, ['cancel', 'avatar', 'delete']);
});

Deno.test('suscripción cancelada sin id activo: no llama a Stripe', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: null, status: 'canceled' }),
  });
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls, ['avatar', 'delete']);
});

Deno.test('si Stripe falla, NO borra al usuario', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: 'sub_123', status: 'active' }),
    cancelStripeSubscription: async () => { throw new Error('stripe down'); },
  });
  await assertRejects(() => deleteAccount(deps, 'uid-1'));
  assertEquals(calls.includes('delete'), false);
});

Deno.test('status past_due también cancela en Stripe', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: 'sub_9', status: 'past_due' }),
  });
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls[0], 'cancel');
});
