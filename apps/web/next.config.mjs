/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages du monorepo sont transpilés à la volée par Next.
  transpilePackages: ["@brandforge/domain"],
};

export default nextConfig;
