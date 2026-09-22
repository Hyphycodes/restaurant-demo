import { describe, expect, it } from 'vitest';
import { clampPreview, deriveOpsRole, isPreviewableRole, OPS_DENIED_MESSAGE, opsCan, type OpsCapability, type OpsRole } from './permissions';

/**
 * The operational matrix, cell by cell, the same way the content matrix is
 * tested: written out, never derived, so adding a capability and forgetting
 * a role is a failing test rather than a quiet hole.
 */

const ROLES: OpsRole[] = ['owner', 'manager', 'employee', 'contractor', 'none'];

const EXPECTED: Record<OpsCapability, OpsRole[]> = {
  'staff.view_self': ['owner', 'manager', 'employee'],
  'staff.view_roster': ['owner', 'manager', 'employee'],
  'staff.view_team': ['owner', 'manager'],
  'staff.manage_team': ['owner', 'manager'],
  'staff.manage_access': ['owner'],
  'schedule.view_self': ['owner', 'manager', 'employee'],
  'schedule.view_team': ['owner', 'manager'],
  'schedule.manage': ['owner', 'manager'],
  'schedule.publish': ['owner', 'manager'],
  'availability.manage_self': ['owner', 'manager', 'employee'],
  'timeoff.request': ['owner', 'manager', 'employee'],
  'timeoff.approve': ['owner', 'manager'],
  'coverage.request': ['owner', 'manager', 'employee'],
  'coverage.approve': ['owner', 'manager'],
  'training.view_self': ['owner', 'manager', 'employee'],
  'training.manage': ['owner', 'manager'],
  'documents.view_self': ['owner', 'manager', 'employee'],
  'documents.manage': ['owner', 'manager'],
  'tasks.view_self': ['owner', 'manager', 'employee'],
  'tasks.manage': ['owner', 'manager'],
  'checklists.complete': ['owner', 'manager', 'employee'],
  'checklists.manage': ['owner', 'manager'],
  'events.view_brief': ['owner', 'manager', 'employee'],
  'events.staff': ['owner', 'manager'],
  'events.view_money': ['owner', 'manager'],
  'incidents.report': ['owner', 'manager', 'employee'],
  'incidents.manage': ['owner', 'manager'],
  'contractors.manage': ['owner', 'manager'],
  'contractors.view_self': ['contractor'],
  'announcements.manage': ['owner', 'manager'],
  'notes.manage': ['owner', 'manager'],
  'locations.view_all': ['owner'],
  'locations.manage': ['owner'],
  'system.preview_role': ['owner'],
};

describe('operational permission matrix', () => {
  for (const [capability, allowed] of Object.entries(EXPECTED) as [OpsCapability, OpsRole[]][]) {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      it(`${role} ${expected ? 'can' : 'cannot'} ${capability}`, () => {
        expect(opsCan({ role }, capability)).toBe(expected);
      });
    }
  }

  it('an employee sees the night but not the money, and reports an incident without browsing them', () => {
    expect(opsCan({ role: 'employee' }, 'events.view_brief')).toBe(true);
    expect(opsCan({ role: 'employee' }, 'events.view_money')).toBe(false);
    expect(opsCan({ role: 'employee' }, 'incidents.report')).toBe(true);
    expect(opsCan({ role: 'employee' }, 'incidents.manage')).toBe(false);
  });

  it('refuses everything for an inactive account, whatever its role', () => {
    for (const capability of Object.keys(EXPECTED) as OpsCapability[]) {
      expect(opsCan({ role: 'owner', active: false }, capability)).toBe(false);
    }
  });

  it('explains every refusal', () => {
    for (const capability of Object.keys(EXPECTED) as OpsCapability[]) {
      expect(OPS_DENIED_MESSAGE[capability].length, capability).toBeGreaterThan(20);
    }
  });

  it('a contractor sees their own bookings and nothing else of the restaurant', () => {
    expect(opsCan({ role: 'contractor' }, 'contractors.view_self')).toBe(true);
    for (const capability of ['staff.view_team', 'staff.view_self', 'staff.view_roster', 'documents.view_self', 'documents.manage', 'schedule.view_team', 'schedule.view_self', 'notes.manage', 'events.view_brief', 'contractors.manage'] as OpsCapability[]) {
      expect(opsCan({ role: 'contractor' }, capability)).toBe(false);
    }
  });

  it('an employee cannot approve time off or coverage — only a manager decides', () => {
    expect(opsCan({ role: 'employee' }, 'timeoff.request')).toBe(true);
    expect(opsCan({ role: 'employee' }, 'timeoff.approve')).toBe(false);
    expect(opsCan({ role: 'employee' }, 'coverage.approve')).toBe(false);
  });

  it('a manager cannot change account tiers, so cannot make themselves owner', () => {
    expect(opsCan({ role: 'manager' }, 'staff.manage_access')).toBe(false);
    expect(opsCan({ role: 'owner' }, 'staff.manage_access')).toBe(true);
  });
});

describe('deriving the operational role', () => {
  it('maps the stored role, and needs an employee row for staff access', () => {
    expect(deriveOpsRole({ role: 'owner', active: true, hasEmployee: false, employeeActive: false })).toBe('owner');
    expect(deriveOpsRole({ role: 'admin', active: true, hasEmployee: false, employeeActive: false })).toBe('manager');
    expect(deriveOpsRole({ role: 'staff', active: true, hasEmployee: true, employeeActive: true })).toBe('employee');
    expect(deriveOpsRole({ role: 'editor', active: true, hasEmployee: true, employeeActive: true })).toBe('employee');
    expect(deriveOpsRole({ role: 'contractor', active: true, hasEmployee: false, employeeActive: false })).toBe('contractor');
  });

  it('an employee row that is inactive gives no access — deactivating someone locks the app', () => {
    expect(deriveOpsRole({ role: 'staff', active: true, hasEmployee: true, employeeActive: false })).toBe('none');
    expect(deriveOpsRole({ role: 'staff', active: true, hasEmployee: false, employeeActive: false })).toBe('none');
  });

  it('a deactivated account gives nothing regardless of role', () => {
    expect(deriveOpsRole({ role: 'owner', active: false, hasEmployee: true, employeeActive: true })).toBe('none');
  });
});

describe('previewing as another role', () => {
  it('only offers the three roles worth previewing', () => {
    expect(isPreviewableRole('employee')).toBe(true);
    expect(isPreviewableRole('manager')).toBe(true);
    expect(isPreviewableRole('contractor')).toBe(true);
    expect(isPreviewableRole('owner')).toBe(false);
    expect(isPreviewableRole('none')).toBe(false);
    expect(isPreviewableRole('nonsense')).toBe(false);
  });

  it('narrows, and can never widen — a forged cookie buys nothing', () => {
    expect(clampPreview('owner', 'manager')).toBe('manager');
    expect(clampPreview('owner', 'employee')).toBe('employee');
    expect(clampPreview('owner', 'contractor')).toBe('contractor');
    // An employee asking to preview as a manager stays an employee.
    expect(clampPreview('employee', 'manager')).toBe('employee');
    expect(clampPreview('contractor', 'manager')).toBe('contractor');
    expect(clampPreview('none', 'employee')).toBe('none');
    expect(clampPreview('manager', null)).toBe('manager');
  });

  it('a previewed role really loses the capabilities it is previewing without', () => {
    const previewed = clampPreview('owner', 'employee');
    expect(opsCan({ role: previewed }, 'schedule.manage')).toBe(false);
    expect(opsCan({ role: previewed }, 'staff.view_team')).toBe(false);
    expect(opsCan({ role: previewed }, 'schedule.view_self')).toBe(true);
  });
});
