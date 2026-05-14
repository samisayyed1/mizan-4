import { describe, expect, it } from "vitest";

import type { ManualAssetValuationView } from "@/adapters";
import type { HealthIssue, HealthStatus } from "@/lib/types";

import { calculateDataQuality, mapHealthCategory, severityForScore } from "./data-quality-derive";

const today = new Date(Date.UTC(2026, 4, 14)); // 2026-05-14

const issue = (
  category: HealthIssue["category"],
  severity: HealthIssue["severity"],
  affected = 1,
): HealthIssue =>
  ({
    id: `${category}-${severity}`,
    severity,
    category,
    title: "",
    message: "",
    affectedCount: affected,
  }) as HealthIssue;

const health = (issues: HealthIssue[]): HealthStatus =>
  ({
    overallSeverity: "INFO",
    issueCounts: {},
    issues,
    checkedAt: today.toISOString(),
    isStale: false,
  }) as HealthStatus;

const manualAsset = (id: string, latestDate: string | null): ManualAssetValuationView => ({
  assetId: id,
  assetName: id,
  assetCurrency: "USD",
  latest: latestDate
    ? {
        id: `${id}-v`,
        assetId: id,
        valuationDate: latestDate,
        valueNative: "100",
        currency: "USD",
        sourceType: "manual",
        sourceId: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      }
    : null,
});

// ---------------------------------------------------------------------------
// Onboarding / neutral state
// ---------------------------------------------------------------------------

describe("calculateDataQuality — onboarding / neutral", () => {
  it("returns score=null with neutral severity when there is no data to score", () => {
    const r = calculateDataQuality({
      health: undefined,
      manualAssets: undefined,
      today,
    });
    expect(r.score).toBeNull();
    expect(r.severity).toBe("neutral");
    expect(r.deductions).toEqual([]);
    expect(r.explanation).toMatch(/add an account or your first asset/i);
  });

  it("still scores when only health data is available (no manual assets)", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: undefined,
      today,
    });
    expect(r.score).toBe(100);
    expect(r.severity).toBe("excellent");
  });

  it("still scores when only manual assets are available (no health data)", () => {
    const r = calculateDataQuality({
      health: undefined,
      manualAssets: [manualAsset("a", "2026-05-13")], // fresh
      today,
    });
    expect(r.score).toBe(100);
    expect(r.severity).toBe("excellent");
  });
});

// ---------------------------------------------------------------------------
// Perfect / no issues
// ---------------------------------------------------------------------------

describe("calculateDataQuality — perfect data", () => {
  it("returns score=100 with severity=excellent when no health issues and all manual assets fresh", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: [manualAsset("a", "2026-05-10"), manualAsset("b", "2026-04-30")],
      today,
    });
    expect(r.score).toBe(100);
    expect(r.severity).toBe("excellent");
    expect(r.deductions).toEqual([]);
    expect(r.explanation).toMatch(/in great shape/i);
  });
});

// ---------------------------------------------------------------------------
// Manual valuation freshness
// ---------------------------------------------------------------------------

describe("calculateDataQuality — manual valuation freshness", () => {
  it("deducts 3 points per warning-aged manual valuation (45-89d)", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: [manualAsset("a", "2026-03-25")], // ~50 days
      today,
    });
    expect(r.score).toBe(97);
    expect(r.deductions).toHaveLength(1);
    expect(r.deductions[0]!.category).toBe("MANUAL_VALUATION_FRESHNESS");
    expect(r.deductions[0]!.pointsOff).toBe(3);
    expect(r.deductions[0]!.severity).toBe("WARNING");
  });

  it("deducts 8 points per critically stale manual valuation (>= 90d)", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: [manualAsset("a", "2026-02-01")], // ~102 days
      today,
    });
    expect(r.score).toBe(92);
    expect(r.deductions[0]!.severity).toBe("CRITICAL");
    expect(r.severity).toBe("critical"); // any critical bubbles up
  });

  it("deducts 5 points per manual asset that has no valuation row yet", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: [manualAsset("a", null), manualAsset("b", null)],
      today,
    });
    expect(r.score).toBe(90);
    expect(r.deductions[0]!.pointsOff).toBe(10); // 2 × 5
    expect(r.deductions[0]!.affectedCount).toBe(2);
  });

  it("routes manual-valuation deductions to /assets/values, not /health", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: [manualAsset("a", "2025-09-01")],
      today,
    });
    expect(r.deductions[0]!.route).toBe("/assets/values");
  });
});

// ---------------------------------------------------------------------------
// Health-category deductions
// ---------------------------------------------------------------------------

