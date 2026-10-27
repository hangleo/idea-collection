import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { NOTE_SOURCES, type PitchName } from './note-sources';
import type { NoteEvent } from './types';

const players = new Map<string, AudioPlayer>();

export type CancelPlayback = () => void;

function playerFor(pitch: string): AudioPlayer | null {
  let player = players.get(pitch);
  if (!player) {
    const source = NOTE_SOURCES[pitch as PitchName];
    if (!source) return null;
    try {
      player = createAudioPlayer(source);
      players.set(pitch, player);
    } catch {
      return null;
    }
  }
  return player;
}

export function playPitch(pitch: string): void {
  const player = playerFor(pitch);
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // player released or busy — ignore
  }
}

export function melodyDurationMs(notes: NoteEvent[]): number {
  return notes.reduce((max, n) => Math.max(max, n.startMs + n.durationMs), 0);
}

export function playMelody(
  notes: NoteEvent[],
  onNote?: (pitch: string) => void,
  onDone?: () => void,
): CancelPlayback {
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const note of notes) {
    timers.push(
      setTimeout(() => {
        playPitch(note.pitch);
        onNote?.(note.pitch);
      }, note.startMs),
    );
  }
  timers.push(setTimeout(() => onDone?.(), melodyDurationMs(notes) + 120));
  return () => timers.forEach(clearTimeout);
}

export function releasePianoEngine(): void {
  players.forEach((player) => {
    try {
      player.release();
    } catch {
      // already released
    }
  });
  players.clear();
}
