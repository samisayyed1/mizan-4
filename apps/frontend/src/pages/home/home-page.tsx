import { IncomeThisMonth } from "./income-this-month";
import { NetWorthSummary } from "./net-worth-summary";
import { PortfolioAttention } from "./portfolio-attention";
import { QuickActions } from "./quick-actions";
import { WealthInboxPreview } from "./wealth-inbox-preview";

/**
 * Home — the Mizan command center.
 *
 * Composes the five modules specified by Prompt 3 of the build plan.
 * Each module is self-contained, deterministic, and backed by data
 * services that already exist in the codebase. No new schema, no
 * invented metrics, no placeholder rows.
 *
 * The previous landing page (the investments/net-worth swipable view)
 * is still reachable at `/overview` for users who want the detailed
 * portfolio surface.
 */
export default function HomePage() {
  return (
    <div className="space-y-4 p-4" data-testid="home-page">
      {/*
        Quick Actions sits up top so the most common tasks for older
        users (add an asset, update values, review issues) are always
        one click away — no scrolling, no searching the sidebar.
      */}
      <QuickActions />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 lg:row-span-2">
          <NetWorthSummary />
        </div>
        <IncomeThisMonth />
        <PortfolioAttention />
      </div>

      <WealthInboxPreview />
    </div>
  );
}
