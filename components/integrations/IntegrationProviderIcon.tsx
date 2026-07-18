import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  Megaphone,
  MessageCircle,
  PlugZap,
  Route,
  ShoppingBag,
  Truck,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { StoreIntegrationProvider } from "@/lib/integrations/catalog";

const PROVIDER_ICONS: Record<StoreIntegrationProvider, LucideIcon> = {
  shopify: ShoppingBag,
  meta: Megaphone,
  tiktok: ChartNoAxesCombined,
  whatsapp: MessageCircle,
  enviame: Truck,
  envia_com: Truck,
  custom_carrier: Route,
  custom_payment: WalletCards,
};

export function IntegrationProviderIcon({
  provider,
  className,
}: {
  provider: StoreIntegrationProvider;
  className?: string;
}) {
  const Icon = PROVIDER_ICONS[provider] ?? PlugZap;

  return (
    <span
      className={cn(
        "grid size-[38px] shrink-0 place-items-center rounded-full bg-brand-soft text-brand-primary",
        className,
      )}
      aria-hidden
    >
      <Icon className="size-[17px]" />
    </span>
  );
}
