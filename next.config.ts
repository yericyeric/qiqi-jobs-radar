import type { NextConfig } from "next";
const demo = process.env.RADAR_DEMO === "true";
const config: NextConfig = {
  output: demo ? "export" : "standalone",
  pageExtensions: demo ? ["tsx"] : ["tsx", "api.ts"],
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  experimental: {
    workerThreads: true,
    cpus: 2,
    webpackBuildWorker: false,
    useTypeScriptCli: false,
  },
};
export default config;
