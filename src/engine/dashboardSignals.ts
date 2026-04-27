import { sampleMag7Data } from "../data/sampleMag7Data";
import { getCoreSignal } from "./coreSignalEngine";
import { CoreSignal, PositionState, StockIndicatorState } from "../types/trading";

type PricePoint = {
  date: string;
  close: number;
};

type Ticker = "AAPL" | "MSFT" | "GOOGL" | "AMZN" | "NVDA" | "META" | "TSLA";

export type DashboardSignal = {
  ticker: Ticker;
  company: string;
  signal: CoreSignal;
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
  movingAverage200Day: number;
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

function movingAverage(series: PricePoint[], days: number, endIndex = series.length): number {
  const slice = series.slice(Math.max(0, endIndex - days), endIndex);
  if (slice.length === 0) return 0;
  return slice.reduce((sum, point) => sum + point.close, 0) / slice.length;
}

function calculateReturn(series: PricePoint[], lookbackDays: number): number {
  const latest = series[series.length - 1]?.close ?? 0;
  const prior = series[Math.max(0, series.length - lookbackDays)]?.close ?? latest;
  if (prior === 0) return 0;
  return (latest - prior) / prior;
}

function calculateSlowStochasticK(series: PricePoint[], endIndex: number): number {
  const kPeriod = 5;
  const smoothing = 3;
  const rawValues: number[] = [];

  for (let offset = smoothing - 1; offset >= 0; offset--) {
    const currentEnd = endIndex - offset;
    const window = series.slice(Math.max(0, currentEnd - kPeriod), currentEnd);
    const close = series[currentEnd - 1]?.close ?? 0;
    const low = Math.min(...window.map((point) => point.close));
    const high = Math.max(...window.map((point) => point.close));

    if (high === low) {
      rawValues.push(50);
    } else {
      rawValues.push(((close - low) / (high - low)) * 100);
    }
  }

  return rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length;
}

function estimateVolume(ticker: Ticker, latestIndex: number, isLeader: boolean): { volume: number; averageVolume50Day: number } {
  const baseByTicker: Record<Ticker, number> = {
    AAPL: 58_000_000,
    MSFT: 24_000_000,
    GOOGL: 32_000_000,
    AMZN: 42_000_000,
    NVDA: 310_000_000,
    META: 15_000_000,
    TSLA: 95_000_000,
  };

  const averageVolume50Day = baseByTicker[ticker];
  const cycleBoost = latestIndex % 3 === 0 ? 1.08 : 0.96;
  const leadershipBoost = isLeader ? 1.05 : 0.97;

  return {
    volume: Math.round(averageVolume50Day * cycleBoost * leadershipBoost),
    averageVolume50Day,
  };
}

function getExtensionLabel(extensionFrom200Day: number): "Healthy" | "Caution" | "Extended" {
  if (extensionFrom200Day > 0.25) return "Extended";
  if (extensionFrom200Day > 0.15) return "Caution";
  return "Healthy";
}

function explain(signal: CoreSignal, stock: StockIndicatorState): string {
  if (!stock.trendUp) return "Trend filter failed. Avoid new buys until price is above a rising 200-day average.";
  if (signal === "BUY") return "Trend, leadership, stochastic recovery, volume, and extension filters are aligned.";
  if (signal === "REDUCE") return "Take profits or reduce risk because the stock is overbought, too extended, or losing leadership.";
  if (signal === "HOLD") return "Trend is intact, but this is not a fresh 2x entry setup.";
  return "No new action until the full setup appears.";
}

export function buildDashboardSignals(positionByTicker: Partial<Record<Ticker, PositionState>> = {}): DashboardSignal[] {
  const momentumRanks = tickers
    .map((ticker) => ({
      ticker,
      sixMonthReturn: calculateReturn(sampleMag7Data[ticker], 126),
    }))
    .sort((a, b) => b.sixMonthReturn - a.sixMonthReturn)
    .reduce<Record<Ticker, number>>((rankMap, item, index) => {
      rankMap[item.ticker] = index + 1;
      return rankMap;
    }, {} as Record<Ticker, number>);

  return tickers.map((ticker) => {
    const series = sampleMag7Data[ticker];
    const latestIndex = series.length;
    const latest = series[latestIndex - 1];
    const previousStochasticK = calculateSlowStochasticK(series, latestIndex - 1);
    const stochasticK = calculateSlowStochasticK(series, latestIndex);
    const movingAverage200Day = movingAverage(series, 200);
    const previousMovingAverage200Day = movingAverage(series, 200, latestIndex - 30);
    const price = latest.close;
    const trendUp = price > movingAverage200Day && movingAverage200Day > previousMovingAverage200Day;
    const momentumRank = momentumRanks[ticker];
    const leader = momentumRank <= 3;
    const { volume, averageVolume50Day } = estimateVolume(ticker, latestIndex, leader);
    const extensionFrom200Day = (price - movingAverage200Day) / movingAverage200Day;

    const stock: StockIndicatorState = {
      ticker,
      trendUp,
      priceAbove200Day: price > movingAverage200Day,
      ma200Rising: movingAverage200Day > previousMovingAverage200Day,
      leader,
      momentumRank,
      stochasticK,
      previousStochasticK,
      volume,
      averageVolume50Day,
      price,
      movingAverage200Day,
    };

    const position = positionByTicker[ticker] ?? { hasCorePosition: false };
    const signal = getCoreSignal(stock, position);

    return {
      ticker,
      company: companyNames[ticker],
      signal,
      price,
      trendUp,
      leader,
      momentumRank,
      sixMonthReturn: calculateReturn(series, 126),
      stochasticK,
      previousStochasticK,
      stochasticCrossedAbove20: previousStochasticK < 20 && stochasticK >= 20,
      stochasticAbove80: stochasticK >= 80,
      volume,
      averageVolume50Day,
      volumeConfirmed: volume >= averageVolume50Day,
      movingAverage200Day,
      extensionFrom200Day,
      extensionLabel: getExtensionLabel(extensionFrom200Day),
      explanation: explain(signal, stock),
    };
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
