import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { ManualAssetValuationView } from "@/adapters";

// Adapter mocks — we want to drive the container without ever hitting
// Tauri or Axum. Each test sets the resolution it needs.
const listManualValuationAssetsMock = vi.fn();
const bulkUpdateValuationsMock = vi.fn();

vi.mock("@/adapters", async () => {
  const actual = await vi.importActual<typeof import("@/adapters")>("@/adapters");
  return {
    ...actual,
    listManualValuationAssets: () => listManualValuationAssetsMock(),
    bulkUpdateValuations: (rows: unknown) => bulkUpdateValuationsMock(rows),
  };
});

import BulkUpdatePage, { BulkUpdateView } from "./bulk-update-page";
import type { GridRow } from "./derive";

// ---------------------------------------------------------------------------
// Pure view tests — no QueryClient or router needed.
// ---------------------------------------------------------------------------

const makeRow = (overrides: Partial<GridRow> = {}): GridRow => ({
  assetId: "ASSET-1",
  assetName: "Family Property",
  currency: "USD",
  baseline: { value: "1500000", date: "2026-05-01", notes: "appraisal" },
  draft: { value: "1500000", date: "2026-05-01", notes: "appraisal" },
  staleness: { level: "fresh", days: 13, label: "13d ago" },
  ...overrides,
});

