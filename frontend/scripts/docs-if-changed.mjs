/**
 * Conditional TypeDoc documentation generator.
 *
 * Computes a content hash of all source files and configuration
 * files that affect documentation output. Only runs TypeDoc when
 * the hash has changed, avoiding unnecessary regeneration during
 * repeated builds.
 *
 * The hash is stored in `.cache/forgeframe-docs-hash` (already
 * gitignored via the root `.gitignore`).
 *
 * Exits with code 0 in all cases — documentation generation is
 * non-critical and must never block the build pipeline.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "src");
const CACHE_DIR = join(ROOT, ".cache");
const HASH_FILE = join(CACHE_DIR, "forgeframe-docs-hash");

/** Config files whose changes affect documentation output. */
const CONFIG_FILES = [
  join(ROOT, "typedoc.json"),
  join(ROOT, "typedoc-theme.css"),
];

/** Exclusion regexps mirroring the `exclude` array in `typedoc.json`. */
const EXCLUDE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /[/\\]tests[/\\]/,
];

/**
 * Recursively walk a directory and collect non-test `.ts` / `.tsx` files.
 * @param dir - Absolute directory path to walk.
 * @returns Sorted array of absolute file paths.
 */
function collectSourceFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...collectSourceFiles(fullPath));
      }
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const isExcluded = EXCLUDE_PATTERNS.some((p) => p.test(fullPath));
      if (!isExcluded) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Compute a SHA-256 content hash over all source and config files.
 * @returns Hex-encoded hash string.
 */
function computeContentHash() {
  const hash = createHash("sha256");

  // Hash source files (sorted for determinism)
  const sourceFiles = collectSourceFiles(SRC_DIR).sort();
  for (const file of sourceFiles) {
    hash.update(readFileSync(file));
  }

  // Hash configuration files
  for (const file of CONFIG_FILES) {
    if (existsSync(file)) {
      hash.update(readFileSync(file));
    }
  }

  return hash.digest("hex");
}

/**
 * Read the previously stored hash if it exists.
 * @returns Stored hash string or `null`.
 */
function readStoredHash() {
  try {
    return readFileSync(HASH_FILE, "utf-8").trim();
  } catch {
    return null;
  }
}

/**
 * Persist a content hash for future comparisons.
 * @param hash - Hash string to store.
 */
function writeStoredHash(hash) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(HASH_FILE, `${hash}\n`);
}

// ─── Main ────────────────────────────────────────────────────────────

const newHash = computeContentHash();
const oldHash = readStoredHash();

if (newHash === oldHash) {
  console.log("[docs] No changes detected — skipping TypeDoc generation.");
  process.exit(0);
}

console.log("[docs] Source changes detected — generating TypeDoc documentation…");
try {
  execSync("npx typedoc", { cwd: ROOT, stdio: "inherit" });
  writeStoredHash(newHash);
  console.log("[docs] TypeDoc documentation generated successfully.");
} catch (err) {
  console.error("[docs] TypeDoc generation failed (non-fatal):", err.message);
}

// Always exit cleanly — doc generation must not block the build.
process.exit(0);
