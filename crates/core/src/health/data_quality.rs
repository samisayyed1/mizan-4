//! Deterministic portfolio data-quality scoring.
//!
//! The score summarizes existing health-center findings plus optional
//! feature-specific evidence. Missing feature modules pass no evidence and
//! therefore remain neutral.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::model::{HealthCategory, HealthIssue, HealthStatus, Severity};

/// Inputs from modules that are not represented as HealthIssue rows yet.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DataQualityInputs {
    /// False when the user has not added enough portfolio data to score.
    pub has_portfolio_data: bool,
    /// Manual assets with no valuation recorded yet.
    pub manual_valuation_missing_count: u32,
    /// Manual assets with valuations beyond the warning freshness window.
    pub manual_valuation_warning_count: u32,
    /// Manual assets with valuations beyond the critical freshness window.
    pub manual_valuation_critical_count: u32,
    /// Whether source-document evidence can be evaluated yet.
    pub document_vault_available: bool,
    /// Assets or facts missing source-document support once the vault exists.
    pub missing_source_document_count: u32,
    /// Extracted facts still awaiting human review once the vault exists.
    pub pending_extracted_fact_count: u32,
}

/// Data-quality score component.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DataQualityComponent {
    ManualValuationFreshness,
    StaleMarketQuotes,
    MissingFx,
    UnclassifiedAssets,
    PendingHealthIssues,
    MissingSourceDocuments,
    PendingExtractedFacts,
}

/// One item in the score breakdown.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DataQualityDeduction {
    pub component: DataQualityComponent,
    pub label: String,
    pub points: u8,
    pub severity: Severity,
    pub click_target: String,
    pub affected_count: u32,
    pub explanation: String,
}

/// Portfolio data-quality score.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DataQualityScore {
    /// None when there is not enough real portfolio data to score.
    pub score: Option<u8>,
    pub severity: Severity,
    pub explanation: String,
    pub deductions: Vec<DataQualityDeduction>,
    pub checked_at: DateTime<Utc>,
    pub is_onboarding: bool,
}

/// Calculates a professional data-quality score from deterministic evidence.
pub fn calculate_data_quality(
    status: &HealthStatus,
    inputs: &DataQualityInputs,
) -> DataQualityScore {
    if !inputs.has_portfolio_data {
        return DataQualityScore {
            score: None,
            severity: Severity::Info,
            explanation: "Add portfolio data to calculate a data quality score.".to_string(),
            deductions: Vec::new(),
            checked_at: Utc::now(),
            is_onboarding: true,
        };
    }

    let mut deductions = Vec::new();

    add_manual_valuation_deduction(inputs, &mut deductions);
    for spec in ISSUE_CATEGORY_DEDUCTIONS {
        add_issue_category_deduction(status, spec, &mut deductions);
    }
    add_pending_health_deduction(status, &mut deductions);
    add_document_deductions(inputs, &mut deductions);

    let total_deductions = deductions
        .iter()
        .map(|deduction| u16::from(deduction.points))
        .sum::<u16>()
        .min(100);
    let score = (100_u16.saturating_sub(total_deductions)) as u8;

    DataQualityScore {
        score: Some(score),
        severity: severity_for_score(score),
        explanation: explanation_for_score(score, deductions.is_empty()).to_string(),
        deductions,
        checked_at: Utc::now(),
        is_onboarding: false,
    }
}

fn add_manual_valuation_deduction(
    inputs: &DataQualityInputs,
    deductions: &mut Vec<DataQualityDeduction>,
) {
    let affected_count = inputs
        .manual_valuation_missing_count
        .saturating_add(inputs.manual_valuation_warning_count)
        .saturating_add(inputs.manual_valuation_critical_count);
    if affected_count == 0 {
        return;
    }

    let points = inputs
        .manual_valuation_missing_count
        .saturating_mul(6)
        .saturating_add(inputs.manual_valuation_warning_count.saturating_mul(4))
        .saturating_add(inputs.manual_valuation_critical_count.saturating_mul(8))
        .min(25) as u8;
    let severity = if inputs.manual_valuation_missing_count > 0
        || inputs.manual_valuation_critical_count > 0
    {
        Severity::Error
    } else {
        Severity::Warning
    };

    deductions.push(DataQualityDeduction {
        component: DataQualityComponent::ManualValuationFreshness,
        label: "Manual valuation freshness".to_string(),
        points,
        severity,
        click_target: "/assets/values".to_string(),
        affected_count,
        explanation: "Some manually valued assets need a current valuation.".to_string(),
    });
}

