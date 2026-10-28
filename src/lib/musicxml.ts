import type { ScoreNote } from './types';

const DIVISIONS = 4; // divisions per quarter note
const MEASURE_DIVISIONS = DIVISIONS * 4; // 4/4 time

/** Note durations (in divisions) that a single <note> can legally represent. */
const REPRESENTABLE = [16, 12, 8, 6, 4, 3, 2, 1];

interface ParsedPitch {
  step: string;
  alter: number;
  octave: number;
}

interface Glyph {
  type: string;
  dots: number;
}

function parsePitch(pitch: string): ParsedPitch {
  const step = pitch[0].toUpperCase();
  const alter = pitch.includes('#') ? 1 : 0;
  const octave = parseInt(pitch[pitch.length - 1], 10);
  return { step, alter, octave: Number.isNaN(octave) ? 4 : octave };
}

/** Total divisions for a note written in beats (4 = whole … 0.25 = 16th). */
function divisionsForBeats(beats: number): number {
  const snapped = [4, 2, 1, 0.5, 0.25].reduce(
    (best, option) => (Math.abs(option - beats) < Math.abs(best - beats) ? option : best),
    1,
  );
  return Math.round(snapped * DIVISIONS);
}

function divisionsToGlyph(divisions: number): Glyph {
  switch (divisions) {
    case 16:
      return { type: 'whole', dots: 0 };
    case 12:
      return { type: 'half', dots: 1 };
    case 8:
      return { type: 'half', dots: 0 };
    case 6:
      return { type: 'quarter', dots: 1 };
    case 4:
      return { type: 'quarter', dots: 0 };
    case 3:
      return { type: 'eighth', dots: 1 };
    case 2:
      return { type: 'eighth', dots: 0 };
    default:
      return { type: '16th', dots: 0 };
  }
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function noteXml(
  parsed: ParsedPitch,
  divisions: number,
  glyph: Glyph,
  tie: 'start' | 'stop' | 'both' | null,
  showAccidental: boolean,
): string {
  const lines: string[] = ['      <note>', '        <pitch>'];
  lines.push(`          <step>${parsed.step}</step>`);
  if (parsed.alter !== 0) lines.push(`          <alter>${parsed.alter}</alter>`);
  lines.push(`          <octave>${parsed.octave}</octave>`);
  lines.push('        </pitch>');
  lines.push(`        <duration>${divisions}</duration>`);
  if (tie === 'stop' || tie === 'both') lines.push('        <tie type="stop"/>');
  if (tie === 'start' || tie === 'both') lines.push('        <tie type="start"/>');
  lines.push('        <voice>1</voice>');
  lines.push(`        <type>${glyph.type}</type>`);
  for (let i = 0; i < glyph.dots; i++) lines.push('        <dot/>');
  if (showAccidental) lines.push('        <accidental>sharp</accidental>');
  if (tie) {
    const tied =
      tie === 'both'
        ? '<tied type="stop"/><tied type="start"/>'
        : `<tied type="${tie}"/>`;
    lines.push(`        <notations>${tied}</notations>`);
  }
  lines.push('      </note>');
  return lines.join('\n');
}

/**
 * Builds a MusicXML 4.0 (score-partwise) document from a monophonic melody.
 * Notes are laid out into 4/4 measures; notes crossing a barline are split
 * into representable durations joined with ties, as MusicXML requires.
 */
export function buildMusicXml(title: string, score: ScoreNote[]): string {
  const measures: string[] = [];
  let current: string[] = [];
  let measureNumber = 1;
  let position = 0;

  const openMeasure = (withAttributes: boolean) => {
    current.push(`    <measure number="${measureNumber}">`);
    if (withAttributes) {
      current.push(
        '      <attributes>',
        `        <divisions>${DIVISIONS}</divisions>`,
        '        <key><fifths>0</fifths></key>',
        '        <time><beats>4</beats><beat-type>4</beat-type></time>',
        '        <clef><sign>G</sign><line>2</line></clef>',
        '      </attributes>',
      );
    }
  };

  const closeMeasure = () => {
    current.push('    </measure>');
    measures.push(current.join('\n'));
    current = [];
    measureNumber += 1;
    position = 0;
  };

  openMeasure(true);

  for (const note of score) {
    const parsed = parsePitch(note.pitch);
    let remaining = divisionsForBeats(note.beats);
    let tieIn = false; // the previous segment ended with tie type="start"

    while (remaining > 0) {
      const space = MEASURE_DIVISIONS - position;
      const maxChunk = Math.min(space, remaining);
      const chunk = REPRESENTABLE.find((r) => r <= maxChunk) ?? 1;
      const isSplit = chunk < remaining;
      const tie: 'start' | 'stop' | 'both' | null = tieIn && isSplit
        ? 'both'
        : isSplit
          ? 'start'
          : tieIn
            ? 'stop'
            : null;
      current.push(noteXml(parsed, chunk, divisionsToGlyph(chunk), tie, parsed.alter !== 0));
      position += chunk;
      remaining -= chunk;
      tieIn = isSplit;
      if (position >= MEASURE_DIVISIONS) {
        closeMeasure();
        openMeasure(false);
      }
    }
  }

  if (current.length > 0) closeMeasure();

  const safeTitle = xmlEscape(title || 'Melody');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `  <work><work-title>${safeTitle}</work-title></work>`,
    '  <identification>',
    '    <creator type="composer">Idea Collection</creator>',
    '    <encoding><software>Idea Collection</software></encoding>',
    '  </identification>',
    '  <part-list>',
    '    <score-part id="P1">',
    '      <part-name>Piano</part-name>',
    '      <score-instrument id="P1-I1"><instrument-name>Piano</instrument-name></score-instrument>',
    '      <midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument>',
    '    </score-part>',
    '  </part-list>',
    '  <part id="P1">',
    ...measures,
    '  </part>',
    '</score-partwise>',
    '',
  ].join('\n');
}
