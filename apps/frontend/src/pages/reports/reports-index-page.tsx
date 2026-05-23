import { Page, PageContent, PageHeader } from "@mizan/ui";
import { Button } from "@mizan/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@mizan/ui/components/ui/card";
import { Icons } from "@mizan/ui/components/ui/icons";

import { useEntitlements, useUpgradeGate } from "@/features/mizan-connect";

/**
 * Pro reports landing page (M4.2).
 *
 * Lists every Pro report type with a brief description. Each tile links
 * to the dedicated report page that pulls live data and offers a "Save
 * as PDF" button (wired up per-report as data sources land).
 *
 * Free / Basic users see the same tiles but the CTAs route through the
 * UpgradeGate.
 */
export default function ReportsIndexPage() {
  const { entitlements } = useEntitlements();
  const { requestUpgrade } = useUpgradeGate();
  const locked = !entitlements.advancedReports;

  const onAction = (path: string) => {
    if (locked) {
      requestUpgrade("advanced_reports");
      return;
    }
    // Navigate via the existing router. The dedicated pages are stubbed
    // out as they're wired up — see M4.2 follow-up tickets.
    window.location.assign(path);
  };

  return (
    <Page>
      <PageHeader heading="Reports" />
      <PageContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Polished PDF reports built from your own data — share, archive, or print.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReportTile
            title="Income report"
            description="Year-to-date dividends, interest, rental income, and a monthly trend chart. Top 10 income-producing assets and YoY change."
            icon={<Icons.TrendingUp className="text-primary h-6 w-6" />}
            ctaLabel={locked ? "Upgrade to unlock" : "Open income report"}
            onClick={() => onAction("/reports/income")}
            locked={locked}
          />
          <ReportTile
            title="Rental income"
            description="One section per rented property — tenant, monthly rent, lease dates, projected annual income."
            icon={<Icons.Home className="text-primary h-6 w-6" />}
            ctaLabel={locked ? "Upgrade to unlock" : "Open rental report"}
            onClick={() => onAction("/reports/rental")}
            locked={locked}
          />
          <ReportTile
            title="Liability payoff"
            description="Amortization schedule for any fixed-rate liability. Total interest cost, projected payoff date, and a balance trajectory chart."
            icon={<Icons.Activity2 className="text-primary h-6 w-6" />}
            ctaLabel={locked ? "Upgrade to unlock" : "Open payoff projection"}
            onClick={() => onAction("/reports/payoff")}
            locked={locked}
          />
          <ReportTile
            title="Portfolio health"
            description="0–100 composite score across concentration, FX exposure, cash drag, and allocation drift. Highlights the weakest driver."
            icon={<Icons.PieChart className="text-primary h-6 w-6" />}
            ctaLabel={locked ? "Upgrade to unlock" : "Open health report"}
            onClick={() => onAction("/reports/health")}
            locked={locked}
          />
        </div>
        {locked && (
          <p className="text-muted-foreground mt-6 text-center text-xs">
            Pro reports are part of the Mizan Pro subscription. Free and Basic plans get a preview
            only.
          </p>
        )}
      </PageContent>
    </Page>
  );
}

function ReportTile({
  title,
  description,
  icon,
  ctaLabel,
  onClick,
  locked,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  ctaLabel: string;
  onClick: () => void;
  locked: boolean;
}) {
  return (
    <Card className={locked ? "border-muted" : "border-primary/20"}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant={locked ? "outline" : "default"} size="sm" onClick={onClick}>
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
