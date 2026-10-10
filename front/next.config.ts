

const nextConfig = {
  turbopack: {},
  async redirects() {
    return [
      { source: '/dashboard/mypage/:path*', destination: '/dashboard/card/:path*', permanent: true },
      { source: '/@:alias', destination: '/:alias', permanent: true },
    ];
  },
  allowedDevOrigins: ["192.168.18.82"],
};

export default nextConfig;
