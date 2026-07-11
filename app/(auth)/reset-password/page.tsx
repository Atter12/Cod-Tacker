import { AuthForm } from "@/components/AuthForm";
import { CompactAuthShell } from "@/components/auth/CompactAuthShell";

export default function ResetPasswordPage() {
  return (
    <CompactAuthShell>
      <AuthForm kind="reset" />
    </CompactAuthShell>
  );
}
