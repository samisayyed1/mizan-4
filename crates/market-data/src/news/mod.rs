//! Financial news from TradingView's public news-flow endpoint.
//!
//! Separate from the quote providers: news has a different host
//! (`news-mediator.tradingview.com`), request shape (GET news-flow vs POST
//! scan), and return type, so it lives in its own module rather than on the
//! quote-focused `MarketDataProvider` trait.
//!
//! Like the scanner provider, this is an **unofficial** endpoint: the response
//! shape is parsed defensively (every wire field is optional; a malformed item
//! is skipped, not fatal) and the live behaviour must be confirmed with a real
//! run. Callers treat any failure as "no news" rather than an error, so a news
//! outage never breaks the dashboard.

use std::time::Duration;

use log::debug;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::errors::MarketDataError;

const PROVIDER_ID: &str = "TRADINGVIEW_NEWS";
const NEWS_BASE_URL: &str = "https://news-mediator.tradingview.com/public/news-flow/v2/news";
const TV_WEB_BASE: &str = "https://www.tradingview.com";

/// A financial news headline, surfaced to the UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsArticle {
    /// Stable id (provider story id; falls back to the story path).
    pub id: String,
    pub title: String,
    /// Publish time, unix seconds.
    pub published: i64,
    /// Publisher name, e.g. "Reuters", "Dow Jones Newswires".
    pub source: String,
    /// Absolute article URL.
    pub url: String,
    /// Related TradingView symbols, e.g. ["NASDAQ:AAPL"].
    pub related_symbols: Vec<String>,
    /// Provider urgency flag (higher = more urgent), if present.
    pub urgency: Option<i64>,
}

/// Fetches financial news from TradingView's public news flow.
pub struct NewsProvider {
    client: reqwest::Client,
    base_url: String,
}

impl NewsProvider {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: NEWS_BASE_URL.to_string(),
        }
    }

    #[cfg(test)]
    fn with_base_url(base_url: impl Into<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.into(),
        }
    }

    /// Fetch the latest news, optionally filtered to a single TradingView
    /// symbol (`EXCHANGE:TICKER`). Returns articles newest-first as provided.
    pub async fn fetch_news(
        &self,
        symbol: Option<&str>,
    ) -> Result<Vec<NewsArticle>, MarketDataError> {
        // `filter` is repeated; reqwest serialises a slice of tuples as repeated keys.
        let mut query: Vec<(&str, String)> = vec![
            ("filter", "lang:en".to_string()),
            ("client", "overview".to_string()),
            ("streaming", "false".to_string()),
            ("user_prostatus", "non_pro".to_string()),
        ];
        if let Some(sym) = symbol {
            query.push(("filter", format!("symbol:{sym}")));
        }

        let response = self
            .client
            .get(&self.base_url)
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            .header("Origin", TV_WEB_BASE)
            .header("Referer", "https://www.tradingview.com/")
            .query(&query)
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    MarketDataError::Timeout {
                        provider: PROVIDER_ID.to_string(),
                    }
                } else {
                    MarketDataError::ProviderError {
                        provider: PROVIDER_ID.to_string(),
                        message: e.to_string(),
                    }
                }
            })?;

        if response.status().as_u16() == 429 {
            return Err(MarketDataError::RateLimited {
                provider: PROVIDER_ID.to_string(),
            });
        }
        if !response.status().is_success() {
            return Err(MarketDataError::ProviderError {
                provider: PROVIDER_ID.to_string(),
                message: format!("HTTP {}", response.status()),
            });
        }

        let body: Value = response
            .json()
            .await
            .map_err(|e| MarketDataError::ProviderError {
                provider: PROVIDER_ID.to_string(),
                message: format!("invalid JSON: {e}"),
            })?;

        debug!(
            "News: fetched {} bytes for symbol {:?}",
            body.to_string().len(),
            symbol
        );
        Ok(parse_news_response(&body))
    }
}

impl Default for NewsProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewsItemWire {
    id: Option<String>,
    title: Option<String>,
    published: Option<i64>,
    story_path: Option<String>,
    related_symbols: Option<Vec<RelatedSymbolWire>>,
    provider: Option<ProviderWire>,
    urgency: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ProviderWire {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RelatedSymbolWire {
    symbol: Option<String>,
}

/// Parse a news-flow response into articles. Tolerant of an `{ "items": [...] }`
/// object or a bare top-level array, missing/null fields, and malformed items
/// (which are skipped). A title and a story path are the minimum required.
pub fn parse_news_response(body: &Value) -> Vec<NewsArticle> {
    let items: &[Value] = match body {
        Value::Array(arr) => arr.as_slice(),
        Value::Object(_) => body
            .get("items")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]),
        _ => &[],
    };
    items.iter().filter_map(parse_item).collect()
}

