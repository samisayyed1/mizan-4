import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";
import { Link } from "react-router-dom";

import { listManualValuationAssets, type ManualAssetValuationView } from "@/adapters";
import { useHealthStatus } from "@/hooks/use-health";
import { QueryKeys } from "@/lib/query-keys";

import {
  calculateDataQuality,
  type DataQualityReading,
  type DataQualitySeverity,
} from "./data-quality-derive";

/**
 * Data Quality Score — Home command center module (Prompt 7).
 *
 * Surfaces a 0-100 score with a plain-English explanation, a list of
 * top deductions (each click-routable to the screen that fixes it),
 * and an honest "neutral" onboarding state for a brand-new portfolio
 * with no data to score yet. No gamification, no fake score.
 */

export type DataQualityState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; reading: DataQualityReading };

const SEVERITY_PILL: Record<DataQualitySeverity, { className: string; label: string }> = {
  neutral: { className: "bg-muted text-muted-foreground", label: "No data yet" },
  excellent: { className: "bg-success/15 text-success", label: "Excellent" },
  good: { className: "bg-success/10 text-success", label: "Good" },
  attention: { className: "bg-warning/15 text-warning", label: "Needs attention" },
  critical: { className: "bg-destructive/15 text-destructive", label: "Critical" },
};

interface DataQualityViewProps {
  state: DataQualityState;
}

/** Pure rendering component — tests cover every branch. */
export function DataQualityView({ state }: DataQualityViewProps) {
  return (
    <Card data-testid="home-data-quality">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Data quality</CardTitle>
        {state.status === "ready" && state.reading.deductions.length > 0 && (
          <Link
            to="/health"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            data-testid="home-data-quality-link"
          >
            View issues
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-2" data-testid="home-data-quality-loading">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {state.status === "error" && (
          <p className="text-destructive text-sm" data-testid="home-data-quality-error">
            We couldn&apos;t score data quality. {state.message}
          </p>
        )}

        {state.status === "ready" && <ReadingBody reading={state.reading} />}
      </CardContent>
    </Card>
  );
}

function ReadingBody({ reading }: { reading: DataQualityReading }) {
  const pill = SEVERITY_PILL[reading.severity];

  if (reading.score === null) {
    return (
      <div data-testid="home-data-quality-neutral">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-3xl font-semibold tracking-tight">—</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}>
            {pill.label}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{reading.explanation}</p>
      </div>
    );
  }

  return (
    <div data-testid="home-data-quality-ready">
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-semibold tabular-nums tracking-tight"
          data-testid="home-data-quality-score"
        >
          {reading.score}
        </span>
        <span className="text-muted-foreground text-sm">/ 100</span>
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}
          data-testid="home-data-quality-pill"
        >
          {pill.label}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm" data-testid="home-data-quality-explanation">
        {reading.explanation}
      </p>

      {reading.deductions.length > 0 && (
        <ul
          className="border-border/40 mt-3 space-y-1.5 border-t pt-3"
          data-testid="home-data-quality-deductions"
        >
          {reading.deductions.slice(0, 4).map((d) => (
            <li key={d.category}>
              <Link
                to={d.route}
                className="hover:bg-accent flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors"
                data-testid={`home-data-quality-deduction-${d.category}`}
              >
                <span>{d.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  −{d.pointsOff} pts
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ul
        className="text-muted-foreground/80 mt-3 space-y-1 text-xs"
        data-testid="home-data-quality-pending"
      >
        {reading.pendingCapabilities.map((cap) => (
          <li key={cap.capability}>{cap.label}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Data Quality Score container — joins `useHealthStatus()` and the
 * manual-valuation list (Prompt 6) through TanStack Query and hands
 * the resolved state to the pure view.
 */
export function DataQuality() {
  const healthQuery = useHealthStatus();
  const manualQuery = useQuery<ManualAssetValuationView[], Error>({
    queryKey: [QueryKeys.MANUAL_VALUATION_ASSETS],
    queryFn: listManualValuationAssets,
    staleTime: 1000 * 60 * 5,
  });

  let state: DataQualityState;
  if (healthQuery.isError) {
    state = {
      status: "error",
      message: healthQuery.error?.message ?? "Failed to load health data.",
    };
  } else if (manualQuery.isError) {
    state = {
      status: "error",
      message: manualQuery.error?.message ?? "Failed to load manual valuations.",
    };
  } else if (healthQuery.isLoading || manualQuery.isLoading) {
    state = { status: "loading" };
  } else {
    state = {
      status: "ready",
      reading: calculateDataQuality({
        health: healthQuery.data,
        manualAssets: manualQuery.data,
      }),
    };
  }

  return <DataQualityView state={state} />;
}
