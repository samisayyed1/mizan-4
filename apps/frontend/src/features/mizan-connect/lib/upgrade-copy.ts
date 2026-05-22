import type { GatedFeature } from "../types";

export interface UpgradeCopy {
  title: string;
  body: string;
  /** Suggested plan slug to highlight in the CTA. */
  suggestedTier: string;
}

/**
 * Contextual upsell copy keyed by gated feature (product manual §15). Used by
 * the upgrade modal so every paywall speaks to the specific action the user
 * just attempted, not a generic "upgrade now".
 */
const COPY: Record<GatedFeature, UpgradeCopy> = {
  max_portfolios: {
    title: "Add more portfolios",
    body: "Free includes one portfolio. Upgrade to Basic to manage up to 5 portfolios across countries, brokers, and family goals.",
    suggestedTier: "basic",
  },
  max_asset_classes: {
    title: "Track your full wealth",
    body: "Free includes 2 asset classes. Upgrade to track stocks, sukuk, property, bank accounts, gold, and liabilities — all in one place.",
    suggestedTier: "basic",
  },
  max_holdings: {
    title: "Add more holdings",
    body: "You've reached your holdings limit on the Free plan. Upgrade to track your whole portfolio without limits.",
    suggestedTier: "basic",
  },
  managed_ai: {
    title: "Meet Mizan AI",
    body: "Mizan AI is included with a subscription. Ask about your portfolio, net worth, goals, and monthly changes — no API key setup required.",
    suggestedTier: "basic",
  },
  device_sync: {
    title: "Sync across your devices",
    body: "Securely sync your encrypted wealth data across devices with a Mizan subscription.",
    suggestedTier: "basic",
  },
  broker_sync: {
    title: "Connect your broker",
    body: "Connect your broker and keep your portfolio updated automatically with Mizan Connect — included with Pro.",
    suggestedTier: "pro",
  },
  csv_imports: {
    title: "Import more statements",
    body: "Upgrade for more monthly CSV imports with AI-assisted column mapping.",
    suggestedTier: "basic",
  },
  advanced_reports: {
    title: "Unlock deep reports",
    body: "Upgrade to Pro for deep portfolio reports, income and rental summaries, and AI wealth analysis.",
    suggestedTier: "pro",
  },
};

const FALLBACK: UpgradeCopy = {
  title: "Upgrade Mizan",
  body: "This feature is part of a Mizan subscription. Upgrade to unlock it.",
  suggestedTier: "basic",
};

export function upgradeCopyFor(feature: string): UpgradeCopy {
  return COPY[feature as GatedFeature] ?? FALLBACK;
}
