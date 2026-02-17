export interface SRSCard {
  id: string;
  lineId: string;
  repertoireId: string;
  easeFactor: number;       // >= 1.3, default 2.5
  interval: number;         // days until next review
  repetitions: number;      // successful consecutive reviews
  nextReviewDate: number;   // Unix timestamp ms
  lastReviewDate: number | null;
  totalReviews: number;
  correctCount: number;
  incorrectCount: number;
  streak: number;
  bestStreak: number;
}

export interface SM2Input {
  quality: number;       // 0-5 integer
  repetitions: number;
  easeFactor: number;
  interval: number;
}

export interface SM2Result {
  interval: number;
  repetitions: number;
  easeFactor: number;
}
