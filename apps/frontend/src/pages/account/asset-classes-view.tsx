/**
 * Portfolio detail page — asset-classes view.
 *
 * Replaces the legacy "flat list of holdings" rendering inside a
 * portfolio with Feroz's two-level shape:
 *
 *   default view  → grid of asset class cards (all classes always
 *                   visible — empty ones show an Add CTA)
 *   ?class=STOCKS → drill-down list of just that class's holdings
 *
 * The component is intentionally self-contained: it fetches its own
 * holdings (cache shared with AccountHoldings via QueryKeys.HOLDINGS),
 * derives groupings via the pure classifier in `lib/asset-classes.ts`,
 * and exposes a single `onAddHoldings` prop for the empty-state CTAs
 * (which the parent page wires to the existing edit-mode sheet).
 *
 * Reference: .claude/product-notes/feroz-meeting-2026-05-17.md #5, #9, #10, #13.
 */

import { getHoldings } from "@/adapters";
import { useAccounts } from "@/hooks/use-accounts";
import {
  AssetClass,
  ASSET_CLASS_ICON_NAMES,
  ASSET_CLASS_LABELS,
  groupHoldingsByAssetClass,
  parseAssetClassParam,
  type AssetClassBucket,
} from "@/lib/asset-classes";
import { QueryKeys } from "@/lib/query-keys";
import type { Holding } from "@/lib/types";
import { Badge } from "@mizan/ui/components/ui/badge";
import { Button } from "@mizan/ui/components/ui/button";
import { Card, CardContent } from "@mizan/ui/components/ui/card";
import { Icons, type IconName } from "@mizan/ui/components/ui/icons";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";
import { formatCompactAmount } from "@mizan/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

interface AssetClassesViewProps {
  accountId: string;
  onAddHoldings?: () => void;
}

export function AssetClassesView({ accountId, onAddHoldings }: AssetClassesViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClass = parseAssetClassParam(searchParams.get("class"));

  const { data: holdings, isLoading } = useQuery<Holding[], Error>({
    queryKey: [QueryKeys.HOLDINGS, accountId],
    queryFn: () => getHoldings(accountId),
  });

  const { accounts } = useAccounts();
  const account = useMemo(
    () => accounts?.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );
  const portfolioCurrency = account?.currency ?? "USD";

  const buckets = useMemo(() => groupHoldingsByAssetClass(holdings ?? []), [holdings]);

  const handleSelectClass = (cls: AssetClass) => {
    const next = new URLSearchParams(searchParams);
    next.set("class", cls);
    setSearchParams(next, { replace: false });
  };

  const handleBackToClasses = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("class");
    setSearchParams(next, { replace: false });
  };

  if (isLoading) {
    return <AssetClassesSkeleton />;
  }

  if (selectedClass) {
    const bucket = buckets.find((b) => b.cls === selectedClass);
    return (
      <AssetClassDrilldown
        cls={selectedClass}
        bucket={bucket}
        portfolioCurrency={portfolioCurrency}
        onBack={handleBackToClasses}
        onAddHoldings={onAddHoldings}
      />
    );
  }

  return (
    <AssetClassesGrid
      buckets={buckets}
      portfolioCurrency={portfolioCurrency}
      onSelectClass={handleSelectClass}
    />
  );
}

// ---------------------------------------------------------------------------
// Grid view — one card per asset class
// ---------------------------------------------------------------------------

interface AssetClassesGridProps {
  buckets: readonly AssetClassBucket[];
  portfolioCurrency: string;
  onSelectClass: (cls: AssetClass) => void;
}

function AssetClassesGrid({ buckets, portfolioCurrency, onSelectClass }: AssetClassesGridProps) {
  // Feroz wants every class visible, but if a class has zero holdings
  // it shows a subdued "Add" affordance — not a full empty value row.
  // The portfolio total at the top of the page comes from the parent
  // (already covered by the existing chart header), so we don't repeat
  // it here.
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-base font-semibold tracking-tight">Asset Classes</h2>
        <span className="text-muted-foreground text-xs">
          {buckets.filter((b) => b.count > 0).length} active
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((bucket) => (
          <AssetClassCard
            key={bucket.cls}
            bucket={bucket}
            portfolioCurrency={portfolioCurrency}
            onClick={() => onSelectClass(bucket.cls)}
          />
        ))}
      </div>
    </div>
  );
}

interface AssetClassCardProps {
  bucket: AssetClassBucket;
  portfolioCurrency: string;
  onClick: () => void;
}

