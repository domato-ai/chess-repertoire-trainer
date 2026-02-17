import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Repertoire, RepertoireTree, RepertoireLine, PlayerColor, MoveNode } from '../types/repertoire';
import { STARTING_FEN } from '../types/repertoire';
import { idbStorage } from '../utils/storage';
import { generateId } from '../utils/uuid';
import { extractAllLines, insertMove, deleteSubtree, promoteVariation, mergeTrees } from '../utils/repertoire-tree';

interface RepertoireStoreState {
  repertoires: Record<string, Repertoire>;
  lines: Record<string, RepertoireLine[]>; // keyed by repertoireId
  selectedRepertoireId: string | null;
  selectedNodeId: string | null;
  hydrated: boolean;

  createRepertoire: (name: string, color: PlayerColor) => Repertoire;
  deleteRepertoire: (id: string) => void;
  updateRepertoire: (id: string, updates: Partial<Pick<Repertoire, 'name'>>) => void;
  addMove: (repertoireId: string, parentId: string | null, san: string, fen: string, moveNumber: number, plyFromRoot: number) => MoveNode | null;
  deleteMove: (repertoireId: string, nodeId: string) => void;
  promoteVariation: (repertoireId: string, parentId: string, childId: string) => void;
  setComment: (repertoireId: string, nodeId: string, comment: string) => void;
  setOpeningName: (repertoireId: string, nodeId: string, name: string) => void;
  importTree: (repertoireId: string, importedTree: RepertoireTree, openingName: string) => void;
  recalculateLines: (repertoireId: string) => void;
  selectRepertoire: (id: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setHydrated: () => void;
}

export const useRepertoireStore = create<RepertoireStoreState>()(
  persist(
    (set, get) => ({
      repertoires: {},
      lines: {},
      selectedRepertoireId: null,
      selectedNodeId: null,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      createRepertoire: (name, color) => {
        const repertoire: Repertoire = {
          id: generateId(),
          name,
          color,
          tree: { rootFen: STARTING_FEN, children: [] },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(state => ({
          repertoires: { ...state.repertoires, [repertoire.id]: repertoire },
          lines: { ...state.lines, [repertoire.id]: [] },
        }));
        return repertoire;
      },

      deleteRepertoire: (id) => {
        set(state => {
          const { [id]: _, ...rest } = state.repertoires;
          const { [id]: __, ...restLines } = state.lines;
          return {
            repertoires: rest,
            lines: restLines,
            selectedRepertoireId: state.selectedRepertoireId === id ? null : state.selectedRepertoireId,
          };
        });
      },

      updateRepertoire: (id, updates) => {
        set(state => {
          const rep = state.repertoires[id];
          if (!rep) return state;
          return {
            repertoires: {
              ...state.repertoires,
              [id]: { ...rep, ...updates, updatedAt: Date.now() },
            },
          };
        });
      },

      addMove: (repertoireId, parentId, san, fen, moveNumber, plyFromRoot) => {
        const state = get();
        const rep = state.repertoires[repertoireId];
        if (!rep) return null;

        const result = insertMove(rep.tree, parentId, san, fen, moveNumber, plyFromRoot);
        set(s => ({
          repertoires: {
            ...s.repertoires,
            [repertoireId]: { ...rep, tree: result.tree, updatedAt: Date.now() },
          },
        }));

        get().recalculateLines(repertoireId);
        return result.newNode;
      },

      deleteMove: (repertoireId, nodeId) => {
        const state = get();
        const rep = state.repertoires[repertoireId];
        if (!rep) return;

        const newTree = deleteSubtree(rep.tree, nodeId);
        set(s => ({
          repertoires: {
            ...s.repertoires,
            [repertoireId]: { ...rep, tree: newTree, updatedAt: Date.now() },
          },
          selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
        }));

        get().recalculateLines(repertoireId);
      },

      promoteVariation: (repertoireId, parentId, childId) => {
        const state = get();
        const rep = state.repertoires[repertoireId];
        if (!rep) return;

        const newTree = promoteVariation(rep.tree, parentId, childId);
        set(s => ({
          repertoires: {
            ...s.repertoires,
            [repertoireId]: { ...rep, tree: newTree, updatedAt: Date.now() },
          },
        }));
      },

      setComment: (repertoireId, nodeId, comment) => {
        set(state => {
          const rep = state.repertoires[repertoireId];
          if (!rep) return state;

          const updateNode = (nodes: MoveNode[]): MoveNode[] =>
            nodes.map(n => {
              if (n.id === nodeId) return { ...n, comment };
              return { ...n, children: updateNode(n.children) };
            });

          return {
            repertoires: {
              ...state.repertoires,
              [repertoireId]: {
                ...rep,
                tree: { ...rep.tree, children: updateNode(rep.tree.children) },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      setOpeningName: (repertoireId, nodeId, name) => {
        set(state => {
          const rep = state.repertoires[repertoireId];
          if (!rep) return state;

          const updateNode = (nodes: MoveNode[]): MoveNode[] =>
            nodes.map(n => {
              if (n.id === nodeId) return { ...n, openingName: name };
              return { ...n, children: updateNode(n.children) };
            });

          return {
            repertoires: {
              ...state.repertoires,
              [repertoireId]: {
                ...rep,
                tree: { ...rep.tree, children: updateNode(rep.tree.children) },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      importTree: (repertoireId, importedTree, openingName) => {
        set(state => {
          const rep = state.repertoires[repertoireId];
          if (!rep) return state;

          // Set opening name on root nodes of imported tree
          const namedTree: RepertoireTree = {
            ...importedTree,
            children: importedTree.children.map(c => ({
              ...c,
              openingName: c.openingName || openingName,
            })),
          };

          const mergedTree = rep.tree.children.length > 0
            ? mergeTrees(rep.tree, namedTree)
            : namedTree;

          return {
            repertoires: {
              ...state.repertoires,
              [repertoireId]: { ...rep, tree: mergedTree, updatedAt: Date.now() },
            },
          };
        });

        get().recalculateLines(repertoireId);
      },

      recalculateLines: (repertoireId) => {
        const state = get();
        const rep = state.repertoires[repertoireId];
        if (!rep) return;

        const newLines = extractAllLines(rep.tree, repertoireId);
        set(s => ({
          lines: { ...s.lines, [repertoireId]: newLines },
        }));
      },

      selectRepertoire: (id) => set({ selectedRepertoireId: id, selectedNodeId: null }),
      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
    }),
    {
      name: 'chess-repertoire-store',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        repertoires: state.repertoires,
        lines: state.lines,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
