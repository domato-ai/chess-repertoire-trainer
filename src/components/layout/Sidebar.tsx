import { NavLink } from 'react-router-dom';
import { useSRSStore } from '../../stores/useSRSStore';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⊞' },
  { path: '/repertoire', label: 'Repertoire', icon: '♟' },
  { path: '/drill', label: 'Drill', icon: '⚡' },
  { path: '/stats', label: 'Stats', icon: '📊' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const stats = useSRSStore(s => s.getStats());

  return (
    <aside className="w-56 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col shrink-0">
      <div className="p-4 border-b border-[var(--border)]">
        <h1 className="text-lg font-bold text-[var(--accent)]">♔ ChessRep</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Opening Trainer</p>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5 ${
                isActive
                  ? 'bg-[rgba(124,124,255,0.15)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
            {item.path === '/drill' && stats.dueToday > 0 && (
              <span className="ml-auto text-xs bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-full">
                {stats.dueToday}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border)]">
        <div className="text-xs text-[var(--text-muted)]">
          {stats.totalLines} lines · {stats.dueToday} due
        </div>
      </div>
    </aside>
  );
}
