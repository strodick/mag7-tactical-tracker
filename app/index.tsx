import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { sampleMag7Data } from "../src/data/sampleMag7Data";
import {
  buildPortfolioSnapshot,
  createEmptyPositions,
} from "../src/engine/strategyEngine";
import { fetchMag7AndSpyHistory } from "../src/services/marketDataService";

function getCoreSignalColor(signal: string) {
  switch (signal) {
    case "BUY":
      return "#16a34a";
    case "HOLD":
      return "#d4a017";
    case "REDUCE":
      return "#ea580c";
    case "SELL":
      return "#dc2626";
    case "NO ACTION":
      return "#6b7280";
    default:
      return "#6b7280";
  }
}

function getLeverageSignalColor(signal: string) {
  switch (signal) {
    case "LEVERAGE_ON":
      return "#7c3aed";
    case "LEVERAGE_HOLD":
      return "#4f46e5";
    case "LEVERAGE_OFF":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function SignalBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View
      style={{
        backgroundColor: color,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function InfoPill({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: "#e5e7eb",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: "#111827", fontWeight: "600", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `$${value.toFixed(2)}`;
}

function buildReason(item: any) {
  const notes = item.notes || [];
  if (notes.length > 0) return notes[0];

  if (item.coreSignal === "BUY") {
    return "Trend is up and the stock is in the leadership group.";
  }
  if (item.coreSignal === "HOLD") {
    return "The position remains valid. Continue holding.";
  }
  if (item.coreSignal === "REDUCE") {
    return "Trend is still up, but leadership has weakened.";
  }
  if (item.coreSignal === "SELL") {
    return "Trend broke below the 200-day moving average.";
  }

  return "No active position right now.";
}

function buildActionSentence(item: any) {
  const leverageSignal = item.leverageSignal;
  const coreSignal = item.coreSignal;

  if (leverageSignal === "LEVERAGE_ON") {
    return "Turn leverage on for this position.";
  }

  if (leverageSignal === "LEVERAGE_OFF") {
    return "Turn leverage off and keep only the core position.";
  }

  if (coreSignal === "BUY") {
    return "Buy a core position.";
  }

  if (coreSignal === "HOLD") {
    return "Hold your current core position.";
  }

  if (coreSignal === "REDUCE") {
    return "Reduce your position size.";
  }

  if (coreSignal === "SELL") {
    return "Sell and exit the core position.";
  }

  return "No action needed right now.";
}

function buildSummaryCounts(summary: any[]) {
  let buy = 0;
  let hold = 0;
  let reduce = 0;
  let sell = 0;
  let leverageOn = 0;

  summary.forEach((item) => {
    if (item.coreSignal === "BUY") buy++;
    if (item.coreSignal === "HOLD") hold++;
    if (item.coreSignal === "REDUCE") reduce++;
    if (item.coreSignal === "SELL") sell++;
    if (item.leverageSignal === "LEVERAGE_ON") leverageOn++;
  });

  return { buy, hold, reduce, sell, leverageOn };
}

function calculateWholeSharePlan(targetDollars: number, sharePrice: number) {
  if (!sharePrice || sharePrice <= 0 || !targetDollars || targetDollars <= 0) {
    return {
      shares: 0,
      actualCost: 0,
      leftover: Math.max(targetDollars || 0, 0),
    };
  }

  const shares = Math.floor(targetDollars / sharePrice);
  const actualCost = shares * sharePrice;
  const leftover = targetDollars - actualCost;

  return {
    shares,
    actualCost,
    leftover,
  };
}

function getQuickOrderPriority(item: any) {
  switch (item.coreSignal) {
    case "BUY":
      return 1;
    case "HOLD":
      return 2;
    case "REDUCE":
      return 3;
    case "SELL":
      return 4;
    default:
      return 5;
  }
}

function sortByPriority(items: any[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = getQuickOrderPriority(a) - getQuickOrderPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.ticker.localeCompare(b.ticker);
  });
}

function QuickOrderRow({
  item,
  planningCapital,
}: {
  item: any;
  planningCapital: number;
}) {
  const sharePrice = item.indicatorState?.close ?? 0;
  const coreTargetDollars = planningCapital * item.corePct;
  const leverageTargetDollars = planningCapital * item.leveragePct;

  const corePlan = calculateWholeSharePlan(coreTargetDollars, sharePrice);
  const leveragePlan = calculateWholeSharePlan(leverageTargetDollars, sharePrice);

  return (
    <View
      style={{
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#d0d0d0",
        borderRadius: 12,
        backgroundColor: "#ffffff",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>{item.ticker}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <SignalBadge
            label={item.coreSignal}
            color={getCoreSignalColor(item.coreSignal)}
          />
          {item.leverageSignal !== "NO_LEVERAGE" ? (
            <SignalBadge
              label={item.leverageSignal}
              color={getLeverageSignalColor(item.leverageSignal)}
            />
          ) : null}
        </View>
      </View>

      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 4 }}>
        Core Shares: {corePlan.shares}
      </Text>
      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 4 }}>
        Estimated Core Cost: {formatCurrency(corePlan.actualCost)}
      </Text>

      {item.leveragePct > 0 || item.leverageSignal !== "NO_LEVERAGE" ? (
        <>
          <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 4 }}>
            Leverage Shares: {leveragePlan.shares}
          </Text>
          <Text style={{ fontSize: 14, color: "#4b5563" }}>
            Estimated Leverage Cost: {formatCurrency(leveragePlan.actualCost)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function StockCard({
  item,
  planningCapital,
}: {
  item: any;
  planningCapital: number;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const indicator = item.indicatorState;
  const rank = indicator?.rank ?? "-";
  const leader = indicator?.leader ? "Yes" : "No";
  const trendUp = indicator?.trendUp ? "Up" : "Down";
  const outperformingSPY = indicator?.outperformingSPY63 ? "Yes" : "No";
  const reason = buildReason(item);
  const actionSentence = buildActionSentence(item);
  const sharePrice = indicator?.close ?? 0;

  const coreTargetDollars = planningCapital * item.corePct;
  const leverageTargetDollars = planningCapital * item.leveragePct;

  const corePlan = calculateWholeSharePlan(coreTargetDollars, sharePrice);
  const leveragePlan = calculateWholeSharePlan(leverageTargetDollars, sharePrice);

  return (
    <View
      style={{
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#d0d0d0",
        borderRadius: 12,
        backgroundColor: "#ffffff",
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
        {item.ticker}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
        <SignalBadge
          label={item.coreSignal}
          color={getCoreSignalColor(item.coreSignal)}
        />
        <SignalBadge
          label={item.leverageSignal}
          color={getLeverageSignalColor(item.leverageSignal)}
        />
      </View>

      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          marginBottom: 8,
          color: "#111827",
        }}
      >
        Action: {actionSentence}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
        <InfoPill label={`Rank: ${rank}`} />
        <InfoPill label={`Leader: ${leader}`} />
        <InfoPill label={`Trend: ${trendUp}`} />
        <InfoPill label={`Beat SPY: ${outperformingSPY}`} />
      </View>

      <Text style={{ marginBottom: 10, color: "#374151" }}>
        Reason: {reason}
      </Text>

      <Pressable
  onPress={() => setShowDetails((prev) => !prev)}
  style={{
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: showDetails ? 10 : 0,
  }}
>
  <Text
    style={{
      color: "#6b7280",
      fontSize: 13,
      fontWeight: "500",
    }}
  >
    {showDetails ? "▲ Hide details" : "▼ Show details"}
  </Text>
</Pressable>

      {showDetails && (
        <>
          <Text style={{ fontWeight: "600", marginTop: 4, marginBottom: 4 }}>
            Indicators
          </Text>
          <Text>Share Price: {formatCurrency(sharePrice)}</Text>
          <Text>63-Day Return: {formatPercent(indicator?.return63)}</Text>
          <Text>Pullback %: {formatPercent(indicator?.pullbackPctFrom60dHigh)}</Text>
          <Text>Stochastic: {formatNumber(indicator?.stochasticK)}</Text>

          <Text style={{ fontWeight: "600", marginTop: 10, marginBottom: 4 }}>
            Core Position Plan
          </Text>
          <Text>Target %: {(item.corePct * 100).toFixed(2)}%</Text>
          <Text>Target $: {formatCurrency(coreTargetDollars)}</Text>
          <Text>Estimated Shares: {corePlan.shares}</Text>
          <Text>Estimated Cost: {formatCurrency(corePlan.actualCost)}</Text>
          <Text>Leftover: {formatCurrency(corePlan.leftover)}</Text>

          <Text style={{ fontWeight: "600", marginTop: 10, marginBottom: 4 }}>
            Leverage Overlay Plan
          </Text>
          <Text>Target %: {(item.leveragePct * 100).toFixed(2)}%</Text>
          <Text>Target $: {formatCurrency(leverageTargetDollars)}</Text>
          <Text>Estimated Shares: {leveragePlan.shares}</Text>
          <Text>Estimated Cost: {formatCurrency(leveragePlan.actualCost)}</Text>
          <Text>Leftover: {formatCurrency(leveragePlan.leftover)}</Text>
        </>
      )}
    </View>
  );
}

export default function Index() {
  const [investmentAmount, setInvestmentAmount] = useState("4600");
  const [newCashToDeploy, setNewCashToDeploy] = useState("");
  const [cashReservePct, setCashReservePct] = useState("5");
  const [showFullDashboard, setShowFullDashboard] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any>(sampleMag7Data);
  const [dataSourceLabel, setDataSourceLabel] = useState("Sample MAG 7 data");
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const actionCenterY = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function loadLiveData() {
      try {
        const liveHistory = await fetchMag7AndSpyHistory();
        if (!isMounted) return;

        setPriceHistory(liveHistory);
        setDataSourceLabel("Twelve Data (live daily data)");
      } catch (error) {
        console.log("LIVE DATA FALLBACK:", error);
        if (!isMounted) return;

        setPriceHistory(sampleMag7Data);
        setDataSourceLabel("Sample MAG 7 data fallback");
      } finally {
        if (isMounted) {
          setIsLoadingLiveData(false);
        }
      }
    }

    loadLiveData();

    return () => {
      isMounted = false;
    };
  }, []);

  const positions = createEmptyPositions();

  const parsedInvestmentAmount = Number(investmentAmount) || 0;
  const parsedNewCashToDeploy = Number(newCashToDeploy) || 0;
  const parsedCashReservePct = Number(cashReservePct) || 0;

  const safeCashReservePct = Math.max(0, Math.min(parsedCashReservePct, 100));

  const basePlanningAmount =
    parsedNewCashToDeploy > 0 ? parsedNewCashToDeploy : parsedInvestmentAmount;

  const cashReserveDollars = basePlanningAmount * (safeCashReservePct / 100);
  const planningCapital = basePlanningAmount - cashReserveDollars;

  const planningMode =
    parsedNewCashToDeploy > 0 ? "New Cash Deployment Plan" : "Full Investment Plan";

  const resetPlanner = () => {
    setNewCashToDeploy("");
    setCashReservePct("5");
  };

  const result = useMemo(() => {
    try {
      const snapshot = buildPortfolioSnapshot({
        priceHistory,
        positions,
      });

      const summary = snapshot.decisions.map((decision: any) => ({
        ticker: decision.ticker,
        coreSignal: decision.coreSignal === "NONE" ? "NO ACTION" : decision.coreSignal,
        leverageSignal: decision.leverageSignal,
        corePct: decision.targetCoreAllocationPct,
        leveragePct: decision.targetLeverageAllocationPct,
        notes: decision.notes,
        indicatorState: decision.indicatorState,
      }));

      return {
        snapshot,
        summary,
        message: `Strategy engine connected! Actionable names: ${summary.filter(
          (item: any) =>
            item.coreSignal !== "NO ACTION" || item.leverageSignal !== "NO_LEVERAGE"
        ).length}`,
      };
    } catch (error) {
      console.log("ENGINE ERROR:", error);
      return {
        snapshot: null,
        summary: [],
        message: "Engine connected, but needs more data.",
      };
    }
  }, [priceHistory, positions]);

  const counts = buildSummaryCounts(result.summary);

  const actionItems = result.summary.filter(
    (item: any) =>
      item.coreSignal !== "NO ACTION" ||
      item.leverageSignal === "LEVERAGE_ON" ||
      item.leverageSignal === "LEVERAGE_OFF" ||
      item.leverageSignal === "LEVERAGE_HOLD"
  );

  const sortedQuickOrders = sortByPriority(actionItems);
  const sortedActionItems = sortByPriority(actionItems);

  const totalCoreTarget = actionItems.reduce(
    (sum: number, item: any) => sum + planningCapital * item.corePct,
    0
  );
  const totalLeverageTarget = actionItems.reduce(
    (sum: number, item: any) => sum + planningCapital * item.leveragePct,
    0
  );

  const lastUpdated = result.snapshot?.date ?? "N/A";
  const dataSource = dataSourceLabel;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          paddingTop: 60,
          backgroundColor: "#f5f5f5",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: "bold", marginBottom: 8 }}>
              MAG 7 Tactical Tracker
            </Text>

            <Text style={{ fontSize: 13, color: "#6b7280" }}>
              Last updated: {lastUpdated} • Data source: {dataSource}
              {isLoadingLiveData ? " • Loading live data..." : ""}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/settings")}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: "#111827",
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "bold" }}>Settings</Text>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          <InfoPill label={`Leaders: ${result.snapshot?.qualifiedLeaderCount ?? "-"}`} />
          <InfoPill label={`Buy: ${counts.buy}`} />
          <InfoPill label={`Hold: ${counts.hold}`} />
          <InfoPill label={`Reduce: ${counts.reduce}`} />
          <InfoPill label={`Sell: ${counts.sell}`} />
          <InfoPill label={`Leverage On: ${counts.leverageOn}`} />
        </View>

        <Pressable
          onPress={() =>
            scrollRef.current?.scrollTo({
              y: actionCenterY.current,
              animated: true,
            })
          }
          style={{
            alignSelf: "flex-start",
            marginBottom: 18,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: "#111827",
          }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "bold" }}>
            Today's Decisions
          </Text>
        </Pressable>

        <Text style={{ fontSize: 16, marginBottom: 18 }}>{result.message}</Text>

        <Pressable
          onPress={() => setShowPlanner((prev) => !prev)}
          style={{
            marginBottom: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: "#d0d0d0",
            borderRadius: 12,
            backgroundColor: "#ffffff",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "#111827" }}>
            {showPlanner ? "Hide Investment Planner" : "Show Investment Planner"}
          </Text>
          <Text style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
            {showPlanner
              ? "Collapse the planner once your numbers are set."
              : "Expand to adjust your investment amount, new cash, and reserve settings."}
          </Text>
        </Pressable>

        {showPlanner && (
          <View
            style={{
              padding: 16,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: "#d0d0d0",
              borderRadius: 12,
              backgroundColor: "#ffffff",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
              Investment Planner
            </Text>

            <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 12, lineHeight: 20 }}>
              Enter your investment amount. If you are adding fresh money, you can
              also enter only the new cash you want to deploy. The app will build
              an updated action plan from that amount.
            </Text>

            <Text style={{ fontSize: 14, marginBottom: 6 }}>Investment Amount ($)</Text>
            <TextInput
              value={investmentAmount}
              onChangeText={setInvestmentAmount}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              placeholder="Enter investment amount"
              style={{
                borderWidth: 1,
                borderColor: "#cbd5e1",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 12,
                backgroundColor: "#ffffff",
              }}
            />

            <Text style={{ fontSize: 14, marginBottom: 6 }}>
              New Cash to Deploy ($) — Optional
            </Text>
            <TextInput
              value={newCashToDeploy}
              onChangeText={setNewCashToDeploy}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              placeholder="Leave blank to plan from full amount"
              style={{
                borderWidth: 1,
                borderColor: "#cbd5e1",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 12,
                backgroundColor: "#ffffff",
              }}
            />

            <Text style={{ fontSize: 14, marginBottom: 6 }}>Cash Reserve (%)</Text>
            <TextInput
              value={cashReservePct}
              onChangeText={setCashReservePct}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              placeholder="Enter cash reserve %"
              style={{
                borderWidth: 1,
                borderColor: "#cbd5e1",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 12,
                backgroundColor: "#ffffff",
              }}
            />

            <Pressable
              onPress={resetPlanner}
              style={{
                alignSelf: "flex-start",
                marginBottom: 12,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: "#111827",
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "bold" }}>
                Reset Planner
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
              <InfoPill label={`Mode: ${planningMode}`} />
              <InfoPill label={`Investment: ${formatCurrency(parsedInvestmentAmount)}`} />
              <InfoPill label={`New Cash: ${formatCurrency(parsedNewCashToDeploy)}`} />
              <InfoPill label={`Planning Amount: ${formatCurrency(basePlanningAmount)}`} />
              <InfoPill label={`Cash Reserve: ${formatCurrency(cashReserveDollars)}`} />
              <InfoPill label={`Usable for Plan: ${formatCurrency(planningCapital)}`} />
              <InfoPill label={`Core Target: ${formatCurrency(totalCoreTarget)}`} />
              <InfoPill label={`Leverage Target: ${formatCurrency(totalLeverageTarget)}`} />
            </View>
          </View>
        )}

        <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 6 }}>
          Quick Order Summary
        </Text>

        <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 12, lineHeight: 20 }}>
          Review these estimated orders first. They are sorted by action priority
          and based on whole-share planning using your selected planning amount.
        </Text>

        {sortedQuickOrders.map((item: any) => (
          <QuickOrderRow
            key={`quick-${item.ticker}`}
            item={item}
            planningCapital={planningCapital}
          />
        ))}

        <View
          onLayout={(event) => {
            actionCenterY.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 6, marginTop: 10 }}>
            Action Center
          </Text>

          <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 12, lineHeight: 20 }}>
            Take action on these names first. They currently have active strategy
            signals based on trend, leadership, and tactical conditions.
          </Text>
        </View>

        {sortedActionItems.map((item: any) => (
          <StockCard
            key={`action-${item.ticker}`}
            item={item}
            planningCapital={planningCapital}
          />
        ))}

        <Pressable
          onPress={() => setShowFullDashboard((prev) => !prev)}
          style={{
            marginTop: 20,
            marginBottom: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: "#d0d0d0",
            borderRadius: 12,
            backgroundColor: "#ffffff",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "#111827" }}>
            {showFullDashboard ? "Hide Full Mag 7 Dashboard" : "Show Full Mag 7 Dashboard"}
          </Text>
          <Text style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
            {showFullDashboard
              ? "Collapse the full dashboard to keep focus on the action sections."
              : "Expand to review all seven stocks in full detail."}
          </Text>
        </Pressable>

        {showFullDashboard &&
          result.summary.map((item: any) => (
            <StockCard
              key={item.ticker}
              item={item}
              planningCapital={planningCapital}
            />
          ))}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}