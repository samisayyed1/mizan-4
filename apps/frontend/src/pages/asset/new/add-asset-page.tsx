import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@mizan/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mizan/ui/components/ui/card";
import { Icons } from "@mizan/ui/components/ui/icons";
import { Input } from "@mizan/ui/components/ui/input";
import { Label } from "@mizan/ui/components/ui/label";

import { createUniversalAsset, type UniversalAssetInput } from "@/adapters";
import { useSettings } from "@/hooks/use-settings";

/**
 * Universal Add Asset wizard (Prompt 5 of the build plan).
 *
 * Step 1 — "What are you adding?" Asset picker (10 tiles).
 * Step 2 — Required fields per type, with an "Advanced" toggle for
 *          the optional class-specific fields. RHF + Zod validation.
 * Step 3 — Save (calls the new `create_universal_asset` command),
 *          then redirect to /holdings.
 */

// ---------------------------------------------------------------------------
// Asset type catalog — 10 entries as specified by Prompt 5.
// ---------------------------------------------------------------------------

export type WizardKind =
  | "public_equity"
  | "fixed_income"
  | "fixed_deposit_or_cash"
  | "real_estate"
  | "private_investment"
  | "commodity"
  | "crypto"
  | "insurance"
  | "business_or_other"
  | "liability";

interface KindOption {
  key: WizardKind;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const KIND_OPTIONS: ReadonlyArray<KindOption> = [
  {
    key: "public_equity",
    label: "Stock / ETF / Fund",
    description: "Listed equity, ETF, or mutual fund.",
    icon: Icons.TrendingUp,
  },
  {
    key: "fixed_income",
    label: "Bond / Sukuk",
    description: "Bond, sukuk, T-bill, or CD.",
    icon: Icons.Receipt,
  },
  {
    key: "fixed_deposit_or_cash",
    label: "Fixed Deposit / Cash",
    description: "A bank fixed deposit or a cash balance.",
    icon: Icons.Wallet,
  },
  {
    key: "real_estate",
    label: "Property",
    description: "Residential, commercial, or land.",
    icon: Icons.RealEstateDuotone,
  },
  {
    key: "private_investment",
    label: "Private Investment",
    description: "PE, VC, private credit, or hedge fund.",
    icon: Icons.Briefcase,
  },
  {
    key: "commodity",
    label: "Gold / Commodity",
    description: "Physical gold, silver, oil, agri.",
    icon: Icons.PreciousDuotone,
  },
  {
    key: "crypto",
    label: "Crypto",
    description: "Bitcoin, Ether, or other tokens.",
    icon: Icons.Bitcoin,
  },
  {
    key: "insurance",
    label: "Insurance / ULIP",
    description: "Life insurance, ULIP, or pension.",
    icon: Icons.Shield,
  },
  {
    key: "business_or_other",
    label: "Business / Other",
    description: "Business ownership or anything else.",
    icon: Icons.Building,
  },
  {
    key: "liability",
    label: "Liability",
    description: "Mortgage, loan, or credit card.",
    icon: Icons.LiabilityDuotone,
  },
];

// ---------------------------------------------------------------------------
// Zod schemas — one per wizard kind. Each schema validates its own
// required fields and exposes optional advanced fields where useful.
// ---------------------------------------------------------------------------

const decimalString = z
  .string()
  .trim()
  .refine((s) => s === "" || /^-?\d+(\.\d+)?$/.test(s), {
    message: "Enter a valid number (e.g. 1234.56).",
  });

const positiveDecimalString = z
  .string()
  .trim()
  .refine((s) => /^\d+(\.\d+)?$/.test(s) && Number(s) > 0, {
    message: "Enter a positive number.",
  });

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  currency: z.string().trim().length(3, "Use a 3-letter currency code."),
  initialValue: positiveDecimalString,
  notes: z.string().trim().optional().default(""),
});

const publicEquitySchema = baseSchema.extend({
  ticker: z.string().trim().min(1, "Ticker is required."),
  securityType: z.enum(["STOCK", "ETF", "MUTUAL_FUND", "REIT", "PREFERRED", "ADR", "OTHER"]),
  exchangeMic: z.string().trim().optional().default(""),
  isin: z.string().trim().optional().default(""),
});

