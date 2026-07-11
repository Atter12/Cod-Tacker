import { AuthForm } from "@/components/AuthForm";
import { CompactAuthShell } from "@/components/auth/CompactAuthShell";

export default function ForgotPasswordPage() {
  return (
    <CompactAuthShell>
      <AuthForm kind="forgot" />
    </CompactAuthShell>
  );
}
