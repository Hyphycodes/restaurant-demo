/**
 * The staff app's line drawings. Each sits beside its own label, so it only
 * has to be distinguishable from the others.
 */

export type StaffIconName =
  | 'home'
  | 'schedule'
  | 'tasks'
  | 'training'
  | 'profile'
  | 'more'
  | 'team'
  | 'operations'
  | 'events'
  | 'contractors'
  | 'documents'
  | 'incidents'
  | 'announcements'
  | 'bell'
  | 'search'
  | 'check'
  | 'clock'
  | 'pin'
  | 'chevron'
  | 'warning'
  | 'plus'
  | 'calendar'
  | 'swap'
  | 'locations';

const PATHS: Record<StaffIconName, string[]> = {
  home: ['M3.5 10.5 12 3.5l8.5 7', 'M5.8 9.5V20h12.4V9.5'],
  schedule: ['M4 6.5h16V20H4z', 'M4 10.5h16', 'M8.5 3.5v4', 'M15.5 3.5v4', 'M8 14h3', 'M13 14h3'],
  tasks: ['M5 5.5h14v14H5z', 'M8.5 12l2.5 2.5 5-5'],
  training: ['M4 6.5h16v11H4z', 'M9.5 9.5v5l4.5-2.5z', 'M8 20.5h8'],
  profile: ['M12 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z', 'M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  team: ['M9.5 11a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z', 'M3.5 20c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3', 'M16.8 8.8a2.4 2.4 0 1 0 0-4.8', 'M17.6 20c0-2.5-.8-4.2-2.2-5.2'],
  operations: ['M4 19.5h16', 'M6 16V9', 'M10 16V5', 'M14 16v-5', 'M18 16V7'],
  events: ['M4 6.5h16V20H4z', 'M4 10.5h16', 'M8.5 3.5v4', 'M15.5 3.5v4', 'M12 13v4', 'M10 15h4'],
  contractors: ['M12 4.5 4.5 8.5 12 12.5l7.5-4z', 'M4.5 12.5 12 16.5l7.5-4', 'M4.5 16.5 12 20.5l7.5-4'],
  documents: ['M6 3.5h8l4 4V20.5H6z', 'M14 3.5v4h4', 'M9 13h6', 'M9 16.5h4'],
  incidents: ['M12 4 3.5 19h17z', 'M12 10v4', 'M12 16.5h.01'],
  announcements: ['M4 10v4h3l7 4V6l-7 4z', 'M17 9.5a3.5 3.5 0 0 1 0 5'],
  bell: ['M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z', 'M10 20.5a2 2 0 0 0 4 0'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 7.5v5l3.2 1.9'],
  pin: ['M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  chevron: ['M9 6l6 6-6 6'],
  warning: ['M12 4 3.5 19h17z', 'M12 10v4', 'M12 16.5h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  calendar: ['M4 6.5h16V20H4z', 'M4 10.5h16', 'M8.5 3.5v4', 'M15.5 3.5v4'],
  swap: ['M7 7h11l-3-3', 'M17 17H6l3 3'],
  locations: ['M4 20.5h16', 'M6 20.5V8l6-4 6 4v12.5', 'M10 20.5v-5h4v5'],
};

export function StaffIcon({ name, className = '' }: { name: StaffIconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`size-[18px] shrink-0 ${className}`}>
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
