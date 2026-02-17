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
  let processed = pgn;

  // Remove [%evp ...] annotations
  processed = processed.replace(/\[%evp[^\]]*\]/g, '');

  // Remove [%emt ...] annotations
  processed = processed.replace(/\[%emt[^\]]*\]/g, '');

  // Remove [#] markers
  processed = processed.replace(/\[#\]/g, '');

  // Keep Z0 null moves as-is — they'll be handled during parsing
  // by skipping the rest of the variation when encountered

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
 * Uses a stack-based recursive descent parser for variations (RAV).
 * Each scope (main line + each variation) gets its own Chess instance
 * to avoid history corruption from chess.load().
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
  const pos = { idx: 0 };

  parseMoves(tokens, pos, STARTING_FEN, tree.children, null, 0, openingName, true);

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
  | { type: 'nullMove' }
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

    // Null move (ChessMood Z0 placeholder)
    if (text.substring(i, i + 2) === 'Z0') {
      tokens.push({ type: 'nullMove' });
      i += 2;
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
 * Skip remaining tokens in the current scope after a Z0 null move.
 * Properly handles nested parentheses so the parent scope isn't confused.
 * For a variation scope, consumes up to and including the matching ')'.
 * For the main scope, just skips everything.
 */
function skipRemainingMoves(tokens: Token[], pos: { idx: number }, isMainScope: boolean): void {
  let depth = 0;
  while (pos.idx < tokens.length) {
    const t = tokens[pos.idx];
    if (t.type === 'openParen') {
      depth++;
      pos.idx++;
    } else if (t.type === 'closeParen') {
      if (depth === 0) {
        // This closes our scope (variation)
        if (!isMainScope) {
          pos.idx++;
        }
        return;
      }
      depth--;
      pos.idx++;
    } else {
      pos.idx++;
    }
  }
}

/**
 * Core recursive parser. Each invocation handles one "scope" — either the
 * main line or a single variation delimited by parentheses.
 *
 * Key design: each scope creates its own Chess instance from `startFen`,
 * so we never need chess.load() which destroys history.
 *
 * @param tokens     - Full token array (shared, navigated via pos.idx)
 * @param pos        - Mutable position pointer into tokens
 * @param startFen   - FEN of the position before the first move in this scope
 * @param siblings   - The array to push first-moves into (e.g. tree.children or parentNode.children)
 * @param parentId   - ID of the parent node (null for root level)
 * @param plyOffset  - Ply count at startFen (for correct moveNumber calculation)
 * @param openingName - Opening name from PGN header
 * @param isMainScope - Whether this is the top-level (non-variation) scope
 */
function parseMoves(
  tokens: Token[],
  pos: { idx: number },
  startFen: string,
  siblings: MoveNode[],
  parentId: string | null,
  plyOffset: number,
  openingName: string,
  isMainScope: boolean,
): void {
  const chess = new Chess(startFen);
  let lastNode: MoveNode | null = null;
  let ply = plyOffset;
  let pendingNags: number[] = [];

  while (pos.idx < tokens.length) {
    const token = tokens[pos.idx];

    if (token.type === 'closeParen') {
      // End of this variation scope — consume the token only if we're a variation
      if (!isMainScope) {
        pos.idx++;
      }
      return;
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

    if (token.type === 'nullMove') {
      // Z0 null move — skip all remaining moves in this scope.
      // But we still need to handle nested variations correctly
      // (consume matching parens so the parent scope isn't confused).
      pos.idx++;
      skipRemainingMoves(tokens, pos, isMainScope);
      return;
    }

    if (token.type === 'move') {
      const result = chess.move(token.value);
      if (!result) {
        // Invalid move — skip it
        console.warn(`Invalid move "${token.value}" at position ${chess.fen()}`);
        pos.idx++;
        continue;
      }

      ply++;
      const moveNumber = Math.ceil(ply / 2);

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
        plyFromRoot: ply,
        openingName: '',
      };
      pendingNags = [];

      if (lastNode) {
        // Continuation — child of previous move
        node.isMainline = lastNode.children.length === 0;
        if (!node.isMainline) {
          node.openingName = '';
        }
        lastNode.children.push(node);
      } else {
        // First move in this scope
        node.isMainline = siblings.length === 0;
        if (node.isMainline && isMainScope) {
          node.openingName = openingName;
        }
        siblings.push(node);
      }

      lastNode = node;
      pos.idx++;
      continue;
    }

    if (token.type === 'openParen') {
      // A variation branches off as an alternative to `lastNode`.
      // The variation starts from the position BEFORE lastNode's move was played.
      pos.idx++; // consume '('

      if (lastNode) {
        // FEN before lastNode's move = the position where the parent was,
        // which is the FEN of the parent node, or startFen if lastNode is the first move.
        const branchFen = lastNode.parentId
          ? getFenForParent(lastNode, siblings, startFen)
          : startFen;

        // The variation's first move becomes a sibling of lastNode.
        // If lastNode has a parent, the sibling list is that parent's children.
        // If lastNode is a first move in this scope, the sibling list is `siblings`.
        const parentNode = lastNode.parentId
          ? findNodeById(siblings, lastNode.parentId)
          : null;
        const siblingList = parentNode ? parentNode.children : siblings;

        // Ply before lastNode was played
        const branchPly = lastNode.plyFromRoot - 1;

        parseMoves(
          tokens, pos, branchFen, siblingList,
          lastNode.parentId, branchPly, openingName, false,
        );
      } else {
        // Variation before any move in this scope — unusual but possible.
        // Just parse it into the siblings array from startFen.
        parseMoves(
          tokens, pos, startFen, siblings,
          parentId, plyOffset, openingName, false,
        );
      }
      continue;
    }

    // Unknown token — skip
    pos.idx++;
  }
}

/**
 * Get the FEN for the parent of a node by searching the tree.
 * Returns startFen if the parent is the root.
 */
function getFenForParent(
  node: MoveNode,
  rootChildren: MoveNode[],
  startFen: string,
): string {
  if (!node.parentId) return startFen;
  const parent = findNodeById(rootChildren, node.parentId);
  return parent ? parent.fen : startFen;
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
