import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IdeaMetaForm } from '@/components/idea-meta-form';
import { ReminderPicker } from '@/components/reminder-picker';
import { formatClock } from '@/lib/format';
import { ensureNotificationSetup, notificationsUnsupportedReason, scheduleIdeaReminder } from '@/lib/notifications';
import { useIdeaStore } from '@/lib/store';
import { radius, useTheme, type ThemeColors } from '@/lib/theme';
import type { IdeaDraft } from '@/lib/types';

type Phase = 'idle' | 'recording' | 'review';

export default function RecordScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const addIdea = useIdeaStore((s) => s.addIdea);
  const updateIdea = useIdeaStore((s) => s.updateIdea);
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('idle');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedMs, setRecordedMs] = useState(0);
  const [draft, setDraft] = useState<IdeaDraft>({ title: '', text: '', tags: [], category: 'Spark' });
  const [reminder, setReminder] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const pulse = useMemo(() => new Animated.Value(1), []);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder, 100);

  const player = useAudioPlayer(recordedUri);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (status.granted) {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } else {
        Alert.alert(
          'Microphone needed',
          'Idea Collection needs microphone access to record voice ideas. Enable it in Settings.',
        );
      }
    })();
    return () => {
      if (recorder.isRecording) recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [phase, pulse]);

  const startRecording = async () => {
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      Alert.alert('Recording failed', 'Could not start the microphone. Try again.');
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('no uri');
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecordedUri(uri);
      setRecordedMs(Math.round(recorderState.durationMillis ?? 0));
      setPhase('review');
    } catch {
      Alert.alert('Recording failed', 'Could not save the recording.');
      setPhase('idle');
    }
  };

  const reset = () => {
    try {
      player.pause();
      player.seekTo(0);
    } catch {}
    setRecordedUri(null);
    setRecordedMs(0);
    setDraft({ title: '', text: '', tags: [], category: 'Spark' });
    setReminder(null);
    setPhase('idle');
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const idea = addIdea({
        ...draft,
        audioUri: recordedUri,
        audioDurationMs: recordedMs || Math.round(recorderState.durationMillis ?? 0),
      });
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
      reset();
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  const bars = useMemo(() => {
    const tick = Math.floor((recorderState.durationMillis ?? 0) / 100);
    return Array.from({ length: 16 }, (_, i) => 8 + ((tick * 37 + i * 61) % 26));
  }, [recorderState.durationMillis]);

  const elapsed = phase === 'recording' ? recorderState.durationMillis ?? 0 : recordedMs;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 48 }}
    >
      <Text style={styles.headerTitle}>Record</Text>
      <Text style={styles.headerSubtitle}>Capture the idea before it escapes</Text>

      {phase !== 'review' ? (
        <View style={styles.stage}>
          {phase === 'recording' ? (
            <View style={styles.barsRow}>
              {bars.map((height, i) => (
                <View key={i} style={[styles.bar, { height }]} />
              ))}
            </View>
          ) : (
            <View style={styles.barsRow}>
              {Array.from({ length: 16 }, (_, i) => (
                <View key={i} style={[styles.bar, { height: 6, opacity: 0.25 }]} />
              ))}
            </View>
          )}

          <Text style={styles.timer}>{formatClock(elapsed)}</Text>
          <Text style={styles.stageHint}>
            {phase === 'idle' ? 'Tap to start recording' : 'Recording… tap to stop'}
          </Text>

          <Animated.View style={{ transform: [{ scale: phase === 'recording' ? pulse : 1 }] }}>
            <Pressable
              onPress={phase === 'recording' ? stopRecording : startRecording}
              style={[styles.recordButton, phase === 'recording' && styles.recordButtonActive]}
            >
              <Ionicons name={phase === 'recording' ? 'stop' : 'mic'} size={40} color={t.onAccent} />
            </Pressable>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.reviewSection}>
          <View style={styles.playerCard}>
            <Pressable
              style={styles.playButton}
              onPress={() => {
                if (playerStatus.playing) {
                  player.pause();
                } else {
                  player.play();
                }
              }}
            >
              <Ionicons name={playerStatus.playing ? 'pause' : 'play'} size={22} color={t.onAccent} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerTitle}>Voice idea</Text>
              <Text style={styles.playerSub}>{formatClock(recordedMs)} recorded</Text>
            </View>
            <Pressable onPress={reset} hitSlop={8}>
              <Ionicons name="refresh" size={20} color={t.textFaint} />
            </Pressable>
          </View>

          <IdeaMetaForm value={draft} onChange={setDraft} textPlaceholder="Add notes about this voice idea…" />

          <Text style={styles.sectionLabel}>Reminder</Text>
          <ReminderPicker value={reminder} onChange={setReminder} />

          <View style={styles.actionsRow}>
            <Pressable style={styles.discardButton} onPress={reset}>
              <Text style={styles.discardText}>Discard</Text>
            </Pressable>
            <Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={save}>
              <Ionicons name="checkmark" size={18} color={t.onAccent} />
              <Text style={styles.saveText}>Save idea</Text>
            </Pressable>
          </View>
        </View>
      )}
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
      marginBottom: 10,
    },
    stage: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 26,
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 44,
    },
    bar: {
      width: 4,
      borderRadius: 2,
      backgroundColor: t.accent,
    },
    timer: {
      color: t.text,
      fontSize: 44,
      fontWeight: '800',
      marginTop: 22,
      fontVariant: ['tabular-nums'],
    },
    stageHint: {
      color: t.textFaint,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 30,
    },
    recordButton: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.accent,
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    recordButtonActive: {
      backgroundColor: t.danger,
    },
    reviewSection: {
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 14,
    },
    playerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.lg,
      padding: 12,
    },
    playButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerTitle: {
      color: t.text,
      fontSize: 14,
      fontWeight: '700',
    },
    playerSub: {
      color: t.textFaint,
      fontSize: 12,
      marginTop: 2,
    },
    sectionLabel: {
      color: t.textFaint,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 10,
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
