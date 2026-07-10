import type { NextConfig } from "next";
import { securityHeaders } from "@/lib/security/headers";
const nextConfig: NextConfig = { headers: securityHeaders };
export default nextConfig;
