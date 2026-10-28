/**
 * Pure (no React Native imports) real-time pitch detection and melody
 * segmentation, so it can be unit-tested outside the app.
 */

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Convert a frequency in Hz to a pitch name within the app range (C4–B5). */
export function freqToPitchName(freq: number): string {
  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.max(60, Math.min(83, Math.round(midiFloat)));
  return `${PITCH_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Downscales a PCM frame to roughly `targetRate` by block averaging. */
export function downsample(frame: Float32Array, sampleRate: number, targetRate = 8000): Float32Array {
  const factor = Math.max(1, Math.round(sampleRate / targetRate));
  if (factor === 1) return frame;
  const outLength = Math.floor(frame.length / factor);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += frame[i * factor + j];
    out[i] = sum / factor;
  }
  return out;
}

function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / Math.max(1, frame.length));
}

/**
 * Detects the fundamental frequency of a monophonic frame using normalized
 * autocorrelation over the 75–800 Hz range. Returns null for silence/noise.
 * Sub-harmonic (octave-down) errors are corrected by preferring the first
 * strong peak rather than the global maximum.
 */
export function detectPitch(frame: Float32Array, sampleRate: number): number | null {
  const level = rms(frame);
  if (level < 0.015) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / 800));
  const maxLag = Math.min(Math.floor(sampleRate / 75), frame.length - 1);
  if (maxLag <= minLag) return null;

  const window = frame.length - maxLag;
  let energy = 0;
  for (let i = 0; i < window; i++) energy += frame[i] * frame[i];
  if (energy < 1e-6) return null;

  // prefix sums of squares for O(1) lag energy
  const prefix = new Float64Array(frame.length + 1);
  for (let i = 0; i < frame.length; i++) prefix[i + 1] = prefix[i] + frame[i] * frame[i];

  const correlations = new Float32Array(maxLag + 1);
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < window; i++) corr += frame[i] * frame[i + lag];
    const lagEnergy = prefix[window + lag] - prefix[lag];
    const normalized = lagEnergy < 1e-9 ? 0 : corr / Math.sqrt(energy * lagEnergy);
    correlations[lag] = normalized;
    if (normalized > bestCorr) bestCorr = normalized;
  }

  if (bestCorr < 0.55) return null;

  // Prefer the earliest strong peak to avoid octave-down (sub-harmonic) errors.
  const threshold = Math.max(0.55, bestCorr * 0.9);
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (
      correlations[lag] >= threshold &&
      (lag === minLag || correlations[lag] >= correlations[lag - 1]) &&
      (lag === maxLag || correlations[lag] >= correlations[lag + 1])
    ) {
      return sampleRate / lag;
    }
  }
  return null;
}

export interface TrackedNote {
  pitch: string;
  freq: number;
  startMs: number;
  durationMs: number;
}

interface TrackerOptions {
  /** Minimum voiced length for a note segment, ms. */
  minSegmentMs?: number;
  /** Pitch stability tolerance in semitones. */
  toleranceSemitones?: number;
  /** Skip pitches outside this range (app samples cover C4–B5). */
  minMidi?: number;
  maxMidi?: number;
}

/**
 * Accumulates per-frame pitch detections into musical note segments.
 * Feed every PCM frame's detection result; completed segments are emitted
 * through `onSegment` and available via `notes`.
 */
export class MelodyTracker {
  private readonly minSegmentMs: number;
  private readonly tolerance: number;
  private readonly minMidi: number;
  private readonly maxMidi: number;

  private smoothFreq: number | null = null;
  private runFreqs: number[] = [];
  private runStartMs = 0;
  private lastMs = 0;
  private current: TrackedNote[] = [];

  onSegment?: (note: TrackedNote) => void;

  constructor(options: TrackerOptions = {}) {
    this.minSegmentMs = options.minSegmentMs ?? 140;
    this.tolerance = options.toleranceSemitones ?? 0.8;
    this.minMidi = options.minMidi ?? 57; // A3
    this.maxMidi = options.maxMidi ?? 84; // C6
  }

  get notes(): TrackedNote[] {
    return this.current;
  }

  /** Feed one processed frame. Returns the detected frequency (or null). */
  process(buffer: Float32Array, sampleRate: number, timestampMs: number): number | null {
    this.lastMs = timestampMs;
    const factor = Math.max(1, Math.round(sampleRate / 8000));
    const down = downsample(buffer, sampleRate, 8000);
    const freq = detectPitch(down, Math.round(sampleRate / factor));

    if (freq !== null) {
      const midiFloat = 69 + 12 * Math.log2(freq / 440);
      const inRange = midiFloat >= this.minMidi && midiFloat <= this.maxMidi;

      if (inRange && this.smoothFreq !== null) {
        const delta = Math.abs(12 * Math.log2(freq / this.smoothFreq));
        if (delta <= this.tolerance) {
          // continuation of the current run
          this.runFreqs.push(freq);
          return freq;
        }
      }

      // new pitch run (or out of previous run's range)
      this.closeRun(timestampMs);
      if (inRange) {
        this.smoothFreq = freq;
        this.runFreqs = [freq];
        this.runStartMs = timestampMs;
        return freq;
      }
      this.smoothFreq = null;
      this.runFreqs = [];
      return null;
    }

    // unvoiced frame
    this.closeRun(timestampMs);
    return null;
  }

  /** Emits the pending run as a note if it is long and stable enough. */
  closeRun(untilMs: number): void {
    const duration = untilMs - this.runStartMs;
    if (this.smoothFreq !== null && this.runFreqs.length > 0 && duration >= this.minSegmentMs) {
      const sorted = [...this.runFreqs].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      this.current.push({
        pitch: freqToPitchName(median),
        freq: median,
        startMs: Math.max(0, this.runStartMs - 30),
        durationMs: duration + 60,
      });
      this.onSegment?.(this.current[this.current.length - 1]);
    }
    this.smoothFreq = null;
    this.runFreqs = [];
  }

  /** Flushes any pending segment when recording stops. */
  finalize(): TrackedNote[] {
    this.closeRun(this.lastMs);
    return this.current;
  }

  reset(): void {
    this.smoothFreq = null;
    this.runFreqs = [];
    this.current = [];
    this.lastMs = 0;
  }
}

/** Converts tracked segments into timed NoteEvents (1s ≈ quarter at 100 BPM not assumed — raw timing). */
export function trackedToNoteEvents(
  notes: TrackedNote[],
): { pitch: string; startMs: number; durationMs: number }[] {
  return notes.map((n) => ({
    pitch: n.pitch,
    startMs: Math.round(n.startMs),
    durationMs: Math.round(n.durationMs),
  }));
}
