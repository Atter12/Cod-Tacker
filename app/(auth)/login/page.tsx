import { LoginExperience } from "@/components/auth/LoginExperience";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginExperience next={next} />;
}
