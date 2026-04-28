import { buildDashboardSignals } from "./dashboardSignals";
import { MarketDataSet, MarketPricePoint, MarketTicker } from "../services/marketDataService";

type Ticker = Exclude<MarketTicker, "SPY">;

export type BacktestSummary = {
  startDate: string;
  endDate: string;
  tradingDays: number;
  strategyReturn: number;
  spyReturn: number;
  outperformance: number;
  winRate: number;
  maxDrawdown: number;
  trades: number;
  buy2xSignals: number;
};

const tickers: Ticker[] = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];

function getCommonDateRange(marketData: MarketDataSet) {
  const spy = marketData.SPY ?? [];
  const minLength = Math.min(...tickers.map((ticker) => marketData[ticker]?.length ?? 0), spy.length);
  return Math.max(0, minLength);
}

function sliceThroughIndex(series: MarketPricePoint[], endIndexExclusive: number) {
  return series.slice(0, endIndexExclusive);
}

function buildPartialMarketData(marketData: MarketDataSet, endIndexExclusive: number): MarketDataSet {
  const result = {} as MarketDataSet;

  ([...tickers, "SPY"] as MarketTicker[]).forEach((ticker) => {
    result[ticker] = sliceThroughIndex(marketData[ticker] ?? [], endIndexExclusive);
  });

  return result;
}

function calculateMaxDrawdown(equityCurve: number[]) {
  let peak = equityCurve[0] ?? 1;
  let maxDrawdown = 0;

  equityCurve.forEach((value) => {
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? (value - peak) / peak : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  });

  return maxDrawdown;
}

export function runBacktest(marketData: MarketDataSet): BacktestSummary | null {
  const length = getCommonDateRange(marketData);

  // Need enough history for 200-day average, 30-day slope lookback, and signals.
  if (length < 230) return null;

  const startIndex = 230;
  let strategyEquity = 1;
  let spyEquity = 1;
  let winningDays = 0;
  let testedDays = 0;
  let trades = 0;
  let buy2xSignals = 0;
  let priorActiveTickers = new Set<Ticker>();
  const equityCurve: number[] = [strategyEquity];

  for (let index = startIndex; index < length - 1; index++) {
    const partialData = buildPartialMarketData(marketData, index);
    const signals = buildDashboardSignals(partialData);

    const activeSignals = signals.filter((signal) =>
      signal.signal === "BUY" ||
      signal.signal === "HOLD" ||
      signal.leverageSignal === "BUY 2X" ||
      signal.leverageSignal === "HOLD 2X"
    );

    const activeTickers = new Set(activeSignals.map((signal) => signal.ticker));
    activeTickers.forEach((ticker) => {
      if (!priorActiveTickers.has(ticker)) trades += 1;
    });
    priorActiveTickers = activeTickers;

    const leveragedSignals = activeSignals.filter((signal) => signal.leverageSignal === "BUY 2X" || signal.leverageSignal === "HOLD 2X");
    buy2xSignals += leveragedSignals.length;

    let strategyDailyReturn = 0;

    if (activeSignals.length > 0) {
      const equalWeight = 1 / activeSignals.length;

      activeSignals.forEach((signal) => {
        const series = marketData[signal.ticker];
        const today = series[index - 1]?.close ?? 0;
        const tomorrow = series[index]?.close ?? today;
        const dailyReturn = today > 0 ? (tomorrow - today) / today : 0;
        const leverageMultiplier = signal.leverageSignal === "BUY 2X" || signal.leverageSignal === "HOLD 2X" ? 2 : 1;
        strategyDailyReturn += equalWeight * dailyReturn * leverageMultiplier;
      });
    }

    const spySeries = marketData.SPY;
    const spyToday = spySeries[index - 1]?.close ?? 0;
    const spyTomorrow = spySeries[index]?.close ?? spyToday;
    const spyDailyReturn = spyToday > 0 ? (spyTomorrow - spyToday) / spyToday : 0;

    strategyEquity *= 1 + strategyDailyReturn;
    spyEquity *= 1 + spyDailyReturn;
    equityCurve.push(strategyEquity);

    if (strategyDailyReturn > spyDailyReturn) winningDays += 1;
    testedDays += 1;
  }

  const startDate = marketData.SPY[startIndex]?.date ?? "N/A";
  const endDate = marketData.SPY[length - 1]?.date ?? "N/A";
  const strategyReturn = strategyEquity - 1;
  const spyReturn = spyEquity - 1;

  return {
    startDate,
    endDate,
    tradingDays: testedDays,
    strategyReturn,
    spyReturn,
    outperformance: strategyReturn - spyReturn,
    winRate: testedDays > 0 ? winningDays / testedDays : 0,
    maxDrawdown: calculateMaxDrawdown(equityCurve),
    trades,
    buy2xSignals,
  };
}
