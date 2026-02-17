import { create } from 'zustand';
import type { DrillState, DrillConfig, MoveFeedback, ReviewAttempt } from '../types/drill';
import type { RepertoireLine, PlayerColor } from '../types/repertoire';

interface DrillStoreState extends DrillState {
  startSession: (config: DrillConfig, lines: RepertoireLine[], userColor: PlayerColor) => void;
  setCurrentLine: (line: RepertoireLine) => void;
  advancePly: () => void;
  setFeedback: (feedback: MoveFeedback) => void;
  addMistake: () => void;
  addHint: () => void;
  completeLine: (attempt: ReviewAttempt) => void;
  nextLine: () => RepertoireLine | null;
  endSession: () => void;
  reset: () => void;
}

const initialState: DrillState = {
  status: 'idle',
  repertoireId: null,
  currentLine: null,
  currentPlyIndex: 0,
  userColor: 'white',
  moveHistory: [],
  feedback: null,
  mistakeCount: 0,
  hintsUsed: 0,
  startTime: null,
  linesCompleted: [],
  linesRemaining: [],
  sessionResults: [],
};

export const useDrillStore = create<DrillStoreState>()((set, get) => ({
  ...initialState,

  startSession: (config, lines, userColor) => {
    let ordered = [...lines];
    if (config.shuffleOrder) {
      ordered = shuffleArray(ordered);
    }
    if (config.maxLines > 0) {
      ordered = ordered.slice(0, config.maxLines);
    }

    const first = ordered.shift();

    set({
      status: first ? 'playing' : 'idle',
      repertoireId: config.repertoireId,
      currentLine: first || null,
      currentPlyIndex: 0,
      userColor,
      moveHistory: [],
      feedback: null,
      mistakeCount: 0,
      hintsUsed: 0,
      startTime: Date.now(),
      linesCompleted: [],
      linesRemaining: ordered,
      sessionResults: [],
    });
  },

  setCurrentLine: (line) => {
    set({
      currentLine: line,
      currentPlyIndex: 0,
      moveHistory: [],
      feedback: null,
      mistakeCount: 0,
      hintsUsed: 0,
      status: 'playing',
    });
  },

  advancePly: () => {
    set(state => ({
      currentPlyIndex: state.currentPlyIndex + 1,
      moveHistory: [
        ...state.moveHistory,
        state.currentLine?.sanSequence[state.currentPlyIndex] || '',
      ],
    }));
  },

  setFeedback: (feedback) => set({ feedback }),

  addMistake: () => set(state => ({ mistakeCount: state.mistakeCount + 1 })),

  addHint: () => set(state => ({ hintsUsed: state.hintsUsed + 1 })),

  completeLine: (attempt) => {
    set(state => ({
      status: 'rating',
      linesCompleted: [...state.linesCompleted, state.currentLine!],
      sessionResults: [...state.sessionResults, attempt],
    }));
  },

  nextLine: () => {
    const state = get();
    const remaining = [...state.linesRemaining];
    const next = remaining.shift();

    if (next) {
      set({
        currentLine: next,
        currentPlyIndex: 0,
        moveHistory: [],
        feedback: null,
        mistakeCount: 0,
        hintsUsed: 0,
        linesRemaining: remaining,
        status: 'playing',
      });
      return next;
    } else {
      set({ status: 'complete' });
      return null;
    }
  },

  endSession: () => set({ status: 'complete' }),

  reset: () => set(initialState),
}));

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
