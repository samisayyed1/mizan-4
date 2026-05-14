// Universal Add Asset command wrapper (Prompt 5).
//
// One polymorphic backend command — `create_universal_asset` —
// handles every asset class the wizard supports. The tag union below
// mirrors the Rust `UniversalAssetInput` enum exactly so the JSON
// shape matches without any translation layer.

import type { Asset } from "@/lib/types";
import { invoke, logger } from "./platform";

export interface UniversalBaseAssetInput {
  name: string;
  currency: string;
  initialValue?: string;
  valuationDate?: string;
  notes?: string;
}

export interface PublicEquityFields {
  securityType: "STOCK" | "ETF" | "MUTUAL_FUND" | "REIT" | "PREFERRED" | "ADR" | "OTHER";
  ticker: string;
  exchangeMic?: string;
  isin?: string;
  expenseRatio?: string;
  dividendFrequency?: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | "IRREGULAR" | "NONE";
  inceptionDate?: string;
}

export interface FixedIncomeFields {
  instrumentType: "BOND" | "SUKUK" | "T_BILL" | "FIXED_DEPOSIT" | "CD" | "OTHER";
  issuer?: string;
  isin?: string;
  faceValue?: string;
  purchaseDate?: string;
  maturityDate: string;
  couponOrProfitRate?: string;
  paymentFrequency?:
    | "MONTHLY"
    | "QUARTERLY"
    | "SEMI_ANNUAL"
    | "ANNUAL"
    | "AT_MATURITY"
    | "ZERO_COUPON";
  dayCountConvention?: "ACT_360" | "ACT_365" | "ACT_ACT" | "THIRTY_360";
  isSukuk: boolean;
}

export interface RealEstateFields {
  propertyType?: "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "MIXED_USE" | "INDUSTRIAL" | "OTHER";
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  areaValue?: string;
  areaUnit?: "SQ_FT" | "SQ_M" | "ACRE" | "HECTARE" | "OTHER";
  bedrooms?: number;
  bathrooms?: number;
}

export interface PrivateInvestmentFields {
  investmentKind:
    | "PRIVATE_EQUITY"
    | "PRIVATE_CREDIT"
    | "VENTURE"
    | "BUSINESS_OWNERSHIP"
    | "HEDGE_FUND"
    | "OTHER";
  manager?: string;
  strategy?: string;
  vintageYear?: number;
  commitmentAmount?: string;
  inceptionDate?: string;
}

export interface InsuranceFields {
  productKind: "INSURANCE" | "ULIP" | "PENSION" | "ANNUITY" | "OTHER";
  carrier?: string;
  policyNumber?: string;
  inceptionDate?: string;
  maturityDate?: string;
  sumAssured?: string;
  premiumAmount?: string;
  premiumFrequency?: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | "SINGLE" | "OTHER";
  hasMarketLink: boolean;
}

export interface CommodityFields {
  commodityType:
    | "GOLD"
    | "SILVER"
    | "PLATINUM"
    | "PALLADIUM"
    | "OIL"
    | "NATURAL_GAS"
    | "COPPER"
    | "AGRICULTURAL"
    | "OTHER";
  form?: "BAR" | "COIN" | "JEWELRY" | "CONTRACT" | "ETF_BACKED" | "PHYSICAL_OTHER" | "OTHER";
  purity?: string;
  weightValue?: string;
  weightUnit?: "GRAM" | "KILOGRAM" | "OUNCE" | "TROY_OUNCE" | "TOLA" | "OTHER";
}

export interface CollectibleFields {
  collectibleType?:
    | "WATCH"
    | "ART"
    | "WINE"
    | "VEHICLE"
    | "MEMORABILIA"
    | "JEWELRY"
    | "STAMP"
    | "COIN"
    | "OTHER";
  maker?: string;
  model?: string;
  yearMade?: number;
  serialNumber?: string;
  condition?: "MINT" | "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR" | "POOR";
}

export interface LiabilityFields {
  liabilityType:
    | "MORTGAGE"
    | "AUTO_LOAN"
    | "STUDENT_LOAN"
    | "CREDIT_CARD"
    | "PERSONAL_LOAN"
    | "MARGIN_LOAN"
    | "BUSINESS_LOAN"
    | "OTHER";
  lender?: string;
  principalAmount?: string;
  outstandingBalance?: string;
  interestRate?: string;
  rateType?: "FIXED" | "VARIABLE" | "INTEREST_FREE" | "OTHER";
  startDate?: string;
  maturityDate?: string;
  linkedAssetId?: string;
}

export type UniversalAssetInput =
  | { kind: "public_equity"; base: UniversalBaseAssetInput; fields: PublicEquityFields }
  | { kind: "fixed_income"; base: UniversalBaseAssetInput; fields: FixedIncomeFields }
  | { kind: "real_estate"; base: UniversalBaseAssetInput; fields: RealEstateFields }
  | {
      kind: "private_investment";
      base: UniversalBaseAssetInput;
      fields: PrivateInvestmentFields;
    }
  | { kind: "insurance"; base: UniversalBaseAssetInput; fields: InsuranceFields }
  | { kind: "commodity"; base: UniversalBaseAssetInput; fields: CommodityFields }
  | { kind: "collectible"; base: UniversalBaseAssetInput; fields: CollectibleFields }
  | { kind: "liability"; base: UniversalBaseAssetInput; fields: LiabilityFields }
  | { kind: "cash"; base: UniversalBaseAssetInput }
  | { kind: "crypto"; base: UniversalBaseAssetInput; ticker?: string };

export interface UniversalAssetCreated {
  asset: Asset;
  createdExtension: boolean;
  createdInitialValuation: boolean;
}

export const createUniversalAsset = async (
  input: UniversalAssetInput,
): Promise<UniversalAssetCreated> => {
  try {
    return await invoke<UniversalAssetCreated>("create_universal_asset", { input });
  } catch (error) {
    logger.error("Error creating universal asset.");
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Prompt 6 — bulk valuation update grid.
// ---------------------------------------------------------------------------

/// A single valuation row returned by `list_manual_valuation_assets`.
/// Mirrors the Rust `ValuationRow` shape — monetary values are stored
/// as canonical Decimal strings, never JS numbers.
export interface BulkValuationRow {
  id: string;
  assetId: string;
  valuationDate: string;
  valueNative: string;
  currency: string;
  sourceType: string;
  sourceId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/// One manual-mode asset together with its most recent valuation (if any).
export interface ManualAssetValuationView {
  assetId: string;
  assetName: string | null;
  assetCurrency: string;
  latest: BulkValuationRow | null;
}

export const listManualValuationAssets = async (): Promise<ManualAssetValuationView[]> => {
  try {
    return await invoke<ManualAssetValuationView[]>("list_manual_valuation_assets", {});
  } catch (error) {
    logger.error("Error listing manual valuation assets.");
    throw error;
  }
};

export interface BulkValuationInput {
  assetId: string;
  valuationDate: string;
  valueNative: string; // Decimal as canonical string — never a JS number
  currency: string;
  notes?: string;
}

export interface BulkValuationResult {
  written: number;
  rows: BulkValuationRow[];
}

export const bulkUpdateValuations = async (
  rows: BulkValuationInput[],
): Promise<BulkValuationResult> => {
  try {
    return await invoke<BulkValuationResult>("bulk_update_valuations", { rows });
  } catch (error) {
    logger.error("Error bulk-updating valuations.");
    throw error;
  }
};
