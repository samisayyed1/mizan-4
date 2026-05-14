-- Universal Asset Model (Prompt 4 of the build plan).
--
-- The existing `assets` table stays as the canonical record of identity
-- (id, kind, name, currency, instrument metadata). This migration adds:
--
--   1. Eight typed extension tables (1:1 with `assets` by `asset_id`)
--      that carry the class-specific attributes for serious wealth
--      tracking — fixed income / sukuk / FDs, private investments,
--      property, insurance/ULIP/pension, commodities, collectibles,
--      and liabilities.
--
--   2. An `asset_valuations` table that stores point-in-time manually
--      entered or imported valuations. This is the foundation the new
--      asset types use until deeper engines (NAV ingestion, document
--      extraction) start contributing.
--
-- Rules respected:
--   * The existing `assets` table is untouched — public_equity / ETF /
--     mutual_fund / crypto / cash assets continue to work unchanged.
--   * Every monetary field is TEXT — the codebase stores rust_decimal
--     values as their canonical string form, never f64.
--   * FK with ON DELETE CASCADE everywhere — deleting an asset cleans
--     up its extension row and valuations atomically.
--   * CHECK constraints lock down the discriminator values so invalid
--     subtype strings are rejected at the DB layer.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------
-- Append-only valuations ledger.
------------------------------------------------------------------------
CREATE TABLE asset_valuations (
    id              TEXT PRIMARY KEY NOT NULL,
    asset_id        TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    valuation_date  TEXT NOT NULL,                   -- ISO-8601 YYYY-MM-DD
    value_native    TEXT NOT NULL,                   -- Decimal as canonical string
    currency        TEXT NOT NULL,                   -- ISO 4217 (e.g. "USD")
    source_type     TEXT NOT NULL CHECK (source_type IN (
        'manual',
        'document',
        'import',
        'market',
        'calculated'
    )),
    source_id       TEXT,                            -- ref into documents / activities / etc.
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_asset_valuations_asset_date
    ON asset_valuations (asset_id, valuation_date DESC);
CREATE INDEX idx_asset_valuations_source
    ON asset_valuations (asset_id, source_type);

------------------------------------------------------------------------
-- Public equity / ETF / mutual fund / REIT / preferred / ADR.
------------------------------------------------------------------------
CREATE TABLE asset_public_equity (
    asset_id            TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    security_type       TEXT NOT NULL CHECK (security_type IN (
        'STOCK',
        'ETF',
        'MUTUAL_FUND',
        'REIT',
        'PREFERRED',
        'ADR',
        'OTHER'
    )),
    isin                TEXT,
    exchange            TEXT,
    expense_ratio       TEXT,                        -- Decimal (e.g. "0.0075")
    dividend_frequency  TEXT CHECK (dividend_frequency IN (
        'MONTHLY',
        'QUARTERLY',
        'SEMI_ANNUAL',
        'ANNUAL',
        'IRREGULAR',
        'NONE'
    )),
    inception_date      TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

------------------------------------------------------------------------
-- Fixed income: bonds, sukuk, fixed deposits, treasury bills, CDs.
------------------------------------------------------------------------
CREATE TABLE asset_fixed_income (
    asset_id                TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    instrument_type         TEXT NOT NULL CHECK (instrument_type IN (
        'BOND',
        'SUKUK',
        'T_BILL',
        'FIXED_DEPOSIT',
        'CD',
        'OTHER'
    )),
    issuer                  TEXT,
    isin                    TEXT,
    face_value              TEXT,                    -- Decimal
    currency                TEXT NOT NULL,
    purchase_date           TEXT,
    maturity_date           TEXT NOT NULL,
    coupon_or_profit_rate   TEXT,                    -- Decimal annualised
    payment_frequency       TEXT CHECK (payment_frequency IN (
        'MONTHLY',
        'QUARTERLY',
        'SEMI_ANNUAL',
        'ANNUAL',
        'AT_MATURITY',
        'ZERO_COUPON'
    )),
    day_count_convention    TEXT CHECK (day_count_convention IN (
        'ACT_360',
        'ACT_365',
        'ACT_ACT',
        'THIRTY_360'
    )),
    is_sukuk                INTEGER NOT NULL DEFAULT 0 CHECK (is_sukuk IN (0, 1)),
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_asset_fixed_income_maturity ON asset_fixed_income (maturity_date);

------------------------------------------------------------------------
-- Real estate / property.
------------------------------------------------------------------------
CREATE TABLE asset_real_estate (
    asset_id        TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    property_type   TEXT CHECK (property_type IN (
        'RESIDENTIAL',
        'COMMERCIAL',
        'LAND',
        'MIXED_USE',
        'INDUSTRIAL',
        'OTHER'
    )),
    address_line1   TEXT,
    address_line2   TEXT,
    city            TEXT,
    region          TEXT,
    postal_code     TEXT,
    country_code    TEXT,
    purchase_date   TEXT,
    purchase_price  TEXT,                            -- Decimal
    area_value      TEXT,                            -- Decimal
    area_unit       TEXT CHECK (area_unit IN (
        'SQ_FT',
        'SQ_M',
        'ACRE',
        'HECTARE',
        'OTHER'
    )),
    bedrooms        INTEGER,
    bathrooms       INTEGER,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

------------------------------------------------------------------------
-- Private investments: PE, private credit, venture, business ownership.
------------------------------------------------------------------------
CREATE TABLE asset_private_investment (
    asset_id                TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    investment_kind         TEXT NOT NULL CHECK (investment_kind IN (
        'PRIVATE_EQUITY',
        'PRIVATE_CREDIT',
        'VENTURE',
        'BUSINESS_OWNERSHIP',
        'HEDGE_FUND',
        'OTHER'
    )),
    manager                 TEXT,
    strategy                TEXT,                    -- e.g. "BUYOUT", "GROWTH"
    vintage_year            INTEGER,
    commitment_amount       TEXT,                    -- Decimal
    commitment_currency     TEXT,
    inception_date          TEXT,
    notes                   TEXT,
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

------------------------------------------------------------------------
-- Insurance, ULIP, pension contracts.
------------------------------------------------------------------------
CREATE TABLE asset_insurance (
    asset_id           TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    product_kind       TEXT NOT NULL CHECK (product_kind IN (
        'INSURANCE',
        'ULIP',
        'PENSION',
        'ANNUITY',
        'OTHER'
    )),
    carrier            TEXT,
    policy_number      TEXT,
    inception_date     TEXT,
    maturity_date      TEXT,
    sum_assured        TEXT,                         -- Decimal
    premium_amount     TEXT,                         -- Decimal
    premium_frequency  TEXT CHECK (premium_frequency IN (
        'MONTHLY',
        'QUARTERLY',
        'SEMI_ANNUAL',
        'ANNUAL',
        'SINGLE',
        'OTHER'
    )),
    currency           TEXT,
    has_market_link    INTEGER NOT NULL DEFAULT 0 CHECK (has_market_link IN (0, 1)),
    notes              TEXT,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

------------------------------------------------------------------------
-- Commodities (precious metals + other commodities held physically or
-- via contract). Distinct from collectibles to keep metals separable.
------------------------------------------------------------------------
CREATE TABLE asset_commodity (
    asset_id        TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    commodity_type  TEXT NOT NULL CHECK (commodity_type IN (
        'GOLD',
        'SILVER',
        'PLATINUM',
        'PALLADIUM',
        'OIL',
        'NATURAL_GAS',
        'COPPER',
        'AGRICULTURAL',
        'OTHER'
    )),
    form            TEXT CHECK (form IN (
        'BAR',
        'COIN',
        'JEWELRY',
        'CONTRACT',
        'ETF_BACKED',
        'PHYSICAL_OTHER',
        'OTHER'
    )),
    purity          TEXT,                            -- Decimal (e.g. "0.999" or "24")
    weight_value    TEXT,                            -- Decimal
    weight_unit     TEXT CHECK (weight_unit IN (
        'GRAM',
        'KILOGRAM',
        'OUNCE',
        'TROY_OUNCE',
        'TOLA',
        'OTHER'
    )),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

------------------------------------------------------------------------
-- Collectibles: watches, art, wine, vehicles-as-collectible, memorabilia.
------------------------------------------------------------------------
CREATE TABLE asset_collectible (
    asset_id          TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    collectible_type  TEXT CHECK (collectible_type IN (
        'WATCH',
        'ART',
        'WINE',
        'VEHICLE',
        'MEMORABILIA',
        'JEWELRY',
        'STAMP',
        'COIN',
        'OTHER'
    )),
    maker             TEXT,
    model             TEXT,
    year_made         INTEGER,
    serial_number     TEXT,
    condition         TEXT CHECK (condition IN (
        'MINT',
        'EXCELLENT',
        'VERY_GOOD',
        'GOOD',
        'FAIR',
        'POOR'
    )),
    notes             TEXT,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

------------------------------------------------------------------------
-- Liabilities (mortgages, loans, credit cards, margin debt).
------------------------------------------------------------------------
CREATE TABLE asset_liability (
    asset_id             TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    liability_type       TEXT NOT NULL CHECK (liability_type IN (
        'MORTGAGE',
        'AUTO_LOAN',
        'STUDENT_LOAN',
        'CREDIT_CARD',
        'PERSONAL_LOAN',
        'MARGIN_LOAN',
        'BUSINESS_LOAN',
        'OTHER'
    )),
    lender               TEXT,
    principal_amount     TEXT,                       -- Decimal at origination
    outstanding_balance  TEXT,                       -- Decimal current balance
    currency             TEXT,
    interest_rate        TEXT,                       -- Decimal annualised
    rate_type            TEXT CHECK (rate_type IN (
        'FIXED',
        'VARIABLE',
        'INTEREST_FREE',
        'OTHER'
    )),
    start_date           TEXT,
    maturity_date        TEXT,
    linked_asset_id      TEXT REFERENCES assets(id) ON DELETE SET NULL,
    notes                TEXT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_asset_liability_linked ON asset_liability (linked_asset_id);
