const basePath = "/tools/openqr";

/** @type {import("next").NextConfig} */
const config = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
