import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { Header } from '../components/layout/Header';
import { ChessboardWrapper, type CustomArrow } from '../components/chessboard/ChessboardWrapper';
import { useRepertoireStore } from '../stores/useRepertoireStore';
import { useDrillStore } from '../stores/useDrillStore';
import { useSRSStore } from '../stores/useSRSStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { deriveQuality } from '../utils/sm2';
import { findNode } from '../utils/repertoire-tree';
import { QUALITY_RATINGS, FEEDBACK_DURATION_CORRECT, FEEDBACK_DURATION_INCORRECT } from '../data/constants';
import type { PlayerColor } from '../types/repertoire';
import { STARTING_FEN } from '../types/repertoire';

export function DrillPage() {
  const repertoires = useRepertoireStore(s => s.repertoires);
  const lines = useRepertoireStore(s => s.lines);
  const srsCards = useSRSStore(s => s.cards);

  // Select individual drill store fields to avoid infinite loops
  const status = useDrillStore(s => s.status);
  const currentLine = useDrillStore(s => s.currentLine);
  const currentPlyIndex = useDrillStore(s => s.currentPlyIndex);
  const userColor = useDrillStore(s => s.userColor);
  const mistakeCount = useDrillStore(s => s.mistakeCount);
  const hintsUsed = useDrillStore(s => s.hintsUsed);
  const linesCompleted = useDrillStore(s => s.linesCompleted);
  const linesRemaining = useDrillStore(s => s.linesRemaining);
  const sessionResults = useDrillStore(s => s.sessionResults);
  const startTime = useDrillStore(s => s.startTime);

  const autoPlayDelay = useSettingsStore(s => s.autoPlayDelay);

  const [boardFen, setBoardFen] = useState(STARTING_FEN);
  const [orientation, setOrientation] = useState<PlayerColor>('white');
  const [squareStyles, setSquareStyles] = useState<Record<string, React.CSSProperties>>({});
  const [arrows, setArrows] = useState<CustomArrow[]>([]);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Get the expected move SAN at the current ply
  const expectedSan = currentLine?.sanSequence[currentPlyIndex] || null;

  // Is it the user's turn?
  const isUserTurn = useMemo(() => {
    if (!currentLine) return false;
    const isWhiteTurn = currentPlyIndex % 2 === 0;
    return (userColor === 'white' && isWhiteTurn) || (userColor === 'black' && !isWhiteTurn);
  }, [currentPlyIndex, userColor, currentLine]);

  // Auto-play opponent's move
  useEffect(() => {
    if (status !== 'playing' || !currentLine || isUserTurn || waitingForOpponent) return;

    setWaitingForOpponent(true);
    timerRef.current = setTimeout(() => {
      const san = currentLine.sanSequence[currentPlyIndex];
      if (!san) return;

      const chess = new Chess(STARTING_FEN);
      for (let i = 0; i < currentPlyIndex; i++) {
        chess.move(currentLine.sanSequence[i]);
      }
      chess.move(san);
      setBoardFen(chess.fen());
      useDrillStore.getState().advancePly();
      setWaitingForOpponent(false);

      if (currentPlyIndex + 1 >= currentLine.sanSequence.length) {
        const quality = deriveQuality(mistakeCount, hintsUsed);
        useDrillStore.getState().completeLine({
          lineId: currentLine.id,
          timestamp: Date.now(),
          quality,
          mistakes: mistakeCount,
          hintsUsed,
          timeSpentMs: Date.now() - (startTime || Date.now()),
        });
      }
    }, autoPlayDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, currentLine, currentPlyIndex, isUserTurn, waitingForOpponent, autoPlayDelay, mistakeCount, hintsUsed, startTime]);

  // Handle user's move
  const handlePieceDrop = useCallback((source: Square, target: Square): boolean => {
    if (status !== 'playing' || !currentLine || !isUserTurn || !expectedSan) return false;

    const chess = new Chess(STARTING_FEN);
    for (let i = 0; i < currentPlyIndex; i++) {
      chess.move(currentLine.sanSequence[i]);
    }

    try {
      const move = chess.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;

      const repId = currentLine.repertoireId;
      const rep = repertoires[repId];
      let acceptedMoves: string[] = [expectedSan];

      if (rep && currentPlyIndex > 0) {
        const prevNodeId = currentLine.moveNodeIds[currentPlyIndex - 1];
        const prevNode = findNode(rep.tree, prevNodeId);
        if (prevNode) {
          acceptedMoves = prevNode.children.map(c => c.san);
        }
      } else if (rep && currentPlyIndex === 0) {
        acceptedMoves = rep.tree.children.map(c => c.san);
      }

      if (acceptedMoves.includes(move.san)) {
        setSquareStyles({
          [target]: { backgroundColor: 'rgba(74, 222, 128, 0.5)' },
        });
        useDrillStore.getState().setFeedback('correct');
        setBoardFen(chess.fen());
        useDrillStore.getState().advancePly();

        setTimeout(() => {
          setSquareStyles({});
          useDrillStore.getState().setFeedback(null);

          if (currentPlyIndex + 1 >= currentLine.sanSequence.length) {
            const quality = deriveQuality(mistakeCount, hintsUsed);
            useDrillStore.getState().completeLine({
              lineId: currentLine.id,
              timestamp: Date.now(),
              quality,
              mistakes: mistakeCount,
              hintsUsed,
              timeSpentMs: Date.now() - (startTime || Date.now()),
            });
          }
        }, FEEDBACK_DURATION_CORRECT);

        return true;
      } else {
        setSquareStyles({
          [target]: { backgroundColor: 'rgba(248, 113, 113, 0.5)' },
        });
        useDrillStore.getState().setFeedback('incorrect');
        useDrillStore.getState().addMistake();

        const correctChess = new Chess(STARTING_FEN);
        for (let i = 0; i < currentPlyIndex; i++) {
          correctChess.move(currentLine.sanSequence[i]);
        }
        const correctMove = correctChess.move(expectedSan);
        if (correctMove) {
          setArrows([{ from: correctMove.from, to: correctMove.to, color: '#4ade80' }]);
        }

        setTimeout(() => {
          const revertChess = new Chess(STARTING_FEN);
          for (let i = 0; i < currentPlyIndex; i++) {
            revertChess.move(currentLine.sanSequence[i]);
          }
          setBoardFen(revertChess.fen());
          setSquareStyles({});
          setArrows([]);
          useDrillStore.getState().setFeedback(null);
        }, FEEDBACK_DURATION_INCORRECT);

        return false;
      }
    } catch {
      return false;
    }
  }, [status, currentLine, currentPlyIndex, isUserTurn, expectedSan, repertoires, startTime, hintsUsed, mistakeCount]);

  // Handle hint
  const handleHint = useCallback(() => {
    if (!currentLine || !expectedSan) return;

    const chess = new Chess(STARTING_FEN);
    for (let i = 0; i < currentPlyIndex; i++) {
      chess.move(currentLine.sanSequence[i]);
    }
    const hintMove = chess.move(expectedSan);
    if (hintMove) {
      if (hintsUsed % 2 === 0) {
        setSquareStyles({
          [hintMove.from]: { backgroundColor: 'rgba(251, 191, 36, 0.4)' },
        });
      } else {
        setArrows([{ from: hintMove.from, to: hintMove.to, color: '#fbbf24' }]);
      }
      useDrillStore.getState().addHint();
    }
    chess.undo();
  }, [currentLine, expectedSan, currentPlyIndex, hintsUsed]);

  // Handle difficulty rating
  const handleRate = useCallback((quality: number) => {
    if (!currentLine) return;

    const lastResult = sessionResults[sessionResults.length - 1];
    if (lastResult) {
      useSRSStore.getState().processReview({ ...lastResult, quality });
    }

    useDrillStore.getState().nextLine();

    setBoardFen(STARTING_FEN);
    setSquareStyles({});
    setArrows([]);
  }, [currentLine, sessionResults]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (!currentLine || status !== 'playing') return;
    useDrillStore.getState().completeLine({
      lineId: currentLine.id,
      timestamp: Date.now(),
      quality: 0,
      mistakes: mistakeCount + 3,
      hintsUsed,
      timeSpentMs: Date.now() - (startTime || Date.now()),
    });
  }, [currentLine, status, mistakeCount, hintsUsed, startTime]);

  useKeyboardShortcuts({
    onHint: handleHint,
    onSkip: handleSkip,
  });

  // Start a drill session
  const handleStartDrill = useCallback((repId: string, lineIds?: string[]) => {
    const rep = repertoires[repId];
    if (!rep) return;

    const repLines = lines[repId] || [];
    const now = Date.now();
    const allCards = Object.values(srsCards);
    const dueCardIds = allCards
      .filter(c => c.repertoireId === repId && c.nextReviewDate <= now && c.totalReviews > 0)
      .map(c => c.lineId);
    const newCardIds = allCards
      .filter(c => c.repertoireId === repId && c.totalReviews === 0)
      .slice(0, 10)
      .map(c => c.lineId);

    let drillLineIds: string[];
    if (lineIds && lineIds.length > 0) {
      drillLineIds = lineIds;
    } else {
      drillLineIds = [...dueCardIds, ...newCardIds];
    }

    const drillLines = repLines.filter(l => drillLineIds.includes(l.id));
    if (drillLines.length === 0) {
      useDrillStore.getState().startSession(
        { repertoireId: repId, lineIds: [], shuffleOrder: true, showHints: true, maxLines: 20 },
        repLines.slice(0, 20),
        rep.color,
      );
    } else {
      useDrillStore.getState().startSession(
        { repertoireId: repId, lineIds: drillLineIds, shuffleOrder: true, showHints: true, maxLines: 0 },
        drillLines,
        rep.color,
      );
    }

    setOrientation(rep.color);
    setBoardFen(STARTING_FEN);
    setSquareStyles({});
    setArrows([]);
  }, [repertoires, lines, srsCards]);

  // Render based on drill status
  if (status === 'idle' || status === 'selecting') {
    const now = Date.now();
    const allCards = Object.values(srsCards);

    return (
      <div className="flex flex-col h-full">
        <Header title="Drill" subtitle="Practice your opening lines" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto space-y-4">
            <h3 className="text-lg font-medium">Select a repertoire to drill</h3>
            {Object.values(repertoires).map(rep => {
              const repLines = lines[rep.id] || [];
              const dueCount = allCards.filter(c => c.repertoireId === rep.id && c.nextReviewDate <= now && c.totalReviews > 0).length;
              const newCount = allCards.filter(c => c.repertoireId === rep.id && c.totalReviews === 0).length;

              return (
                <div
                  key={rep.id}
                  className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {rep.color === 'white' ? '♔' : '♚'} {rep.name}
                      </div>
                      <div className="text-sm text-[var(--text-muted)] mt-1">
                        {repLines.length} lines · {dueCount} due · {newCount} new
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartDrill(rep.id)}
                      disabled={repLines.length === 0}
                      className="px-4 py-2 text-sm rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start Drill
                    </button>
                  </div>
                </div>
              );
            })}

            {Object.keys(repertoires).length === 0 && (
              <p className="text-[var(--text-muted)] text-center">
                No repertoires yet. Go to the Repertoire page to create one and import PGN.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    const totalLines = linesCompleted.length;
    const totalMistakes = sessionResults.reduce((sum, r) => sum + r.mistakes, 0);
    const totalHints = sessionResults.reduce((sum, r) => sum + r.hintsUsed, 0);
    const avgQuality = sessionResults.length > 0
      ? sessionResults.reduce((sum, r) => sum + r.quality, 0) / sessionResults.length
      : 0;

    return (
      <div className="flex flex-col h-full">
        <Header title="Drill Complete!" />
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h3 className="text-2xl font-bold">Session Complete!</h3>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                <div className="text-2xl font-bold text-[var(--accent)]">{totalLines}</div>
                <div className="text-sm text-[var(--text-muted)]">Lines drilled</div>
              </div>
              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                <div className="text-2xl font-bold text-[var(--success)]">{avgQuality.toFixed(1)}</div>
                <div className="text-sm text-[var(--text-muted)]">Avg quality</div>
              </div>
              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                <div className="text-2xl font-bold text-[var(--error)]">{totalMistakes}</div>
                <div className="text-sm text-[var(--text-muted)]">Mistakes</div>
              </div>
              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                <div className="text-2xl font-bold text-[var(--warning)]">{totalHints}</div>
                <div className="text-sm text-[var(--text-muted)]">Hints used</div>
              </div>
            </div>
            <button
              onClick={() => useDrillStore.getState().reset()}
              className="px-6 py-2.5 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            >
              Back to Drill Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing or rating
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Drill"
        subtitle={currentLine ? `${currentLine.displayName || currentLine.openingName}` : 'Playing...'}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col items-center justify-start p-6 flex-1">
          <ChessboardWrapper
            fen={boardFen}
            orientation={orientation}
            onPieceDrop={handlePieceDrop}
            interactive={status === 'playing' && isUserTurn && !waitingForOpponent}
            customArrows={arrows}
            customSquareStyles={squareStyles}
            boardWidth={480}
          />

          {/* Drill controls */}
          <div className="mt-4 flex gap-3">
            {status === 'playing' && isUserTurn && (
              <button
                onClick={handleHint}
                className="px-4 py-2 text-sm rounded bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/30"
              >
                Hint (H)
              </button>
            )}
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Skip (S)
            </button>
          </div>

          {/* Progress */}
          <div className="mt-3 text-sm text-[var(--text-muted)]">
            Line {linesCompleted.length + 1} of {linesCompleted.length + linesRemaining.length + 1}
            {currentLine && (
              <span> · Move {Math.ceil((currentPlyIndex + 1) / 2)} of {Math.ceil(currentLine.sanSequence.length / 2)}</span>
            )}
          </div>

          {/* Waiting indicator */}
          {status === 'playing' && !isUserTurn && (
            <div className="mt-2 text-sm text-[var(--text-muted)]">Opponent is thinking...</div>
          )}
        </div>

        {/* Rating panel (shown when line is complete) */}
        {status === 'rating' && (
          <div className="w-72 border-l border-[var(--border)] p-6 flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold mb-2">How was that?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4 text-center">
              {mistakeCount === 0 && hintsUsed === 0 && 'Perfect! No mistakes.'}
              {mistakeCount > 0 && `${mistakeCount} mistake(s).`}
              {hintsUsed > 0 && ` ${hintsUsed} hint(s) used.`}
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {QUALITY_RATINGS.map(({ label, quality, color }) => (
                <button
                  key={quality}
                  onClick={() => handleRate(quality)}
                  className="py-3 rounded text-sm font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: color + '22', color }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
