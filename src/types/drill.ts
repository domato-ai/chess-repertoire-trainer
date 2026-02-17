import type { PlayerColor, RepertoireLine } from './repertoire';

export type DrillStatus = 'idle' | 'selecting' | 'playing' | 'feedback' | 'rating' | 'complete';
export type MoveFeedback = 'correct' | 'incorrect' | 'hint' | null;

export interface DrillState {
  status: DrillStatus;
  repertoireId: string | null;
  currentLine: RepertoireLine | null;
  currentPlyIndex: number;
  userColor: PlayerColor;
  moveHistory: string[];
  feedback: MoveFeedback;
  mistakeCount: number;
  hintsUsed: number;
  startTime: number | null;
  linesCompleted: RepertoireLine[];
  linesRemaining: RepertoireLine[];
  sessionResults: ReviewAttempt[];
}

export interface DrillConfig {
  repertoireId: string;
  lineIds: string[];
  shuffleOrder: boolean;
  showHints: boolean;
  maxLines: number;
}

export interface ReviewAttempt {
  lineId: string;
  timestamp: number;
  quality: number; // 0-5 SM-2 quality rating
  mistakes: number;
  hintsUsed: number;
  timeSpentMs: number;
}
