export interface DeleteDeps {
  getSubscription(uid: string): Promise<{ stripe_subscription_id: string | null; status: string } | null>;
  cancelStripeSubscription(subscriptionId: string): Promise<void>;
  removeAvatar(uid: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}

const CANCELABLE = ['active', 'trialing', 'past_due', 'incomplete'];

// Orden a prueba de fallos: Stripe → avatar → usuario.
// Si Stripe falla se aborta ANTES de tocar al usuario (nunca cuenta a medio borrar
// y nunca un borrado que deje a Stripe cobrando a un fantasma).
export async function deleteAccount(deps: DeleteDeps, uid: string): Promise<void> {
  const sub = await deps.getSubscription(uid);
  if (sub?.stripe_subscription_id && CANCELABLE.includes(sub.status)) {
    await deps.cancelStripeSubscription(sub.stripe_subscription_id);
  }
  await deps.removeAvatar(uid);
  await deps.deleteUser(uid);
}
