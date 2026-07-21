export type ModificationCreditGateDecision = 'unlimited' | 'within_quota' | 'needs_credit' | 'blocked';

export function decideModificationCreditGate(input: {
  isPremium: boolean;
  modificationsCount: number;
  freeLimit: number;
  creditBalance: number;
}): ModificationCreditGateDecision {
  if (input.isPremium) return 'unlimited';
  if (input.modificationsCount < input.freeLimit) return 'within_quota';
  if (input.creditBalance > 0) return 'needs_credit';
  return 'blocked';
}
