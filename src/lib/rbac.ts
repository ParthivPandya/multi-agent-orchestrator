// ============================================================
// Role-Based Access Control (RBAC) & Team Management
// Competitor Feature: CrewAI-style team management
// Supports admin/member/viewer roles and workspace isolation.
// ============================================================

export type Role = 'admin' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  joinedAt: number;
  lastActiveAt: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  createdAt: number;
  settings: TeamSettings;
}

export interface TeamSettings {
  allowMemberPipelineRuns: boolean;
  allowViewerExport: boolean;
  requireHITLForDeployment: boolean;
  maxConcurrentPipelines: number;
  allowedProviders: string[];
  auditLogRetentionDays: number;
}

// ─── Permission Definitions ─────────────────────────────────

export interface Permission {
  action: string;
  resource: string;
  description: string;
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { action: 'create', resource: 'pipeline', description: 'Create and run pipelines' },
    { action: 'read', resource: 'pipeline', description: 'View pipeline results' },
    { action: 'delete', resource: 'pipeline', description: 'Delete pipeline history' },
    { action: 'manage', resource: 'team', description: 'Manage team members' },
    { action: 'manage', resource: 'settings', description: 'Configure system settings' },
    { action: 'manage', resource: 'connectors', description: 'Configure integrations' },
    { action: 'export', resource: 'audit', description: 'Export audit logs' },
    { action: 'run', resource: 'code', description: 'Execute code in sandbox' },
    { action: 'approve', resource: 'hitl', description: 'Approve/reject HITL requests' },
    { action: 'manage', resource: 'workflows', description: 'Create/edit DAG workflows' },
    { action: 'manage', resource: 'providers', description: 'Configure LLM providers' },
    { action: 'manage', resource: 'sessions', description: 'Manage all sessions' },
  ],
  member: [
    { action: 'create', resource: 'pipeline', description: 'Create and run pipelines' },
    { action: 'read', resource: 'pipeline', description: 'View pipeline results' },
    { action: 'export', resource: 'audit', description: 'Export own audit logs' },
    { action: 'run', resource: 'code', description: 'Execute code in sandbox' },
    { action: 'approve', resource: 'hitl', description: 'Approve/reject HITL requests' },
    { action: 'read', resource: 'workflows', description: 'View DAG workflows' },
    { action: 'manage', resource: 'sessions', description: 'Manage own sessions' },
  ],
  viewer: [
    { action: 'read', resource: 'pipeline', description: 'View pipeline results' },
    { action: 'read', resource: 'workflows', description: 'View DAG workflows' },
    { action: 'read', resource: 'sessions', description: 'View sessions' },
  ],
};

// ─── Permission Checking ─────────────────────────────────────

export function hasPermission(role: Role, action: string, resource: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some(p => p.action === action && p.resource === resource);
}

export function canRunPipeline(role: Role): boolean {
  return hasPermission(role, 'create', 'pipeline');
}

export function canManageTeam(role: Role): boolean {
  return hasPermission(role, 'manage', 'team');
}

export function canManageSettings(role: Role): boolean {
  return hasPermission(role, 'manage', 'settings');
}

export function canApproveHITL(role: Role): boolean {
  return hasPermission(role, 'approve', 'hitl');
}

export function canManageWorkflows(role: Role): boolean {
  return hasPermission(role, 'manage', 'workflows');
}

export function canExecuteCode(role: Role): boolean {
  return hasPermission(role, 'run', 'code');
}

// ─── Team Management ─────────────────────────────────────────

const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  allowMemberPipelineRuns: true,
  allowViewerExport: false,
  requireHITLForDeployment: false,
  maxConcurrentPipelines: 3,
  allowedProviders: ['groq', 'openai', 'anthropic', 'ollama'],
  auditLogRetentionDays: 90,
};

export function createTeam(name: string, adminMember: Omit<TeamMember, 'role' | 'joinedAt' | 'lastActiveAt'>): Team {
  return {
    id: `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    description: '',
    members: [{
      ...adminMember,
      role: 'admin',
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
    }],
    createdAt: Date.now(),
    settings: { ...DEFAULT_TEAM_SETTINGS },
  };
}

export function addMember(team: Team, member: Omit<TeamMember, 'joinedAt' | 'lastActiveAt'>): Team {
  if (team.members.find(m => m.email === member.email)) {
    throw new Error(`Member with email ${member.email} already exists`);
  }
  team.members.push({
    ...member,
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
  });
  return team;
}

export function removeMember(team: Team, memberId: string): Team {
  const adminCount = team.members.filter(m => m.role === 'admin').length;
  const member = team.members.find(m => m.id === memberId);
  if (member?.role === 'admin' && adminCount <= 1) {
    throw new Error('Cannot remove the last admin');
  }
  team.members = team.members.filter(m => m.id !== memberId);
  return team;
}

export function updateMemberRole(team: Team, memberId: string, newRole: Role): Team {
  const member = team.members.find(m => m.id === memberId);
  if (!member) throw new Error('Member not found');
  
  // Prevent removing last admin
  if (member.role === 'admin' && newRole !== 'admin') {
    const adminCount = team.members.filter(m => m.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('Cannot demote the last admin');
    }
  }
  
  member.role = newRole;
  return team;
}
