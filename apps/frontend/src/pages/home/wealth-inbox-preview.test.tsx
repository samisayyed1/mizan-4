import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { HealthIssue } from "@/lib/types";

import { WealthInboxPreviewView } from "./wealth-inbox-preview";

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const sampleIssue = (overrides: Partial<HealthIssue> = {}): HealthIssue =>
  ({
    id: "issue-1",
    severity: "WARNING",
    category: "PRICE_STALENESS",
    title: "Stale market quotes",
    message: "3 quotes haven't refreshed in 7 days.",
    affectedCount: 3,
    ...overrides,
  }) as HealthIssue;

describe("WealthInboxPreviewView", () => {
  it("renders the loading skeleton", () => {
    renderInRouter(<WealthInboxPreviewView state={{ status: "loading" }} />);
    expect(screen.getByTestId("home-inbox-loading")).toBeInTheDocument();
  });

  it("renders an error message", () => {
    renderInRouter(<WealthInboxPreviewView state={{ status: "error", message: "boom" }} />);
    expect(screen.getByTestId("home-inbox-error").textContent).toMatch(/boom/);
  });

  it("renders an honest empty state when there are no health issues", () => {
    renderInRouter(<WealthInboxPreviewView state={{ status: "empty" }} />);
    expect(screen.getByTestId("home-inbox-empty").textContent).toMatch(/inbox is clear/i);
  });

  it("renders the list of issues with severity tags when ready", () => {
    renderInRouter(
      <WealthInboxPreviewView
        state={{
          status: "ready",
          issues: [
            sampleIssue({ id: "a", severity: "CRITICAL", title: "Missing FX" }),
            sampleIssue({ id: "b", severity: "WARNING", title: "Stale quote" }),
          ],
        }}
      />,
    );

    const list = screen.getByTestId("home-inbox-list");
    expect(list.textContent).toMatch(/Missing FX/);
    expect(list.textContent).toMatch(/Stale quote/);
    expect(list.textContent).toMatch(/critical/);
    expect(list.textContent).toMatch(/warning/);
  });

  it("always renders the honest 'pending downstream systems' rows", () => {
    renderInRouter(<WealthInboxPreviewView state={{ status: "empty" }} />);
    const pending = screen.getByTestId("home-inbox-pending");
    expect(pending.textContent).toMatch(/Document Vault/i);
    expect(pending.textContent).toMatch(/Upcoming events/i);
  });

  it("links to the Health page for full triage", () => {
    renderInRouter(<WealthInboxPreviewView state={{ status: "empty" }} />);
    const link = screen.getByRole("link", { name: /open health/i });
    expect(link).toHaveAttribute("href", "/health");
  });
});
