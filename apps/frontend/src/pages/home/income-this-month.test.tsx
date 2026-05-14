import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IncomeThisMonthView } from "./income-this-month";

describe("IncomeThisMonthView", () => {
  it("renders the loading skeleton when status is loading", () => {
    render(<IncomeThisMonthView state={{ status: "loading" }} />);
    expect(screen.getByTestId("home-income-loading")).toBeInTheDocument();
  });

  it("renders an honest empty state when no income was booked this month", () => {
    render(
      <IncomeThisMonthView state={{ status: "empty", baseCurrency: "USD", monthKey: "2026-05" }} />,
    );
    const empty = screen.getByTestId("home-income-empty");
    expect(empty.textContent).toMatch(/no dividends, interest, or coupons/i);
  });

  it("renders a human-readable error message", () => {
    render(<IncomeThisMonthView state={{ status: "error", message: "boom" }} />);
    expect(screen.getByTestId("home-income-error").textContent).toMatch(/boom/);
  });

  it("renders the total and YTD type breakdown when ready", () => {
    render(
      <IncomeThisMonthView
        state={{
          status: "ready",
          slice: {
            total: 1234.56,
            baseCurrency: "USD",
            monthKey: "2026-05",
            byType: [
              { type: "DIVIDEND", amount: 1000 },
              { type: "INTEREST", amount: 234.56 },
            ],
          },
        }}
      />,
    );

    expect(screen.getByTestId("home-income-ready")).toBeInTheDocument();
    const byType = screen.getByTestId("home-income-by-type");
    expect(byType.textContent).toMatch(/Dividends/);
    expect(byType.textContent).toMatch(/Interest/);
  });

  it("renders the month label derived from monthKey", () => {
    render(
      <IncomeThisMonthView
        state={{
          status: "ready",
          slice: {
            total: 100,
            baseCurrency: "USD",
            monthKey: "2026-05",
            byType: [],
          },
        }}
      />,
    );

    // "May 2026" — locale-independent format via toLocaleDateString("en-US", ...)
    expect(screen.getByTestId("home-income-this-month").textContent).toMatch(/May 2026/);
  });

  it("omits the byType list when total is zero (no income to attribute)", () => {
    render(
      <IncomeThisMonthView
        state={{
          status: "ready",
          slice: {
            total: 0,
            baseCurrency: "USD",
            monthKey: "2026-05",
            byType: [{ type: "DIVIDEND", amount: 0 }],
          },
        }}
      />,
    );

    expect(screen.queryByTestId("home-income-by-type")).not.toBeInTheDocument();
  });
});
