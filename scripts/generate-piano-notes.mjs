/**
 * Generates piano-style WAV samples (16-bit PCM mono) for two octaves (C4..B5)
 * into assets/notes/. Run: node scripts/generate-piano-notes.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'notes');

const SAMPLE_RATE = 22050;
const DURATION = 1.6; // seconds
const PEAK = 0.85;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PARTIALS = [
  [1, 1.0],
  [2, 0.55],
  [3, 0.32],
  [4, 0.2],
  [5, 0.12],
  [6, 0.07],
  [7, 0.045],
];

function fileName(name, octave) {
  return `${name.replace('#', 's').toLowerCase()}${octave}.wav`;
}

function synthesize(freq) {
  const n = Math.floor(SAMPLE_RATE * DURATION);
  const data = new Buffer.alloc(n * 2);
  const samples = new Float64Array(n);
  let peak = 1e-9;

  for (let t = 0; t < n; t++) {
    const time = t / SAMPLE_RATE;
    // natural hammer attack + exponential decay
    const env = Math.exp(-3.0 * time) * (1 - Math.exp(-time / 0.0035));
    let s = 0;
    for (const [mult, amp] of PARTIALS) {
      s += amp * Math.sin(2 * Math.PI * freq * mult * time) * Math.exp(-mult * 1.15 * time);
    }
    // subtle inharmonicity shimmer
    s += 0.02 * Math.sin(2 * Math.PI * freq * 2.76 * time) * Math.exp(-4 * time);
    samples[t] = s * env;
    if (Math.abs(samples[t]) > peak) peak = Math.abs(samples[t]);
  }

  for (let t = 0; t < n; t++) {
    const v = Math.max(-1, Math.min(1, samples[t] / peak * PEAK));
    data.writeInt16LE(Math.round(v * 32767), t * 2);
  }
  return data;
}

function wavHeader(dataLength) {
  const h = new Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataLength, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); // PCM chunk size
  h.writeUInt16LE(1, 20); // PCM format
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36);
  h.writeUInt32LE(dataLength, 40);
  return h;
}

mkdirSync(OUT, { recursive: true });

let count = 0;
for (let octave = 4; octave <= 5; octave++) {
  NAMES.forEach((name, i) => {
    const midi = (octave + 1) * 12 + i; // C4 = 60
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const pcm = synthesize(freq);
    writeFileSync(path.join(OUT, fileName(name, octave)), Buffer.concat([wavHeader(pcm.length), pcm]));
    count++;
    console.log(`  ${fileName(name, octave)}  ${freq.toFixed(2)} Hz`);
  });
}
console.log(`Generated ${count} piano samples in assets/notes`);
