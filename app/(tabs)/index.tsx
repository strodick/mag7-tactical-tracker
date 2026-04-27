import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

import { buildDashboardSignals, formatPercent } from '@/src/engine/dashboardSignals';
import { getMarketData } from '@/src/services/marketDataService';

export default function HomeScreen() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = (force = false) => {
    setLoading(true);

    getMarketData(force)
      .then((result) => {
        setSignals(buildDashboardSignals(result.data));
        setLastUpdated(result.lastUpdated);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error loading data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loading}>Loading MAG 7 data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>MAG 7 Tactical Tracker</Text>

      <Text style={styles.subtext}>
        Last updated: {lastUpdated ?? 'N/A'}
      </Text>

      <TouchableOpacity style={styles.refreshBtn} onPress={() => loadData(true)}>
        <Text style={styles.refreshText}>Refresh Data</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {signals.map((s) => (
        <View key={s.ticker} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.ticker}>{s.ticker}</Text>
            <Text
              style={{
                color:
                  s.signal === 'BUY'
                    ? '#4CAF50'
                    : s.signal === 'SELL'
                    ? '#E53935'
                    : s.signal === 'REDUCE'
                    ? '#FFA726'
                    : '#D4AF37',
                fontWeight: '700',
              }}
            >
              {s.signal}
            </Text>
          </View>

          <Text style={styles.company}>{s.company}</Text>

          <View style={styles.grid}>
            <Metric label="Trend" value={s.trendUp ? 'Up' : 'Down'} />
            <Metric label="Rank" value={`#${s.momentumRank}`} />
            <Metric label="6M" value={formatPercent(s.sixMonthReturn)} />
            <Metric label="Stoch" value={s.stochasticK.toFixed(0)} />
            <Metric label="Ext" value={formatPercent(s.extensionFrom200Day)} />
            <Metric label="Vol" value={s.volumeConfirmed ? 'OK' : 'Weak'} />
          </View>

          <Text style={styles.explanation}>{s.explanation}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: '#aaa', marginTop: 10 },
  title: { color: '#D4AF37', fontSize: 24, fontWeight: '700' },
  subtext: { color: '#888', marginBottom: 10 },
  refreshBtn: { backgroundColor: '#D4AF37', padding: 8, borderRadius: 8, marginBottom: 10 },
  refreshText: { textAlign: 'center', fontWeight: '700' },
  error: { color: '#ff6b6b', marginBottom: 10 },
  card: { backgroundColor: '#1b1e24', padding: 14, borderRadius: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ticker: { color: '#fff', fontSize: 20, fontWeight: '700' },
  company: { color: '#aaa', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '30%', backgroundColor: '#111', padding: 6, borderRadius: 8 },
  metricLabel: { color: '#888', fontSize: 10 },
  metricValue: { color: '#fff', fontWeight: '600' },
  explanation: { color: '#aaa', marginTop: 10, fontSize: 12 },
});
