import { AlertCircle } from "lucide-react";
export function ErrorMessage({ message = "Ocurrió un error. Inténtalo de nuevo.", className }: { message?: string; className?: string }) { return <p role="alert" className={`flex items-center gap-2 text-sm text-danger ${className ?? ""}`}><AlertCircle className="size-4" />{message}</p>; }
