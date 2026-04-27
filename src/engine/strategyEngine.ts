export type Ticker =
  | "AAPL"
  | "MSFT"
  | "GOOGL"
  | "AMZN"
  | "NVDA"
  | "META"
  | "TSLA"
  | "SPY";

export type CoreSignal = "BUY" | "HOLD" | "REDUCE" | "SELL" | "NONE";
export type LeverageSignal =
  | "LEVERAGE_ON"
  | "LEVERAGE_OFF"
  | "LEVERAGE_HOLD"
  | "NO_LEVERAGE";

export interface PriceBar {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface PositionState {
  ticker: Exclude<Ticker, "SPY">;
  hasCorePosition: boolean;
  coreAllocationPct: number; // 0..1
  hasLeverageOverlay: boolean;
  leverageAllocationPct: number; // 0..1
  leverageEntryPrice?: number;
  leverageEntryDate?: string;
}

export interface StockIndicatorState {
  ticker: Exclude<Ticker, "SPY">;
  date: string;
  close: number;
  ma200: number | null;
  trendUp: boolean;
  return63: number | null;
  rank: number;
  leader: boolean;
  high60: number | null;
  pullbackPctFrom60dHigh: number | null;
  inPullbackZone: boolean;
  stochasticK: number | null;
  priorStochasticK: number | null;
  stochasticRising: boolean;
  outperformingSPY63: boolean;
}

export interface StockDecision {
  ticker: Exclude<Ticker, "SPY">;
  date: string;
  coreSignal: CoreSignal;
  leverageSignal: LeverageSignal;
  targetCoreAllocationPct: number;
  targetLeverageAllocationPct: number;
  notes: string[];
  indicatorState: StockIndicatorState;
}

export interface StrategyConfig {
  maPeriod: number;
  rsLookbackDays: number;
  highLookbackDays: number;
  stochasticPeriod: number;
  leaderCount: number;
  pullbackMinPct: number;
  pullbackMaxPct: number;
  leverageStochasticMax: number;
  leverageExitStochastic: number;
  leverageDefaultPct: number;
  leverageStrongPct: number;
  leverageStrongPullbackPct: number;
  leverageStopLossPct: number;
  leverageMaxHoldDays: number;
  reduceFractionWhenLeaderLost: number;
  useSpyAsHardGate: boolean;
  blockLeverageWhenSpyWeak: boolean;
}

export interface PortfolioSnapshot {
  date: string;
  decisions: StockDecision[];
  qualifiedLeaderCount: number;
  portfolioOutperformingSPYCount: number;
}

export const DEFAULT_CONFIG: StrategyConfig = {
  maPeriod: 200,
  rsLookbackDays: 63,
  highLookbackDays: 60,
  stochasticPeriod: 14,
  leaderCount: 3,
  pullbackMinPct: 0.05,
  pullbackMaxPct: 0.12,
  leverageStochasticMax: 25,
  leverageExitStochastic: 80,
  leverageDefaultPct: 0.2,
  leverageStrongPct: 0.3,
  leverageStrongPullbackPct: 0.08,
  leverageStopLossPct: 0.05,
  leverageMaxHoldDays: 12,
  reduceFractionWhenLeaderLost: 0.5,
  useSpyAsHardGate: false,
  blockLeverageWhenSpyWeak: false,
};

const MAG7_TICKERS: Exclude<Ticker, "SPY">[] = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
];

function assertSortedBars(bars: PriceBar[], ticker: string): void {
  for (let i = 1; i < bars.length; i += 1) {
    if (bars[i].date < bars[i - 1].date) {
      throw new Error(`${ticker} price bars must be sorted ascending by date.`);
    }
  }
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lastN(values: number[], n: number): number[] {
  return values.slice(Math.max(0, values.length - n));
}

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return average(lastN(closes, period));
}

