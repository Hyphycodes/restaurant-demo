import { describe, expect, it } from 'vitest';
import { HUB_TEMPLATES } from './templates';
import { modeMatches, resolveScheduledMode } from './scheduling';
import type { LinkHub, LinkHubMode } from './types';

const hub = { id: 'hub', modeStrategy: 'auto', manualModeId: null } as LinkHub;
const mode = (patch: Partial<LinkHubMode> = {}): LinkHubMode => ({
  id: '11111111-1111-4111-8111-111111111111', hubId: 'hub', name: 'Saturday Night',
  titleOverride: null, subtitleOverride: null, enabled: true, priority: 10,
  daysOfWeek: [6], startTime: '21:00', endTime: '02:00', startsOn: null, endsOn: null,
  activeEventOnly: false, ...patch,
});

describe('Link Hub scheduling', () => {
  it('matches an overnight Saturday mode before and after midnight in Chicago', () => {
    expect(modeMatches(mode(), new Date('2026-09-20T03:00:00Z'), false, 'America/Chicago')).toBe(true);
    expect(modeMatches(mode(), new Date('2026-09-20T06:30:00Z'), false, 'America/Chicago')).toBe(true);
  });

  it('uses highest priority and honors a manual override', () => {
    const lower = mode({ id: '22222222-2222-4222-8222-222222222222', priority: 1, daysOfWeek: [] });
    const higher = mode({ id: '33333333-3333-4333-8333-333333333333', priority: 20, daysOfWeek: [] });
    expect(resolveScheduledMode(hub, [lower, higher], new Date('2026-09-20T03:00:00Z'), false, 'America/Chicago')?.id).toBe(higher.id);
    expect(resolveScheduledMode({ ...hub, modeStrategy: 'manual', manualModeId: lower.id }, [lower, higher], new Date(), false, 'America/Chicago')?.id).toBe(lower.id);
  });

  it('requires an active event only when configured', () => {
    expect(modeMatches(mode({ daysOfWeek: [], startTime: null, endTime: null, activeEventOnly: true }), new Date(), false, 'America/Chicago')).toBe(false);
  });
});

describe('Link Hub templates', () => {
  it('ships editable Main Links and Live starting points', () => {
    expect(HUB_TEMPLATES['main-links'].blocks.some((block) => block.type === 'events')).toBe(true);
    expect(HUB_TEMPLATES.live.blocks.some((block) => block.type === 'review')).toBe(true);
    expect(HUB_TEMPLATES.live.blocks.every((block) => typeof block.config === 'object')).toBe(true);
  });
});
