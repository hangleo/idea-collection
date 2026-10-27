import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClock, formatRelative, formatReminder } from '@/lib/format';
import { categoryColor, radius, useTheme, type ThemeColors } from '@/lib/theme';
import { ideaKind, type Idea } from '@/lib/types';

interface IdeaCardProps {
  idea: Idea;
  onPress: () => void;
  onLongPress?: () => void;
}

export function IdeaCard({ idea, onPress, onLongPress }: IdeaCardProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const kind = ideaKind(idea);

  const meta = {
    voice: { icon: 'mic-outline' as const, color: t.accent, bg: t.accentSoft },
    musical: { icon: 'musical-notes-outline' as const, color: t.teal, bg: t.tealSoft },
    text: { icon: 'document-text-outline' as const, color: t.amber, bg: t.amberSoft },
  }[kind];

  const catColor = categoryColor(idea.category);

  let snippet: string;
  if (kind === 'voice') {
    snippet = `Voice note · ${formatClock(idea.audioDurationMs ?? 0)}`;
  } else if (kind === 'musical') {
    snippet = `Melody · ${idea.melody?.length ?? 0} notes`;
  } else {
    snippet = idea.text;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] }]}
    >
      <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          {idea.favorite ? (
            <Ionicons name="star" size={13} color={t.amber} style={styles.star} />
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {idea.title}
          </Text>
        </View>
        <Text style={styles.snippet} numberOfLines={2}>
          {snippet}
        </Text>

        <View style={styles.footer}>
          <View style={styles.catPill}>
            <View style={[styles.catDot, { backgroundColor: catColor }]} />
            <Text style={styles.catText}>{idea.category}</Text>
          </View>
          {idea.reminderAt ? (
            <View style={styles.reminderBadge}>
              <Ionicons name="alarm-outline" size={11} color={t.amber} />
              <Text style={styles.reminderText}>{formatReminder(new Date(idea.reminderAt))}</Text>
            </View>
          ) : null}
          <Text style={styles.time}>{formatRelative(idea.createdAt)}</Text>
        </View>

        {idea.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {idea.tags.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.tag}>
                #{tag}
              </Text>
            ))}
            {idea.tags.length > 3 ? (
              <Text style={styles.tagMore}>+{idea.tags.length - 3}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: t.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: t.borderSoft,
      padding: 14,
      marginBottom: 12,
      gap: 12,
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    star: {
      marginRight: 5,
    },
    title: {
      color: t.text,
      fontSize: 15,
      fontWeight: '700',
      flexShrink: 1,
    },
    snippet: {
      color: t.textDim,
      fontSize: 13,
      marginTop: 3,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 9,
      gap: 8,
    },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.bgSoft,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      gap: 5,
    },
    catDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    catText: {
      color: t.textDim,
      fontSize: 11,
      fontWeight: '600',
    },
    reminderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    reminderText: {
      color: t.amber,
      fontSize: 10,
      fontWeight: '600',
    },
    time: {
      color: t.textFaint,
      fontSize: 11,
      marginLeft: 'auto',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 7,
    },
    tag: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '600',
      marginRight: 8,
    },
    tagMore: {
      color: t.textFaint,
      fontSize: 11,
    },
  });
