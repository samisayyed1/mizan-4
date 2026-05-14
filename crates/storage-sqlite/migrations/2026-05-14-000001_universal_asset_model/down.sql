-- Reverse the universal asset model migration. Order: drop extension
-- tables first, then the valuations table. CASCADE handles dependent
-- rows automatically — FK constraints on the parents are unchanged.

DROP INDEX IF EXISTS idx_asset_liability_linked;
DROP TABLE IF EXISTS asset_liability;

DROP TABLE IF EXISTS asset_collectible;

DROP TABLE IF EXISTS asset_commodity;

DROP TABLE IF EXISTS asset_insurance;

DROP TABLE IF EXISTS asset_private_investment;

DROP TABLE IF EXISTS asset_real_estate;

DROP INDEX IF EXISTS idx_asset_fixed_income_maturity;
DROP TABLE IF EXISTS asset_fixed_income;

DROP TABLE IF EXISTS asset_public_equity;

DROP INDEX IF EXISTS idx_asset_valuations_source;
DROP INDEX IF EXISTS idx_asset_valuations_asset_date;
DROP TABLE IF EXISTS asset_valuations;
