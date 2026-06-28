/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // exceljs is a server-only dependency (parsing SharePoint/Excel imports) — keep it
  // out of the bundle so Next requires it from node_modules at runtime.
  experimental: { serverComponentsExternalPackages: ["exceljs"] },
};
export default nextConfig;
