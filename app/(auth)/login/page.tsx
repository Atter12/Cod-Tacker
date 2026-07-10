import { AuthForm } from "@/components/AuthForm";

type SearchParams = Promise<{ mode?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const kind = params.mode === "otp" ? "login-otp" : "login";
  return <AuthForm kind={kind} />;
}
