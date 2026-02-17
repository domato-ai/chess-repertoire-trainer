import { Header } from '../components/layout/Header';
import { useRepertoireStore } from '../stores/useRepertoireStore';
import { useSRSStore } from '../stores/useSRSStore';

export function StatsPage() {
  const repertoires = useRepertoireStore(s => s.repertoires);
  const lines = useRepertoireStore(s => s.lines);
  const cards = useSRSStore(s => s.cards);
  const stats = useSRSStore(s => s.getStats());

  // Build line stats table
  const lineStats = Object.values(repertoires).flatMap(rep => {
    const repLines = lines[rep.id] || [];
    return repLines.map(line => {
      const card = cards[line.id];
      return {
        repertoire: rep.name,
        color: rep.color,
        lineName: line.displayName || line.openingName || line.sanSequence.slice(0, 4).join(' '),
        easeFactor: card?.easeFactor ?? 2.5,
        interval: card?.interval ?? 0,
        repetitions: card?.repetitions ?? 0,
        totalReviews: card?.totalReviews ?? 0,
        accuracy: card && card.totalReviews > 0
          ? Math.round((card.correctCount / card.totalReviews) * 100)
          : 0,
        streak: card?.streak ?? 0,
        nextReview: card?.nextReviewDate ?? 0,
        isNew: !card || card.totalReviews === 0,
      };
    });
  });

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const diff = Math.ceil((timestamp - now.getTime()) / 86_400_000);
    if (diff <= 0) return 'Due now';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Statistics" subtitle="Track your learning progress" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Summary */}
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{stats.totalLines}</div>
              <div className="text-xs text-[var(--text-muted)]">Total Lines</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[var(--accent)]">{stats.dueToday}</div>
              <div className="text-xs text-[var(--text-muted)]">Due Today</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{stats.newLines}</div>
              <div className="text-xs text-[var(--text-muted)]">New</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[var(--success)]">{stats.accuracy}%</div>
              <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{stats.totalReviews}</div>
              <div className="text-xs text-[var(--text-muted)]">Reviews</div>
            </div>
          </div>

          {/* Line stats table */}
          <div>
            <h3 className="text-lg font-semibold mb-3">All Lines</h3>
            {lineStats.length > 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left">
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium">Line</th>
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium">Repertoire</th>
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium text-center">Reviews</th>
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium text-center">Accuracy</th>
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium text-center">Streak</th>
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium text-center">Interval</th>
                        <th className="px-4 py-3 text-[var(--text-muted)] font-medium text-center">Next Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineStats.map((line, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-hover)]"
                        >
                          <td className="px-4 py-2.5 max-w-64 truncate font-mono text-xs">
                            {line.lineName}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                            {line.color === 'white' ? '♔' : '♚'} {line.repertoire}
                          </td>
                          <td className="px-4 py-2.5 text-center">{line.totalReviews}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={line.accuracy >= 80 ? 'text-[var(--success)]' : line.accuracy >= 50 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}>
                              {line.isNew ? '—' : `${line.accuracy}%`}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">{line.streak}</td>
                          <td className="px-4 py-2.5 text-center">{line.interval}d</td>
                          <td className="px-4 py-2.5 text-center text-[var(--text-muted)]">
                            {line.isNew ? 'New' : formatDate(line.nextReview)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-center py-8">
                No lines yet. Import a PGN to see your stats.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
