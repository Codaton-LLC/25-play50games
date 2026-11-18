/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    WORDPRESS_API_URL: process.env.WORDPRESS_API_URL || 'http://localhost/wp-json',
  },
  // The third world was renamed from Scale Squad to Pangoroll Worlds (2026-11-19).
  async redirects() {
    return [{ source: '/scale-squad', destination: '/pangoroll-worlds', permanent: true }]
  },
}

module.exports = nextConfig

