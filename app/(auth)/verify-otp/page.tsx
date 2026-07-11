import { AuthForm } from "@/components/AuthForm";
import { CompactAuthShell } from "@/components/auth/CompactAuthShell";

type SearchParams = Promise<{ email?: string }>;

export default async function VerifyOtpPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <CompactAuthShell>
      <AuthForm kind="verify" email={email} purpose="signup" />
    </CompactAuthShell>
  );
}
