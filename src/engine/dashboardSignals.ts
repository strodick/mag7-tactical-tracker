import { getCoreSignal } from "./coreSignalEngine";
import { CoreSignal, PositionState, StockIndicatorState } from "../types/trading";
import { MarketDataSet, MarketPricePoint, MarketTicker } from "../services/marketDataService";

type Ticker = Exclude<MarketTicker, "SPY">;
export type LeverageSignal = "BUY 2X" | "HOLD 2X" | "EXIT 2X" | "NO 2X";
export type TrendStage = "STRONG UPTREND" | "UPTREND" | "NEUTRAL" | "DOWNTREND";

export type DashboardSignal = {
  ticker: Ticker;
  company: string;
  signal: CoreSignal;
  leverageSignal: LeverageSignal;
  confidenceScore: number;
  trendScore: number;
  trendStage: TrendStage;
  price: number;
  trendUp: boolean;
  leader: boolean;
  momentumRank: number;
  sixMonthReturn: number;
  stochasticK: number;
  previousStochasticK: number;
  stochasticCrossedAbove20: boolean;
  stochasticAbove80: boolean;
  volume: number;
  averageVolume50Day: number;
  volumeConfirmed: boolean;
  movingAverage50Day: number;
  movingAverage200Day: number;
  relativeStrength63: number;
  chaikinMoneyFlow20: number;
  higherHighHigherLow: boolean;
  trendlineSlope63: number;
  extensionFrom200Day: number;
  extensionLabel: "Healthy" | "Caution" | "Extended";
  explanation: string;
};

const companyNames: Record<Ticker, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  NVDA: "Nvidia",
  META: "Meta Platforms",
  TSLA: "Tesla",
};

const tickers: Ticker[] = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];

function movingAverage(series: MarketPricePoint[], days: number, endIndex = series.length): number {
  const slice = series.slice(Math.max(0, endIndex - days), endIndex);
  if (slice.length === 0) return 0;
  return slice.reduce((sum, point) => sum + point.close, 0) / slice.length;
}

function averageVolume(series: MarketPricePoint[], days: number): number {
  const slice = series.slice(Math.max(0, series.length - days));
  if (slice.length === 0) return 0;
  return slice.reduce((sum, point) => sum + point.volume, 0) / slice.length;
}

function calculateReturn(series: MarketPricePoint[], lookbackDays: number): number {
  if (!series || series.length < 2) return 0;
  const latest = series[series.length - 1]?.close ?? 0;
  const prior = series[Math.max(0, series.length - lookbackDays)]?.close ?? latest;
  if (!prior) return 0;
  return (latest - prior) / prior;
}

