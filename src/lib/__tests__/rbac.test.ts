// ============================================================
// Unit Tests — RBAC Module
// Tests role-based permissions, team management, and edge cases.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canRunPipeline,
  canManageTeam,
  canManageSettings,
  canApproveHITL,
  canManageWorkflows,
  canExecuteCode,
  createTeam,
  addMember,
  removeMember,
  updateMemberRole,
  ROLE_PERMISSIONS,
  type Role,
} from '@/lib/rbac';

describe('RBAC — Permission Checking', () => {
  it('admin has all permissions', () => {
    expect(canRunPipeline('admin')).toBe(true);
    expect(canManageTeam('admin')).toBe(true);
    expect(canManageSettings('admin')).toBe(true);
    expect(canApproveHITL('admin')).toBe(true);
    expect(canManageWorkflows('admin')).toBe(true);
    expect(canExecuteCode('admin')).toBe(true);
  });

  it('member can run pipelines but not manage team', () => {
    expect(canRunPipeline('member')).toBe(true);
    expect(canManageTeam('member')).toBe(false);
    expect(canManageSettings('member')).toBe(false);
    expect(canApproveHITL('member')).toBe(true);
    expect(canExecuteCode('member')).toBe(true);
  });

  it('viewer has read-only access', () => {
    expect(canRunPipeline('viewer')).toBe(false);
    expect(canManageTeam('viewer')).toBe(false);
    expect(canManageSettings('viewer')).toBe(false);
    expect(canApproveHITL('viewer')).toBe(false);
    expect(canExecuteCode('viewer')).toBe(false);
  });

  it('hasPermission returns false for unknown actions', () => {
    expect(hasPermission('admin', 'destroy', 'everything')).toBe(false);
    expect(hasPermission('viewer', 'manage', 'pipeline')).toBe(false);
  });

  it('all roles have defined permissions', () => {
    const roles: Role[] = ['admin', 'member', 'viewer'];
    for (const role of roles) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it('admin has at least as many permissions as member', () => {
    const adminPerms = ROLE_PERMISSIONS.admin;
    const memberPerms = ROLE_PERMISSIONS.member;
    expect(adminPerms.length).toBeGreaterThanOrEqual(memberPerms.length);
  });
});

describe('RBAC — Team Management', () => {
  it('creates a team with the creator as admin', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    expect(team.name).toBe('Test Team');
    expect(team.members).toHaveLength(1);
    expect(team.members[0].role).toBe('admin');
    expect(team.members[0].email).toBe('alice@test.com');
    expect(team.id).toMatch(/^team_/);
  });

  it('adds a member to a team', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    const updated = addMember(team, { id: 'user2', name: 'Bob', email: 'bob@test.com', role: 'member' });
    expect(updated.members).toHaveLength(2);
    expect(updated.members[1].name).toBe('Bob');
    expect(updated.members[1].role).toBe('member');
  });

  it('prevents duplicate email addresses', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    expect(() => {
      addMember(team, { id: 'user2', name: 'Also Alice', email: 'alice@test.com', role: 'member' });
    }).toThrow('already exists');
  });

  it('removes a non-admin member', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    addMember(team, { id: 'user2', name: 'Bob', email: 'bob@test.com', role: 'member' });
    const updated = removeMember(team, 'user2');
    expect(updated.members).toHaveLength(1);
  });

  it('prevents removing the last admin', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    expect(() => removeMember(team, 'user1')).toThrow('last admin');
  });

  it('prevents demoting the last admin', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    expect(() => updateMemberRole(team, 'user1', 'member')).toThrow('last admin');
  });

  it('allows demoting admin if another admin exists', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    addMember(team, { id: 'user2', name: 'Bob', email: 'bob@test.com', role: 'admin' });
    const updated = updateMemberRole(team, 'user1', 'member');
    const alice = updated.members.find(m => m.id === 'user1');
    expect(alice?.role).toBe('member');
  });

  it('throws error when updating non-existent member', () => {
    const team = createTeam('Test Team', { id: 'user1', name: 'Alice', email: 'alice@test.com' });
    expect(() => updateMemberRole(team, 'nonexistent', 'admin')).toThrow('Member not found');
  });
});
