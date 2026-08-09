import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { VenueBundleSchema, type VenueBundle } from "./schema.js";

const DATA_DIR = resolve(import.meta.dirname, "../data");

/**
 * Recursively find all manifest.yaml files under the data directory.
 */
function findManifests(dir: string): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findManifests(fullPath));
    } else if (entry.name === "manifest.yaml") {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Load a single venue bundle from a YAML manifest file.
 * Throws a ZodError if the manifest is invalid.
 */
export function loadManifest(filePath: string): VenueBundle {
  const raw = readFileSync(filePath, "utf-8");
  const data = parseYaml(raw);
  return VenueBundleSchema.parse(data);
}

/**
 * Load and validate all venue bundles from the data directory.
 * Returns an array of validated VenueBundle objects.
 */
export function loadAllVenueBundles(): VenueBundle[] {
  const manifests = findManifests(DATA_DIR);
  return manifests.map((filePath) => loadManifest(filePath));
}
