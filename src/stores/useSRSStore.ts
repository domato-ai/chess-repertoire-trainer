import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SRSCard } from '../types/spaced-repetition';
import type { ReviewAttempt } from '../types/drill';
import { idbStorage } from '../utils/storage';
import { sm2 } from '../utils/sm2';
import { generateId } from '../utils/uuid';
import { SM2_DEFAULT_EASE_FACTOR } from '../data/constants';

interface SRSStoreState {
  cards: Record<string, SRSCard>;
  reviewHistory: ReviewAttempt[];

  getOrCreateCard: (lineId: string, repertoireId: string) => SRSCard;
  processReview: (attempt: ReviewAttempt) => void;
  getDueCards: (repertoireId?: string) => SRSCard[];
  getNewCards: (repertoireId?: string) => SRSCard[];
  getStats: (repertoireId?: string) => {
    totalLines: number;
    dueToday: number;
    newLines: number;
    averageEase: number;
    totalReviews: number;
    accuracy: number;
  };
  ensureCardsExist: (lineIds: string[], repertoireId: string) => void;
  removeCardsForRepertoire: (repertoireId: string) => void;
}

export const useSRSStore = create<SRSStoreState>()(
  persist(
    (set, get) => ({
      cards: {},
      reviewHistory: [],

      getOrCreateCard: (lineId, repertoireId) => {
        const state = get();
        if (state.cards[lineId]) return state.cards[lineId];

        const card: SRSCard = {
          id: generateId(),
          lineId,
          repertoireId,
          easeFactor: SM2_DEFAULT_EASE_FACTOR,
          interval: 0,
          repetitions: 0,
          nextReviewDate: Date.now(), // Due immediately
          lastReviewDate: null,
          totalReviews: 0,
          correctCount: 0,
          incorrectCount: 0,
          streak: 0,
          bestStreak: 0,
        };

        set(s => ({ cards: { ...s.cards, [lineId]: card } }));
        return card;
      },

      processReview: (attempt) => {
        const state = get();
        const card = state.cards[attempt.lineId];
        if (!card) return;

        const result = sm2({
          quality: attempt.quality,
          repetitions: card.repetitions,
          easeFactor: card.easeFactor,
          interval: card.interval,
        });

        // Add small random fuzz (+/- 5%) to prevent clustering
        const fuzz = result.interval > 1
          ? result.interval * (0.95 + Math.random() * 0.1)
          : result.interval;

        const isCorrect = attempt.quality >= 3;
        const newStreak = isCorrect ? card.streak + 1 : 0;

        const updatedCard: SRSCard = {
          ...card,
          easeFactor: result.easeFactor,
          interval: result.interval,
          repetitions: result.repetitions,
          nextReviewDate: Date.now() + Math.round(fuzz) * 86_400_000,
          lastReviewDate: Date.now(),
          totalReviews: card.totalReviews + 1,
          correctCount: card.correctCount + (isCorrect ? 1 : 0),
          incorrectCount: card.incorrectCount + (isCorrect ? 0 : 1),
          streak: newStreak,
          bestStreak: Math.max(card.bestStreak, newStreak),
        };

        set(s => ({
          cards: { ...s.cards, [attempt.lineId]: updatedCard },
          reviewHistory: [...s.reviewHistory, attempt],
        }));
      },

      getDueCards: (repertoireId) => {
        const state = get();
        const now = Date.now();
        return Object.values(state.cards)
          .filter(c => {
            if (repertoireId && c.repertoireId !== repertoireId) return false;
            return c.nextReviewDate <= now && c.totalReviews > 0;
          })
          .sort((a, b) => a.nextReviewDate - b.nextReviewDate);
      },

      getNewCards: (repertoireId) => {
        const state = get();
        return Object.values(state.cards)
          .filter(c => {
            if (repertoireId && c.repertoireId !== repertoireId) return false;
            return c.totalReviews === 0;
          });
      },

      getStats: (repertoireId) => {
        const state = get();
        const cards = Object.values(state.cards)
          .filter(c => !repertoireId || c.repertoireId === repertoireId);

        const now = Date.now();
        const dueToday = cards.filter(c => c.nextReviewDate <= now && c.totalReviews > 0).length;
        const newLines = cards.filter(c => c.totalReviews === 0).length;
        const totalReviews = cards.reduce((sum, c) => sum + c.totalReviews, 0);
        const totalCorrect = cards.reduce((sum, c) => sum + c.correctCount, 0);
        const averageEase = cards.length > 0
          ? cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length
          : SM2_DEFAULT_EASE_FACTOR;

        return {
          totalLines: cards.length,
          dueToday,
          newLines,
          averageEase: Math.round(averageEase * 100) / 100,
          totalReviews,
          accuracy: totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0,
        };
      },

      ensureCardsExist: (lineIds, repertoireId) => {
        const state = get();
        const newCards: Record<string, SRSCard> = {};

        for (const lineId of lineIds) {
          if (!state.cards[lineId]) {
            newCards[lineId] = {
              id: generateId(),
              lineId,
              repertoireId,
              easeFactor: SM2_DEFAULT_EASE_FACTOR,
              interval: 0,
              repetitions: 0,
              nextReviewDate: Date.now(),
              lastReviewDate: null,
              totalReviews: 0,
              correctCount: 0,
              incorrectCount: 0,
              streak: 0,
              bestStreak: 0,
            };
          }
        }

        if (Object.keys(newCards).length > 0) {
          set(s => ({ cards: { ...s.cards, ...newCards } }));
        }
      },

      removeCardsForRepertoire: (repertoireId) => {
        set(state => {
          const filtered: Record<string, SRSCard> = {};
          for (const [key, card] of Object.entries(state.cards)) {
            if (card.repertoireId !== repertoireId) {
              filtered[key] = card;
            }
          }
          return { cards: filtered };
        });
      },
    }),
    {
      name: 'chess-srs-store',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        cards: state.cards,
        reviewHistory: state.reviewHistory,
      }),
    },
  ),
);
