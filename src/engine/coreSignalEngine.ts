import { CoreSignal, PositionState, StockIndicatorState } from "../types/trading";

function getDiagnostics(stock: StockIndicatorState) {
  const stochasticCrossedAbove20 =
    stock.previousStochasticK < 20 && stock.stochasticK >= 20;

  const stochasticAbove80 = stock.stochasticK >= 80;

  const volumeConfirmed =
    stock.volume >= stock.averageVolume50Day;

  const extensionFrom200Day =
    (stock.price - stock.movingAverage200Day) / stock.movingAverage200Day;

  let extensionZone: "HEALTHY" | "CAUTION" | "EXTENDED" = "HEALTHY";
  if (extensionFrom200Day > 0.25) extensionZone = "EXTENDED";
  else if (extensionFrom200Day > 0.15) extensionZone = "CAUTION";

  const tooExtendedForNewBuy = extensionFrom200Day > 0.25;

  const takeProfitZone = stochasticAbove80;

  return {
    stochasticCrossedAbove20,
    stochasticAbove80,
    volumeConfirmed,
    extensionFrom200Day,
    extensionZone,
    tooExtendedForNewBuy,
    takeProfitZone,
  };
}

export function getCoreSignal(
  stock: StockIndicatorState,
  position: PositionState
): CoreSignal {
  const d = getDiagnostics(stock);

  // Hard exit: trend broken
  if (!stock.trendUp) {
    return position.hasCorePosition ? "SELL" : "NONE";
  }

  // Take profit condition
  if (d.takeProfitZone && position.hasCorePosition) {
    return "REDUCE";
  }

  // Reduce if losing leadership or too extended
  if (
    stock.trendUp &&
    position.hasCorePosition &&
    (!stock.leader || d.extensionZone === "EXTENDED")
  ) {
    return "REDUCE";
  }

  // BUY 2X logic (core BUY signal)
  if (
    stock.trendUp &&
    stock.leader &&
    d.stochasticCrossedAbove20 &&
    d.volumeConfirmed &&
    !d.tooExtendedForNewBuy &&
    !position.hasCorePosition
  ) {
    return "BUY";
  }

  // HOLD core position
  if (stock.trendUp && position.hasCorePosition) {
    return "HOLD";
  }

  return "NONE";
}

export function getTargetCoreAllocation(rankQualifiedCount: number): number {
  if (rankQualifiedCount <= 0) return 0;
  return 1 / rankQualifiedCount;
}
