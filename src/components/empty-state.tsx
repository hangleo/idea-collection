import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, useTheme, type ThemeColors } from '@/lib/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={30} color={t.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 70,
      paddingHorizontal: 40,
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: radius.lg,
      backgroundColor: t.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      color: t.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
    },
    subtitle: {
      color: t.textFaint,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
