export type PitchName =
  | 'C4' | 'C#4' | 'D4' | 'D#4' | 'E4' | 'F4' | 'F#4' | 'G4' | 'G#4' | 'A4' | 'A#4' | 'B4'
  | 'C5' | 'C#5' | 'D5' | 'D#5' | 'E5' | 'F5' | 'F#5' | 'G5' | 'G#5' | 'A5' | 'A#5' | 'B5';

export const PITCHES: PitchName[] = [
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
];

export const NOTE_SOURCES: Record<PitchName, number> = {
  C4: require('../../assets/notes/c4.wav'),
  'C#4': require('../../assets/notes/cs4.wav'),
  D4: require('../../assets/notes/d4.wav'),
  'D#4': require('../../assets/notes/ds4.wav'),
  E4: require('../../assets/notes/e4.wav'),
  F4: require('../../assets/notes/f4.wav'),
  'F#4': require('../../assets/notes/fs4.wav'),
  G4: require('../../assets/notes/g4.wav'),
  'G#4': require('../../assets/notes/gs4.wav'),
  A4: require('../../assets/notes/a4.wav'),
  'A#4': require('../../assets/notes/as4.wav'),
  B4: require('../../assets/notes/b4.wav'),
  C5: require('../../assets/notes/c5.wav'),
  'C#5': require('../../assets/notes/cs5.wav'),
  D5: require('../../assets/notes/d5.wav'),
  'D#5': require('../../assets/notes/ds5.wav'),
  E5: require('../../assets/notes/e5.wav'),
  F5: require('../../assets/notes/f5.wav'),
  'F#5': require('../../assets/notes/fs5.wav'),
  G5: require('../../assets/notes/g5.wav'),
  'G#5': require('../../assets/notes/gs5.wav'),
  A5: require('../../assets/notes/a5.wav'),
  'A#5': require('../../assets/notes/as5.wav'),
  B5: require('../../assets/notes/b5.wav'),
};

export const WHITE_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

export const BLACK_AFTER: Record<string, number> = {
  'C#': 0,
  'D#': 1,
  'F#': 3,
  'G#': 4,
  'A#': 5,
};

export const BLACK_TO_WHITE_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  F: 3,
  G: 4,
  A: 5,
};
