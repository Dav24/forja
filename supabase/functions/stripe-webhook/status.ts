// El CHECK de subscriptions solo admite estos 5 valores (migración 0001)
type DbStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export function mapStripeStatus(s: string): DbStatus {
  switch (s) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    default:
      return 'incomplete';
  }
}
