import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_CATEGORIES } from './theme';
import type { Idea, IdeaDraft } from './types';
import { uid } from './format';

interface IdeaState {
  ideas: Idea[];
  categories: string[];
  addIdea: (draft: Partial<IdeaDraft> & { audioUri?: string | null; audioDurationMs?: number | null; melody?: Idea['melody'] | null }) => Idea;
  updateIdea: (id: string, patch: Partial<Idea>) => void;
  deleteIdea: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addCategory: (name: string) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useIdeaStore = create<IdeaState>()(
  persist(
    (set, get) => ({
      ideas: [],
      categories: DEFAULT_CATEGORIES,

      addIdea: (draft) => {
        const idea: Idea = {
          id: uid(),
          title: draft.title?.trim() || 'Untitled idea',
          text: draft.text ?? '',
          audioUri: draft.audioUri ?? null,
          audioDurationMs: draft.audioDurationMs ?? null,
          tags: draft.tags ?? [],
          category: draft.category || 'Spark',
          melody: draft.melody ?? null,
          reminderAt: null,
          reminderNotificationId: null,
          calendarEventId: null,
          favorite: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set((state) => ({ ideas: [idea, ...state.ideas] }));
        return idea;
      },

      updateIdea: (id, patch) =>
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, ...patch, updatedAt: nowIso() } : idea,
          ),
        })),

      deleteIdea: (id) =>
        set((state) => ({ ideas: state.ideas.filter((idea) => idea.id !== id) })),

      toggleFavorite: (id) =>
        set((state) => ({
          ideas: state.ideas.map((idea) =>
            idea.id === id ? { ...idea, favorite: !idea.favorite } : idea,
          ),
        })),

      addCategory: (name) => {
        const clean = name.trim();
        if (!clean) return;
        if (get().categories.some((c) => c.toLowerCase() === clean.toLowerCase())) return;
        set((state) => ({ categories: [...state.categories, clean] }));
      },
    }),
    {
      name: 'idea-collection-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useAllTags(): string[] {
  const ideas = useIdeaStore((s) => s.ideas);
  const seen = new Set<string>();
  for (const idea of ideas) for (const tag of idea.tags) seen.add(tag);
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
