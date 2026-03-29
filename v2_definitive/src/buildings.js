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
    payerContext: 'Predominantly Medicaid with limited Medicare Part A short-stay volume. AR Medicaid reimbursement rates apply. Some private-pay and hospice census.',
    marketSummary: 'Rural market in Clark County, AR. Limited local competition. Primary service area within 30-mile radius of Arkadelphia. Population trends flat.',
    referralSummary: 'Primary referrals from Baptist Health Medical Center - Arkadelphia and local physician offices. Some transfers from Little Rock metro hospitals.',
    physicianRelationships: 'Local medical director on contract. Limited specialist access — most specialty care requires travel to Hot Springs or Little Rock.',
    hospitalPartners: 'Baptist Health Medical Center - Arkadelphia (primary), CHI St. Vincent Hot Springs (secondary)',
    growthBarriers: ['Rural location limits referral volume', 'Specialist access challenges', 'Workforce availability in rural AR'],
    growthOpportunities: ['Increase Medicare Part A admissions from Baptist Health', 'Expand therapy programs to attract short-stay rehab', 'Hospice partnerships'],
    surveyContext: 'Review building history for latest survey results. Upload 2567 forms for detailed citation analysis.',
    staffingContext: 'Rural staffing market — CNA recruitment is primary challenge. Agency usage varies. Nursing leadership stable.',
    reimbursementContext: 'AR Medicaid rates. PDPM for Medicare Part A. Monitor AR rate updates and any legislative changes.',
    riskWatchlist: 'CNA staffing levels, rural recruitment pipeline, Medicare census volume',
    strategicNotes: 'Stable building in rural AR market. Focus on maintaining quality scores and incrementally growing Medicare census.',
    confidence: 'medium',
    reviewCadence: 'quarterly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
  },
  stonegate: {
    buildingId: 'stonegate',
    payerContext: 'Mixed payer — Medicaid majority with growing Medicare Part A short-stay program. Some managed care contracts in AR market.',
    marketSummary: 'Suburban AR market. Moderate local competition. Positioned to capture overflow from Little Rock metro area facilities.',
    referralSummary: 'Hospital discharge planners from nearby acute care facilities. Growing relationship with orthopedic and cardiac rehab referral sources.',
    physicianRelationships: 'Active medical director. Access to specialists within reasonable drive time. Telehealth supplementing in-person visits.',
    hospitalPartners: 'Regional hospitals in suburban AR corridor',
    growthBarriers: ['Competition from other SNFs in suburban corridor', 'Managed care rate pressure'],
    growthOpportunities: ['Expand short-stay rehab program', 'Managed care contract negotiations', 'Specialized clinical programs'],
    surveyContext: 'Review building history for latest survey results. Upload 2567 forms for detailed citation analysis.',
    staffingContext: 'Suburban labor market provides moderate staffing pool. Competitive wages needed to retain CNAs and nurses.',
    reimbursementContext: 'AR Medicaid rates plus managed care contracts. PDPM for Medicare. Watch for managed care rate renegotiations.',
    riskWatchlist: 'Managed care contract terms, competitive positioning, therapy utilization rates',
    strategicNotes: 'Stable suburban facility with growth potential through Medicare and managed care volume. 76-bed capacity.',
    confidence: 'medium',
    reviewCadence: 'quarterly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
  },
  glenwood: {
    buildingId: 'glenwood',
    payerContext: 'Mixed payer with emphasis on quality metrics to support favorable rates. Medicaid base with targeted Medicare growth.',
    marketSummary: 'Rural market in Pike County, AR. Limited competition — positioned as the quality leader in the local market.',
    referralSummary: 'Community hospital referrals and local physician network. Reputation-driven referral base.',
    physicianRelationships: 'Strong medical director engagement. Active QAPI participation. Good physician-facility communication.',
    hospitalPartners: 'Local community hospitals, with some referrals from Hot Springs and Little Rock for patients returning closer to home',
    growthBarriers: ['Small rural market limits total addressable volume', 'Distance from metro referral sources'],
    growthOpportunities: ['Leverage model-building status for best-practice programs', 'Pilot new clinical initiatives here first', 'Quality awards and recognition'],
    surveyContext: 'THE MODEL BUILDING — expected to maintain strong survey performance. Sets the standard for other IHCM facilities.',
    staffingContext: 'Stable leadership team. Strong retention rates relative to other buildings. Culture is a key differentiator.',
    reimbursementContext: 'AR Medicaid rates. PDPM for Medicare. Quality metrics support favorable positioning in any value-based programs.',
    riskWatchlist: 'Maintaining model status, leadership succession planning, rural market volume',
    strategicNotes: 'THE MODEL BUILDING. Best practices developed here are intended to be replicated across the portfolio. 72-bed rural facility with strong quality culture.',
    confidence: 'high',
    reviewCadence: 'quarterly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
  },
  thewoods: {
    buildingId: 'thewoods',
    payerContext: 'Largest bed capacity in portfolio (120 beds). Mixed payer with significant Medicaid and Medicare volumes. Scale enables diversified payer mix.',
    marketSummary: 'Suburban AR market. Largest IHCM facility by bed count. Positioned to serve a broader catchment area.',
    referralSummary: 'Multiple hospital referral sources given larger capacity. Ability to accept higher-acuity admissions.',
    physicianRelationships: 'Multiple attending physicians. Medical director oversees larger clinical operation. Specialist consults available.',
    hospitalPartners: 'Multiple regional hospitals given facility size and capacity',
    growthBarriers: ['Maintaining high occupancy at 120 beds requires consistent referral volume', 'Staffing at scale'],
    growthOpportunities: ['Largest capacity allows for specialized units or wings', 'Higher-acuity clinical programs', 'Volume-based managed care contracts'],
    surveyContext: 'Review building history for latest survey results. Upload 2567 forms for detailed citation analysis.',
    staffingContext: 'Largest staffing need across portfolio. Requires robust recruitment pipeline. Multiple shifts and unit management.',
    reimbursementContext: 'AR Medicaid rates. PDPM for Medicare. Volume supports negotiating leverage with managed care.',
    riskWatchlist: 'Occupancy rate at 120 beds, staffing ratios, quality consistency across larger operation',
    strategicNotes: 'Largest facility at 120 beds. Scale is both opportunity and challenge — focus on occupancy optimization and staffing stability.',
    confidence: 'medium',
    reviewCadence: 'quarterly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
  },
  crossett: {
    buildingId: 'crossett',
    payerContext: 'Predominantly Medicaid. Medicare Part A volume needs growth. Turnaround effort includes payer diversification.',
    marketSummary: 'Rural market in Ashley County, AR. Limited competition but also limited referral volume. Crossett is a small community.',
    referralSummary: 'Local hospital and physician referrals. Referral development is part of turnaround strategy.',
    physicianRelationships: 'Medical director engagement is critical to turnaround. Physician recruitment and retention a focus area.',
    hospitalPartners: 'Ashley County Medical Center (primary local partner)',
    growthBarriers: ['Small rural market with declining population', 'Historical quality/survey challenges', 'Staffing in remote location', 'Reputation rebuilding needed'],
    growthOpportunities: ['Turnaround success story potential', 'Community engagement and trust-building', 'Improved survey outcomes drive referrals'],
    surveyContext: 'HIGHEST PRIORITY TURNAROUND — survey performance improvement is critical. Close monitoring of all regulatory compliance.',
    staffingContext: 'Turnaround requires leadership stability and frontline staffing improvements. Recruitment in remote rural area is challenging.',
    reimbursementContext: 'AR Medicaid rates. Need to grow Medicare volume. Any quality penalties or survey issues directly impact reimbursement.',
    riskWatchlist: 'CRITICAL: Survey compliance, staffing stability, census volume, leadership retention, community reputation',
    strategicNotes: 'HIGHEST PRIORITY TURNAROUND. Monthly review cadence. All operational decisions should support quality improvement and regulatory compliance. 72 beds.',
    confidence: 'low',
    reviewCadence: 'monthly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
  },
  marymount: {
    buildingId: 'marymount',
    payerContext: 'Ohio payer landscape — OH Medicaid rates, Medicare Part A, managed care (including Buckeye, CareSource, Molina). Different reimbursement structure than AR buildings.',
    marketSummary: 'Suburban Ohio market. Nightingale 5 Pilot facility — testing new operational model. Competitive market with multiple SNF options.',
    referralSummary: 'Hospital system referrals in greater Cleveland/Akron market. Case manager and discharge planner relationships key.',
    physicianRelationships: 'Ohio medical director. Access to specialists in suburban OH. Different regulatory environment than AR.',
    hospitalPartners: 'Regional hospital systems in suburban Ohio corridor',
    growthBarriers: ['Competitive OH SNF market', 'Different state regulations than AR buildings', 'Managed care penetration and rate pressure'],
    growthOpportunities: ['Nightingale 5 Pilot — new operational model could differentiate', 'OH managed care growth', 'Specialized clinical programs'],
    surveyContext: 'Ohio state survey process. Different surveyor expectations and focus areas than AR. Review building history for latest results.',
    staffingContext: 'Ohio labor market — different wage scales and workforce dynamics than AR. CNA and nurse recruitment in competitive suburban market.',
    reimbursementContext: 'OH Medicaid rates (different from AR). Medicare PDPM. Managed care contracts with OH-specific payers (Buckeye, CareSource, Molina, etc.).',
    riskWatchlist: 'Nightingale 5 Pilot execution, OH regulatory differences, managed care contract performance',
    strategicNotes: 'Nightingale 5 Pilot facility — testing new operational model. Success here informs broader portfolio strategy. Ohio operations differ from AR in regulation, payer, and labor market.',
    confidence: 'medium',
    reviewCadence: 'quarterly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
  },
  erie: {
    buildingId: 'erie',
    payerContext: 'Pennsylvania payer landscape — PA Medicaid (among highest SNF rates nationally), Medicare Part A, managed care including UPMC Health Plan and Highmark.',
    marketSummary: 'Urban market in Erie, PA. Different competitive dynamics than rural AR buildings. UPMC and AHN hospital systems dominate the market.',
    referralSummary: 'UPMC Hamot and Saint Vincent Hospital are primary referral sources. Urban market provides consistent referral volume.',
    physicianRelationships: 'PA medical director. Urban setting provides better specialist access than rural AR locations.',
    hospitalPartners: 'UPMC Hamot (primary), Saint Vincent Hospital (secondary), other Erie-area acute care',
    growthBarriers: ['Competitive urban SNF market in Erie', 'PA regulatory requirements', 'UPMC system loyalty may favor UPMC-affiliated SNFs'],
    growthOpportunities: ['PA Medicaid rates are favorable', 'Urban referral volume', 'Specialty programs to differentiate from competitors'],
    surveyContext: 'Pennsylvania state survey process — PA DOH. Different surveyor focus and expectations than AR or OH. Review building history for latest results.',
    staffingContext: 'Urban PA labor market. Competitive wages required. More staffing options than rural AR but also more competition for workers.',
    reimbursementContext: 'PA Medicaid rates (generally higher than AR). Medicare PDPM. Managed care with UPMC Health Plan, Highmark, etc.',
    riskWatchlist: 'Competitive positioning vs. UPMC-affiliated SNFs, PA regulatory compliance, managed care contract terms',
    strategicNotes: 'Urban PA facility — different operational profile than AR buildings. PA Medicaid rates are a strength. Focus on hospital relationship development and competitive differentiation.',
    confidence: 'medium',
    reviewCadence: 'quarterly',
    owner: 'Regional Operations',
    updatedAt: '2026-03-28',
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
