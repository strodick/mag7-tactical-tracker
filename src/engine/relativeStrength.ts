export function calculateReturn(closeToday: number, closeLookback: number): number {
  if (closeLookback === 0) return 0;
  return closeToday / closeLookback - 1;
}

export interface RankedStock {
  ticker: string;
  return63: number;
  rank: number;
  leader: boolean;
}

export function rankStocksBy63DayReturn(
  values: Array<{ ticker: string; return63: number }>
): RankedStock[] {
  const sorted = [...values].sort((a, b) => b.return63 - a.return63);

  return sorted.map((item, index) => ({
    ticker: item.ticker,
    return63: item.return63,
    rank: index + 1,
    leader: index < 3,
  }));
}