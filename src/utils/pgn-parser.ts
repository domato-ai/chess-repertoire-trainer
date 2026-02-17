import { Chess } from 'chess.js';
import type { MoveNode, RepertoireTree } from '../types/repertoire';
import { STARTING_FEN } from '../types/repertoire';
import { generateId } from './uuid';

export interface ParsedGame {
  headers: Record<string, string>;
  openingName: string;
  tree: RepertoireTree;
  moveCount: number;
  lineCount: number;
}

/**
 * Split a multi-game PGN file into individual game strings.
 */
export function splitPGN(pgnText: string): string[] {
  const games: string[] = [];
  const lines = pgnText.split('\n');
  let currentGame = '';

  for (const line of lines) {
    if (line.startsWith('[Event ') && currentGame.trim()) {
      games.push(currentGame.trim());
      currentGame = '';
    }
    currentGame += line + '\n';
  }
  if (currentGame.trim()) {
    games.push(currentGame.trim());
  }

  return games;
}

/**
 * Pre-process PGN to handle ChessMood-specific format.
 * - Strips Z0 null moves and their continuations
 * - Strips [%evp ...] and [%emt ...] annotations
 * - Preserves [%cal ...] and [%csl ...] annotations
 */
function preprocessPGN(pgn: string): string {
  // Remove Z0 null moves - they appear as "Z0" in the PGN
  // Z0 followed by continuations in the same variation should be stripped
  let processed = pgn;

  // Remove [%evp ...] annotations
  processed = processed.replace(/\[%evp[^\]]*\]/g, '');

  // Remove [%emt ...] annotations
  processed = processed.replace(/\[%emt[^\]]*\]/g, '');

  // Remove [#] markers
  processed = processed.replace(/\[#\]/g, '');

  // Handle Z0 null moves: remove "Z0" and any subsequent moves in the same line
  // Z0 typically appears in sequences like "Z0 6. Nc3 Z0 7. f4"
  // We need to strip these entire sequences
  processed = processed.replace(/\bZ0\b/g, '');

  // Clean up double spaces and empty comments
  processed = processed.replace(/\{[\s]*\}/g, '');
  processed = processed.replace(/\s{2,}/g, ' ');

  return processed;
}

/**
 * Extract [%cal ...] and [%csl ...] from a comment string.
 */
function extractAnnotations(comment: string): {
  arrows: string[];
  highlights: string[];
  cleanComment: string;
} {
  const arrows: string[] = [];
  const highlights: string[] = [];

  let cleanComment = comment;

  // Extract arrows [%cal Gf2f3,Gh2h4]
  const calMatch = cleanComment.match(/\[%cal ([^\]]+)\]/g);
  if (calMatch) {
    for (const match of calMatch) {
      const inner = match.replace('[%cal ', '').replace(']', '');
      arrows.push(...inner.split(',').map(s => s.trim()).filter(Boolean));
    }
  }
  cleanComment = cleanComment.replace(/\[%cal [^\]]*\]/g, '');

  // Extract highlights [%csl Ge4,Rf7]
  const cslMatch = cleanComment.match(/\[%csl ([^\]]+)\]/g);
  if (cslMatch) {
    for (const match of cslMatch) {
      const inner = match.replace('[%csl ', '').replace(']', '');
      highlights.push(...inner.split(',').map(s => s.trim()).filter(Boolean));
    }
  }
  cleanComment = cleanComment.replace(/\[%csl [^\]]*\]/g, '');

  // Clean up extra whitespace
  cleanComment = cleanComment.replace(/\s{2,}/g, ' ').trim();

  return { arrows, highlights, cleanComment };
}

/**
 * Parse a single PGN game into a RepertoireTree.
 * Uses chess.js for move validation and FEN generation,
 * with custom recursive descent parser for variations (RAV).
 */
export function parseGame(pgnText: string): ParsedGame {
  // Extract headers
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(pgnText)) !== null) {
    headers[match[1]] = match[2];
  }

  const openingName = cleanOpeningName(headers['White'] || '');

  // Get the movetext (everything after the headers)
  const movetext = pgnText
    .replace(/\[[^\]]*\]/g, '') // Remove headers
    .trim();

  const preprocessed = preprocessPGN(movetext);

  // Parse the movetext into a tree
  const tree: RepertoireTree = {
    rootFen: STARTING_FEN,
    children: [],
  };

  const tokens = tokenize(preprocessed);
  const chess = new Chess();

  parseTokens(tokens, chess, tree.children, null, 0, openingName);

  const moveCount = countNodesInTree(tree.children);
  const lineCount = countLeavesInTree(tree.children);

  return {
    headers,
    openingName,
    tree,
    moveCount,
    lineCount,
  };
}

/** Clean the opening name from PGN White header */
function cleanOpeningName(raw: string): string {
  // Remove leading numbers like "2. Scotch Game" -> "Scotch Game"
  return raw.replace(/^\d+\.\s*/, '').trim();
}

