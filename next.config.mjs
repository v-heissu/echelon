/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['jsdom', '@mozilla/readability'],
  },
};

export default nextConfig;
