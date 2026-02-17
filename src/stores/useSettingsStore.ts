import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

interface SettingsStoreState extends UserSettings {
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetDefaults: () => void;
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      updateSettings: (partial) => set(partial),
      resetDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'chess-settings-store',
    },
  ),
);
