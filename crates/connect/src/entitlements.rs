//! Subscription entitlements — the single source of truth for what a user's
//! plan unlocks.
//!
//! This is the **client-side stopgap** half of the entitlements system. The
//! Mizan Connect cloud (`/api/v1/user/me`) will eventually return an explicit
//! `entitlements` object; until then we derive the matrix from the team's
//! `plan` slug + `subscription_status` via [`entitlements_for_plan`]. When the
//! cloud starts returning entitlements directly, the consuming service prefers
//! that and this mapping becomes the fallback for older backends.
//!
//! `-1` is the sentinel for "unlimited" on every numeric quota.

use serde::{Deserialize, Serialize};

/// Sentinel meaning "no limit" for any numeric quota field.
pub const UNLIMITED: i32 = -1;

/// What a user's subscription unlocks. Mirrors the product tier table; gated
/// both in the Rust IPC layer (tamper-resistant) and the frontend (UX).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entitlements {
    /// Resolved plan slug this matrix was derived from (`free`/`basic`/…),
    /// surfaced to the UI as the "current plan" in upgrade prompts.
    pub plan: String,
    /// Max portfolios (accounts). `UNLIMITED` for no cap.
    pub max_portfolios: i32,
    /// Max holdings per portfolio. `UNLIMITED` for no cap.
    pub max_holdings: i32,
    /// Max distinct asset classes a portfolio may use. `UNLIMITED` for all.
    pub max_asset_classes: i32,
    /// Broker (SnapTrade) sync allowed at all.
    pub broker_sync: bool,
    /// Max simultaneous broker connections.
    pub max_broker_connections: i32,
    /// Encrypted multi-device sync.
    pub device_sync: bool,
    /// Encrypted cloud backup.
    pub cloud_backup: bool,
    /// Managed Mizan AI (vs. bring-your-own-key, which is always allowed).
    pub managed_ai: bool,
    /// Monthly managed-AI credit allowance (0 = none / BYO-key only).
    pub ai_credits_monthly: i32,
    /// News headlines per day. `UNLIMITED` for the full feed.
    pub news_daily_limit: i32,
    /// Market-data refreshes per day. `UNLIMITED` for no cap.
    pub market_refresh_daily_limit: i32,
    /// CSV imports per month. `UNLIMITED` for no cap.
    pub csv_imports_monthly: i32,
    /// Advanced/deep reports (income, rental, payoff, health score).
    pub advanced_reports: bool,
    /// Advisor/enterprise client dashboards & white-label.
    pub advisor_mode: bool,
}

impl Default for Entitlements {
    /// The Free tier. Anyone without an active paid subscription gets this.
    fn default() -> Self {
        Self {
            plan: "free".to_string(),
            max_portfolios: 1,
            max_holdings: 20,
            max_asset_classes: 2,
            broker_sync: false,
            max_broker_connections: 0,
            device_sync: false,
            cloud_backup: false,
            managed_ai: false,
            ai_credits_monthly: 0,
            news_daily_limit: 3,
            market_refresh_daily_limit: 5,
            csv_imports_monthly: 1,
            advanced_reports: false,
            advisor_mode: false,
        }
    }
}

impl Entitlements {
    /// Everything unlocked — used by the `CONNECT_BYPASS_PLAN_CHECK` dev escape
    /// hatch so the whole paid surface works end-to-end without a subscription.
    pub fn unlimited() -> Self {
        Self {
            plan: "bypass".to_string(),
            max_portfolios: UNLIMITED,
            max_holdings: UNLIMITED,
            max_asset_classes: UNLIMITED,
            broker_sync: true,
            max_broker_connections: UNLIMITED,
            device_sync: true,
            cloud_backup: true,
            managed_ai: true,
            ai_credits_monthly: UNLIMITED,
            news_daily_limit: UNLIMITED,
            market_refresh_daily_limit: UNLIMITED,
            csv_imports_monthly: UNLIMITED,
            advanced_reports: true,
            advisor_mode: true,
        }
    }

    /// True when `n` is below the quota `limit` (`UNLIMITED` always passes).
    /// Use for "may I add one more?" checks: `entitlements.within(count, limit)`.
    pub fn within(current: i32, limit: i32) -> bool {
        limit == UNLIMITED || current < limit
    }
}

