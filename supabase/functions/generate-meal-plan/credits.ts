export type CreditGateDecision = 'unlimited' | 'within_quota' | 'needs_credit' | 'blocked';

export function decideCreditGate(input: {
  isPremium: boolean;
  quotaExceeded: boolean;
  creditBalance: number;
}): CreditGateDecision {
  if (input.isPremium) return 'unlimited';
  if (!input.quotaExceeded) return 'within_quota';
  if (input.creditBalance > 0) return 'needs_credit';
  return 'blocked';
}
