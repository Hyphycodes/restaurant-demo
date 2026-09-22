import type { LinkHub, LinkHubMode } from './types';

function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')),
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

function timeMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours! * 60 + minutes! : null;
}

export function modeMatches(mode: LinkHubMode, now: Date, activeEvent: boolean, timeZone: string): boolean {
  if (!mode.enabled || (mode.activeEventOnly && !activeEvent)) return false;
  const local = localClock(now, timeZone);
  const start = timeMinutes(mode.startTime);
  const end = timeMinutes(mode.endTime);
  // An overnight Saturday 21:00–02:00 still belongs to Saturday at 01:00
  // Sunday. Staff should not have to select two days to describe one shift.
  const scheduleWeekday = start != null && end != null && start > end && local.minutes < end
    ? (local.weekday + 6) % 7
    : local.weekday;
  if (mode.daysOfWeek.length > 0 && !mode.daysOfWeek.includes(scheduleWeekday)) return false;
  if (mode.startsOn && local.date < mode.startsOn) return false;
  if (mode.endsOn && local.date > mode.endsOn) return false;
  if (start == null && end == null) return true;
  if (start != null && end == null) return local.minutes >= start;
  if (start == null && end != null) return local.minutes < end;
  return start! <= end!
    ? local.minutes >= start! && local.minutes < end!
    : local.minutes >= start! || local.minutes < end!;
}

export function resolveScheduledMode(hub: LinkHub, modes: LinkHubMode[], now: Date, activeEvent: boolean, timeZone: string): LinkHubMode | null {
  if (hub.modeStrategy === 'manual') return modes.find((mode) => mode.id === hub.manualModeId && mode.enabled) ?? null;
  return [...modes].sort((a, b) => b.priority - a.priority).find((mode) => modeMatches(mode, now, activeEvent, timeZone)) ?? null;
}
