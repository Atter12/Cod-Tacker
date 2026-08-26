"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { calificarFlipyMotorizado } from "@/app/actions/flipy-shipments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { FlipyTiendaResena } from "@/lib/integrations/flipy/partner-contract";
import { cn } from "@/lib/utils/cn";

type Props = {
  agencySlug: string;
  storeSlug: string;
  orderId: string;
  envioId: string;
  calificacionPeso?: number | null;
  tiendaResena?: FlipyTiendaResena | null;
  calificacionDisponible: boolean;
  canManage: boolean;
  onRated?: () => void;
};

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Calificación del motorizado">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={cn(
            "rounded p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            star <= active ? "text-warning" : "text-muted-foreground/40",
          )}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          aria-label={`${star} estrella${star === 1 ? "" : "s"}`}
        >
          <Star className="size-5" fill={star <= active ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function ResenaSummary({ resena }: { resena: FlipyTiendaResena }) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs">
      <p className="font-medium text-text-primary">
        Reseña registrada: {resena.rating}/5
        {resena.peso != null && resena.peso > 1 ? (
          <span className="ml-1 text-text-secondary">(peso ×{resena.peso})</span>
        ) : null}
      </p>
      {resena.comentario ? (
        <p className="mt-1 text-text-secondary">&ldquo;{resena.comentario}&rdquo;</p>
      ) : null}
      {resena.autorTipo ? (
        <p className="mt-1 text-[11px] text-text-secondary">Origen: {resena.autorTipo}</p>
      ) : null}
    </div>
  );
}

export function FlipyMotorizadoRatingPanel({
  agencySlug,
  storeSlug,
  orderId,
  envioId,
  calificacionPeso = null,
  tiendaResena = null,
  calificacionDisponible,
  canManage,
  onRated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (tiendaResena) {
    return <ResenaSummary resena={tiendaResena} />;
  }

  if (!calificacionDisponible || !canManage) {
    return null;
  }

  function submit() {
    if (rating < 1) {
      setError("Selecciona una calificación de 1 a 5 estrellas.");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(() => {
      void (async () => {
        const result = await calificarFlipyMotorizado({
          agencySlug,
          storeSlug,
          orderId,
          envioId,
          rating,
          comentario: comentario.trim() || null,
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        setSuccess(
          result.message ??
            (result.idempotent
              ? "Ya calificaste a este motorizado en este envío."
              : "Calificación enviada correctamente."),
        );
        onRated?.();
      })();
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-muted/20 p-3">
      <div>
        <p className="text-xs font-medium text-text-primary">Calificar motorizado</p>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          Tu reseña se comparte con Flipy
          {calificacionPeso != null && calificacionPeso > 1
            ? ` (peso ×${calificacionPeso} por devolución confirmada)`
            : ""}
          .
        </p>
      </div>

      <StarRatingInput value={rating} onChange={setRating} disabled={pending} />

      <Textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentario opcional…"
        rows={2}
        disabled={pending}
        className="text-xs"
      />

      {error ? (
        <Alert variant="danger" title="No se pudo calificar">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" title="Reseña">
          {success}
        </Alert>
      ) : null}

      <Button size="sm" disabled={pending || rating < 1} onClick={submit}>
        {pending ? "Enviando…" : "Enviar calificación"}
      </Button>
    </div>
  );
}
