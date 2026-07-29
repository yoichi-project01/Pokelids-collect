import { StyleSheet, Text, View } from 'react-native';

export function ProgressBar({ total, collected }: { total: number; collected: number }) {
  const ratio = total > 0 ? collected / total : 0;
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <Text style={styles.label}>
        {collected}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#e0e0e0', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#e3350d' },
  label: { fontSize: 13, color: '#555', minWidth: 56, textAlign: 'right' },
});
