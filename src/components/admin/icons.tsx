/**
 * The admin's small line drawings.
 *
 * Primary sections, plus the pictures the home screen's quick actions and the
 * door reuse. Kept plain on purpose: each one sits beside its own label, so
 * it only has to be distinguishable from the others, not self-explanatory.
 */

export type NavIconName =
  | 'home'
  | 'menu'
  | 'events'
  | 'pages'
  | 'season'
  | 'photos'
  | 'hours'
  | 'staff'
  | 'door'
  | 'scan'
  | 'look'
  | 'visit'
  | 'team'
  | 'emails'
  | 'hubs'
  | 'people';

const PATHS: Record<NavIconName, string[]> = {
  home: ['M3.5 10.5 12 3.5l8.5 7', 'M5.8 9.5V20h12.4V9.5'],
  menu: ['M7 3.5v6a2 2 0 0 0 4 0v-6', 'M9 11.5V20.5', 'M16.5 3.5c-1.4 1.6-2 3.2-2 5s.7 3 2 3 2-1.2 2-3-.6-3.4-2-5z', 'M16.5 11.5v9'],
  events: ['M4 6.5h16V20H4z', 'M4 10.5h16', 'M8.5 3.5v4', 'M15.5 3.5v4'],
  pages: ['M6 3.5h8l4 4V20.5H6z', 'M14 3.5v4h4', 'M9 13h6', 'M9 16.5h4'],
  season: [
    'M12 3.5v2.5', 'M12 18v2.5', 'M5 5l1.8 1.8', 'M17.2 17.2 19 19', 'M3.5 12H6', 'M18 12h2.5',
    'M5 19l1.8-1.8', 'M17.2 6.8 19 5', 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  ],
  photos: ['M3.5 6h17v12.5h-17z', 'M3.5 14.5 8 11l3.5 2.5L15 10.5l5.5 4.5', 'M8.5 9.5h.01'],
  hours: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 7.5v5l3.2 1.9'],
  staff: [
    'M9.5 11a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z', 'M3.5 20c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3',
    'M16.8 8.8a2.4 2.4 0 1 0 0-4.8', 'M17.6 20c0-2.5-.8-4.2-2.2-5.2',
  ],
  door: ['M5 20.5V4.5h14v16', 'M5 20.5h14', 'M14.5 12.5h.01', 'M9 4.5v16'],
  scan: ['M4 8V4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4', 'M7 12h10'],
  // A brush: how the site looks.
  look: ['M14.5 4.5 19.5 9.5 9 20H4v-5z', 'M12 7l5 5', 'M4 20l3-3'],
  // A pin: where and when to visit.
  visit: ['M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  team: [
    'M9.5 11a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z', 'M3.5 20c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3',
    'M16.8 8.8a2.4 2.4 0 1 0 0-4.8', 'M17.6 20c0-2.5-.8-4.2-2.2-5.2',
  ],
  // An envelope: what the site sends.
  emails: ['M3.5 6h17v12h-17z', 'M3.5 7 12 13l8.5-6'],
  // A hand raised: the people who write in wanting to work here or play here.
  people: [
    'M12 11.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z',
    'M4.5 20.5c0-3.6 3.2-6 7.5-6s7.5 2.4 7.5 6',
    'M19 4.5v4', 'M17 6.5h4',
  ],
  hubs: ['M7 7h10v10H7z', 'M4 4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4', 'M10 10h4v4h-4z'],
};

export function NavIcon({ name, className = '' }: { name: NavIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-[18px] shrink-0 ${className}`}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
