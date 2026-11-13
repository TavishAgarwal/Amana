// AMANA_STANDALONE=1 (set in infra/docker/web.Dockerfile) builds a self-contained server for containers.
const standalone = process.env.AMANA_STANDALONE
  ? { output: "standalone", outputFileTracingRoot: new URL("../..", import.meta.url).pathname } : {};
export default {
  ...standalone,
  async redirects() { return [{ source: "/", destination: "/en/queue", permanent: false }]; },
  async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.AMANA_API ?? "http://localhost:8000"}/api/:path*` }]; },
};
