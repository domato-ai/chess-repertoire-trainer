// SM-2 defaults
export const SM2_DEFAULT_EASE_FACTOR = 2.5;
export const SM2_MIN_EASE_FACTOR = 1.3;
export const SM2_FIRST_INTERVAL = 1; // days
export const SM2_SECOND_INTERVAL = 6; // days

// Quality rating labels (mapped to SM-2 quality 0-5)
export const QUALITY_RATINGS = [
  { label: 'Blackout', quality: 0, color: '#f87171' },
  { label: 'Hard', quality: 2, color: '#fbbf24' },
  { label: 'Good', quality: 4, color: '#4ade80' },
  { label: 'Easy', quality: 5, color: '#7c7cff' },
] as const;

// Drill settings
export const DEFAULT_AUTO_PLAY_DELAY = 400; // ms
export const FEEDBACK_DURATION_CORRECT = 300; // ms
export const FEEDBACK_DURATION_INCORRECT = 1000; // ms

// NAG descriptions
export const NAG_SYMBOLS: Record<number, string> = {
  1: '!',    // good move
  2: '?',    // mistake
  3: '!!',   // brilliant
  4: '??',   // blunder
  5: '!?',   // interesting
  6: '?!',   // dubious
  14: '+=',  // slight advantage white
  15: '=+',  // slight advantage black
  16: '±',   // moderate advantage white
  17: '∓',   // moderate advantage black
  18: '+-',  // decisive advantage white
  19: '-+',  // decisive advantage black
  40: '→',   // with attack
};
