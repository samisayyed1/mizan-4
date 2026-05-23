import { ApplicationShell } from "@mizan/ui";
import { Icons } from "@mizan/ui/components/ui/icons";
import { Separator } from "@mizan/ui/components/ui/separator";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarNav } from "./sidebar-nav";

// M2 settings groups: simplified into six top-level buckets so first-time
// users don't have to think about which section a given page lives under.
// Operator/power-user surfaces (Market Data, Classifications, Backup/Export,
// Add-ons) collapse into "Advanced" — still one click away, not crowding the
// list for the 95% of users who never touch them.
const settingsSections = [
  {
    title: "Preferences",
    items: [
      {
        title: "General",
        href: "general",
        subtitle: "Currency, exchange rates, and updates",
        icon: <Icons.Settings2 className="size-5" />,
      },
      {
        title: "Appearance",
        href: "appearance",
        subtitle: "Theme, font, and menu bar",
        icon: <Icons.Monitor className="size-5" />,
      },
    ],
  },
  {
    title: "Wealth",
    items: [
      {
        title: "Portfolios",
        href: "accounts",
        subtitle: "Your investment and savings portfolios",
        icon: <Icons.CreditCard className="size-5" />,
      },
      {
        title: "Contribution Limits",
        href: "contribution-limits",
        subtitle: "Tax-advantaged account limits",
        icon: <Icons.TrendingUp className="size-5" />,
      },
      {
        title: "Securities",
        href: "securities",
        subtitle: "Symbol library and custom assets",
        icon: <Icons.BadgeDollarSign className="size-5" />,
      },
      {
        title: "Zakat",
        href: "/zakat",
        subtitle: "Annual Zakat assessment (Pro)",
        icon: <Icons.Coins className="size-5" />,
      },
      {
        title: "Reports",
        href: "/reports",
        subtitle: "Income, rental, payoff, portfolio health (Pro)",
        icon: <Icons.FileText className="size-5" />,
      },
      {
        title: "Monthly AI report",
        href: "/reports/monthly",
        subtitle: "AI wealth summary, generated each month",
        icon: <Icons.Sparkles className="size-5" />,
      },
    ],
  },
  {
    title: "Sync",
    items: [
      {
        title: "Mizan Connect",
        href: "connect",
        subtitle: "Subscription, broker sync, device sync, cloud backup",
        icon: <Icons.CloudSync2 className="text-primary size-6" />,
      },
    ],
  },
  {
    title: "AI",
    items: [
      {
        title: "Providers",
        href: "ai-providers",
        subtitle: "Mizan AI (included) or bring your own key",
        icon: <Icons.SparklesOutline className="size-5" />,
      },
    ],
  },
  {
    title: "Advanced",
    items: [
      {
        title: "Market Data",
        href: "market-data",
        subtitle: "Quote sources, sync schedule, manual imports",
        icon: <Icons.BarChart className="size-5" />,
      },
      {
        title: "Classifications",
        href: "taxonomies",
        subtitle: "Asset classification hierarchies (sectors, regions)",
        icon: <Icons.Blocks className="size-5" />,
      },
      {
        title: "Backup & Export",
        href: "exports",
        subtitle: "Local backup files and data exports",
        icon: <Icons.Download className="size-5" />,
      },
      {
        title: "Add-ons",
        href: "addons",
        subtitle: "Extend Mizan with optional features",
        icon: <Icons.Package className="size-5" />,
      },
    ],
  },
  {
    title: "About",
    items: [
      {
        title: "About",
        href: "about",
        subtitle: "App version, build, and licenses",
        icon: <Icons.InfoCircle className="size-5" />,
      },
    ],
  },
];

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const sections = settingsSections;

  // Check if we're on the main settings page (mobile) or a specific setting page
  const isMainSettingsPage =
    location.pathname === "/settings" || location.pathname === "/settings/";

  // Mobile-first: show list view on main page, detail view on specific pages
  return (
    <ApplicationShell className="settings-root app-shell h-screen overflow-x-hidden">
      {/* Mobile Layout */}
      <div className="w-full lg:hidden">
        {isMainSettingsPage ? (
          // Mobile Settings List View (carded list with dividers)
          <div className="scan-hide-target w-full max-w-full overflow-x-hidden">
            <div className="bg-background/95 supports-backdrop-filter:bg-background/60 pt-safe sticky top-0 z-10 border-b backdrop-blur">
              <div className="flex min-h-[60px] items-center justify-center px-4">
                <h1 className="text-lg font-semibold">Settings</h1>
              </div>
            </div>
            <div className="space-y-6 p-3 pb-[calc(var(--mobile-nav-ui-height)+max(var(--mobile-nav-gap),env(safe-area-inset-bottom)))] lg:p-4 lg:pb-4">
              {sections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <div className="text-muted-foreground px-2 text-xs font-semibold uppercase tracking-widest">
                    {section.title}
                  </div>
                  <div className="divide-border bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
                    {section.items.map((item) => (
                      <button
                        type="button"
                        key={item.href}
                        onClick={() =>
                          navigate(item.href.startsWith("/") ? item.href : `/settings/${item.href}`)
                        }
                        className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors active:opacity-90"
                        aria-label={item.title}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="text-muted-foreground shrink-0">{item.icon}</div>
                          <div className="min-w-0">
                            <div className="text-foreground truncate text-base font-medium">
                              {item.title}
                            </div>
                            {item?.subtitle && (
                              <div className="text-muted-foreground truncate text-sm">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <Icons.ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="scan-hide-target pt-safe w-full max-w-full overflow-x-hidden">
            <div className="w-full max-w-full overflow-x-hidden scroll-smooth">
              <div className="p-2 pb-[calc(var(--mobile-nav-ui-height)+max(var(--mobile-nav-gap),env(safe-area-inset-bottom)))] lg:p-4 lg:pb-4">
                <Outlet />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex lg:w-full lg:justify-start">
        <div className="flex w-full max-w-6xl flex-col px-2 py-8">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          </div>
          <Separator className="my-6" />
          <div className="flex gap-10">
            <aside className="hidden w-[240px] shrink-0 lg:sticky lg:top-24 lg:flex lg:flex-col lg:self-start">
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <div className="text-muted-foreground pl-2 text-sm font-light uppercase tracking-widest">
                      {section.title}
                    </div>
                    <SidebarNav items={section.items} />
                  </div>
                ))}
              </div>
            </aside>
            <div className="mb-8 min-w-0 flex-1">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </ApplicationShell>
  );
}
