import { useState, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { parseMultiGamePGN, type ParsedGame } from '../../utils/pgn-parser';

interface PGNImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (games: ParsedGame[]) => void;
}

export function PGNImportModal({ isOpen, onClose, onImport }: PGNImportModalProps) {
  const [pgnText, setPgnText] = useState('');
  const [parsedGames, setParsedGames] = useState<ParsedGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());

  const handleParse = useCallback(() => {
    setError(null);
    try {
      const games = parseMultiGamePGN(pgnText);
      if (games.length === 0) {
        setError('No valid games found in the PGN.');
        return;
      }
      setParsedGames(games);
      setSelectedGames(new Set(games.map((_, i) => i)));
    } catch (e) {
      setError(`Parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [pgnText]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPgnText(text);
    };
    reader.readAsText(file);
  }, []);

  const toggleGame = useCallback((index: number) => {
    setSelectedGames(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const selected = parsedGames.filter((_, i) => selectedGames.has(i));
    onImport(selected);
    // Reset state
    setPgnText('');
    setParsedGames([]);
    setSelectedGames(new Set());
    setError(null);
    onClose();
  }, [parsedGames, selectedGames, onImport, onClose]);

  const handleClose = useCallback(() => {
    setPgnText('');
    setParsedGames([]);
    setSelectedGames(new Set());
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import PGN" maxWidth="700px">
      {parsedGames.length === 0 ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Upload PGN file
            </label>
            <input
              type="file"
              accept=".pgn"
              onChange={handleFileUpload}
              className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-[var(--bg-tertiary)] file:text-[var(--text-primary)] hover:file:bg-[var(--bg-hover)]"
            />
          </div>

          <div className="text-center text-[var(--text-muted)] text-sm">— or paste PGN text —</div>

          <textarea
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder="Paste PGN here..."
            className="w-full h-48 bg-[var(--bg-primary)] border border-[var(--border)] rounded p-3 text-sm font-mono text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]"
          />

          {error && (
            <div className="text-[var(--error)] text-sm bg-red-500/10 border border-red-500/20 rounded p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleParse}
              disabled={!pgnText.trim()}
              className="px-4 py-2 text-sm rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Parse PGN
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Found {parsedGames.length} opening(s). Select which to import:
          </p>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {parsedGames.map((game, index) => (
              <label
                key={index}
                className="flex items-center gap-3 p-2.5 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedGames.has(index)}
                  onChange={() => toggleGame(index)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {game.openingName || `Game ${index + 1}`}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {game.moveCount} moves · {game.lineCount} lines
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setParsedGames([])}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ← Back
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedGames.size === 0}
                className="px-4 py-2 text-sm rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Import {selectedGames.size} opening(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
