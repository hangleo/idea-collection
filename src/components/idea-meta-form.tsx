import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, TagPill } from './chips';
import { useAllTags, useIdeaStore } from '@/lib/store';
import { categoryColor, radius, useTheme, type ThemeColors } from '@/lib/theme';
import type { IdeaDraft } from '@/lib/types';

interface IdeaMetaFormProps {
  value: IdeaDraft;
  onChange: (draft: IdeaDraft) => void;
  textPlaceholder?: string;
}

export function IdeaMetaForm({ value, onChange, textPlaceholder = 'Describe the idea…' }: IdeaMetaFormProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const categories = useIdeaStore((s) => s.categories);
  const addCategory = useIdeaStore((s) => s.addCategory);
  const suggestions = useAllTags();
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const commitCategory = () => {
    const name = newCategory.trim();
    if (name) {
      addCategory(name);
      onChange({ ...value, category: name });
    }
    setNewCategory('');
    setAddingCategory(false);
  };

  const addTag = (tag: string) => {
    const clean = tag.trim().replace(/^#/, '');
    if (!clean) return;
    if (value.tags.some((x) => x.toLowerCase() === clean.toLowerCase())) return;
    onChange({ ...value, tags: [...value.tags, clean] });
  };

  const removeTag = (tag: string) =>
    onChange({ ...value, tags: value.tags.filter((x) => x !== tag) });

  const untakenSuggestions = suggestions.filter(
    (s) => !value.tags.some((x) => x.toLowerCase() === s.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.titleInput}
        placeholder="Title"
        placeholderTextColor={t.textFaint}
        value={value.title}
        onChangeText={(title) => onChange({ ...value, title })}
        returnKeyType="done"
      />

      <TextInput
        style={styles.textInput}
        placeholder={textPlaceholder}
        placeholderTextColor={t.textFaint}
        value={value.text}
        onChangeText={(text) => onChange({ ...value, text })}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.sectionLabel}>Tags</Text>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          placeholder="Add a tag…"
          placeholderTextColor={t.textFaint}
          onSubmitEditing={(e) => addTag(e.nativeEvent.text)}
          returnKeyType="done"
          autoCapitalize="none"
        />
        <Ionicons name="pricetag-outline" size={16} color={t.textFaint} />
      </View>
      {value.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {value.tags.map((tag) => (
            <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)} />
          ))}
        </View>
      ) : null}
      {untakenSuggestions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestRow}>
          {untakenSuggestions.slice(0, 10).map((tag) => (
            <Chip key={tag} label={`#${tag}`} small onPress={() => addTag(tag)} />
          ))}
        </ScrollView>
      ) : null}

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.catRow}>
        {categories.map((category) => (
          <Chip
            key={category}
            label={category}
            selected={value.category === category}
            color={categoryColor(category)}
            onPress={() => onChange({ ...value, category })}
          />
        ))}
        <Chip
          label={addingCategory ? 'Cancel' : '＋ New'}
          selected={false}
          onPress={() => {
            if (addingCategory) {
              setNewCategory('');
              setAddingCategory(false);
            } else {
              setAddingCategory(true);
            }
          }}
        />
      </View>
      {addingCategory ? (
        <TextInput
          style={styles.tagInput}
          placeholder="New category name…"
          placeholderTextColor={t.textFaint}
          value={newCategory}
          onChangeText={setNewCategory}
          onSubmitEditing={commitCategory}
          returnKeyType="done"
          autoFocus
        />
      ) : null}
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    titleInput: {
      backgroundColor: t.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.borderSoft,
      color: t.text,
      fontSize: 16,
      fontWeight: '700',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    textInput: {
      backgroundColor: t.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.borderSoft,
      color: t.text,
      fontSize: 14,
      minHeight: 90,
      textAlignVertical: 'top',
      paddingHorizontal: 14,
      paddingVertical: 12,
      lineHeight: 20,
    },
    sectionLabel: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 10,
    },
    tagInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.borderSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    tagInput: {
      flex: 1,
      color: t.text,
      fontSize: 14,
      paddingVertical: 2,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    suggestRow: {
      marginTop: 2,
    },
    catRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
  });
