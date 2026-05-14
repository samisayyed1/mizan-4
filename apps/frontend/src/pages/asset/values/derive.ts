// Pure derivation helpers for the bulk valuation update grid
// (Prompt 6).
//
// Keeping the logic pure means every staleness/diff decision is
// directly testable without mounting React.

import type { BulkValuationInput, ManualAssetValuationView } from "@/adapters";

export type Staleness = "no_data" | "fresh" | "warning" | "critical";

export interface StalenessReading {
  level: Staleness;
  days: number | null;
  label: string;
}

const WARNING_THRESHOLD_DAYS = 45;
const CRITICAL_THRESHOLD_DAYS = 90;

/**
 * Returns the staleness reading for a valuation row's last
 * known `valuation_date`.
 *
 * `null` last_date → `no_data`.
 * `< 45 days` → `fresh`.
 * `45..89 days` → `warning`.
 * `>= 90 days` → `critical`.
 */
export function readStaleness(latestDate: string | null, today: Date): StalenessReading {
  if (!latestDate) {
    return { level: "no_data", days: null, label: "No valuation yet" };
  }
  // YYYY-MM-DD anchored at UTC midnight so daylight-savings and tz
  // differences don't flip days near boundaries.
  const parts = latestDate.split("-");
  if (parts.length !== 3) {
    return { level: "no_data", days: null, label: "Unparseable date" };
  }
  const last = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((todayUtc - last.getTime()) / 86_400_000);

  if (days < 0) {
    // Future-dated valuation — treat as fresh but disclose.
    return { level: "fresh", days, label: `Dated ${Math.abs(days)}d in the future` };
  }
  if (days < WARNING_THRESHOLD_DAYS) {
    return { level: "fresh", days, label: `${days}d ago` };
  }
  if (days < CRITICAL_THRESHOLD_DAYS) {
    return { level: "warning", days, label: `${days}d ago — review soon` };
  }
  return { level: "critical", days, label: `${days}d ago — stale` };
}

/**
 * A row in the editable grid. Holds the user's pending edit plus the
 * server-known baseline so we can diff and only POST changed rows.
 */
export interface GridRow {
  assetId: string;
  assetName: string;
  currency: string;
  baseline: {
    value: string;
    date: string;
    notes: string;
  } | null;
  draft: {
    value: string;
    date: string;
    notes: string;
  };
  staleness: StalenessReading;
}

const TODAY_ISO = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
};

/**
 * Build the initial editable grid from the backend `manual_valuation_assets`
 * payload. The draft starts equal to the baseline so a "save all" before
 * any edit is a no-op.
 */
export function buildInitialGrid(
  view: ReadonlyArray<ManualAssetValuationView>,
  today: Date = new Date(),
): GridRow[] {
  return view.map((row) => {
    const baseline = row.latest
      ? {
          value: row.latest.valueNative,
          date: row.latest.valuationDate,
          notes: row.latest.notes ?? "",
        }
      : null;
    const draft = baseline ?? { value: "", date: TODAY_ISO(), notes: "" };
    return {
      assetId: row.assetId,
      assetName: row.assetName ?? row.assetId,
      currency: row.assetCurrency,
      baseline,
      draft: { ...draft },
      staleness: readStaleness(row.latest?.valuationDate ?? null, today),
    };
  });
}

/**
 * True when the row's draft is meaningfully different from its
 * baseline — empty drafts and trimmed-whitespace-only diffs do not
 * count as a change.
 */
export function rowHasChange(row: GridRow): boolean {
  const v = row.draft.value.trim();
  if (v.length === 0) return false;
  // No baseline → any non-empty draft is a change.
  if (!row.baseline) return true;
  return (
    v !== row.baseline.value.trim() ||
    row.draft.date.trim() !== row.baseline.date.trim() ||
    row.draft.notes.trim() !== row.baseline.notes.trim()
  );
}

/**
 * Strict Decimal-string validator. Empty string is invalid here —
 * callers should filter unchanged rows out first.
 */
export function isValidDecimal(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;
  return /^-?\d+(\.\d+)?$/.test(v);
}

/** YYYY-MM-DD only — keeps SQLite date column predictable. */
export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export interface GridValidationError {
  assetId: string;
  field: "value" | "date";
  message: string;
}

/**
 * Validates only the rows that actually changed.
 * Returns the input payload + the list of errors in a single pass.
 */
export function collectChanges(rows: ReadonlyArray<GridRow>): {
  changes: BulkValuationInput[];
  errors: GridValidationError[];
} {
  const changes: BulkValuationInput[] = [];
  const errors: GridValidationError[] = [];

  for (const row of rows) {
    if (!rowHasChange(row)) continue;
    if (!isValidDecimal(row.draft.value)) {
      errors.push({
        assetId: row.assetId,
        field: "value",
        message: "Enter a valid number (e.g. 1234.56).",
      });
      continue;
    }
    if (!isValidIsoDate(row.draft.date)) {
      errors.push({
        assetId: row.assetId,
        field: "date",
        message: "Date must be YYYY-MM-DD.",
      });
      continue;
    }
    changes.push({
      assetId: row.assetId,
      valuationDate: row.draft.date,
      valueNative: row.draft.value.trim(),
      currency: row.currency,
      notes: row.draft.notes.trim().length > 0 ? row.draft.notes.trim() : undefined,
    });
  }

  return { changes, errors };
}
