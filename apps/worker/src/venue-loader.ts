/**
 * Venue bundle loader.
 * Loads venue bundles from built-in data (packages/venues) or from the database,
 * and transforms them into the @opr/core VenueBundle interface format.
 */

import { getVenue, VenueBundleSchema } from "@opr/venues";
import type { VenueBundle as VenuesVenueBundle } from "@opr/venues";
import type { VenueBundle } from "@opr/core";
import { getDb, venueBundles } from "@opr/db";
import { eq } from "drizzle-orm";

// ─── Venue Loader ─────────────────────────────────────────────────────────────

/**
 * Load a venue bundle by ID.
 *
 * Resolution order:
 * 1. Try built-in venue data from packages/venues (e.g. "neurips/main/2026/v1")
 * 2. Fall back to the venueBundles table in the database (for user-uploaded custom venues)
 *
 * Validates against schema and transforms into the @opr/core VenueBundle format.
 */
export async function loadVenueBundle(venueBundleId: string): Promise<VenueBundle> {
  // 1. Try built-in venues
  const builtIn = getVenue(venueBundleId);
  if (builtIn) {
    return transformVenueBundle(builtIn);
  }

  // 2. Fall back to database
  const db = getDb();
  const record = await db.query.venueBundles.findFirst({
    where: eq(venueBundles.id, venueBundleId),
  });

  if (!record) {
    throw new Error(
      `Venue bundle not found: "${venueBundleId}". ` +
        "Check that the venue exists in built-in data or has been uploaded.",
    );
  }

  // The database stores the full bundle data in the metadata JSONB column
  const metadata = record.metadata as Record<string, unknown> | null;
  if (!metadata) {
    throw new Error(
      `Venue bundle "${venueBundleId}" exists in DB but has no metadata. ` +
        "The metadata column must contain the full venue bundle data.",
    );
  }

  // Reconstruct the full VenueBundle from the DB record + metadata
  // Spread metadata first so authoritative DB columns override any stale metadata fields
  const bundleData = {
    ...metadata,
    id: record.id,
    conferenceId: record.conferenceId,
    track: record.track,
    year: record.year,
    version: record.version,
    status: record.status,
  };

  // Validate against the venues schema
  const parsed = VenueBundleSchema.safeParse(bundleData);
  if (!parsed.success) {
    throw new Error(
      `Venue bundle "${venueBundleId}" failed schema validation: ${parsed.error.message}`,
    );
  }

  return transformVenueBundle(parsed.data);
}

// ─── Transform ────────────────────────────────────────────────────────────────

/**
 * Transforms a @opr/venues VenueBundle (zod-validated) into the @opr/core VenueBundle interface.
 * The two have slightly different field shapes.
 */
function transformVenueBundle(source: VenuesVenueBundle): VenueBundle {
  return {
    id: source.id,
    conferenceId: source.conferenceId,
    track: source.track,
    year: source.year,
    version: source.version,
    status: mapBundleStatus(source.status),
    scoreScale: source.scoreScale,
    reviewSections: source.reviewSections.map((s) => ({
      id: s.id,
      name: s.title,
      description: s.description,
      required: s.required,
      maxLength: s.maxLength,
    })),
    precheckRules: source.precheckRules.map((r) => ({
      id: r.id,
      name: r.id,
      description: r.message,
      severity: r.type === "hard_stop" ? "reject" : "warn",
      instruction: r.condition,
    })),
    calibrationStatus: mapCalibrationStatus(source.calibration.status),
    source: {
      origin: source.source.url,
      fetchedAt: source.source.accessDate,
    },
  };
}

function mapBundleStatus(
  status: "rubric_only" | "calibrated" | "deprecated",
): "draft" | "active" | "archived" {
  switch (status) {
    case "rubric_only":
      return "draft";
    case "calibrated":
      return "active";
    case "deprecated":
      return "archived";
  }
}

function mapCalibrationStatus(
  status: "rubric_only" | "partial" | "calibrated",
): "uncalibrated" | "partial" | "calibrated" {
  switch (status) {
    case "rubric_only":
      return "uncalibrated";
    case "partial":
      return "partial";
    case "calibrated":
      return "calibrated";
  }
}
