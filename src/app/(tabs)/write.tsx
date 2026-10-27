import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IdeaMetaForm } from '@/components/idea-meta-form';
import { ReminderPicker } from '@/components/reminder-picker';
import { ensureNotificationSetup, notificationsUnsupportedReason, scheduleIdeaReminder } from '@/lib/notifications';
import { useIdeaStore } from '@/lib/store';
import { radius, useTheme, type ThemeColors } from '@/lib/theme';
import type { IdeaDraft } from '@/lib/types';

const EMPTY_DRAFT: IdeaDraft = { title: '', text: '', tags: [], category: 'Spark' };

export default function WriteScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const addIdea = useIdeaStore((s) => s.addIdea);
  const updateIdea = useIdeaStore((s) => s.updateIdea);
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<IdeaDraft>(EMPTY_DRAFT);
  const [reminder, setReminder] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!draft.title.trim() && !draft.text.trim()) {
      Alert.alert('Nothing to save', 'Write a title or some notes first.');
      return;
    }
    setSaving(true);
    try {
      const idea = addIdea(draft);
      if (reminder && reminder.getTime() > Date.now()) {
        const granted = await ensureNotificationSetup();
        if (granted) {
          const notificationId = await scheduleIdeaReminder(idea.id, idea.title, reminder);
          updateIdea(idea.id, {
            reminderAt: reminder.toISOString(),
            reminderNotificationId: notificationId,
          });
        } else {
          Alert.alert('Reminders unavailable', notificationsUnsupportedReason());
        }
      }
      setDraft(EMPTY_DRAFT);
      setReminder(null);
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.headerTitle}>Write</Text>
      <Text style={styles.headerSubtitle}>Jot the idea down in words</Text>

      <View style={styles.formSection}>
        <IdeaMetaForm value={draft} onChange={setDraft} textPlaceholder="Write your idea here…" />

        <Text style={styles.sectionLabel}>Reminder</Text>
        <ReminderPicker value={reminder} onChange={setReminder} />

        <View style={styles.actionsRow}>
          <Pressable style={styles.discardButton} onPress={() => setDraft(EMPTY_DRAFT)}>
            <Text style={styles.discardText}>Clear</Text>
          </Pressable>
          <Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={save}>
            <Ionicons name="checkmark" size={18} color={t.onAccent} />
            <Text style={styles.saveText}>Save idea</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    headerTitle: {
      color: t.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      paddingHorizontal: 20,
    },
    headerSubtitle: {
      color: t.textFaint,
      fontSize: 13,
      paddingHorizontal: 20,
      marginTop: 3,
      marginBottom: 16,
    },
    formSection: {
      paddingHorizontal: 20,
      gap: 14,
    },
    sectionLabel: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 4,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    discardButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
    },
    discardText: {
      color: t.textDim,
      fontWeight: '700',
      fontSize: 14,
    },
    saveButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: t.accent,
    },
    saveText: {
      color: t.onAccent,
      fontWeight: '800',
      fontSize: 14,
    },
  });
