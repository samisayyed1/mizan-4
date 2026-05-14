//! Universal Add Asset Tauri commands (Prompt 5 of the build plan).
//!
//! One polymorphic `create_universal_asset` command takes a tagged-union
//! input (`UniversalAssetInput`) and creates the canonical `assets` row
//! plus the appropriate typed extension row plus an initial valuation,
//! all delegated to existing services and the universal repository
//! introduced in Prompt 4.
//!
//! The existing `create_asset` and `create_alternative_asset` commands
//! are left in place — this command is additive and only used by the
//! new universal Add Asset wizard.

use std::sync::Arc;

use log::debug;
use mizan_core::assets::{Asset, AssetKind, InstrumentType, NewAsset, QuoteMode};
use mizan_storage_sqlite::assets::{
    CollectibleRow, CommodityRow, FixedIncomeRow, InsuranceRow, LiabilityRow, NewValuation,
    PrivateInvestmentRow, PublicEquityRow, RealEstateRow, ValuationSource,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::context::ServiceContext;

// ---------------------------------------------------------------------------
// Input shape — tagged on `kind` so the frontend posts one body.
// ---------------------------------------------------------------------------

/// Shared base fields that every universal asset needs.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseAssetInput {
    pub name: String,
    pub currency: String,
    pub initial_value: Option<Decimal>,
    pub valuation_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicEquityFields {
    pub security_type: String,
    pub ticker: String,
    pub exchange_mic: Option<String>,
    pub isin: Option<String>,
    pub expense_ratio: Option<Decimal>,
    pub dividend_frequency: Option<String>,
    pub inception_date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedIncomeFields {
    pub instrument_type: String,
    pub issuer: Option<String>,
    pub isin: Option<String>,
    pub face_value: Option<Decimal>,
    pub purchase_date: Option<String>,
    pub maturity_date: String,
    pub coupon_or_profit_rate: Option<Decimal>,
    pub payment_frequency: Option<String>,
    pub day_count_convention: Option<String>,
    pub is_sukuk: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealEstateFields {
    pub property_type: Option<String>,
    pub address_line1: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub postal_code: Option<String>,
    pub country_code: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<Decimal>,
    pub area_value: Option<Decimal>,
    pub area_unit: Option<String>,
    pub bedrooms: Option<i32>,
    pub bathrooms: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateInvestmentFields {
    pub investment_kind: String,
    pub manager: Option<String>,
    pub strategy: Option<String>,
    pub vintage_year: Option<i32>,
    pub commitment_amount: Option<Decimal>,
    pub inception_date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsuranceFields {
    pub product_kind: String,
    pub carrier: Option<String>,
    pub policy_number: Option<String>,
    pub inception_date: Option<String>,
    pub maturity_date: Option<String>,
    pub sum_assured: Option<Decimal>,
    pub premium_amount: Option<Decimal>,
    pub premium_frequency: Option<String>,
    pub has_market_link: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommodityFields {
    pub commodity_type: String,
    pub form: Option<String>,
    pub purity: Option<Decimal>,
    pub weight_value: Option<Decimal>,
    pub weight_unit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectibleFields {
    pub collectible_type: Option<String>,
    pub maker: Option<String>,
    pub model: Option<String>,
    pub year_made: Option<i32>,
    pub serial_number: Option<String>,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiabilityFields {
    pub liability_type: String,
    pub lender: Option<String>,
    pub principal_amount: Option<Decimal>,
    pub outstanding_balance: Option<Decimal>,
    pub interest_rate: Option<Decimal>,
    pub rate_type: Option<String>,
    pub start_date: Option<String>,
    pub maturity_date: Option<String>,
    pub linked_asset_id: Option<String>,
}

/// Polymorphic create input. Tagged on `kind` so the frontend can
/// emit a single JSON shape per asset type.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum UniversalAssetInput {
    PublicEquity {
        base: BaseAssetInput,
        fields: PublicEquityFields,
    },
    FixedIncome {
        base: BaseAssetInput,
        fields: FixedIncomeFields,
    },
    RealEstate {
        base: BaseAssetInput,
        fields: RealEstateFields,
    },
    PrivateInvestment {
        base: BaseAssetInput,
        fields: PrivateInvestmentFields,
    },
    Insurance {
        base: BaseAssetInput,
        fields: InsuranceFields,
    },
    Commodity {
        base: BaseAssetInput,
        fields: CommodityFields,
    },
    Collectible {
        base: BaseAssetInput,
        fields: CollectibleFields,
    },
    Liability {
        base: BaseAssetInput,
        fields: LiabilityFields,
    },
    Cash {
        base: BaseAssetInput,
    },
    /// Crypto is created through the existing market-data flow; this
    /// variant is provided so the wizard can route every type through
    /// the same command. We still write only a base `assets` row —
    /// market-data sync attaches quotes asynchronously.
    Crypto {
        base: BaseAssetInput,
        #[serde(default)]
        ticker: Option<String>,
    },
}

/// Response shape — small surface so the frontend can navigate after
/// the create.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UniversalAssetCreated {
    pub asset: Asset,
    pub created_extension: bool,
    pub created_initial_valuation: bool,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn empty_ts() -> (String, String) {
    // Repository fills these on insert.
    (String::new(), String::new())
}

fn opt_decimal_to_string(d: Option<Decimal>) -> Option<String> {
    d.map(|v| v.to_string())
}

fn make_new_asset(
    base: &BaseAssetInput,
    kind: AssetKind,
    quote_mode: QuoteMode,
    instrument_type: Option<InstrumentType>,
    instrument_symbol: Option<String>,
) -> NewAsset {
    NewAsset {
        id: None,
        kind,
        name: Some(base.name.clone()),
        display_code: instrument_symbol.clone(),
        is_active: true,
        quote_mode,
        quote_ccy: base.currency.clone(),
        instrument_type,
        instrument_symbol,
        instrument_exchange_mic: None,
        provider_config: None,
        notes: base.notes.clone(),
        ..Default::default()
    }
}

async fn write_initial_valuation(
    state: &Arc<ServiceContext>,
    asset_id: &str,
    base: &BaseAssetInput,
) -> Result<bool, String> {
    let Some(value) = base.initial_value else {
        return Ok(false);
    };
    let date = base
        .valuation_date
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    state
        .universal_asset_repository
        .insert_valuation(NewValuation {
            asset_id: asset_id.to_string(),
            valuation_date: date,
            value_native: value,
            currency: base.currency.clone(),
            source_type: ValuationSource::Manual,
            source_id: None,
            notes: None,
        })
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

/// Creates an asset of any kind from the new universal Add Asset
/// wizard.
///
/// Steps (per variant):
///   1. Build a `NewAsset` describing the canonical identity row and
///      hand it to the existing `AssetServiceTrait::create_asset` —
///      this preserves every invariant the rest of the app already
///      enforces (id generation, idempotency, taxonomy hooks).
///   2. Insert the typed extension row using
///      `UniversalAssetRepository` (Prompt 4 storage).
///   3. If the caller supplied an `initialValue`, append a manual
///      valuation row to `asset_valuations`.
///
/// On any failure the function returns a structured error string —
/// the frontend surfaces it as a toast. No partial UI success is
/// reported.
#[tauri::command]
pub async fn create_universal_asset(
    input: UniversalAssetInput,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<UniversalAssetCreated, String> {
    debug!("create_universal_asset: dispatching");
    let svc = state.inner().clone();

    match input {
        UniversalAssetInput::PublicEquity { base, fields } => {
            let new_asset = make_new_asset(
                &base,
                AssetKind::Investment,
                QuoteMode::Market,
                Some(InstrumentType::Equity),
                Some(fields.ticker.clone()),
            );
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_public_equity(PublicEquityRow {
                    asset_id: asset.id.clone(),
                    security_type: fields.security_type,
                    isin: fields.isin,
                    exchange: fields.exchange_mic,
                    expense_ratio: opt_decimal_to_string(fields.expense_ratio),
                    dividend_frequency: fields.dividend_frequency,
                    inception_date: fields.inception_date,
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::FixedIncome { base, fields } => {
            let new_asset = make_new_asset(
                &base,
                AssetKind::Investment,
                QuoteMode::Manual,
                Some(InstrumentType::Bond),
                None,
            );
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_fixed_income(FixedIncomeRow {
                    asset_id: asset.id.clone(),
                    instrument_type: fields.instrument_type,
                    issuer: fields.issuer,
                    isin: fields.isin,
                    face_value: opt_decimal_to_string(fields.face_value),
                    currency: base.currency.clone(),
                    purchase_date: fields.purchase_date,
                    maturity_date: fields.maturity_date,
                    coupon_or_profit_rate: opt_decimal_to_string(fields.coupon_or_profit_rate),
                    payment_frequency: fields.payment_frequency,
                    day_count_convention: fields.day_count_convention,
                    is_sukuk: if fields.is_sukuk { 1 } else { 0 },
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::RealEstate { base, fields } => {
            let new_asset =
                make_new_asset(&base, AssetKind::Property, QuoteMode::Manual, None, None);
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_real_estate(RealEstateRow {
                    asset_id: asset.id.clone(),
                    property_type: fields.property_type,
                    address_line1: fields.address_line1,
                    address_line2: None,
                    city: fields.city,
                    region: fields.region,
                    postal_code: fields.postal_code,
                    country_code: fields.country_code,
                    purchase_date: fields.purchase_date,
                    purchase_price: opt_decimal_to_string(fields.purchase_price),
                    area_value: opt_decimal_to_string(fields.area_value),
                    area_unit: fields.area_unit,
                    bedrooms: fields.bedrooms,
                    bathrooms: fields.bathrooms,
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::PrivateInvestment { base, fields } => {
            let new_asset = make_new_asset(
                &base,
                AssetKind::PrivateEquity,
                QuoteMode::Manual,
                None,
                None,
            );
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_private_investment(PrivateInvestmentRow {
                    asset_id: asset.id.clone(),
                    investment_kind: fields.investment_kind,
                    manager: fields.manager,
                    strategy: fields.strategy,
                    vintage_year: fields.vintage_year,
                    commitment_amount: opt_decimal_to_string(fields.commitment_amount),
                    commitment_currency: Some(base.currency.clone()),
                    inception_date: fields.inception_date,
                    notes: base.notes.clone(),
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::Insurance { base, fields } => {
            let new_asset = make_new_asset(&base, AssetKind::Other, QuoteMode::Manual, None, None);
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_insurance(InsuranceRow {
                    asset_id: asset.id.clone(),
                    product_kind: fields.product_kind,
                    carrier: fields.carrier,
                    policy_number: fields.policy_number,
                    inception_date: fields.inception_date,
                    maturity_date: fields.maturity_date,
                    sum_assured: opt_decimal_to_string(fields.sum_assured),
                    premium_amount: opt_decimal_to_string(fields.premium_amount),
                    premium_frequency: fields.premium_frequency,
                    currency: Some(base.currency.clone()),
                    has_market_link: if fields.has_market_link { 1 } else { 0 },
                    notes: base.notes.clone(),
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::Commodity { base, fields } => {
            let new_asset = make_new_asset(
                &base,
                AssetKind::PreciousMetal,
                QuoteMode::Manual,
                None,
                None,
            );
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_commodity(CommodityRow {
                    asset_id: asset.id.clone(),
                    commodity_type: fields.commodity_type,
                    form: fields.form,
                    purity: opt_decimal_to_string(fields.purity),
                    weight_value: opt_decimal_to_string(fields.weight_value),
                    weight_unit: fields.weight_unit,
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::Collectible { base, fields } => {
            let new_asset =
                make_new_asset(&base, AssetKind::Collectible, QuoteMode::Manual, None, None);
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_collectible(CollectibleRow {
                    asset_id: asset.id.clone(),
                    collectible_type: fields.collectible_type,
                    maker: fields.maker,
                    model: fields.model,
                    year_made: fields.year_made,
                    serial_number: fields.serial_number,
                    condition: fields.condition,
                    notes: base.notes.clone(),
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::Liability { base, fields } => {
            let new_asset =
                make_new_asset(&base, AssetKind::Liability, QuoteMode::Manual, None, None);
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let (created_at, updated_at) = empty_ts();
            svc.universal_asset_repository
                .upsert_liability(LiabilityRow {
                    asset_id: asset.id.clone(),
                    liability_type: fields.liability_type,
                    lender: fields.lender,
                    principal_amount: opt_decimal_to_string(fields.principal_amount),
                    outstanding_balance: opt_decimal_to_string(fields.outstanding_balance),
                    currency: Some(base.currency.clone()),
                    interest_rate: opt_decimal_to_string(fields.interest_rate),
                    rate_type: fields.rate_type,
                    start_date: fields.start_date,
                    maturity_date: fields.maturity_date,
                    linked_asset_id: fields.linked_asset_id,
                    notes: base.notes.clone(),
                    created_at,
                    updated_at,
                })
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: true,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::Cash { base } => {
            // Cash assets have no typed extension table; the asset row +
            // initial valuation is sufficient. The valuation acts as the
            // current cash balance.
            let new_asset = make_new_asset(&base, AssetKind::Other, QuoteMode::Manual, None, None);
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: false,
                created_initial_valuation: val,
            })
        }

        UniversalAssetInput::Crypto { base, ticker } => {
            // Crypto assets ride on the existing market-data path. We
            // create the canonical asset row with `Crypto` instrument
            // type and `Market` quote mode; the existing quote sync
            // service attaches prices.
            let new_asset = make_new_asset(
                &base,
                AssetKind::Investment,
                QuoteMode::Market,
                Some(InstrumentType::Crypto),
                ticker,
            );
            let asset = svc
                .asset_service
                .create_asset(new_asset)
                .await
                .map_err(|e| e.to_string())?;
            let val = write_initial_valuation(&svc, &asset.id, &base).await?;
            Ok(UniversalAssetCreated {
                asset,
                created_extension: false,
                created_initial_valuation: val,
            })
        }
    }
}
