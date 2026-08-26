"use client";

import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FlipyWizardStepper, type FlipyWizardStepId } from "@/components/flipy/FlipyWizardStepper";

type Props = {
  activeStep: FlipyWizardStepId;
  showModalidad?: boolean;
  onCancel: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryPending?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  hideStepper?: boolean;
  showCancel?: boolean;
  backLinkLabel?: string;
  onBackLink?: () => void;
  /** Confirm step: back link, protected badge, check icon on primary. */
  variant?: "default" | "confirm";
  children?: ReactNode;
};

export function FlipyWizardFooter({
  activeStep,
  showModalidad = true,
  onCancel,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryPending = false,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  hideStepper = false,
  showCancel = true,
  backLinkLabel,
  onBackLink,
  variant = "default",
  children,
}: Props) {
  const isConfirm = variant === "confirm";
  const resolvedBackLabel = backLinkLabel ?? (isConfirm ? "Atrás" : undefined);

  const leading =
    resolvedBackLabel && onBackLink
      ? (
          <button
            type="button"
            onClick={onBackLink}
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {resolvedBackLabel}
          </button>
        )
      : hideStepper
        ? children
        : (
            <FlipyWizardStepper activeStep={activeStep} showModalidad={showModalidad} />
          );

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">{leading}</div>
        {isConfirm ? (
          <span className="hidden items-center gap-1.5 text-xs text-text-secondary sm:inline-flex">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Datos protegidos
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {secondaryLabel && onSecondary ? (
          <Button variant="outline" disabled={secondaryDisabled} onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
        {showCancel ? (
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        ) : null}
        <Button disabled={primaryDisabled || primaryPending} onClick={onPrimary}>
          {isConfirm && !primaryPending ? (
            <Check className="mr-1.5 size-4" aria-hidden />
          ) : null}
          {primaryLabel}
          {!primaryPending &&
          !isConfirm &&
          primaryLabel.toLowerCase().includes("siguiente") ? (
            <ArrowRight className="ml-1 size-4" aria-hidden />
          ) : null}
        </Button>
      </div>
    </div>
  );
}