/// Derive entitlements from a team's `plan` slug + `subscription_status`.
///
/// Inactive/absent subscriptions (or a `free`/unknown-inactive plan) collapse to
/// [`Entitlements::default`] (Free). Only `active`/`trialing` statuses unlock a
/// paid matrix.
///
/// Note on broker sync: this preserves the legacy rule that the cheapest paid
/// slug (`basic`) is device-sync-only and does **not** include broker sync —
/// matching [`crate::client::ConnectApiClient::has_broker_sync`]. Higher paid
/// tiers include broker sync.
pub fn entitlements_for_plan(plan: Option<&str>, status: Option<&str>) -> Entitlements {
    let is_active = matches!(status, Some("active") | Some("trialing"));
    if !is_active {
        return Entitlements::default();
    }

    match plan.map(str::to_ascii_lowercase).as_deref() {
        None | Some("free") => Entitlements::default(),

        // Entry paid tier: full manual tracking + managed AI + sync, but no
        // broker connections (device-sync-only), preserving legacy behavior.
        Some("basic") => Entitlements {
            plan: "basic".to_string(),
            max_portfolios: 5,
            max_holdings: 250,
            max_asset_classes: UNLIMITED,
            broker_sync: false,
            max_broker_connections: 0,
            device_sync: true,
            cloud_backup: true,
            managed_ai: true,
            ai_credits_monthly: 300,
            news_daily_limit: UNLIMITED,
            market_refresh_daily_limit: 50,
            csv_imports_monthly: 20,
            advanced_reports: false,
            advisor_mode: false,
        },

        // Advisor / family-office tier.
        Some("enterprise") | Some("advisor") => Entitlements {
            plan: plan.unwrap_or("enterprise").to_ascii_lowercase(),
            max_portfolios: UNLIMITED,
            max_holdings: UNLIMITED,
            max_asset_classes: UNLIMITED,
            broker_sync: true,
            max_broker_connections: UNLIMITED,
            device_sync: true,
            cloud_backup: true,
            managed_ai: true,
            ai_credits_monthly: UNLIMITED,
            news_daily_limit: UNLIMITED,
            market_refresh_daily_limit: UNLIMITED,
            csv_imports_monthly: UNLIMITED,
            advanced_reports: true,
            advisor_mode: true,
        },

        // Any other active paid slug (pro / essentials / duo / plus / …) maps to
        // the serious-investor tier. Keeps broker sync on, matching the legacy
        // "active && plan != basic" rule.
        Some(other) => Entitlements {
            plan: other.to_string(),
            max_portfolios: 25,
            max_holdings: UNLIMITED,
            max_asset_classes: UNLIMITED,
            broker_sync: true,
            max_broker_connections: 5,
            device_sync: true,
            cloud_backup: true,
            managed_ai: true,
            ai_credits_monthly: 1500,
            news_daily_limit: UNLIMITED,
            market_refresh_daily_limit: UNLIMITED,
            csv_imports_monthly: UNLIMITED,
            advanced_reports: true,
            advisor_mode: false,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inactive_subscription_falls_back_to_free() {
        // Even a "pro" plan with no active subscription is Free.
        assert_eq!(
            entitlements_for_plan(Some("pro"), Some("canceled")),
            Entitlements::default()
        );
        assert_eq!(
            entitlements_for_plan(Some("pro"), None),
            Entitlements::default()
        );
        assert_eq!(entitlements_for_plan(None, None), Entitlements::default());
    }

    #[test]
    fn free_tier_defaults() {
        let e = Entitlements::default();
        assert_eq!(e.plan, "free");
        assert_eq!(e.max_portfolios, 1);
        assert_eq!(e.max_asset_classes, 2);
        assert!(!e.broker_sync);
        assert!(!e.managed_ai);
        assert_eq!(e.ai_credits_monthly, 0);
    }

    #[test]
    fn basic_is_device_sync_only_no_broker() {
        let e = entitlements_for_plan(Some("basic"), Some("active"));
        assert!(e.device_sync);
        assert!(!e.broker_sync, "legacy: basic excludes broker sync");
        assert!(e.managed_ai);
        assert_eq!(e.max_portfolios, 5);
        assert_eq!(e.ai_credits_monthly, 300);
    }

    #[test]
    fn pro_like_plans_unlock_broker_sync() {
        for slug in ["pro", "plus", "duo", "essentials", "anything-paid"] {
            let e = entitlements_for_plan(Some(slug), Some("active"));
            assert!(e.broker_sync, "{slug} should include broker sync");
            assert!(e.max_broker_connections >= 1);
            assert_eq!(e.max_holdings, UNLIMITED);
        }
    }

    #[test]
    fn trialing_counts_as_active() {
        let e = entitlements_for_plan(Some("pro"), Some("trialing"));
        assert!(e.broker_sync);
    }

    #[test]
    fn enterprise_unlocks_advisor_mode() {
        let e = entitlements_for_plan(Some("enterprise"), Some("active"));
        assert!(e.advisor_mode);
        assert_eq!(e.max_portfolios, UNLIMITED);
        assert_eq!(e.ai_credits_monthly, UNLIMITED);
    }

    #[test]
    fn within_respects_unlimited_and_caps() {
        assert!(Entitlements::within(0, 1)); // first one allowed
        assert!(!Entitlements::within(1, 1)); // at cap, blocked
        assert!(Entitlements::within(9999, UNLIMITED)); // unlimited always ok
    }
}
