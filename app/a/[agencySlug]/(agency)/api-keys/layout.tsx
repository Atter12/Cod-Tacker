import { PlanGate } from "@/components/billing/PlanGate";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  return (
    <PlanGate agencySlug={agencySlug} section="api">
      {children}
    </PlanGate>
  );
}