const fixedIncomeSchema = baseSchema.extend({
  instrumentType: z.enum(["BOND", "SUKUK", "T_BILL", "FIXED_DEPOSIT", "CD", "OTHER"]),
  maturityDate: z.string().trim().min(1, "Maturity date is required."),
  issuer: z.string().trim().optional().default(""),
  couponOrProfitRate: decimalString.optional().default(""),
  faceValue: decimalString.optional().default(""),
  isSukuk: z.boolean().default(false),
});

const fixedDepositOrCashSchema = baseSchema.extend({
  isFixedDeposit: z.boolean().default(false),
  maturityDate: z.string().trim().optional().default(""),
  issuer: z.string().trim().optional().default(""),
  couponOrProfitRate: decimalString.optional().default(""),
});

const realEstateSchema = baseSchema.extend({
  propertyType: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "MIXED_USE", "INDUSTRIAL", "OTHER"])
    .default("RESIDENTIAL"),
  city: z.string().trim().optional().default(""),
  countryCode: z.string().trim().optional().default(""),
  purchasePrice: decimalString.optional().default(""),
});

const privateInvestmentSchema = baseSchema.extend({
  investmentKind: z
    .enum([
      "PRIVATE_EQUITY",
      "PRIVATE_CREDIT",
      "VENTURE",
      "BUSINESS_OWNERSHIP",
      "HEDGE_FUND",
      "OTHER",
    ])
    .default("PRIVATE_EQUITY"),
  manager: z.string().trim().optional().default(""),
  vintageYear: z.string().trim().optional().default(""),
  commitmentAmount: decimalString.optional().default(""),
});

const commoditySchema = baseSchema.extend({
  commodityType: z
    .enum([
      "GOLD",
      "SILVER",
      "PLATINUM",
      "PALLADIUM",
      "OIL",
      "NATURAL_GAS",
      "COPPER",
      "AGRICULTURAL",
      "OTHER",
    ])
    .default("GOLD"),
  form: z
    .enum(["BAR", "COIN", "JEWELRY", "CONTRACT", "ETF_BACKED", "PHYSICAL_OTHER", "OTHER"])
    .optional()
    .default("BAR"),
  weightValue: decimalString.optional().default(""),
  weightUnit: z.enum(["GRAM", "KILOGRAM", "OUNCE", "TROY_OUNCE", "TOLA", "OTHER"]).default("GRAM"),
});

const cryptoSchema = baseSchema.extend({
  ticker: z.string().trim().min(1, "Token symbol is required."),
});

const insuranceSchema = baseSchema.extend({
  productKind: z.enum(["INSURANCE", "ULIP", "PENSION", "ANNUITY", "OTHER"]).default("INSURANCE"),
  carrier: z.string().trim().optional().default(""),
  hasMarketLink: z.boolean().default(false),
});

const businessOrOtherSchema = baseSchema.extend({
  details: z.string().trim().optional().default(""),
});

const liabilitySchema = baseSchema.extend({
  liabilityType: z
    .enum([
      "MORTGAGE",
      "AUTO_LOAN",
      "STUDENT_LOAN",
      "CREDIT_CARD",
      "PERSONAL_LOAN",
      "MARGIN_LOAN",
      "BUSINESS_LOAN",
      "OTHER",
    ])
    .default("MORTGAGE"),
  lender: z.string().trim().optional().default(""),
  interestRate: decimalString.optional().default(""),
});

// Discriminated union of every schema. The wizard tracks the chosen
// kind in component state and resolves the matching schema for RHF.
type WizardSchemaByKind = {
  public_equity: typeof publicEquitySchema;
  fixed_income: typeof fixedIncomeSchema;
  fixed_deposit_or_cash: typeof fixedDepositOrCashSchema;
  real_estate: typeof realEstateSchema;
  private_investment: typeof privateInvestmentSchema;
  commodity: typeof commoditySchema;
  crypto: typeof cryptoSchema;
  insurance: typeof insuranceSchema;
  business_or_other: typeof businessOrOtherSchema;
  liability: typeof liabilitySchema;
};

const SCHEMAS: WizardSchemaByKind = {
  public_equity: publicEquitySchema,
  fixed_income: fixedIncomeSchema,
  fixed_deposit_or_cash: fixedDepositOrCashSchema,
  real_estate: realEstateSchema,
  private_investment: privateInvestmentSchema,
  commodity: commoditySchema,
  crypto: cryptoSchema,
  insurance: insuranceSchema,
  business_or_other: businessOrOtherSchema,
  liability: liabilitySchema,
};