#[derive(Clone, Copy)]
struct IssueCategoryDeductionSpec {
    category: HealthCategory,
    component: DataQualityComponent,
    label: &'static str,
    explanation: &'static str,
    fallback_route: &'static str,
    max_points: u8,
}

const ISSUE_CATEGORY_DEDUCTIONS: [IssueCategoryDeductionSpec; 3] = [
    IssueCategoryDeductionSpec {
        category: HealthCategory::PriceStaleness,
        component: DataQualityComponent::StaleMarketQuotes,
        label: "Stale market quotes",
        explanation: "Some market-priced holdings need current quotes.",
        fallback_route: "/health",
        max_points: 25,
    },
    IssueCategoryDeductionSpec {
        category: HealthCategory::FxIntegrity,
        component: DataQualityComponent::MissingFx,
        label: "Missing FX rates",
        explanation: "Some currency pairs need current exchange rates.",
        fallback_route: "/health",
        max_points: 25,
    },
    IssueCategoryDeductionSpec {
        category: HealthCategory::Classification,
        component: DataQualityComponent::UnclassifiedAssets,
        label: "Unclassified assets",
        explanation: "Some assets need classification before allocation views are complete.",
        fallback_route: "/settings/taxonomies",
        max_points: 20,
    },
];

fn add_issue_category_deduction(
    status: &HealthStatus,
    spec: IssueCategoryDeductionSpec,
    deductions: &mut Vec<DataQualityDeduction>,
) {
    let issues = status.issues_by_category(spec.category);
    if issues.is_empty() {
        return;
    }

    deductions.push(DataQualityDeduction {
        component: spec.component,
        label: spec.label.to_string(),
        points: points_for_issues(&issues, spec.max_points),
        severity: max_severity(&issues),
        click_target: first_route(&issues, spec.fallback_route),
        affected_count: affected_count(&issues),
        explanation: spec.explanation.to_string(),
    });
}

fn add_pending_health_deduction(status: &HealthStatus, deductions: &mut Vec<DataQualityDeduction>) {
    let issues = status
        .issues
        .iter()
        .filter(|issue| {
            !matches!(
                issue.category,
                HealthCategory::PriceStaleness
                    | HealthCategory::FxIntegrity
                    | HealthCategory::Classification
            )
        })
        .collect::<Vec<_>>();
    if issues.is_empty() {
        return;
    }

    deductions.push(DataQualityDeduction {
        component: DataQualityComponent::PendingHealthIssues,
        label: "Pending health issues".to_string(),
        points: points_for_issues(&issues, 15),
        severity: max_severity(&issues),
        click_target: first_route(&issues, "/health"),
        affected_count: affected_count(&issues),
        explanation: "Other health-center items are awaiting review.".to_string(),
    });
}

fn add_document_deductions(inputs: &DataQualityInputs, deductions: &mut Vec<DataQualityDeduction>) {
    if !inputs.document_vault_available {
        return;
    }

    if inputs.missing_source_document_count > 0 {
        deductions.push(DataQualityDeduction {
            component: DataQualityComponent::MissingSourceDocuments,
            label: "Missing source documents".to_string(),
            points: inputs
                .missing_source_document_count
                .saturating_mul(3)
                .min(15) as u8,
            severity: Severity::Warning,
            click_target: "/documents".to_string(),
            affected_count: inputs.missing_source_document_count,
            explanation: "Some records need supporting documents.".to_string(),
        });
    }

    if inputs.pending_extracted_fact_count > 0 {
        deductions.push(DataQualityDeduction {
            component: DataQualityComponent::PendingExtractedFacts,
            label: "Pending extracted facts".to_string(),
            points: inputs
                .pending_extracted_fact_count
                .saturating_mul(4)
                .min(15) as u8,
            severity: Severity::Warning,
            click_target: "/documents/review".to_string(),
            affected_count: inputs.pending_extracted_fact_count,
            explanation: "Document-extracted facts need human review before use.".to_string(),
        });
    }
}

