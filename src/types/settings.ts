export interface UserSettings {
  boardOrientation: 'auto' | 'white' | 'black';
  showCoordinates: boolean;
  animationSpeed: number; // ms
  soundEnabled: boolean;
  hintMode: 'arrows' | 'text' | 'both' | 'none';
  dailyGoal: number;
  autoPlayDelay: number; // ms before opponent auto-moves
  srsNewCardsPerDay: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  boardOrientation: 'auto',
  showCoordinates: true,
  animationSpeed: 200,
  soundEnabled: true,
  hintMode: 'arrows',
  dailyGoal: 20,
  autoPlayDelay: 400,
  srsNewCardsPerDay: 10,
};
