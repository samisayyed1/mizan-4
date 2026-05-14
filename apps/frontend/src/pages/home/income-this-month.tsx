import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getIncomeSummary } from "@/adapters";
import { AmountDisplay } from "@mizan/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";

import { QueryKeys } from "@/lib/query-keys";
import type { IncomeSummary } from "@/lib/types";

import { deriveIncomeThisMonth, type IncomeThisMonthSlice } from "./derive";

export type IncomeThisMonthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty"; baseCurrency: string; monthKey: string }
  | { status: "ready"; slice: IncomeThisMonthSlice };

const TYPE_LABELS: Record<string, string> = {
  DIVIDEND: "Dividends",
  INTEREST: "Interest",
  INTEREST_INCOME: "Interest",
  BOND_INTEREST: "Bond interest",
  INCOME: "Income",
};

/**
 * Pure rendering component for the Income This Month card.
 */
export function IncomeThisMonthView({ state }: { state: IncomeThisMonthState }) {
  const monthLabel = monthLabelForKey(
    state.status === "ready"
      ? state.slice.monthKey
      : state.status === "empty"
        ? state.monthKey
        : null,
  );

  return (
    <Card data-testid="home-income-this-month">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Income this month
          {monthLabel ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal">· {monthLabel}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-2" data-testid="home-income-loading">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        )}
        {state.status === "error" && (
          <p className="text-destructive text-sm" data-testid="home-income-error">
            We couldn&apos;t load income. {state.message}
          </p>
        )}
        {state.status === "empty" && (
          <p className="text-muted-foreground text-sm" data-testid="home-income-empty">
            No dividends, interest, or coupons booked yet for this month.
          </p>
        )}
        {state.status === "ready" && (
          <div data-testid="home-income-ready">
            <div className="text-3xl font-semibold tracking-tight">
              <AmountDisplay value={state.slice.total} currency={state.slice.baseCurrency} />
            </div>
            {state.slice.byType.length > 0 && state.slice.total > 0 && (
              <ul
                className="text-muted-foreground mt-2 space-y-1 text-sm"
                data-testid="home-income-by-type"
              >
                {state.slice.byType.map((entry) => (
                  <li key={entry.type} className="flex items-baseline justify-between">
                    <span>
                      {TYPE_LABELS[entry.type] ?? entry.type}
                      <span className="text-muted-foreground/70 ml-2 text-xs">YTD</span>
                    </span>
                    <span className="text-foreground/80 tabular-nums">
                      <AmountDisplay value={entry.amount} currency={state.slice.baseCurrency} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function monthLabelForKey(key: string | null): string | null {
  if (!key) return null;
  // key is YYYY-MM. Build a stable, locale-independent label.
  const [year, month] = key.split("-");
  if (!year || !month) return null;
  const monthIdx = Number(month) - 1;
  if (!Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 11) return null;
  const date = new Date(Date.UTC(Number(year), monthIdx, 1));
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Income This Month — Home command center module #3.
 */
export function IncomeThisMonth() {
  const now = useMemo(() => new Date(), []);
  const {
    data: summaries,
    isLoading,
    isError,
    error,
  } = useQuery<IncomeSummary[], Error>({
    queryKey: [QueryKeys.INCOME_SUMMARY],
    queryFn: () => getIncomeSummary(),
    staleTime: 1000 * 60 * 5,
  });

  const slice = useMemo(
    () => (summaries ? deriveIncomeThisMonth(summaries, now) : null),
    [summaries, now],
  );

  let state: IncomeThisMonthState;
  if (isError) {
    state = { status: "error", message: error?.message ?? "Failed to load income." };
  } else if (isLoading) {
    state = { status: "loading" };
  } else if (!slice) {
    // No summaries returned at all — we cannot honestly label a base
    // currency, so render an unconditional empty state without a label.
    state = { status: "empty", baseCurrency: "", monthKey: monthKeyForToday(now) };
  } else if (slice.total === 0) {
    state = { status: "empty", baseCurrency: slice.baseCurrency, monthKey: slice.monthKey };
  } else {
    state = { status: "ready", slice };
  }

  return <IncomeThisMonthView state={state} />;
}

function monthKeyForToday(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
