import { CoreSignal, PositionState, StockIndicatorState } from "../types/trading";

const STOCHASTIC_BUY_LEVEL = 20;
const STOCHASTIC_BUY_MAX = 55;
const STOCHASTIC_TAKE_PROFIT_LEVEL = 80;
const MIN_VOLUME_CONFIRMATION_RATIO = 1.05;
const CAUTION_EXTENSION = 0.12;
const MAX_BUY_EXTENSION = 0.15;
const EXTENDED_EXTENSION = 0.20;
const MAX_BUY_MOMENTUM_RANK = 3;

function getDiagnostics(stock: StockIndicatorState) {
  const stochasticCrossedAbove20 =
    stock.previousStochasticK < STOCHASTIC_BUY_LEVEL &&
    stock.stochasticK >= STOCHASTIC_BUY_LEVEL;

  const stochasticInBuyZone =
    stock.stochasticK >= STOCHASTIC_BUY_LEVEL &&
    stock.stochasticK <= STOCHASTIC_BUY_MAX;

  const stochasticRising = stock.stochasticK > stock.previousStochasticK;

  const stochasticAbove80 = stock.stochasticK >= STOCHASTIC_TAKE_PROFIT_LEVEL;

  const volumeRatio =
    stock.averageVolume50Day > 0 ? stock.volume / stock.averageVolume50Day : 0;

  const volumeConfirmed = volumeRatio >= MIN_VOLUME_CONFIRMATION_RATIO;

  const extensionFrom200Day =
    stock.movingAverage200Day > 0
      ? (stock.price - stock.movingAverage200Day) / stock.movingAverage200Day
      : 0;

  let extensionZone: "HEALTHY" | "CAUTION" | "EXTENDED" = "HEALTHY";
  if (extensionFrom200Day > EXTENDED_EXTENSION) extensionZone = "EXTENDED";
  else if (extensionFrom200Day > CAUTION_EXTENSION) extensionZone = "CAUTION";

  const tooExtendedForNewBuy = extensionFrom200Day > MAX_BUY_EXTENSION;

  const leadershipConfirmed =
    stock.leader &&
    (stock.momentumRank == null || stock.momentumRank <= MAX_BUY_MOMENTUM_RANK);

  const takeProfitZone =
    stochasticAbove80 || extensionZone === "EXTENDED";

  const buySetupConfirmed =
    stock.trendUp &&
    leadershipConfirmed &&
    stochasticCrossedAbove20 &&
    stochasticInBuyZone &&
    stochasticRising &&
    volumeConfirmed &&
    !tooExtendedForNewBuy;

  return {
    stochasticCrossedAbove20,
    stochasticInBuyZone,
    stochasticRising,
    stochasticAbove80,
    volumeRatio,
    volumeConfirmed,
    extensionFrom200Day,
    extensionZone,
    tooExtendedForNewBuy,
    leadershipConfirmed,
    takeProfitZone,
    buySetupConfirmed,
  };
}

export function getCoreSignal(
  stock: StockIndicatorState,
  position: PositionState
): CoreSignal {
  const d = getDiagnostics(stock);

  // Hard exit: major trend broke.
  if (!stock.trendUp) {
    return position.hasCorePosition ? "SELL" : "NONE";
  }

  // Take profits sooner when risk is elevated.
  if (position.hasCorePosition && d.takeProfitZone) {
    return "REDUCE";
  }

  // Reduce if the stock remains in trend but loses leadership.
  if (position.hasCorePosition && !d.leadershipConfirmed) {
    return "REDUCE";
  }

  // Tightened BUY logic.
  if (d.buySetupConfirmed && !position.hasCorePosition) {
    return "BUY";
  }

  // Hold existing core position when trend remains intact.
  if (position.hasCorePosition) {
    return "HOLD";
  }

  return "NONE";
}

export function getTargetCoreAllocation(rankQualifiedCount: number): number {
  if (rankQualifiedCount <= 0) return 0;
  return 1 / rankQualifiedCount;
}
