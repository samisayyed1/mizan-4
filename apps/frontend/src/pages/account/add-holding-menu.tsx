/**
 * "Add Holding" chooser — the production-grade replacement for the
 * single-purpose Add button that previously just opened the manual
 * edit sheet.
 *
 * Feroz on the May-17 call about empty asset classes:
 *   "it should show me a popup saying that add new account you know
 *    and then add new whatever mumu or ibkr or whatever or csv or
 *    whatever all that"
 *
 * That popup is this component. Clicking the Add button anywhere
 * inside the asset-class drill-down (or the empty-state card) opens
 * a dropdown menu with three context-aware options:
 *
 *   1. Add manually   — opens the existing portfolio-edit sheet
 *                       (the only flow that creates a holding inline,
 *                       no navigation away)
 *   2. Connect broker — routes to /connect, where the user can mint a
 *                       SnapTrade login portal for IBKR / Moomoo /
 *                       Plaid-supported banks etc. Only shown for
 *                       asset classes that brokers actually expose
 *                       (Stocks / Sukuks / ETFs / Bonds / Bank
 *                       Accounts). Hidden for Property / Collectibles
 *                       / Precious Metals / Other — where the broker
 *                       option would be misleading.
 *   3. Import CSV     — deep-links into the activity import wizard
 *                       with `?account=<accountId>` already filled
 *                       in, so the user lands on the mapping step
 *                       with the portfolio pre-selected.
 *
 * Reference: .claude/product-notes/feroz-meeting-2026-05-17.md
 * decision #7 + transcript on Step 6 "Holdings Behavior".
 */

import { AssetClass, ASSET_CLASS_LABELS } from "@/lib/asset-classes";
import { Button } from "@mizan/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mizan/ui/components/ui/dropdown-menu";
import { Icons } from "@mizan/ui/components/ui/icons";
import { Link } from "react-router-dom";

/**
 * Asset classes that have a meaningful broker-API path. Property,
 * Collectibles, Precious Metals, Other → not on SnapTrade / IBKR /
 * Moomoo, so the broker option is suppressed for those. Adding new
 * tradeable classes? Add them here.
 */
const BROKER_SUPPORTED_CLASSES = new Set<AssetClass>([
  AssetClass.STOCKS,
  AssetClass.SUKUKS,
  AssetClass.ETFS,
  AssetClass.BONDS,
  AssetClass.BANK_ACCOUNTS,
]);

export interface AddHoldingMenuProps {
  /** The asset class the menu is being opened for. Drives copy + which options appear. */
  cls: AssetClass;
  /** Portfolio (account) id — used to prefill the CSV import destination. */
  accountId: string;
  /** Fires the inline manual-add flow (the parent owns the edit sheet state). */
  onManualAdd: () => void;
  /**
   * `inline` — small button suitable for the drill-down header
   *            (next to the Back button).
   * `cta`    — large button suitable for the empty-state full card.
   */
  size?: "inline" | "cta";
}

export function AddHoldingMenu({
  cls,
  accountId,
  onManualAdd,
  size = "inline",
}: AddHoldingMenuProps) {
  const labels = ASSET_CLASS_LABELS[cls];
  const showBroker = BROKER_SUPPORTED_CLASSES.has(cls);

  const trigger =
    size === "cta" ? (
      <Button size="default">
        <Icons.Plus className="mr-1.5 h-4 w-4" />
        Add {labels.singular}
        <Icons.ChevronDown className="ml-1 h-4 w-4 opacity-70" />
      </Button>
    ) : (
      <Button size="sm" variant="outline">
        <Icons.Plus className="mr-1 h-4 w-4" />
        Add {labels.singular}
        <Icons.ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
          Add a {labels.singular.toLowerCase()}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={onManualAdd}
          className="cursor-pointer items-start gap-3 py-2.5"
        >
          <Icons.Pencil className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Add manually</p>
            <p className="text-muted-foreground text-xs leading-snug">
              Type in the {labels.singular.toLowerCase()} yourself — fastest for one-off entries.
            </p>
          </div>
        </DropdownMenuItem>

        {showBroker && (
          <DropdownMenuItem asChild className="cursor-pointer items-start gap-3 py-2.5">
            <Link to="/connect">
              <Icons.CloudSync className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Connect a broker</p>
                <p className="text-muted-foreground text-xs leading-snug">
                  Auto-sync from IBKR, Moomoo, your bank and others via Mizan Connect.
                </p>
              </div>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild className="cursor-pointer items-start gap-3 py-2.5">
          <Link to={`/import?account=${encodeURIComponent(accountId)}`}>
            <Icons.Import className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Import from CSV</p>
              <p className="text-muted-foreground text-xs leading-snug">
                Upload a CSV from any broker or bank — the importer maps columns automatically.
              </p>
            </div>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AddHoldingMenu;
