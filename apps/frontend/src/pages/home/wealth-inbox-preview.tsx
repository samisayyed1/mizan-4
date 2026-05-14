import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Icons } from "@mizan/ui/components/ui/icons";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";
import { Link } from "react-router-dom";

import { useHealthStatus } from "@/hooks/use-health";
import type { HealthIssue, HealthSeverity } from "@/lib/types";

import { pickTopHealthIssues } from "./derive";

export type WealthInboxState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; issues: HealthIssue[] };

const SEVERITY_TONE: Record<HealthSeverity, string> = {
  CRITICAL: "text-destructive",
  ERROR: "text-destructive",
  WARNING: "text-warning",
  INFO: "text-muted-foreground",
};

/**
 * Pure rendering component for the Wealth Inbox preview.
 *
 * Wealth Inbox is a Phase 5 build (Prompt 9). Until the dedicated
 * Inbox screen lands, the Home preview surfaces real, deterministic
 * `health_status` issues. Document reviews, capital calls and tax-pack
 * items render as honest "coming after X" rows backed by capability
 * checks — never as fake list entries.
 */
export function WealthInboxPreviewView({ state }: { state: WealthInboxState }) {
  return (
    <Card data-testid="home-wealth-inbox">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Wealth inbox</CardTitle>
        <Link
          to="/health"
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
        >
          Open Health
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-2" data-testid="home-inbox-loading">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {state.status === "error" && (
          <p className="text-destructive text-sm" data-testid="home-inbox-error">
            We couldn&apos;t load the inbox. {state.message}
          </p>
        )}
        {state.status === "empty" && (
          <p className="text-muted-foreground text-sm" data-testid="home-inbox-empty">
            Inbox is clear — no active health issues right now.
          </p>
        )}
        {state.status === "ready" && (
          <ul className="space-y-2" data-testid="home-inbox-list">
            {state.issues.map((issue) => (
              <li
                key={issue.id}
                className="border-border/60 flex items-start gap-3 rounded-md border p-2"
              >
                <span
                  className={`mt-1 inline-block size-2 shrink-0 rounded-full ${
                    issue.severity === "CRITICAL" || issue.severity === "ERROR"
                      ? "bg-destructive"
                      : issue.severity === "WARNING"
                        ? "bg-warning"
                        : "bg-muted-foreground/60"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{issue.title}</span>
                    <span className={`text-xs ${SEVERITY_TONE[issue.severity] ?? ""}`}>
                      {issue.severity.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{issue.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PendingDownstreamRows />
      </CardContent>
    </Card>
  );
}

/**
 * Honest "coming after X" rows for downstream systems that don't exist
 * yet. These are not fake items — they're transparent placeholders that
 * tell the user *when* each row type will start populating.
 *
 * When a downstream system (Document Vault, Private Investments, Tax
 * Pack) lands, the corresponding row here can be replaced with a real
 * data binding.
 */
function PendingDownstreamRows() {
  return (
    <ul
      className="text-muted-foreground border-border/40 mt-3 space-y-1.5 border-t pt-3 text-xs"
      data-testid="home-inbox-pending"
    >
      <li className="flex items-center gap-2">
        <Icons.FileText className="size-3.5 opacity-60" aria-hidden="true" />
        <span>Document reviews will appear here once the Document Vault ships.</span>
      </li>
      <li className="flex items-center gap-2">
        <Icons.Calendar className="size-3.5 opacity-60" aria-hidden="true" />
        <span>
          Upcoming events (capital calls, coupons, maturities) appear once those are tracked.
        </span>
      </li>
    </ul>
  );
}

/**
 * Wealth Inbox Preview — Home command center module #2.
 */
export function WealthInboxPreview() {
  const { data, isLoading, isError, error } = useHealthStatus();

  let state: WealthInboxState;
  if (isError) {
    state = { status: "error", message: error?.message ?? "Failed to load inbox." };
  } else if (isLoading) {
    state = { status: "loading" };
  } else if (!data || data.issues.length === 0) {
    state = { status: "empty" };
  } else {
    state = { status: "ready", issues: pickTopHealthIssues(data.issues, 4) };
  }

  return <WealthInboxPreviewView state={state} />;
}
