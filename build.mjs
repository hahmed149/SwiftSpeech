import { build } from "esbuild";
import { cpSync, existsSync } from "fs";
import { join } from "path";

const common = {
  bundle: true,
  sourcemap: true,
  platform: "node",
  target: "es2022",
  logLevel: "info",
};

// Main process
await build({
  ...common,
  entryPoints: ["src/main/index.ts"],
  outfile: "dist/main/index.js",
  format: "cjs",
  external: ["electron", "uiohook-napi"],
});

// Preload script
await build({
  ...common,
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.js",
  format: "cjs",
  external: ["electron"],
});

// Renderer process
await build({
  ...common,
  entryPoints: ["src/renderer/index.ts"],
  outfile: "dist/renderer/index.js",
  format: "iife",
  platform: "browser",
});

// Copy static files
cpSync("src/renderer/index.html", "dist/renderer/index.html");
cpSync("src/renderer/styles.css", "dist/renderer/styles.css");
cpSync("assets/start.mp3", "dist/renderer/start.mp3");
cpSync("assets/stop.mp3", "dist/renderer/stop.mp3");

console.log("Build complete.");
