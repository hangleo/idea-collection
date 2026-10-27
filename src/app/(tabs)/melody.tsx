import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetMusic } from '@/components/sheet-music';
import { IdeaMetaForm } from '@/components/idea-meta-form';
import { ReminderPicker } from '@/components/reminder-picker';
import { Chip } from '@/components/chips';
import { melodyDurationMs, playMelody, playPitch, type CancelPlayback } from '@/lib/piano-engine';
import { buildPitch, NOTE_DURATIONS, toNoteEvents, type Accidental } from '@/lib/melody';
import { ensureNotificationSetup, notificationsUnsupportedReason, scheduleIdeaReminder } from '@/lib/notifications';
import { useIdeaStore } from '@/lib/store';
import { radius, useTheme, type ThemeColors } from '@/lib/theme';
import type { IdeaDraft, Idea, NoteEvent, ScoreNote } from '@/lib/types';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [4, 5];

export default function MelodyScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const ideas = useIdeaStore((s) => s.ideas);
  const addIdea = useIdeaStore((s) => s.addIdea);
  const updateIdea = useIdeaStore((s) => s.updateIdea);
  const insets = useSafeAreaInsets();

  const [score, setScore] = useState<ScoreNote[]>([]);
  const [letter, setLetter] = useState('C');
  const [accidental, setAccidental] = useState<Accidental>('natural');
  const [octave, setOctave] = useState(4);
  const [durationIndex, setDurationIndex] = useState(2); // quarter
  const [activePitch, setActivePitch] = useState<string | null>(null);
  const [playing, setPlaying] = useState<'draft' | Idea | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<IdeaDraft>({ title: '', text: '', tags: [], category: 'Music' });
  const [reminder, setReminder] = useState<Date | null>(null);

  const cancelPlaybackRef = useRef<CancelPlayback | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreScrollRef = useRef<ScrollViewInstance | null>(null);

  const musicalIdeas = useMemo(() => ideas.filter((i) => i.melody && i.melody.length > 0), [ideas]);
  const scoreEvents = useMemo(() => toNoteEvents(score), [score]);
  const nextPitch = useMemo(() => buildPitch(letter, accidental, octave), [letter, accidental, octave]);

  useEffect(() => {
    return () => {
      cancelPlaybackRef.current?.();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const flashKey = (pitch: string, ms = 240) => {
    setActivePitch(pitch);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setActivePitch(null), ms);
  };

  const stopPlayback = () => {
    cancelPlaybackRef.current?.();
    cancelPlaybackRef.current = null;
    setPlaying(null);
    setActivePitch(null);
  };

  const playScore = (events: NoteEvent[], source: Idea | 'draft') => {
    if (events.length === 0) return;
    stopPlayback();
    setPlaying(source);
    cancelPlaybackRef.current = playMelody(events, flashKey, () => {
      setPlaying(null);
      setActivePitch(null);
    });
  };

  const addNote = () => {
    if (!nextPitch) {
      Alert.alert('Out of range', 'That note falls outside the composer range (C4–B5).');
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    playPitch(nextPitch);
    setScore((notes) => [...notes, { pitch: nextPitch, beats: NOTE_DURATIONS[durationIndex].beats }]);
  };

  const undo = () => setScore((notes) => notes.slice(0, -1));

  const clearScore = () => {
    stopPlayback();
    setScore([]);
  };

  const saveMelody = async () => {
    if (saving || score.length === 0) return;
    setSaving(true);
    try {
      stopPlayback();
      const idea = addIdea({ ...draft, melody: scoreEvents });
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
      clearScore();
      setDraft({ title: '', text: '', tags: [], category: 'Music' });
      setReminder(null);
      setSaving(false);
      router.push('/');
    } catch {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 48 }}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Melody</Text>
          <Text style={styles.headerSubtitle}>
            Write musical notes on the staff — play them back as piano
          </Text>
        </View>
      </View>

      <View style={styles.scoreCard}>
        <View style={styles.scoreMeta}>
          <Text style={styles.tempoLabel}>100 BPM</Text>
          <Text style={styles.scoreCount}>
            {score.length > 0
              ? `${score.length} notes · ${Math.round(melodyDurationMs(scoreEvents) / 100) / 10}s`
              : 'Empty score'}
          </Text>
        </View>
        <ScrollView
          ref={scoreScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scoreScrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={{ flex: 1, minWidth: '100%' }}>
            <SheetMusic notes={score} activePitch={activePitch} />
          </View>
        </ScrollView>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => playScore(scoreEvents, 'draft')}
          disabled={score.length === 0}
          style={[styles.toolButton, score.length === 0 && { opacity: 0.4 }]}
        >
          <Ionicons name={playing === 'draft' ? 'pause' : 'play'} size={16} color={t.accent} />
          <Text style={[styles.toolText, { color: t.accent }]}>
            {playing === 'draft' ? 'Stop' : 'Play'}
          </Text>
        </Pressable>

        <Pressable
          onPress={undo}
          disabled={score.length === 0}
          style={[styles.toolButton, score.length === 0 && { opacity: 0.4 }]}
        >
          <Ionicons name="arrow-undo" size={16} color={t.textDim} />
          <Text style={styles.toolText}>Undo</Text>
        </Pressable>

        <Pressable
          onPress={clearScore}
          disabled={score.length === 0}
          style={[styles.toolButton, score.length === 0 && { opacity: 0.4 }]}
        >
          <Ionicons name="trash-outline" size={16} color={t.danger} />
          <Text style={[styles.toolText, { color: t.danger }]}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.builderCard}>
        <Text style={styles.builderTitle}>Add a note</Text>

        <View style={styles.builderRow}>
          {LETTERS.map((l) => (
            <Chip
              key={l}
              label={l}
              selected={letter === l}
              onPress={() => setLetter(l)}
            />
          ))}
        </View>

        <View style={styles.builderRow}>
          <View style={styles.builderGroup}>
            {(['flat', 'natural', 'sharp'] as Accidental[]).map((a) => {
              const symbol = a === 'flat' ? '♭' : a === 'sharp' ? '♯' : '♮';
              const invalid =
                (a === 'sharp' && (letter === 'E' || letter === 'B')) ||
                (a === 'flat' && (letter === 'C' || letter === 'F'));
              return (
                <Chip
                  key={a}
                  label={symbol}
                  selected={accidental === a}
                  disabled={invalid}
                  onPress={() => setAccidental(a)}
                />
              );
            })}
          </View>
          <View style={styles.builderGroup}>
            {OCTAVES.map((o) => (
              <Chip key={o} label={`Oct ${o}`} selected={octave === o} onPress={() => setOctave(o)} />
            ))}
          </View>
        </View>

        <View style={styles.builderRow}>
          {NOTE_DURATIONS.map((d, i) => (
            <Chip
              key={d.label}
              label={d.label}
              small
              selected={durationIndex === i}
              onPress={() => setDurationIndex(i)}
            />
          ))}
        </View>

        <Text style={styles.builderPreview}>
          {nextPitch ? `Next: ${nextPitch.replace('#', '♯')} · ${NOTE_DURATIONS[durationIndex].label} note` : 'Next: out of range'}
        </Text>

        <Pressable style={styles.addButton} onPress={addNote}>
          <Ionicons name="add" size={18} color={t.onAccent} />
          <Text style={styles.addButtonText}>Add note to score</Text>
        </Pressable>
      </View>

      {score.length > 0 ? (
        <View style={styles.saveSection}>
          <Text style={styles.sectionLabel}>Save this melody as an idea</Text>
          <IdeaMetaForm value={draft} onChange={setDraft} textPlaceholder="What inspired this melody?" />
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Reminder</Text>
          <ReminderPicker value={reminder} onChange={setReminder} />
          <Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={saveMelody}>
            <Ionicons name="musical-notes" size={18} color={t.onAccent} />
            <Text style={styles.saveButtonText}>Save musical idea</Text>
          </Pressable>
        </View>
      ) : null}

      {musicalIdeas.length > 0 ? (
        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Saved melodies</Text>
          {musicalIdeas.map((idea) => {
            const isPlaying = playing === idea;
            return (
              <View key={idea.id} style={styles.melodyRow}>
                <Pressable
                  style={styles.melodyPlay}
                  onPress={() =>
                    isPlaying ? stopPlayback() : playScore(idea.melody ?? [], idea)
                  }
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={t.onAccent} />
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/idea/${idea.id}`)}>
                  <Text style={styles.melodyTitle} numberOfLines={1}>
                    {idea.title}
                  </Text>
                  <Text style={styles.melodyMeta}>
                    {idea.melody?.length} notes · {Math.round(melodyDurationMs(idea.melody ?? []) / 100) / 10}s
                  </Text>
                </Pressable>
                <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
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
    },
    headerTitle: {
      color: t.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      color: t.textFaint,
      fontSize: 13,
      marginTop: 3,
    },
    scoreCard: {
      marginHorizontal: 20,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.lg,
      paddingVertical: 10,
      marginBottom: 12,
    },
    scoreMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      marginBottom: 2,
    },
    tempoLabel: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    scoreCount: {
      color: t.textDim,
      fontSize: 11,
      fontWeight: '700',
    },
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    toolButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: radius.full,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    toolText: {
      color: t.textDim,
      fontSize: 12,
      fontWeight: '700',
    },
    builderCard: {
      marginHorizontal: 20,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.lg,
      padding: 14,
    },
    builderTitle: {
      color: t.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 8,
    },
    builderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 0,
    },
    builderGroup: {
      flexDirection: 'row',
      marginRight: 12,
    },
    builderPreview: {
      color: t.textFaint,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      marginBottom: 10,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: t.accent,
      borderRadius: radius.md,
      paddingVertical: 12,
    },
    addButtonText: {
      color: t.onAccent,
      fontWeight: '800',
      fontSize: 13,
    },
    saveSection: {
      paddingHorizontal: 20,
      marginTop: 18,
    },
    sectionLabel: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: t.accent,
      borderRadius: radius.md,
      paddingVertical: 14,
      marginTop: 16,
    },
    saveButtonText: {
      color: t.onAccent,
      fontWeight: '800',
      fontSize: 14,
    },
    listSection: {
      paddingHorizontal: 20,
      marginTop: 26,
    },
    melodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.md,
      padding: 12,
      marginBottom: 10,
    },
    melodyPlay: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    melodyTitle: {
      color: t.text,
      fontSize: 14,
      fontWeight: '700',
    },
    melodyMeta: {
      color: t.textFaint,
      fontSize: 12,
      marginTop: 2,
    },
  });
