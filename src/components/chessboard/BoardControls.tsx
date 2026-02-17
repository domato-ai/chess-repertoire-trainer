interface BoardControlsProps {
  onFlip: () => void;
  onReset: () => void;
  onUndo?: () => void;
  showUndo?: boolean;
}

export function BoardControls({ onFlip, onReset, onUndo, showUndo = true }: BoardControlsProps) {
  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={onFlip}
        className="px-3 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        title="Flip board"
      >
        ↕ Flip
      </button>
      <button
        onClick={onReset}
        className="px-3 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        title="Reset to start"
      >
        ↺ Reset
      </button>
      {showUndo && onUndo && (
        <button
          onClick={onUndo}
          className="px-3 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Undo last move"
        >
          ← Undo
        </button>
      )}
    </div>
  );
}
