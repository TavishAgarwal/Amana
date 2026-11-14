// Dev only: let a second "phone" (127.0.0.1) or phones on the LAN (AMANA_DEV_ORIGINS=192.168.1.20,...) load the dev build.
const devOrigins = ["127.0.0.1", "localhost", ...(process.env.AMANA_DEV_ORIGINS ?? "").split(",").filter(Boolean)];
// AMANA_STANDALONE=1 (set in infra/docker/web.Dockerfile) builds a self-contained server for containers.
const standalone = process.env.AMANA_STANDALONE
  ? { output: "standalone", outputFileTracingRoot: new URL("../..", import.meta.url).pathname } : {};
export default {
  ...standalone,
  // scripts/two-phones.sh sets its own build folder so it can run beside the normal dev server.
  ...(process.env.AMANA_DIST_DIR ? { distDir: process.env.AMANA_DIST_DIR } : {}),
  allowedDevOrigins: devOrigins,
  // The dev badge sits on top of the first tab on a phone-sized screen.
  devIndicators: false,
  async redirects() { return [{ source: "/", destination: "/ar/welcome", permanent: false },
    { source: "/:locale(ar|en)", destination: "/:locale/welcome", permanent: false }]; },
  async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.AMANA_API ?? "http://localhost:8000"}/api/:path*` }]; },
};
