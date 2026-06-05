# Portfolio Build Workflow (Hamish + Becky)

This guide explains how two people build separate sub-portfolios in the app, push them to the repo, and combine into a final portfolio.

## What the app saves

The app writes two files to the repo via GitHub API:

- `data/portfolio-state.json`: working state (member balances + member allocations)
- `data/portfolio.json`: final combined strategic allocation (rounded weights)

`portfolio-state.json` is the handoff file between Hamish and Becky.

## One-time setup (each person)

1. Open the app and go to Portfolio.
2. Open GitHub settings in the app.
3. Enter:
   - Token: GitHub token with `Contents: Read and Write`
   - Owner: repo owner
   - Repo: `ETFReturns` (or your fork)
4. Save settings.

## Build process for each sub-portfolio

### Step 1: Pull latest shared state first

Before making changes, click **Load state**.

This ensures you start from the newest `data/portfolio-state.json` that may include the other person's latest sub-portfolio.

### Step 2: Edit only your own member column

- Hamish updates only the **Hamish** member allocations.
- Becky updates only the **Becky** member allocations.

Do not overwrite the other member unless you both agree.

### Step 3: Reach 100% allocation for your member

Use the member badge to confirm your column is fully allocated (`100%`).

### Step 4: Push your sub-portfolio

Click **Save state**.

This commits the latest shared working state to `data/portfolio-state.json`, including your new sub-portfolio plus whatever exists for the other member.

## How the app picks up the other person's sub-portfolio

When you click **Load state**, the app reads `data/portfolio-state.json` from the repo.

If the other person has already saved their work, their member allocations will appear automatically in your app.

## Finalize the combined portfolio

When both Hamish and Becky are happy and both columns are 100%:

1. Click **Load state** one last time (safety check).
2. Confirm both member allocations look correct.
3. Click **Save portfolio**.

This writes the final combined allocation to `data/portfolio.json`.

## Recommended collaboration rules

- Always **Load state** before editing.
- Save often after meaningful changes.
- Coordinate so only one person is editing at a time (reduces accidental overwrite risk).
- If a conflict happens, both users should load state again, compare, and re-save agreed allocations.

## Quick checklist

- [ ] I loaded latest state before editing.
- [ ] I changed only my member column.
- [ ] My member is 100% allocated.
- [ ] I clicked Save state.
- [ ] I loaded state again to verify combined view.
- [ ] Once both members are final, Save portfolio was clicked.
