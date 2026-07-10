import { AuthForm } from "@/components/AuthForm";

type SearchParams = Promise<{ email?: string }>;

export default async function VerifyOtpPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  return <AuthForm kind="verify" email={email} purpose="signup" />;
}
