import { Page, PageContent, PageHeader } from "@mizan/ui";
import { Button } from "@mizan/ui/components/ui/button";
import { Icons } from "@mizan/ui/components/ui/icons";

import { useAddAsset } from "@/features/add-asset";
import { AccountsSummary } from "@/pages/dashboard/accounts-summary";

/**
 * M2 — top-level Portfolio listing page.
 *
 * Renders the same portfolio-summary the dashboard already builds — but as a
 * dedicated page so the new five-tab nav has a real destination for
 * `/portfolio` (the previous nav exposed the dashboard at `/` and the per-
 * portfolio drill-down at `/accounts/:id`, with no single "list of all my
 * portfolios" page in between).
 *
 * The "Add portfolio" CTA in the header opens the unified Add-Asset wizard
 * (M2.2) — the wizard routes securities-kind picks straight into a portfolio,
 * and surfaces the M1.5 portfolio-count gate when the user is at their plan's
 * max.
 */
export default function PortfolioListPage() {
  const addAsset = useAddAsset();

  return (
    <Page>
      <PageHeader
        heading="Portfolios"
        actions={
          <Button size="sm" onClick={() => addAsset.open()}>
            <Icons.Plus className="mr-1.5 h-4 w-4" />
            Add asset
          </Button>
        }
      />
      <PageContent>
        <AccountsSummary />
      </PageContent>
    </Page>
  );
}
