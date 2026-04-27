function generateSeries(startPrice: number, days: number, pattern: number[]) {
  const data = [];
  let price = startPrice;
  let date = new Date("2025-01-01");

  for (let i = 0; i < days; i++) {
    const move = pattern[i % pattern.length];
    price = price * (1 + move);

    const formattedDate = date.toISOString().split("T")[0];

    data.push({
      date: formattedDate,
      close: Math.round(price * 100) / 100,
    });

    date.setDate(date.getDate() + 1);
  }

  return data;
}

// Strong leaders
const nvdaPattern = [0.005, 0.004, -0.001, 0.006, 0.003];
const msftPattern = [0.0035, 0.003, 0.001, 0.0035, 0.002];
const metaPattern = [0.004, 0.003, -0.0005, 0.0045, 0.0025];

// Middle group
const amznPattern = [0.002, 0.001, -0.001, 0.002, 0.001];
const googlPattern = [0.0018, 0.001, -0.001, 0.002, 0.001];

// Weaker group
const aaplPattern = [0.001, 0.0005, -0.0015, 0.001, 0.0005];
const tslaPattern = [-0.001, 0.0015, -0.0025, 0.001, -0.001];

// Benchmark
const spyPattern = [0.0015, 0.001, -0.0005, 0.0015, 0.001];

export const sampleMag7Data = {
  AAPL: generateSeries(170, 250, aaplPattern),
  MSFT: generateSeries(400, 250, msftPattern),
  GOOGL: generateSeries(140, 250, googlPattern),
  AMZN: generateSeries(180, 250, amznPattern),
  NVDA: generateSeries(150, 250, nvdaPattern),
  META: generateSeries(450, 250, metaPattern),
  TSLA: generateSeries(200, 250, tslaPattern),
  SPY: generateSeries(500, 250, spyPattern),
};