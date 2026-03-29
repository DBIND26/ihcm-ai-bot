// ============================================================================
// Building History — local storage for building events and survey data
// ============================================================================
// Stores per-building history: survey citations, operational events,
// leadership changes, census milestones, etc.
//
// Pre-auth scaffold — server-side persistence deferred to next layer.
//
// Shape:
// {
//   "arkadelphia": {
//     surveys: [
//       { date, type, citations: [...], totalTags, criticalTags, rawFile? }
//     ],
//     events: [
//       { date, category, title, description }
//     ]
//   }
// }

const HISTORY_KEY = 'ihcm_building_history';

function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage full — fail silently
  }
}

// ── Survey history ──

export function addSurvey(buildingId, surveyData) {
  const history = getHistory();
  if (!history[buildingId]) {
    history[buildingId] = { surveys: [], events: [] };
  }

  const survey = {
    id: `survey_${Date.now()}`,
    date: surveyData.survey_date || new Date().toISOString().split('T')[0],
    type: surveyData.survey_type || 'standard',
    facilityName: surveyData.facility_name,
    providerNumber: surveyData.provider_number,
    citations: (surveyData.citations || []).map(c => ({
      fTag: c.f_tag,
      regulation: c.regulation,
      tagDescription: c.tag_description,
      scopeSeverity: c.scope_severity,
      deficientPractice: c.deficient_practice?.slice(0, 1000),
      findings: c.findings?.slice(0, 3000),
      pocDue: c.plan_of_correction_due,
    })),
    totalTags: surveyData.total_citations || 0,
    criticalTags: surveyData.critical_tags || [],
    addedAt: new Date().toISOString(),
  };

  history[buildingId].surveys.unshift(survey);
  // Keep max 20 surveys per building
  history[buildingId].surveys = history[buildingId].surveys.slice(0, 20);

  saveHistory(history);
  return survey;
}

export function getSurveys(buildingId) {
  const history = getHistory();
  return history[buildingId]?.surveys || [];
}

export function getLatestSurvey(buildingId) {
  const surveys = getSurveys(buildingId);
  return surveys[0] || null;
}

// ── Operational events ──

export function addEvent(buildingId, event) {
  const history = getHistory();
  if (!history[buildingId]) {
    history[buildingId] = { surveys: [], events: [] };
  }

  const entry = {
    id: `event_${Date.now()}`,
    date: event.date || new Date().toISOString().split('T')[0],
    category: event.category || 'general',
    title: event.title,
    description: event.description,
    addedAt: new Date().toISOString(),
  };

  history[buildingId].events.unshift(entry);
  history[buildingId].events = history[buildingId].events.slice(0, 100);

  saveHistory(history);
  return entry;
}

export function getEvents(buildingId) {
  const history = getHistory();
  return history[buildingId]?.events || [];
}

// ── Combined context for the bot ──

export function getBuildingHistoryContext(buildingId) {
  const surveys = getSurveys(buildingId);
  const events = getEvents(buildingId);

  if (surveys.length === 0 && events.length === 0) return null;

  const parts = ['BUILDING HISTORY'];

  if (surveys.length > 0) {
    parts.push(`\nSURVEY HISTORY (${surveys.length} survey${surveys.length > 1 ? 's' : ''} on file):`);
    for (const survey of surveys.slice(0, 5)) {
      const tagList = survey.citations.map(c => c.fTag).join(', ');
      const critList = survey.criticalTags.length > 0
        ? ` | CRITICAL: ${survey.criticalTags.join(', ')}`
        : '';
      parts.push(`- ${survey.date} ${survey.type} survey: ${survey.totalTags} citation(s) [${tagList}]${critList}`);
    }
  }

  if (events.length > 0) {
    parts.push(`\nOPERATIONAL EVENTS (${events.length} event${events.length > 1 ? 's' : ''}):`);
    for (const event of events.slice(0, 10)) {
      parts.push(`- ${event.date} [${event.category}] ${event.title}: ${event.description}`);
    }
  }

  return parts.join('\n');
}

// ── Full history for a building ──

export function getBuildingHistory(buildingId) {
  const history = getHistory();
  return history[buildingId] || { surveys: [], events: [] };
}

// ── Clear ──

export function clearBuildingHistory(buildingId) {
  const history = getHistory();
  delete history[buildingId];
  saveHistory(history);
}

// ── Event categories ──
export const EVENT_CATEGORIES = [
  { value: 'leadership', label: 'Leadership Change' },
  { value: 'census', label: 'Census Milestone' },
  { value: 'staffing', label: 'Staffing Change' },
  { value: 'survey', label: 'Survey/Inspection' },
  { value: 'incident', label: 'Significant Incident' },
  { value: 'regulatory', label: 'Regulatory Action' },
  { value: 'financial', label: 'Financial Event' },
  { value: 'general', label: 'General Note' },
];
