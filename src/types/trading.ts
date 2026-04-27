export type CoreSignal = "BUY" | "HOLD" | "SELL" | "REDUCE" | "NONE";

export type PositionState = {
  hasCorePosition: boolean;
  hasLeveragedPosition?: boolean;
};

export type ExtensionZone = "HEALTHY" | "CAUTION" | "EXTENDED";

export type StockIndicatorState = {
  ticker?: string;

  // Major trend filter
  trendUp: boolean;
  priceAbove200Day?: boolean;
  ma200Rising?: boolean;

  // Relative strength leadership
  leader: boolean;
  momentumRank?: number;

  // Slow stochastic wave, using K period 5, smoothing 3, D period 1
  stochasticK: number;
  previousStochasticK: number;

  // Volume confirmation
  volume: number;
  averageVolume50Day: number;

  // Extension from 200-day moving average
  price: number;
  movingAverage200Day: number;
};

export type SignalDiagnostics = {
  stochasticCrossedAbove20: boolean;
  stochasticAbove80: boolean;
  volumeConfirmed: boolean;
  extensionFrom200Day: number;
  extensionZone: ExtensionZone;
  tooExtendedForNewBuy: boolean;
  takeProfitZone: boolean;
};
