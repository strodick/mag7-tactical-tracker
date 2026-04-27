export function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

export function isTrendUp(close: number, ma200: number | null): boolean {
  if (ma200 == null) return false;
  return close > ma200;
}