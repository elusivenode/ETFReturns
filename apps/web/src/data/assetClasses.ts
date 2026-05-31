import type { AssetClass } from '../types/contracts';

export const ASSET_CLASSES: AssetClass[] = [
  {
    id: 'aus-equities',
    name: 'Australian Equities',
    description:
      'ASX-listed companies providing exposure to the Australian economy. Known for a strong dividend culture and franking credits — especially valuable inside super where the 0% pension-phase tax rate means franking credits are fully refundable.',
    role: 'income',
    risk: 'medium',
    etfs: [
      {
        ticker: 'VAS.AX',
        name: 'Vanguard Australian Shares',
        fee: 0.07,
        approxYield: 4.5,
        tags: ['broad market', 'franked dividends', 'ASX 300'],
        pros: ['Lowest cost broad market option', 'Deep diversification across 300 stocks', 'High franking credit ratio'],
        cons: ['Concentrated in banks and miners (~50%)', 'Limited global exposure'],
      },
      {
        ticker: 'VHY.AX',
        name: 'Vanguard High Yield',
        fee: 0.25,
        approxYield: 5.8,
        tags: ['high dividend', 'income focused', 'franked'],
        pros: ['Higher income than broad market', 'Strong franking credit yield', 'Good for income phase'],
        cons: ['Higher fee', 'Less diversified (top 50 high-yielders)', 'Sector concentration risk'],
      },
      {
        ticker: 'IOZ.AX',
        name: 'iShares Core ASX 200',
        fee: 0.05,
        approxYield: 4.2,
        tags: ['broad market', 'ultra low cost', 'ASX 200'],
        pros: ['Cheapest ASX 200 ETF available', 'Tight bid/ask spreads'],
        cons: ['Very similar to VAS', 'Slightly lower yield than VAS'],
      },
    ],
  },
  {
    id: 'global-equities',
    name: 'Global Equities',
    description:
      'Exposure to companies outside Australia — primarily the US, Europe, and Japan. Essential diversification, as Australia represents only ~2% of global market cap. Provides growth exposure where Australian equities fall short.',
    role: 'growth',
    risk: 'high',
    etfs: [
      {
        ticker: 'VGS.AX',
        name: 'Vanguard International Shares',
        fee: 0.18,
        approxYield: 1.8,
        tags: ['global developed markets', 'unhedged', 'growth'],
        pros: ['Broad exposure to 1,500+ companies', 'Low cost for global coverage', 'Benefits if AUD falls'],
        cons: ['Currency risk (AUD/USD)', 'Low income yield', 'US-heavy (~70% US)'],
      },
      {
        ticker: 'VGAD.AX',
        name: 'Vanguard International Hedged',
        fee: 0.21,
        approxYield: 1.8,
        tags: ['global', 'hedged', 'currency protected'],
        pros: ['Removes AUD/USD volatility', 'Same underlying as VGS', 'Predictable returns in AUD terms'],
        cons: ['Hedging has a cost (~0.5–1% drag in some years)', 'Reduces gains when AUD falls'],
      },
      {
        ticker: 'IVV.AX',
        name: 'iShares S&P 500',
        fee: 0.03,
        approxYield: 1.3,
        tags: ['US equities', 'ultra low cost', 'S&P 500'],
        pros: ['Cheapest option available', 'Deep US large-cap exposure'],
        cons: ['Concentrated in US only', 'No currency hedge', 'Lower diversification than VGS'],
      },
    ],
  },
  {
    id: 'fixed-income',
    name: 'Fixed Income',
    description:
      'Government and investment-grade corporate bonds. Provides stable, predictable income and typically moves inversely to equities during downturns — acting as a portfolio buffer. Critical for capital preservation near retirement.',
    role: 'stability',
    risk: 'low',
    etfs: [
      {
        ticker: 'VAF.AX',
        name: 'Vanguard Australian Fixed Interest',
        fee: 0.20,
        approxYield: 4.5,
        tags: ['government bonds', 'investment grade', 'defensive'],
        pros: ['Negative correlation to equities in downturns', 'Stable, predictable income', 'High-quality issuers'],
        cons: ['Duration risk if interest rates rise', 'Lower yield than equities'],
      },
      {
        ticker: 'IAF.AX',
        name: 'iShares Core Composite Bond',
        fee: 0.15,
        approxYield: 4.3,
        tags: ['broad bonds', 'investment grade', 'composite'],
        pros: ['Slightly cheaper than VAF', 'Broad exposure across maturities'],
        cons: ['Very similar to VAF — no strong reason to hold both'],
      },
      {
        ticker: 'VACF.AX',
        name: 'Vanguard Corporate Bonds',
        fee: 0.25,
        approxYield: 5.2,
        tags: ['corporate bonds', 'higher yield', 'credit'],
        pros: ['Higher income than government bonds', 'Still investment-grade quality'],
        cons: ['More credit risk than government bonds', 'Higher fee', 'Correlates more with equities in stress'],
      },
    ],
  },
  {
    id: 'defensive-alternatives',
    name: 'Real Return / Defensive',
    description:
      'Strategies designed to preserve capital in real terms — targeting returns above inflation with lower volatility than equities. Useful as a buffer between bonds and equities in a SMSF near retirement.',
    role: 'defensive',
    risk: 'low',
    etfs: [
      {
        ticker: 'GROW.AX',
        name: 'Schroder Real Return Fund',
        fee: 0.90,
        approxYield: 3.0,
        tags: ['absolute return', 'real return', 'inflation linked', 'managed'],
        pros: ['Targets CPI + 5% over rolling 3 years', 'Actively manages downside risk', 'Low equity correlation'],
        cons: ['High management fee', 'Complex multi-asset strategy', 'Less transparent than index ETFs'],
      },
      {
        ticker: 'VDBA.AX',
        name: 'Vanguard Diversified Balanced',
        fee: 0.29,
        approxYield: 2.8,
        tags: ['diversified', 'balanced', '50/50 growth/defensive'],
        pros: ['One-fund diversification across asset classes', 'Low cost for a multi-asset fund', 'Automatic rebalancing'],
        cons: ['Less control over individual asset class weights', 'Moderate yield'],
      },
      {
        ticker: 'DHHF.AX',
        name: 'BetaShares Diversified All Growth',
        fee: 0.19,
        approxYield: 1.5,
        tags: ['diversified', 'high growth', 'global equities', 'comparison'],
        pros: ['Very low cost for a diversified fund', 'Global diversification built in'],
        cons: ['100% growth assets — no defensive buffer', 'Low yield', 'High volatility'],
      },
    ],
  },
  {
    id: 'property-infra',
    name: 'Property & Infrastructure',
    description:
      'Listed real assets providing inflation-linked income. Given your existing direct property exposure (~$3m), listed property should be minimal. Infrastructure offers complementary income without doubling up on property.',
    role: 'income',
    risk: 'medium',
    etfs: [
      {
        ticker: 'VAP.AX',
        name: 'Vanguard Australian Property',
        fee: 0.23,
        approxYield: 3.8,
        tags: ['listed REITs', 'Australian property', 'real assets'],
        pros: ['Diversified listed property exposure', 'Regular distributions'],
        cons: ['Significant overlap with your direct property holdings', 'Sensitive to interest rate rises'],
      },
      {
        ticker: 'IFRA.AX',
        name: 'VanEck FTSE Global Infrastructure',
        fee: 0.52,
        approxYield: 3.2,
        tags: ['infrastructure', 'global', 'toll roads', 'utilities', 'inflation-linked'],
        pros: ['Toll roads, airports, utilities — long-term contracted income', 'Inflation-linked cash flows', 'Low correlation to equities'],
        cons: ['Higher fee', 'Interest rate sensitive', 'Less liquidity than broad ETFs'],
      },
    ],
  },
  {
    id: 'cash',
    name: 'Cash',
    description:
      'High-interest cash or term deposits held within the SMSF. Not an ETF — represents your cash allocation directly. Enter your current cash yield from your SMSF bank account or term deposit rate.',
    role: 'stability',
    risk: 'low',
    etfs: [],
  },
];

export function findETF(ticker: string) {
  return ASSET_CLASSES.flatMap(c => c.etfs).find(e => e.ticker === ticker);
}

export function findAssetClass(ticker: string) {
  if (ticker === 'CASH') return ASSET_CLASSES.find(c => c.id === 'cash')!;
  return ASSET_CLASSES.find(c => c.etfs.some(e => e.ticker === ticker));
}
