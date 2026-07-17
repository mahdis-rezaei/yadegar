const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro see the shared workspace packages outside apps/mobile.
config.watchFolders = [
  monorepoRoot,
  path.resolve(monorepoRoot, "lib/api-client-react"),
  path.resolve(monorepoRoot, "lib/api-zod"),
];

// Keep mobile's node_modules first, but allow resolution from the repo root too.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@workspace/api-client-react": path.resolve(
    monorepoRoot,
    "lib/api-client-react/src",
  ),
  "@workspace/api-zod": path.resolve(monorepoRoot, "lib/api-zod/src"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
