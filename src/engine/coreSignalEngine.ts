import { CoreSignal, PositionState, StockIndicatorState } from "../types/trading";

export function getCoreSignal(
  stock: StockIndicatorState,
  position: PositionState
): CoreSignal {
  if (!stock.trendUp && position.hasCorePosition) {
    return "SELL";
  }

  if (!stock.trendUp && !position.hasCorePosition) {
    return "NONE";
  }

  if (stock.trendUp && stock.leader && !position.hasCorePosition) {
    return "BUY";
  }

  if (stock.trendUp && stock.leader && position.hasCorePosition) {
    return "HOLD";
  }

  if (stock.trendUp && !stock.leader && position.hasCorePosition) {
    return "REDUCE";
  }

  return "NONE";
}

export function getTargetCoreAllocation(rankQualifiedCount: number): number {
  if (rankQualifiedCount <= 0) return 0;
  return 1 / rankQualifiedCount;
}