function calcReturn(closes: number[], lookbackDays: number): number | null {
  if (closes.length <= lookbackDays) return null;
  const latest = closes[closes.length - 1];
  const prior = closes[closes.length - 1 - lookbackDays];
  if (!Number.isFinite(latest) || !Number.isFinite(prior) || prior === 0) return null;
  return latest / prior - 1;
}

function calcRollingHigh(closes: number[], lookbackDays: number): number | null {
  if (closes.length < lookbackDays) return null;
  return Math.max(...lastN(closes, lookbackDays));
}

function calcPullbackPct(close: number, high: number | null): number | null {
  if (high == null || high === 0) return null;
  return (high - close) / high;
}

function calcCloseBasedStochasticK(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const window = lastN(closes, period);
  const low = Math.min(...window);
  const high = Math.max(...window);
  const latest = closes[closes.length - 1];
  if (high === low) return 50;
  return ((latest - low) / (high - low)) * 100;
}

function diffInDays(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate + "T00:00:00Z").getTime();
  const end = new Date(endDate + "T00:00:00Z").getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

function roundPct(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 10000) / 10000;
}

function buildRankMap(
  states: Array<Pick<StockIndicatorState, "ticker" | "return63">>,
  leaderCount: number
): Map<Exclude<Ticker, "SPY">, { rank: number; leader: boolean }> {
  const ranked = [...states].sort((a, b) => {
    const av = a.return63 ?? Number.NEGATIVE_INFINITY;
    const bv = b.return63 ?? Number.NEGATIVE_INFINITY;
    return bv - av;
  });

  const map = new Map<Exclude<Ticker, "SPY">, { rank: number; leader: boolean }>();
  ranked.forEach((item, index) => {
    map.set(item.ticker, {
      rank: index + 1,
      leader: index < leaderCount && item.return63 != null,
    });
  });
  return map;
}

