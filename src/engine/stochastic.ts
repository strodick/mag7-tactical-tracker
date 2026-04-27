export function calculateCloseBasedStochasticK(closes: number[], period = 14): number | null {
  if (closes.length < period) return null;

  const window = closes.slice(closes.length - period);
  const lowest = Math.min(...window);
  const highest = Math.max(...window);
  const latest = closes[closes.length - 1];

  if (highest === lowest) return 50;
  return ((latest - lowest) / (highest - lowest)) * 100;
}

export function isStochasticRising(currentK: number | null, priorK: number | null): boolean {
  if (currentK == null || priorK == null) return false;
  return currentK > priorK;
}