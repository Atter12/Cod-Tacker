import { AuthForm } from "@/components/AuthForm";
import type { OtpPurpose } from "@/app/actions/auth";

type SearchParams = Promise<{ email?: string; purpose?: string }>;

function resolvePurpose(value: string | undefined): OtpPurpose {
  return value === "email" ? "email" : "signup";
}

export default async function VerifyOtpPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const purpose = resolvePurpose(params.purpose);

  return <AuthForm kind="verify" email={email} purpose={purpose} />;
}
