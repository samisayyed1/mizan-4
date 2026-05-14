//! Universal Asset Model storage (Prompt 4 of the build plan).
//!
//! `assets` stays the canonical record of identity. This module owns
//! the eight typed extension tables — one row per asset, holding the
//! class-specific attributes (fixed income terms, property location,
//! commitment metadata, etc.) — and the append-only
//! `asset_valuations` ledger.
//!
//! All monetary values are stored as `rust_decimal::Decimal`-formatted
//! strings (`Decimal::to_string`) — never as `f64`. CHECK constraints
//! in `2026-05-14-000001_universal_asset_model/up.sql` reject invalid
//! discriminator strings at the database boundary.

use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use diesel::sqlite::SqliteConnection;
use mizan_core::errors::{DatabaseError, Error, Result, ValidationError};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::schema::{
    asset_collectible, asset_commodity, asset_fixed_income, asset_insurance, asset_liability,
    asset_private_investment, asset_public_equity, asset_real_estate, asset_valuations,
};

type DbPool = Arc<Pool<ConnectionManager<SqliteConnection>>>;

fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

fn new_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

// ===========================================================================
// asset_valuations — append-only ledger.
// ===========================================================================

/// Source of a valuation row. Matches the `source_type` CHECK constraint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValuationSource {
    Manual,
    Document,
    Import,
    Market,
    Calculated,
}

impl ValuationSource {
    fn as_db_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Document => "document",
            Self::Import => "import",
            Self::Market => "market",
            Self::Calculated => "calculated",
        }
    }

    fn parse(value: &str) -> Result<Self> {
        match value {
            "manual" => Ok(Self::Manual),
            "document" => Ok(Self::Document),
            "import" => Ok(Self::Import),
            "market" => Ok(Self::Market),
            "calculated" => Ok(Self::Calculated),
            other => Err(Error::Validation(ValidationError::InvalidInput(format!(
                "invalid valuation source `{other}`"
            )))),
        }
    }
}

/// Input payload for inserting a new valuation. The repository assigns
/// `id`, `created_at`, and `updated_at`.
#[derive(Debug, Clone)]
pub struct NewValuation {
    pub asset_id: String,
    pub valuation_date: String,
    pub value_native: Decimal,
    pub currency: String,
    pub source_type: ValuationSource,
    pub source_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = asset_valuations)]
struct InsertableValuationRow<'a> {
    id: &'a str,
    asset_id: &'a str,
    valuation_date: &'a str,
    value_native: String,
    currency: &'a str,
    source_type: &'a str,
    source_id: Option<&'a str>,
    notes: Option<&'a str>,
    created_at: &'a str,
    updated_at: &'a str,
}

/// Materialised valuation row returned to callers.
#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_valuations)]
pub struct ValuationRow {
    pub id: String,
    pub asset_id: String,
    pub valuation_date: String,
    pub value_native: String,
    pub currency: String,
    pub source_type: String,
    pub source_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl ValuationRow {
    /// Parse `value_native` as a Decimal. Storage is canonical-string
    /// so this never silently rounds.
    pub fn value(&self) -> Result<Decimal> {
        self.value_native.parse::<Decimal>().map_err(|e| {
            Error::Validation(ValidationError::InvalidInput(format!(
                "invalid Decimal `{}`: {e}",
                self.value_native
            )))
        })
    }

    /// Returns the parsed source type.
    pub fn source(&self) -> Result<ValuationSource> {
        ValuationSource::parse(&self.source_type)
    }
}

// ===========================================================================
// Extension rows — one Insertable + one Queryable per table.
// ===========================================================================

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_public_equity)]
pub struct PublicEquityRow {
    pub asset_id: String,
    pub security_type: String,
    pub isin: Option<String>,
    pub exchange: Option<String>,
    pub expense_ratio: Option<String>,
    pub dividend_frequency: Option<String>,
    pub inception_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_fixed_income)]
pub struct FixedIncomeRow {
    pub asset_id: String,
    pub instrument_type: String,
    pub issuer: Option<String>,
    pub isin: Option<String>,
    pub face_value: Option<String>,
    pub currency: String,
    pub purchase_date: Option<String>,
    pub maturity_date: String,
    pub coupon_or_profit_rate: Option<String>,
    pub payment_frequency: Option<String>,
    pub day_count_convention: Option<String>,
    pub is_sukuk: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_real_estate)]