// Token types for PGN parsing
type Token =
  | { type: 'move'; value: string }
  | { type: 'moveNumber'; value: string }
  | { type: 'nag'; value: number }
  | { type: 'comment'; value: string }
  | { type: 'openParen' }
  | { type: 'closeParen' }
  | { type: 'result'; value: string };

function tokenize(movetext: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const text = movetext;

  while (i < text.length) {
    // Skip whitespace
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }

    // Comment
    if (text[i] === '{') {
      const end = text.indexOf('}', i + 1);
      if (end === -1) break;
      const comment = text.substring(i + 1, end).trim();
      if (comment) {
        tokens.push({ type: 'comment', value: comment });
      }
      i = end + 1;
      continue;
    }

    // Open paren (start variation)
    if (text[i] === '(') {
      tokens.push({ type: 'openParen' });
      i++;
      continue;
    }

    // Close paren (end variation)
    if (text[i] === ')') {
      tokens.push({ type: 'closeParen' });
      i++;
      continue;
    }

    // NAG ($N)
    if (text[i] === '$') {
      let numStr = '';
      i++;
      while (i < text.length && /\d/.test(text[i])) {
        numStr += text[i];
        i++;
      }
      if (numStr) {
        tokens.push({ type: 'nag', value: parseInt(numStr, 10) });
      }
      continue;
    }

    // Result
    if (text.substring(i).match(/^(1-0|0-1|1\/2-1\/2|\*)/)) {
      const resultMatch = text.substring(i).match(/^(1-0|0-1|1\/2-1\/2|\*)/)!;
      tokens.push({ type: 'result', value: resultMatch[1] });
      i += resultMatch[1].length;
      continue;
    }

    // Move number (e.g., "1.", "1...", "12.")
    const moveNumMatch = text.substring(i).match(/^(\d+)\.(\.\.)?/);
    if (moveNumMatch) {
      tokens.push({ type: 'moveNumber', value: moveNumMatch[0] });
      i += moveNumMatch[0].length;
      continue;
    }

    // SAN move (e.g., "e4", "Nf3", "O-O", "O-O-O", "Qxd4+", "exd5")
    const sanMatch = text.substring(i).match(/^([KQRBNP]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)[+#]?/);
    if (sanMatch) {
      tokens.push({ type: 'move', value: sanMatch[0] });
      i += sanMatch[0].length;
      continue;
    }

    // Skip any other character
    i++;
  }

  return tokens;
}

/**
 * Recursively parse tokens into MoveNode children.
 */
function parseTokens(
  tokens: Token[],
  chess: Chess,
  children: MoveNode[],
  parentId: string | null,
  _plyOffset: number,
  openingName: string,
  pos: { idx: number } = { idx: 0 },
): void {
  let pendingNags: number[] = [];
  let lastNode: MoveNode | null = null;

  while (pos.idx < tokens.length) {
    const token = tokens[pos.idx];

    if (token.type === 'closeParen') {
      // End of variation
      pos.idx++;
      break;
    }

    if (token.type === 'result') {
      pos.idx++;
      continue;
    }

    if (token.type === 'moveNumber') {
      pos.idx++;
      continue;
    }

    if (token.type === 'comment') {
      if (lastNode) {
        // Attach comment to the last move
        const { arrows, highlights, cleanComment } = extractAnnotations(token.value);
        if (cleanComment) {
          lastNode.comment = lastNode.comment
            ? lastNode.comment + ' ' + cleanComment
            : cleanComment;
        }
        lastNode.arrows.push(...arrows);
        lastNode.highlights.push(...highlights);
      } else {
        // Comment before first move — store as pending
        // TODO: use pending comment for root node annotation
      }
      pos.idx++;
      continue;
    }

    if (token.type === 'nag') {
      if (lastNode) {
        lastNode.nags.push(token.value);
      } else {
        pendingNags.push(token.value);
      }
      pos.idx++;
      continue;
    }

    if (token.type === 'move') {
      // Try to make the move
      const result = chess.move(token.value);
      if (!result) {
        // Invalid move — skip
        pos.idx++;
        continue;
      }

      const currentPly = chess.history().length;
      const moveNumber = Math.ceil(currentPly / 2);

      const node: MoveNode = {
        id: generateId(),
        san: result.san,
        fen: chess.fen(),
        parentId,
        children: [],
        comment: '',
        arrows: [],
        highlights: [],
        nags: pendingNags.length > 0 ? [...pendingNags] : [],
        isMainline: children.length === 0 && !lastNode,
        moveNumber,
        plyFromRoot: currentPly,
        openingName: children.length === 0 && !lastNode ? openingName : '',
      };

      pendingNags = [];

      if (lastNode) {
        // This move follows the previous — add as child of last node
        lastNode.children.push(node);
        node.parentId = lastNode.id;
        node.isMainline = lastNode.children.length === 1;
        lastNode = node;
      } else {
        // First move at this level
        children.push(node);
        node.isMainline = children.length === 1;
        lastNode = node;
      }

      pos.idx++;
      continue;
    }

    if (token.type === 'openParen') {
      // Start a variation — we need to back up to the position before the last move
      // The variation is an alternative to the last move played
      pos.idx++;

      if (lastNode) {
        // Undo the last move to get the position before it
        const savedFen = chess.fen();
        chess.undo();

        // Find where to attach this variation
        const variationParent = lastNode.parentId;
        const parentNode = variationParent ? findNodeById(children, variationParent) : null;
        const siblingList = parentNode ? parentNode.children : children;

        // Create a temporary chess instance for this variation
        const variationChess = new Chess(chess.fen());

        const variationChildren: MoveNode[] = [];
        // Parse the variation
        parseVariation(tokens, variationChess, variationChildren, variationParent, openingName, pos);

        // Add variation moves as siblings
        for (const varChild of variationChildren) {
          varChild.isMainline = false;
          siblingList.push(varChild);
        }

        // Restore position
        chess.load(savedFen);
      }
      continue;
    }

    pos.idx++;
  }
}

function parseVariation(
  tokens: Token[],
  chess: Chess,
  children: MoveNode[],
  parentId: string | null,
  openingName: string,
  pos: { idx: number },
): void {
  let lastNode: MoveNode | null = null;
  let pendingNags: number[] = [];

  while (pos.idx < tokens.length) {
    const token = tokens[pos.idx];

    if (token.type === 'closeParen') {
      pos.idx++;
      break;
    }

    if (token.type === 'result' || token.type === 'moveNumber') {
      pos.idx++;
      continue;
    }

    if (token.type === 'comment') {
      if (lastNode) {
        const { arrows, highlights, cleanComment } = extractAnnotations(token.value);
        if (cleanComment) {
          lastNode.comment = lastNode.comment
            ? lastNode.comment + ' ' + cleanComment
            : cleanComment;
        }
        lastNode.arrows.push(...arrows);
        lastNode.highlights.push(...highlights);
      }
      pos.idx++;
      continue;
    }

    if (token.type === 'nag') {
      if (lastNode) {
        lastNode.nags.push(token.value);
      } else {
        pendingNags.push(token.value);
      }
      pos.idx++;
      continue;
    }

    if (token.type === 'move') {
      const result = chess.move(token.value);
      if (!result) {
        pos.idx++;
        continue;
      }

      const currentPly = chess.history().length;
      const moveNumber = Math.ceil(currentPly / 2);

      const node: MoveNode = {
        id: generateId(),
        san: result.san,
        fen: chess.fen(),
        parentId: lastNode ? lastNode.id : parentId,
        children: [],
        comment: '',
        arrows: [],
        highlights: [],
        nags: pendingNags.length > 0 ? [...pendingNags] : [],
        isMainline: false,
        moveNumber,
        plyFromRoot: currentPly,
        openingName: '',
      };

      pendingNags = [];

      if (lastNode) {
        lastNode.children.push(node);
        node.isMainline = lastNode.children.length === 1;
      } else {
        children.push(node);
      }

      lastNode = node;
      pos.idx++;
      continue;
    }

    if (token.type === 'openParen') {
      pos.idx++;

      if (lastNode) {
        const savedFen = chess.fen();
        chess.undo();

        const subVariationChildren: MoveNode[] = [];
        const subChess = new Chess(chess.fen());
        parseVariation(tokens, subChess, subVariationChildren, lastNode.parentId, openingName, pos);

        // Find where to attach - as siblings of lastNode
        const attachParent = lastNode.parentId
          ? findNodeById(children, lastNode.parentId)
          : null;
        const siblingList = attachParent ? attachParent.children : children;

        for (const varChild of subVariationChildren) {
          varChild.isMainline = false;
          siblingList.push(varChild);
        }

        chess.load(savedFen);
      }
      continue;
    }

    pos.idx++;
  }
}

function findNodeById(nodes: MoveNode[], id: string): MoveNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function countNodesInTree(nodes: MoveNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    count += countNodesInTree(node.children);
  }
  return count;
}

function countLeavesInTree(nodes: MoveNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.children.length === 0) {
      count++;
    } else {
      count += countLeavesInTree(node.children);
    }
  }
  return count;
}

/**
 * Parse a complete multi-game PGN file.
 */
export function parseMultiGamePGN(pgnText: string): ParsedGame[] {
  const games = splitPGN(pgnText);
  const parsed: ParsedGame[] = [];

  for (const gamePgn of games) {
    try {
      const game = parseGame(gamePgn);
      if (game.moveCount > 0) {
        parsed.push(game);
      }
    } catch (e) {
      console.warn('Failed to parse game:', e);
    }
  }

  return parsed;
}
