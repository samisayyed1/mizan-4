import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { DataQualityView } from "./data-quality";
import type { DataQualityReading } from "./data-quality-derive";

function renderView(state: Parameters<typeof DataQualityView>[0]["state"]) {
  return render(
    <MemoryRouter>
      <DataQualityView state={state} />
    </MemoryRouter>,
  );
}

const PENDING = [
  { capability: "document_vault" as const, label: "Doc Vault note" },
  { capability: "extracted_facts_review" as const, label: "Review queue note" },
] as const;

describe("DataQualityView", () => {
  it("renders the loading skeleton", () => {
    renderView({ status: "loading" });
    expect(screen.getByTestId("home-data-quality-loading")).toBeInTheDocument();
  });

  it("renders a human-readable error message", () => {
    renderView({ status: "error", message: "boom" });
    expect(screen.getByTestId("home-data-quality-error").textContent).toMatch(/boom/);
  });

  it("renders an honest neutral state when the score is null (no data to score)", () => {
    const reading: DataQualityReading = {
      score: null,
      severity: "neutral",
      explanation: "Add an account or your first asset to start tracking data quality.",
      deductions: [],
      pendingCapabilities: PENDING,
    };
    renderView({ status: "ready", reading });

    const neutral = screen.getByTestId("home-data-quality-neutral");
    expect(neutral).toBeInTheDocument();
    expect(neutral.textContent).toMatch(/add an account/i);
    // The dashboard must NOT render a fake 100/100 score in the empty state.
    expect(screen.queryByTestId("home-data-quality-score")).not.toBeInTheDocument();
  });

  it("renders the score, pill, and explanation when ready with no deductions", () => {
    const reading: DataQualityReading = {
      score: 100,
      severity: "excellent",
      explanation: "Data is in great shape — everything is up to date.",
      deductions: [],
      pendingCapabilities: PENDING,
    };
    renderView({ status: "ready", reading });

    expect(screen.getByTestId("home-data-quality-score").textContent).toBe("100");
    expect(screen.getByTestId("home-data-quality-pill").textContent).toMatch(/excellent/i);
    expect(screen.getByTestId("home-data-quality-explanation").textContent).toMatch(/great shape/i);
    // No deductions list when there's nothing to deduct.
    expect(screen.queryByTestId("home-data-quality-deductions")).not.toBeInTheDocument();
    // No "View issues" link when there are no deductions.
    expect(screen.queryByTestId("home-data-quality-link")).not.toBeInTheDocument();
  });

  it("renders the top-4 deductions with their routes, sorted as-is", () => {
    const reading: DataQualityReading = {
      score: 70,
      severity: "attention",
      explanation: "A few items need attention. Largest dent: missing fx rates (15 pts off).",
      deductions: [
        {
          category: "FX_INTEGRITY",
          label: "Missing FX rates",
          pointsOff: 15,
          affectedCount: 1,
          severity: "ERROR",
          route: "/health",
        },
        {
          category: "MANUAL_VALUATION_FRESHNESS",
          label: "Manual valuations need refreshing",
          pointsOff: 10,
          affectedCount: 2,
          severity: "WARNING",
          route: "/assets/values",
        },
      ],
      pendingCapabilities: PENDING,
    };
    renderView({ status: "ready", reading });

    expect(screen.getByTestId("home-data-quality-pill").textContent).toMatch(/needs attention/i);
    const fxLink = screen.getByTestId("home-data-quality-deduction-FX_INTEGRITY");
    expect(fxLink).toHaveAttribute("href", "/health");
    expect(fxLink.textContent).toMatch(/Missing FX rates/);
    expect(fxLink.textContent).toMatch(/−15 pts/);

    const stale = screen.getByTestId("home-data-quality-deduction-MANUAL_VALUATION_FRESHNESS");
    expect(stale).toHaveAttribute("href", "/assets/values");

    // The "View issues" link is present when there ARE deductions.
    const view = screen.getByTestId("home-data-quality-link");
    expect(view).toHaveAttribute("href", "/health");
  });

  it("renders the pending-capabilities footnote so the user knows which signals aren't counted yet", () => {
    const reading: DataQualityReading = {
      score: 100,
      severity: "excellent",
      explanation: "Data is in great shape — everything is up to date.",
      deductions: [],
      pendingCapabilities: PENDING,
    };
    renderView({ status: "ready", reading });

    const pending = screen.getByTestId("home-data-quality-pending");
    expect(pending.textContent).toMatch(/Doc Vault note/);
    expect(pending.textContent).toMatch(/Review queue note/);
  });
});