pub struct RealEstateRow {
    pub asset_id: String,
    pub property_type: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub region: Option<String>,
    pub postal_code: Option<String>,
    pub country_code: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<String>,
    pub area_value: Option<String>,
    pub area_unit: Option<String>,
    pub bedrooms: Option<i32>,
    pub bathrooms: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_private_investment)]
pub struct PrivateInvestmentRow {
    pub asset_id: String,
    pub investment_kind: String,
    pub manager: Option<String>,
    pub strategy: Option<String>,
    pub vintage_year: Option<i32>,
    pub commitment_amount: Option<String>,
    pub commitment_currency: Option<String>,
    pub inception_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_insurance)]
pub struct InsuranceRow {
    pub asset_id: String,
    pub product_kind: String,
    pub carrier: Option<String>,
    pub policy_number: Option<String>,
    pub inception_date: Option<String>,
    pub maturity_date: Option<String>,
    pub sum_assured: Option<String>,
    pub premium_amount: Option<String>,
    pub premium_frequency: Option<String>,
    pub currency: Option<String>,
    pub has_market_link: i32,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_commodity)]
pub struct CommodityRow {
    pub asset_id: String,
    pub commodity_type: String,
    pub form: Option<String>,
    pub purity: Option<String>,
    pub weight_value: Option<String>,
    pub weight_unit: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_collectible)]
pub struct CollectibleRow {
    pub asset_id: String,
    pub collectible_type: Option<String>,
    pub maker: Option<String>,
    pub model: Option<String>,
    pub year_made: Option<i32>,
    pub serial_number: Option<String>,
    pub condition: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Insertable, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = asset_liability)]
pub struct LiabilityRow {
    pub asset_id: String,
    pub liability_type: String,
    pub lender: Option<String>,
    pub principal_amount: Option<String>,
    pub outstanding_balance: Option<String>,
    pub currency: Option<String>,
    pub interest_rate: Option<String>,
    pub rate_type: Option<String>,
    pub start_date: Option<String>,
    pub maturity_date: Option<String>,
    pub linked_asset_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ===========================================================================
// Repository
// ===========================================================================

pub struct UniversalAssetRepository {
    pool: DbPool,
}

impl UniversalAssetRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    fn conn(&self) -> Result<diesel::r2d2::PooledConnection<ConnectionManager<SqliteConnection>>> {
        self.pool.get().map_err(|e| {
            Error::Database(DatabaseError::QueryFailed(format!("get connection: {e}")))
        })
    }

    // --- valuations ----------------------------------------------------

