/**
 * The named website screens.
 *
 * This is the whole "Website" section: a fixed list of the real pages, each
 * opening the sections that page actually has. It is not a Pages collection and
 * there is no way to add to it from the admin — adding a page is a design and
 * routing decision, not a content one.
 *
 * It lives outside the route file because a Next route module may only export
 * the framework's own names.
 */
export const PAGES = [
  { slug: 'home', label: 'Homepage', route: '/', hint: 'Hero, what we serve, After Dark, catering' },
  { slug: 'menu', label: 'Menu page', route: '/menu', hint: 'The heading above the menu' },
  { slug: 'events', label: 'Events page', route: '/events', hint: 'The heading above the nights' },
  {
    slug: 'catering',
    label: 'Catering',
    route: '/catering',
    hint: 'Heading, intro and enquiry choices',
  },
  {
    slug: 'private-events',
    label: 'Private events',
    route: '/private-events',
    hint: 'Celebrations copy and enquiry choices',
  },
  { slug: 'visit', label: 'Visit', route: '/visit', hint: 'Heading and directions copy' },
  {
    slug: 'contact',
    label: 'Contact',
    route: '/contact',
    hint: 'The heading above visit, work and create',
  },
  {
    slug: 'careers',
    label: 'Work at Cosa Nostra',
    route: '/careers',
    hint: 'Recruitment copy and perks. Openings are in People → Job openings.',
  },
  {
    slug: 'talent',
    label: 'Create with Cosa Nostra',
    route: '/talent',
    hint: 'The invitation to local DJs, artists and performers',
  },
];
