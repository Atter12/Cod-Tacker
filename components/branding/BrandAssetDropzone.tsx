"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadAgencyBrandAsset } from "@/app/actions/branding";
import type { BrandAssetKind } from "@/lib/branding/storage";
import { cn } from "@/lib/utils/cn";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico";

export function BrandAssetDropzone({
  agencySlug,
  kind,
  label,
  hint,
  value,
  disabled = false,
  onUploaded,
  onCleared,
}: {
  agencySlug: string;
  kind: BrandAssetKind;
  label: string;
  hint?: string;
  value: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  onCleared?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function uploadFile(file: File) {
    setError(null);
    start(async () => {
      const formData = new FormData();
      formData.set("file", file);
      // Also send base64 for compatibility with the Storage pipeline
      const dataUrl = await readAsDataUrl(file);
      formData.set("base64", dataUrl);
      formData.set("filename", file.name);
      formData.set("contentType", file.type || "image/png");

      const result = await uploadAgencyBrandAsset(agencySlug, kind, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) onUploaded(result.url);
    });
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".ico")) {
      setError("Solo se admiten imágenes (PNG, JPEG, WebP, SVG, ICO).");
      return;
    }
    uploadFile(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-text-primary">{label}</p>
        {value && onCleared && !disabled ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11.5px] text-text-secondary hover:text-danger"
            onClick={onCleared}
          >
            <X className="size-3.5" aria-hidden />
            Quitar
          </button>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label}: arrastra o elige una imagen`}
        aria-disabled={disabled || pending}
        onKeyDown={(e) => {
          if (disabled || pending) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled && !pending) inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled || pending) return;
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed px-3 py-4 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging
            ? "border-brand-primary bg-brand-soft/60"
            : "border-border bg-muted/30 hover:border-brand-primary/40 hover:bg-brand-softer/40",
          (disabled || pending) && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || pending}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className={cn(
              "object-contain",
              kind === "login_background" ? "max-h-20 w-full rounded-md object-cover" : "max-h-12 max-w-[140px]",
            )}
          />
        ) : pending ? (
          <Loader2 className="size-5 animate-spin text-brand-primary" aria-hidden />
        ) : (
          <ImagePlus className="size-5 text-brand-primary" aria-hidden />
        )}

        <div className="space-y-0.5">
          <p className="text-[12.5px] font-medium text-text-primary">
            {pending ? "Subiendo…" : value ? "Reemplazar imagen" : "Arrastra o elige una imagen"}
          </p>
          <p className="text-[11px] text-text-secondary">
            {hint ?? "PNG, JPEG, WebP, SVG o ICO · máx. 8 MB"}
          </p>
        </div>
      </div>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}
