export function calculate60DayHigh(closes: number[]): number | null {
  if (closes.length < 60) return null;
  return Math.max(...closes.slice(closes.length - 60));
}

export function calculatePullbackPctFromHigh(close: number, high60: number | null): number | null {
  if (high60 == null || high60 === 0) return null;
  return (high60 - close) / high60;
}

export function isInPullbackZone(pullbackPct: number | null): boolean {
  if (pullbackPct == null) return false;
  return pullbackPct >= 0.05 && pullbackPct <= 0.12;
}