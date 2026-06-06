import { useState } from 'react';
import { PortfolioProvider } from './context/PortfolioContext';
import { useArtifacts, usePeriodMetrics, useRiskMetrics } from './hooks/useArtifacts';
import { Nav, type Page } from './components/Nav';
import { Dashboard } from './pages/Dashboard';
import { Explore } from './pages/Explore';
import { Analytics } from './pages/Analytics';
import { PortfolioBuilder } from './pages/PortfolioBuilder';
import { Insights } from './pages/Insights';
import { Compare } from './pages/Compare';
import { Backtest } from './pages/Backtest';
import { Glossary } from './pages/Glossary';

function AppInner() {
  const [page, setPage] = useState<Page>('dashboard');
  const { metrics } = useArtifacts();
  const periodMetrics = usePeriodMetrics();
  const riskMetrics = useRiskMetrics();

  return (
    <>
      <Nav current={page} onNavigate={setPage} />
      <main>
        {page === 'dashboard' && <Dashboard metrics={metrics} periodMetrics={periodMetrics} onNavigate={setPage} />}
        {page === 'explore'   && <Explore   metrics={metrics} onNavigate={setPage} />}
        {page === 'analytics' && <Analytics periodMetrics={periodMetrics} riskMetrics={riskMetrics} />}
        {page === 'portfolio' && <PortfolioBuilder metrics={metrics} onNavigate={setPage} />}
        {page === 'insights'  && <Insights  metrics={metrics} onNavigate={setPage} />}
        {page === 'compare'   && <Compare periodMetrics={periodMetrics} />}
        {page === 'backtest'  && <Backtest />}
        {page === 'glossary'  && <Glossary />}
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
