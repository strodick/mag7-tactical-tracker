import { LeverageSignal, PositionState, StockIndicatorState } from "../types/trading";

const DEFAULT_LEVERAGE_OVERLAY = 0.20; // 20%
const MAX_LEVERAGE_OVERLAY = 0.30; // 30%
const LEVERAGE_STOP_LOSS = 0.05; // 5%
const LEVERAGE_MAX_HOLD_DAYS = 12;

function daysBetween(dateA?: string, dateB?: string): number {
  if (!dateA || !dateB) return 0;
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

export function shouldTurnLeverageOn(
  stock: StockIndicatorState,
  position: PositionState
): boolean {
  return (
    position.hasCorePosition &&
    stock.trendUp &&
    stock.leader &&
    stock.inPullbackZone &&
    stock.stochasticK !== null &&
    stock.stochasticK < 25 &&
    stock.stochasticRising &&
    !position.hasLeverageOverlay
  );
}

export function shouldTurnLeverageOff(
  stock: StockIndicatorState,
  position: PositionState,
  currentDate: string
): boolean {
  if (!position.hasLeverageOverlay) return false;

  const overboughtExit = stock.stochasticK !== null && stock.stochasticK > 80;
  const lostLeadership = !stock.leader;
  const trendBreak = !stock.trendUp;

  const stopLossTriggered =
    position.leverageEntryPrice != null &&
    stock.close <= position.leverageEntryPrice * (1 - LEVERAGE_STOP_LOSS);

  const timedExit =
    position.leverageEntryDate != null &&
    daysBetween(position.leverageEntryDate, currentDate) >= LEVERAGE_MAX_HOLD_DAYS;

  return overboughtExit || lostLeadership || trendBreak || stopLossTriggered || timedExit;
}

export function getLeverageSignal(
  stock: StockIndicatorState,
  position: PositionState,
  currentDate: string
): LeverageSignal {
  if (shouldTurnLeverageOff(stock, position, currentDate)) {
    return "LEVERAGE_OFF";
  }

  if (shouldTurnLeverageOn(stock, position)) {
    return "LEVERAGE_ON";
  }

  if (position.hasLeverageOverlay) {
    return "LEVERAGE_HOLD";
  }

  return "NO_LEVERAGE";
}

export function getTargetLeverageAllocation(
  stock: StockIndicatorState,
  leverageSignal: LeverageSignal
): number {
  if (leverageSignal === "LEVERAGE_OFF" || leverageSignal === "NO_LEVERAGE") {
    return 0;
  }

  if (leverageSignal === "LEVERAGE_ON") {
    // Slightly stronger pullbacks can justify slightly larger tactical overlay
    if (stock.pullbackPctFrom60dHigh >= 0.08) {
      return MAX_LEVERAGE_OVERLAY; // 30%
    }
    return DEFAULT_LEVERAGE_OVERLAY; // 20%
  }

  return 0;
}