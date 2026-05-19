import { describe, expect, it } from "vitest";
import {
  AssetClass,
  ASSET_CLASS_ORDER,
  classifyHolding,
  groupHoldingsByAssetClass,
  parseAssetClassParam,
} from "./asset-classes";
import { AssetKind, HoldingType, QuoteMode } from "./constants";
import type { AssetClassifications, Holding, Instrument, TaxonomyCategory } from "./types";

// ---------------------------------------------------------------------------
// Test factories — keep the per-test boilerplate small
// ---------------------------------------------------------------------------

function makeTaxonomyCategory(over: Partial<TaxonomyCategory> = {}): TaxonomyCategory {
  return {
    id: over.id ?? "cat-1",
    taxonomyId: over.taxonomyId ?? "tax-asset-type",
    parentId: over.parentId ?? null,
    name: over.name ?? "Stocks",
    key: over.key ?? "stocks",
    color: over.color ?? "#000",
    description: over.description ?? null,
    sortOrder: over.sortOrder ?? 0,
    createdAt: over.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: over.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

function makeClassifications(over: Partial<AssetClassifications> = {}): AssetClassifications {
  return {
    assetType: over.assetType ?? null,
    riskCategory: over.riskCategory ?? null,
    assetClasses: over.assetClasses ?? [],
    sectors: over.sectors ?? [],
    regions: over.regions ?? [],
    customGroups: over.customGroups ?? [],
  };
}

function makeInstrument(over: Partial<Instrument> = {}): Instrument {
  return {
    id: over.id ?? "inst-1",
    symbol: over.symbol ?? "TEST",
    name: over.name ?? "Test Instrument",
    currency: over.currency ?? "USD",
    notes: over.notes ?? null,
    quoteMode: over.quoteMode ?? QuoteMode.MARKET,
    preferredProvider: over.preferredProvider ?? null,
    classifications: over.classifications ?? null,
  };
}

function makeHolding(over: Partial<Holding> = {}): Holding {
  return {
    id: over.id ?? "h-1",
    holdingType: over.holdingType ?? HoldingType.SECURITY,
    accountId: over.accountId ?? "acc-1",
    // `instrument` and `assetKind` need explicit `in` checks because
    // `??` would replace a deliberate `null` override with the default
    // — and the "null assetKind falls through to OTHER" branch relies
    // on actually passing through a null.
    instrument: "instrument" in over ? (over.instrument ?? null) : null,
    assetKind: "assetKind" in over ? (over.assetKind ?? null) : AssetKind.INVESTMENT,
    quantity: over.quantity ?? 1,
    openDate: over.openDate ?? null,
    lots: over.lots ?? null,
    localCurrency: over.localCurrency ?? "USD",
    baseCurrency: over.baseCurrency ?? "USD",
    fxRate: over.fxRate ?? 1,
    marketValue: over.marketValue ?? { local: 100, base: 100 },
    costBasis: over.costBasis ?? null,
    price: over.price ?? null,
    unrealizedGain: over.unrealizedGain ?? null,
    unrealizedGainPct: over.unrealizedGainPct ?? null,
    realizedGain: over.realizedGain ?? null,
    realizedGainPct: over.realizedGainPct ?? null,
    totalGain: over.totalGain ?? null,
    totalGainPct: over.totalGainPct ?? null,
    dayChange: over.dayChange ?? null,
    dayChangePct: over.dayChangePct ?? null,
    prevCloseValue: over.prevCloseValue ?? null,
    weight: over.weight ?? 0,
    asOfDate: over.asOfDate ?? "2026-05-17",
  };
}

// ---------------------------------------------------------------------------
// classifyHolding
// ---------------------------------------------------------------------------

describe("classifyHolding", () => {
  describe("cash → Bank Accounts (Feroz #17)", () => {
    it("routes a cash holding to BANK_ACCOUNTS regardless of assetKind", () => {
      const h = makeHolding({ holdingType: HoldingType.CASH, assetKind: AssetKind.INVESTMENT });
      expect(classifyHolding(h)).toBe(AssetClass.BANK_ACCOUNTS);
    });

    it("routes cash holdings with null assetKind to BANK_ACCOUNTS", () => {
      const h = makeHolding({ holdingType: HoldingType.CASH, assetKind: null });
      expect(classifyHolding(h)).toBe(AssetClass.BANK_ACCOUNTS);
    });
  });

  describe("alternative assetKinds map directly", () => {
    it("PROPERTY → Property", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.PROPERTY }))).toBe(
        AssetClass.PROPERTY,
      );
    });

    it("COLLECTIBLE → Collectibles", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.COLLECTIBLE }))).toBe(
        AssetClass.COLLECTIBLES,
      );
    });

    it("PRECIOUS_METAL → Precious Metals", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.PRECIOUS_METAL }))).toBe(
        AssetClass.PRECIOUS_METALS,
      );
    });

    it("VEHICLE → OTHER (will be removed from net worth per Feroz #14)", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.VEHICLE }))).toBe(AssetClass.OTHER);
    });

    it("LIABILITY → OTHER (liabilities will get their own section per Feroz #20)", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.LIABILITY }))).toBe(
        AssetClass.OTHER,
      );
    });

    it("FX → OTHER", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.FX }))).toBe(AssetClass.OTHER);
    });

    it("OTHER assetKind → OTHER class", () => {
      expect(classifyHolding(makeHolding({ assetKind: AssetKind.OTHER }))).toBe(AssetClass.OTHER);
    });
  });

  describe("INVESTMENT — taxonomy-driven classification", () => {
    function withAssetTypeKey(key: string): Holding {
      return makeHolding({
        assetKind: AssetKind.INVESTMENT,
        instrument: makeInstrument({
          classifications: makeClassifications({
            assetType: makeTaxonomyCategory({ key, name: key }),
          }),
        }),
      });
    }

    it("'stocks' key → STOCKS", () => {
      expect(classifyHolding(withAssetTypeKey("stocks"))).toBe(AssetClass.STOCKS);
    });

    it("'equity' key → STOCKS", () => {
      expect(classifyHolding(withAssetTypeKey("equity"))).toBe(AssetClass.STOCKS);
    });

    it("'etf' key → ETFS", () => {
      expect(classifyHolding(withAssetTypeKey("etf"))).toBe(AssetClass.ETFS);
    });

    it("'exchange-traded fund' → ETFS", () => {
      expect(classifyHolding(withAssetTypeKey("Exchange-Traded Fund"))).toBe(AssetClass.ETFS);
    });

    it("'sukuk' key → SUKUKS", () => {
      expect(classifyHolding(withAssetTypeKey("sukuk"))).toBe(AssetClass.SUKUKS);
    });

    it("'bond' key → BONDS", () => {
      expect(classifyHolding(withAssetTypeKey("bond"))).toBe(AssetClass.BONDS);
    });

    it("'fixed income' → BONDS", () => {
      expect(classifyHolding(withAssetTypeKey("fixed-income"))).toBe(AssetClass.BONDS);
    });

    it("'treasury' → BONDS", () => {
      expect(classifyHolding(withAssetTypeKey("US Treasury"))).toBe(AssetClass.BONDS);
    });

    it("'gilt' → BONDS", () => {
      expect(classifyHolding(withAssetTypeKey("UK Gilt"))).toBe(AssetClass.BONDS);
    });

    it("SUKUK keyword wins over BOND keyword when both could match", () => {
      // A 'sukuk' is sometimes described as an Islamic bond — make sure
      // the SUKUK rule fires first so it doesn't get mis-bucketed.
      expect(classifyHolding(withAssetTypeKey("Sukuk (Islamic Bond)"))).toBe(AssetClass.SUKUKS);
    });

    it("ETF keyword wins over BOND keyword when both could match", () => {
      // "Bond ETF" must classify as ETF, not Bond.
      expect(classifyHolding(withAssetTypeKey("Aggregate Bond ETF"))).toBe(AssetClass.ETFS);
    });

    it("ETF keyword wins over STOCK keyword when both could match", () => {
      expect(classifyHolding(withAssetTypeKey("Equity ETF"))).toBe(AssetClass.ETFS);
    });
  });

  describe("INVESTMENT — fallback behavior", () => {
    it("INVESTMENT with no instrument → STOCKS", () => {
      const h = makeHolding({ assetKind: AssetKind.INVESTMENT, instrument: null });
      expect(classifyHolding(h)).toBe(AssetClass.STOCKS);
    });

    it("INVESTMENT with instrument but no classifications → STOCKS", () => {
      const h = makeHolding({
        assetKind: AssetKind.INVESTMENT,
        instrument: makeInstrument({ symbol: "AAPL", name: "Apple Inc.", classifications: null }),
      });
      expect(classifyHolding(h)).toBe(AssetClass.STOCKS);
    });

    it("PRIVATE_EQUITY with no classifications → STOCKS", () => {
      const h = makeHolding({ assetKind: AssetKind.PRIVATE_EQUITY, instrument: null });
      expect(classifyHolding(h)).toBe(AssetClass.STOCKS);
    });

    it("INVESTMENT with empty classifications → STOCKS", () => {
      const h = makeHolding({
        assetKind: AssetKind.INVESTMENT,
        instrument: makeInstrument({
          symbol: "AAPL",
          name: "Apple Inc.",
          classifications: makeClassifications(),
        }),
      });
      expect(classifyHolding(h)).toBe(AssetClass.STOCKS);
    });

    it("falls through to assetClasses[] when assetType has no signal", () => {
      const h = makeHolding({
        assetKind: AssetKind.INVESTMENT,
        instrument: makeInstrument({
          symbol: "AGG",
          name: "Some Index",
          classifications: makeClassifications({
            assetType: makeTaxonomyCategory({ key: "index", name: "Index Fund" }),
            assetClasses: [
              {
                category: makeTaxonomyCategory({ key: "bond", name: "Bond" }),
                topLevelCategory: { id: "tlc", name: "Bond" },
                weight: 100,
              },
            ],
          }),
        }),
      });
      expect(classifyHolding(h)).toBe(AssetClass.BONDS);
    });
  });

  describe("null assetKind", () => {
    it("security with null assetKind → OTHER (no INVESTMENT default to anchor on)", () => {
      const h = makeHolding({ assetKind: null });
      expect(classifyHolding(h)).toBe(AssetClass.OTHER);
    });
  });
});

