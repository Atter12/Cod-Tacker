import Link from "next/link";
import { Card, CardContent } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center p-4"><Card className="w-full max-w-md"><CardContent className="p-7"><Link href="/" className="mb-8 block text-xl font-bold tracking-tight text-brand-primary">CODTracked</Link>{children}</CardContent></Card></main>;
}
