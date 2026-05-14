import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Icons } from "@mizan/ui/components/ui/icons";
import { Link } from "react-router-dom";

/**
 * A single Quick Action button.
 *
 * `route === null` means the underlying feature doesn't exist yet —
 * the button is rendered as a disabled tile with an honest
 * "Available after X" note. This is transparent disclosure, not
 * placeholder navigation: clicking does nothing because there is
 * nothing real to navigate to yet.
 */
export interface QuickActionDef {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string | null;
  pendingReason?: string;
}

/**
 * The five Quick Actions specified by the build plan.
 *
 * Add Asset and Update Values both surface from `/overview` — the
 * existing dashboard already exposes the Alternative Asset modal and
 * the manual holdings editor today. Review Issues goes to the existing
 * `/health` screen. Upload Document and Generate Report are openly
 * marked pending until Phase 3 (Document Vault) and Phase 5 (Report
 * Builder) ship.
 */
export const QUICK_ACTIONS: ReadonlyArray<QuickActionDef> = [
  {
    id: "add-asset",
    label: "Add Asset",
    description: "Add a new asset to your portfolio.",
    icon: Icons.Plus,
    route: "/assets/new",
  },
  {
    id: "update-values",
    label: "Update Values",
    description: "Refresh manual valuations and balances.",
    icon: Icons.Pencil,
    route: "/assets/values",
  },
  {
    id: "upload-document",
    label: "Upload Document",
    description: "Attach a statement, contract or valuation.",
    icon: Icons.Upload,
    route: null,
    pendingReason: "Available after Document Vault ships.",
  },
  {
    id: "generate-report",
    label: "Generate Report",
    description: "Build a portfolio or tax-prep report.",
    icon: Icons.FileText,
    route: null,
    pendingReason: "Available after the Report Builder ships.",
  },
  {
    id: "review-issues",
    label: "Review Issues",
    description: "Resolve data-quality issues.",
    icon: Icons.ShieldAlert,
    route: "/health",
  },
];

interface QuickActionsViewProps {
  actions?: ReadonlyArray<QuickActionDef>;
}

/**
 * Pure rendering component for the Quick Actions card. Tests pass the
 * actions list explicitly so each branch (routed / pending) can be
 * exercised in isolation.
 */
export function QuickActionsView({ actions = QUICK_ACTIONS }: QuickActionsViewProps) {
  return (
    <Card data-testid="home-quick-actions">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {actions.map((action) => {
            const Icon = action.icon;
            const inner = (
              <>
                <Icon className="mx-auto mb-1 size-5" />
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-muted-foreground line-clamp-2 text-xs">
                  {action.route === null ? action.pendingReason : action.description}
                </div>
              </>
            );
            return action.route !== null ? (
              <Link
                key={action.id}
                to={action.route}
                className="border-border/60 hover:bg-accent rounded-md border p-3 text-center transition-colors"
                data-testid={`home-quick-action-${action.id}`}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={action.id}
                type="button"
                disabled
                aria-disabled="true"
                className="border-border/40 text-muted-foreground/80 cursor-not-allowed rounded-md border border-dashed p-3 text-center"
                data-testid={`home-quick-action-${action.id}`}
                data-pending="true"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Quick Actions — Home command center module #5.
 */
export function QuickActions() {
  return <QuickActionsView />;
}