function calculateSlowStochasticK(series: MarketPricePoint[], endIndex: number): number {
  const kPeriod = 5;
  const smoothing = 3;
  const values: number[] = [];

  if (!series || series.length < kPeriod + smoothing) return 50;

  for (let offset = smoothing - 1; offset >= 0; offset--) {
    const currentEnd = endIndex - offset;
    const window = series.slice(Math.max(0, currentEnd - kPeriod), currentEnd);
    const close = series[currentEnd - 1]?.close ?? 0;
    const high = Math.max(...window.map((point) => point.high));
    const low = Math.min(...window.map((point) => point.low));

    if (!Number.isFinite(high) || !Number.isFinite(low) || high === low) {
      values.push(50);
    } else {
      values.push(((close - low) / (high - low)) * 100);
    }
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateTrendlineSlope(series: MarketPricePoint[], lookbackDays: number): number {
  const slice = series.slice(Math.max(0, series.length - lookbackDays));
  if (slice.length < 2) return 0;

  const n = slice.length;
  const meanX = (n - 1) / 2;
  const meanY = slice.reduce((sum, point) => sum + point.close, 0) / n;

  let numerator = 0;
  let denominator = 0;

  slice.forEach((point, index) => {
    numerator += (index - meanX) * (point.close - meanY);
    denominator += (index - meanX) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  return meanY > 0 ? slope / meanY : 0;
}

function hasHigherHighsAndHigherLows(series: MarketPricePoint[]): boolean {
  if (series.length < 80) return false;

  const recent = series.slice(-21);
  const prior = series.slice(-63, -21);
  const older = series.slice(-105, -63);

  if (prior.length === 0 || older.length === 0) return false;

  const recentHigh = Math.max(...recent.map((point) => point.high));
  const priorHigh = Math.max(...prior.map((point) => point.high));
  const recentLow = Math.min(...recent.map((point) => point.low));
  const olderLow = Math.min(...older.map((point) => point.low));

  return recentHigh > priorHigh && recentLow > olderLow;
}

function calculateRelativeStrength(stockSeries: MarketPricePoint[], spySeries: MarketPricePoint[], lookbackDays: number): number {
  return calculateReturn(stockSeries, lookbackDays) - calculateReturn(spySeries, lookbackDays);
}

function calculateChaikinMoneyFlow(series: MarketPricePoint[], lookbackDays: number): number {
  const slice = series.slice(Math.max(0, series.length - lookbackDays));
  if (slice.length === 0) return 0;

  let moneyFlowVolume = 0;
  let totalVolume = 0;

  slice.forEach((point) => {
    const range = point.high - point.low;
    const multiplier = range === 0 ? 0 : ((point.close - point.low) - (point.high - point.close)) / range;
    moneyFlowVolume += multiplier * point.volume;
    totalVolume += point.volume;
  });

  return totalVolume > 0 ? moneyFlowVolume / totalVolume : 0;
}

function getTrendStage(trendScore: number): TrendStage {
  if (trendScore >= 75) return "STRONG UPTREND";
  if (trendScore >= 60) return "UPTREND";
  if (trendScore >= 40) return "NEUTRAL";
  return "DOWNTREND";
}

function calculateTrendScore(params: {
  price: number;
  movingAverage50Day: number;
  movingAverage200Day: number;
  previousMovingAverage200Day: number;
  higherHighHigherLow: boolean;
  trendlineSlope63: number;
  relativeStrength63: number;
  stochasticK: number;
  previousStochasticK: number;
  chaikinMoneyFlow20: number;
}) {
  let score = 0;

  if (params.price > params.movingAverage200Day) score += 20;
  else if (params.price > params.movingAverage200Day * 0.97) score += 10;

  if (params.movingAverage200Day > params.previousMovingAverage200Day) score += 15;
  else if (params.movingAverage200Day >= params.previousMovingAverage200Day * 0.995) score += 7;

  if (params.movingAverage50Day > params.movingAverage200Day) score += 15;
  if (params.higherHighHigherLow) score += 15;

  if (params.trendlineSlope63 > 0.001) score += 10;
  else if (params.trendlineSlope63 > 0) score += 5;

  if (params.relativeStrength63 > 0) score += 10;
  if (params.stochasticK > params.previousStochasticK) score += 7;
  if (params.chaikinMoneyFlow20 > 0) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getExtensionLabel(extensionFrom200Day: number): "Healthy" | "Caution" | "Extended" {
  if (extensionFrom200Day > 0.2) return "Extended";
  if (extensionFrom200Day > 0.12) return "Caution";
  return "Healthy";
}

function calculateConfidenceScore(params: {
  trendScore: number;
  leader: boolean;
  momentumRank: number;
  stochasticK: number;
  previousStochasticK: number;
  volumeConfirmed: boolean;
  extensionFrom200Day: number;
}) {
  let score = 0;

  score += Math.round(params.trendScore * 0.35);
  if (params.leader) score += 20;
  if (params.momentumRank === 1) score += 10;
  else if (params.momentumRank === 2) score += 8;
  else if (params.momentumRank === 3) score += 6;

  const crossedAbove20 = params.previousStochasticK < 20 && params.stochasticK >= 20;
  const stochasticRising = params.stochasticK > params.previousStochasticK;
  const stochasticBuyZone = params.stochasticK >= 20 && params.stochasticK <= 75;

  if (crossedAbove20) score += 20;
  else if (stochasticRising && stochasticBuyZone) score += 12;
  else if (params.stochasticK >= 80) score -= 10;

  if (params.volumeConfirmed) score += 15;

  if (params.extensionFrom200Day <= 0.12) score += 10;
  else if (params.extensionFrom200Day <= 0.25) score += 5;
  else if (params.extensionFrom200Day > 0.3) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getLeverageSignal(params: {
  coreSignal: CoreSignal;
  confidenceScore: number;
  trendUp: boolean;
  leader: boolean;
  stochasticK: number;
  previousStochasticK: number;
  volumeConfirmed: boolean;
  extensionFrom200Day: number;
  relativeStrength63: number;
  hasLeveragedPosition?: boolean;
}): LeverageSignal {
  if (params.hasLeveragedPosition && (!params.trendUp || params.stochasticK >= 80 || params.extensionFrom200Day > 0.3)) {
    return "EXIT 2X";
  }

  if (params.hasLeveragedPosition) {
    return "HOLD 2X";
  }

  const stochasticRising = params.stochasticK > params.previousStochasticK;
  const inBuyZone = params.stochasticK >= 20 && params.stochasticK <= 65;

  if (
    params.coreSignal === "BUY" &&
    params.confidenceScore >= 78 &&
    params.trendUp &&
    params.leader &&
    params.relativeStrength63 > 0 &&
    stochasticRising &&
    inBuyZone &&
    params.extensionFrom200Day <= 0.2
  ) {
    return "BUY 2X";
  }

  return "NO 2X";
}

function explain(signal: CoreSignal, leverageSignal: LeverageSignal, confidenceScore: number, stock: StockIndicatorState, trendScore: number, trendStage: TrendStage): string {
  if (leverageSignal === "BUY 2X") return `High-confidence ${trendStage.toLowerCase()} setup (${confidenceScore}%). Core buy and 2X trigger are both aligned.`;
  if (leverageSignal === "EXIT 2X") return "Exit 2X exposure because trend, overbought, or extension risk is elevated.";
  if (!stock.trendUp) return `Trend score is ${trendScore}. Avoid new buys until the broader trend improves.`;
  if (signal === "BUY") return `Core buy setup confirmed with ${confidenceScore}% confidence and a ${trendStage.toLowerCase()} trend score.`;
  if (signal === "REDUCE") return "Take profits or reduce risk because the stock is overbought, too extended, or losing leadership.";
  if (signal === "HOLD") return `Trend remains intact (${trendStage.toLowerCase()}), but this is not a fresh 2X entry setup.`;
  return "Watch this stock. Conditions are not yet aligned for entry.";
}

export function buildDashboardSignals(
  marketData: MarketDataSet,
  positionByTicker: Partial<Record<Ticker, PositionState>> = {}
): DashboardSignal[] {
  if (!marketData) return [];

  const spySeries = marketData.SPY ?? [];

  const momentumRanks = tickers
    .map((ticker) => ({
      ticker,
      sixMonthReturn: calculateReturn(marketData[ticker] ?? [], 126),
    }))
    .sort((a, b) => b.sixMonthReturn - a.sixMonthReturn)
    .reduce<Record<Ticker, number>>((rankMap, item, index) => {
      rankMap[item.ticker] = index + 1;
      return rankMap;
    }, {} as Record<Ticker, number>);

  return tickers.map((ticker) => {
    const series = marketData[ticker] ?? [];
    const latestIndex = series.length;
    const latest = series[latestIndex - 1];

    if (!latest) {
      return {
        ticker,
        company: companyNames[ticker],
        signal: "NONE",
        leverageSignal: "NO 2X",
        confidenceScore: 0,
        trendScore: 0,
        trendStage: "DOWNTREND",
        price: 0,
        trendUp: false,
        leader: false,
        momentumRank: momentumRanks[ticker] ?? 7,
        sixMonthReturn: 0,
        stochasticK: 50,
        previousStochasticK: 50,
        stochasticCrossedAbove20: false,
        stochasticAbove80: false,
        volume: 0,
        averageVolume50Day: 0,
        volumeConfirmed: false,
        movingAverage50Day: 0,
        movingAverage200Day: 0,
        relativeStrength63: 0,
        chaikinMoneyFlow20: 0,
        higherHighHigherLow: false,
        trendlineSlope63: 0,
        extensionFrom200Day: 0,
        extensionLabel: "Healthy",
        explanation: "No market data available for this ticker.",
      };
    }

    const price = latest.close;
    const movingAverage50Day = movingAverage(series, 50);
    const movingAverage200Day = movingAverage(series, 200);
    const previousMovingAverage200Day = movingAverage(series, 200, latestIndex - 30);
    const stochasticK = calculateSlowStochasticK(series, latestIndex);
    const previousStochasticK = calculateSlowStochasticK(series, latestIndex - 1);
    const averageVolume50Day = averageVolume(series, 50);
    const higherHighHigherLow = hasHigherHighsAndHigherLows(series);
    const trendlineSlope63 = calculateTrendlineSlope(series, 63);
    const relativeStrength63 = calculateRelativeStrength(series, spySeries, 63);
    const chaikinMoneyFlow20 = calculateChaikinMoneyFlow(series, 20);
    const trendScore = calculateTrendScore({
      price,
      movingAverage50Day,
      movingAverage200Day,
      previousMovingAverage200Day,
      higherHighHigherLow,
      trendlineSlope63,
      relativeStrength63,
      stochasticK,
      previousStochasticK,
      chaikinMoneyFlow20,
    });
    const trendStage = getTrendStage(trendScore);
    const trendUp = trendScore >= 65;
    const momentumRank = momentumRanks[ticker] ?? 7;
    const leader = momentumRank <= 6;
    const extensionFrom200Day = movingAverage200Day > 0 ? (price - movingAverage200Day) / movingAverage200Day : 0;
    const volumeConfirmed = averageVolume50Day > 0 && latest.volume >= averageVolume50Day;

    const stock: StockIndicatorState = {
      ticker,
      trendUp,
      priceAbove200Day: price > movingAverage200Day,
      ma200Rising: movingAverage200Day > previousMovingAverage200Day,
      leader,
      momentumRank,
      stochasticK,
      previousStochasticK,
      volume: latest.volume,
      averageVolume50Day,
      price,
      movingAverage200Day,
    };

    const position = positionByTicker[ticker] ?? { hasCorePosition: false };
    const signal = getCoreSignal(stock, position);
    const confidenceScore = calculateConfidenceScore({
      trendScore,
      leader,
      momentumRank,
      stochasticK,
      previousStochasticK,
      volumeConfirmed,
      extensionFrom200Day,
    });
    const leverageSignal = getLeverageSignal({
      coreSignal: signal,
      confidenceScore,
      trendUp,
      leader,
      stochasticK,
      previousStochasticK,
      volumeConfirmed,
      extensionFrom200Day,
      relativeStrength63,
      hasLeveragedPosition: position.hasLeveragedPosition,
    });

    return {
      ticker,
      company: companyNames[ticker],
      signal,
      leverageSignal,
      confidenceScore,
      trendScore,
      trendStage,
      price,
      trendUp,
      leader,
      momentumRank,
      sixMonthReturn: calculateReturn(series, 126),
      stochasticK,
      previousStochasticK,
      stochasticCrossedAbove20: previousStochasticK < 20 && stochasticK >= 20,
      stochasticAbove80: stochasticK >= 80,
      volume: latest.volume,
      averageVolume50Day,
      volumeConfirmed,
      movingAverage50Day,
      movingAverage200Day,
      relativeStrength63,
      chaikinMoneyFlow20,
      higherHighHigherLow,
      trendlineSlope63,
      extensionFrom200Day,
      extensionLabel: getExtensionLabel(extensionFrom200Day),
      explanation: explain(signal, leverageSignal, confidenceScore, stock, trendScore, trendStage),
    };
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
