/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Netlify's build machine has less memory than a dev box: with 100 3D game pages the parallel
  // static-generation workers ran out of memory ("build worker exited ... SIGABRT", 2026-11-19).
  // One worker keeps the peak low; the build is a little slower.
  experimental: { cpus: 1, workerThreads: false },
  env: {
    WORDPRESS_API_URL: process.env.WORDPRESS_API_URL || 'http://localhost/wp-json',
  },
  // The third world was renamed from Scale Squad to Pangoroll Worlds (2026-11-19).
  async redirects() {
    return [{ source: '/scale-squad', destination: '/pangoroll-worlds', permanent: true }]
  },
}

module.exports = nextConfig

