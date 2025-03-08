/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permettre les connexions depuis n'importe quelle IP
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
