# Metadata Verification Checklist

Purpose: move ETF metadata from estimated to verified for accurate portfolio assessment.

## What is already data-driven

- Returns, volatility, drawdown, and trailing distribution yield come from pipeline artifacts.
- Source artifact: `data/artifacts/latest/metrics.json`.

## What still needs issuer/PDS verification

- Management fee (MER/management cost) for each fund.
- Fee effective date.
- Strategy notes for specialist listed trusts and active funds.
- Any unusual distribution policy notes (monthly/quarterly, variable).

## Required fields per fund

- `ticker`
- `fee`
- `feeVerified: true`
- `feeAsOf` (YYYY-MM-DD)
- `feeSource` (PDS/fact sheet URL or document title)
- Optional: `metadataNote`

## Current universe verification status

Status legend:
- `pending`: values in app are estimated/manual and should be verified.
- `verified`: confirmed from PDS/fact sheet.

| Ticker | Fund | Status | Notes |
|---|---|---|---|
| VAS.AX | Vanguard Australian Shares | verified | Fee 0.07% p.a. verified from Vanguard PDS dated 27 March 2026; supporting file: ETF-Vanguard_Australian_Shares_Index_ETF_8205_FS_VAS.pdf |
| IOZ.AX | iShares Core S&P/ASX 200 | verified | Fee 0.05% p.a. verified from iShares Australian Equity ETFs PDS dated 26 September 2025; supporting fact sheet `ioz-ishares-core-s-p-asx-200-etf-fund-fact-sheet-en-au.pdf` (as at 30-Apr-2026) |
| VHY.AX | Vanguard Australian Shares High Yield | verified | Fee 0.25% p.a. verified from Vanguard PDS dated 27 March 2026; supporting file: ETF-Vanguard_Australian_Shares_High_Yield_ETF_8210_FS_VHY.pdf |
| VGS.AX | Vanguard MSCI Index International Shares | verified | Fee 0.18% p.a. verified from Vanguard International Shares ETFs PDS dated 27 March 2026; supporting file: ETF-Vanguard_MSCI_Index_International_Shares_ETF_8212_FS_VGS.pdf (Fact sheet 30 April 2026) |
| VGAD.AX | Vanguard MSCI Index International Shares (Hedged) | verified | Management fee 0.21% p.a. verified from Vanguard International Shares ETFs PDS dated 27 March 2026 (total management fees and costs 0.22% p.a. incl. estimated indirect costs); supporting file: ETF-Vanguard_MSCI_Index_International_Shares_Hedged_ETF_8213_FS_VGAD.pdf (Fact sheet 30 April 2026) |
| IVV.AX | iShares S&P 500 ETF | verified | Annual management fee 0.04% verified from iShares International Equity ETFs PDS dated 23 March 2026; supporting fact sheet `ivv-ishares-s-p-500-etf-fund-fact-sheet-en-au.pdf` (April 2026, info as at 30-Apr-2026) |
| VISM.AX | Vanguard MSCI International Small Companies | verified | Management fee 0.32% p.a. verified from `ETF-Vanguard_MSCI_Index_International_Small_Companies_Index_ETF_8227_FS_VISM.pdf` (Fact sheet 30 April 2026); VISM PDS file not yet added to repo |
| IJR.AX | iShares S&P Small-Cap ETF | verified | Management fee 0.07% verified from `ijr-ishares-s-p-small-cap-etf-fund-fact-sheet-en-au.pdf` (May 2026, as at 31-May-2026); iShares International Equity ETFs PDS dated 23 March 2026 indicates total management fees and costs 0.08% incl. estimated indirect costs |
| VGE.AX | Vanguard FTSE Emerging Markets Shares | verified | Management fee 0.48% p.a. verified from `ETF-Vanguard_FTSE_Emerging_Markets_Shares_ETF_8204_FS_VGE.pdf` (Fact sheet 30 April 2026); VGE PDS file not yet added to repo |
| IEM.AX | iShares MSCI Emerging Markets ETF | verified | Annual management fee 0.69% verified from `iem-ishares-msci-emerging-markets-etf-fund-fact-sheet-en-au.pdf` (April 2026, as at 30-Apr-2026); iShares International Equity ETFs PDS dated 23 March 2026 is on file |
| VAP.AX | Vanguard Australian Property Securities Index | verified | Fee 0.23% p.a. verified from Vanguard PDS dated 27 March 2026; supporting file: ETF-Vanguard_Australian_Property_Securities_Index_ETF_8206_FS_VAP.pdf |
| IFRA.AX | VanEck FTSE Global Infrastructure (Hedged) | verified | Management fee 0.20% p.a. verified from `IFRA-fact-sheet.pdf` (month end as at 31-May-2026); supported by `pds-van-eck-global-equities.pdf` |
| GLIN.AX | iShares Core FTSE Global Infrastructure (AUD Hedged) ETF | verified | Annual management fee 0.15% verified from iShares International Equity ETFs PDS dated 23 March 2026; supporting fact sheet `glin-ishares-core-ftse-global-infrastructure-aud-hedged-etf-fund-fact-sheet-en-au.pdf` (April 2026, as at 30-Apr-2026) |
| VAF.AX | Vanguard Australian Fixed Interest Index | verified | Management fee 0.20% p.a. verified from Vanguard Australian Fixed Interest ETFs PDS dated 27 March 2026; supporting file: `ETF-Vanguard_Australian_Fixed_Interest_Index_ETF_8207_FS_VAF.pdf` (Fact sheet 30 April 2026) |
| IAF.AX | iShares Core Composite Bond ETF | verified | Annual management fee 0.10% verified from `ishares-australian-fixed-income-and-cash-etfs-product-disclosure-statement-en-au.pdf` dated 11 November 2025; supporting fact sheet `iaf-ishares-core-composite-bond-etf-fund-fact-sheet-en-au.pdf` (April 2026, as at 30-Apr-2026) |
| VACF.AX | Vanguard Australian Corporate Fixed Interest Index | verified | Management fee 0.20% p.a. verified from `AU-ETFPDS-Vanguard_Australian_Fixed_Interest_ETFs-VAF-VGB-VACF.pdf` dated 27 March 2026; supporting fact sheet `ETF-Vanguard_Australian_Corporate_Fixed_Interest_Index_ETF_8203_FS_VACF.pdf` (Fact sheet 30 April 2026) |
| QPON.AX | BetaShares Australian Bank Senior Floating Rate Bond ETF | verified | Management fee 0.19% p.a. verified from `QPON-pds.pdf` dated 16 September 2022; total management fees and costs 0.22% p.a. including 0.03% recoverable expenses; supporting fact sheet `QPON-Factsheet.pdf` (30 April 2026) |
| FLOT.AX | VanEck Australian Floating Rate ETF | verified | Management fee 0.22% p.a. verified from `FLOT-fact-sheet.pdf` (performance month end as at 31-May-2026); monthly distributions noted in the fact sheet |
| MXT.AX | Metrics Master Income Trust | verified | Listed private debt trust; monthly cash income distributions. Fact sheet dated 5 March 2026 shows management fees & costs of 0.59% and a separate 0.09% performance fee; investor comparison table shows 0.86% costs to investor. PDS combined file on file |
| MOT.AX | Metrics Income Opportunities Trust | verified | Listed private debt trust; monthly cash income distributions. Combined PDS shows total cost to unitholders of 0.59%; IEE 0.29% and performance-related fees of about 9 basis points were also disclosed. Fact sheet dated April 2026 confirms monthly distributions |
| PCI.AX | Perpetual Credit Income Trust | verified | Listed investment trust with monthly distributions. Monthly investment report dated 30-Apr-2026 shows management costs of 0.88% p.a.; PDS not found in repo |
| ILB.AX | iShares Government Inflation ETF | verified | Annual management fee 0.18% verified from `ishares-australian-fixed-income-and-cash-etfs-product-disclosure-statement-en-au.pdf` dated 11 November 2025; supporting fact sheet `ilb-ishares-government-inflation-etf-fund-fact-sheet-en-au.pdf` (April 2026, as at 30-Apr-2026); quarterly distributions |
| GROW.AX | Schroder Real Return Active ETF | verified | Management fees and costs 0.69% p.a. verified from `AUF-Schroder-Real-Return-Fund-GROW-PDS-AUEN-2025-06-05.pdf`; supporting fact sheet `AUF-Real-Return-Active-ETF-Active-ETF-Dis-FMR-AUEN-2026-05-14.pdf`; target is CPI plus 4% to 5% p.a. before fees over rolling 3-year periods |
| VDBA.AX | Vanguard Diversified Balanced Index ETF | verified | Management fee 0.27% p.a. verified from `AU-ETFPDS-Vanguard_Diversified_Index_ETFs-VDCO-VDBA-VDGR-VDHG-VDAL.pdf` dated 25 March 2026; supporting fact sheet `ETF-Vanguard_Diversified_Balanced_Index_ETF_8218_FS_VDBA.pdf` (Fact sheet 30 April 2026); targets a 50% allocation to income asset classes and 50% to growth asset classes |
| DHHF.AX | BetaShares Diversified All Growth ETF | verified | Management fee 0.19% p.a. verified from `DZZF-DBBF-DGGF-DHHF-pds.pdf` dated 28 February 2025; supporting fact sheet `DHHF-Factsheet.pdf` (30 April 2026); 100% allocation to shares, quarterly distributions |
| GOLD.AX | Global X Physical Gold Structured | verified | Management fee rate 40 basis points per annum verified from `Global_X_Metal_Securities_Aust_Ltd_Prospectus_39194762a8.pdf` dated 11 May 2026; supporting fact sheet `GOLD_Factsheet_916d352b62.pdf` (as of 30 April 2026); no income distributions |

## How to provide documents

Please send either:
- direct issuer URLs (PDS/fact sheet), or
- pasted fee table snippets with effective dates.

I can then update `apps/web/src/data/assetClasses.ts` with verified values and source links, and mark entries as verified.
