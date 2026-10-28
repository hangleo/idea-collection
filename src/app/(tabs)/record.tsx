import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IdeaMetaForm } from '@/components/idea-meta-form';
import { ReminderPicker } from '@/components/reminder-picker';
import { SheetMusic } from '@/components/sheet-music';
import { formatClock, uid } from '@/lib/format';
import { eventsToScore } from '@/lib/melody';
import {
  ensureNotificationSetup,
  notificationsUnsupportedReason,
  scheduleIdeaReminder,
} from '@/lib/notifications';
import { MelodyTracker, trackedToNoteEvents } from '@/lib/pitch';import { useIdeaStore } from '@/lib/store';
import {
  abortSpeechRecognition,
  ensureSpeechPermissions,
  speechAvailable,
  speechDeviceLocale,
  speechUnavailableReason,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '@/lib/speech';
import { radius, useTheme, type ThemeColors } from '@/lib/theme';
import type { IdeaDraft, IdeaMarker, NoteEvent } from '@/lib/types';

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

  // live capture state
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 26 }, () => 5));
  const [melodyNotes, setMelodyNotes] = useState<{ pitch: string; startMs: number; durationMs: number }[]>([]);
  const [markers, setMarkers] = useState<IdeaMarker[]>([]);
  const [markerInput, setMarkerInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [sttHint, setSttHint] = useState<string | null>(null);
  const [keepingMelody, setKeepingMelody] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const pulse = useMemo(() => new Animated.Value(1), []);
  const trackerRef = useRef(new MelodyTracker());
  const rmsRef = useRef<number[]>([]);
  const barTickRef = useRef(0);
  const lastElapsedRef = useRef(0);
  const sttStartRef = useRef(0);
  const recordingRef = useRef(false);
  const transcriptRef = useRef<string[]>([]);
  const speechStopRef = useRef<(() => void) | null>(null);
  const restartSpeechRef = useRef<() => void>(() => {});

  const player = useAudioPlayer(recordedUri);
  const playerStatus = useAudioPlayerStatus(player);

  // --- simultaneous capture pipeline -------------------------------------
  const handleBuffer = useCallback((buffer: AudioStreamBuffer) => {
    const ms = buffer.timestamp * 1000;
    lastElapsedRef.current = ms;

    const data = new Float32Array(buffer.data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      sum += v * v;
    }
    const level = Math.sqrt(sum / Math.max(1, data.length));
    const hist = rmsRef.current;
    hist.push(level);
    if (hist.length > 26) hist.shift();
    barTickRef.current += 1;
    if (barTickRef.current % 2 === 0) {
      setBars([...hist]);
      setElapsed(ms);
    }

    const tracker = trackerRef.current;
    const before = tracker.notes.length;
    tracker.process(data, buffer.sampleRate, ms);
    if (tracker.notes.length !== before) {
      setMelodyNotes([...trackedToNoteEvents(tracker.notes)]);
    }
  }, []);

  const streamOptions = useMemo(
    () => ({
      sampleRate: 48000,
      channels: 1,
      encoding: 'float32' as const,
      onBuffer: handleBuffer,
    }),
    [handleBuffer],
  );
  const { stream } = useAudioStream(streamOptions);

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

  useEffect(() => {
    (async () => {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          'Microphone needed',
          'Idea Collection needs microphone access to record ideas. Enable it in Settings.',
        );
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      abortSpeechRecognition();
      speechStopRef.current?.();
      try {
        stream.stop();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMarker = useCallback((atMs: number, text: string, auto: boolean) => {
    const clean = text.trim();
    if (!clean) return;
    setMarkers((prev) => {
      const last = prev[prev.length - 1];
      // merge rapid-fire speech results into the previous auto marker
      if (auto && last && Math.abs(last.atMs - atMs) < 900 && last.auto) {
        return [...prev.slice(0, -1), { ...last, text: `${last.text} ${clean}`.trim() }];
      }
      const next = [...prev, { id: uid(), atMs: Math.round(atMs), text: clean, auto }];
      return next.sort((a, b) => a.atMs - b.atMs);
    });
  }, []);

  const handleSpeechResult = useCallback(
    (transcript: string, isFinal: boolean, segments: { startTimeMillis: number; endTimeMillis: number; segment: string }[]) => {
      setLiveTranscript(isFinal ? '' : transcript);
      if (!isFinal || !transcript.trim()) return;
      const joined = transcript.trim();
      transcriptRef.current = [...transcriptRef.current, joined];
      setDraft((prev) => {
        const existing = prev.text.trim();
        return existing ? prev : { ...prev, text: transcriptRef.current.join(' ') };
      });
      const seg = segments.length > 0 ? segments[segments.length - 1] : null;
      const atMs = seg ? sttStartRef.current + seg.startTimeMillis : lastElapsedRef.current;
      addMarker(atMs, joined, true);
    },
    [addMarker],
  );

  const restartSpeech = useCallback(() => {
    if (!recordingRef.current || !speechAvailable) return;
    speechStopRef.current?.();
    sttStartRef.current = lastElapsedRef.current;
    speechStopRef.current = startSpeechRecognition(
      {
        onResult: handleSpeechResult,
        onError: (code) => {
          if (code !== 'aborted' && code !== 'no-speech') setSttHint(code);
        },
        onEnd: () => restartSpeechRef.current(),
      },
      speechDeviceLocale,
    );
  }, [handleSpeechResult]);

  useEffect(() => {
    restartSpeechRef.current = restartSpeech;
  }, [restartSpeech]);

  const startCapture = async () => {
    try {
      trackerRef.current.reset();
      rmsRef.current = [];
      transcriptRef.current = [];
      setMelodyNotes([]);
      setMarkers([]);
      setLiveTranscript('');
      setSttHint(null);
      setKeepingMelody(true);
      setDraft({ title: '', text: '', tags: [], category: 'Spark' });
      setReminder(null);

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      });
      await stream.start();
      await stream.startFileRecordingAsync({ directory: 'document', format: 'wav' });
      recordingRef.current = true;
      setPhase('recording');

      if (speechAvailable) {
        const granted = await ensureSpeechPermissions();
        if (granted) {
          sttStartRef.current = lastElapsedRef.current;
          speechStopRef.current = startSpeechRecognition(
            {
              onResult: handleSpeechResult,
              onError: (code) => {
                if (code !== 'aborted' && code !== 'no-speech') setSttHint(code);
              },
              onEnd: () => restartSpeechRef.current(),
            },
            speechDeviceLocale,
          );
          if (!speechStopRef.current) setSttHint('start-failed');
        } else {
          setSttHint('no-permission');
        }
      }
    } catch {
      Alert.alert('Recording failed', 'Could not start the microphone. Try again.');
      recordingRef.current = false;
      setPhase('idle');
    }
  };

  const stopCapture = async () => {
    try {
      recordingRef.current = false;
      stopSpeechRecognition();
      speechStopRef.current?.();
      speechStopRef.current = null;

      const tracker = trackerRef.current;
      tracker.finalize();
      setMelodyNotes([...trackedToNoteEvents(tracker.notes)]);

      const result = await stream.stopFileRecordingAsync();
      stream.stop();
      setRecordedUri(result.uri);
      setRecordedMs(Math.round(result.duration * 1000));
      setPhase('review');
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    } catch {
      Alert.alert('Recording failed', 'Could not finalize the recording.');
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
    setMelodyNotes([]);
    setMarkers([]);
    setLiveTranscript('');
    setSttHint(null);
    setMarkerInput('');
    setDraft({ title: '', text: '', tags: [], category: 'Spark' });
    setReminder(null);
    setPhase('idle');
  };

  const addManualMarker = () => {
    const text = markerInput.trim();
    if (!text) return;
    addMarker(lastElapsedRef.current, text, false);
    setMarkerInput('');
  };

  const previewMarker = (marker: IdeaMarker) => {
    if (!recordedUri) return;
    try {
      player.seekTo(marker.atMs / 1000);
      player.play();
    } catch {}
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const melody: NoteEvent[] | null = keepingMelody && melodyNotes.length > 0 ? melodyNotes : null;
      const text = draft.text;
      if (!draft.title.trim() && !text.trim() && !recordedUri && !melody) {
        Alert.alert('Nothing to save', 'Record something or add a note first.');
        setSaving(false);
        return;
      }
      const idea = addIdea({
        ...draft,
        text,
        audioUri: recordedUri,
        audioDurationMs: recordedMs,
        melody,
        markers: markers.length > 0 ? markers : null,
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

  const elapsedMs = phase === 'recording' ? elapsed : recordedMs;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.headerTitle}>Capture</Text>
      <Text style={styles.headerSubtitle}>One tap: voice + melody detection + speech-to-text</Text>

      {phase !== 'review' ? (
        <View style={styles.stage}>
          <View style={styles.barsRow}>
            {(phase === 'recording' ? bars : bars.map(() => 5)).map((height, i) => (
              <View key={i} style={[styles.bar, { height: Math.max(4, Math.min(40, height * 160 + 4)) }]} />
            ))}
          </View>

          <Text style={styles.timer}>{formatClock(elapsedMs)}</Text>
          <Text style={styles.stageHint}>
            {phase === 'idle'
              ? 'Hum a melody, talk, and type — all captured at once'
              : 'Tap markers below while recording'}
          </Text>

          {!speechAvailable && phase === 'idle' ? (
            <Text style={styles.sttHint}>{speechUnavailableReason()}</Text>
          ) : null}

          {phase === 'recording' ? (
            <>
              {melodyNotes.length > 0 ? (
                <View style={styles.liveMelody}>
                  {melodyNotes.slice(-10).map((note, i) => (
                    <Text key={`${note.pitch}-${i}`} style={styles.liveMelodyNote}>
                      {note.pitch.replace('#', '♯')}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.liveHint}>Hummed notes will appear here…</Text>
              )}

              {liveTranscript ? (
                <Text style={styles.liveTranscript} numberOfLines={2}>
                  “{liveTranscript}”
                </Text>
              ) : null}
              {sttHint ? <Text style={styles.sttHint}>Speech-to-text: {sttHint}</Text> : null}

              <View style={styles.markerInputRow}>
                <TextInput
                  style={styles.markerInput}
                  placeholder="Quick note @ this moment…"
                  placeholderTextColor={t.textFaint}
                  value={markerInput}
                  onChangeText={setMarkerInput}
                  onSubmitEditing={addManualMarker}
                  returnKeyType="done"
                />
                <Pressable style={styles.markerAdd} onPress={addManualMarker}>
                  <Ionicons name="bookmark" size={16} color={t.onAccent} />
                </Pressable>
              </View>

              {markers.length > 0 ? (
                <View style={styles.markerList}>
                  {markers.slice(-4).map((marker) => (
                    <Text key={marker.id} style={styles.markerRow} numberOfLines={1}>
                      <Text style={styles.markerTime}>{formatClock(marker.atMs)}  </Text>
                      {marker.text}
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          <Animated.View style={{ transform: [{ scale: phase === 'recording' ? pulse : 1 }], marginTop: 24 }}>
            <Pressable
              onPress={phase === 'recording' ? stopCapture : startCapture}
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
              <Text style={styles.playerSub}>
                {formatClock(recordedMs)}
                {melodyNotes.length > 0 ? ` · ${melodyNotes.length} melody notes` : ''}
                {markers.length > 0 ? ` · ${markers.length} notes` : ''}
              </Text>
            </View>
            <Pressable onPress={reset} hitSlop={8}>
              <Ionicons name="refresh" size={20} color={t.textFaint} />
            </Pressable>
          </View>

          {melodyNotes.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Detected melody</Text>
                <Pressable onPress={() => setKeepingMelody((k) => !k)}>
                  <Text style={[styles.cardAction, !keepingMelody && { color: t.textFaint }]}>
                    {keepingMelody ? 'Keep ✓' : 'Discard'}
                  </Text>
                </Pressable>
              </View>
              {keepingMelody ? (
                <>
                  <SheetMusic notes={eventsToScore(melodyNotes)} />
                  <Text style={styles.cardHint}>Detected from your humming — timings match the audio.</Text>
                </>
              ) : null}
            </View>
          ) : null}

          {markers.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Synced notes</Text>
              {markers.map((marker) => (
                <Pressable
                  key={marker.id}
                  style={styles.markerRowReview}
                  onPress={() => previewMarker(marker)}
                >
                  <Text style={styles.markerTime}>{formatClock(marker.atMs)}</Text>
                  <Text style={styles.markerText} numberOfLines={2}>
                    {marker.text}
                  </Text>
                  <Ionicons
                    name="close"
                    size={15}
                    color={t.textFaint}
                    onPress={() => setMarkers((prev) => prev.filter((m) => m.id !== marker.id))}
                  />
                </Pressable>
              ))}
              <Text style={styles.cardHint}>Tap a note to play the audio from that moment.</Text>
            </View>
          ) : null}

          <IdeaMetaForm
            value={draft}
            onChange={setDraft}
            textPlaceholder={speechAvailable ? 'Transcript fills in here — or type…' : 'Type your notes here…'}
          />

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
      paddingTop: 20,
      width: '100%',
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
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
      marginTop: 18,
      fontVariant: ['tabular-nums'],
    },
    stageHint: {
      color: t.textFaint,
      fontSize: 12,
      marginTop: 4,
      marginBottom: 14,
      textAlign: 'center',
    },
    liveMelody: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 8,
    },
    liveMelodyNote: {
      color: t.teal,
      backgroundColor: t.tealSoft,
      fontSize: 12,
      fontWeight: '800',
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    liveHint: {
      color: t.textFaint,
      fontSize: 12,
      marginBottom: 8,
    },
    liveTranscript: {
      color: t.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 4,
      fontStyle: 'italic',
    },
    sttHint: {
      color: t.textFaint,
      fontSize: 11,
      marginBottom: 6,
    },
    markerInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'stretch',
      marginTop: 8,
    },
    markerInput: {
      flex: 1,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.full,
      color: t.text,
      fontSize: 13,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    markerAdd: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerList: {
      alignSelf: 'stretch',
      marginTop: 8,
      gap: 3,
    },
    markerRow: {
      color: t.textDim,
      fontSize: 12,
    },
    markerTime: {
      color: t.accent,
      fontWeight: '800',
      fontSize: 11,
      fontVariant: ['tabular-nums'],
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
    card: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: radius.lg,
      padding: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    cardTitle: {
      color: t.text,
      fontSize: 14,
      fontWeight: '700',
    },
    cardAction: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    cardHint: {
      color: t.textFaint,
      fontSize: 11,
      marginTop: 8,
    },
    markerRowReview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: t.borderSoft,
    },
    markerText: {
      flex: 1,
      color: t.text,
      fontSize: 13,
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
