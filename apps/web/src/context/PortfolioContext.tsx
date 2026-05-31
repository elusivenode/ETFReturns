import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Allocation, MemberPortfolio, PortfolioState } from '../types/contracts';

const STORAGE_KEY = 'smsf_portfolio_v2';

const DEFAULT: PortfolioState = {
  cashYield: 4.5,
  members: [
    { name: 'Hamish', balance: 425000, allocations: [] },
    { name: 'Becky',  balance: 425000, allocations: [] },
  ],
};

interface PortfolioContextType {
  portfolio: PortfolioState;
  setCashYield: (v: number) => void;
  setMemberBalance: (idx: number, balance: number) => void;
  // Adds ticker to both members (called from Explore ETF cards)
  addETF: (ticker: string) => void;
  // Per-member operations (called from Portfolio Builder)
  addMemberETF: (idx: number, ticker: string) => void;
  removeMemberETF: (idx: number, ticker: string) => void;
  setMemberWeight: (idx: number, ticker: string, weight: number) => void;
  // Derived
  combinedAllocations: Allocation[];
  totalBalance: number;
}

const PortfolioContext = createContext<PortfolioContextType | null>(null);

function updateMember(
  members: [MemberPortfolio, MemberPortfolio],
  idx: number,
  fn: (m: MemberPortfolio) => MemberPortfolio,
): [MemberPortfolio, MemberPortfolio] {
  return members.map((m, i) => (i === idx ? fn(m) : m)) as [MemberPortfolio, MemberPortfolio];
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<PortfolioState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  }, [portfolio]);

  const setCashYield = useCallback(
    (v: number) => setPortfolio(p => ({ ...p, cashYield: v })),
    [],
  );

  const setMemberBalance = useCallback((idx: number, balance: number) => {
    setPortfolio(p => ({
      ...p,
      members: updateMember(p.members, idx, m => ({ ...m, balance })),
    }));
  }, []);

  // Adds to both members — called from Explore ETF cards
  const addETF = useCallback((ticker: string) => {
    setPortfolio(p => ({
      ...p,
      members: p.members.map(m =>
        m.allocations.find((a: Allocation) => a.ticker === ticker)
          ? m
          : { ...m, allocations: [...m.allocations, { ticker, weight: 0 }] },
      ) as [MemberPortfolio, MemberPortfolio],
    }));
  }, []);

  const addMemberETF = useCallback((idx: number, ticker: string) => {
    setPortfolio(p => ({
      ...p,
      members: updateMember(p.members, idx, m => {
        if (m.allocations.find((a: Allocation) => a.ticker === ticker)) return m;
        return { ...m, allocations: [...m.allocations, { ticker, weight: 0 }] };
      }),
    }));
  }, []);

  const removeMemberETF = useCallback((idx: number, ticker: string) => {
    setPortfolio(p => ({
      ...p,
      members: updateMember(p.members, idx, m => ({
        ...m,
        allocations: m.allocations.filter((a: Allocation) => a.ticker !== ticker),
      })),
    }));
  }, []);

  const setMemberWeight = useCallback((idx: number, ticker: string, weight: number) => {
    setPortfolio(p => ({
      ...p,
      members: updateMember(p.members, idx, m => ({
        ...m,
        allocations: m.allocations.map((a: Allocation) =>
          a.ticker === ticker ? { ...a, weight } : a,
        ),
      })),
    }));
  }, []);

  const totalBalance = portfolio.members[0].balance + portfolio.members[1].balance;

  // Weighted merge: combined_weight(ticker) = Σ (member.balance × member_weight) / totalBalance
  const combinedAllocations = useMemo<Allocation[]>(() => {
    if (totalBalance === 0) return [];
    const combined: Record<string, number> = {};
    for (const member of portfolio.members) {
      for (const alloc of member.allocations) {
        const contribution = (member.balance / totalBalance) * alloc.weight;
        combined[alloc.ticker] = (combined[alloc.ticker] ?? 0) + contribution;
      }
    }
    return Object.entries(combined)
      .map(([ticker, weight]) => ({ ticker, weight }))
      .filter(a => a.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [portfolio.members, totalBalance]);

  return (
    <PortfolioContext.Provider
      value={{
        portfolio,
        setCashYield,
        setMemberBalance,
        addETF,
        addMemberETF,
        removeMemberETF,
        setMemberWeight,
        combinedAllocations,
        totalBalance,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