// A loose union of every possible form-value shape. We narrow with the
// chosen `kind` discriminator before reading fields.
type AnyFormValues = z.infer<(typeof SCHEMAS)[WizardKind]>;

// ---------------------------------------------------------------------------
// Translate form values + chosen kind → backend `UniversalAssetInput`.
// ---------------------------------------------------------------------------

export function buildUniversalAssetInput(
  kind: WizardKind,
  values: AnyFormValues,
): UniversalAssetInput {
  const base = {
    name: values.name,
    currency: values.currency.toUpperCase(),
    initialValue: values.initialValue,
    notes: values.notes && values.notes.length > 0 ? values.notes : undefined,
  };
  switch (kind) {
    case "public_equity": {
      const v = values as z.infer<typeof publicEquitySchema>;
      return {
        kind: "public_equity",
        base,
        fields: {
          securityType: v.securityType,
          ticker: v.ticker.toUpperCase(),
          exchangeMic: v.exchangeMic || undefined,
          isin: v.isin || undefined,
        },
      };
    }
    case "fixed_income": {
      const v = values as z.infer<typeof fixedIncomeSchema>;
      return {
        kind: "fixed_income",
        base,
        fields: {
          instrumentType: v.instrumentType,
          issuer: v.issuer || undefined,
          maturityDate: v.maturityDate,
          couponOrProfitRate: v.couponOrProfitRate || undefined,
          faceValue: v.faceValue || undefined,
          isSukuk: v.isSukuk,
        },
      };
    }
    case "fixed_deposit_or_cash": {
      const v = values as z.infer<typeof fixedDepositOrCashSchema>;
      if (v.isFixedDeposit && v.maturityDate) {
        return {
          kind: "fixed_income",
          base,
          fields: {
            instrumentType: "FIXED_DEPOSIT",
            issuer: v.issuer || undefined,
            maturityDate: v.maturityDate,
            couponOrProfitRate: v.couponOrProfitRate || undefined,
            isSukuk: false,
          },
        };
      }
      return { kind: "cash", base };
    }
    case "real_estate": {
      const v = values as z.infer<typeof realEstateSchema>;
      return {
        kind: "real_estate",
        base,
        fields: {
          propertyType: v.propertyType,
          city: v.city || undefined,
          countryCode: v.countryCode || undefined,
          purchasePrice: v.purchasePrice || undefined,
        },
      };
    }
    case "private_investment": {
      const v = values as z.infer<typeof privateInvestmentSchema>;
      return {
        kind: "private_investment",
        base,
        fields: {
          investmentKind: v.investmentKind,
          manager: v.manager || undefined,
          vintageYear: v.vintageYear ? Number(v.vintageYear) : undefined,
          commitmentAmount: v.commitmentAmount || undefined,
        },
      };
    }
    case "commodity": {
      const v = values as z.infer<typeof commoditySchema>;
      return {
        kind: "commodity",
        base,
        fields: {
          commodityType: v.commodityType,
          form: v.form,
          weightValue: v.weightValue || undefined,
          weightUnit: v.weightUnit,
        },
      };
    }
    case "crypto": {
      const v = values as z.infer<typeof cryptoSchema>;
      return { kind: "crypto", base, ticker: v.ticker.toUpperCase() };
    }
    case "insurance": {
      const v = values as z.infer<typeof insuranceSchema>;
      return {
        kind: "insurance",
        base,
        fields: {
          productKind: v.productKind,
          carrier: v.carrier || undefined,
          hasMarketLink: v.hasMarketLink,
        },
      };
    }
    case "business_or_other": {
      const v = values as z.infer<typeof businessOrOtherSchema>;
      return {
        kind: "private_investment",
        base: { ...base, notes: v.details || base.notes },
        fields: { investmentKind: "BUSINESS_OWNERSHIP" },
      };
    }
    case "liability": {
      const v = values as z.infer<typeof liabilitySchema>;
      return {
        kind: "liability",
        base,
        fields: {
          liabilityType: v.liabilityType,
          lender: v.lender || undefined,
          interestRate: v.interestRate || undefined,
        },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Type-picker step (Step 1).
// ---------------------------------------------------------------------------

interface AssetTypePickerProps {
  onPick: (kind: WizardKind) => void;
}

export function AssetTypePicker({ onPick }: AssetTypePickerProps) {
  return (
    <div data-testid="add-asset-picker" className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add an asset</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What are you adding? Pick a category — you can change your mind on the next screen.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KIND_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onPick(option.key)}
              data-testid={`add-asset-pick-${option.key}`}
              className="border-border/60 hover:bg-accent hover:border-border rounded-lg border p-4 text-left transition-colors"
            >
              <Icon className="mb-2 size-6" />
              <div className="text-base font-medium">{option.label}</div>
              <div className="text-muted-foreground line-clamp-2 text-xs">{option.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard form (Step 2 + Step 3 — required + advanced fields, save).
// ---------------------------------------------------------------------------

interface WizardFormProps {
  kind: WizardKind;
  onBack: () => void;
  onSubmit: (input: UniversalAssetInput) => Promise<void>;
  /** Pre-filled base currency for the user. */
  defaultCurrency?: string;
  /** Errors raised by the save handler — surfaced inline. */
  saveError?: string | null;
  /** Whether the save handler is currently in-flight. */
  saving?: boolean;
}

const KIND_TITLES: Record<WizardKind, string> = {
  public_equity: "Stock / ETF / Fund",
  fixed_income: "Bond / Sukuk",
  fixed_deposit_or_cash: "Fixed Deposit / Cash",
  real_estate: "Property",
  private_investment: "Private Investment",
  commodity: "Gold / Commodity",
  crypto: "Crypto",
  insurance: "Insurance / ULIP",
  business_or_other: "Business / Other",
  liability: "Liability",
};

export function WizardForm({
  kind,
  onBack,
  onSubmit,
  defaultCurrency = "USD",
  saveError,
  saving,
}: WizardFormProps) {
  const schema = SCHEMAS[kind];
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<AnyFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as Resolver<AnyFormValues>,
    defaultValues: defaultValuesFor(kind, defaultCurrency),
    mode: "onBlur",
  });

  const submit = form.handleSubmit(async (values) => {
    const input = buildUniversalAssetInput(kind, values);
    await onSubmit(input);
  });

  return (
    <form onSubmit={submit} data-testid={`add-asset-form-${kind}`} className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add a {KIND_TITLES[kind]}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Required fields are at the top. Optional details are under &ldquo;Advanced&rdquo;.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onBack} data-testid="add-asset-change-kind">
          Change type
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldRow id="name" label="Name" required>
            <Input
              id="name"
              data-testid="field-name"
              {...form.register("name")}
              autoComplete="off"
            />
            <FieldError msg={form.formState.errors.name?.message} />
          </FieldRow>
          <FieldRow id="currency" label="Currency" required hint="ISO 4217 code, e.g. USD">
            <Input
              id="currency"
              data-testid="field-currency"
              {...form.register("currency")}
              maxLength={3}
              className="uppercase"
            />
            <FieldError msg={form.formState.errors.currency?.message} />
          </FieldRow>
          <FieldRow id="initialValue" label="Current value" required>
            <Input
              id="initialValue"
              data-testid="field-initialValue"
              {...form.register("initialValue")}
              inputMode="decimal"
            />
            <FieldError msg={form.formState.errors.initialValue?.message} />
          </FieldRow>
          <KindRequiredFields kind={kind} form={form} />
        </CardContent>
      </Card>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          data-testid="toggle-advanced"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
        >
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </button>
      </div>

      {showAdvanced && (
        <Card data-testid="advanced-section">
          <CardHeader>
            <CardTitle className="text-base">Advanced (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <KindAdvancedFields kind={kind} form={form} />
            <FieldRow id="notes" label="Notes">
              <textarea
                id="notes"
                data-testid="field-notes"
                {...form.register("notes")}
                className="border-input bg-input-bg min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              />
            </FieldRow>
          </CardContent>
        </Card>
      )}

      {saveError ? (
        <p className="text-destructive text-sm" data-testid="add-asset-save-error">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} data-testid="add-asset-submit">
          {saving ? "Saving…" : "Save asset"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface FieldRowProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function FieldRow({ id, label, required, hint, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function FieldError({ msg }: { msg?: string | undefined }) {
  if (!msg) return null;
  return <p className="text-destructive text-xs">{msg}</p>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactHookForm = ReturnType<typeof useForm<any>>;

interface KindFieldsProps {
  kind: WizardKind;
  form: ReactHookForm;
}

function KindRequiredFields({ kind, form }: KindFieldsProps) {
  switch (kind) {
    case "public_equity":
      return (
        <>
          <FieldRow id="ticker" label="Ticker" required>
            <Input id="ticker" data-testid="field-ticker" {...form.register("ticker")} />
            <FieldError msg={form.formState.errors.ticker?.message as string | undefined} />
          </FieldRow>
          <FieldRow id="securityType" label="Security type" required>
            <select
              id="securityType"
              data-testid="field-securityType"
              {...form.register("securityType")}
              className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
            >
              {(["STOCK", "ETF", "MUTUAL_FUND", "REIT", "PREFERRED", "ADR", "OTHER"] as const).map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </FieldRow>
        </>
      );
    case "fixed_income":
      return (
        <>
          <FieldRow id="instrumentType" label="Instrument type" required>
            <select
              id="instrumentType"
              data-testid="field-instrumentType"
              {...form.register("instrumentType")}
              className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
            >
              {(["BOND", "SUKUK", "T_BILL", "FIXED_DEPOSIT", "CD", "OTHER"] as const).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow id="maturityDate" label="Maturity date" required>
            <Input
              id="maturityDate"
              type="date"
              data-testid="field-maturityDate"
              {...form.register("maturityDate")}
            />
            <FieldError msg={form.formState.errors.maturityDate?.message as string | undefined} />
          </FieldRow>
        </>
      );
    case "fixed_deposit_or_cash":
      return (
        <FieldRow id="isFixedDeposit" label="This is a fixed deposit (not a cash balance)">
          <input
            id="isFixedDeposit"
            type="checkbox"
            data-testid="field-isFixedDeposit"
            {...form.register("isFixedDeposit")}
            className="size-4"
          />
        </FieldRow>
      );
    case "real_estate":
      return (
        <FieldRow id="propertyType" label="Property type" required>
          <select
            id="propertyType"
            data-testid="field-propertyType"
            {...form.register("propertyType")}
            className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
          >
            {(
              ["RESIDENTIAL", "COMMERCIAL", "LAND", "MIXED_USE", "INDUSTRIAL", "OTHER"] as const
            ).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </FieldRow>
      );
    case "private_investment":
      return (
        <FieldRow id="investmentKind" label="Strategy" required>
          <select
            id="investmentKind"
            data-testid="field-investmentKind"
            {...form.register("investmentKind")}
            className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
          >
            {(
              [
                "PRIVATE_EQUITY",
                "PRIVATE_CREDIT",
                "VENTURE",
                "BUSINESS_OWNERSHIP",
                "HEDGE_FUND",
                "OTHER",
              ] as const
            ).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </FieldRow>
      );
    case "commodity":
      return (
        <FieldRow id="commodityType" label="Commodity" required>
          <select
            id="commodityType"
            data-testid="field-commodityType"
            {...form.register("commodityType")}
            className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
          >
            {(
              [
                "GOLD",
                "SILVER",
                "PLATINUM",
                "PALLADIUM",
                "OIL",
                "NATURAL_GAS",
                "COPPER",
                "AGRICULTURAL",
                "OTHER",
              ] as const
            ).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </FieldRow>
      );
    case "crypto":
      return (
        <FieldRow id="ticker" label="Token symbol" required>
          <Input id="ticker" data-testid="field-ticker" {...form.register("ticker")} />
          <FieldError msg={form.formState.errors.ticker?.message as string | undefined} />
        </FieldRow>
      );
    case "insurance":
      return (
        <FieldRow id="productKind" label="Product" required>
          <select
            id="productKind"
            data-testid="field-productKind"
            {...form.register("productKind")}
            className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
          >
            {(["INSURANCE", "ULIP", "PENSION", "ANNUITY", "OTHER"] as const).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </FieldRow>
      );
    case "business_or_other":
      return null;
    case "liability":
      return (
        <FieldRow id="liabilityType" label="Liability type" required>
          <select
            id="liabilityType"
            data-testid="field-liabilityType"
            {...form.register("liabilityType")}
            className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
          >
            {(
              [
                "MORTGAGE",
                "AUTO_LOAN",
                "STUDENT_LOAN",
                "CREDIT_CARD",
                "PERSONAL_LOAN",
                "MARGIN_LOAN",
                "BUSINESS_LOAN",
                "OTHER",
              ] as const
            ).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </FieldRow>
      );
  }
}

function KindAdvancedFields({ kind, form }: KindFieldsProps) {
  switch (kind) {
    case "public_equity":
      return (
        <>
          <FieldRow id="exchangeMic" label="Exchange (MIC)">
            <Input
              id="exchangeMic"
              data-testid="field-exchangeMic"
              {...form.register("exchangeMic")}
            />
          </FieldRow>
          <FieldRow id="isin" label="ISIN">
            <Input id="isin" data-testid="field-isin" {...form.register("isin")} />
          </FieldRow>
        </>
      );
    case "fixed_income":
      return (
        <>
          <FieldRow id="issuer" label="Issuer">
            <Input id="issuer" data-testid="field-issuer" {...form.register("issuer")} />
          </FieldRow>
          <FieldRow id="couponOrProfitRate" label="Coupon / profit rate">
            <Input
              id="couponOrProfitRate"
              data-testid="field-couponOrProfitRate"
              {...form.register("couponOrProfitRate")}
              inputMode="decimal"
            />
          </FieldRow>
          <FieldRow id="faceValue" label="Face value">
            <Input id="faceValue" data-testid="field-faceValue" {...form.register("faceValue")} />
          </FieldRow>
          <FieldRow id="isSukuk" label="This is a sukuk (Islamic) instrument">
            <input
              id="isSukuk"
              type="checkbox"
              data-testid="field-isSukuk"
              {...form.register("isSukuk")}
              className="size-4"
            />
          </FieldRow>
        </>
      );
    case "fixed_deposit_or_cash":
      return (
        <>
          <FieldRow id="issuer" label="Bank / Issuer">
            <Input id="issuer" data-testid="field-issuer" {...form.register("issuer")} />
          </FieldRow>
          <FieldRow id="maturityDate" label="Maturity date (FD only)">
            <Input
              id="maturityDate"
              type="date"
              data-testid="field-maturityDate"
              {...form.register("maturityDate")}
            />
          </FieldRow>
          <FieldRow id="couponOrProfitRate" label="Rate %">
            <Input
              id="couponOrProfitRate"
              data-testid="field-couponOrProfitRate"
              {...form.register("couponOrProfitRate")}
              inputMode="decimal"
            />
          </FieldRow>
        </>
      );
    case "real_estate":
      return (
        <>
          <FieldRow id="city" label="City">
            <Input id="city" data-testid="field-city" {...form.register("city")} />
          </FieldRow>
          <FieldRow id="countryCode" label="Country code (ISO)">
            <Input
              id="countryCode"
              data-testid="field-countryCode"
              {...form.register("countryCode")}
              maxLength={3}
            />
          </FieldRow>
          <FieldRow id="purchasePrice" label="Purchase price">
            <Input
              id="purchasePrice"
              data-testid="field-purchasePrice"
              {...form.register("purchasePrice")}
              inputMode="decimal"
            />
          </FieldRow>
        </>
      );
    case "private_investment":
      return (
        <>
          <FieldRow id="manager" label="Manager / Fund">
            <Input id="manager" data-testid="field-manager" {...form.register("manager")} />
          </FieldRow>
          <FieldRow id="vintageYear" label="Vintage year">
            <Input
              id="vintageYear"
              data-testid="field-vintageYear"
              {...form.register("vintageYear")}
              inputMode="numeric"
            />
          </FieldRow>
          <FieldRow id="commitmentAmount" label="Commitment amount">
            <Input
              id="commitmentAmount"
              data-testid="field-commitmentAmount"
              {...form.register("commitmentAmount")}
              inputMode="decimal"
            />
          </FieldRow>
        </>
      );
    case "commodity":
      return (
        <>
          <FieldRow id="form" label="Form">
            <select
              id="form"
              data-testid="field-form"
              {...form.register("form")}
              className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
            >
              {(
                [
                  "BAR",
                  "COIN",
                  "JEWELRY",
                  "CONTRACT",
                  "ETF_BACKED",
                  "PHYSICAL_OTHER",
                  "OTHER",
                ] as const
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow id="weightValue" label="Weight">
            <Input
              id="weightValue"
              data-testid="field-weightValue"
              {...form.register("weightValue")}
              inputMode="decimal"
            />
          </FieldRow>
          <FieldRow id="weightUnit" label="Weight unit">
            <select
              id="weightUnit"
              data-testid="field-weightUnit"
              {...form.register("weightUnit")}
              className="border-input bg-input-bg w-full rounded-md border px-3 py-2 text-sm"
            >
              {(["GRAM", "KILOGRAM", "OUNCE", "TROY_OUNCE", "TOLA", "OTHER"] as const).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FieldRow>
        </>
      );
    case "crypto":
      return null;
    case "insurance":
      return (
        <>
          <FieldRow id="carrier" label="Carrier">
            <Input id="carrier" data-testid="field-carrier" {...form.register("carrier")} />
          </FieldRow>
          <FieldRow id="hasMarketLink" label="Has market-linked component (e.g. ULIP)">
            <input
              id="hasMarketLink"
              type="checkbox"
              data-testid="field-hasMarketLink"
              {...form.register("hasMarketLink")}
              className="size-4"
            />
          </FieldRow>
        </>
      );
    case "business_or_other":
      return (
        <FieldRow id="details" label="Details">
          <Input id="details" data-testid="field-details" {...form.register("details")} />
        </FieldRow>
      );
    case "liability":
      return (
        <>
          <FieldRow id="lender" label="Lender">
            <Input id="lender" data-testid="field-lender" {...form.register("lender")} />
          </FieldRow>
          <FieldRow id="interestRate" label="Interest rate %">
            <Input
              id="interestRate"
              data-testid="field-interestRate"
              {...form.register("interestRate")}
              inputMode="decimal"
            />
          </FieldRow>
        </>
      );
  }
}

function defaultValuesFor(kind: WizardKind, baseCurrency: string): Partial<AnyFormValues> {
  const baseDefaults = {
    name: "",
    currency: baseCurrency,
    initialValue: "",
    notes: "",
  };
  switch (kind) {
    case "public_equity":
      return { ...baseDefaults, ticker: "", securityType: "STOCK" } as Partial<AnyFormValues>;
    case "fixed_income":
      return {
        ...baseDefaults,
        instrumentType: "BOND",
        maturityDate: "",
        isSukuk: false,
      } as Partial<AnyFormValues>;
    case "fixed_deposit_or_cash":
      return { ...baseDefaults, isFixedDeposit: false } as Partial<AnyFormValues>;
    case "real_estate":
      return { ...baseDefaults, propertyType: "RESIDENTIAL" } as Partial<AnyFormValues>;
    case "private_investment":
      return { ...baseDefaults, investmentKind: "PRIVATE_EQUITY" } as Partial<AnyFormValues>;
    case "commodity":
      return {
        ...baseDefaults,
        commodityType: "GOLD",
        form: "BAR",
        weightUnit: "GRAM",
      } as Partial<AnyFormValues>;
    case "crypto":
      return { ...baseDefaults, ticker: "" } as Partial<AnyFormValues>;
    case "insurance":
      return {
        ...baseDefaults,
        productKind: "INSURANCE",
        hasMarketLink: false,
      } as Partial<AnyFormValues>;
    case "business_or_other":
      return baseDefaults as Partial<AnyFormValues>;
    case "liability":
      return { ...baseDefaults, liabilityType: "MORTGAGE" } as Partial<AnyFormValues>;
  }
}

// ---------------------------------------------------------------------------
// Page container — composes the two steps and wires save → redirect.
// ---------------------------------------------------------------------------

export default function AddAssetPage() {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const [kind, setKind] = useState<WizardKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (input: UniversalAssetInput) => {
    setSaving(true);
    setSaveError(null);
    try {
      await createUniversalAsset(input);
      navigate("/holdings");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(message);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {kind === null ? (
        <AssetTypePicker onPick={setKind} />
      ) : (
        <WizardForm
          kind={kind}
          onBack={() => setKind(null)}
          onSubmit={handleSubmit}
          defaultCurrency={settings?.baseCurrency ?? "USD"}
          saveError={saveError}
          saving={saving}
        />
      )}
    </div>
  );
}
