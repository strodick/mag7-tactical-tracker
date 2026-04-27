import { getCoreSignal, getTargetCoreAllocation } from "./coreSignalEngine";
import { getLeverageSignal, getTargetLeverageAllocation } from "./leverageSignalEngine";
import { PositionState, StockDecision, StockIndicatorState } from "../types/trading";

export function buildStockDecision(
  stock: StockIndicatorState,
  position: PositionState,
  qualifiedLeaderCount: number,
  currentDate: string
): StockDecision {
  const coreSignal = getCoreSignal(stock, position);
  const leverageSignal = getLeverageSignal(stock, position, currentDate);

  let targetCoreAllocationPct = position.coreAllocationPct;
  let targetLeverageAllocationPct = position.leverageAllocationPct;
  const notes: string[] = [];

  if (coreSignal === "BUY") {
    targetCoreAllocationPct = getTargetCoreAllocation(qualifiedLeaderCount);
    notes.push("Stock is above 200-day MA and ranked in top 3 by 63-day return.");
  }

  if (coreSignal === "HOLD") {
    targetCoreAllocationPct = position.coreAllocationPct || getTargetCoreAllocation(qualifiedLeaderCount);
    notes.push("Core position remains valid.");
  }

  if (coreSignal === "REDUCE") {
    targetCoreAllocationPct = Math.max(position.coreAllocationPct * 0.5, 0);
    notes.push("Stock lost leader status but remains above 200-day MA.");
  }

  if (coreSignal === "SELL") {
    targetCoreAllocationPct = 0;
    targetLeverageAllocationPct = 0;
    notes.push("Trend broke below 200-day MA.");
  }

  if (leverageSignal === "LEVERAGE_ON") {
    targetLeverageAllocationPct = getTargetLeverageAllocation(stock, leverageSignal);
    notes.push("Tactical leverage overlay activated on pullback + momentum turn.");
  }

  if (leverageSignal === "LEVERAGE_OFF") {
    targetLeverageAllocationPct = 0;
    notes.push("Tactical leverage overlay removed.");
  }

  return {
    ticker: stock.ticker,
    coreSignal,
    leverageSignal,
    targetCoreAllocationPct,
    targetLeverageAllocationPct,
    notes,
  };
}