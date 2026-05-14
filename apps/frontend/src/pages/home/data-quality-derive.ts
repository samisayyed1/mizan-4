// Pure derivation for the Home Data Quality Score module (Prompt 7).
//
// The score is computed entirely from data already produced by services
// shipped in earlier prompts — `getHealthStatus()` (Health) and
// `listManualValuationAssets()` (Prompt 4 + 6). No new backend, no new
// schema. Categories the build plan calls out but that depend on
// modules not yet built (Document Vault, extracted facts) contribute
// honest empty-state messaging rather than a fake 0 or a fake 100.

import type { HealthIssue, HealthSeverity, HealthStatus } from "@/lib/types";
import type { ManualAssetValuationView } from "@/adapters";

import { readStaleness } from "@/pages/asset/values/derive";

// ---------------------------------------------------------------------------
// Scoring tables — calibrated so a portfolio with no issues gets 100,
// and one bad warning takes more than just a paper-cut. Tuned to make
// the score genuinely actionable for older / HNW users without
// gamification.
// ---------------------------------------------------------------------------

const HEALTH_SEVERITY_WEIGHT: Record<HealthSeverity, number> = {
  CRITICAL: 20,
  ERROR: 10,
  WARNING: 5,
  INFO: 1,
};

const MANUAL_STALE_CRITICAL_WEIGHT = 8; // per asset, ≥ 90 days
const MANUAL_STALE_WARNING_WEIGHT = 3; // per asset, 45-89 days
const MANUAL_NEVER_VALUED_WEIGHT = 5; // per asset, no valuation row yet

/** Cumulative deduction per category. Order is rendered in the UI. */
export type DataQualityCategory =
  | "MANUAL_VALUATION_FRESHNESS"
  | "PRICE_STALENESS"
  | "FX_INTEGRITY"
  | "CLASSIFICATION"
  | "DATA_CONSISTENCY"
  | "ACCOUNT_CONFIGURATION"
  | "SETTINGS_CONFIGURATION";

const CATEGORY_LABELS: Record<DataQualityCategory, string> = {
  MANUAL_VALUATION_FRESHNESS: "Manual valuations need refreshing",
  PRICE_STALENESS: "Stale market quotes",
  FX_INTEGRITY: "Missing FX rates",
  CLASSIFICATION: "Unclassified assets",
  DATA_CONSISTENCY: "Data consistency",
  ACCOUNT_CONFIGURATION: "Account setup",
  SETTINGS_CONFIGURATION: "Settings",
};

/** Route a user clicks through to in order to fix the category. */
const CATEGORY_ROUTES: Record<DataQualityCategory, string> = {
  MANUAL_VALUATION_FRESHNESS: "/assets/values",
  PRICE_STALENESS: "/health",
  FX_INTEGRITY: "/health",
  CLASSIFICATION: "/health",
  DATA_CONSISTENCY: "/health",
  ACCOUNT_CONFIGURATION: "/health",
  SETTINGS_CONFIGURATION: "/health",
};

export interface DataQualityDeduction {
  category: DataQualityCategory;
  label: string;
  pointsOff: number;
  affectedCount: number;
  severity: HealthSeverity;
  route: string;
}

export type DataQualitySeverity = "neutral" | "excellent" | "good" | "attention" | "critical";

export interface DataQualityReading {
  /** Integer 0-100, or `null` when there is genuinely no data to score. */
  score: number | null;
  severity: DataQualitySeverity;
  /** One sentence the dashboard renders as the headline. */
  explanation: string;
  /** Empty when score is 100 or null. */
  deductions: DataQualityDeduction[];
  /**
   * Honest, capability-checked notes about score components that the
   * downstream module hasn't shipped yet. Never invented data — the UI
   * shows these as a footnote so the user knows which signals are
   * still unaccounted for.
   */
  pendingCapabilities: ReadonlyArray<{
    capability: "document_vault" | "extracted_facts_review";
    label: string;
  }>;
}

const PENDING_CAPABILITIES: DataQualityReading["pendingCapabilities"] = [
  {
    capability: "document_vault",
    label: "Source documents will count once Document Vault ships.",
  },
  {
    capability: "extracted_facts_review",
    label: "Pending document reviews will count once the review queue ships.",
  },
] as const;

interface Input {
  health: HealthStatus | undefined;
  manualAssets: ManualAssetValuationView[] | undefined;
  today?: Date;
}

/**
 * Compute the Data Quality reading from the data already available
 * elsewhere on the dashboard.
 *
 * Empty / onboarding state:
 *   If the caller has no health data AND no manual assets to score,
 *   the function returns `{ score: null, severity: "neutral", … }` —
 *   the UI must show a guiding message, never a fake 100/100.
 */
