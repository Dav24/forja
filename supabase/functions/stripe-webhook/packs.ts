export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  pack_3: 3,
};

export function creditAmountForPack(packId: string | undefined | null): number | null {
  if (!packId) return null;
  return CREDIT_PACK_AMOUNTS[packId] ?? null;
}
