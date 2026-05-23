import { Button } from "@mizan/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@mizan/ui/components/ui/dialog";
import { Icons } from "@mizan/ui/components/ui/icons";

/**
 * Asset kinds the wizard routes between. Mirrors the kind set the manual
 * enumerates ("Stock/ETF, Sukuk/Bond, Bank Account, Property, Gold/Precious
 * Metal, Liability, Other") collapsed so the user only sees one row per real
 * decision. Sukuk + Bonds + Stocks + ETFs all share the same editor
 * (securities), so they collapse into a single tile.
 */
export type AddAssetKind =
  | "securities"
  | "bank"
  | "property"
  | "metal"
  | "collectible"
  | "liability"
  | "other";

interface TileSpec {
  kind: AddAssetKind;
  title: string;
  description: string;
  iconKey: keyof typeof Icons;
}

const TILES: TileSpec[] = [
  {
    kind: "securities",
    title: "Stocks, ETFs, Sukuk or Bonds",
    description: "Anything you'd add to a brokerage portfolio.",
    iconKey: "TrendingUp",
  },
  {
    kind: "bank",
    title: "Bank account or cash",
    description: "Track balances in any country and currency.",
    iconKey: "Wallet",
  },
  {
    kind: "property",
    title: "Property",
    description: "Home, rental, land. Add rental income if any.",
    iconKey: "Home",
  },
  {
    kind: "metal",
    title: "Gold or precious metals",
    description: "Track ounces or grams at their current value.",
    iconKey: "Coins",
  },
  {
    kind: "collectible",
    title: "Collectibles",
    description: "Watches, art, anything else you value separately.",
    iconKey: "Gem",
  },
  {
    kind: "liability",
    title: "Loan or liability",
    description: "Mortgages, car loans, personal debt. Reduces net worth.",
    iconKey: "FileText",
  },
  {
    kind: "other",
    title: "Something else",
    description: "Anything that doesn't fit the categories above.",
    iconKey: "Ellipsis",
  },
];

export interface AddAssetWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (kind: AddAssetKind) => void;
}

/**
 * Step 1 of the unified Add flow: a single screen of clearly-labeled tiles.
 * Step 2 (the actual form) is delegated to the existing per-kind editors —
 * see `add-asset-provider.tsx`. No data ever passes through this dialog;
 * it's pure routing.
 */
export function AddAssetWizard({ open, onOpenChange, onPick }: AddAssetWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>What would you like to add?</DialogTitle>
          <DialogDescription>
            Pick what you're tracking — the next step will ask only what's needed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
          {TILES.map((tile) => {
            const Icon = Icons[tile.iconKey] as React.ComponentType<{ className?: string }>;
            return (
              <Button
                key={tile.kind}
                variant="outline"
                onClick={() => onPick(tile.kind)}
                className="h-auto items-start justify-start whitespace-normal p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{tile.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-snug">
                      {tile.description}
                    </p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
