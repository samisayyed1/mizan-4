import { describe, expect, it } from "vitest";

import type { ManualAssetValuationView } from "@/adapters";

import {
  buildInitialGrid,
  collectChanges,
  isValidDecimal,
  isValidIsoDate,
  readStaleness,
  rowHasChange,
  type GridRow,
} from "./derive";

const today = new Date(Date.UTC(2026, 4, 14)); // 2026-05-14

describe("readStaleness", () => {
  it("returns no_data when there is no last date", () => {
    expect(readStaleness(null, today).level).toBe("no_data");
  });

  it("returns fresh below 45 days", () => {
    expect(readStaleness("2026-05-01", today).level).toBe("fresh");
    expect(readStaleness("2026-04-01", today).level).toBe("fresh");
  });

  it("returns warning between 45 and 89 days", () => {
    expect(readStaleness("2026-03-25", today).level).toBe("warning"); // ~50 days
  });

  it("returns critical at 90 days or more", () => {
    expect(readStaleness("2026-02-13", today).level).toBe("critical"); // ~90 days
    expect(readStaleness("2025-12-01", today).level).toBe("critical"); // ~165 days
  });

  it("handles future-dated valuations as fresh with a hint", () => {
    const reading = readStaleness("2026-06-01", today);
    expect(reading.level).toBe("fresh");
    expect(reading.label).toMatch(/future/);
  });

  it("rejects unparseable date strings", () => {
    expect(readStaleness("nonsense", today).level).toBe("no_data");
  });
});

describe("buildInitialGrid", () => {
  const view: ManualAssetValuationView[] = [
    {
      assetId: "ASSET-PROP",
      assetName: "Family Property",
      assetCurrency: "USD",
      latest: {
        id: "VAL-1",
        assetId: "ASSET-PROP",
        valuationDate: "2026-05-01",
        valueNative: "1500000",
        currency: "USD",
        sourceType: "manual",
        sourceId: null,
        notes: "appraisal",
        createdAt: "",
        updatedAt: "",
      },
    },
    {
      assetId: "ASSET-NEW",
      assetName: null,
      assetCurrency: "EUR",
      latest: null,
    },
  ];

  it("turns the backend view into editable rows", () => {
    const rows = buildInitialGrid(view, today);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      assetId: "ASSET-PROP",
      assetName: "Family Property",
      currency: "USD",
      baseline: { value: "1500000", date: "2026-05-01", notes: "appraisal" },
    });
    expect(rows[0]!.staleness.level).toBe("fresh");
  });

  it("falls back to assetId when assetName is null", () => {
    const rows = buildInitialGrid(view, today);
    expect(rows[1]!.assetName).toBe("ASSET-NEW");
  });

  it("primes the draft with today's date for assets without a baseline", () => {
    const rows = buildInitialGrid(view, today);
    expect(rows[1]!.baseline).toBeNull();
    expect(rows[1]!.draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows[1]!.staleness.level).toBe("no_data");
  });
});

const baseRow = (overrides: Partial<GridRow> = {}): GridRow => ({
  assetId: "ASSET-1",
  assetName: "X",
  currency: "USD",
  baseline: { value: "100", date: "2026-05-01", notes: "" },
  draft: { value: "100", date: "2026-05-01", notes: "" },
  staleness: { level: "fresh", days: 13, label: "13d ago" },
  ...overrides,
});

describe("rowHasChange", () => {
  it("returns false when draft equals baseline", () => {
    expect(rowHasChange(baseRow())).toBe(false);
  });

  it("returns true when the value changes", () => {
    expect(rowHasChange(baseRow({ draft: { value: "200", date: "2026-05-01", notes: "" } }))).toBe(
      true,
    );
  });

  it("returns true when the date changes", () => {
    expect(rowHasChange(baseRow({ draft: { value: "100", date: "2026-05-14", notes: "" } }))).toBe(
      true,
    );
  });

  it("returns true for any non-empty draft on a row with no baseline", () => {
    expect(
      rowHasChange(
        baseRow({
          baseline: null,
          draft: { value: "50", date: "2026-05-14", notes: "" },
        }),
      ),
    ).toBe(true);
  });

  it("returns false when draft.value is empty", () => {
    expect(rowHasChange(baseRow({ draft: { value: "  ", date: "2026-05-14", notes: "" } }))).toBe(
      false,
    );
  });
});

describe("isValidDecimal / isValidIsoDate", () => {
  it("accepts canonical Decimal strings", () => {
    expect(isValidDecimal("100")).toBe(true);
    expect(isValidDecimal("100.5")).toBe(true);
    expect(isValidDecimal("-12.34")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidDecimal("")).toBe(false);
    expect(isValidDecimal("abc")).toBe(false);
    expect(isValidDecimal("1,000")).toBe(false);
    expect(isValidDecimal("1.2.3")).toBe(false);
  });

  it("accepts ISO-8601 dates only", () => {
    expect(isValidIsoDate("2026-05-14")).toBe(true);
    expect(isValidIsoDate("14/05/2026")).toBe(false);
    expect(isValidIsoDate("2026/05/14")).toBe(false);
  });
});

describe("collectChanges", () => {
  it("only emits changed rows and trims notes", () => {
    const rows: GridRow[] = [
      baseRow({
        assetId: "A",
        draft: { value: "200", date: "2026-05-14", notes: "  refreshed  " },
      }),
      baseRow({ assetId: "B" }), // unchanged
    ];
    const { changes, errors } = collectChanges(rows);
    expect(errors).toEqual([]);
    expect(changes).toEqual([
      {
        assetId: "A",
        valuationDate: "2026-05-14",
        valueNative: "200",
        currency: "USD",
        notes: "refreshed",
      },
    ]);
  });

  it("records a validation error for an invalid value", () => {
    const rows: GridRow[] = [
      baseRow({
        assetId: "A",
        draft: { value: "abc", date: "2026-05-14", notes: "" },
      }),
    ];
    const { changes, errors } = collectChanges(rows);
    expect(changes).toEqual([]);
    expect(errors).toEqual([
      { assetId: "A", field: "value", message: expect.stringMatching(/valid number/i) },
    ]);
  });

  it("records a validation error for a malformed date", () => {
    const rows: GridRow[] = [
      baseRow({
        assetId: "A",
        draft: { value: "200", date: "14/05/2026", notes: "" },
      }),
    ];
    const { errors } = collectChanges(rows);
    expect(errors).toEqual([
      { assetId: "A", field: "date", message: expect.stringMatching(/YYYY-MM-DD/) },
    ]);
  });

  it("emits nothing when no rows changed", () => {
    const { changes, errors } = collectChanges([baseRow(), baseRow({ assetId: "B" })]);
    expect(changes).toEqual([]);
    expect(errors).toEqual([]);
  });
});
