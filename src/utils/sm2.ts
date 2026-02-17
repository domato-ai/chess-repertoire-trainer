import type { SM2Input, SM2Result } from '../types/spaced-repetition';
import { SM2_MIN_EASE_FACTOR, SM2_FIRST_INTERVAL, SM2_SECOND_INTERVAL } from '../data/constants';

/**
 * Pure SM-2 spaced repetition algorithm.
 * Quality: 0-5 integer (0=blackout, 5=perfect recall)
 */
export function sm2(input: SM2Input): SM2Result {
  const { quality, repetitions, easeFactor, interval } = input;

  // Calculate new ease factor (always, regardless of quality)
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < SM2_MIN_EASE_FACTOR) {
    newEaseFactor = SM2_MIN_EASE_FACTOR;
  }

  let newInterval: number;
  let newRepetitions: number;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      newInterval = SM2_FIRST_INTERVAL;
    } else if (repetitions === 1) {
      newInterval = SM2_SECOND_INTERVAL;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
  } else {
    // Incorrect response - reset
    newInterval = SM2_FIRST_INTERVAL;
    newRepetitions = 0;
  }

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
  };
}

/**
 * Derive SM-2 quality from drill performance.
 * Can be overridden by user with the 4-button rating.
 */
export function deriveQuality(mistakes: number, hintsUsed: number): number {
  if (mistakes === 0 && hintsUsed === 0) return 5; // Easy
  if (mistakes === 0 && hintsUsed > 0) return 4;   // Good
  if (mistakes === 1) return 3;                      // Barely pass
  if (mistakes === 2) return 2;                      // Hard
  return 1;                                          // Fail
}
