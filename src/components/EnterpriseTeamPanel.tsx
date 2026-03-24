'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Role,
  Team,
  TeamMember,
  createTeam,
  addMember,
  removeMember,
  canManageTeam,
} from '@/lib/rbac';

interface EnterpriseTeamPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: Role;
  onRoleChange: (role: Role) => void;
}

const STORAGE_ROLE_KEY = 'mao_user_role';
const STORAGE_TEAM_KEY = 'mao_team';

export default function EnterpriseTeamPanel({
  isOpen,
  onClose,
  currentRole,
  onRoleChange,
}: EnterpriseTeamPanelProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Role>('member');

  useEffect(() => {
    if (!isOpen) return;
    const savedTeam = localStorage.getItem(STORAGE_TEAM_KEY);
    if (savedTeam) {
      try {
        setTeam(JSON.parse(savedTeam) as Team);
        return;
      } catch {
        // ignore malformed local data
      }
    }
    const initialTeam = createTeam('Engineering Workspace', {
      id: 'u-admin',
      name: 'Workspace Admin',
      email: 'admin@local.workspace',
    });
    setTeam(initialTeam);
    localStorage.setItem(STORAGE_TEAM_KEY, JSON.stringify(initialTeam));
  }, [isOpen]);

  const persistTeam = (nextTeam: Team) => {
    setTeam(nextTeam);
    localStorage.setItem(STORAGE_TEAM_KEY, JSON.stringify(nextTeam));
  };

  const handleAddMember = () => {
    if (!team || !memberName.trim() || !memberEmail.trim()) return;
    try {
      const next = addMember(team, {
        id: `u_${Date.now().toString(36)}`,
        name: memberName.trim(),
        email: memberEmail.trim(),
        role: memberRole,
      });
      persistTeam({ ...next });
      setMemberName('');
      setMemberEmail('');
      setMemberRole('member');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add member');
    }
  };

  const canEditTeam = useMemo(() => canManageTeam(currentRole), [currentRole]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 920,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'linear-gradient(135deg, rgba(12,12,22,0.99), rgba(18,18,32,0.99))',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Enterprise Team & RBAC</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Manage role-based access and workspace members
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>Current Access Role</div>
            <select
              value={currentRole}
              onChange={(e) => {
                const next = e.target.value as Role;
                onRoleChange(next);
                localStorage.setItem(STORAGE_ROLE_KEY, next);
              }}
              style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
            >
              <option value="admin">admin</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)' }}>
            <div style={{ color: '#a5b4fc', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>Policy Snapshot</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Run pipelines: <strong>{currentRole !== 'viewer' ? 'Allowed' : 'Denied'}</strong><br />
              Manage settings: <strong>{currentRole === 'admin' ? 'Allowed' : 'Denied'}</strong><br />
              Manage team: <strong>{canEditTeam ? 'Allowed' : 'Denied'}</strong>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Team Members</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {team?.members.map((m: TeamMember) => (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.8fr 0.6fr', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#fff', fontSize: '12px' }}>{m.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{m.email}</span>
                <span style={{ color: '#93c5fd', fontSize: '12px', textTransform: 'uppercase' }}>{m.role}</span>
                <button
                  disabled={!canEditTeam}
                  onClick={() => {
                    if (!team) return;
                    try {
                      persistTeam({ ...removeMember(team, m.id) });
                    } catch (error) {
                      alert(error instanceof Error ? error.message : 'Failed to remove member');
                    }
                  }}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '7px',
                    border: '1px solid rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.12)',
                    color: '#fca5a5',
                    fontSize: '11px',
                    cursor: canEditTeam ? 'pointer' : 'not-allowed',
                    opacity: canEditTeam ? 1 : 0.55,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {canEditTeam && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Invite Member</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 120px', gap: '8px' }}>
              <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Full name" style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff' }} />
              <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="Email" style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff' }} />
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as Role)} style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
              <button onClick={handleAddMember} style={{ padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