fn points_for_issues(issues: &[&HealthIssue], max_points: u8) -> u8 {
    issues
        .iter()
        .map(|issue| {
            let severity_points = match issue.severity {
                Severity::Info => 1,
                Severity::Warning => 4,
                Severity::Error => 8,
                Severity::Critical => 12,
            };
            let affected_points = issue.affected_count.min(5);
            severity_points + affected_points
        })
        .sum::<u32>()
        .min(u32::from(max_points)) as u8
}

fn max_severity(issues: &[&HealthIssue]) -> Severity {
    issues
        .iter()
        .map(|issue| issue.severity)
        .max()
        .unwrap_or(Severity::Info)
}

fn affected_count(issues: &[&HealthIssue]) -> u32 {
    issues.iter().map(|issue| issue.affected_count.max(1)).sum()
}

fn first_route(issues: &[&HealthIssue], fallback_route: &str) -> String {
    issues
        .iter()
        .find_map(|issue| {
            issue
                .navigate_action
                .as_ref()
                .map(|action| action.route.trim())
                .filter(|route| !route.is_empty())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| fallback_route.to_string())
}

fn severity_for_score(score: u8) -> Severity {
    match score {
        90..=100 => Severity::Info,
        75..=89 => Severity::Warning,
        50..=74 => Severity::Error,
        _ => Severity::Critical,
    }
}

fn explanation_for_score(score: u8, no_deductions: bool) -> &'static str {
    if no_deductions {
        return "Core portfolio data is current based on available checks.";
    }

    match score {
        90..=100 => "Minor data quality items are waiting for review.",
        75..=89 => "A few data quality items may affect portfolio confidence.",
        50..=74 => "Several data quality items should be reviewed before relying on totals.",
        _ => "Important data quality items need attention before relying on totals.",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health::model::{HealthIssue, NavigateAction};

    fn inputs_with_data() -> DataQualityInputs {
        DataQualityInputs {
            has_portfolio_data: true,
            ..DataQualityInputs::default()
        }
    }

    fn issue(
        id: &str,
        severity: Severity,
        category: HealthCategory,
        affected_count: u32,
    ) -> HealthIssue {
        HealthIssue::builder()
            .id(id)
            .severity(severity)
            .category(category)
            .title("Issue")
            .message("Message")
            .affected_count(affected_count)
            .navigate_action(NavigateAction {
                route: "/health".to_string(),
                query: None,
                label: "Open".to_string(),
            })
            .data_hash(format!("hash-{id}"))
            .build()
    }

    #[test]
    fn perfect_data_has_high_score() {
        let score = calculate_data_quality(&HealthStatus::healthy(), &inputs_with_data());

        assert_eq!(score.score, Some(100));
        assert_eq!(score.severity, Severity::Info);
        assert!(score.deductions.is_empty());
        assert!(!score.is_onboarding);
    }

    #[test]
    fn stale_manual_assets_reduce_score() {
        let mut inputs = inputs_with_data();
        inputs.manual_valuation_warning_count = 2;
        inputs.manual_valuation_critical_count = 1;

        let score = calculate_data_quality(&HealthStatus::healthy(), &inputs);

        assert!(score.score.is_some_and(|value| value < 100));
        let deduction = score
            .deductions
            .iter()
            .find(|item| item.component == DataQualityComponent::ManualValuationFreshness);
        assert!(deduction.is_some_and(|item| item.click_target == "/assets/values"));
    }

    #[test]
    fn missing_fx_reduces_score() {
        let status = HealthStatus::from_issues(vec![issue(
            "fx_missing:GBP:USD",
            Severity::Critical,
            HealthCategory::FxIntegrity,
            1,
        )]);

        let score = calculate_data_quality(&status, &inputs_with_data());

        assert!(score.score.is_some_and(|value| value < 100));
        assert!(score
            .deductions
            .iter()
            .any(|item| item.component == DataQualityComponent::MissingFx));
        assert_eq!(score.severity, Severity::Warning);
    }

    #[test]
    fn empty_portfolio_has_neutral_onboarding_state() {
        let score = calculate_data_quality(&HealthStatus::healthy(), &DataQualityInputs::default());

        assert_eq!(score.score, None);
        assert_eq!(score.severity, Severity::Info);
        assert!(score.deductions.is_empty());
        assert!(score.is_onboarding);
    }
}
