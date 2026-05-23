import { useQuery } from "@tanstack/react-query";

import { getEntitlements } from "@/adapters";
import { QueryKeys } from "@/lib/query-keys";

import { type Entitlements, withinLimit } from "../types";

/** The Free-tier defaults, used while loading or when signed out. */
const FREE_ENTITLEMENTS: Entitlements = {
  plan: "free",
  maxPortfolios: 1,
  maxHoldings: 20,
  maxAssetClasses: 2,
  brokerSync: false,
  maxBrokerConnections: 0,
  deviceSync: false,
  cloudBackup: false,
  managedAi: false,
  aiCreditsMonthly: 0,
  newsDailyLimit: 3,
  marketRefreshDailyLimit: 5,
  csvImportsMonthly: 1,
  advancedReports: false,
  advisorMode: false,
};

/**
 * The current user's subscription entitlements. Resolves to Free defaults
 * while loading or signed out, so callers can read fields unconditionally
 * (`entitlements.brokerSync`, etc.) without null checks.
 *
 * The query is long-lived; invalidate `QueryKeys.ENTITLEMENTS` after a
 * subscription change (e.g. returning from Stripe Checkout) to refresh.
 */
export function useEntitlements() {
  const query = useQuery({
    queryKey: [QueryKeys.ENTITLEMENTS],
    queryFn: getEntitlements,
    staleTime: 5 * 60 * 1000,
  });

  const entitlements = query.data ?? FREE_ENTITLEMENTS;

  return {
    entitlements,
    isLoading: query.isLoading,
    isPaid: entitlements.plan !== "free",
    /** Whether adding one more of `current` stays within `limit`. */
    canAddWithin: (current: number, limit: number) => withinLimit(current, limit),
  };
}