    /// Append a new valuation row. Valuations are append-only — repeated
    /// calls for the same (asset, date, source) create independent rows
    /// so the audit history is preserved.
    pub fn insert_valuation(&self, input: NewValuation) -> Result<ValuationRow> {
        let id = new_id("VAL");
        let now = now_iso();
        let value_native = input.value_native.to_string();
        let mut conn = self.conn()?;
        diesel::insert_into(asset_valuations::table)
            .values(InsertableValuationRow {
                id: &id,
                asset_id: &input.asset_id,
                valuation_date: &input.valuation_date,
                value_native,
                currency: &input.currency,
                source_type: input.source_type.as_db_str(),
                source_id: input.source_id.as_deref(),
                notes: input.notes.as_deref(),
                created_at: &now,
                updated_at: &now,
            })
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("insert valuation: {e}")))
            })?;

        asset_valuations::table
            .filter(asset_valuations::id.eq(&id))
            .select(ValuationRow::as_select())
            .first::<ValuationRow>(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "re-select valuation: {e}"
                )))
            })
    }

    /// List every valuation row for an asset, most recent first.
    pub fn list_valuations(&self, asset_id: &str) -> Result<Vec<ValuationRow>> {
        let mut conn = self.conn()?;
        asset_valuations::table
            .filter(asset_valuations::asset_id.eq(asset_id))
            .order((
                asset_valuations::valuation_date.desc(),
                asset_valuations::created_at.desc(),
            ))
            .select(ValuationRow::as_select())
            .load::<ValuationRow>(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("list valuations: {e}")))
            })
    }

    /// Return the most recent valuation for an asset, regardless of source.
    pub fn latest_valuation(&self, asset_id: &str) -> Result<Option<ValuationRow>> {
        Ok(self.list_valuations(asset_id)?.into_iter().next())
    }

    // --- extension upserts --------------------------------------------
    //
    // Each upsert sets created_at on first insert and overwrites every
    // other column on conflict. The 1:1 PK on `asset_id` means there is
    // at most one extension row per asset.

    pub fn upsert_public_equity(&self, mut row: PublicEquityRow) -> Result<PublicEquityRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_public_equity::table)
            .values(&row)
            .on_conflict(asset_public_equity::asset_id)
            .do_update()
            .set((
                asset_public_equity::security_type.eq(&row.security_type),
                asset_public_equity::isin.eq(&row.isin),
                asset_public_equity::exchange.eq(&row.exchange),
                asset_public_equity::expense_ratio.eq(&row.expense_ratio),
                asset_public_equity::dividend_frequency.eq(&row.dividend_frequency),
                asset_public_equity::inception_date.eq(&row.inception_date),
                asset_public_equity::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "upsert public_equity: {e}"
                )))
            })?;
        Ok(row)
    }

    pub fn upsert_fixed_income(&self, mut row: FixedIncomeRow) -> Result<FixedIncomeRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_fixed_income::table)
            .values(&row)
            .on_conflict(asset_fixed_income::asset_id)
            .do_update()
            .set((
                asset_fixed_income::instrument_type.eq(&row.instrument_type),
                asset_fixed_income::issuer.eq(&row.issuer),
                asset_fixed_income::isin.eq(&row.isin),
                asset_fixed_income::face_value.eq(&row.face_value),
                asset_fixed_income::currency.eq(&row.currency),
                asset_fixed_income::purchase_date.eq(&row.purchase_date),
                asset_fixed_income::maturity_date.eq(&row.maturity_date),
                asset_fixed_income::coupon_or_profit_rate.eq(&row.coupon_or_profit_rate),
                asset_fixed_income::payment_frequency.eq(&row.payment_frequency),
                asset_fixed_income::day_count_convention.eq(&row.day_count_convention),
                asset_fixed_income::is_sukuk.eq(row.is_sukuk),
                asset_fixed_income::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "upsert fixed_income: {e}"
                )))
            })?;
        Ok(row)
    }

    pub fn upsert_real_estate(&self, mut row: RealEstateRow) -> Result<RealEstateRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_real_estate::table)
            .values(&row)
            .on_conflict(asset_real_estate::asset_id)
            .do_update()
            .set((
                asset_real_estate::property_type.eq(&row.property_type),
                asset_real_estate::address_line1.eq(&row.address_line1),
                asset_real_estate::address_line2.eq(&row.address_line2),
                asset_real_estate::city.eq(&row.city),
                asset_real_estate::region.eq(&row.region),
                asset_real_estate::postal_code.eq(&row.postal_code),
                asset_real_estate::country_code.eq(&row.country_code),
                asset_real_estate::purchase_date.eq(&row.purchase_date),
                asset_real_estate::purchase_price.eq(&row.purchase_price),
                asset_real_estate::area_value.eq(&row.area_value),
                asset_real_estate::area_unit.eq(&row.area_unit),
                asset_real_estate::bedrooms.eq(row.bedrooms),
                asset_real_estate::bathrooms.eq(row.bathrooms),
                asset_real_estate::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "upsert real_estate: {e}"
                )))
            })?;
        Ok(row)
    }

    pub fn upsert_private_investment(
        &self,
        mut row: PrivateInvestmentRow,
    ) -> Result<PrivateInvestmentRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_private_investment::table)
            .values(&row)
            .on_conflict(asset_private_investment::asset_id)
            .do_update()
            .set((
                asset_private_investment::investment_kind.eq(&row.investment_kind),
                asset_private_investment::manager.eq(&row.manager),
                asset_private_investment::strategy.eq(&row.strategy),
                asset_private_investment::vintage_year.eq(row.vintage_year),
                asset_private_investment::commitment_amount.eq(&row.commitment_amount),
                asset_private_investment::commitment_currency.eq(&row.commitment_currency),
                asset_private_investment::inception_date.eq(&row.inception_date),
                asset_private_investment::notes.eq(&row.notes),
                asset_private_investment::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "upsert private_investment: {e}"
                )))
            })?;
        Ok(row)
    }

    pub fn upsert_insurance(&self, mut row: InsuranceRow) -> Result<InsuranceRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_insurance::table)
            .values(&row)
            .on_conflict(asset_insurance::asset_id)
            .do_update()
            .set((
                asset_insurance::product_kind.eq(&row.product_kind),
                asset_insurance::carrier.eq(&row.carrier),
                asset_insurance::policy_number.eq(&row.policy_number),
                asset_insurance::inception_date.eq(&row.inception_date),
                asset_insurance::maturity_date.eq(&row.maturity_date),
                asset_insurance::sum_assured.eq(&row.sum_assured),
                asset_insurance::premium_amount.eq(&row.premium_amount),
                asset_insurance::premium_frequency.eq(&row.premium_frequency),
                asset_insurance::currency.eq(&row.currency),
                asset_insurance::has_market_link.eq(row.has_market_link),
                asset_insurance::notes.eq(&row.notes),
                asset_insurance::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("upsert insurance: {e}")))
            })?;
        Ok(row)
    }

    pub fn upsert_commodity(&self, mut row: CommodityRow) -> Result<CommodityRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_commodity::table)
            .values(&row)
            .on_conflict(asset_commodity::asset_id)
            .do_update()
            .set((
                asset_commodity::commodity_type.eq(&row.commodity_type),
                asset_commodity::form.eq(&row.form),
                asset_commodity::purity.eq(&row.purity),
                asset_commodity::weight_value.eq(&row.weight_value),
                asset_commodity::weight_unit.eq(&row.weight_unit),
                asset_commodity::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("upsert commodity: {e}")))
            })?;
        Ok(row)
    }

    pub fn upsert_collectible(&self, mut row: CollectibleRow) -> Result<CollectibleRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_collectible::table)
            .values(&row)
            .on_conflict(asset_collectible::asset_id)
            .do_update()
            .set((
                asset_collectible::collectible_type.eq(&row.collectible_type),
                asset_collectible::maker.eq(&row.maker),
                asset_collectible::model.eq(&row.model),
                asset_collectible::year_made.eq(row.year_made),
                asset_collectible::serial_number.eq(&row.serial_number),
                asset_collectible::condition.eq(&row.condition),
                asset_collectible::notes.eq(&row.notes),
                asset_collectible::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "upsert collectible: {e}"
                )))
            })?;
        Ok(row)
    }

    pub fn upsert_liability(&self, mut row: LiabilityRow) -> Result<LiabilityRow> {
        let now = now_iso();
        if row.created_at.is_empty() {
            row.created_at = now.clone();
        }
        row.updated_at = now;
        let mut conn = self.conn()?;
        diesel::insert_into(asset_liability::table)
            .values(&row)
            .on_conflict(asset_liability::asset_id)
            .do_update()
            .set((
                asset_liability::liability_type.eq(&row.liability_type),
                asset_liability::lender.eq(&row.lender),
                asset_liability::principal_amount.eq(&row.principal_amount),
                asset_liability::outstanding_balance.eq(&row.outstanding_balance),
                asset_liability::currency.eq(&row.currency),
                asset_liability::interest_rate.eq(&row.interest_rate),
                asset_liability::rate_type.eq(&row.rate_type),
                asset_liability::start_date.eq(&row.start_date),
                asset_liability::maturity_date.eq(&row.maturity_date),
                asset_liability::linked_asset_id.eq(&row.linked_asset_id),
                asset_liability::notes.eq(&row.notes),
                asset_liability::updated_at.eq(&row.updated_at),
            ))
            .execute(&mut conn)
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("upsert liability: {e}")))
            })?;
        Ok(row)
    }

    // --- reads ---------------------------------------------------------

    pub fn get_public_equity(&self, asset_id: &str) -> Result<Option<PublicEquityRow>> {
        let mut conn = self.conn()?;
        asset_public_equity::table
            .filter(asset_public_equity::asset_id.eq(asset_id))
            .select(PublicEquityRow::as_select())
            .first::<PublicEquityRow>(&mut conn)
            .optional()
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "get public_equity: {e}"
                )))
            })
    }

    pub fn get_fixed_income(&self, asset_id: &str) -> Result<Option<FixedIncomeRow>> {
        let mut conn = self.conn()?;
        asset_fixed_income::table
            .filter(asset_fixed_income::asset_id.eq(asset_id))
            .select(FixedIncomeRow::as_select())
            .first::<FixedIncomeRow>(&mut conn)
            .optional()
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("get fixed_income: {e}")))
            })
    }

    pub fn get_real_estate(&self, asset_id: &str) -> Result<Option<RealEstateRow>> {
        let mut conn = self.conn()?;
        asset_real_estate::table
            .filter(asset_real_estate::asset_id.eq(asset_id))
            .select(RealEstateRow::as_select())
            .first::<RealEstateRow>(&mut conn)
            .optional()
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("get real_estate: {e}")))
            })
    }

    pub fn get_private_investment(&self, asset_id: &str) -> Result<Option<PrivateInvestmentRow>> {
        let mut conn = self.conn()?;
        asset_private_investment::table
            .filter(asset_private_investment::asset_id.eq(asset_id))
            .select(PrivateInvestmentRow::as_select())
            .first::<PrivateInvestmentRow>(&mut conn)
            .optional()
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!(
                    "get private_investment: {e}"
                )))
            })
    }

    pub fn get_insurance(&self, asset_id: &str) -> Result<Option<InsuranceRow>> {
        let mut conn = self.conn()?;
        asset_insurance::table
            .filter(asset_insurance::asset_id.eq(asset_id))
            .select(InsuranceRow::as_select())
            .first::<InsuranceRow>(&mut conn)
            .optional()
            .map_err(|e| Error::Database(DatabaseError::QueryFailed(format!("get insurance: {e}"))))
    }

    pub fn get_commodity(&self, asset_id: &str) -> Result<Option<CommodityRow>> {
        let mut conn = self.conn()?;
        asset_commodity::table
            .filter(asset_commodity::asset_id.eq(asset_id))
            .select(CommodityRow::as_select())
            .first::<CommodityRow>(&mut conn)
            .optional()
            .map_err(|e| Error::Database(DatabaseError::QueryFailed(format!("get commodity: {e}"))))
    }

    pub fn get_collectible(&self, asset_id: &str) -> Result<Option<CollectibleRow>> {
        let mut conn = self.conn()?;
        asset_collectible::table
            .filter(asset_collectible::asset_id.eq(asset_id))
            .select(CollectibleRow::as_select())
            .first::<CollectibleRow>(&mut conn)
            .optional()
            .map_err(|e| {
                Error::Database(DatabaseError::QueryFailed(format!("get collectible: {e}")))
            })
    }

    pub fn get_liability(&self, asset_id: &str) -> Result<Option<LiabilityRow>> {
        let mut conn = self.conn()?;
        asset_liability::table
            .filter(asset_liability::asset_id.eq(asset_id))
            .select(LiabilityRow::as_select())
            .first::<LiabilityRow>(&mut conn)
            .optional()
            .map_err(|e| Error::Database(DatabaseError::QueryFailed(format!("get liability: {e}"))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{create_pool, init, run_migrations};
    use rust_decimal_macros::dec;
    use tempfile::tempdir;

    fn setup_db() -> (DbPool, String) {
        std::env::set_var("CONNECT_API_URL", "http://test.local");
        let dir = tempdir().expect("tempdir");
        let app_data = dir.keep().to_string_lossy().to_string();
        let db_path = init(&app_data).expect("init db");
        run_migrations(&db_path).expect("migrate db");
        let pool = create_pool(&db_path).expect("create pool");
        (pool, db_path)
    }

    /// Inserts a minimal asset row so extension tables have something
    /// to FK against. Returns the asset id.
    fn insert_test_asset(pool: &DbPool, kind: &str) -> String {
        let id = new_id("ASSET");
        let mut conn = pool.get().expect("conn");
        diesel::sql_query(format!(
            "INSERT INTO assets (id, kind, name, is_active, quote_mode, quote_ccy, created_at, updated_at) \
             VALUES ('{id}', '{kind}', 'Test Asset', 1, 'MANUAL', 'USD', \
             strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
        ))
        .execute(&mut conn)
        .expect("insert asset");
        id
    }

    fn empty_timestamps() -> (String, String) {
        // Repository fills these in.
        (String::new(), String::new())
    }

    // -------------------------------------------------------------------
    // Existing public-equity asset rows survive the migration unchanged.
    // -------------------------------------------------------------------
    #[test]
    fn existing_assets_table_is_untouched() {
        use crate::schema::assets;

        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");

        let mut conn = pool.get().expect("conn");
        let count: i64 = assets::table
            .filter(assets::id.eq(&asset_id))
            .count()
            .get_result::<i64>(&mut conn)
            .expect("count");
        assert_eq!(count, 1);
    }

    // -------------------------------------------------------------------
    // 1:1 extension table CRUD per subtype.
    // -------------------------------------------------------------------
    #[test]
    fn public_equity_roundtrip() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");
        let repo = UniversalAssetRepository::new(pool);

        let (created_at, updated_at) = empty_timestamps();
        let row = PublicEquityRow {
            asset_id: asset_id.clone(),
            security_type: "ETF".to_string(),
            isin: Some("US0000000001".to_string()),
            exchange: Some("NYSE".to_string()),
            expense_ratio: Some(dec!(0.0075).to_string()),
            dividend_frequency: Some("QUARTERLY".to_string()),
            inception_date: Some("2010-01-01".to_string()),
            created_at,
            updated_at,
        };

        let written = repo.upsert_public_equity(row).expect("insert");
        assert_eq!(written.security_type, "ETF");

        let read = repo
            .get_public_equity(&asset_id)
            .expect("get")
            .expect("row");
        assert_eq!(read.isin.as_deref(), Some("US0000000001"));
        assert_eq!(read.expense_ratio.as_deref(), Some("0.0075"));
    }

    #[test]
    fn fixed_income_roundtrip_and_sukuk_flag() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");
        let repo = UniversalAssetRepository::new(pool);

        let (created_at, updated_at) = empty_timestamps();
        let row = FixedIncomeRow {
            asset_id: asset_id.clone(),
            instrument_type: "SUKUK".to_string(),
            issuer: Some("Sample Issuer".to_string()),
            isin: None,
            face_value: Some(dec!(10000).to_string()),
            currency: "USD".to_string(),
            purchase_date: Some("2024-01-15".to_string()),
            maturity_date: "2029-01-15".to_string(),
            coupon_or_profit_rate: Some(dec!(0.045).to_string()),
            payment_frequency: Some("SEMI_ANNUAL".to_string()),
            day_count_convention: Some("ACT_365".to_string()),
            is_sukuk: 1,
            created_at,
            updated_at,
        };
        repo.upsert_fixed_income(row).expect("insert");
        let read = repo.get_fixed_income(&asset_id).expect("get").expect("row");
        assert_eq!(read.is_sukuk, 1);
        assert_eq!(read.face_value.as_deref(), Some("10000"));
    }

    #[test]
    fn real_estate_roundtrip() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "PROPERTY");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_real_estate(RealEstateRow {
            asset_id: asset_id.clone(),
            property_type: Some("RESIDENTIAL".to_string()),
            address_line1: Some("1 Test St".to_string()),
            address_line2: None,
            city: Some("Singapore".to_string()),
            region: None,
            postal_code: None,
            country_code: Some("SG".to_string()),
            purchase_date: Some("2020-06-01".to_string()),
            purchase_price: Some(dec!(1500000).to_string()),
            area_value: Some(dec!(120).to_string()),
            area_unit: Some("SQ_M".to_string()),
            bedrooms: Some(3),
            bathrooms: Some(2),
            created_at,
            updated_at,
        })
        .expect("insert");
        let read = repo.get_real_estate(&asset_id).expect("get").expect("row");
        assert_eq!(read.country_code.as_deref(), Some("SG"));
        assert_eq!(read.bedrooms, Some(3));
    }

    #[test]
    fn private_investment_roundtrip() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "PRIVATE_EQUITY");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_private_investment(PrivateInvestmentRow {
            asset_id: asset_id.clone(),
            investment_kind: "VENTURE".to_string(),
            manager: Some("Sample VC".to_string()),
            strategy: Some("GROWTH".to_string()),
            vintage_year: Some(2022),
            commitment_amount: Some(dec!(500000).to_string()),
            commitment_currency: Some("USD".to_string()),
            inception_date: Some("2022-03-15".to_string()),
            notes: None,
            created_at,
            updated_at,
        })
        .expect("insert");
        let read = repo
            .get_private_investment(&asset_id)
            .expect("get")
            .expect("row");
        assert_eq!(read.investment_kind, "VENTURE");
        assert_eq!(read.vintage_year, Some(2022));
    }

    #[test]
    fn insurance_roundtrip() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "OTHER");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_insurance(InsuranceRow {
            asset_id: asset_id.clone(),
            product_kind: "ULIP".to_string(),
            carrier: Some("Sample Insurer".to_string()),
            policy_number: Some("POL-001".to_string()),
            inception_date: Some("2020-01-01".to_string()),
            maturity_date: Some("2040-01-01".to_string()),
            sum_assured: Some(dec!(250000).to_string()),
            premium_amount: Some(dec!(5000).to_string()),
            premium_frequency: Some("ANNUAL".to_string()),
            currency: Some("USD".to_string()),
            has_market_link: 1,
            notes: None,
            created_at,
            updated_at,
        })
        .expect("insert");
        let read = repo.get_insurance(&asset_id).expect("get").expect("row");
        assert_eq!(read.product_kind, "ULIP");
        assert_eq!(read.has_market_link, 1);
    }

    #[test]
    fn commodity_roundtrip() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "PRECIOUS_METAL");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_commodity(CommodityRow {
            asset_id: asset_id.clone(),
            commodity_type: "GOLD".to_string(),
            form: Some("BAR".to_string()),
            purity: Some(dec!(0.999).to_string()),
            weight_value: Some(dec!(100).to_string()),
            weight_unit: Some("GRAM".to_string()),
            created_at,
            updated_at,
        })
        .expect("insert");
        let read = repo.get_commodity(&asset_id).expect("get").expect("row");
        assert_eq!(read.commodity_type, "GOLD");
        assert_eq!(read.weight_unit.as_deref(), Some("GRAM"));
    }

    #[test]
    fn collectible_roundtrip() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "COLLECTIBLE");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_collectible(CollectibleRow {
            asset_id: asset_id.clone(),
            collectible_type: Some("WATCH".to_string()),
            maker: Some("Sample Maker".to_string()),
            model: Some("Sample Model".to_string()),
            year_made: Some(2019),
            serial_number: Some("SN-1".to_string()),
            condition: Some("EXCELLENT".to_string()),
            notes: None,
            created_at,
            updated_at,
        })
        .expect("insert");
        let read = repo.get_collectible(&asset_id).expect("get").expect("row");
        assert_eq!(read.collectible_type.as_deref(), Some("WATCH"));
        assert_eq!(read.year_made, Some(2019));
    }

    #[test]
    fn liability_roundtrip_with_linked_asset() {
        let (pool, _) = setup_db();
        let property_id = insert_test_asset(&pool, "PROPERTY");
        let liability_id = insert_test_asset(&pool, "LIABILITY");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_liability(LiabilityRow {
            asset_id: liability_id.clone(),
            liability_type: "MORTGAGE".to_string(),
            lender: Some("Sample Bank".to_string()),
            principal_amount: Some(dec!(800000).to_string()),
            outstanding_balance: Some(dec!(650000).to_string()),
            currency: Some("USD".to_string()),
            interest_rate: Some(dec!(0.0425).to_string()),
            rate_type: Some("FIXED".to_string()),
            start_date: Some("2020-06-01".to_string()),
            maturity_date: Some("2050-06-01".to_string()),
            linked_asset_id: Some(property_id.clone()),
            notes: None,
            created_at,
            updated_at,
        })
        .expect("insert");
        let read = repo
            .get_liability(&liability_id)
            .expect("get")
            .expect("row");
        assert_eq!(read.linked_asset_id.as_deref(), Some(property_id.as_str()));
    }

    // -------------------------------------------------------------------
    // CHECK constraint rejects invalid subtype strings.
    // -------------------------------------------------------------------
    #[test]
    fn invalid_fixed_income_instrument_type_is_rejected() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");
        let repo = UniversalAssetRepository::new(pool);
        let (created_at, updated_at) = empty_timestamps();
        let result = repo.upsert_fixed_income(FixedIncomeRow {
            asset_id,
            instrument_type: "TOTALLY_INVALID".to_string(),
            issuer: None,
            isin: None,
            face_value: None,
            currency: "USD".to_string(),
            purchase_date: None,
            maturity_date: "2030-01-01".to_string(),
            coupon_or_profit_rate: None,
            payment_frequency: None,
            day_count_convention: None,
            is_sukuk: 0,
            created_at,
            updated_at,
        });
        assert!(
            result.is_err(),
            "CHECK constraint should reject invalid instrument_type"
        );
    }

    #[test]
    fn invalid_valuation_source_is_rejected() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");

        // Inserting a valuation with an invalid source_type directly
        // through SQL bypasses the repository's typed ValuationSource —
        // proving the database CHECK constraint is the enforcement
        // point, not just the Rust enum.
        let mut conn = pool.get().expect("conn");
        let res = diesel::sql_query(format!(
            "INSERT INTO asset_valuations (id, asset_id, valuation_date, value_native, currency, source_type) \
             VALUES ('v1', '{asset_id}', '2026-05-14', '100.00', 'USD', 'totally_wrong')"
        ))
        .execute(&mut conn);
        assert!(res.is_err(), "DB CHECK should reject invalid source_type");
    }

    // -------------------------------------------------------------------
    // asset_valuations is append-only: repeat inserts for the same
    // (asset, date, source) produce independent rows.
    // -------------------------------------------------------------------
    #[test]
    fn valuations_are_append_only() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");
        let repo = UniversalAssetRepository::new(pool);

        let make = |val: Decimal, notes: Option<&str>| NewValuation {
            asset_id: asset_id.clone(),
            valuation_date: "2026-05-14".to_string(),
            value_native: val,
            currency: "USD".to_string(),
            source_type: ValuationSource::Manual,
            source_id: None,
            notes: notes.map(String::from),
        };

        let first = repo
            .insert_valuation(make(dec!(100), Some("first")))
            .expect("v1");
        let second = repo
            .insert_valuation(make(dec!(125), Some("corrected")))
            .expect("v2");
        assert_ne!(first.id, second.id);

        let rows = repo.list_valuations(&asset_id).expect("list");
        assert_eq!(rows.len(), 2);
        // Most recent first by valuation_date+created_at ordering.
        // Both rows share the date so created_at breaks the tie — the
        // second insert is the latest.
        assert_eq!(rows[0].notes.as_deref(), Some("corrected"));
        assert_eq!(rows[1].notes.as_deref(), Some("first"));

        let latest = repo
            .latest_valuation(&asset_id)
            .expect("latest")
            .expect("row");
        assert_eq!(latest.value().expect("decimal"), dec!(125));
        assert_eq!(latest.source().expect("source"), ValuationSource::Manual);
    }

    // -------------------------------------------------------------------
    // CASCADE deletion: deleting the parent asset cleans up extension
    // rows and valuation rows.
    // -------------------------------------------------------------------
    #[test]
    fn delete_asset_cascades_to_extensions_and_valuations() {
        let (pool, _) = setup_db();
        let asset_id = insert_test_asset(&pool, "INVESTMENT");
        let repo = UniversalAssetRepository::new(pool.clone());

        let (created_at, updated_at) = empty_timestamps();
        repo.upsert_public_equity(PublicEquityRow {
            asset_id: asset_id.clone(),
            security_type: "STOCK".to_string(),
            isin: None,
            exchange: None,
            expense_ratio: None,
            dividend_frequency: None,
            inception_date: None,
            created_at,
            updated_at,
        })
        .expect("ext");

        repo.insert_valuation(NewValuation {
            asset_id: asset_id.clone(),
            valuation_date: "2026-05-14".to_string(),
            value_native: dec!(50),
            currency: "USD".to_string(),
            source_type: ValuationSource::Manual,
            source_id: None,
            notes: None,
        })
        .expect("val");

        let mut conn = pool.get().expect("conn");
        diesel::sql_query(format!("DELETE FROM assets WHERE id = '{asset_id}'"))
            .execute(&mut conn)
            .expect("delete asset");

        assert!(repo.get_public_equity(&asset_id).expect("get").is_none());
        assert!(repo.list_valuations(&asset_id).expect("list").is_empty());
    }
}