function AssetClassCard({ bucket, portfolioCurrency, onClick }: AssetClassCardProps) {
  const labels = ASSET_CLASS_LABELS[bucket.cls];
  const Icon = Icons[ASSET_CLASS_ICON_NAMES[bucket.cls] as IconName];
  const isEmpty = bucket.count === 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Open ${labels.plural}`}
      className={[
        "group cursor-pointer transition-colors",
        "hover:border-primary/40 hover:bg-accent/30",
        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        isEmpty ? "border-dashed opacity-80" : "",
      ].join(" ")}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              isEmpty ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
            ].join(" ")}
          >
            {Icon ? <Icon className="h-5 w-5" /> : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{labels.plural}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {isEmpty
                ? "No holdings yet"
                : `${bucket.count} ${bucket.count === 1 ? labels.singular : labels.plural}`}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {isEmpty ? (
            <Icons.Plus
              className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors"
              aria-hidden
            />
          ) : (
            <>
              <p className="text-sm font-semibold tabular-nums">
                {formatCompactAmount(bucket.totalValue, portfolioCurrency)}
              </p>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                {portfolioCurrency}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Drill-down view — holdings inside a single class
// ---------------------------------------------------------------------------

interface AssetClassDrilldownProps {
  cls: AssetClass;
  bucket: AssetClassBucket | undefined;
  portfolioCurrency: string;
  onBack: () => void;
  onAddHoldings?: () => void;
}

function AssetClassDrilldown({
  cls,
  bucket,
  portfolioCurrency,
  onBack,
  onAddHoldings,
}: AssetClassDrilldownProps) {
  const labels = ASSET_CLASS_LABELS[cls];
  const Icon = Icons[ASSET_CLASS_ICON_NAMES[cls] as IconName];
  const totalValue = bucket?.totalValue ?? 0;

  // Largest-first inside the drill-down. The grouping helper preserves
  // input order so the caller controls sort — here we want the biggest
  // positions at the top so the user can see what matters first.
  // Pull `bucket?.holdings` *inside* the memo to keep deps stable —
  // the ternary fallback otherwise produces a new [] reference on every
  // render and the memo recomputes every time.
  const sortedHoldings = useMemo(() => {
    const list = bucket?.holdings ?? [];
    return [...list].sort((a, b) => (b.marketValue?.base ?? 0) - (a.marketValue?.base ?? 0));
  }, [bucket]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <Icons.ArrowLeft className="mr-1 h-4 w-4" />
          Asset Classes
        </Button>
        {onAddHoldings ? (
          <Button size="sm" variant="outline" onClick={onAddHoldings}>
            <Icons.Plus className="mr-1 h-4 w-4" />
            Add {labels.singular}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl">
          {Icon ? <Icon className="h-6 w-6" /> : null}
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{labels.plural}</h2>
          <p className="text-muted-foreground text-sm">
            {sortedHoldings.length === 0
              ? `No ${labels.plural.toLowerCase()} yet`
              : `${formatCompactAmount(totalValue, portfolioCurrency)} across ${sortedHoldings.length} ${
                  sortedHoldings.length === 1
                    ? labels.singular.toLowerCase()
                    : labels.plural.toLowerCase()
                }`}
          </p>
        </div>
      </div>

      {sortedHoldings.length === 0 ? (
        <AssetClassEmptyState cls={cls} onAddHoldings={onAddHoldings} />
      ) : (
        <ul className="bg-card divide-border divide-y overflow-hidden rounded-md border">
          {sortedHoldings.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {h.instrument?.name || h.instrument?.symbol || labels.singular}
                </p>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  {h.instrument?.symbol ? (
                    <span className="font-mono">{h.instrument.symbol}</span>
                  ) : null}
                  {h.localCurrency && h.localCurrency !== portfolioCurrency ? (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {h.localCurrency}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatCompactAmount(h.marketValue?.base ?? 0, portfolioCurrency)}
                </p>
                {h.quantity ? (
                  <p className="text-muted-foreground text-[10px] tabular-nums">
                    {h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} ×
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AssetClassEmptyStateProps {
  cls: AssetClass;
  onAddHoldings?: () => void;
}

function AssetClassEmptyState({ cls, onAddHoldings }: AssetClassEmptyStateProps) {
  const labels = ASSET_CLASS_LABELS[cls];
  const Icon = Icons[ASSET_CLASS_ICON_NAMES[cls] as IconName];

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="bg-muted text-muted-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          {Icon ? <Icon className="h-6 w-6" /> : null}
        </div>
        <h3 className="text-sm font-medium">No {labels.plural.toLowerCase()} yet</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          You don&apos;t have any {labels.plural.toLowerCase()}. Please add now.
        </p>
        {onAddHoldings ? (
          <Button size="sm" className="mt-4" onClick={onAddHoldings}>
            <Icons.Plus className="mr-1 h-4 w-4" />
            Add {labels.singular}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function AssetClassesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default AssetClassesView;
