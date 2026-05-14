import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@mizan/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Icons } from "@mizan/ui/components/ui/icons";
import { Input } from "@mizan/ui/components/ui/input";
import { Skeleton } from "@mizan/ui/components/ui/skeleton";

import {
  bulkUpdateValuations,
  listManualValuationAssets,
  type BulkValuationResult,
  type ManualAssetValuationView,
} from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";

import { buildInitialGrid, collectChanges, type GridRow, type GridValidationError } from "./derive";

/**
 * Manual valuation bulk update grid (Prompt 6 of the build plan).
 *
 *   • Every manual-mode asset shows up as one row with its current
 *     value / date / notes editable in place.
 *   • A staleness pill flags rows that haven't been refreshed in
 *     45 days (warning) or 90 days (critical).
 *   • The "Mark unchanged" button on a row reverts its draft to the
 *     baseline so it won't be included in the save batch.
 *   • "Save" sends only the changed rows through `bulkUpdateValuations`
 *     which writes them atomically — invalid input or missing FK kills
 *     the whole batch and nothing is persisted.
 */

const STALENESS_PILL: Record<
  "no_data" | "fresh" | "warning" | "critical",
  { className: string; label: string }
> = {
  no_data: { className: "bg-muted text-muted-foreground", label: "No data" },
  fresh: { className: "bg-success/15 text-success", label: "Fresh" },
  warning: { className: "bg-warning/15 text-warning", label: "Warning" },
  critical: { className: "bg-destructive/15 text-destructive", label: "Critical" },
};

export type BulkUpdateState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; rows: GridRow[] };

interface BulkUpdateViewProps {
  state: BulkUpdateState;
  saving: boolean;
  saveError: string | null;
  saveSummary: { written: number } | null;
  validationErrors: GridValidationError[];
  onCellEdit: (assetId: string, field: "value" | "date" | "notes", value: string) => void;
  onMarkUnchanged: (assetId: string) => void;
  onSave: () => void;
}

