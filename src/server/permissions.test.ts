import { describe, expect, it } from 'vitest';
import { can, canOpen, DENIED_MESSAGE, ROLE_LABEL, SECTIONS, type Capability, type Role } from './permissions';

/**
 * The whole matrix, asserted cell by cell.
 *
 * A permission table is exactly the kind of thing that rots when a capability is
 * added and one role is forgotten, so every role/capability pair is written out
 * rather than derived — a test that computes the answer the same way the code
 * does proves nothing.
 */

const ROLES: Role[] = ['owner', 'admin', 'editor'];

const EXPECTED: Record<Capability, Role[]> = {
  'content.edit': ['owner', 'admin', 'editor'],
  'content.publish': ['owner', 'admin'],
  'content.archive': ['owner', 'admin'],
  'content.restore': ['owner', 'admin'],
  'media.upload': ['owner', 'admin', 'editor'],
  'media.delete': ['owner'],
  'inquiries.manage': ['owner', 'admin', 'editor'],
  'settings.manage': ['owner', 'admin'],
  'team.manage': ['owner'],
  'integrations.manage': ['owner'],
};

describe('permission matrix', () => {
  for (const [capability, allowed] of Object.entries(EXPECTED) as [Capability, Role[]][]) {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      it(`${ROLE_LABEL[role]} ${expected ? 'can' : 'cannot'} ${capability}`, () => {
        expect(can({ role }, capability)).toBe(expected);
      });
    }
  }

  it('gives every capability a message that explains the refusal', () => {
    for (const capability of Object.keys(EXPECTED) as Capability[]) {
      const message = DENIED_MESSAGE[capability];
      expect(message, capability).toBeTruthy();
      // A refusal that only says "denied" leaves the person stuck.
      expect(message.length, capability).toBeGreaterThan(20);
    }
  });
});

describe('the Contributor role', () => {
  it('can edit and save, and cannot publish — the whole point of it', () => {
    const contributor = { role: 'editor' as const };
    expect(can(contributor, 'content.edit')).toBe(true);
    expect(can(contributor, 'content.publish')).toBe(false);
    expect(can(contributor, 'content.archive')).toBe(false);
  });

  it('is told their work is saved, not just that they are blocked', () => {
    expect(DENIED_MESSAGE['content.publish']).toMatch(/saved/i);
  });
});

describe('deactivated accounts', () => {
  it('lose every capability regardless of role', () => {
    for (const role of ROLES) {
      for (const capability of Object.keys(EXPECTED) as Capability[]) {
        expect(can({ role, active: false }, capability)).toBe(false);
      }
      for (const section of SECTIONS) {
        expect(canOpen({ role, active: false }, section)).toBe(false);
      }
    }
  });
});

describe('section restrictions', () => {
  it('narrow a Contributor to the sections they were given', () => {
    const restricted = { role: 'editor' as const, sections: ['menu'] };
    expect(canOpen(restricted, 'menu')).toBe(true);
    expect(canOpen(restricted, 'events')).toBe(false);
    expect(canOpen(restricted, 'website')).toBe(false);
  });

  it('mean "everything" when empty', () => {
    const unrestricted = { role: 'editor' as const, sections: [] };
    expect(canOpen(unrestricted, 'menu')).toBe(true);
    expect(canOpen(unrestricted, 'events')).toBe(true);
    expect(canOpen(unrestricted, 'media')).toBe(true);
  });

  it('never apply to a Manager or Owner, who must not be lockable out', () => {
    for (const role of ['owner', 'admin'] as Role[]) {
      const actor = { role, sections: ['menu'] };
      expect(canOpen(actor, 'events')).toBe(true);
      expect(canOpen(actor, 'website')).toBe(true);
    }
  });

  it('keeps Settings behind the settings capability, not the section list', () => {
    expect(canOpen({ role: 'editor', sections: ['settings'] }, 'settings')).toBe(false);
    expect(canOpen({ role: 'admin' }, 'settings')).toBe(true);
    expect(canOpen({ role: 'owner' }, 'settings')).toBe(true);
  });
});
