import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { snapBeats } from '@/lib/melody';
import { useTheme, type ThemeColors } from '@/lib/theme';

const LINE_GAP = 12;
const STAFF_LINES = 5;
const STAFF_HEIGHT = LINE_GAP * (STAFF_LINES - 1);
const STAFF_TOP = 26;
const BOTTOM_LINE = STAFF_TOP + STAFF_HEIGHT;
const MIDDLE_LINE = STAFF_TOP + LINE_GAP * 2;

const HEAD_W = 15;
const HEAD_H = 10.5;
const STEM_H = 34;
const FLAG_H = 12;
const NOTE_GAP = 38;
const START_X = 22;
const LEDGER_W = 24;

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const E4_INDEX = 4 * 7 + LETTER_INDEX.E; // bottom staff line in treble clef

function diatonicIndex(pitch: string): number {
  const letter = pitch[0].toUpperCase();
  const octave = parseInt(pitch[pitch.length - 1], 10);
  if (Number.isNaN(octave)) return E4_INDEX;
  return octave * 7 + (LETTER_INDEX[letter] ?? 0);
}

function headYFor(pitch: string): number {
  return BOTTOM_LINE - (diatonicIndex(pitch) - E4_INDEX) * (LINE_GAP / 2);
}

type GlyphKind = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

function glyphFor(beats: number | undefined): GlyphKind {
  const snapped = snapBeats(beats ?? 1);
  if (snapped >= 4) return 'whole';
  if (snapped >= 2) return 'half';
  if (snapped >= 1) return 'quarter';
  if (snapped >= 0.5) return 'eighth';
  return 'sixteenth';
}

interface SheetMusicProps {
  notes: { pitch: string; beats?: number }[];
  activePitch?: string | null;
  onPressNote?: (index: number) => void;
}

export function SheetMusic({ notes, activePitch, onPressNote }: SheetMusicProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const contentWidth = START_X + Math.max(notes.length, 1) * NOTE_GAP + 28;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: contentWidth, height: STAFF_TOP + STAFF_HEIGHT + 24 }}>
        {Array.from({ length: STAFF_LINES }, (_, i) => (
          <View key={i} style={[styles.line, { top: STAFF_TOP + i * LINE_GAP }]} />
        ))}

        {notes.map((note, i) => {
          const headY = headYFor(note.pitch);
          const x = START_X + i * NOTE_GAP;
          const glyph = glyphFor(note.beats);
          const isActive = activePitch != null && activePitch === note.pitch;
          const color = isActive ? t.accent : t.text;
          const stemUp = headY >= MIDDLE_LINE;
          const hollow = glyph === 'whole' || glyph === 'half';
          const hasStem = glyph !== 'whole';
          const flags = glyph === 'eighth' ? 1 : glyph === 'sixteenth' ? 2 : 0;
          const stemX = stemUp ? x + HEAD_W - 2 : x + 1;
          const stemTop = stemUp ? headY - STEM_H : headY;
          const needsLedger = headY < STAFF_TOP || headY > BOTTOM_LINE;

          return (
            <Pressable
              key={`${note.pitch}-${i}`}
              disabled={!onPressNote}
              onPress={() => onPressNote?.(i)}
              hitSlop={6}
            >
              <View style={{ position: 'absolute', left: 0, top: 0 }}>
                {needsLedger ? (
                  <View
                    style={[
                      styles.ledger,
                      { left: x - (LEDGER_W - HEAD_W) / 2, top: headY - 1 },
                    ]}
                  />
                ) : null}

                {note.pitch.includes('#') ? (
                  <Text style={[styles.accidental, { left: x - 13, top: headY - 7, color: isActive ? t.accent : t.textDim }]}>
                    ♯
                  </Text>
                ) : null}

                <View
                  style={[
                    styles.head,
                    hollow && styles.headHollow,
                    {
                      left: x,
                      top: headY - HEAD_H / 2,
                      backgroundColor: hollow ? 'transparent' : color,
                      borderColor: color,
                      transform: [{ scale: isActive ? 1.25 : 1 }],
                    },
                  ]}
                />

                {hasStem ? (
                  <View
                    style={[
                      styles.stem,
                      { left: stemX, top: stemTop, backgroundColor: color },
                    ]}
                  />
                ) : null}

                {hasStem && flags > 0 ? (
                  Array.from({ length: flags }, (_, f) => (
                    <View
                      key={f}
                      style={[
                        styles.flag,
                        {
                          left: stemX,
                          top: stemUp ? stemTop + FLAG_H * (f + 1) : stemTop + STEM_H - FLAG_H * (f + 1),
                          backgroundColor: color,
                        },
                      ]}
                    />
                  ))
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    line: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: t.border,
    },
    ledger: {
      position: 'absolute',
      width: LEDGER_W,
      height: 1,
      backgroundColor: t.border,
    },
    accidental: {
      position: 'absolute',
      fontSize: 12,
      fontWeight: '700',
    },
    head: {
      position: 'absolute',
      width: HEAD_W,
      height: HEAD_H,
      borderRadius: HEAD_W / 2,
    },
    headHollow: {
      borderWidth: 2,
    },
    stem: {
      position: 'absolute',
      width: 1.5,
      height: STEM_H,
      borderRadius: 1,
    },
    flag: {
      position: 'absolute',
      width: 9,
      height: 2,
      borderRadius: 1,
      transform: [{ rotate: '-22deg' }],
    },
  });
