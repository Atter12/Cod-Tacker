import { Plug } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { StatusBadge } from "./StatusBadge";
export function IntegrationCard({ name, description, status = "No conectado", onAction }: { name: string; description: string; status?: string; onAction?: () => void }) { return <Card><CardContent className="flex items-start gap-4"><div className="rounded-md bg-muted p-2"><Plug className="size-5 text-brand-primary" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{name}</h3><StatusBadge status={status} /></div><p className="mt-1 text-sm text-text-secondary">{description}</p></div><Button variant="outline" size="sm" onClick={onAction}>Próximamente</Button></CardContent></Card>; }