/** Pure rendering component — fully testable without hooks/network. */
export function BulkUpdateView({
  state,
  saving,
  saveError,
  saveSummary,
  validationErrors,
  onCellEdit,
  onMarkUnchanged,
  onSave,
}: BulkUpdateViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4" data-testid="bulk-update-page">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Update values</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Refresh the current value of every manually valued asset. Saves are atomic — if any row
            is invalid, the whole batch rolls back.
          </p>
        </div>
        <Link
          to="/assets/new"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
        >
          Add new asset
        </Link>
      </header>

      {state.status === "loading" && (
        <Card data-testid="bulk-update-loading">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      )}

      {state.status === "error" && (
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive text-sm" data-testid="bulk-update-error">
              We couldn&apos;t load your assets. {state.message}
            </p>
          </CardContent>
        </Card>
      )}

      {state.status === "empty" && (
        <Card>
          <CardContent className="p-6 text-center">
            <Icons.Wallet
              className="text-muted-foreground mx-auto mb-3 size-8"
              aria-hidden="true"
            />
            <p className="text-base font-medium" data-testid="bulk-update-empty">
              No manually valued assets yet
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Add an asset to start tracking valuations here.
            </p>
            <Link
              to="/assets/new"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              Add asset
            </Link>
          </CardContent>
        </Card>
      )}

      {state.status === "ready" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {state.rows.length} manually valued {state.rows.length === 1 ? "asset" : "assets"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="text-muted-foreground grid grid-cols-[2fr_1.4fr_1.2fr_2fr_1fr_auto] items-center gap-3 text-xs font-medium uppercase tracking-wide"
              data-testid="bulk-update-header"
            >
              <span>Asset</span>
              <span>Current value</span>
              <span>Date</span>
              <span>Notes</span>
              <span>Status</span>
              <span className="sr-only">Row actions</span>
            </div>
            <ul className="space-y-2" data-testid="bulk-update-list">
              {state.rows.map((row) => {
                const errorForRow = validationErrors.find((e) => e.assetId === row.assetId);
                const pill = STALENESS_PILL[row.staleness.level];
                return (
                  <li
                    key={row.assetId}
                    className="border-border/60 rounded-md border p-3"
                    data-testid={`bulk-row-${row.assetId}`}
                  >
                    <div className="grid grid-cols-[2fr_1.4fr_1.2fr_2fr_1fr_auto] items-center gap-3">
                      <div>
                        <div className="font-medium">{row.assetName}</div>
                        <div className="text-muted-foreground text-xs">{row.currency}</div>
                      </div>
                      <Input
                        inputMode="decimal"
                        value={row.draft.value}
                        onChange={(e) => onCellEdit(row.assetId, "value", e.target.value)}
                        data-testid={`bulk-row-${row.assetId}-value`}
                      />
                      <Input
                        type="date"
                        value={row.draft.date}
                        onChange={(e) => onCellEdit(row.assetId, "date", e.target.value)}
                        data-testid={`bulk-row-${row.assetId}-date`}
                      />
                      <Input
                        value={row.draft.notes}
                        onChange={(e) => onCellEdit(row.assetId, "notes", e.target.value)}
                        placeholder="Source, appraiser, etc."
                        data-testid={`bulk-row-${row.assetId}-notes`}
                      />
                      <span
                        className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}
                        title={row.staleness.label}
                        data-testid={`bulk-row-${row.assetId}-staleness`}
                      >
                        {pill.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onMarkUnchanged(row.assetId)}
                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                        data-testid={`bulk-row-${row.assetId}-unchanged`}
                      >
                        Mark unchanged
                      </button>
                    </div>
                    {errorForRow && (
                      <p
                        className="text-destructive mt-2 text-xs"
                        data-testid={`bulk-row-${row.assetId}-error`}
                      >
                        {errorForRow.message}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {saveError && (
              <p className="text-destructive text-sm" data-testid="bulk-save-error">
                {saveError}
              </p>
            )}
            {saveSummary && (
              <p className="text-success text-sm" data-testid="bulk-save-summary">
                Saved {saveSummary.written} {saveSummary.written === 1 ? "valuation" : "valuations"}
                .
              </p>
            )}
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" onClick={onSave} disabled={saving} data-testid="bulk-save">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <span className="text-muted-foreground text-xs">
                Only rows you edited are sent. Unchanged rows are skipped.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Container — wires the view to TanStack Query + the bulk-update
 * mutation. Tests for the view live next door; this container is
 * exercised in tests via the adapter mocks.
 */
export default function BulkUpdatePage() {
  const queryClient = useQueryClient();

  const query = useQuery<ManualAssetValuationView[], Error>({
    queryKey: [QueryKeys.MANUAL_VALUATION_ASSETS],
    queryFn: listManualValuationAssets,
  });

  const [rows, setRows] = useState<GridRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<GridValidationError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSummary, setSaveSummary] = useState<{ written: number } | null>(null);

  // Sync the editable grid when the query payload arrives or refreshes.
  useEffect(() => {
    if (query.data) {
      setRows(buildInitialGrid(query.data));
      setValidationErrors([]);
      setSaveError(null);
    }
  }, [query.data]);

  const mutation = useMutation<BulkValuationResult, Error, void>({
    mutationFn: async () => {
      const { changes, errors } = collectChanges(rows);
      if (errors.length > 0) {
        setValidationErrors(errors);
        throw new Error("Fix the highlighted rows before saving.");
      }
      setValidationErrors([]);
      return bulkUpdateValuations(changes);
    },
    onSuccess: (result) => {
      setSaveError(null);
      setSaveSummary({ written: result.written });
      // Refresh so baseline tracks the new server state.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MANUAL_VALUATION_ASSETS] });
    },
    onError: (err) => {
      setSaveSummary(null);
      setSaveError(err.message);
    },
  });

  const state: BulkUpdateState = useMemo(() => {
    if (query.isError) {
      return { status: "error", message: query.error?.message ?? "Failed to load." };
    }
    if (query.isLoading || !query.data) {
      return { status: "loading" };
    }
    if (rows.length === 0) {
      return { status: "empty" };
    }
    return { status: "ready", rows };
  }, [query.isError, query.error, query.isLoading, query.data, rows]);

  return (
    <BulkUpdateView
      state={state}
      saving={mutation.isPending}
      saveError={saveError}
      saveSummary={saveSummary}
      validationErrors={validationErrors}
      onCellEdit={(assetId, field, value) => {
        setSaveSummary(null);
        setRows((prev) =>
          prev.map((r) =>
            r.assetId === assetId ? { ...r, draft: { ...r.draft, [field]: value } } : r,
          ),
        );
      }}
      onMarkUnchanged={(assetId) => {
        setSaveSummary(null);
        setRows((prev) =>
          prev.map((r) =>
            r.assetId === assetId && r.baseline ? { ...r, draft: { ...r.baseline } } : r,
          ),
        );
      }}
      onSave={() => mutation.mutate()}
    />
  );
}
