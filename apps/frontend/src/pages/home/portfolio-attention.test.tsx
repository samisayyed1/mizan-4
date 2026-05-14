import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { PortfolioAttentionView } from "./portfolio-attention";

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PortfolioAttentionView", () => {
  it("renders the loading skeleton", () => {
    renderInRouter(<PortfolioAttentionView state={{ status: "loading" }} />);
    expect(screen.getByTestId("home-attention-loading")).toBeInTheDocument();
  });

  it("renders an honest empty state when nothing needs attention", () => {
    renderInRouter(<PortfolioAttentionView state={{ status: "empty" }} />);
    expect(screen.getByTestId("home-attention-empty").textContent).toMatch(
      /Everything looks in order/i,
    );
  });

  it("renders a human-readable error message", () => {
    renderInRouter(<PortfolioAttentionView state={{ status: "error", message: "boom" }} />);
    expect(screen.getByTestId("home-attention-error").textContent).toMatch(/boom/);
  });

  it("renders the category rows with affected counts when ready", () => {
    renderInRouter(
      <PortfolioAttentionView
        state={{
          status: "ready",
          rows: [
            {
              category: "PRICE_STALENESS",
              label: "Stale market quotes",
              affectedCount: 3,
              severity: "WARNING",
              route: "/health",
            },
            {
              category: "FX_INTEGRITY",
              label: "Missing FX rates",
              affectedCount: 1,
              severity: "CRITICAL",
              route: "/health",
            },
          ],
        }}
      />,
    );

    const list = screen.getByTestId("home-attention-list");
    expect(list.textContent).toMatch(/Stale market quotes/);
    expect(list.textContent).toMatch(/Missing FX rates/);
    expect(list.textContent).toMatch(/3 affected/);
    expect(list.textContent).toMatch(/1 affected/);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/health"));
  });

  it("renders 'Needs review' instead of zero affected when affectedCount is 0", () => {
    renderInRouter(
      <PortfolioAttentionView
        state={{
          status: "ready",
          rows: [
            {
              category: "CLASSIFICATION",
              label: "Unclassified assets",
              affectedCount: 0,
              severity: "INFO",
              route: "/health",
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("home-attention-list").textContent).toMatch(/Needs review/);
  });
});
