import { useState, useCallback, useRef } from 'react';
import { Chess, type Square, type Move } from 'chess.js';
import { STARTING_FEN } from '../types/repertoire';

export function useChessEngine(initialFen: string = STARTING_FEN) {
  const chessRef = useRef(new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [history, setHistory] = useState<string[]>([]);

  const updateState = useCallback(() => {
    setFen(chessRef.current.fen());
    setHistory(chessRef.current.history());
  }, []);

  const makeMove = useCallback((
    from: Square,
    to: Square,
    promotion?: string,
  ): Move | null => {
    try {
      const move = chessRef.current.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' });
      if (move) {
        updateState();
        return move;
      }
      return null;
    } catch {
      return null;
    }
  }, [updateState]);

  const makeSanMove = useCallback((san: string): Move | null => {
    try {
      const move = chessRef.current.move(san);
      if (move) {
        updateState();
        return move;
      }
      return null;
    } catch {
      return null;
    }
  }, [updateState]);

  const loadFen = useCallback((newFen: string) => {
    chessRef.current.load(newFen);
    updateState();
  }, [updateState]);

  const reset = useCallback(() => {
    chessRef.current.reset();
    updateState();
  }, [updateState]);

  const undo = useCallback((): Move | null => {
    const move = chessRef.current.undo();
    if (move) {
      updateState();
      return move;
    }
    return null;
  }, [updateState]);

  const getLegalMoves = useCallback((square?: Square): Move[] => {
    return chessRef.current.moves({ square, verbose: true });
  }, []);

  const isCheck = useCallback(() => chessRef.current.isCheck(), []);
  const isCheckmate = useCallback(() => chessRef.current.isCheckmate(), []);
  const isGameOver = useCallback(() => chessRef.current.isGameOver(), []);
  const turn = useCallback(() => chessRef.current.turn(), []);

  return {
    chess: chessRef.current,
    fen,
    history,
    makeMove,
    makeSanMove,
    loadFen,
    reset,
    undo,
    getLegalMoves,
    isCheck,
    isCheckmate,
    isGameOver,
    turn,
  };
}
