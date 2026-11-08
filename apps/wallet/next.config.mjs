export default {
  async redirects() { return [{ source: "/", destination: "/ar/welcome", permanent: false }]; },
  async rewrites() { return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }]; },
};
