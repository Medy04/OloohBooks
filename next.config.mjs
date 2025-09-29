/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add Next.js config options here if needed
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mxczauposbthfrislbpx.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