describe("calculateDataQuality — health categories", () => {
  it("deducts 5 points for a single WARNING price-staleness issue", () => {
    const r = calculateDataQuality({
      health: health([issue("PRICE_STALENESS", "WARNING")]),
      manualAssets: [],
      today,
    });
    expect(r.score).toBe(95);
    expect(r.deductions[0]!.category).toBe("PRICE_STALENESS");
    expect(r.deductions[0]!.pointsOff).toBe(5);
  });

  it("deducts 20 points for a single CRITICAL missing-FX issue", () => {
    const r = calculateDataQuality({
      health: health([issue("FX_INTEGRITY", "CRITICAL")]),
      manualAssets: [],
      today,
    });
    expect(r.score).toBe(80);
    expect(r.deductions[0]!.category).toBe("FX_INTEGRITY");
    expect(r.deductions[0]!.severity).toBe("CRITICAL");
    expect(r.severity).toBe("critical");
  });

  it("aggregates multiple issues in the same category into one deduction", () => {
    const r = calculateDataQuality({
      health: health([
        issue("PRICE_STALENESS", "WARNING", 1),
        issue("PRICE_STALENESS", "ERROR", 1),
      ]),
      manualAssets: [],
      today,
    });
    expect(r.deductions).toHaveLength(1);
    expect(r.deductions[0]!.pointsOff).toBe(15); // 5 + 10
    expect(r.deductions[0]!.severity).toBe("ERROR"); // more severe wins
    expect(r.deductions[0]!.affectedCount).toBe(2);
  });

  it("orders deductions by pointsOff descending so the biggest dent is first", () => {
    const r = calculateDataQuality({
      health: health([
        issue("CLASSIFICATION", "INFO"), // 1 pt
        issue("FX_INTEGRITY", "CRITICAL"), // 20 pts
        issue("PRICE_STALENESS", "WARNING"), // 5 pts
      ]),
      manualAssets: [],
      today,
    });
    expect(r.deductions.map((d) => d.category)).toEqual([
      "FX_INTEGRITY",
      "PRICE_STALENESS",
      "CLASSIFICATION",
    ]);
  });

  it("floors the score at 0 — never negative even with many issues", () => {
    const issues = Array.from({ length: 20 }, () => issue("FX_INTEGRITY", "CRITICAL"));
    const r = calculateDataQuality({
      health: health(issues),
      manualAssets: [],
      today,
    });
    expect(r.score).toBe(0);
    expect(r.severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// Pending capabilities — honest disclosure of unimplemented signals
// ---------------------------------------------------------------------------

describe("calculateDataQuality — pending capabilities", () => {
  it("lists Document Vault and review-queue as pending in every non-neutral reading", () => {
    const r = calculateDataQuality({
      health: health([]),
      manualAssets: [manualAsset("a", "2026-05-13")],
      today,
    });
    expect(r.pendingCapabilities.map((c) => c.capability)).toEqual([
      "document_vault",
      "extracted_facts_review",
    ]);
  });

  it("still lists pending capabilities in the neutral onboarding state", () => {
    const r = calculateDataQuality({
      health: undefined,
      manualAssets: undefined,
      today,
    });
    expect(r.pendingCapabilities.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("severityForScore", () => {
  it("treats any deduction with CRITICAL severity as critical regardless of score", () => {
    expect(
      severityForScore(98, [
        {
          category: "FX_INTEGRITY",
          label: "x",
          pointsOff: 2,
          affectedCount: 1,
          severity: "CRITICAL",
          route: "/health",
        },
      ]),
    ).toBe("critical");
  });

  it("buckets by score otherwise: 95+=excellent, 80+=good, 60+=attention, <60=critical", () => {
    expect(severityForScore(100, [])).toBe("excellent");
    expect(severityForScore(85, [])).toBe("good");
    expect(severityForScore(70, [])).toBe("attention");
    expect(severityForScore(40, [])).toBe("critical");
  });
});

describe("mapHealthCategory", () => {
  it("maps every known HealthCategory to a DataQualityCategory", () => {
    expect(mapHealthCategory(issue("PRICE_STALENESS", "INFO"))).toBe("PRICE_STALENESS");
    expect(mapHealthCategory(issue("FX_INTEGRITY", "INFO"))).toBe("FX_INTEGRITY");
    expect(mapHealthCategory(issue("CLASSIFICATION", "INFO"))).toBe("CLASSIFICATION");
    expect(mapHealthCategory(issue("DATA_CONSISTENCY", "INFO"))).toBe("DATA_CONSISTENCY");
    expect(mapHealthCategory(issue("ACCOUNT_CONFIGURATION", "INFO"))).toBe("ACCOUNT_CONFIGURATION");
    expect(mapHealthCategory(issue("SETTINGS_CONFIGURATION", "INFO"))).toBe(
      "SETTINGS_CONFIGURATION",
    );
  });
});
