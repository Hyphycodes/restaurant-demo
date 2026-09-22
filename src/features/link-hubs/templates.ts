import type { HubBlockConfig, HubBlockType, HubTemplate, LinkHubType } from './types';

export interface HubTemplateDefinition {
  label: string;
  description: string;
  hubType: LinkHubType;
  title: string;
  subtitle: string;
  theme: string;
  blocks: { type: HubBlockType; label: string; config: HubBlockConfig }[];
}

const action = (type: HubBlockType, title: string, config: HubBlockConfig = {}) => ({
  type,
  label: title,
  config: { title, style: 'standard' as const, ...config },
});

export const HUB_TEMPLATES: Record<HubTemplate, HubTemplateDefinition> = {
  'main-links': {
    label: 'Cosa Nostra Main Links',
    description: 'The all-purpose Instagram bio and guest shortcut page.',
    hubType: 'instagram-bio',
    title: 'Cosa Nostra',
    subtitle: 'Good food. Good music. Stay a while.',
    theme: 'cosa-nostra-default',
    blocks: [
      action('events', 'Upcoming Events / Get Tickets', { style: 'featured', eventCount: 3, showArtwork: true, showTicketCta: true }),
      action('reservation', 'Reserve a Table'),
      action('menu', 'View Menu'),
      action('private-event', 'Book a Birthday or Private Event'),
      action('directions', 'Directions'),
      action('social', 'Instagram', { platform: 'instagram' }),
      action('review', 'Leave Cosa Nostra a Google Review'),
    ],
  },
  live: {
    label: 'Cosa Nostra Live',
    description: 'Fast actions for a permanent QR shown inside the restaurant.',
    hubType: 'live',
    title: 'Cosa Nostra Live',
    subtitle: 'Tonight at Cosa Nostra.',
    theme: 'evening',
    blocks: [
      action('review', 'Leave Cosa Nostra a Review', { style: 'featured' }),
      action('featured-event', 'See What’s Next', { showArtwork: true, showTicketCta: true }),
      action('tickets', 'Get Tickets'),
      action('birthday', 'Book Your Birthday'),
      action('social', 'Follow Cosa Nostra', { platform: 'instagram' }),
    ],
  },
  'vinyl-club': {
    label: 'Vinyl & Vermouth',
    description: 'Tonight’s artist, the next session, reviews, and private bookings.',
    hubType: 'event',
    title: 'Vinyl & Vermouth at Cosa Nostra',
    subtitle: 'Everything for tonight, in one place.',
    theme: 'plum',
    blocks: [
      action('review', 'Show Cosa Nostra Some Love', { style: 'featured' }),
      action('artist', 'Meet Tonight’s Artist'),
      action('events', 'See the Next Vinyl & Vermouth', { eventCount: 3, eventCategory: 'vinyl-vermouth', showArtwork: true }),
      action('private-event', 'Book a Private Vinyl & Vermouth'),
    ],
  },
  nightlife: {
    label: 'Nightlife',
    description: 'A high-energy event and birthday conversion page.',
    hubType: 'event',
    title: 'Tonight at Cosa Nostra',
    subtitle: 'What’s happening now and what’s next.',
    theme: 'teal',
    blocks: [
      action('featured-event', 'Tonight’s Feature', { showArtwork: true, showTicketCta: true }),
      action('events', 'Upcoming Events', { eventCount: 3, showArtwork: true, showTicketCta: true }),
      action('birthday', 'Birthday Reservations'),
      action('social', 'Follow Cosa Nostra', { platform: 'instagram' }),
      action('review', 'Leave a Review'),
    ],
  },
  artist: {
    label: 'Artist Spotlight',
    description: 'A focused artist card with event and booking actions.',
    hubType: 'artist',
    title: 'Artist Spotlight',
    subtitle: 'Featured at Cosa Nostra.',
    theme: 'evening',
    blocks: [action('artist', 'Featured Artist'), action('featured-event', 'See the Event', { showArtwork: true }), action('social', 'Follow Cosa Nostra', { platform: 'instagram' })],
  },
  hiring: {
    label: 'Hiring',
    description: 'A direct, branded path from QR to the Cosa Nostra application.',
    hubType: 'hiring',
    title: 'Come Work With Us',
    subtitle: 'Bring your energy to Cosa Nostra.',
    theme: 'cosa-nostra-default',
    blocks: [action('text', 'Join the Team', { body: 'We’re always interested in good people who care about hospitality.' }), action('link', 'See Open Roles', { url: '/careers', style: 'featured' }), action('directions', 'Find Cosa Nostra')],
  },
  blank: {
    label: 'Blank',
    description: 'Start with the Cosa Nostra identity and add only what you need.',
    hubType: 'custom',
    title: 'Cosa Nostra',
    subtitle: '',
    theme: 'cosa-nostra-default',
    blocks: [],
  },
};
