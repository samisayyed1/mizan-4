import { getDynamicNavItems, subscribeToNavigationUpdates } from "@/addons/addons-runtime-context";
import { Icons } from "@mizan/ui/components/ui/icons";
import { useEffect, useState } from "react";

export interface NavLink {
  title: string;
  href: string;
  icon?: React.ReactNode;
  keywords?: string[];
  label?: string; // Optional descriptive label for launcher/search
}

export interface NavigationProps {
  primary: NavLink[];
  secondary?: NavLink[];
  addons?: NavLink[];
}

// Phase 1 — boomer-friendly primary navigation.
//
// The primary nav is intentionally short and concrete: Home, Portfolio,
// Activities, Goals, Settings. Advanced views (Insights, Performance,
// Income, Health, Assistant, Connect, addons) remain reachable through
// direct routes, in-page links, and the secondary nav block — they are
// no longer competing for primary attention.
//
// Documents and Reports will be added as primary entries when Phase 3
// (Document Vault) and Phase 5 (Report Builder) actually exist; adding
// them now would be placeholder navigation, which is forbidden by the
// build plan's hard rules.
const staticNavigation: NavigationProps = {
  primary: [
    {
      icon: <Icons.Dashboard className="size-6" />,
      title: "Home",
      href: "/dashboard",
      keywords: ["home", "dashboard", "overview", "summary"],
      label: "View Home",
    },
    {
      icon: <Icons.Holdings className="size-6" />,
      title: "Portfolio",
      href: "/holdings",
      keywords: ["portfolio", "holdings", "assets", "positions", "stocks"],
      label: "View Portfolio",
    },
    {
      icon: <Icons.Activity className="size-6" />,
      title: "Activities",
      href: "/activities",
      keywords: ["activities", "transactions", "trades", "history"],
      label: "View Activities",
    },
    {
      icon: <Icons.Goals className="size-6" />,
      title: "Goals",
      href: "/goals",
      keywords: ["goals", "fire", "retire", "retirement", "savings", "planner"],
      label: "View Goals",
    },
    {
      icon: <Icons.Settings className="size-6" />,
      title: "Settings",
      href: "/settings",
      keywords: ["settings", "preferences", "config", "configuration"],
      label: "Open Settings",
    },
  ],
  secondary: [
    {
      icon: <Icons.Insight className="size-6" />,
      title: "Insights",
      href: "/insights",
      keywords: ["insights", "analytics"],
      label: "View Insights",
    },
    {
      icon: <Icons.Sparkles className="size-6" />,
      title: "Assistant",
      href: "/assistant",
      keywords: ["ai", "assistant", "chat", "help", "ask"],
      label: "AI Assistant",
    },
    {
      icon: <Icons.Link className="size-6" />,
      title: "Connect",
      href: "/connect",
      keywords: ["connect", "sync", "broker", "device", "supabase", "cloud", "account"],
      label: "Mizan Connect",
    },
  ],
};

export function useNavigation() {
  const [dynamicItems, setDynamicItems] = useState<NavigationProps["addons"]>([]);

  // Subscribe to navigation updates from addons
  useEffect(() => {
    const updateDynamicItems = () => {
      const itemsFromRuntime = getDynamicNavItems();
      setDynamicItems(itemsFromRuntime);
    };

    // Initial load
    updateDynamicItems();

    // Subscribe to updates
    const unsubscribe = subscribeToNavigationUpdates(updateDynamicItems);

    return () => {
      unsubscribe();
    };
  }, []);

  // Combine static navigation items with addons grouped separately.
  // Hide desktop-only features (FIRE Planner) in web mode.
  const primary = staticNavigation.primary;
  const navigation: NavigationProps = {
    primary,
    secondary: staticNavigation.secondary,
    addons: dynamicItems,
  };

  return navigation;
}

export function isPathActive(pathname: string, href: string): boolean {
  if (!href) {
    return false;
  }

  const ensureLeadingSlash = href.startsWith("/") ? href : `/${href}`;
  const normalize = (value: string) => {
    if (value.length > 1 && value.endsWith("/")) {
      return value.slice(0, -1);
    }
    return value;
  };

  const normalizedHref = normalize(ensureLeadingSlash);
  const normalizedPath = normalize(pathname);

  if (normalizedHref === "/") {
    return normalizedPath === "/";
  }

  // Dashboard and Net Worth are grouped together
  if (normalizedHref === "/dashboard") {
    return (
      normalizedPath === "/" || normalizedPath === "/dashboard" || normalizedPath === "/net-worth"
    );
  }

  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}
