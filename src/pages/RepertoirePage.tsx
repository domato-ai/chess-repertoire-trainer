import { useState, useCallback, useMemo } from 'react';
import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { Header } from '../components/layout/Header';
import { ChessboardWrapper, type CustomArrow } from '../components/chessboard/ChessboardWrapper';
import { BoardControls } from '../components/chessboard/BoardControls';
import { MoveTree } from '../components/repertoire/MoveTree';
import { PGNImportModal } from '../components/repertoire/PGNImportModal';
import { useChessEngine } from '../hooks/useChessEngine';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useRepertoireStore } from '../stores/useRepertoireStore';
import { useSRSStore } from '../stores/useSRSStore';
import { findNode, getPathToNode, countNodes, countLines } from '../utils/repertoire-tree';
import type { ParsedGame } from '../utils/pgn-parser';
import type { MoveNode, PlayerColor } from '../types/repertoire';
import { STARTING_FEN } from '../types/repertoire';

export function RepertoirePage() {
  const {
    repertoires, selectedRepertoireId, selectedNodeId,
    createRepertoire, selectRepertoire, selectNode,
    addMove, importTree, recalculateLines,
  } = useRepertoireStore();
  const ensureCardsExist = useSRSStore(s => s.ensureCardsExist);
  const lines = useRepertoireStore(s => s.lines);

  const [orientation, setOrientation] = useState<PlayerColor>('white');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRepName, setNewRepName] = useState('');
  const [newRepColor, setNewRepColor] = useState<PlayerColor>('white');

  const { fen, loadFen } = useChessEngine();

  const selectedRep = selectedRepertoireId ? repertoires[selectedRepertoireId] : null;

  const handleNodeClick = useCallback((node: MoveNode) => {
    selectNode(node.id);
    loadFen(node.fen);
  }, [selectNode, loadFen]);

  const handlePieceDrop = useCallback((source: Square, target: Square): boolean => {
    if (!selectedRep) return false;

    // Use chess.js to validate and get SAN
    const chess = new Chess(fen);
    try {
      const move = chess.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;

      // Check if this move already exists as a child of the selected node
      const parentNode = selectedNodeId ? findNode(selectedRep.tree, selectedNodeId) : null;
      const siblings = parentNode ? parentNode.children : selectedRep.tree.children;
      const existing = siblings.find(c => c.san === move.san);

      if (existing) {
        // Navigate to existing move
        selectNode(existing.id);
        loadFen(existing.fen);
        return true;
      }

      // Add new move
      const moveNumber = Math.ceil(chess.history().length / 2) || Math.ceil((parentNode ? parentNode.plyFromRoot + 1 : 1) / 2);
      const plyFromRoot = parentNode ? parentNode.plyFromRoot + 1 : 1;

      const newNode = addMove(
        selectedRep.id,
        selectedNodeId,
        move.san,
        chess.fen(),
        moveNumber,
        plyFromRoot,
      );

      if (newNode) {
        selectNode(newNode.id);
        loadFen(newNode.fen);

        // Ensure SRS cards exist for new lines
        const repLines = lines[selectedRep.id] || [];
        ensureCardsExist(repLines.map(l => l.id), selectedRep.id);
      }

      return true;
    } catch {
      return false;
    }
  }, [selectedRep, selectedNodeId, fen, addMove, selectNode, loadFen, lines, ensureCardsExist]);

  const handleFlip = useCallback(() => {
    setOrientation(o => o === 'white' ? 'black' : 'white');
  }, []);

  const handleReset = useCallback(() => {
    loadFen(STARTING_FEN);
    selectNode(null);
  }, [loadFen, selectNode]);

  // Arrow key navigation through the tree
  const handleNavigateForward = useCallback(() => {
    if (!selectedRep || !selectedNodeId) {
      // If nothing selected, select the first root move
      if (selectedRep && selectedRep.tree.children.length > 0) {
        const first = selectedRep.tree.children[0];
        selectNode(first.id);
        loadFen(first.fen);
      }
      return;
    }
    const node = findNode(selectedRep.tree, selectedNodeId);
    if (node && node.children.length > 0) {
      const next = node.children[0]; // Follow mainline
      selectNode(next.id);
      loadFen(next.fen);
    }
  }, [selectedRep, selectedNodeId, selectNode, loadFen]);

  const handleNavigateBack = useCallback(() => {
    if (!selectedRep || !selectedNodeId) return;
    const path = getPathToNode(selectedRep.tree, selectedNodeId);
    if (path.length > 1) {
      const parent = path[path.length - 2];
      selectNode(parent.id);
      loadFen(parent.fen);
    } else {
      // At root move, go to starting position
      selectNode(null);
      loadFen(STARTING_FEN);
    }
  }, [selectedRep, selectedNodeId, selectNode, loadFen]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedRep || !selectedNodeId) return;
    const { deleteMove } = useRepertoireStore.getState();
    deleteMove(selectedRep.id, selectedNodeId);
    loadFen(STARTING_FEN);
  }, [selectedRep, selectedNodeId, loadFen]);

  useKeyboardShortcuts({
    onFlipBoard: handleFlip,
    onResetBoard: handleReset,
    onNavigateForward: handleNavigateForward,
    onNavigateBack: handleNavigateBack,
    onDeleteNode: handleDeleteNode,
  });

  const handleCreateRepertoire = useCallback(() => {
    if (!newRepName.trim()) return;
    const rep = createRepertoire(newRepName.trim(), newRepColor);
    selectRepertoire(rep.id);
    setShowCreateForm(false);
    setNewRepName('');
    setOrientation(newRepColor);
  }, [newRepName, newRepColor, createRepertoire, selectRepertoire]);

  const handleImport = useCallback((games: ParsedGame[]) => {
    if (!selectedRep) return;
    for (const game of games) {
      importTree(selectedRep.id, game.tree, game.openingName);
    }
    recalculateLines(selectedRep.id);

    // Ensure SRS cards
    const repLines = lines[selectedRep.id] || [];
    ensureCardsExist(repLines.map(l => l.id), selectedRep.id);
  }, [selectedRep, importTree, recalculateLines, lines, ensureCardsExist]);

  // Get annotations for the selected node
  const selectedNode = selectedRep && selectedNodeId
    ? findNode(selectedRep.tree, selectedNodeId)
    : null;

  const customArrows: CustomArrow[] = useMemo(() => {
    if (!selectedNode) return [];
    return selectedNode.arrows
      .map(arrow => {
        const color = arrow[0] === 'G' ? '#4ade80' : arrow[0] === 'R' ? '#f87171' : '#fbbf24';
        const from = arrow.substring(1, 3);
        const to = arrow.substring(3, 5);
        return { from, to, color };
      })
      .filter(a => a.from && a.to);
  }, [selectedNode]);

  const customSquareStyles: Record<string, React.CSSProperties> = useMemo(() => {
    if (!selectedNode) return {};
    const styles: Record<string, React.CSSProperties> = {};
    for (const hl of selectedNode.highlights) {
      const color = hl[0] === 'G' ? 'rgba(74, 222, 128, 0.4)' :
                    hl[0] === 'R' ? 'rgba(248, 113, 113, 0.4)' :
                    'rgba(251, 191, 36, 0.4)';
      const square = hl.substring(1, 3);
      styles[square] = { backgroundColor: color };
    }
    return styles;
  }, [selectedNode]);

  const repList = Object.values(repertoires);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Repertoire"
        subtitle={selectedRep ? `${selectedRep.name} (${selectedRep.color})` : 'Select or create a repertoire'}
        actions={
          selectedRep && (
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            >
              Import PGN
            </button>
          )
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: repertoire list */}
        <div className="w-52 border-r border-[var(--border)] p-3 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Repertoires</span>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="text-[var(--accent)] text-lg leading-none hover:text-[var(--accent-hover)]"
              title="New repertoire"
            >
              +
            </button>
          </div>

          {showCreateForm && (
            <div className="mb-3 p-2 bg-[var(--bg-tertiary)] rounded space-y-2">
              <input
                value={newRepName}
                onChange={(e) => setNewRepName(e.target.value)}
                placeholder="Name..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRepertoire()}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setNewRepColor('white')}
                  className={`flex-1 py-1 text-xs rounded ${newRepColor === 'white' ? 'bg-white text-black' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}
                >
                  ♔ White
                </button>
                <button
                  onClick={() => setNewRepColor('black')}
                  className={`flex-1 py-1 text-xs rounded ${newRepColor === 'black' ? 'bg-gray-700 text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}
                >
                  ♚ Black
                </button>
              </div>
              <button
                onClick={handleCreateRepertoire}
                className="w-full py-1 text-xs rounded bg-[var(--accent)] text-white"
              >
                Create
              </button>
            </div>
          )}

          {repList.map(rep => (
            <div
              key={rep.id}
              onClick={() => {
                selectRepertoire(rep.id);
                setOrientation(rep.color);
                loadFen(STARTING_FEN);
              }}
              className={`p-2.5 rounded cursor-pointer mb-1 transition-colors ${
                selectedRepertoireId === rep.id
                  ? 'bg-[rgba(124,124,255,0.15)] border border-[var(--accent)]/30'
                  : 'hover:bg-[var(--bg-hover)]'
              }`}
            >
              <div className="text-sm font-medium flex items-center gap-1.5">
                {rep.color === 'white' ? '♔' : '♚'} {rep.name}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {countNodes(rep.tree)} moves · {countLines(rep.tree)} lines
              </div>
            </div>
          ))}

          {repList.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-4">
              No repertoires yet. Create one to get started.
            </p>
          )}
        </div>

        {/* Center: chessboard */}
        <div className="flex flex-col items-center justify-start p-6 shrink-0">
          <ChessboardWrapper
            fen={fen}
            orientation={orientation}
            onPieceDrop={handlePieceDrop}
            interactive={!!selectedRep}
            customArrows={customArrows}
            customSquareStyles={customSquareStyles}
            boardWidth={440}
          />
          <BoardControls onFlip={handleFlip} onReset={handleReset} />
        </div>

        {/* Right panel: move tree + comment */}
        <div className="flex-1 border-l border-[var(--border)] flex flex-col overflow-hidden">
          {selectedRep ? (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Move Tree</div>
                {selectedRep.tree.children.length > 0 ? (
                  <MoveTree
                    nodes={selectedRep.tree.children}
                    selectedNodeId={selectedNodeId}
                    onNodeClick={handleNodeClick}
                  />
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    No moves yet. Drop pieces on the board or import a PGN.
                  </p>
                )}
              </div>

              {/* Comment panel */}
              {selectedNode && selectedNode.comment && (
                <div className="border-t border-[var(--border)] p-4 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Comment</div>
                  <p className="text-sm text-[var(--text-secondary)]">{selectedNode.comment}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
              Select a repertoire to view its move tree
            </div>
          )}
        </div>
      </div>

      <PGNImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
    </div>
  );
}
