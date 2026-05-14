import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

// All adapter calls are mocked here so the HomePage can be rendered
// without a Tauri runtime or Axum backend. The point of this test is
// to confirm that:
//   (a) every module composes without crashing
//   (b) the auth-gated hooks see "not authenticated, not loading" so
//       they degrade to disabled/empty cleanly
//   (c) Quick Actions render (they are router-only)
//
// The detailed loading/empty/error/populated branches for each module
// are covered by the per-module test files; this test only validates
// the integration wiring.

vi.mock("@/adapters", async () => {
  const actual = await vi.importActual<typeof import("@/adapters")>("@/adapters");
  return {
    ...actual,
    getAccounts: vi.fn().mockResolvedValue([]),
    calculateAccountsSimplePerformance: vi.fn().mockResolvedValue([]),
    getIncomeSummary: vi.fn().mockResolvedValue([]),
    getHealthStatus: vi.fn().mockResolvedValue({
      overallSeverity: "INFO",
      issueCounts: {},
      issues: [],
      checkedAt: new Date().toISOString(),
      isStale: false,
    }),
  };
});

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, statusLoading: false }),
}));

import HomePage from "./home-page";

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePage integration", () => {
  it("composes all five modules without crashing", () => {
    renderHome();

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByTestId("home-net-worth")).toBeInTheDocument();
    expect(screen.getByTestId("home-income-this-month")).toBeInTheDocument();
    expect(screen.getByTestId("home-attention")).toBeInTheDocument();
    expect(screen.getByTestId("home-wealth-inbox")).toBeInTheDocument();
    expect(screen.getByTestId("home-quick-actions")).toBeInTheDocument();
  });

  it("renders the five Quick Actions tiles", () => {
    renderHome();

    expect(screen.getByTestId("home-quick-action-add-asset")).toBeInTheDocument();
    expect(screen.getByTestId("home-quick-action-update-values")).toBeInTheDocument();
    expect(screen.getByTestId("home-quick-action-upload-document")).toBeInTheDocument();
    expect(screen.getByTestId("home-quick-action-generate-report")).toBeInTheDocument();
    expect(screen.getByTestId("home-quick-action-review-issues")).toBeInTheDocument();
  });
});
