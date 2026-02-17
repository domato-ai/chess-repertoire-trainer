import type { MoveNode } from '../../types/repertoire';
import { NAG_SYMBOLS } from '../../data/constants';

interface MoveTreeProps {
  nodes: MoveNode[];
  selectedNodeId: string | null;
  onNodeClick: (node: MoveNode) => void;
  depth?: number;
}

export function MoveTree({ nodes, selectedNodeId, onNodeClick, depth = 0 }: MoveTreeProps) {
  if (nodes.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-3 pl-3 border-l border-[var(--border)]' : ''}>
      {nodes.map((node, index) => (
        <MoveTreeBranch
          key={node.id}
          node={node}
          selectedNodeId={selectedNodeId}
          onNodeClick={onNodeClick}
          depth={depth}
          isVariation={index > 0}
        />
      ))}
    </div>
  );
}

interface MoveTreeBranchProps {
  node: MoveNode;
  selectedNodeId: string | null;
  onNodeClick: (node: MoveNode) => void;
  depth: number;
  isVariation: boolean;
}

function MoveTreeBranch({ node, selectedNodeId, onNodeClick, depth, isVariation }: MoveTreeBranchProps) {
  const isSelected = node.id === selectedNodeId;
  const nagText = node.nags.map(n => NAG_SYMBOLS[n] || `$${n}`).join('');
  const showMoveNumber = node.plyFromRoot % 2 === 1; // White's move

  return (
    <div>
      <span
        className={`inline-flex items-center gap-0.5 cursor-pointer rounded px-1 py-0.5 text-sm font-mono transition-colors ${
          isSelected
            ? 'bg-[var(--accent)] text-white'
            : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
        } ${isVariation ? 'text-[var(--text-secondary)]' : ''}`}
        onClick={() => onNodeClick(node)}
        title={node.comment || undefined}
      >
        {showMoveNumber && (
          <span className="text-[var(--text-muted)] mr-0.5">{node.moveNumber}.</span>
        )}
        {!showMoveNumber && isVariation && (
          <span className="text-[var(--text-muted)] mr-0.5">{node.moveNumber}...</span>
        )}
        <span className="font-semibold">{node.san}</span>
        {nagText && <span className="text-[var(--warning)] ml-0.5">{nagText}</span>}
        {node.comment && <span className="text-[var(--accent)] ml-0.5 text-xs">💬</span>}
        {node.openingName && (
          <span className="ml-1 text-xs text-[var(--accent)] font-sans opacity-80">
            [{node.openingName}]
          </span>
        )}
      </span>

      {/* Inline mainline continuation */}
      {node.children.length > 0 && (
        <>
          {/* Mainline continues inline */}
          {node.children[0] && (
            <MoveTreeBranch
              node={node.children[0]}
              selectedNodeId={selectedNodeId}
              onNodeClick={onNodeClick}
              depth={depth}
              isVariation={false}
            />
          )}

          {/* Variations are indented */}
          {node.children.length > 1 && (
            <div className="ml-2 pl-2 border-l border-[var(--border)] border-dashed my-1">
              {node.children.slice(1).map(child => (
                <div key={child.id} className="my-0.5">
                  <MoveTreeBranch
                    node={child}
                    selectedNodeId={selectedNodeId}
                    onNodeClick={onNodeClick}
                    depth={depth + 1}
                    isVariation={true}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
