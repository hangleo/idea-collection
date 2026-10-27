import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatReminder, inMinutes, tonight, tomorrowAt } from '@/lib/format';
import { radius, useResolvedThemeMode, useTheme, type ThemeColors } from '@/lib/theme';

interface ReminderPickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
}

function fallbackPickerDate(value: Date | null): Date {
  return value ?? inMinutes(30);
}

export function ReminderPicker({ value, onChange }: ReminderPickerProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const resolvedMode = useResolvedThemeMode();
  const [showPicker, setShowPicker] = useState(false);

  const preset = (label: string, getDate: () => Date) => (
    <Pressable
      key={label}
      style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}
      onPress={() => {
        setShowPicker(false);
        onChange(getDate());
      }}
    >
      <Text style={styles.presetText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.presetsRow}>
        {preset('In 1 hour', () => inMinutes(60))}
        {preset('Tonight', () => tonight())}
        {preset('Tomorrow 9 AM', () => tomorrowAt(9))}
        <Pressable
          style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }, showPicker && styles.presetActive]}
          onPress={() => setShowPicker((s) => !s)}
        >
          <Text style={styles.presetText}>Custom…</Text>
        </Pressable>
      </View>

      {showPicker ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={fallbackPickerDate(value)}
            mode="datetime"
            themeVariant={resolvedMode}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_event, date) => {
              if (Platform.OS === 'android') setShowPicker(false);
              if (date) onChange(date);
            }}
          />
        </View>
      ) : null}

      {value ? (
        <View style={styles.activeRow}>
          <Ionicons name="alarm" size={14} color={t.amber} />
          <Text style={styles.activeText}>{formatReminder(value)}</Text>
          <Pressable hitSlop={10} onPress={() => onChange(null)} style={styles.clear}>
            <Ionicons name="close-circle" size={18} color={t.textFaint} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    preset: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: radius.full,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    presetActive: {
      borderColor: t.accent,
      backgroundColor: t.accentSoft,
    },
    presetText: {
      color: t.textDim,
      fontSize: 12,
      fontWeight: '600',
    },
    pickerWrap: {
      borderRadius: radius.md,
      overflow: 'hidden',
      alignItems: 'flex-start',
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: t.amberSoft,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    activeText: {
      color: t.amber,
      fontSize: 12,
      fontWeight: '700',
    },
    clear: {
      marginLeft: 4,
    },
  });
