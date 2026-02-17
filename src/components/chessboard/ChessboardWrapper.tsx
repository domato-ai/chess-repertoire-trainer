import { useState, useCallback, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import type { PlayerColor } from '../../types/repertoire';

export interface CustomArrow {
  from: string;
  to: string;
  color: string;
}

interface ChessboardWrapperProps {
  fen: string;
  orientation?: PlayerColor;
  onPieceDrop?: (sourceSquare: Square, targetSquare: Square) => boolean;
  interactive?: boolean;
  customArrows?: CustomArrow[];
  customSquareStyles?: Record<string, React.CSSProperties>;
  boardWidth?: number;
  animationDuration?: number;
  showCoordinates?: boolean;
}

export function ChessboardWrapper({
  fen,
  orientation = 'white',
  onPieceDrop,
  interactive = true,
  customArrows = [],
  customSquareStyles = {},
  boardWidth: _boardWidth = 480,
  animationDuration = 200,
  showCoordinates = true,
}: ChessboardWrapperProps) {
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
      if (!interactive || !onPieceDrop || !targetSquare) return false;
      return onPieceDrop(sourceSquare as Square, targetSquare as Square);
    },
    [interactive, onPieceDrop],
  );

  const handleSquareClick = useCallback(
    ({ square }: { piece: unknown; square: string }) => {
      if (!interactive || !onPieceDrop) return;

      if (moveFrom) {
        const result = onPieceDrop(moveFrom, square as Square);
        setMoveFrom(null);
        if (!result) {
          setMoveFrom(square as Square);
        }
      } else {
        setMoveFrom(square as Square);
      }
    },
    [interactive, onPieceDrop, moveFrom],
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...customSquareStyles };

    if (moveFrom) {
      styles[moveFrom] = {
        ...styles[moveFrom],
        backgroundColor: 'rgba(124, 124, 255, 0.4)',
      };
    }

    return styles;
  }, [customSquareStyles, moveFrom]);

  const arrows = useMemo(() =>
    customArrows.map(a => ({
      startSquare: a.from,
      endSquare: a.to,
      color: a.color,
    })),
    [customArrows],
  );

  return (
    <div className="chess-board-container" style={{ width: _boardWidth }}>
      <Chessboard
        options={{
          position: fen,
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          boardOrientation: orientation,
          animationDurationInMs: animationDuration,
          arrows,
          squareStyles,
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          },
          darkSquareStyle: { backgroundColor: '#779952' },
          lightSquareStyle: { backgroundColor: '#edeed1' },
          allowDragging: interactive,
          showNotation: showCoordinates,
        }}
      />
    </div>
  );
}
