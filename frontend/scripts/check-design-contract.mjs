import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const manifestPath = join(root, ".design-contract", "manifest.json");

if (process.env.ALLOW_DESIGN_CHANGE === "true") {
  console.log("ALLOW_DESIGN_CHANGE=true, design contract check skipped");
  process.exit(0);
}

if (!existsSync(manifestPath)) {
  console.error("Missing design manifest. Run: npm run design:manifest");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const trackedFiles = Object.keys(manifest);

function digest(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

const changed = [];
for (const file of trackedFiles) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    changed.push(`${file} (deleted)`);
    continue;
  }

  const actual = digest(absolute);
  if (actual !== manifest[file]) {
    changed.push(file);
  }
}

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
      files.push(relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

const trackedRoots = [
  "src/styles/theme.css",
  "src/app/components/ui",
];

const expectedSet = new Set(trackedFiles);
const currentSet = new Set();
for (const target of trackedRoots) {
  const absolute = join(root, target);
  const stats = statSync(absolute);
  if (stats.isDirectory()) {
    for (const file of walk(absolute)) {
      currentSet.add(file);
      if (!expectedSet.has(file)) {
        changed.push(`${file} (new)`);
      }
    }
  } else {
    currentSet.add(target);
  }
}

for (const file of expectedSet) {
  if (!currentSet.has(file)) {
    changed.push(`${file} (missing)`);
  }
}

if (changed.length > 0) {
  console.error("Design contract changed:");
  for (const item of changed) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log("Design contract verified");
