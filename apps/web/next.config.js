/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@sii-demo/db", "@sii-demo/crypto"],
};

module.exports = nextConfig;
