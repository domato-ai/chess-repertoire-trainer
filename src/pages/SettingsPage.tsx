import { Header } from '../components/layout/Header';
import { useSettingsStore } from '../stores/useSettingsStore';

export function SettingsPage() {
  const settings = useSettingsStore();

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" subtitle="Customize your training experience" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Board Settings */}
          <Section title="Board">
            <SettingRow label="Board Orientation" description="Auto matches the repertoire color">
              <select
                value={settings.boardOrientation}
                onChange={(e) => settings.updateSettings({ boardOrientation: e.target.value as any })}
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-sm"
              >
                <option value="auto">Auto</option>
                <option value="white">Always White</option>
                <option value="black">Always Black</option>
              </select>
            </SettingRow>

            <SettingRow label="Show Coordinates">
              <Toggle
                checked={settings.showCoordinates}
                onChange={(v) => settings.updateSettings({ showCoordinates: v })}
              />
            </SettingRow>

            <SettingRow label="Animation Speed" description={`${settings.animationSpeed}ms`}>
              <input
                type="range"
                min={0}
                max={500}
                step={50}
                value={settings.animationSpeed}
                onChange={(e) => settings.updateSettings({ animationSpeed: Number(e.target.value) })}
                className="w-32"
              />
            </SettingRow>
          </Section>

          {/* Drill Settings */}
          <Section title="Drill">
            <SettingRow label="Auto-play Delay" description={`${settings.autoPlayDelay}ms before opponent moves`}>
              <input
                type="range"
                min={100}
                max={1500}
                step={100}
                value={settings.autoPlayDelay}
                onChange={(e) => settings.updateSettings({ autoPlayDelay: Number(e.target.value) })}
                className="w-32"
              />
            </SettingRow>

            <SettingRow label="Hint Mode">
              <select
                value={settings.hintMode}
                onChange={(e) => settings.updateSettings({ hintMode: e.target.value as any })}
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-sm"
              >
                <option value="arrows">Arrows</option>
                <option value="text">Text</option>
                <option value="both">Both</option>
                <option value="none">None</option>
              </select>
            </SettingRow>
          </Section>

          {/* SRS Settings */}
          <Section title="Spaced Repetition">
            <SettingRow label="New Cards Per Day" description="Max new lines to introduce daily">
              <input
                type="number"
                min={1}
                max={50}
                value={settings.srsNewCardsPerDay}
                onChange={(e) => settings.updateSettings({ srsNewCardsPerDay: Number(e.target.value) })}
                className="w-20 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-center"
              />
            </SettingRow>

            <SettingRow label="Daily Goal" description="Target lines per day">
              <input
                type="number"
                min={5}
                max={100}
                value={settings.dailyGoal}
                onChange={(e) => settings.updateSettings({ dailyGoal: Number(e.target.value) })}
                className="w-20 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-center"
              />
            </SettingRow>
          </Section>

          {/* Reset */}
          <div className="pt-4 border-t border-[var(--border)]">
            <button
              onClick={settings.resetDefaults}
              className="px-4 py-2 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">{title}</h3>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-colors relative ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
