import { describe, it, expect } from 'vitest';
import { listVenues, getVenue, getVenuesByConference } from '../index.js';

describe('Venue Loader', () => {
  it('loads all 13 built-in venues', () => {
    const venues = listVenues();
    expect(venues.length).toBeGreaterThanOrEqual(13);
  });

  it('each venue has required fields', () => {
    const venues = listVenues();
    for (const venue of venues) {
      expect(venue.id).toBeTruthy();
      expect(venue.conferenceId).toBeTruthy();
      expect(venue.track).toBeTruthy();
      expect(venue.year).toBeGreaterThan(2020);
      expect(venue.version).toBeGreaterThanOrEqual(1);
      expect(['rubric_only', 'calibrated', 'deprecated']).toContain(venue.status);
      expect(venue.scoreScale.min).toBeLessThan(venue.scoreScale.max);
      expect(venue.reviewSections.length).toBeGreaterThan(0);
      expect(venue.source.url).toBeTruthy();
    }
  });

  it('retrieves venue by id', () => {
    const venue = getVenue('neurips/main/2026/v1');
    expect(venue).not.toBeNull();
    expect(venue?.conferenceId).toBe('neurips');
  });

  it('returns null for non-existent venue', () => {
    expect(getVenue('nonexistent/main/2099/v1')).toBeNull();
  });

  it('filters by conference', () => {
    const venues = getVenuesByConference('neurips');
    expect(venues.length).toBeGreaterThan(0);
    expect(venues.every(v => v.conferenceId === 'neurips')).toBe(true);
  });

  it('score scales are valid ranges', () => {
    const venues = listVenues();
    for (const venue of venues) {
      const { min, max, step } = venue.scoreScale;
      expect(max).toBeGreaterThan(min);
      expect(step).toBeGreaterThan(0);
      expect((max - min) / step).toBeGreaterThanOrEqual(2);
    }
  });

  it('all venues have at least one precheck rule', () => {
    const venues = listVenues();
    for (const venue of venues) {
      expect(venue.precheckRules.length).toBeGreaterThan(0);
    }
  });

  it('venue IDs follow convention', () => {
    const venues = listVenues();
    const pattern = /^[a-z]+\/[a-z_]+\/\d{4}\/v\d+$/;
    for (const venue of venues) {
      expect(venue.id).toMatch(pattern);
    }
  });
});
