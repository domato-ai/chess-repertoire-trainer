export type PlayerColor = 'white' | 'black';

export interface MoveNode {
  id: string;
  san: string;
  fen: string;
  parentId: string | null;
  children: MoveNode[];
  comment: string;
  arrows: string[];     // [%cal ...] e.g., ["Gf2f3", "Gh2h4"]
  highlights: string[]; // [%csl ...] e.g., ["Ge4", "Rf7"]
  nags: number[];       // $1=good, $2=mistake, $5=interesting, etc.
  isMainline: boolean;
  moveNumber: number;
  plyFromRoot: number;
  openingName: string;
}

export interface RepertoireTree {
  rootFen: string;
  children: MoveNode[];
}

export interface Repertoire {
  id: string;
  name: string;
  color: PlayerColor;
  tree: RepertoireTree;
  createdAt: number;
  updatedAt: number;
}

export interface RepertoireLine {
  id: string;
  repertoireId: string;
  moveNodeIds: string[];
  sanSequence: string[];
  displayName: string;
  terminalFen: string;
  openingName: string;
}

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
