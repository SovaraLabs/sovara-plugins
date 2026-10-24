import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const source = process.env.SOVARA_SDK_SOURCE;
if (!source) throw new Error("Build the pinned public SDK, then set SOVARA_SDK_SOURCE to its checkout.");
const sdkRoot = resolve(source);
const expected = (await readFile("SDK_REVISION", "utf8")).trim();
if (!/^[a-f0-9]{40}$/.test(expected)) throw new Error("Invalid pinned SDK revision.");
const actual = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sdkRoot, encoding: "utf8" }).trim();
if (actual !== expected) throw new Error("The SDK checkout does not match SDK_REVISION.");
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "scripts", "package.json", "package-lock.json", "tsconfig.build.json", "tsconfig.json"], { cwd: sdkRoot, stdio: "pipe" });
const manifest = JSON.parse(await readFile(join(sdkRoot, "package.json"), "utf8"));
if (manifest.name !== "@sovara/sdk") throw new Error("Unexpected SDK build source.");
// Build from the verified source; a stale dist directory is not provenance.
execFileSync("npm", ["run", "build"], { cwd: sdkRoot, stdio: "inherit" });
await mkdir("sovara/runtime", { recursive: true });
const result = await build({ entryPoints: ["src/claude/entry.mjs"], outfile: "sovara/runtime/claude-helper.mjs",
  bundle: true, platform: "node", format: "esm", target: "node24.22.1", sourcemap: false,
  minifyWhitespace: true, legalComments: "none",
  alias: { "@sovara/sdk": join(sdkRoot, "dist/index.js") }, packages: "bundle",
  external: ["@openai/agents", "@smithy/node-http-handler"], metafile: true,
});
await copyFile(join(sdkRoot, "LICENSE"), "sovara/runtime/SOVARA_SDK_LICENSE");
await copyFile(join(sdkRoot, "dist/payload/editIoExcludePatterns.json"), "sovara/runtime/editIoExcludePatterns.json");
await copyFile(join(sdkRoot, "dist/endpointPatterns.json"), "sovara/runtime/endpointPatterns.json");

// Include the actual bundled dependencies' notices, not every build dependency.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes("node_modules/")) continue;
  let directory = dirname(resolve(input));
  while (directory !== dirname(directory)) {
    try {
      const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      packages.set(`${pkg.name}@${pkg.version}`, directory);
      break;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    directory = dirname(directory);
  }
}
let notices = "Bundled third-party dependencies\n\nThe Sovara SDK is Apache-2.0; see SOVARA_SDK_LICENSE.\n";
for (const [name, directory] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  const names = (await readdir(directory)).filter((name) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  if (!names.length) throw new Error(`Missing license notice for ${name}.`);
  notices += `\n--- ${name} ---\n\n`;
  for (const file of names.sort()) notices += (await readFile(join(directory, file), "utf8")) + "\n";
}
await writeFile("sovara/runtime/THIRD_PARTY_NOTICES.txt", notices.trimEnd() + "\n");
await writeFile("sovara/runtime/SDK_BUILD.json", JSON.stringify({ repository: "https://github.com/SovaraLabs/typescript-sdk", revision: expected, version: manifest.version }, null, 2) + "\n");
