export type PriceBar = {
  date: string;
  close: number;
};

export type PriceHistoryMap = Record<string, PriceBar[]>;

const SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "SPY"];

const API_KEY = process.env.EXPO_PUBLIC_TWELVE_DATA_API_KEY;
const BASE_URL = "https://api.twelvedata.com/time_series";

function normalizeBars(values: any[] | undefined): PriceBar[] {
  if (!values || !Array.isArray(values)) return [];

  // Twelve Data commonly returns newest first. We reverse to oldest -> newest.
  return values
    .map((item) => ({
      date: item.datetime,
      close: Number(item.close),
    }))
    .filter((item) => item.date && Number.isFinite(item.close))
    .reverse();
}

async function fetchSymbolHistory(symbol: string, outputsize = 300): Promise<PriceBar[]> {
  if (!API_KEY) {
    throw new Error("Missing Twelve Data API key.");
  }

  const url =
    `${BASE_URL}?symbol=${encodeURIComponent(symbol)}` +
    `&interval=1day` +
    `&outputsize=${outputsize}` +
    `&format=JSON` +
    `&apikey=${encodeURIComponent(API_KEY)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: HTTP ${response.status}`);
  }

  const json = await response.json();

  if (json.status === "error") {
    throw new Error(`Twelve Data error for ${symbol}: ${json.message || "Unknown error"}`);
  }

  const bars = normalizeBars(json.values);
  if (bars.length === 0) {
    throw new Error(`No time series returned for ${symbol}.`);
  }

  return bars;
}

export async function fetchMag7AndSpyHistory(): Promise<PriceHistoryMap> {
  const entries = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const bars = await fetchSymbolHistory(symbol, 320);
      return [symbol, bars] as const;
    })
  );

  return Object.fromEntries(entries);
}