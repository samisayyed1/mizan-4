import { Button } from "@mizan/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@mizan/ui/components/ui/dialog";
import { Icons } from "@mizan/ui/components/ui/icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { parseGatedError } from "../lib/gated-error";
import { setGatedErrorHandler } from "../lib/gated-error-bus";
import { upgradeCopyFor, type UpgradeCopy } from "../lib/upgrade-copy";

interface UpgradeGateContextValue {
  /** Open the contextual upgrade modal for a gated feature. */
  requestUpgrade: (feature: string) => void;
  /**
   * If `error` is a backend GatedError, open the matching upgrade modal and
   * return `true` (handled). Otherwise return `false` so the caller can show a
   * normal error. Use in command/mutation `onError` handlers.
   */
  handleGatedError: (error: unknown) => boolean;
}

const UpgradeGateContext = createContext<UpgradeGateContextValue | null>(null);

/**
 * App-level provider exposing a single contextual upgrade modal. Wrap the app
 * once; trigger via `useUpgradeGate().requestUpgrade(feature)` or by funneling
 * caught errors through `handleGatedError`.
 */
export function UpgradeGateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<UpgradeCopy | null>(null);

  const requestUpgrade = useCallback((feature: string) => {
    setCopy(upgradeCopyFor(feature));
    setOpen(true);
  }, []);

  // Bridge the module-level bus (used by the global mutation-cache error
  // handler, which lives above this provider) to this modal.
  useEffect(() => {
    setGatedErrorHandler(requestUpgrade);
    return () => setGatedErrorHandler(null);
  }, [requestUpgrade]);

  const handleGatedError = useCallback(
    (error: unknown) => {
      const gated = parseGatedError(error);
      if (!gated) return false;
      requestUpgrade(gated.feature);
      return true;
    },
    [requestUpgrade],
  );

  const value = useMemo(
    () => ({ requestUpgrade, handleGatedError }),
    [requestUpgrade, handleGatedError],
  );

  return (
    <UpgradeGateContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="bg-primary/10 text-primary mb-2 flex h-10 w-10 items-center justify-center rounded-full">
              <Icons.Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle>{copy?.title ?? "Upgrade Mizan"}</DialogTitle>
            <DialogDescription className="leading-relaxed">{copy?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Maybe later
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                navigate("/connect");
              }}
            >
              View plans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UpgradeGateContext.Provider>
  );
}

export function useUpgradeGate(): UpgradeGateContextValue {
  const ctx = useContext(UpgradeGateContext);
  if (!ctx) {
    throw new Error("useUpgradeGate must be used within an UpgradeGateProvider");
  }
  return ctx;
}
