import type { Metadata } from "next";
import { LoginExperience } from "@/components/auth/LoginExperience";
import {
  getPublicLoginBrand,
  resolveLoginAgencySlug,
} from "@/lib/branding/login-brand";
import { brandFaviconMetadata } from "@/lib/branding/theme";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; agency?: string }>;
}): Promise<Metadata> {
  const { next, agency } = await searchParams;
  const slug = await resolveLoginAgencySlug({ agency, next });
  const brand = await getPublicLoginBrand(slug);
  if (!brand) {
    return {
      title: "Iniciar sesión · CODTracked",
      description: "Accede a tu consola operativa CODTracked.",
    };
  }
  return {
    title: `Iniciar sesión · ${brand.productName}`,
    description: `Accede a ${brand.productName}.`,
    icons: brandFaviconMetadata(brand.faviconUrl),
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; agency?: string }>;
}) {
  const { next, agency } = await searchParams;
  const slug = await resolveLoginAgencySlug({ agency, next });
  const brand = await getPublicLoginBrand(slug);
  return <LoginExperience next={next} brand={brand} />;
}
