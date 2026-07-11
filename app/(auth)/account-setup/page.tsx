import { AuthForm } from "@/components/AuthForm";
import { CompactAuthShell } from "@/components/auth/CompactAuthShell";

export default function AccountSetupPage() {
  return (
    <CompactAuthShell>
      <AuthForm kind="setup" />
    </CompactAuthShell>
  );
}
