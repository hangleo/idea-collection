import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '@/components/chips';
import { EmptyState } from '@/components/empty-state';
import { IdeaCard } from '@/components/idea-card';
import { radius, useResolvedThemeMode, useSettingsStore, useTheme, type ThemeColors, type ThemeMode } from '@/lib/theme';
import { useIdeaStore } from '@/lib/store';
import { ideaKind, type Idea } from '@/lib/types';

type KindFilter = 'all' | 'voice' | 'musical' | 'text';

const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'voice', label: '🎙 Voice' },
  { key: 'musical', label: '♪ Musical' },
  { key: 'text', label: '✎ Text' },
];

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'contrast-outline' },
  { key: 'dark', label: 'Dark Modern', icon: 'moon-outline' },
  { key: 'light', label: 'Light Modern', icon: 'sunny-outline' },
];

export default function IdeasScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const resolvedMode = useResolvedThemeMode();

  const ideas = useIdeaStore((s) => s.ideas);
  const categories = useIdeaStore((s) => s.categories);
  const deleteIdea = useIdeaStore((s) => s.deleteIdea);
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [themeModal, setThemeModal] = useState(false);

  const allTags = useMemo(() => {
    const seen = new Set<string>();
    ideas.forEach((idea) => idea.tags.forEach((tag) => seen.add(tag)));
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const usedCategories = useMemo(
    () => categories.filter((c) => ideas.some((i) => i.category === c)),
    [categories, ideas],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (kind !== 'all' && ideaKind(idea) !== kind) return false;
      if (selectedCategory && idea.category !== selectedCategory) return false;
      if (
        selectedTags.length > 0 &&
        !selectedTags.some((tag) => idea.tags.some((x) => x.toLowerCase() === tag.toLowerCase()))
      )
        return false;
      if (q) {
        const haystack = `${idea.title} ${idea.text} ${idea.tags.join(' ')} ${idea.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [ideas, query, kind, selectedTags, selectedCategory]);

  const toggleTag = (tag: string) =>
    setSelectedTags((tags) =>
      tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag],
    );

  const confirmDelete = (idea: Idea) => {
    Alert.alert('Delete idea', `"${idea.title}" will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteIdea(idea.id) },
    ]);
  };

  const hasFilters = query.trim() !== '' || kind !== 'all' || selectedTags.length > 0 || selectedCategory !== null;

  const themeIcon: keyof typeof Ionicons.glyphMap =
    themeMode === 'system' ? 'contrast-outline' : themeMode === 'dark' ? 'moon' : 'sunny';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Ideas</Text>
          <Text style={styles.headerCount}>
            {ideas.length} captured{ideas.some((i) => i.reminderAt) ? ` · ${ideas.filter((i) => i.reminderAt).length} with reminders` : ''}
          </Text>
        </View>
        <Pressable onPress={() => setThemeModal(true)} style={styles.themeButton} hitSlop={6}>
          <Ionicons name={themeIcon} size={19} color={t.textDim} />
        </Pressable>
        {hasFilters ? (
          <Ionicons
            name="close-circle"
            size={26}
            color={t.textFaint}
            onPress={() => {
              setQuery('');
              setKind('all');
              setSelectedTags([]);
              setSelectedCategory(null);
            }}
          />
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={t.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ideas, tags, categories…"
          placeholderTextColor={t.textFaint}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query ? (
          <Ionicons name="close" size={16} color={t.textFaint} onPress={() => setQuery('')} />
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(idea) => idea.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={styles.filters}>
            <View style={styles.filterRow}>
              {KIND_FILTERS.map((f) => (
                <Chip key={f.key} label={f.label} selected={kind === f.key} onPress={() => setKind(f.key)} />
              ))}
            </View>
            {usedCategories.length > 0 ? (
              <View style={styles.filterRow}>
                {usedCategories.map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    selected={selectedCategory === category}
                    onPress={() => setSelectedCategory((c) => (c === category ? null : category))}
                  />
                ))}
              </View>
            ) : null}
            {allTags.length > 0 ? (
              <View style={styles.filterRow}>
                {allTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={`#${tag}`}
                    small
                    selected={selectedTags.includes(tag)}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <IdeaCard
            idea={item}
            onPress={() => router.push(`/idea/${item.id}`)}
            onLongPress={() => confirmDelete(item)}
            key={item.id}
          />
        )}
        ListEmptyComponent={
          ideas.length === 0 ? (
            <EmptyState
              icon="bulb-outline"
              title="No ideas yet"
              subtitle="Capture your first spark — record your voice, write a note, or compose a melody on the piano."
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title="Nothing matches"
              subtitle="Try clearing some filters or searching for something else."
            />
          )
        }
      />

      <Modal visible={themeModal} transparent animationType="fade" onRequestClose={() => setThemeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setThemeModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Theme</Text>
            {THEME_OPTIONS.map((option) => {
              const active = themeMode === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={styles.themeRow}
                  onPress={() => {
                    setThemeMode(option.key);
                    setThemeModal(false);
                  }}
                >
                  <Ionicons name={option.icon} size={18} color={active ? t.accent : t.textDim} />
                  <Text style={[styles.themeRowText, active && { color: t.accent }]}>{option.label}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={t.accent} /> : null}
                </Pressable>
              );
            })}
            <Text style={styles.themeHint}>Currently using {resolvedMode === 'light' ? 'Light Modern' : 'Dark Modern'}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 14,
      gap: 12,
    },
    headerTitle: {
      color: t.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    headerCount: {
      color: t.textFaint,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    themeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.md,
      marginHorizontal: 20,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: t.text,
      fontSize: 14,
      paddingVertical: 0,
    },
    filters: {
      paddingBottom: 4,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      padding: 16,
    },
    modalCard: {
      width: 230,
      backgroundColor: t.cardElevated,
      borderRadius: radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    modalTitle: {
      color: t.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 10,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
    },
    themeRowText: {
      flex: 1,
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
    },
    themeHint: {
      color: t.textFaint,
      fontSize: 11,
      marginTop: 8,
    },
  });