describe("BulkUpdateView", () => {
  const noopHandlers = {
    onCellEdit: () => {},
    onMarkUnchanged: () => {},
    onSave: () => {},
  };

  // The view's header always renders a <Link> to /assets/new, so every
  // test needs Router context.
  function renderView(ui: React.ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  }

  it("renders the loading skeleton", () => {
    renderView(
      <BulkUpdateView
        state={{ status: "loading" }}
        saving={false}
        saveError={null}
        saveSummary={null}
        validationErrors={[]}
        {...noopHandlers}
      />,
    );
    expect(screen.getByTestId("bulk-update-loading")).toBeInTheDocument();
  });

  it("renders an error message", () => {
    renderView(
      <BulkUpdateView
        state={{ status: "error", message: "boom" }}
        saving={false}
        saveError={null}
        saveSummary={null}
        validationErrors={[]}
        {...noopHandlers}
      />,
    );
    expect(screen.getByTestId("bulk-update-error").textContent).toMatch(/boom/);
  });

  it("renders an honest empty state with a link to /assets/new", () => {
    render(
      <MemoryRouter>
        <BulkUpdateView
          state={{ status: "empty" }}
          saving={false}
          saveError={null}
          saveSummary={null}
          validationErrors={[]}
          {...noopHandlers}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("bulk-update-empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add asset/i })).toHaveAttribute("href", "/assets/new");
  });

  it("renders one editable row per asset with the staleness pill", () => {
    render(
      <MemoryRouter>
        <BulkUpdateView
          state={{
            status: "ready",
            rows: [
              makeRow(),
              makeRow({
                assetId: "ASSET-2",
                assetName: "Old Gold",
                staleness: { level: "critical", days: 120, label: "120d ago — stale" },
              }),
            ],
          }}
          saving={false}
          saveError={null}
          saveSummary={null}
          validationErrors={[]}
          {...noopHandlers}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("bulk-row-ASSET-1")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-row-ASSET-2")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-row-ASSET-1-staleness").textContent).toMatch(/Fresh/i);
    expect(screen.getByTestId("bulk-row-ASSET-2-staleness").textContent).toMatch(/Critical/i);
  });

  it("surfaces a row-scoped validation error inline", () => {
    render(
      <MemoryRouter>
        <BulkUpdateView
          state={{ status: "ready", rows: [makeRow()] }}
          saving={false}
          saveError={null}
          saveSummary={null}
          validationErrors={[
            {
              assetId: "ASSET-1",
              field: "value",
              message: "Enter a valid number.",
            },
          ]}
          {...noopHandlers}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("bulk-row-ASSET-1-error").textContent).toMatch(
      /enter a valid number/i,
    );
  });

  it("disables Save while a save is in-flight", () => {
    render(
      <MemoryRouter>
        <BulkUpdateView
          state={{ status: "ready", rows: [makeRow()] }}
          saving
          saveError={null}
          saveSummary={null}
          validationErrors={[]}
          {...noopHandlers}
        />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId("bulk-save") as HTMLButtonElement;
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/saving/i);
  });

  it("shows the save summary on success", () => {
    render(
      <MemoryRouter>
        <BulkUpdateView
          state={{ status: "ready", rows: [makeRow()] }}
          saving={false}
          saveError={null}
          saveSummary={{ written: 3 }}
          validationErrors={[]}
          {...noopHandlers}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("bulk-save-summary").textContent).toMatch(/3 valuations/);
  });

  it("shows a backend error on save failure", () => {
    render(
      <MemoryRouter>
        <BulkUpdateView
          state={{ status: "ready", rows: [makeRow()] }}
          saving={false}
          saveError="batch rolled back"
          saveSummary={null}
          validationErrors={[]}
          {...noopHandlers}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("bulk-save-error").textContent).toMatch(/rolled back/);
  });
});

// ---------------------------------------------------------------------------
// Container integration — exercises hooks + mocked adapters.
// ---------------------------------------------------------------------------

function renderContainer() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BulkUpdatePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SAMPLE_VIEW: ManualAssetValuationView[] = [
  {
    assetId: "ASSET-PROP",
    assetName: "Family Property",
    assetCurrency: "USD",
    latest: {
      id: "VAL-1",
      assetId: "ASSET-PROP",
      valuationDate: "2026-05-01",
      valueNative: "1500000",
      currency: "USD",
      sourceType: "manual",
      sourceId: null,
      notes: "appraisal",
      createdAt: "",
      updatedAt: "",
    },
  },
];

describe("BulkUpdatePage container", () => {
  it("only sends edited rows on save and shows the success summary", async () => {
    listManualValuationAssetsMock.mockReset();
    bulkUpdateValuationsMock.mockReset();
    listManualValuationAssetsMock.mockResolvedValue(SAMPLE_VIEW);
    bulkUpdateValuationsMock.mockResolvedValue({ written: 1, rows: [] });

    renderContainer();
    await waitFor(() => expect(screen.getByTestId("bulk-row-ASSET-PROP")).toBeInTheDocument());

    const valueField = screen.getByTestId("bulk-row-ASSET-PROP-value") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(valueField);
    await user.type(valueField, "1600000");
    await user.click(screen.getByTestId("bulk-save"));

    await waitFor(() => expect(bulkUpdateValuationsMock).toHaveBeenCalledTimes(1));
    expect(bulkUpdateValuationsMock.mock.calls[0]![0]).toEqual([
      expect.objectContaining({
        assetId: "ASSET-PROP",
        valueNative: "1600000",
        currency: "USD",
      }),
    ]);
    await waitFor(() =>
      expect(screen.getByTestId("bulk-save-summary").textContent).toMatch(/1 valuation/),
    );
  });

  it("blocks the save and surfaces a row-scoped error for an invalid value", async () => {
    listManualValuationAssetsMock.mockReset();
    bulkUpdateValuationsMock.mockReset();
    listManualValuationAssetsMock.mockResolvedValue(SAMPLE_VIEW);

    renderContainer();
    await waitFor(() => expect(screen.getByTestId("bulk-row-ASSET-PROP")).toBeInTheDocument());

    const valueField = screen.getByTestId("bulk-row-ASSET-PROP-value") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(valueField);
    await user.type(valueField, "not a number");
    await user.click(screen.getByTestId("bulk-save"));

    await waitFor(() =>
      expect(screen.getByTestId("bulk-row-ASSET-PROP-error")).toBeInTheDocument(),
    );
    expect(bulkUpdateValuationsMock).not.toHaveBeenCalled();
  });

  it("revert via 'Mark unchanged' drops the row from the save batch", async () => {
    listManualValuationAssetsMock.mockReset();
    bulkUpdateValuationsMock.mockReset();
    listManualValuationAssetsMock.mockResolvedValue(SAMPLE_VIEW);
    bulkUpdateValuationsMock.mockResolvedValue({ written: 0, rows: [] });

    renderContainer();
    await waitFor(() => expect(screen.getByTestId("bulk-row-ASSET-PROP")).toBeInTheDocument());

    const valueField = screen.getByTestId("bulk-row-ASSET-PROP-value") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(valueField);
    await user.type(valueField, "1700000");
    await user.click(screen.getByTestId("bulk-row-ASSET-PROP-unchanged"));
    await user.click(screen.getByTestId("bulk-save"));

    await waitFor(() => expect(bulkUpdateValuationsMock).toHaveBeenCalledTimes(1));
    // Empty batch — no rows changed after revert.
    expect(bulkUpdateValuationsMock.mock.calls[0]![0]).toEqual([]);
  });

  it("renders an empty state when there are no manual assets", async () => {
    listManualValuationAssetsMock.mockReset();
    listManualValuationAssetsMock.mockResolvedValue([]);
    renderContainer();
    await waitFor(() => expect(screen.getByTestId("bulk-update-empty")).toBeInTheDocument());
  });

  it("surfaces a backend error without crashing", async () => {
    listManualValuationAssetsMock.mockReset();
    listManualValuationAssetsMock.mockRejectedValue(new Error("network down"));
    renderContainer();
    await waitFor(() =>
      expect(screen.getByTestId("bulk-update-error").textContent).toMatch(/network down/),
    );
  });
});
