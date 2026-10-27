import type { NoteEvent, ScoreNote } from './types';

export const MS_PER_BEAT = 600; // 100 BPM

export interface DurationOption {
  label: string;
  beats: number;
}

export const NOTE_DURATIONS: DurationOption[] = [
  { label: '1/1', beats: 4 },
  { label: '1/2', beats: 2 },
  { label: '1/4', beats: 1 },
  { label: '1/8', beats: 0.5 },
  { label: '1/16', beats: 0.25 },
];

/** Converts a written score into timed events for playback/storage. */
export function toNoteEvents(score: ScoreNote[], msPerBeat = MS_PER_BEAT): NoteEvent[] {
  let cursor = 0;
  return score.map((note) => {
    const durationMs = Math.round(note.beats * msPerBeat);
    const event: NoteEvent = {
      pitch: note.pitch,
      startMs: cursor,
      durationMs,
      beats: note.beats,
    };
    cursor += durationMs;
    return event;
  });
}

export function snapBeats(beats: number): number {
  return NOTE_DURATIONS.reduce(
    (best, option) => (Math.abs(option.beats - beats) < Math.abs(best - beats) ? option.beats : best),
    1,
  );
}

/** Converts stored events back into a written score (for the staff renderer). */
export function eventsToScore(notes: NoteEvent[], msPerBeat = MS_PER_BEAT): ScoreNote[] {
  return notes.map((note) => ({
    pitch: note.pitch,
    beats: note.beats ?? snapBeats(note.durationMs / msPerBeat),
  }));
}

const FLAT_MAP: Record<string, { pitch: string; octaveShift?: number }> = {
  C: { pitch: 'B', octaveShift: -1 },
  D: { pitch: 'C#' },
  E: { pitch: 'D#' },
  F: { pitch: 'E', octaveShift: -1 },
  G: { pitch: 'F#' },
  A: { pitch: 'G#' },
  B: { pitch: 'A#' },
};

export type Accidental = 'natural' | 'sharp' | 'flat';

/** Builds a pitch name (C4–B5) from letter + accidental + octave, or null if out of range. */
export function buildPitch(
  letter: string,
  accidental: Accidental,
  octave: number,
): string | null {
  if (accidental === 'natural') return `${letter}${octave}`;
  if (accidental === 'sharp') {
    if (letter === 'E' || letter === 'B') return null;
    return `${letter}#${octave}`;
  }
  const mapped = FLAT_MAP[letter];
  const resolvedOctave = octave + (mapped.octaveShift ?? 0);
  if (resolvedOctave < 4 || resolvedOctave > 5) return null;
  return `${mapped.pitch}${resolvedOctave}`;
}
