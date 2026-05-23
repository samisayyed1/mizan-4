import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAccounts } from "@/hooks/use-accounts";
import { AlternativeAssetKind } from "@/lib/constants";
import { AddBankAccountModal } from "@/pages/asset/alternative-assets/components/add-bank-account-modal";
import { AlternativeAssetQuickAddModal } from "@/pages/asset/alternative-assets/components/alternative-asset-quick-add-modal";

import { AddAssetWizard, type AddAssetKind } from "./add-asset-wizard";

interface AddAssetContextValue {
  /** Open the top-level "what would you like to add?" wizard. */
  open: () => void;
}

const AddAssetContext = createContext<AddAssetContextValue | null>(null);

/**
 * Provider that owns the unified Add-Asset wizard and the per-kind editors it
 * delegates to. Mount once near the top of the app tree (inside the router so
 * `useNavigate` works); call `useAddAsset().open()` from anywhere — the nav,
 * the dashboard action palette, the per-portfolio empty state, etc.
 *
 * The wizard itself only routes the user to the right inner editor; it never
 * writes to the database. Each inner editor is the same modal the rest of the
 * app already uses, so there's exactly one code path per asset kind.
 */
export function AddAssetProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { accounts } = useAccounts();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [altKind, setAltKind] = useState<AlternativeAssetKind>(AlternativeAssetKind.PROPERTY);

  const open = useCallback(() => setWizardOpen(true), []);

  const handlePick = useCallback(
    (kind: AddAssetKind) => {
      setWizardOpen(false);
      switch (kind) {
        case "securities": {
          // Securities still live inside a specific portfolio. Pick the
          // default-or-first one and deep-link to the holdings editor; the
          // account page reads the `addHoldings=1` query param and pops the
          // existing editor automatically. (One-portfolio Free users land
          // straight in the editor; multi-portfolio users can switch via the
          // portfolio selector in the page header.)
          const target = accounts.find((a) => a.isDefault) ?? accounts[0];
          if (target) {
            navigate(`/accounts/${target.id}?addHoldings=1`);
          } else {
            // No portfolios at all — send them to the Settings → Portfolios
            // page to create one first.
            navigate("/settings/accounts");
          }
          return;
        }
        case "bank":
          setBankOpen(true);
          return;
        case "property":
          setAltKind(AlternativeAssetKind.PROPERTY);
          setAltOpen(true);
          return;
        case "metal":
          setAltKind(AlternativeAssetKind.PRECIOUS_METAL);
          setAltOpen(true);
          return;
        case "collectible":
          setAltKind(AlternativeAssetKind.COLLECTIBLE);
          setAltOpen(true);
          return;
        case "liability":
          setAltKind(AlternativeAssetKind.LIABILITY);
          setAltOpen(true);
          return;
        case "other":
          setAltKind(AlternativeAssetKind.OTHER);
          setAltOpen(true);
          return;
      }
    },
    [accounts, navigate],
  );

  const value = useMemo<AddAssetContextValue>(() => ({ open }), [open]);

  return (
    <AddAssetContext.Provider value={value}>
      {children}
      <AddAssetWizard open={wizardOpen} onOpenChange={setWizardOpen} onPick={handlePick} />
      <AddBankAccountModal open={bankOpen} onOpenChange={setBankOpen} />
      <AlternativeAssetQuickAddModal
        open={altOpen}
        onOpenChange={setAltOpen}
        defaultKind={altKind}
      />
    </AddAssetContext.Provider>
  );
}

export function useAddAsset(): AddAssetContextValue {
  const ctx = useContext(AddAssetContext);
  if (!ctx) {
    throw new Error("useAddAsset must be used within an AddAssetProvider");
  }
  return ctx;
}
