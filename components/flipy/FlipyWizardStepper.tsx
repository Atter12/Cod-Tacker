"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type FlipyWizardStepId = "modalidad" | "ruta" | "confirmacion";

const STEPS: { id: FlipyWizardStepId; label: string; shortLabel: string }[] = [
  { id: "modalidad", label: "Modalidad", shortLabel: "Modalidad" },
  { id: "ruta", label: "Ruta y paquete", shortLabel: "Ruta y paquete" },
  { id: "confirmacion", label: "Confirmación", shortLabel: "Confirmación" },
];

type Props = {
  activeStep: FlipyWizardStepId;
  /** Hide modalidad when smart skip (1A only). */
  showModalidad?: boolean;
  className?: string;
  /** Numbered stepper (ruta step mock). */
  variant?: "dots" | "numbered";
};

export function FlipyWizardStepper({
  activeStep,
  showModalidad = true,
  className,
  variant = "dots",
}: Props) {
  const visibleSteps = showModalidad ? STEPS : STEPS.filter((step) => step.id !== "modalidad");
  const activeIndex = visibleSteps.findIndex((step) => step.id === activeStep);

  if (variant === "numbered") {
    return (
      <ol className={cn("flex flex-wrap items-center gap-2 sm:gap-4", className)}>
        {visibleSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = step.id === activeStep;
          const isComplete = activeIndex > index;
          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  isComplete
                    ? "bg-brand-primary text-white"
                    : isActive
                      ? "bg-brand-primary text-white"
                      : "border border-border bg-muted/40 text-text-secondary",
                )}
              >
                {isComplete ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : stepNumber}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive || isComplete ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {step.shortLabel}
              </span>
              {index < visibleSteps.length - 1 ? (
                <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn("flex items-center gap-4 text-sm", className)}>
      {visibleSteps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isComplete = activeIndex > index;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full transition-colors",
                isActive || isComplete ? "bg-brand-primary" : "bg-border",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "font-medium",
                isActive ? "text-brand-primary" : "text-text-secondary",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function mapFlipyWizardStep(
  step: "payment" | "ruta" | "confirm" | "recarga" | "success",
): FlipyWizardStepId | null {
  if (step === "payment") return "modalidad";
  if (step === "ruta") return "ruta";
  if (step === "confirm" || step === "recarga") return "confirmacion";
  return null;
}
