import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const trackedRoots = [
  "src/styles/theme.css",
  "src/app/components/ui",
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") || fullPath.endsWith(".css")) {
      files.push(fullPath);
    }
  }
  return files;
}

function digest(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

const manifest = {};
for (const target of trackedRoots) {
  const absolute = join(root, target);
  const stats = statSync(absolute);
  if (stats.isDirectory()) {
    for (const filePath of walk(absolute)) {
      manifest[relative(root, filePath).replace(/\\/g, "/")] = digest(filePath);
    }
  } else {
    manifest[target] = digest(absolute);
  }
}

const outputPath = join(root, ".design-contract", "manifest.json");
writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log(`Design manifest written to ${outputPath}`);
