import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDashboardSignals, formatPercent } from '@/src/engine/dashboardSignals';

export default function HomeScreen() {
  const signals = buildDashboardSignals();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>MAG 7 Tactical Tracker</Text>

      {signals.map((s) => (
        <View key={s.ticker} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.ticker}>{s.ticker}</Text>
            <Text style={styles.signal}>{s.signal}</Text>
          </View>

          <Text style={styles.company}>{s.company}</Text>

          <View style={styles.grid}>
            <Metric label="Trend" value={s.trendUp ? 'Uptrend' : 'Downtrend'} />
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
  title: { color: '#D4AF37', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#1b1e24', padding: 14, borderRadius: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ticker: { color: '#fff', fontSize: 20, fontWeight: '700' },
  signal: { color: '#D4AF37', fontWeight: '700' },
  company: { color: '#aaa', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '30%', backgroundColor: '#111', padding: 6, borderRadius: 8 },
  metricLabel: { color: '#888', fontSize: 10 },
  metricValue: { color: '#fff', fontWeight: '600' },
  explanation: { color: '#aaa', marginTop: 10, fontSize: 12 }
});
