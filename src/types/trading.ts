export type CoreSignal = "BUY" | "HOLD" | "SELL" | "REDUCE" | "NONE";

export type LeverageSignal = "LEVERAGE_ON" | "LEVERAGE_HOLD" | "LEVERAGE_OFF" | "NO_LEVERAGE";

export type PositionState = {
  hasCorePosition: boolean;
  hasLeveragedPosition?: boolean;

  // Legacy strategy-engine compatibility fields
  coreAllocationPct?: number;
  leverageAllocationPct?: number;
  hasLeverageOverlay?: boolean;
  leverageEntryPrice?: number | null;
  leverageEntryDate?: string | null;
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
  stochasticRising?: boolean;

  // Volume confirmation
  volume: number;
  averageVolume50Day: number;

  // Price and extension
  price: number;
  close?: number;
  movingAverage200Day: number;
  inPullbackZone?: boolean;
  pullbackPctFrom60dHigh?: number;
};

export type StockDecision = {
  ticker?: string;
  coreSignal: CoreSignal;
  leverageSignal: LeverageSignal;
  targetCoreAllocationPct: number;
  targetLeverageAllocationPct: number;
  notes: string[];
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
