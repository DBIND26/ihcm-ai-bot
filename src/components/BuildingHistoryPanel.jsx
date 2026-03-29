import React, { useState } from 'react';
import { EVENT_CATEGORIES } from '../buildingHistory.js';

export default function BuildingHistoryPanel({ activeBuildingId, activeBuildings, historyData, onAddEvent }) {
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ category: 'general', title: '', description: '', date: '' });

  const handleAddEvent = () => {
    if (!activeBuildingId || activeBuildingId === 'none') return;
    if (!newEvent.title.trim()) return;
    onAddEvent({
      ...newEvent,
      date: newEvent.date || new Date().toISOString().split('T')[0],
    });
    setNewEvent({ category: 'general', title: '', description: '', date: '' });
    setShowAddEvent(false);
  };

  return (
    <div style={{
      padding: '16px 24px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e5e7eb',
      maxHeight: '300px',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
          Building History — {activeBuildings.find(b => b.id === activeBuildingId)?.label || activeBuildingId}
        </h3>
        <button
          onClick={() => setShowAddEvent(!showAddEvent)}
          style={{
            padding: '4px 12px', borderRadius: '4px', border: '1px solid #d1d5db',
            backgroundColor: 'white', cursor: 'pointer', fontSize: '12px',
            fontWeight: '500', color: '#4b5563'
          }}
        >
          + Add Event
        </button>
      </div>

      {showAddEvent && (
        <div style={{
          padding: '12px', backgroundColor: 'white', borderRadius: '6px',
          border: '1px solid #d1d5db', marginBottom: '12px',
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={newEvent.category}
              onChange={e => setNewEvent(prev => ({ ...prev, category: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}>
              {EVENT_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <input type="date" value={newEvent.date}
              onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          </div>
          <input type="text" placeholder="Event title..." value={newEvent.title}
            onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          <input type="text" placeholder="Description (optional)..." value={newEvent.description}
            onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
            style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          <button onClick={handleAddEvent} disabled={!newEvent.title.trim()}
            style={{
              padding: '6px 12px', borderRadius: '4px', border: 'none',
              backgroundColor: newEvent.title.trim() ? '#3b82f6' : '#d1d5db',
              color: 'white', cursor: newEvent.title.trim() ? 'pointer' : 'not-allowed',
              fontSize: '13px', fontWeight: '500', alignSelf: 'flex-start'
            }}>
            Save Event
          </button>
        </div>
      )}

      {historyData.surveys.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Surveys ({historyData.surveys.length})
          </h4>
          {historyData.surveys.map((survey, idx) => (
            <div key={survey.id || idx} style={{
              padding: '8px 12px', backgroundColor: 'white', borderRadius: '4px',
              border: '1px solid #e5e7eb', marginBottom: '4px', fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{survey.date} — {survey.type} survey</strong>
                <span style={{ color: '#6b7280' }}>{survey.totalTags} citation(s)</span>
              </div>
              {survey.criticalTags?.length > 0 && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  Critical: {survey.criticalTags.join(', ')}
                </div>
              )}
              {survey.citations?.length > 0 && (
                <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                  Tags: {survey.citations.map(c => c.fTag).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {historyData.events.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Events ({historyData.events.length})
          </h4>
          {historyData.events.map((event, idx) => (
            <div key={event.id || idx} style={{
              padding: '8px 12px', backgroundColor: 'white', borderRadius: '4px',
              border: '1px solid #e5e7eb', marginBottom: '4px', fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{event.title}</strong>
                <span style={{
                  fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                  backgroundColor: '#f3f4f6', color: '#4b5563'
                }}>
                  {event.category}
                </span>
              </div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                {event.date} {event.description && `— ${event.description}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {historyData.surveys.length === 0 && historyData.events.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
          No history yet. Upload a 2567 or add events to build this building's timeline.
        </p>
      )}
    </div>
  );
}
