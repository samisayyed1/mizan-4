import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { QUICK_ACTIONS, QuickActionsView } from "./quick-actions";

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("QuickActionsView", () => {
  it("renders all five Quick Actions specified by the build plan", () => {
    renderInRouter(<QuickActionsView />);

    for (const action of QUICK_ACTIONS) {
      expect(screen.getByTestId(`home-quick-action-${action.id}`)).toBeInTheDocument();
    }
    expect(QUICK_ACTIONS.map((a) => a.id)).toEqual([
      "add-asset",
      "update-values",
      "upload-document",
      "generate-report",
      "review-issues",
    ]);
  });

  it("renders routed actions as <a> links pointing at real routes", () => {
    renderInRouter(<QuickActionsView />);

    const addAsset = screen.getByTestId("home-quick-action-add-asset");
    expect(addAsset.tagName).toBe("A");
    expect(addAsset).toHaveAttribute("href", "/assets/new");

    const reviewIssues = screen.getByTestId("home-quick-action-review-issues");
    expect(reviewIssues).toHaveAttribute("href", "/health");
  });

  it("renders pending actions as disabled buttons with an honest reason", () => {
    renderInRouter(<QuickActionsView />);

    const upload = screen.getByTestId("home-quick-action-upload-document");
    expect(upload.tagName).toBe("BUTTON");
    expect(upload).toBeDisabled();
    expect(upload).toHaveAttribute("data-pending", "true");
    expect(upload.textContent).toMatch(/Document Vault/);

    const report = screen.getByTestId("home-quick-action-generate-report");
    expect(report).toBeDisabled();
    expect(report.textContent).toMatch(/Report Builder/);
  });

  it("accepts an explicit actions list (for documentation/testing)", () => {
    renderInRouter(
      <QuickActionsView
        actions={[
          {
            id: "only",
            label: "Just one",
            description: "single",
            icon: ({ className }) => <span className={className}>i</span>,
            route: "/holdings",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("home-quick-action-only")).toHaveAttribute("href", "/holdings");
    expect(screen.queryByTestId("home-quick-action-add-asset")).not.toBeInTheDocument();
  });
});
