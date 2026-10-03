/** @type {import('next').NextConfig} */
const nextConfig = {
  // Plain HTML/JS/CSS in out/, served at /auth/ by the CloudRoot Worker
  // (worker/scripts/build-static.mjs copies it). Every page is a client
  // component that calls the sign-in API from the browser, so no Next.js
  // server is needed.
  output: "export",
  basePath: "/auth",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
