import { AuthForm } from "@/components/AuthForm";
import { CompactAuthShell } from "@/components/auth/CompactAuthShell";

export default function RegisterPage() {
  return (
    <CompactAuthShell>
      <AuthForm kind="register" />
    </CompactAuthShell>
  );
}
