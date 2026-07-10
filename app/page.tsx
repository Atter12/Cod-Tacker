import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/** Entry point: resolve tenant/dashboard, or auth redirects to /login. */
export default function HomePage() {
  redirect(routes.app.dashboard);
}
