import AsyncStorage from "@react-native-async-storage/async-storage";
import { sampleMag7Data } from "../data/sampleMag7Data";

export type MarketTicker = "AAPL" | "MSFT" | "GOOGL" | "AMZN" | "NVDA" | "META" | "TSLA" | "SPY";

export type MarketPricePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketDataSet = Record<MarketTicker, MarketPricePoint[]>;

export type MarketDataResult = {
  data: MarketDataSet;
  source: "live" | "cache" | "sample";
  lastUpdated: string | null;
  error?: string;
};

const CACHE_KEY = "mag7_market_data";
const CACHE_DATE_KEY = "mag7_market_data_date";
const TICKERS: MarketTicker[] = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "SPY"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSampleData(): MarketDataSet {
  const result = {} as MarketDataSet;

  for (const ticker of TICKERS) {
    result[ticker] = sampleMag7Data[ticker].map((point, index) => {
      const priorClose = index > 0 ? sampleMag7Data[ticker][index - 1].close : point.close;
      const high = Math.max(point.close, priorClose) * 1.01;
      const low = Math.min(point.close, priorClose) * 0.99;

      return {
        date: point.date,
        open: priorClose,
        high,
        low,
        close: point.close,
        volume: 1_000_000,
      };
    });
  }

  return result;
}

async function fetchTicker(ticker: MarketTicker): Promise<MarketPricePoint[]> {
  const apiKey = process.env.EXPO_PUBLIC_TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Twelve Data API key");
  }

  const params = new URLSearchParams({
    symbol: ticker,
    interval: "1day",
    outputsize: "260",
    order: "ASC",
    format: "JSON",
    apikey: apiKey,
  });

  const response = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`);
  const json = await response.json();

  if (!response.ok || json?.status === "error" || !Array.isArray(json?.values)) {
    throw new Error(json?.message ?? `Unable to fetch ${ticker}`);
  }

  return json.values.map((item: Record<string, unknown>) => ({
    date: String(item.datetime),
    open: parseNumber(item.open),
    high: parseNumber(item.high),
    low: parseNumber(item.low),
    close: parseNumber(item.close),
    volume: parseNumber(item.volume),
  }));
}

async function fetchLiveMarketData(): Promise<MarketDataSet> {
  const result = {} as MarketDataSet;

  // Sequential requests reduce the chance of hitting free-plan burst limits.
  for (const ticker of TICKERS) {
    result[ticker] = await fetchTicker(ticker);
  }

  return result;
}

async function readCachedData(): Promise<MarketDataResult | null> {
  const [cachedDate, cachedData] = await Promise.all([
    AsyncStorage.getItem(CACHE_DATE_KEY),
    AsyncStorage.getItem(CACHE_KEY),
  ]);

  if (!cachedDate || !cachedData) return null;

  return {
    data: JSON.parse(cachedData),
    source: "cache",
    lastUpdated: cachedDate,
  };
}

async function writeCachedData(data: MarketDataSet): Promise<string> {
  const updatedDate = todayKey();

  await Promise.all([
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)),
    AsyncStorage.setItem(CACHE_DATE_KEY, updatedDate),
  ]);

  return updatedDate;
}

export async function getMarketData(forceRefresh = false): Promise<MarketDataResult> {
  const cached = await readCachedData();
  const cacheIsFresh = cached?.lastUpdated === todayKey();

  if (cached && cacheIsFresh && !forceRefresh) {
    return cached;
  }

  try {
    const liveData = await fetchLiveMarketData();
    const lastUpdated = await writeCachedData(liveData);

    return {
      data: liveData,
      source: "live",
      lastUpdated,
    };
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        error: error instanceof Error ? error.message : "Unable to refresh market data",
      };
    }

    return {
      data: normalizeSampleData(),
      source: "sample",
      lastUpdated: null,
      error: error instanceof Error ? error.message : "Unable to load market data",
    };
  }
}
