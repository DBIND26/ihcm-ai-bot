// ============================================================================
// IHCM AI Bot Widget v2 — Building Definitions
// ============================================================================
// Three-layer building model:
//   1. BUILDINGS — stable identity (rarely changes)
//   2. BUILDING_PROFILES — strategic context (quarterly review)
//   3. BUILDING_SNAPSHOTS — operational facts (weekly/monthly review)
//
// In v2, these are loaded from Supabase at runtime.
// This file provides the shape and a static fallback for offline/dev use.
//
// An intelligence layer (building_intelligence_insights) is generated
// from snapshots and profiles and is NOT hardcoded here.
// ============================================================================

// ── 1. Building identity (stable) ──

export const BUILDINGS = [
  {
    id: 'none',
    slug: 'none',
    label: 'Select your building...',
    shortName: '',
    state: '',
    cmsId: null,
    bedCapacity: null,
    marketType: null,
  },
  {
    id: 'arkadelphia',
    slug: 'arkadelphia',
    label: 'Nightingale at Arkadelphia',
    shortName: 'Arkadelphia',
    state: 'AR',
    cmsId: '045350',
    bedCapacity: 100,
    marketType: 'rural',
  },
  {
    id: 'stonegate',
    slug: 'stonegate',
    label: 'Nightingale at Stonegate',
    shortName: 'Stonegate',
    state: 'AR',
    cmsId: '045437',
    bedCapacity: 76,
    marketType: 'suburban',
  },
  {
    id: 'glenwood',
    slug: 'glenwood',
    label: 'Nightingale at Glenwood',
    shortName: 'Glenwood',
    state: 'AR',
    cmsId: '045403',
    bedCapacity: 72,
    marketType: 'rural',
  },
  {
    id: 'thewoods',
    slug: 'thewoods',
    label: 'The Woods',
    shortName: 'The Woods',
    state: 'AR',
    cmsId: '045176',
    bedCapacity: 120,
    marketType: 'suburban',
  },
  {
    id: 'crossett',
    slug: 'crossett',
    label: 'Nightingale at Crossett',
    shortName: 'Crossett',
    state: 'AR',
    cmsId: '045190',
    bedCapacity: 72,
    marketType: 'rural',
  },
  {
    id: 'marymount',
    slug: 'marymount',
    label: 'Villa at Marymount',
    shortName: 'Marymount',
    state: 'OH',
    cmsId: '366335',
    bedCapacity: null,
    marketType: 'suburban',
  },
  {
    id: 'erie',
    slug: 'erie',
    label: 'Nightingale Erie',
    shortName: 'Erie',
    state: 'PA',
    cmsId: '395042',
    bedCapacity: null,
    marketType: 'urban',
  },
];


// ── 2. Building profiles (strategic, quarterly review) ──
// Shape matches the building_profiles table in Supabase.
// In production, these are fetched from the database.

export const BUILDING_PROFILES = {
  arkadelphia: {
    buildingId: 'arkadelphia',
    strategicStatus: 'stable',
    strategicIdentity: null,
    referralSources: '',      // populate from Supabase
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  stonegate: {
    buildingId: 'stonegate',
    strategicStatus: 'stable',
    strategicIdentity: null,
    referralSources: '',
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  glenwood: {
    buildingId: 'glenwood',
    strategicStatus: 'model',
    strategicIdentity: 'THE MODEL BUILDING',
    referralSources: '',
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  thewoods: {
    buildingId: 'thewoods',
    strategicStatus: 'stable',
    strategicIdentity: null,
    referralSources: '',
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  crossett: {
    buildingId: 'crossett',
    strategicStatus: 'turnaround',
    strategicIdentity: 'HIGHEST PRIORITY TURNAROUND',
    referralSources: '',
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'monthly',
    owner: '',
    updatedAt: null,
  },
  marymount: {
    buildingId: 'marymount',
    strategicStatus: 'stable',
    strategicIdentity: null,
    referralSources: '',
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  erie: {
    buildingId: 'erie',
    strategicStatus: 'stable',
    strategicIdentity: 'Nightingale 5 Pilot',
    referralSources: '',
    physicianGaps: '',
    hospitalPartners: '',
    payerContext: '',
    riskWatchlist: '',
    opportunities: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
};


// ── 3. Building snapshots (operational, weekly/monthly review) ──
// Shape matches the building_snapshots table in Supabase.
// In production, the latest snapshot per building is fetched at runtime.

export const BUILDING_SNAPSHOTS = {
  arkadelphia: {
    buildingId: 'arkadelphia',
    snapshotDate: null,
    census: null,
    occupancyGap: null,
    skilledMix: null,
    payerMix: null,
    surveyExposure: null,
    staffingPressure: null,
    arIssues: null,
    topPriorities: [],
    owner: '',
    updatedAt: null,
  },
  // ... same shape for each building — populate from Supabase
};


// ── Helpers ──

export function getBuildingById(id) {
  return BUILDINGS.find(b => b.id === id) || null;
}

export function getActiveBuildings() {
  return BUILDINGS.filter(b => b.id !== 'none');
}

export function getBuildingProfile(buildingSlug) {
  return BUILDING_PROFILES[buildingSlug] || null;
}

export function getBuildingSnapshot(buildingSlug) {
  return BUILDING_SNAPSHOTS[buildingSlug] || null;
}
