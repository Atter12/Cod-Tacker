"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type OtpCodeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "maxLength" | "pattern"> & {
  label?: string;
};

export const OtpCodeInput = forwardRef<HTMLInputElement, OtpCodeInputProps>(
  ({ className, label = "Código de 6 dígitos", id, onChange, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          name={props.name ?? "token"}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          placeholder="000000"
          aria-describedby={`${inputId}-hint`}
          className={cn(
            "flex h-12 w-full rounded-md border border-border bg-surface-elevated px-3 text-center font-mono text-2xl tracking-[0.4em] text-text-primary outline-none placeholder:tracking-[0.4em] placeholder:text-text-secondary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          onChange={(event) => {
            event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
            onChange?.(event);
          }}
          {...props}
        />
        <p id={`${inputId}-hint`} className="text-xs text-text-secondary">
          Revisa tu bandeja de entrada e ingresa el código de 6 dígitos.
        </p>
      </div>
    );
  },
);

OtpCodeInput.displayName = "OtpCodeInput";
