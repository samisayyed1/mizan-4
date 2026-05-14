import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// Adapter is mocked so tests never touch the real Tauri or Axum
// backend. Each test installs the implementation it wants.
const createUniversalAssetMock = vi.fn();

vi.mock("@/adapters", async () => {
  const actual = await vi.importActual<typeof import("@/adapters")>("@/adapters");
  return {
    ...actual,
    createUniversalAsset: (...args: unknown[]) => createUniversalAssetMock(...args),
  };
});

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({ data: { baseCurrency: "USD" } }),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, statusLoading: false }),
}));

import AddAssetPage, {
  buildUniversalAssetInput,
  KIND_OPTIONS,
  type WizardKind,
} from "./add-asset-page";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/assets/new"]}>
        <Routes>
          <Route path="/assets/new" element={<AddAssetPage />} />
          <Route path="/holdings" element={<LocationProbe data-testid="redirect-holdings" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe({ "data-testid": testId }: { "data-testid": string }) {
  const loc = useLocation();
  return <div data-testid={testId}>{loc.pathname}</div>;
}

// ---------------------------------------------------------------------------
// Pure logic — buildUniversalAssetInput.
// ---------------------------------------------------------------------------

describe("buildUniversalAssetInput", () => {
  const baseValues = {
    name: "My Asset",
    currency: "usd",
    initialValue: "1000",
    notes: "",
  };

  it("uppercases currency and ticker for public_equity", () => {
    const input = buildUniversalAssetInput("public_equity", {
      ...baseValues,
      ticker: "vti",
      securityType: "ETF",
      exchangeMic: "",
      isin: "",
    });
    expect(input).toMatchObject({
      kind: "public_equity",
      base: { name: "My Asset", currency: "USD", initialValue: "1000" },
      fields: { securityType: "ETF", ticker: "VTI" },
    });
  });

  it("includes maturity + sukuk flag for fixed_income", () => {
    const input = buildUniversalAssetInput("fixed_income", {
      ...baseValues,
      instrumentType: "SUKUK",
      maturityDate: "2030-06-01",
      issuer: "Sample",
      couponOrProfitRate: "0.045",
      faceValue: "1000",
      isSukuk: true,
    });
    if (input.kind !== "fixed_income") throw new Error("kind narrowing");
    expect(input.fields.maturityDate).toBe("2030-06-01");
    expect(input.fields.isSukuk).toBe(true);
    expect(input.fields.instrumentType).toBe("SUKUK");
  });

  it("routes fixed_deposit_or_cash → cash when isFixedDeposit is false", () => {
    const input = buildUniversalAssetInput("fixed_deposit_or_cash", {
      ...baseValues,
      isFixedDeposit: false,
      maturityDate: "",
      issuer: "",
      couponOrProfitRate: "",
    });
    expect(input.kind).toBe("cash");
  });

  it("routes fixed_deposit_or_cash → fixed_income(FIXED_DEPOSIT) when checked", () => {
    const input = buildUniversalAssetInput("fixed_deposit_or_cash", {
      ...baseValues,
      isFixedDeposit: true,
      maturityDate: "2026-12-31",
      issuer: "Bank A",
      couponOrProfitRate: "0.04",
    });
    if (input.kind !== "fixed_income") throw new Error("expected fixed_income");
    expect(input.fields.instrumentType).toBe("FIXED_DEPOSIT");
    expect(input.fields.maturityDate).toBe("2026-12-31");
  });

  it("routes business_or_other → private_investment(BUSINESS_OWNERSHIP)", () => {
    const input = buildUniversalAssetInput("business_or_other", {
      ...baseValues,
      details: "Solo consultancy",
    });
    if (input.kind !== "private_investment") throw new Error("kind narrowing");
    expect(input.fields.investmentKind).toBe("BUSINESS_OWNERSHIP");
    expect(input.base.notes).toBe("Solo consultancy");
  });

  it("emits the liability tag union shape", () => {
    const input = buildUniversalAssetInput("liability", {
      ...baseValues,
      liabilityType: "MORTGAGE",
      lender: "Bank",
      interestRate: "0.0425",
    });
    if (input.kind !== "liability") throw new Error("kind narrowing");
    expect(input.fields.liabilityType).toBe("MORTGAGE");
    expect(input.fields.lender).toBe("Bank");
  });
});

// ---------------------------------------------------------------------------
// Step 1 — type picker.
// ---------------------------------------------------------------------------

describe("AddAssetPage — type picker", () => {
  it("shows all 10 asset type tiles", () => {
    createUniversalAssetMock.mockReset();
    renderPage();
    expect(KIND_OPTIONS).toHaveLength(10);
    for (const opt of KIND_OPTIONS) {
      expect(screen.getByTestId(`add-asset-pick-${opt.key}`)).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Step 2 — each kind renders correct required fields.
// ---------------------------------------------------------------------------

interface PerKindExpectation {
  kind: WizardKind;
  shouldShow: string[];
}

const EXPECTED_FIELDS: PerKindExpectation[] = [
  { kind: "public_equity", shouldShow: ["field-ticker", "field-securityType"] },
  { kind: "fixed_income", shouldShow: ["field-instrumentType", "field-maturityDate"] },
  { kind: "fixed_deposit_or_cash", shouldShow: ["field-isFixedDeposit"] },
  { kind: "real_estate", shouldShow: ["field-propertyType"] },
  { kind: "private_investment", shouldShow: ["field-investmentKind"] },
  { kind: "commodity", shouldShow: ["field-commodityType"] },
  { kind: "crypto", shouldShow: ["field-ticker"] },
  { kind: "insurance", shouldShow: ["field-productKind"] },
  { kind: "business_or_other", shouldShow: [] },
  { kind: "liability", shouldShow: ["field-liabilityType"] },
];

describe.each(EXPECTED_FIELDS)("AddAssetPage — $kind required fields", ({ kind, shouldShow }) => {
  it(`renders the type-specific required fields for ${kind}`, async () => {
    createUniversalAssetMock.mockReset();
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId(`add-asset-pick-${kind}`));

    // Shared required fields.
    expect(screen.getByTestId("field-name")).toBeInTheDocument();
    expect(screen.getByTestId("field-currency")).toBeInTheDocument();
    expect(screen.getByTestId("field-initialValue")).toBeInTheDocument();
    for (const id of shouldShow) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Validation blocks invalid submissions; save calls backend and redirects.
// ---------------------------------------------------------------------------

describe("AddAssetPage — validation and save", () => {
  it("blocks submit and shows errors when required fields are empty", async () => {
    createUniversalAssetMock.mockReset();
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-asset-pick-public_equity"));
    await user.click(screen.getByTestId("add-asset-submit"));

    await waitFor(() => expect(screen.getByText(/name is required/i)).toBeInTheDocument());
    expect(createUniversalAssetMock).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric initialValue", async () => {
    createUniversalAssetMock.mockReset();
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-asset-pick-crypto"));

    await user.type(screen.getByTestId("field-name"), "My Bitcoin");
    await user.type(screen.getByTestId("field-ticker"), "btc");
    await user.type(screen.getByTestId("field-initialValue"), "abc");
    await user.click(screen.getByTestId("add-asset-submit"));

    await waitFor(() => expect(screen.getByText(/positive number/i)).toBeInTheDocument());
    expect(createUniversalAssetMock).not.toHaveBeenCalled();
  });

  it("calls createUniversalAsset and redirects to /holdings on success", async () => {
    createUniversalAssetMock.mockReset();
    createUniversalAssetMock.mockResolvedValue({
      asset: { id: "ASSET-1", kind: "INVESTMENT" },
      createdExtension: false,
      createdInitialValuation: true,
    });

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-asset-pick-crypto"));

    await user.type(screen.getByTestId("field-name"), "Bitcoin Stack");
    await user.type(screen.getByTestId("field-ticker"), "btc");
    await user.type(screen.getByTestId("field-initialValue"), "1000");
    await user.click(screen.getByTestId("add-asset-submit"));

    await waitFor(() => expect(createUniversalAssetMock).toHaveBeenCalledTimes(1));
    const [call] = createUniversalAssetMock.mock.calls;
    expect(call[0]).toMatchObject({
      kind: "crypto",
      base: { name: "Bitcoin Stack", currency: "USD", initialValue: "1000" },
      ticker: "BTC",
    });
    await waitFor(() => expect(screen.getByTestId("redirect-holdings")).toBeInTheDocument());
  });

  it("surfaces a backend error without redirecting", async () => {
    createUniversalAssetMock.mockReset();
    createUniversalAssetMock.mockRejectedValue(new Error("network down"));

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("add-asset-pick-crypto"));

    await user.type(screen.getByTestId("field-name"), "X");
    await user.type(screen.getByTestId("field-ticker"), "eth");
    await user.type(screen.getByTestId("field-initialValue"), "100");
    await user.click(screen.getByTestId("add-asset-submit"));

    await waitFor(() => expect(createUniversalAssetMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("add-asset-save-error").textContent).toMatch(/network down/),
    );
    expect(screen.queryByTestId("redirect-holdings")).not.toBeInTheDocument();
  });
});
