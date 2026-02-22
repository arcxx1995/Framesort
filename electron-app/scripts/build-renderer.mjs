import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.join(__dirname, "..", "renderer", "src", "main.jsx");
const outDir = path.join(__dirname, "..", "renderer", "dist");
const outFile = path.join(outDir, "app.js");

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [entryPoint],
  outfile: outFile,
  bundle: true,
  format: "iife",
  platform: "browser",
  sourcemap: true,
  target: ["chrome120"],
  jsx: "automatic",
  logLevel: "info",
});
