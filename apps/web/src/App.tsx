import { useState } from 'react';
import { PortfolioProvider } from './context/PortfolioContext';
import { useArtifacts } from './hooks/useArtifacts';
import { Nav, type Page } from './components/Nav';
import { Dashboard } from './pages/Dashboard';
import { Explore } from './pages/Explore';
import { PortfolioBuilder } from './pages/PortfolioBuilder';
import { Insights } from './pages/Insights';
import { Compare } from './pages/Compare';

function AppInner() {
  const [page, setPage] = useState<Page>('dashboard');
  const { metrics } = useArtifacts();

  return (
    <>
      <Nav current={page} onNavigate={setPage} />
      <main>
        {page === 'dashboard' && <Dashboard metrics={metrics} onNavigate={setPage} />}
        {page === 'explore'   && <Explore   metrics={metrics} onNavigate={setPage} />}
        {page === 'portfolio' && <PortfolioBuilder metrics={metrics} onNavigate={setPage} />}
        {page === 'insights'  && <Insights  metrics={metrics} onNavigate={setPage} />}
        {page === 'compare'   && <Compare />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <PortfolioProvider>
      <AppInner />
    </PortfolioProvider>
  );
}
