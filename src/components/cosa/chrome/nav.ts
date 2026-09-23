export interface CosaNavItem {
  label: string;
  href: string;
}

/** The desktop bar: the five reasons someone opens a restaurant's website. */
export const cosaPrimaryNav: CosaNavItem[] = [
  { label: 'Menu', href: '/menu' },
  { label: 'Events', href: '/events' },
  { label: 'Private Dining', href: '/private-events' },
  { label: 'Catering', href: '/catering' },
  { label: 'Visit', href: '/visit' },
];

/** The drawer and footer carry the rest of the house. */
export const cosaDrawerNav: CosaNavItem[] = [
  ...cosaPrimaryNav,
  { label: 'Reservations', href: '/reservations' },
  { label: 'Contact', href: '/contact' },
];

export const cosaHouseNav: CosaNavItem[] = [
  { label: 'Work with us', href: '/careers' },
  { label: 'Artists & DJs', href: '/talent' },
  { label: 'Order pickup', href: '/order' },
  { label: 'Behind the hospitality', href: '/behind' },
];
