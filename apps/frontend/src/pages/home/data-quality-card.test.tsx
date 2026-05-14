import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { DataQualityScore } from "@/lib/types";

import { DataQualityCardView } from "./data-quality-card";

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const READY_SCORE: DataQualityScore = {
  score: 82,
  severity: "WARNING",
  explanation: "A few data quality items may affect portfolio confidence.",
  checkedAt: "2026-05-14T00:00:00Z",
  isOnboarding: false,
  deductions: [
    {
      component: "MISSING_FX",
      label: "Missing FX rates",
      points: 12,
      severity: "ERROR",
      clickTarget: "/health",
      affectedCount: 2,
      explanation: "Some currency pairs need current exchange rates.",
    },
  ],
};

describe("DataQualityCardView", () => {
  it("renders the loading state", () => {
    renderInRouter(<DataQualityCardView state={{ status: "loading" }} />);
    expect(screen.getByTestId("home-data-quality-loading")).toBeInTheDocument();
  });

  it("renders the neutral onboarding state without a fake score", () => {
    renderInRouter(
      <DataQualityCardView
        state={{
          status: "empty",
          explanation: "Add portfolio data to calculate a data quality score.",
        }}
      />,
    );

    expect(screen.getByTestId("home-data-quality-empty").textContent).toMatch(/Add portfolio data/);
    expect(screen.queryByText("out of 100")).not.toBeInTheDocument();
  });

  it("renders an error state", () => {
    renderInRouter(<DataQualityCardView state={{ status: "error", message: "boom" }} />);
    expect(screen.getByTestId("home-data-quality-error").textContent).toMatch(/boom/);
  });

  it("renders the score and click-through deductions", () => {
    renderInRouter(<DataQualityCardView state={{ status: "ready", score: READY_SCORE }} />);

    expect(screen.getByTestId("home-data-quality-ready").textContent).toMatch(/82/);
    expect(screen.getByTestId("home-data-quality-deductions").textContent).toMatch(
      /Missing FX rates/,
    );
    expect(screen.getByRole("link", { name: /Missing FX rates/i })).toHaveAttribute(
      "href",
      "/health",
    );
  });
});
