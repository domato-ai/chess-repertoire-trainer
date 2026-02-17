import type { MoveNode, RepertoireTree, RepertoireLine } from '../types/repertoire';
import { generateId } from './uuid';

/** Find a node by ID anywhere in the tree */
export function findNode(tree: RepertoireTree, nodeId: string): MoveNode | null {
  for (const child of tree.children) {
    const found = findNodeInSubtree(child, nodeId);
    if (found) return found;
  }
  return null;
}

function findNodeInSubtree(node: MoveNode, nodeId: string): MoveNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeInSubtree(child, nodeId);
    if (found) return found;
  }
  return null;
}

/** Get the path from root to a specific node */
export function getPathToNode(tree: RepertoireTree, nodeId: string): MoveNode[] {
  for (const child of tree.children) {
    const path = findPathInSubtree(child, nodeId, []);
    if (path) return path;
  }
  return [];
}

function findPathInSubtree(node: MoveNode, nodeId: string, path: MoveNode[]): MoveNode[] | null {
  const currentPath = [...path, node];
  if (node.id === nodeId) return currentPath;
  for (const child of node.children) {
    const found = findPathInSubtree(child, nodeId, currentPath);
    if (found) return found;
  }
  return null;
}

/** Extract all root-to-leaf paths as RepertoireLine objects */
export function extractAllLines(tree: RepertoireTree, repertoireId: string): RepertoireLine[] {
  const lines: RepertoireLine[] = [];

  function walk(node: MoveNode, path: MoveNode[]) {
    const currentPath = [...path, node];

    if (node.children.length === 0) {
      // Leaf node — this is a complete line
      const openingName = findOpeningName(currentPath);
      lines.push({
        id: generateId(),
        repertoireId,
        moveNodeIds: currentPath.map(n => n.id),
        sanSequence: currentPath.map(n => n.san),
        displayName: openingName || formatLineName(currentPath),
        terminalFen: node.fen,
        openingName,
      });
    } else {
      for (const child of node.children) {
        walk(child, currentPath);
      }
    }
  }

  for (const child of tree.children) {
    walk(child, []);
  }

  return lines;
}

/** Find the deepest opening name in a path */
function findOpeningName(path: MoveNode[]): string {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].openingName) return path[i].openingName;
  }
  return '';
}

/** Format a line name from its SAN sequence */
function formatLineName(path: MoveNode[]): string {
  const moves = path.slice(0, 6).map((node, i) => {
    if (i % 2 === 0) {
      return `${node.moveNumber}. ${node.san}`;
    }
    return node.san;
  });
  return moves.join(' ') + (path.length > 6 ? ' ...' : '');
}

/** Insert a new move as a child of a parent node (or as root child) */
export function insertMove(
  tree: RepertoireTree,
  parentId: string | null,
  san: string,
  fen: string,
  moveNumber: number,
  plyFromRoot: number,
): { tree: RepertoireTree; newNode: MoveNode } {
  const newNode: MoveNode = {
    id: generateId(),
    san,
    fen,
    parentId,
    children: [],
    comment: '',
    arrows: [],
    highlights: [],
    nags: [],
    isMainline: false,
    moveNumber,
    plyFromRoot,
    openingName: '',
  };

  if (parentId === null) {
    // Add as root child
    newNode.isMainline = tree.children.length === 0;
    return {
      tree: { ...tree, children: [...tree.children, newNode] },
      newNode,
    };
  }

  // Deep clone and insert
  const newTree = deepCloneTree(tree);
  const parent = findNode(newTree, parentId);
  if (parent) {
    newNode.isMainline = parent.children.length === 0;
    parent.children.push(newNode);
  }
  return { tree: newTree, newNode };
}

/** Delete a node and its entire subtree */
export function deleteSubtree(tree: RepertoireTree, nodeId: string): RepertoireTree {
  const newTree = deepCloneTree(tree);
  newTree.children = removeFromChildren(newTree.children, nodeId);
  return newTree;
}

function removeFromChildren(children: MoveNode[], nodeId: string): MoveNode[] {
  return children
    .filter(child => child.id !== nodeId)
    .map(child => ({
      ...child,
      children: removeFromChildren(child.children, nodeId),
    }));
}

/** Promote a variation: move a child to children[0] */
export function promoteVariation(tree: RepertoireTree, parentId: string, childId: string): RepertoireTree {
  const newTree = deepCloneTree(tree);

  // Find parent (could be root)
  if (parentId === '__root__') {
    const idx = newTree.children.findIndex(c => c.id === childId);
    if (idx > 0) {
      const [promoted] = newTree.children.splice(idx, 1);
      promoted.isMainline = true;
      newTree.children[0].isMainline = false;
      newTree.children.unshift(promoted);
    }
    return newTree;
  }

  const parent = findNode(newTree, parentId);
  if (parent) {
    const idx = parent.children.findIndex(c => c.id === childId);
    if (idx > 0) {
      const [promoted] = parent.children.splice(idx, 1);
      promoted.isMainline = true;
      parent.children[0].isMainline = false;
      parent.children.unshift(promoted);
    }
  }
  return newTree;
}

/** Count total nodes in the tree */
export function countNodes(tree: RepertoireTree): number {
  let count = 0;
  function walk(node: MoveNode) {
    count++;
    for (const child of node.children) walk(child);
  }
  for (const child of tree.children) walk(child);
  return count;
}

/** Count total lines (leaf paths) */
export function countLines(tree: RepertoireTree): number {
  let count = 0;
  function walk(node: MoveNode) {
    if (node.children.length === 0) {
      count++;
    } else {
      for (const child of node.children) walk(child);
    }
  }
  for (const child of tree.children) walk(child);
  return count;
}

/** Merge an imported tree into an existing one */
export function mergeTrees(existing: RepertoireTree, imported: RepertoireTree): RepertoireTree {
  return {
    ...existing,
    children: mergeChildren(existing.children, imported.children),
  };
}

function mergeChildren(existingChildren: MoveNode[], importedChildren: MoveNode[]): MoveNode[] {
  const merged = existingChildren.map(c => ({ ...c, children: [...c.children] }));

  for (const impChild of importedChildren) {
    const match = merged.find(c => c.san === impChild.san);
    if (match) {
      // Recursively merge children
      match.children = mergeChildren(match.children, impChild.children);
      // Merge comments if existing has none
      if (impChild.comment && !match.comment) {
        match.comment = impChild.comment;
      }
      // Merge annotations
      if (impChild.arrows.length > 0 && match.arrows.length === 0) {
        match.arrows = impChild.arrows;
      }
      if (impChild.highlights.length > 0 && match.highlights.length === 0) {
        match.highlights = impChild.highlights;
      }
    } else {
      // New variation — add it
      merged.push({ ...impChild, isMainline: false });
    }
  }
  return merged;
}

function deepCloneTree(tree: RepertoireTree): RepertoireTree {
  return {
    rootFen: tree.rootFen,
    children: tree.children.map(deepCloneNode),
  };
}

function deepCloneNode(node: MoveNode): MoveNode {
  return {
    ...node,
    arrows: [...node.arrows],
    highlights: [...node.highlights],
    nags: [...node.nags],
    children: node.children.map(deepCloneNode),
  };
}
