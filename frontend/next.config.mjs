/** @type {import('next').NextConfig} */

// On GitHub Pages the site is served from a subpath: username.github.io/<repo>.
// Set NEXT_PUBLIC_BASE_PATH=/<repo> at build time so routing + assets resolve.
// Left empty for local dev (served at /).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export', // emit a fully static site into ./out for GitHub Pages
  trailingSlash: true, // /login -> /login/index.html (deep links work on Pages)
  images: { unoptimized: true }, // no Next image-optimization server on static hosting
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
