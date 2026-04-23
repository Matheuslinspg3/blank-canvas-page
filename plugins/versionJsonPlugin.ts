import { Plugin } from "vite";
import fs from "fs";
import path from "path";

/**
 * Vite plugin that writes /version.json into the build output
 * with the current APP_VERSION extracted from src/config/appVersion.ts.
 * This file is fetched at runtime by useVersionPolling to detect deploys.
 */
export function versionJsonPlugin(): Plugin {
  return {
    name: "version-json",
    apply: "build",
    closeBundle() {
      const versionFile = path.resolve(__dirname, "../src/config/appVersion.ts");
      const content = fs.readFileSync(versionFile, "utf-8");
      const match = content.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
      const version = match?.[1] ?? "unknown";
      const outDir = path.resolve(__dirname, "../dist");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ version, buildTime: new Date().toISOString() }),
      );
      console.log(`[version-json] wrote dist/version.json → v${version}`);
    },
  };
}
