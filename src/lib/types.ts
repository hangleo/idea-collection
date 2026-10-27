export type Pitch = string;

export interface NoteEvent {
  pitch: Pitch;
  startMs: number;
  durationMs: number;
  /** Musical duration in beats (4 = whole, 1 = quarter, 0.5 = eighth…). */
  beats?: number;
}

/** A note as written on the score, before timing is applied. */
export interface ScoreNote {
  pitch: Pitch;
  beats: number;
}

export type IdeaKind = 'text' | 'voice' | 'musical';

export interface Idea {
  id: string;
  title: string;
  text: string;
  audioUri: string | null;
  audioDurationMs: number | null;
  tags: string[];
  category: string;
  melody: NoteEvent[] | null;
  reminderAt: string | null;
  reminderNotificationId: string | null;
  calendarEventId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaDraft {
  title: string;
  text: string;
  tags: string[];
  category: string;
}

export function ideaKind(idea: Idea): IdeaKind {
  if (idea.melody && idea.melody.length > 0) return 'musical';
  if (idea.audioUri) return 'voice';
  return 'text';
}
