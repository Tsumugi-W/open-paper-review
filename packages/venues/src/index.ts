export {
  VenueBundleSchema,
  ScoreScaleSchema,
  ReviewSectionSchema,
  PrecheckRuleSchema,
  CalibrationSchema,
  SourceSchema,
  VenueBundleStatusSchema,
  type VenueBundle,
  type ScoreScale,
  type ReviewSection,
  type PrecheckRule,
  type Calibration,
  type Source,
  type VenueBundleStatus,
} from "./schema.js";

export { loadManifest, loadAllVenueBundles } from "./loader.js";

import { loadAllVenueBundles } from "./loader.js";
import type { VenueBundle } from "./schema.js";

let _cache: VenueBundle[] | null = null;

function ensureLoaded(): VenueBundle[] {
  if (!_cache) {
    _cache = loadAllVenueBundles();
  }
  return _cache;
}

/**
 * Get a venue bundle by its full ID (e.g. "neurips/main/2026/v1").
 */
export function getVenue(id: string): VenueBundle | undefined {
  return ensureLoaded().find((v) => v.id === id);
}

/**
 * List all available venue bundles.
 */
export function listVenues(): VenueBundle[] {
  return ensureLoaded();
}

/**
 * Get all venue bundles for a given conference (e.g. "neurips").
 */
export function getVenuesByConference(conferenceId: string): VenueBundle[] {
  return ensureLoaded().filter((v) => v.conferenceId === conferenceId);
}
