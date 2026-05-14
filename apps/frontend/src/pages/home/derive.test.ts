import { describe, expect, it } from "vitest";

import type { HealthIssue, IncomeSummary } from "@/lib/types";

import {
  deriveAttention,
  deriveIncomeThisMonth,
  deriveNetWorth,
  monthKey,
  pickTopHealthIssues,
} from "./derive";

describe("home/derive", () => {
  describe("monthKey", () => {
    it("formats month numbers as zero-padded YYYY-MM", () => {
      expect(monthKey(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
      expect(monthKey(new Date(Date.UTC(2026, 4, 1)))).toBe("2026-05");
      expect(monthKey(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12");
    });
  });

  describe("deriveNetWorth", () => {
    it("returns null when no metrics are provided", () => {
      expect(deriveNetWorth([])).toBeNull();
    });

    it("returns null when no metric has a baseCurrency (cannot label numbers)", () => {
      expect(
        deriveNetWorth([{ totalValue: 1000, baseCurrency: null, dayGainLossAmount: 10 }]),
      ).toBeNull();
    });

    it("sums totals and day changes across accounts", () => {
      const slice = deriveNetWorth([
        { totalValue: 1000, baseCurrency: "USD", dayGainLossAmount: 10 },
        { totalValue: 2500, baseCurrency: "USD", dayGainLossAmount: -5 },
        { totalValue: 500, baseCurrency: "USD", dayGainLossAmount: null },
      ]);

      expect(slice).not.toBeNull();
      expect(slice!.total).toBe(4000);
      expect(slice!.dayChange).toBe(5);
      expect(slice!.baseCurrency).toBe("USD");
      expect(slice!.accountCount).toBe(3);
      // (5 / (4000 - 5)) — verifies dayReturn is computed against the
      // prior total, not the current total.
      expect(slice!.dayReturn).toBeCloseTo(5 / 3995, 8);
    });

    it("returns dayChange=null when no account reported a day change", () => {
      const slice = deriveNetWorth([
        { totalValue: 1000, baseCurrency: "USD", dayGainLossAmount: null },
        { totalValue: 500, baseCurrency: "USD", dayGainLossAmount: null },
      ]);
      expect(slice!.dayChange).toBeNull();
      expect(slice!.dayReturn).toBeNull();
    });

    it("handles missing totalValue without crashing", () => {
      const slice = deriveNetWorth([
        { totalValue: null, baseCurrency: "USD", dayGainLossAmount: 5 },
        { totalValue: 1000, baseCurrency: "USD", dayGainLossAmount: 5 },
      ]);
      expect(slice!.total).toBe(1000);
      expect(slice!.dayChange).toBe(10);
    });
  });

  describe("deriveIncomeThisMonth", () => {
    const makeSummary = (
      period: string,
      overrides: Partial<IncomeSummary> = {},
    ): IncomeSummary => ({
      period,
      byMonth: {},
      byType: {},
      byAsset: {},
      byCurrency: {},
      byAccount: {},
      totalIncome: 0,
      currency: "USD",
      monthlyAverage: 0,
      yoyGrowth: null,
      ...overrides,
    });

    it("returns null when no summaries are provided", () => {
      expect(deriveIncomeThisMonth([], new Date(Date.UTC(2026, 4, 14)))).toBeNull();
    });

    it("returns a zero slice with empty byType when there is no income this month", () => {
      const summaries = [makeSummary("YTD")];
      const slice = deriveIncomeThisMonth(summaries, new Date(Date.UTC(2026, 4, 14)));
      expect(slice).toEqual({
        total: 0,
        baseCurrency: "USD",
        monthKey: "2026-05",
        byType: [],
      });
    });

    it("pulls the YTD summary's byMonth entry for the current month", () => {
      const summaries = [
        makeSummary("TOTAL", { byMonth: { "2026-05": 999 } }), // should NOT be picked
        makeSummary("YTD", {
          byMonth: { "2026-04": 100, "2026-05": 250 },
          byType: { DIVIDEND: 200, INTEREST: 50 },
        }),
        makeSummary("LAST_YEAR"),
      ];
      const slice = deriveIncomeThisMonth(summaries, new Date(Date.UTC(2026, 4, 14)));
      expect(slice!.total).toBe(250);
      expect(slice!.byType).toEqual([
        { type: "DIVIDEND", amount: 200 },
        { type: "INTEREST", amount: 50 },
      ]);
    });

    it("falls back to the first summary if YTD is missing", () => {
      const summaries = [makeSummary("TOTAL", { byMonth: { "2026-05": 42 }, currency: "EUR" })];
      const slice = deriveIncomeThisMonth(summaries, new Date(Date.UTC(2026, 4, 14)));
      expect(slice!.total).toBe(42);
      expect(slice!.baseCurrency).toBe("EUR");
    });

    it("filters byType to only the income-related Activity types", () => {
      const summaries = [
        makeSummary("YTD", {
          byMonth: { "2026-05": 100 },
          byType: { DIVIDEND: 80, INTEREST: 20, BUY: 9999, FEE: -5 },
        }),
      ];
      const slice = deriveIncomeThisMonth(summaries, new Date(Date.UTC(2026, 4, 14)));
      expect(slice!.byType.map((b) => b.type)).toEqual(["DIVIDEND", "INTEREST"]);
    });
  });

  describe("pickTopHealthIssues", () => {
    const issue = (id: string, severity: HealthIssue["severity"], affectedCount = 1): HealthIssue =>
      ({
        id,
        severity,
        category: "PRICE_STALENESS",
        title: id,
        message: "",
        affectedCount,
      }) as HealthIssue;

    it("orders by severity then by affectedCount, limited to 5 by default", () => {
      const top = pickTopHealthIssues([
        issue("a", "WARNING", 1),
        issue("b", "CRITICAL", 1),
        issue("c", "ERROR", 5),
        issue("d", "CRITICAL", 10),
        issue("e", "INFO", 1),
        issue("f", "WARNING", 50),
      ]);
      expect(top.map((i) => i.id)).toEqual(["d", "b", "c", "f", "a"]);
    });

    it("respects a custom limit", () => {
      const top = pickTopHealthIssues([issue("a", "CRITICAL"), issue("b", "WARNING")], 1);
      expect(top.map((i) => i.id)).toEqual(["a"]);
    });

    it("returns an empty list when no issues are present", () => {
      expect(pickTopHealthIssues([])).toEqual([]);
    });
  });

  describe("deriveAttention", () => {
    const issue = (
      category: HealthIssue["category"],
      severity: HealthIssue["severity"],
      affected: number,
    ): HealthIssue =>
      ({
        id: `${category}-${severity}`,
        severity,
        category,
        title: "",
        message: "",
        affectedCount: affected,
      }) as HealthIssue;

    it("returns no rows when there are no health issues", () => {
      expect(deriveAttention([])).toEqual([]);
    });

    it("aggregates per category and surfaces the most severe severity per bucket", () => {
      const rows = deriveAttention([
        issue("PRICE_STALENESS", "WARNING", 3),
        issue("PRICE_STALENESS", "CRITICAL", 1),
        issue("FX_INTEGRITY", "ERROR", 2),
        issue("CLASSIFICATION", "INFO", 5),
      ]);

      // Sorted by severity then count: critical-priced-stale > error-fx > info-classification
      expect(rows.map((r) => r.category)).toEqual([
        "PRICE_STALENESS",
        "FX_INTEGRITY",
        "CLASSIFICATION",
      ]);
      expect(rows[0]!.affectedCount).toBe(4);
      expect(rows[0]!.severity).toBe("CRITICAL");
    });

    it("renders human-readable labels and routes every row to /health", () => {
      const rows = deriveAttention([issue("FX_INTEGRITY", "WARNING", 1)]);
      expect(rows[0]!.label).toBe("Missing FX rates");
      expect(rows[0]!.route).toBe("/health");
    });
  });
});