fn parse_item(value: &Value) -> Option<NewsArticle> {
    let wire: NewsItemWire = serde_json::from_value(value.clone()).ok()?;
    let title = wire.title.filter(|t| !t.trim().is_empty())?;
    let story_path = wire.story_path.filter(|p| !p.trim().is_empty())?;

    let url = if story_path.starts_with("http") {
        story_path.clone()
    } else {
        format!("{TV_WEB_BASE}{story_path}")
    };
    let id = wire
        .id
        .filter(|i| !i.is_empty())
        .unwrap_or_else(|| story_path.clone());
    let source = wire.provider.and_then(|p| p.name).unwrap_or_default();
    let related_symbols = wire
        .related_symbols
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| s.symbol)
        .filter(|s| !s.is_empty())
        .collect();

    Some(NewsArticle {
        id,
        title,
        published: wire.published.unwrap_or(0),
        source,
        url,
        related_symbols,
        urgency: wire.urgency,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_a_well_formed_feed() {
        let body = json!({
            "items": [
                {
                    "id": "DJN_DN1:0",
                    "title": "Meta releases new app",
                    "published": 1779478380i64,
                    "urgency": 2,
                    "storyPath": "/news/DJN_DN1:0-meta/",
                    "relatedSymbols": [{ "symbol": "NASDAQ:META", "logoid": "meta" }],
                    "provider": { "id": "dow-jones", "name": "Dow Jones Newswires" }
                }
            ]
        });
        let out = parse_news_response(&body);
        assert_eq!(out.len(), 1);
        let a = &out[0];
        assert_eq!(a.id, "DJN_DN1:0");
        assert_eq!(a.title, "Meta releases new app");
        assert_eq!(a.published, 1779478380);
        assert_eq!(a.source, "Dow Jones Newswires");
        assert_eq!(a.url, "https://www.tradingview.com/news/DJN_DN1:0-meta/");
        assert_eq!(a.related_symbols, vec!["NASDAQ:META"]);
        assert_eq!(a.urgency, Some(2));
    }

    #[test]
    fn tolerates_missing_optional_fields() {
        // No id, no provider, no relatedSymbols, no urgency — still valid.
        let body = json!({
            "items": [
                { "title": "Bare headline", "published": 100, "storyPath": "/news/x/" }
            ]
        });
        let out = parse_news_response(&body);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].id, "/news/x/"); // falls back to story path
        assert_eq!(out[0].source, "");
        assert!(out[0].related_symbols.is_empty());
        assert_eq!(out[0].urgency, None);
    }

    #[test]
    fn skips_items_missing_required_fields() {
        let body = json!({
            "items": [
                { "title": "No path" },                       // missing storyPath -> skip
                { "storyPath": "/news/y/" },                  // missing title -> skip
                { "title": "  ", "storyPath": "/news/z/" },   // blank title -> skip
                { "title": "Good", "storyPath": "/news/ok/" } // kept
            ]
        });
        let out = parse_news_response(&body);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].title, "Good");
    }

    #[test]
    fn handles_empty_and_missing_items() {
        assert!(parse_news_response(&json!({ "items": [] })).is_empty());
        assert!(parse_news_response(&json!({ "totalCount": 0 })).is_empty());
        assert!(parse_news_response(&json!(null)).is_empty());
    }

    #[test]
    fn supports_bare_top_level_array() {
        let body = json!([
            { "title": "Array form", "published": 1, "storyPath": "/news/arr/" }
        ]);
        let out = parse_news_response(&body);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].title, "Array form");
    }

    #[test]
    fn keeps_absolute_url_as_is() {
        let body = json!({
            "items": [
                { "title": "Abs", "storyPath": "https://example.com/a" }
            ]
        });
        let out = parse_news_response(&body);
        assert_eq!(out[0].url, "https://example.com/a");
    }

    #[test]
    fn provider_constructs() {
        let p = NewsProvider::with_base_url("http://localhost:0");
        assert_eq!(p.base_url, "http://localhost:0");
    }
}
