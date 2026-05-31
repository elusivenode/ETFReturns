export type Page = 'dashboard' | 'explore' | 'portfolio' | 'insights' | 'compare';

const LINKS: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'explore',   label: 'Explore' },
  { page: 'portfolio', label: 'Portfolio' },
  { page: 'insights',  label: 'Insights' },
  { page: 'compare',   label: 'Compare' },
];

interface NavProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

export function Nav({ current, onNavigate }: NavProps) {
  return (
    <nav className="nav">
      <span className="nav-logo">SMSF Planner</span>
      <div className="nav-links">
        {LINKS.map(({ page, label }) => (
          <button
            key={page}
            className={`nav-link${current === page ? ' active' : ''}`}
            onClick={() => onNavigate(page)}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
