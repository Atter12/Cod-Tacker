import { PlanGate } from "@/components/billing/PlanGate";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string; storeSlug: string }>;
}) {
  const { agencySlug, storeSlug } = await params;
  return (
    <PlanGate agencySlug={agencySlug} storeSlug={storeSlug} section="whatsapp">
      {children}
    </PlanGate>
  );
}
