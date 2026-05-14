import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NetWorthSummaryView } from "./net-worth-summary";

describe("NetWorthSummaryView", () => {
  it("renders the loading skeleton when status is loading", () => {
    render(<NetWorthSummaryView state={{ status: "loading" }} />);
    expect(screen.getByTestId("home-net-worth-loading")).toBeInTheDocument();
  });

  it("renders an honest empty state when there is no data yet", () => {
    render(<NetWorthSummaryView state={{ status: "empty" }} />);
    const empty = screen.getByTestId("home-net-worth-empty");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toMatch(/add an account/i);
  });

  it("renders a human-readable error message when status is error", () => {
    render(<NetWorthSummaryView state={{ status: "error", message: "boom" }} />);
    const error = screen.getByTestId("home-net-worth-error");
    expect(error.textContent).toMatch(/boom/);
  });

  it("renders the total, account count, and one-day change when ready", () => {
    render(
      <NetWorthSummaryView
        state={{
          status: "ready",
          slice: {
            total: 250000,
            baseCurrency: "USD",
            accountCount: 3,
            dayChange: 1500,
            dayReturn: 1500 / 248500,
          },
        }}
      />,
    );

    const card = screen.getByTestId("home-net-worth-ready");
    expect(card.textContent).toMatch(/Across 3 accounts/);
    expect(card.textContent).toMatch(/1d change/);
    expect(screen.getByTestId("home-net-worth-day-change")).toBeInTheDocument();
  });

  it("singularises the account count when only one account exists", () => {
    render(
      <NetWorthSummaryView
        state={{
          status: "ready",
          slice: {
            total: 100,
            baseCurrency: "USD",
            accountCount: 1,
            dayChange: null,
            dayReturn: null,
          },
        }}
      />,
    );

    expect(screen.getByTestId("home-net-worth-ready").textContent).toMatch(/Across 1 account\b/);
  });

  it("omits the 1d change suffix when no day change was reported", () => {
    render(
      <NetWorthSummaryView
        state={{
          status: "ready",
          slice: {
            total: 100,
            baseCurrency: "USD",
            accountCount: 1,
            dayChange: null,
            dayReturn: null,
          },
        }}
      />,
    );

    expect(screen.queryByTestId("home-net-worth-day-change")).not.toBeInTheDocument();
  });
});