export function calculateDataQuality(input: Input): DataQualityReading {
  const today = input.today ?? new Date();

  const hasHealthData = input.health !== undefined;
  const hasAnyManual = (input.manualAssets?.length ?? 0) > 0;

  if (!hasHealthData && !hasAnyManual) {
    return {
      score: null,
      severity: "neutral",
      explanation: "Add an account or your first asset to start tracking data quality.",
      deductions: [],
      pendingCapabilities: PENDING_CAPABILITIES,
    };
  }

  // Health issues → deductions, grouped by category.
  const buckets = new Map<
    DataQualityCategory,
    { points: number; affected: number; severity: HealthSeverity }
  >();
  for (const issue of input.health?.issues ?? []) {
    const category = mapHealthCategory(issue);
    if (!category) continue;
    const weight = HEALTH_SEVERITY_WEIGHT[issue.severity] ?? 0;
    const bucket = buckets.get(category);
    if (!bucket) {
      buckets.set(category, {
        points: weight,
        affected: issue.affectedCount ?? 1,
        severity: issue.severity,
      });
      continue;
    }
    bucket.points += weight;
    bucket.affected += issue.affectedCount ?? 1;
    bucket.severity = pickMoreSevere(bucket.severity, issue.severity);
  }

  // Manual-valuation freshness — dedicated bucket so it can route to
  // /assets/values rather than /health.
  const manualBucket = scoreManualValuations(input.manualAssets ?? [], today);
  if (manualBucket) buckets.set("MANUAL_VALUATION_FRESHNESS", manualBucket);

  const deductions: DataQualityDeduction[] = [];
  let totalDeduction = 0;
  for (const [category, b] of buckets) {
    deductions.push({
      category,
      label: CATEGORY_LABELS[category],
      pointsOff: b.points,
      affectedCount: b.affected,
      severity: b.severity,
      route: CATEGORY_ROUTES[category],
    });
    totalDeduction += b.points;
  }
  deductions.sort((a, b) => b.pointsOff - a.pointsOff);

  const score = clampInt(100 - totalDeduction, 0, 100);
  const severity = severityForScore(score, deductions);
  return {
    score,
    severity,
    explanation: explanationFor(score, severity, deductions),
    deductions,
    pendingCapabilities: PENDING_CAPABILITIES,
  };
}

// ---------------------------------------------------------------------------
// Helpers (also exported for tests).
// ---------------------------------------------------------------------------

export function mapHealthCategory(issue: HealthIssue): DataQualityCategory | null {
  switch (issue.category) {
    case "PRICE_STALENESS":
      return "PRICE_STALENESS";
    case "FX_INTEGRITY":
      return "FX_INTEGRITY";
    case "CLASSIFICATION":
      return "CLASSIFICATION";
    case "DATA_CONSISTENCY":
      return "DATA_CONSISTENCY";
    case "ACCOUNT_CONFIGURATION":
      return "ACCOUNT_CONFIGURATION";
    case "SETTINGS_CONFIGURATION":
      return "SETTINGS_CONFIGURATION";
    default:
      return null;
  }
}

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
};

function pickMoreSevere(a: HealthSeverity, b: HealthSeverity): HealthSeverity {
  return (SEVERITY_RANK[a] ?? 99) <= (SEVERITY_RANK[b] ?? 99) ? a : b;
}

function scoreManualValuations(
  assets: ReadonlyArray<ManualAssetValuationView>,
  today: Date,
): { points: number; affected: number; severity: HealthSeverity } | null {
  if (assets.length === 0) return null;

  let points = 0;
  let critical = 0;
  let warning = 0;
  let unvalued = 0;
  for (const asset of assets) {
    if (!asset.latest) {
      unvalued += 1;
      points += MANUAL_NEVER_VALUED_WEIGHT;
      continue;
    }
    const staleness = readStaleness(asset.latest.valuationDate, today);
    if (staleness.level === "critical") {
      critical += 1;
      points += MANUAL_STALE_CRITICAL_WEIGHT;
    } else if (staleness.level === "warning") {
      warning += 1;
      points += MANUAL_STALE_WARNING_WEIGHT;
    }
  }

  const affected = critical + warning + unvalued;
  if (affected === 0) return null;

  const severity: HealthSeverity = critical > 0 ? "CRITICAL" : warning > 0 ? "WARNING" : "INFO";
  return { points, affected, severity };
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function severityForScore(
  score: number,
  deductions: ReadonlyArray<DataQualityDeduction>,
): DataQualitySeverity {
  if (deductions.some((d) => d.severity === "CRITICAL")) return "critical";
  if (score >= 95) return "excellent";
  if (score >= 80) return "good";
  if (score >= 60) return "attention";
  return "critical";
}

function explanationFor(
  score: number,
  severity: DataQualitySeverity,
  deductions: ReadonlyArray<DataQualityDeduction>,
): string {
  if (deductions.length === 0) {
    return "Data is in great shape — everything is up to date.";
  }
  const top = deductions[0]!;
  const total = deductions.length;
  const others = total - 1;
  const tail = others === 0 ? "" : ` plus ${others} other ${others === 1 ? "item" : "items"}`;
  const headline =
    severity === "excellent"
      ? "Almost perfect"
      : severity === "good"
        ? "In good shape"
        : severity === "attention"
          ? "A few items need attention"
          : "Several items need urgent attention";
  return `${headline}. Largest dent: ${top.label.toLowerCase()} (${top.pointsOff} pts off)${tail}.`;
}
