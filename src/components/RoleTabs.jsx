import { getRoleById, getRoleIds } from '../../v2_definitive/src/bots.js';

export default function RoleTabs({ activeRoleId, allowedRoles, onRoleChange }) {
  return (
    <div
      className="ihcm-tabs"
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        overflowX: 'auto'
      }}
    >
      {getRoleIds().filter(roleId => allowedRoles.includes(roleId)).map(roleId => {
        const role = getRoleById(roleId);
        const isActive = roleId === activeRoleId;
        return (
          <button
            key={roleId}
            onClick={() => onRoleChange(roleId)}
            className={`ihcm-tab ${isActive ? 'ihcm-tab-active' : ''}`}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: isActive ? role?.colorBg || '#e5e7eb' : 'transparent',
              color: isActive ? role?.color || '#1f2937' : '#6b7280',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {role?.tab || roleId}
          </button>
        );
      })}
    </div>
  );
}
