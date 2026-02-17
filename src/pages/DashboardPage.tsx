import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { useRepertoireStore } from '../stores/useRepertoireStore';
import { useSRSStore } from '../stores/useSRSStore';
import { countLines } from '../utils/repertoire-tree';

export function DashboardPage() {
  const repertoires = useRepertoireStore(s => s.repertoires);
  const lines = useRepertoireStore(s => s.lines);
  const stats = useSRSStore(s => s.getStats());
  const getDueCards = useSRSStore(s => s.getDueCards);
  const navigate = useNavigate();

  const repList = Object.values(repertoires);

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Your opening training overview" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Lines" value={stats.totalLines} icon="📚" />
            <StatCard
              label="Due Today"
              value={stats.dueToday}
              icon="⚡"
              highlight={stats.dueToday > 0}
            />
            <StatCard label="New Lines" value={stats.newLines} icon="✨" />
            <StatCard label="Accuracy" value={`${stats.accuracy}%`} icon="🎯" />
          </div>

          {/* Quick start */}
          {stats.dueToday > 0 && (
            <div className="bg-[rgba(124,124,255,0.08)] border border-[var(--accent)]/20 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {stats.dueToday} line{stats.dueToday !== 1 ? 's' : ''} due for review
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Keep your streaks alive — practice your openings daily.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/drill')}
                  className="px-5 py-2.5 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-medium"
                >
                  Start Review
                </button>
              </div>
            </div>
          )}

          {/* Repertoire overview */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Repertoires</h3>
            {repList.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {repList.map(rep => {
                  const repLines = lines[rep.id] || [];
                  const dueCount = getDueCards(rep.id).length;

                  return (
                    <div
                      key={rep.id}
                      onClick={() => navigate('/repertoire')}
                      className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 cursor-pointer hover:border-[var(--accent)]/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{rep.color === 'white' ? '♔' : '♚'}</span>
                        <div>
                          <div className="font-medium">{rep.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {repLines.length} lines · {countLines(rep.tree)} variations
                          </div>
                        </div>
                      </div>
                      {dueCount > 0 && (
                        <div className="text-xs text-[var(--accent)] mt-1">
                          {dueCount} due for review
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-8 text-center">
                <div className="text-4xl mb-3">♟</div>
                <h4 className="text-lg font-medium mb-2">No repertoires yet</h4>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Create a repertoire and import your PGN files to start training.
                </p>
                <button
                  onClick={() => navigate('/repertoire')}
                  className="px-4 py-2 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                >
                  Go to Repertoire
                </button>
              </div>
            )}
          </div>

          {/* Overall progress */}
          {stats.totalReviews > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Progress</h3>
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalReviews}</div>
                    <div className="text-xs text-[var(--text-muted)]">Total Reviews</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--success)]">{stats.accuracy}%</div>
                    <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--accent)]">{stats.averageEase}</div>
                    <div className="text-xs text-[var(--text-muted)]">Avg Ease Factor</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number | string; icon: string; highlight?: boolean }) {
  return (
    <div className={`bg-[var(--bg-secondary)] border rounded-lg p-4 ${highlight ? 'border-[var(--accent)]/40' : 'border-[var(--border)]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-[var(--accent)]' : ''}`}>{value}</div>
    </div>
  );
}
