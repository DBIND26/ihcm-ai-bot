// ============================================================================
// Building History — shared constants
// ============================================================================
// Event categories used by BuildingHistoryPanel.
// All persistence is now server-side via /api/building-history.

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
