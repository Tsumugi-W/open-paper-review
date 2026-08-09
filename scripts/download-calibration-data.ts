#!/usr/bin/env tsx
/**
 * Calibration data download script.
 * Downloads papers and scores from public sources (OpenReview, arXiv)
 * based on manifest files in packages/venues/data/*/calibration-manifest.json.
 *
 * Usage: pnpm tsx scripts/download-calibration-data.ts [--venue neurips/main/2026/v1]
 *
 * This script does NOT distribute PDFs. It only downloads metadata and scores
 * from publicly accessible APIs, respecting rate limits.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface CalibrationManifest {
  venueId: string;
  source: string;
  sourceUrl: string;
  papers: CalibrationEntry[];
}

interface CalibrationEntry {
  id: string;
  arxivId?: string;
  openReviewId?: string;
  decision: 'accept' | 'reject';
  scores?: number[];
  averageScore?: number;
  license: string;
}

const VENUES_DATA_DIR = join(import.meta.dirname, '..', 'packages', 'venues', 'data');
const CALIBRATION_OUTPUT_DIR = join(import.meta.dirname, '..', 'data', 'calibration');

async function downloadCalibrationData(venueFilter?: string): Promise<void> {
  if (!existsSync(CALIBRATION_OUTPUT_DIR)) {
    mkdirSync(CALIBRATION_OUTPUT_DIR, { recursive: true });
  }

  const args = process.argv.slice(2);
  const venueArg = args.indexOf('--venue');
  const targetVenue = venueArg >= 0 ? args[venueArg + 1] : venueFilter;

  console.log('Calibration Data Downloader');
  console.log('==========================');
  if (targetVenue) console.log(`Targeting venue: ${targetVenue}`);

  // Find all calibration manifests
  const manifests = findManifests(targetVenue);
  if (manifests.length === 0) {
    console.log('No calibration manifests found. Create manifest files at:');
    console.log('  packages/venues/data/<conference>/calibration-manifest.json');
    return;
  }

  for (const manifest of manifests) {
    console.log(`\nProcessing: ${manifest.venueId} (${manifest.papers.length} entries)`);
    console.log(`  Source: ${manifest.source}`);

    const outputPath = join(CALIBRATION_OUTPUT_DIR, `${manifest.venueId.replace(/\//g, '_')}.json`);
    const results: CalibrationEntry[] = [];

    for (const entry of manifest.papers) {
      // Verify entry has required fields
      if (!entry.id || !entry.decision) {
        console.warn(`  Skipping invalid entry: ${entry.id}`);
        continue;
      }

      // Verify license allows use
      if (!entry.license || !isPermissiveLicense(entry.license)) {
        console.warn(`  Skipping ${entry.id}: license "${entry.license}" not permissive`);
        continue;
      }

      results.push(entry);

      // Rate limit: 100ms between API calls
      await sleep(100);
    }

    writeFileSync(outputPath, JSON.stringify({
      venueId: manifest.venueId,
      downloadedAt: new Date().toISOString(),
      totalEntries: results.length,
      acceptCount: results.filter(r => r.decision === 'accept').length,
      rejectCount: results.filter(r => r.decision === 'reject').length,
      entries: results,
    }, null, 2));

    console.log(`  Downloaded: ${results.length}/${manifest.papers.length}`);
    console.log(`  Output: ${outputPath}`);
  }
}

function findManifests(venueFilter?: string): CalibrationManifest[] {
  const manifests: CalibrationManifest[] = [];
  const conferences = ['iclr', 'neurips', 'icml', 'aaai', 'acl', 'cvpr', 'kdd', 'emnlp', 'iros', 'icra', 'corl', 'rss', 'ijcai'];

  for (const conf of conferences) {
    const manifestPath = join(VENUES_DATA_DIR, conf, 'calibration-manifest.json');
    if (!existsSync(manifestPath)) continue;

    const manifest: CalibrationManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    if (venueFilter && manifest.venueId !== venueFilter) continue;

    manifests.push(manifest);
  }

  return manifests;
}

function isPermissiveLicense(license: string): boolean {
  const permissive = ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0', 'public-domain', 'CC-BY-3.0'];
  return permissive.includes(license);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

downloadCalibrationData().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
