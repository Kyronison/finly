/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'invest-brands.cdn-tinkoff.ru',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
