import { Badge } from "@mizan/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Progress } from "@mizan/ui/components/ui/progress";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";
import { Link } from "react-router-dom";

import { useDataQualityScore } from "@/hooks/use-health";
import type { DataQualityDeduction, DataQualityScore, HealthSeverity } from "@/lib/types";

export type DataQualityCardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty"; explanation: string }
  | { status: "ready"; score: DataQualityScore };

const SEVERITY_BADGE: Record<HealthSeverity, "default" | "secondary" | "destructive" | "warning"> =
  {
    CRITICAL: "destructive",
    ERROR: "destructive",
    WARNING: "warning",
    INFO: "secondary",
  };

function scoreLabel(score: number): string {
  if (score >= 90) return "Strong";
  if (score >= 75) return "Review";
  if (score >= 50) return "Attention";
  return "Priority";
}

function sortDeductions(deductions: DataQualityDeduction[]): DataQualityDeduction[] {
  return [...deductions].sort((a, b) => b.points - a.points || b.affectedCount - a.affectedCount);
}

export function DataQualityCardView({ state }: { state: DataQualityCardState }) {
  return (
    <Card data-testid="home-data-quality">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Data quality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-3" data-testid="home-data-quality-loading">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {state.status === "error" && (
          <p className="text-destructive text-sm" data-testid="home-data-quality-error">
            Data quality is unavailable. {state.message}
          </p>
        )}

        {state.status === "empty" && (
          <p className="text-muted-foreground text-sm" data-testid="home-data-quality-empty">
            {state.explanation}
          </p>
        )}

        {state.status === "ready" && state.score.score !== null && (
          <div className="space-y-3" data-testid="home-data-quality-ready">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold tabular-nums">{state.score.score}</div>
                <p className="text-muted-foreground text-xs">out of 100</p>
              </div>
              <Badge variant={SEVERITY_BADGE[state.score.severity]}>
                {scoreLabel(state.score.score)}
              </Badge>
            </div>

            <Progress value={state.score.score} className="h-2" aria-label="Data quality score" />

            <p className="text-muted-foreground text-sm">{state.score.explanation}</p>

            {state.score.deductions.length > 0 ? (
              <ul className="space-y-1" data-testid="home-data-quality-deductions">
                {sortDeductions(state.score.deductions)
                  .slice(0, 4)
                  .map((deduction) => (
                    <li key={deduction.component}>
                      <Link
                        to={deduction.clickTarget}
                        className="hover:bg-accent flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{deduction.label}</span>
                          <span className="text-muted-foreground block text-xs">
                            {deduction.explanation}
                          </span>
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          -{deduction.points}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <Link
                to="/health"
                className="text-primary hover:text-primary/80 inline-flex text-sm font-medium"
              >
                Open issue list
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DataQualityCard() {
  const { data, isLoading, isError, error } = useDataQualityScore();

  let state: DataQualityCardState;
  if (isError) {
    state = { status: "error", message: error?.message ?? "Failed to load data quality." };
  } else if (isLoading) {
    state = { status: "loading" };
  } else if (data?.score === undefined || data?.score === null || data?.isOnboarding === true) {
    state = {
      status: "empty",
      explanation: data?.explanation ?? "Add portfolio data to calculate a data quality score.",
    };
  } else {
    state = { status: "ready", score: data };
  }

  return <DataQualityCardView state={state} />;
}
