import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IdeaMetaForm } from '@/components/idea-meta-form';
import { ReminderPicker } from '@/components/reminder-picker';
import { TagPill } from '@/components/chips';
import { SheetMusic } from '@/components/sheet-music';
import { formatClock, formatReminder, inHours } from '@/lib/format';
import { addIdeaToCalendar, ensureCalendarPermission, getWritableCalendars, type CalendarOption } from '@/lib/calendar';
import { playMelody, playPitch, type CancelPlayback } from '@/lib/piano-engine';
import type { PitchName } from '@/lib/note-sources';
import { cancelReminder, ensureNotificationSetup, notificationsUnsupportedReason, scheduleIdeaReminder } from '@/lib/notifications';
import { useIdeaStore } from '@/lib/store';
import { categoryColor, radius, useTheme, type ThemeColors } from '@/lib/theme';
import { ideaKind, type IdeaDraft } from '@/lib/types';

export default function IdeaDetailScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const idea = useIdeaStore((s) => s.ideas.find((i) => i.id === id));
  const updateIdea = useIdeaStore((s) => s.updateIdea);
  const deleteIdea = useIdeaStore((s) => s.deleteIdea);
  const toggleFavorite = useIdeaStore((s) => s.toggleFavorite);
  const insets = useSafeAreaInsets();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [activePitch, setActivePitch] = useState<string | null>(null);
  const [playingMelody, setPlayingMelody] = useState(false);
  const [calendars, setCalendars] = useState<CalendarOption[] | null>(null);
  const [calendarModal, setCalendarModal] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  const cancelPlaybackRef = useRef<CancelPlayback | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useAudioPlayer(idea?.audioUri ?? null);
  const status = useAudioPlayerStatus(player);

  const kind = idea ? ideaKind(idea) : 'text';
  const catColor = useMemo(() => (idea ? categoryColor(idea.category) : t.accent), [idea, t]);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    return () => {
      cancelPlaybackRef.current?.();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  if (!idea) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: t.textDim }}>Idea not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: t.accent, fontWeight: '700' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const flashKey = (pitch: string, ms = 200) => {
    setActivePitch(pitch);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setActivePitch(null), ms);
  };

  const toggleMelody = () => {
    if (!idea.melody?.length) return;
    if (playingMelody) {
      cancelPlaybackRef.current?.();
      cancelPlaybackRef.current = null;
      setPlayingMelody(false);
      setActivePitch(null);
      return;
    }
    setPlayingMelody(true);
    cancelPlaybackRef.current = playMelody(idea.melody, flashKey, () => {
      setPlayingMelody(false);
      setActivePitch(null);
    });
  };

  const tapNote = (pitch: PitchName) => {
    playPitch(pitch);
    flashKey(pitch);
  };

  const togglePlayAudio = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const startEditing = () => {
    setDraft({ title: idea.title, text: idea.text, tags: [...idea.tags], category: idea.category });
    setEditing(true);
  };

  const saveEdits = () => {
    if (!draft) return;
    updateIdea(idea.id, {
      title: draft.title.trim() || 'Untitled idea',
      text: draft.text,
      tags: draft.tags,
      category: draft.category,
    });
    setEditing(false);
    setDraft(null);
  };

  const changeReminder = async (date: Date | null) => {
    await cancelReminder(idea.reminderNotificationId);
    if (!date || date.getTime() <= Date.now()) {
      updateIdea(idea.id, { reminderAt: null, reminderNotificationId: null });
      return;
    }
    const granted = await ensureNotificationSetup();
    if (!granted) {
      Alert.alert('Reminders unavailable', notificationsUnsupportedReason());
      return;
    }
    const notificationId = await scheduleIdeaReminder(idea.id, idea.title, date);
    updateIdea(idea.id, { reminderAt: date.toISOString(), reminderNotificationId: notificationId });
  };

  const removeIdea = () => {
    Alert.alert('Delete idea', `"${idea.title}" will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          cancelReminder(idea.reminderNotificationId);
          deleteIdea(idea.id);
          router.back();
        },
      },
    ]);
  };

  const openCalendarPicker = async () => {
    const granted = await ensureCalendarPermission();
    if (!granted) {
      Alert.alert('Calendar access needed', 'Enable calendar access in Settings to schedule ideas.');
      return;
    }
    try {
      const list = await getWritableCalendars();
      if (list.length === 0) {
        Alert.alert('No calendars', 'No writable calendar was found on this device.');
        return;
      }
      setCalendars(list);
      setCalendarModal(true);
    } catch {
      Alert.alert('Calendar error', 'Could not load your calendars.');
    }
  };

  const addToCalendar = async (option: CalendarOption) => {
    setCalendarModal(false);
    setAddingToCalendar(true);
    try {
      const start = idea.reminderAt ? new Date(idea.reminderAt) : inHours(1);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const notes = [
        idea.text,
        idea.tags.length ? `Tags: ${idea.tags.map((x) => `#${x}`).join(' ')}` : '',
        idea.melody?.length ? `Melody: ${idea.melody.map((n) => n.pitch).join(' ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const eventId = await addIdeaToCalendar(option, {
        title: idea.title,
        notes,
        startDate: start,
        endDate: end,
      });
      if (eventId) {
        updateIdea(idea.id, { calendarEventId: eventId });
        Alert.alert('Added to calendar', `"${idea.title}" was scheduled in "${option.title}".`);
      }
    } catch {
      Alert.alert('Calendar error', 'Could not create the calendar event.');
    } finally {
      setAddingToCalendar(false);
    }
  };

  const progress =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.circleButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => toggleFavorite(idea.id)} style={styles.circleButton} hitSlop={8}>
            <Ionicons
              name={idea.favorite ? 'star' : 'star-outline'}
              size={20}
              color={idea.favorite ? t.amber : t.textDim}
            />
          </Pressable>
          {editing ? (
            <Pressable onPress={saveEdits} style={[styles.circleButton, styles.editActive]} hitSlop={8}>
              <Ionicons name="checkmark" size={20} color={t.onAccent} />
            </Pressable>
          ) : (
            <Pressable onPress={startEditing} style={styles.circleButton} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={t.textDim} />
            </Pressable>
          )}
          <Pressable onPress={removeIdea} style={styles.circleButton} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={t.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {editing && draft ? (
          <View style={{ marginTop: 16 }}>
            <IdeaMetaForm value={draft} onChange={setDraft} />
            <Pressable style={styles.primaryButton} onPress={saveEdits}>
              <Text style={styles.primaryButtonText}>Save changes</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{idea.title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.catPill, { backgroundColor: `${catColor}22` }]}>
                <View style={[styles.catDot, { backgroundColor: catColor }]} />
                <Text style={[styles.catText, { color: catColor }]}>{idea.category}</Text>
              </View>
              {idea.reminderAt ? (
                <View style={styles.reminderPill}>
                  <Ionicons name="alarm" size={12} color={t.amber} />
                  <Text style={styles.reminderPillText}>{formatReminder(new Date(idea.reminderAt))}</Text>
                </View>
              ) : null}
            </View>

            {kind === 'voice' ? (
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable style={styles.playButton} onPress={togglePlayAudio}>
                    <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={t.onAccent} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionCardTitle}>Voice recording</Text>
                    <Text style={styles.sectionCardSub}>
                      {formatClock(status.duration > 0 ? status.duration * 1000 : idea.audioDurationMs ?? 0)}
                      {status.playing ? ` · ${formatClock(status.currentTime * 1000)}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            ) : null}

            {kind === 'musical' && idea.melody ? (
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Pressable style={[styles.playButton, { backgroundColor: t.teal }]} onPress={toggleMelody}>
                    <Ionicons name={playingMelody ? 'pause' : 'play'} size={20} color={t.onAccent} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionCardTitle}>Melody</Text>
                    <Text style={styles.sectionCardSub}>
                      {idea.melody.length} notes · tap any note to hear it
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <SheetMusic
                    notes={idea.melody}
                    activePitch={activePitch}
                    onPressNote={(index) => tapNote(idea.melody?.[index]?.pitch as PitchName)}
                  />
                </View>
              </View>
            ) : null}

            {idea.text ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Notes</Text>
                <Text style={styles.bodyText}>{idea.text}</Text>
              </View>
            ) : null}

            {idea.tags.length > 0 ? (
              <View style={styles.tagWrap}>
                {idea.tags.map((tag) => (
                  <TagPill key={tag} tag={tag} color={t.accent} />
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Reminder</Text>
            <ReminderPicker
              value={idea.reminderAt ? new Date(idea.reminderAt) : null}
              onChange={changeReminder}
            />

            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Calendar</Text>
            <Pressable style={styles.calendarButton} onPress={openCalendarPicker} disabled={addingToCalendar}>
              {addingToCalendar ? (
                <ActivityIndicator size="small" color={t.accent} />
              ) : (
                <Ionicons name="calendar-outline" size={18} color={t.accent} />
              )}
              <Text style={styles.calendarButtonText}>
                {idea.calendarEventId ? 'Add to another calendar' : 'Add to Google / iOS calendar'}
              </Text>
            </Pressable>
            {idea.calendarEventId ? (
              <Text style={styles.calendarHint}>✓ This idea was added to your calendar</Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={calendarModal} transparent animationType="fade" onRequestClose={() => setCalendarModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCalendarModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a calendar</Text>
            {(calendars ?? []).map((option) => (
              <Pressable key={option.id} style={styles.calendarRow} onPress={() => addToCalendar(option)}>
                <View style={[styles.calDot, { backgroundColor: option.color ?? t.accent }]} />
                <Text style={styles.calTitle} numberOfLines={1}>
                  {option.title}
                </Text>
                {option.isGoogle ? (
                  <View style={styles.googleBadge}>
                    <Text style={styles.googleBadgeText}>Google</Text>
                  </View>
                ) : null}
                <Ionicons name="add" size={18} color={t.textDim} />
              </Pressable>
            ))}
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
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    circleButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editActive: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    title: {
      color: t.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      lineHeight: 32,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
      marginBottom: 16,
    },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    catDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    catText: {
      fontSize: 12,
      fontWeight: '700',
    },
    reminderPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: t.amberSoft,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    reminderPillText: {
      color: t.amber,
      fontSize: 11,
      fontWeight: '700',
    },
    sectionCard: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.lg,
      padding: 14,
      marginBottom: 14,
    },
    sectionCardTitle: {
      color: t.text,
      fontSize: 14,
      fontWeight: '700',
    },
    sectionCardSub: {
      color: t.textFaint,
      fontSize: 12,
      marginTop: 2,
    },
    playButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: t.border,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: t.accent,
      borderRadius: 2,
    },
    bodyText: {
      color: t.textDim,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
    },
    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 6,
    },
    sectionLabel: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginTop: 6,
    },
    calendarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.accent,
      backgroundColor: t.accentSoft,
      borderRadius: radius.md,
      paddingVertical: 13,
    },
    calendarButtonText: {
      color: t.accent,
      fontWeight: '700',
      fontSize: 13,
    },
    calendarHint: {
      color: t.green,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    modalCard: {
      width: '100%',
      backgroundColor: t.cardElevated,
      borderRadius: radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    modalTitle: {
      color: t.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 12,
    },
    calendarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: t.borderSoft,
    },
    calDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    calTitle: {
      flex: 1,
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
    },
    googleBadge: {
      backgroundColor: 'rgba(52, 168, 83, 0.15)',
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    googleBadgeText: {
      color: '#3BAA63',
      fontSize: 10,
      fontWeight: '800',
    },
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: radius.md,
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 16,
    },
    primaryButtonText: {
      color: t.onAccent,
      fontWeight: '800',
      fontSize: 14,
    },
  });