export function createEmptyPositions(): Record<Exclude<Ticker, "SPY">, PositionState> {
  return {
    AAPL: {
      ticker: "AAPL",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
    MSFT: {
      ticker: "MSFT",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
    GOOGL: {
      ticker: "GOOGL",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
    AMZN: {
      ticker: "AMZN",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
    NVDA: {
      ticker: "NVDA",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
    META: {
      ticker: "META",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
    TSLA: {
      ticker: "TSLA",
      hasCorePosition: false,
      coreAllocationPct: 0,
      hasLeverageOverlay: false,
      leverageAllocationPct: 0,
    },
  };
}

export function computeIndicatorStatesForDate(params: {
  priceHistory: Record<Ticker, PriceBar[]>;
  asOfDate?: string;
  config?: Partial<StrategyConfig>;
}): { stockStates: StockIndicatorState[]; spyTrendUp: boolean; spyReturn63: number | null } {
  const config: StrategyConfig = { ...DEFAULT_CONFIG, ...params.config };
  const { priceHistory, asOfDate } = params;

  MAG7_TICKERS.forEach((ticker) => assertSortedBars(priceHistory[ticker] ?? [], ticker));
  assertSortedBars(priceHistory.SPY ?? [], "SPY");

  const spyBars = priceHistory.SPY ?? [];
  const filteredSpyBars = asOfDate
    ? spyBars.filter((bar) => bar.date <= asOfDate)
    : spyBars;
  const spyCloses = filteredSpyBars.map((bar) => bar.close);
  const spyMA = calcSMA(spyCloses, config.maPeriod);
  const spyTrendUp = spyMA != null ? spyCloses[spyCloses.length - 1] > spyMA : false;
  const spyReturn63 = calcReturn(spyCloses, config.rsLookbackDays);

  const provisionalStates = MAG7_TICKERS.map((ticker) => {
    const bars = priceHistory[ticker] ?? [];
    const filteredBars = asOfDate ? bars.filter((bar) => bar.date <= asOfDate) : bars;
    if (!filteredBars.length) {
      throw new Error(`No price data found for ${ticker}${asOfDate ? ` on or before ${asOfDate}` : ""}.`);
    }

    const closes = filteredBars.map((bar) => bar.close);
    const close = closes[closes.length - 1];
    const date = filteredBars[filteredBars.length - 1].date;
    const ma200 = calcSMA(closes, config.maPeriod);
    const return63 = calcReturn(closes, config.rsLookbackDays);
    const high60 = calcRollingHigh(closes, config.highLookbackDays);
    const pullbackPctFrom60dHigh = calcPullbackPct(close, high60);
    const stochasticK = calcCloseBasedStochasticK(closes, config.stochasticPeriod);
    const priorStochasticK = calcCloseBasedStochasticK(closes.slice(0, -1), config.stochasticPeriod);

    return {
      ticker,
      date,
      close,
      ma200,
      trendUp: ma200 != null ? close > ma200 : false,
      return63,
      rank: 999,
      leader: false,
      high60,
      pullbackPctFrom60dHigh,
      inPullbackZone:
        pullbackPctFrom60dHigh != null &&
        pullbackPctFrom60dHigh >= config.pullbackMinPct &&
        pullbackPctFrom60dHigh <= config.pullbackMaxPct,
      stochasticK,
      priorStochasticK,
      stochasticRising:
        stochasticK != null && priorStochasticK != null ? stochasticK > priorStochasticK : false,
      outperformingSPY63:
        return63 != null && spyReturn63 != null ? return63 > spyReturn63 : false,
    } as StockIndicatorState;
  });

  const rankMap = buildRankMap(
    provisionalStates.map((state) => ({ ticker: state.ticker, return63: state.return63 })),
    config.leaderCount
  );

  const stockStates = provisionalStates.map((state) => {
    const rankInfo = rankMap.get(state.ticker);
    return {
      ...state,
      rank: rankInfo?.rank ?? 999,
      leader: rankInfo?.leader ?? false,
      return63: roundPct(state.return63),
      pullbackPctFrom60dHigh: roundPct(state.pullbackPctFrom60dHigh),
      stochasticK: state.stochasticK != null ? Math.round(state.stochasticK * 100) / 100 : null,
      priorStochasticK:
        state.priorStochasticK != null ? Math.round(state.priorStochasticK * 100) / 100 : null,
    };
  });

  return { stockStates, spyTrendUp, spyReturn63: roundPct(spyReturn63) };
}

export function getQualifiedLeaderCount(stockStates: StockIndicatorState[]): number {
  return stockStates.filter((state) => state.trendUp && state.leader).length;
}

export function getCoreSignal(
  stock: StockIndicatorState,
  position: PositionState,
  qualifiedLeaderCount: number,
  config: StrategyConfig,
  spyTrendUp: boolean
): { signal: CoreSignal; targetAllocationPct: number; notes: string[] } {
  const notes: string[] = [];
  const targetEqualWeight = qualifiedLeaderCount > 0 ? 1 / qualifiedLeaderCount : 0;

  if (config.useSpyAsHardGate && !spyTrendUp) {
    if (position.hasCorePosition) {
      notes.push("SPY hard gate is on and SPY trend is weak.");
      return { signal: "SELL", targetAllocationPct: 0, notes };
    }
    return { signal: "NONE", targetAllocationPct: 0, notes };
  }

  if (!stock.trendUp && position.hasCorePosition) {
    notes.push("Stock closed below its 200-day moving average.");
    return { signal: "SELL", targetAllocationPct: 0, notes };
  }

  if (!stock.trendUp && !position.hasCorePosition) {
    notes.push("No core position because trend is below the 200-day moving average.");
    return { signal: "NONE", targetAllocationPct: 0, notes };
  }

  if (stock.trendUp && stock.leader && !position.hasCorePosition) {
    notes.push("Trend is up and stock ranks inside the Mag 7 leadership group.");
    return { signal: "BUY", targetAllocationPct: targetEqualWeight, notes };
  }

  if (stock.trendUp && stock.leader && position.hasCorePosition) {
    notes.push("Core position remains valid.");
    return { signal: "HOLD", targetAllocationPct: targetEqualWeight, notes };
  }

  if (stock.trendUp && !stock.leader && position.hasCorePosition) {
    notes.push("Trend is still up, but the stock lost leadership rank.");
    return {
      signal: "REDUCE",
      targetAllocationPct: Math.max(position.coreAllocationPct * (1 - config.reduceFractionWhenLeaderLost), 0),
      notes,
    };
  }

  notes.push("Trend is up but stock is not currently in the leadership group.");
  return { signal: "NONE", targetAllocationPct: 0, notes };
}

export function getLeverageSignal(
  stock: StockIndicatorState,
  position: PositionState,
  currentDate: string,
  config: StrategyConfig,
  spyTrendUp: boolean
): { signal: LeverageSignal; targetAllocationPct: number; notes: string[] } {
  const notes: string[] = [];

  const blockForSpy = config.blockLeverageWhenSpyWeak && !spyTrendUp;
  const leverageOnCondition =
    position.hasCorePosition &&
    stock.trendUp &&
    stock.leader &&
    stock.inPullbackZone &&
    stock.stochasticK != null &&
    stock.stochasticK < config.leverageStochasticMax &&
    stock.stochasticRising &&
    !position.hasLeverageOverlay &&
    !blockForSpy;

  const overboughtExit = stock.stochasticK != null && stock.stochasticK > config.leverageExitStochastic;
  const lostLeadership = !stock.leader;
  const trendBreak = !stock.trendUp;
  const stopLossTriggered =
    position.leverageEntryPrice != null &&
    stock.close <= position.leverageEntryPrice * (1 - config.leverageStopLossPct);
  const timedExit =
    position.leverageEntryDate != null && diffInDays(position.leverageEntryDate, currentDate) >= config.leverageMaxHoldDays;
  const shouldTurnOff =
    position.hasLeverageOverlay &&
    (overboughtExit || lostLeadership || trendBreak || stopLossTriggered || timedExit || blockForSpy);

  if (shouldTurnOff) {
    if (overboughtExit) notes.push("Leverage removed because stochastic is overbought.");
    if (lostLeadership) notes.push("Leverage removed because the stock lost leadership rank.");
    if (trendBreak) notes.push("Leverage removed because trend broke below the 200-day moving average.");
    if (stopLossTriggered) notes.push("Leverage removed due to the overlay stop-loss rule.");
    if (timedExit) notes.push("Leverage removed due to max hold duration.");
    if (blockForSpy) notes.push("Leverage removed because SPY risk filter blocked overlay exposure.");
    return { signal: "LEVERAGE_OFF", targetAllocationPct: 0, notes };
  }

  if (leverageOnCondition) {
    const targetAllocationPct =
      (stock.pullbackPctFrom60dHigh ?? 0) >= config.leverageStrongPullbackPct
        ? config.leverageStrongPct
        : config.leverageDefaultPct;
    notes.push("Leverage overlay activated on pullback plus momentum turn.");
    return { signal: "LEVERAGE_ON", targetAllocationPct, notes };
  }

  if (position.hasLeverageOverlay) {
    notes.push("Leverage overlay remains active.");
    return {
      signal: "LEVERAGE_HOLD",
      targetAllocationPct: position.leverageAllocationPct,
      notes,
    };
  }

  if (blockForSpy) {
    notes.push("No leverage because SPY overlay risk filter is weak.");
  }
  return { signal: "NO_LEVERAGE", targetAllocationPct: 0, notes };
}

export function buildStockDecision(params: {
  stock: StockIndicatorState;
  position: PositionState;
  qualifiedLeaderCount: number;
  spyTrendUp: boolean;
  config?: Partial<StrategyConfig>;
}): StockDecision {
  const config: StrategyConfig = { ...DEFAULT_CONFIG, ...params.config };
  const { stock, position, qualifiedLeaderCount, spyTrendUp } = params;

  const core = getCoreSignal(stock, position, qualifiedLeaderCount, config, spyTrendUp);
  const leverage = getLeverageSignal(stock, position, stock.date, config, spyTrendUp);

  let targetLeverageAllocationPct = leverage.targetAllocationPct;
  if (core.signal === "SELL") {
    targetLeverageAllocationPct = 0;
  }

  return {
    ticker: stock.ticker,
    date: stock.date,
    coreSignal: core.signal,
    leverageSignal: leverage.signal,
    targetCoreAllocationPct: core.targetAllocationPct,
    targetLeverageAllocationPct,
    notes: [...core.notes, ...leverage.notes],
    indicatorState: stock,
  };
}

export function applyDecisionToPosition(
  position: PositionState,
  decision: StockDecision,
  currentClose: number,
  currentDate: string
): PositionState {
  const next: PositionState = {
    ...position,
    hasCorePosition: decision.targetCoreAllocationPct > 0,
    coreAllocationPct: decision.targetCoreAllocationPct,
    hasLeverageOverlay: decision.targetLeverageAllocationPct > 0,
    leverageAllocationPct: decision.targetLeverageAllocationPct,
  };

  if (decision.leverageSignal === "LEVERAGE_ON") {
    next.leverageEntryPrice = currentClose;
    next.leverageEntryDate = currentDate;
  }

  if (decision.leverageSignal === "LEVERAGE_OFF" || decision.coreSignal === "SELL") {
    next.hasLeverageOverlay = false;
    next.leverageAllocationPct = 0;
    next.leverageEntryPrice = undefined;
    next.leverageEntryDate = undefined;
  }

  if (decision.coreSignal === "SELL") {
    next.hasCorePosition = false;
    next.coreAllocationPct = 0;
  }

  return next;
}

export function buildPortfolioSnapshot(params: {
  priceHistory: Record<Ticker, PriceBar[]>;
  positions?: Record<Exclude<Ticker, "SPY">, PositionState>;
  asOfDate?: string;
  config?: Partial<StrategyConfig>;
}): PortfolioSnapshot {
  const config: StrategyConfig = { ...DEFAULT_CONFIG, ...params.config };
  const positions = params.positions ?? createEmptyPositions();
  const { stockStates, spyTrendUp } = computeIndicatorStatesForDate({
    priceHistory: params.priceHistory,
    asOfDate: params.asOfDate,
    config,
  });

  const qualifiedLeaderCount = getQualifiedLeaderCount(stockStates);
  const decisions = stockStates
    .sort((a, b) => a.rank - b.rank)
    .map((stock) =>
      buildStockDecision({
        stock,
        position: positions[stock.ticker],
        qualifiedLeaderCount,
        spyTrendUp,
        config,
      })
    );

  return {
    date: decisions[0]?.date ?? params.asOfDate ?? "",
    decisions,
    qualifiedLeaderCount,
    portfolioOutperformingSPYCount: stockStates.filter((s) => s.outperformingSPY63).length,
  };
}

export function dollarAllocationFromPct(totalCapital: number, allocationPct: number): number {
  return Math.round(totalCapital * allocationPct * 100) / 100;
}

export function summarizeAllocations(snapshot: PortfolioSnapshot, totalCapital: number) {
  return snapshot.decisions.map((decision) => ({
    ticker: decision.ticker,
    coreSignal: decision.coreSignal,
    leverageSignal: decision.leverageSignal,
    corePct: decision.targetCoreAllocationPct,
    leveragePct: decision.targetLeverageAllocationPct,
    coreDollars: dollarAllocationFromPct(totalCapital, decision.targetCoreAllocationPct),
    leverageDollars: dollarAllocationFromPct(totalCapital, decision.targetLeverageAllocationPct),
    notes: decision.notes,
  }));
}

/**
 * Minimal example:
 *
 * const snapshot = buildPortfolioSnapshot({
 *   priceHistory,
 *   positions,
 *   asOfDate: "2026-04-15",
 *   config: {
 *     blockLeverageWhenSpyWeak: true,
 *   },
 * });
 *
 * const summary = summarizeAllocations(snapshot, 4600);
 * console.log(summary);
 */
