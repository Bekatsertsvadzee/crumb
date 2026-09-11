import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// A stray package.json in the home directory makes Turbopack infer the wrong
// workspace root for nested projects. Pin it explicitly.
const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
