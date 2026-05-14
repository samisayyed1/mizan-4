import { useMemo } from "react";

import { AmountDisplay } from "@mizan/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";

import { useAccounts } from "@/hooks/use-accounts";
import { useAccountsSimplePerformance } from "@/hooks/use-accounts-simple-performance";
import { formatPercent } from "@/lib/utils";

import { deriveNetWorth, type NetWorthSlice } from "./derive";

export type NetWorthSummaryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; slice: NetWorthSlice };

interface NetWorthSummaryViewProps {
  state: NetWorthSummaryState;
}

/**
 * Pure rendering component for the Net Worth Summary card.
 *
 * Exported separately from the container so tests can exercise every
 * state without mocking React Query.
 */
export function NetWorthSummaryView({ state }: NetWorthSummaryViewProps) {
  return (
    <Card data-testid="home-net-worth">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Net worth</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-2" data-testid="home-net-worth-loading">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}
        {state.status === "error" && (
          <p className="text-destructive text-sm" data-testid="home-net-worth-error">
            We couldn&apos;t load your net worth. {state.message}
          </p>
        )}
        {state.status === "empty" && (
          <p className="text-muted-foreground text-sm" data-testid="home-net-worth-empty">
            Add an account and your first asset to see your net worth here.
          </p>
        )}
        {state.status === "ready" && (
          <div data-testid="home-net-worth-ready">
            <div className="text-3xl font-semibold tracking-tight">
              <AmountDisplay value={state.slice.total} currency={state.slice.baseCurrency} />
            </div>
            <div className="text-muted-foreground mt-1 text-sm">
              Across {state.slice.accountCount}{" "}
              {state.slice.accountCount === 1 ? "account" : "accounts"}
              {state.slice.dayChange !== null && (
                <>
                  {" "}
                  · 1d change{" "}
                  <span
                    className={state.slice.dayChange >= 0 ? "text-success" : "text-destructive"}
                    data-testid="home-net-worth-day-change"
                  >
                    <AmountDisplay
                      value={state.slice.dayChange}
                      currency={state.slice.baseCurrency}
                    />
                    {state.slice.dayReturn !== null && (
                      <> ({formatPercent(state.slice.dayReturn)})</>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Net Worth Summary — Home command center module #1.
 *
 * Data comes from the existing `calculateAccountsSimplePerformance`
 * command. The container resolves the loading / error / empty / ready
 * state and hands it to {@link NetWorthSummaryView}.
 */
export function NetWorthSummary() {
  const { accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsErrored,
    error: metricsError,
  } = useAccountsSimplePerformance(accounts);

  const slice = useMemo(() => (metrics ? deriveNetWorth(metrics) : null), [metrics]);

  const state: NetWorthSummaryState = accountsError
    ? { status: "error", message: accountsError.message }
    : metricsErrored
      ? { status: "error", message: metricsError?.message ?? "Failed to load net worth." }
      : accountsLoading || metricsLoading
        ? { status: "loading" }
        : !slice
          ? { status: "empty" }
          : { status: "ready", slice };

  return <NetWorthSummaryView state={state} />;
}
