// ============================================================================
// IHCM AI Bot Widget v2 — Building Definitions (DEFINITIVE)
// ============================================================================
// Static fallback for ihcm_bot.buildings + ihcm_bot.building_profiles tables.
//
// Three-layer building model:
//   1. BUILDINGS        — stable identity (rarely changes)
//   2. BUILDING_PROFILES — strategic context (quarterly review)
//   3. Snapshots + Intelligence — fetched from Supabase at runtime, never hardcoded
//
// In production, api/chat.js fetches from ihcm_bot.v_building_context.
// This file provides shape definitions and offline/dev fallback data.
// ============================================================================

// ── 1. Building identity (stable) ──
// Matches ihcm_bot.buildings table shape.

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
    strategicStatus: null,
    strategicLabel: null,
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
    strategicStatus: 'stable',
    strategicLabel: null,
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
    strategicStatus: 'stable',
    strategicLabel: null,
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
    strategicStatus: 'model',
    strategicLabel: 'THE MODEL BUILDING',
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
    strategicStatus: 'stable',
    strategicLabel: null,
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
    strategicStatus: 'turnaround',
    strategicLabel: 'HIGHEST PRIORITY TURNAROUND',
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
    strategicStatus: 'stable',
    strategicLabel: 'Nightingale 5 Pilot',
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
    strategicStatus: 'stable',
    strategicLabel: null,
  },
];


// ── 2. Building profiles (strategic, quarterly review) ──
// Matches ihcm_bot.building_profiles table shape.
// In production, fetched from Supabase. These are empty shells for dev.

export const BUILDING_PROFILES = {
  arkadelphia: {
    buildingId: 'arkadelphia',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  stonegate: {
    buildingId: 'stonegate',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  glenwood: {
    buildingId: 'glenwood',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  thewoods: {
    buildingId: 'thewoods',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  crossett: {
    buildingId: 'crossett',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'monthly',
    owner: '',
    updatedAt: null,
  },
  marymount: {
    buildingId: 'marymount',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
  erie: {
    buildingId: 'erie',
    payerContext: '',
    marketSummary: '',
    referralSummary: '',
    physicianRelationships: '',
    hospitalPartners: '',
    growthBarriers: [],
    growthOpportunities: [],
    surveyContext: '',
    staffingContext: '',
    reimbursementContext: '',
    riskWatchlist: '',
    strategicNotes: '',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: '',
    updatedAt: null,
  },
};


// ── Helpers ──

export function getBuildingById(id) {
  return BUILDINGS.find(b => b.id === id) || null;
}

export function getBuildingBySlug(slug) {
  return BUILDINGS.find(b => b.slug === slug) || null;
}

export function getActiveBuildings() {
  return BUILDINGS.filter(b => b.id !== 'none');
}

export function getBuildingProfile(buildingSlug) {
  return BUILDING_PROFILES[buildingSlug] || null;
}
