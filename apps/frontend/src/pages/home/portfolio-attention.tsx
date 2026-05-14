import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";
import { Link } from "react-router-dom";

import { useHealthStatus } from "@/hooks/use-health";
import type { HealthSeverity } from "@/lib/types";

import { deriveAttention, type AttentionRow } from "./derive";

export type PortfolioAttentionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; rows: AttentionRow[] };

const SEVERITY_PILL: Record<HealthSeverity, string> = {
  CRITICAL: "bg-destructive/15 text-destructive",
  ERROR: "bg-destructive/15 text-destructive",
  WARNING: "bg-warning/15 text-warning",
  INFO: "bg-muted text-muted-foreground",
};

/**
 * Pure rendering component for the Portfolio Attention card.
 */
export function PortfolioAttentionView({ state }: { state: PortfolioAttentionState }) {
  return (
    <Card data-testid="home-attention">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Portfolio attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {state.status === "loading" && (
          <div className="space-y-2" data-testid="home-attention-loading">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
        {state.status === "error" && (
          <p className="text-destructive text-sm" data-testid="home-attention-error">
            We couldn&apos;t evaluate portfolio data quality. {state.message}
          </p>
        )}
        {state.status === "empty" && (
          <p className="text-muted-foreground text-sm" data-testid="home-attention-empty">
            Everything looks in order — no missing FX rates, stale quotes, or unclassified assets
            right now.
          </p>
        )}
        {state.status === "ready" && (
          <ul className="space-y-1" data-testid="home-attention-list">
            {state.rows.map((row) => (
              <li key={row.category}>
                <Link
                  to={row.route}
                  className="hover:bg-accent flex items-center justify-between rounded-md px-2 py-2 transition-colors"
                >
                  <span className="text-sm">{row.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      SEVERITY_PILL[row.severity] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {row.affectedCount > 0 ? `${row.affectedCount} affected` : "Needs review"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Portfolio Attention — Home command center module #4.
 *
 * Surfaces categorised health issues (missing FX, stale quotes,
 * unclassified assets, data warnings) computed by the existing
 * deterministic health-check service. No new schema, no fake data.
 */
export function PortfolioAttention() {
  const { data, isLoading, isError, error } = useHealthStatus();

  let state: PortfolioAttentionState;
  if (isError) {
    state = { status: "error", message: error?.message ?? "Failed to load health status." };
  } else if (isLoading) {
    state = { status: "loading" };
  } else if (!data || data.issues.length === 0) {
    state = { status: "empty" };
  } else {
    const rows = deriveAttention(data.issues);
    state = rows.length === 0 ? { status: "empty" } : { status: "ready", rows };
  }

  return <PortfolioAttentionView state={state} />;
}
