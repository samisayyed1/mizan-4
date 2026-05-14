// Pure derivation helpers for the Home dashboard.
//
// These functions take backend data shapes and return the small slices
// each Home module renders. Keeping the logic pure means every Home
// module has a clean, fully testable derivation step that does not
// require mounting the React tree or mocking React Query.
//
// All money values stay as `number` here for display purposes — the
// authoritative Decimal math runs in the Rust backend and is already
// rounded at the serialization boundary (see DISPLAY_DECIMAL_PRECISION
// in crates/core).

import type { HealthCategory, HealthIssue, HealthSeverity, IncomeSummary } from "@/lib/types";

/**
 * Returns the YYYY-MM key for a given Date.
 *
 * The backend `IncomeSummary.byMonth` map keys are emitted by the
 * income service in `YYYY-MM` form (see income_service.rs line 139,
 * which parses `{date}-01` from `activity.date`). Keeping derivation
 * here means the frontend never has to guess.
 */
export function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export interface NetWorthSlice {
  /** Total net worth in the base currency. */
  total: number;
  /** Base currency code (`USD`, `EUR`, …). */
  baseCurrency: string;
  /** Sum of one-day changes across accounts in base currency, if any account reported a day change. */
  dayChange: number | null;
  /**
   * Day return as a fraction (e.g. 0.0123 = +1.23%). Computed from
   * `dayChange / (total - dayChange)` so it is consistent with the
   * displayed totals.
   */
  dayReturn: number | null;
  /** Number of accounts contributing to the total. */
  accountCount: number;
}

/**
 * Build a {@link NetWorthSlice} from the backend's
 * `calculateAccountsSimplePerformance` response.
 *
 * `metrics` is one entry per account; values are already converted to
 * `baseCurrency` by the Rust performance service.
 */
export function deriveNetWorth(
  metrics: ReadonlyArray<{
    totalValue?: number | null;
    baseCurrency?: string | null;
    dayGainLossAmount?: number | null;
  }>,
): NetWorthSlice | null {
  if (metrics.length === 0) return null;

  let total = 0;
  let dayChange = 0;
  let dayChangeReported = false;
  let baseCurrency: string | null = null;

  for (const m of metrics) {
    if (m.totalValue != null) {
      total += m.totalValue;
    }
    if (m.dayGainLossAmount != null) {
      dayChange += m.dayGainLossAmount;
      dayChangeReported = true;
    }
    if (!baseCurrency && m.baseCurrency) {
      baseCurrency = m.baseCurrency;
    }
  }

  if (!baseCurrency) return null;

  const previousTotal = total - (dayChangeReported ? dayChange : 0);
  const dayReturn = dayChangeReported && previousTotal !== 0 ? dayChange / previousTotal : null;

  return {
    total,
    baseCurrency,
    dayChange: dayChangeReported ? dayChange : null,
    dayReturn,
    accountCount: metrics.length,
  };
}

export interface IncomeThisMonthSlice {
  /** Total income in base currency for the current month. */
  total: number;
  /** Base currency code. */
  baseCurrency: string;
  /** YYYY-MM key the slice was computed for. */
  monthKey: string;
  /**
   * Breakdown by activity type for the current month. Activity-type
   * keys come from the Rust ActivityType enum (DIVIDEND, INTEREST,
   * etc.) — we surface only types that contributed this month.
   */
  byType: Array<{ type: string; amount: number }>;
}

const INCOME_TYPES = new Set([
  "DIVIDEND",
  "INTEREST",
  "INTEREST_INCOME",
  "INCOME",
  "BOND_INTEREST",
]);

/**
 * Pull a current-month slice from the backend's income summaries.
 *
 * `summaries` is the full `Vec<IncomeSummary>` returned by
 * `get_income_summary` (one entry per period — TOTAL, YTD, LAST_YEAR,
 * TWO_YEARS_AGO). The YTD summary's `byMonth` map is the source of
 * truth for the running year.
 *
 * If no income has been booked for the current month yet, returns
 * `null` so the module can render an honest empty state.
 */
export function deriveIncomeThisMonth(
  summaries: ReadonlyArray<IncomeSummary>,
  now: Date,
): IncomeThisMonthSlice | null {
  const ytd = summaries.find((s) => s.period === "YTD") ?? summaries[0];
  if (!ytd) return null;

  const key = monthKey(now);
  const total = ytd.byMonth[key] ?? 0;
  if (total === 0) {
    // No income booked this month — let the module decide whether to
    // render a zero or an empty state. Returning the slice with total=0
    // gives the module the data it needs without us inventing income.
    return { total: 0, baseCurrency: ytd.currency, monthKey: key, byType: [] };
  }

  // The backend doesn't break byType down by month, so the per-month
  // type split is best-effort: we surface the YTD type totals and let
  // the UI label them as YTD-by-type when the month total is non-zero.
  const byType = Object.entries(ytd.byType)
    .filter(([t]) => INCOME_TYPES.has(t))
    .map(([type, amount]) => ({ type, amount }))
    .filter((entry) => entry.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  return { total, baseCurrency: ytd.currency, monthKey: key, byType };
}

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
};

/**
 * Pick the top-N most severe active health issues for the Wealth Inbox
 * preview. We never invent items — if no issues exist, the slice is
 * empty and the module renders its honest empty state.
 */
export function pickTopHealthIssues(issues: ReadonlyArray<HealthIssue>, limit = 5): HealthIssue[] {
  return [...issues]
    .sort((a, b) => {
      const ra = SEVERITY_RANK[a.severity] ?? 99;
      const rb = SEVERITY_RANK[b.severity] ?? 99;
      if (ra !== rb) return ra - rb;
      return (b.affectedCount ?? 0) - (a.affectedCount ?? 0);
    })
    .slice(0, limit);
}

export interface AttentionRow {
  category: HealthCategory;
  label: string;
  affectedCount: number;
  severity: HealthSeverity;
  route: string;
}

const CATEGORY_LABELS: Record<HealthCategory, string> = {
  PRICE_STALENESS: "Stale market quotes",
  FX_INTEGRITY: "Missing FX rates",
  CLASSIFICATION: "Unclassified assets",
  DATA_CONSISTENCY: "Data consistency warnings",
  ACCOUNT_CONFIGURATION: "Account setup attention",
  SETTINGS_CONFIGURATION: "Settings attention",
};

/**
 * Group health issues by category for the Portfolio Attention module.
 *
 * Each row carries the most severe severity in the group plus the
 * total affected count, and a route the user can click through to
 * resolve the issue.
 */
export function deriveAttention(issues: ReadonlyArray<HealthIssue>): AttentionRow[] {
  const buckets = new Map<HealthCategory, { count: number; severity: HealthSeverity }>();

  for (const issue of issues) {
    const bucket = buckets.get(issue.category);
    if (!bucket) {
      buckets.set(issue.category, {
        count: issue.affectedCount ?? 0,
        severity: issue.severity,
      });
      continue;
    }
    bucket.count += issue.affectedCount ?? 0;
    if ((SEVERITY_RANK[issue.severity] ?? 99) < (SEVERITY_RANK[bucket.severity] ?? 99)) {
      bucket.severity = issue.severity;
    }
  }

  return Array.from(buckets.entries())
    .map(([category, { count, severity }]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      affectedCount: count,
      severity,
      route: "/health",
    }))
    .sort((a, b) => {
      const ra = SEVERITY_RANK[a.severity] ?? 99;
      const rb = SEVERITY_RANK[b.severity] ?? 99;
      if (ra !== rb) return ra - rb;
      return b.affectedCount - a.affectedCount;
    });
}
