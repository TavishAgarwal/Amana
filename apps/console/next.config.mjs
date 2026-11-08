export default {
  async redirects() { return [{ source: "/", destination: "/en/queue", permanent: false }]; },
  async rewrites() { return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }]; },
};
