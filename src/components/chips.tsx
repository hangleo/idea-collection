import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, useTheme, type ThemeColors } from '@/lib/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
  small?: boolean;
  disabled?: boolean;
}

export function Chip({ label, selected = false, color, onPress, small = false, disabled = false }: ChipProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const accent = color ?? t.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        selected && { backgroundColor: accent, borderColor: accent },
        !selected && pressed && { opacity: 0.7 },
        disabled && styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          small && styles.chipLabelSmall,
          selected && { color: t.onAccent },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface TagPillProps {
  tag: string;
  color?: string;
  onRemove?: () => void;
}

export function TagPill({ tag, color, onRemove }: TagPillProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const accent = color ?? t.accent;

  return (
    <View style={[styles.tagPill, { borderColor: `${accent}55` }]}>
      <Text style={[styles.tagText, { color: accent }]}>#{tag}</Text>
      {onRemove ? (
        <Pressable hitSlop={8} onPress={onRemove} style={styles.tagRemove}>
          <Ionicons name="close" size={12} color={t.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    chip: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 8,
      marginBottom: 8,
    },
    chipSmall: {
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipDisabled: {
      opacity: 0.3,
    },
    chipLabel: {
      color: t.textDim,
      fontSize: 13,
      fontWeight: '600',
    },
    chipLabelSmall: {
      fontSize: 11,
    },
    tagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.full,
      borderWidth: 1,
      backgroundColor: t.bgSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginRight: 6,
      marginBottom: 6,
    },
    tagText: {
      fontSize: 11,
      fontWeight: '600',
    },
    tagRemove: {
      marginLeft: 3,
    },
  });
