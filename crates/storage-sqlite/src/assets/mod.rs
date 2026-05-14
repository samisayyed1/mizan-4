//! SQLite storage implementation for assets.

mod alternative_repository;
mod model;
mod repository;
mod universal_repository;

pub use alternative_repository::AlternativeAssetRepository;
pub use model::{AssetDB, InsertableAssetDB};
pub use repository::AssetRepository;
pub use universal_repository::{
    CollectibleRow, CommodityRow, FixedIncomeRow, InsuranceRow, LiabilityRow,
    ManualAssetLatestValuation, NewValuation, PrivateInvestmentRow, PublicEquityRow, RealEstateRow,
    UniversalAssetRepository, ValuationRow, ValuationSource,
};