// ---------------------------------------------------------------------------
// groupHoldingsByAssetClass
// ---------------------------------------------------------------------------

describe("groupHoldingsByAssetClass", () => {
  it("returns ALL classes in ASSET_CLASS_ORDER, even empty ones (Feroz: empty class shows Add CTA)", () => {
    const buckets = groupHoldingsByAssetClass([]);
    expect(buckets.map((b) => b.cls)).toEqual([...ASSET_CLASS_ORDER]);
    expect(buckets.every((b) => b.count === 0 && b.totalValue === 0)).toBe(true);
  });

  it("sums market value in base currency per bucket", () => {
    const holdings = [
      makeHolding({
        id: "a",
        assetKind: AssetKind.PROPERTY,
        marketValue: { local: 500_000, base: 500_000 },
      }),
      makeHolding({
        id: "b",
        assetKind: AssetKind.PROPERTY,
        marketValue: { local: 300_000, base: 300_000 },
      }),
      makeHolding({
        id: "c",
        holdingType: HoldingType.CASH,
        marketValue: { local: 10_000, base: 10_000 },
      }),
    ];
    const buckets = groupHoldingsByAssetClass(holdings);
    const property = buckets.find((b) => b.cls === AssetClass.PROPERTY)!;
    const bank = buckets.find((b) => b.cls === AssetClass.BANK_ACCOUNTS)!;

    expect(property.count).toBe(2);
    expect(property.totalValue).toBe(800_000);
    expect(bank.count).toBe(1);
    expect(bank.totalValue).toBe(10_000);
  });

  it("preserves input order of holdings within a bucket", () => {
    const holdings = [
      makeHolding({ id: "first", assetKind: AssetKind.COLLECTIBLE }),
      makeHolding({ id: "second", assetKind: AssetKind.COLLECTIBLE }),
      makeHolding({ id: "third", assetKind: AssetKind.COLLECTIBLE }),
    ];
    const collectibles = groupHoldingsByAssetClass(holdings).find(
      (b) => b.cls === AssetClass.COLLECTIBLES,
    )!;
    expect(collectibles.holdings.map((h) => h.id)).toEqual(["first", "second", "third"]);
  });

  it("treats a null base market value as zero (defensive)", () => {
    const h = makeHolding({
      assetKind: AssetKind.PROPERTY,
      marketValue: { local: 0, base: 0 },
    });
    const buckets = groupHoldingsByAssetClass([h]);
    const property = buckets.find((b) => b.cls === AssetClass.PROPERTY)!;
    expect(property.totalValue).toBe(0);
    expect(property.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parseAssetClassParam
// ---------------------------------------------------------------------------

describe("parseAssetClassParam", () => {
  it("accepts exact upper-case values", () => {
    expect(parseAssetClassParam("STOCKS")).toBe(AssetClass.STOCKS);
    expect(parseAssetClassParam("BANK_ACCOUNTS")).toBe(AssetClass.BANK_ACCOUNTS);
  });

  it("is case-insensitive", () => {
    expect(parseAssetClassParam("stocks")).toBe(AssetClass.STOCKS);
    expect(parseAssetClassParam("Bank_Accounts")).toBe(AssetClass.BANK_ACCOUNTS);
  });

  it("returns null for unknown values", () => {
    expect(parseAssetClassParam("crypto")).toBeNull();
    expect(parseAssetClassParam("")).toBeNull();
    expect(parseAssetClassParam(null)).toBeNull();
    expect(parseAssetClassParam(undefined)).toBeNull();
  });
});
