/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: undefined,
  basePath: '',
  distDir: '.next'
}

module.exports = nextConfig
