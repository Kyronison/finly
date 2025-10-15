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
      {
        protocol: 'https',
        hostname: 'beststocks.ru',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
