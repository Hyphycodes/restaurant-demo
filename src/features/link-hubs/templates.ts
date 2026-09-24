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
    label: 'Casa Aurelia Main Links',
    description: 'The all-purpose Instagram bio and guest shortcut page.',
    hubType: 'instagram-bio',
    title: 'Casa Aurelia',
    subtitle: 'Good food. Good music. Stay a while.',
    theme: 'casa-aurelia-default',
    blocks: [
      action('events', 'Upcoming Events / Get Tickets', { style: 'featured', eventCount: 3, showArtwork: true, showTicketCta: true }),
      action('reservation', 'Reserve a Table'),
      action('menu', 'View Menu'),
      action('private-event', 'Book a Birthday or Private Event'),
      action('directions', 'Directions'),
      action('social', 'Instagram', { platform: 'instagram' }),
      action('review', 'Leave Casa Aurelia a Google Review'),
    ],
  },
  live: {
    label: 'Casa Aurelia Live',
    description: 'Fast actions for a permanent QR shown inside the restaurant.',
    hubType: 'live',
    title: 'Casa Aurelia Live',
    subtitle: 'Tonight at Casa Aurelia.',
    theme: 'evening',
    blocks: [
      action('review', 'Leave Casa Aurelia a Review', { style: 'featured' }),
      action('featured-event', 'See What’s Next', { showArtwork: true, showTicketCta: true }),
      action('tickets', 'Get Tickets'),
      action('birthday', 'Book Your Birthday'),
      action('social', 'Follow Casa Aurelia', { platform: 'instagram' }),
    ],
  },
  'vinyl-club': {
    label: 'Vinyl & Vermouth',
    description: 'Tonight’s artist, the next session, reviews, and private bookings.',
    hubType: 'event',
    title: 'Vinyl & Vermouth at Casa Aurelia',
    subtitle: 'Everything for tonight, in one place.',
    theme: 'plum',
    blocks: [
      action('review', 'Show Casa Aurelia Some Love', { style: 'featured' }),
      action('artist', 'Meet Tonight’s Artist'),
      action('events', 'See the Next Vinyl & Vermouth', { eventCount: 3, eventCategory: 'vinyl-vermouth', showArtwork: true }),
      action('private-event', 'Book a Private Vinyl & Vermouth'),
    ],
  },
  nightlife: {
    label: 'Nightlife',
    description: 'A high-energy event and birthday conversion page.',
    hubType: 'event',
    title: 'Tonight at Casa Aurelia',
    subtitle: 'What’s happening now and what’s next.',
    theme: 'teal',
    blocks: [
      action('featured-event', 'Tonight’s Feature', { showArtwork: true, showTicketCta: true }),
      action('events', 'Upcoming Events', { eventCount: 3, showArtwork: true, showTicketCta: true }),
      action('birthday', 'Birthday Reservations'),
      action('social', 'Follow Casa Aurelia', { platform: 'instagram' }),
      action('review', 'Leave a Review'),
    ],
  },
  artist: {
    label: 'Artist Spotlight',
    description: 'A focused artist card with event and booking actions.',
    hubType: 'artist',
    title: 'Artist Spotlight',
    subtitle: 'Featured at Casa Aurelia.',
    theme: 'evening',
    blocks: [action('artist', 'Featured Artist'), action('featured-event', 'See the Event', { showArtwork: true }), action('social', 'Follow Casa Aurelia', { platform: 'instagram' })],
  },
  hiring: {
    label: 'Hiring',
    description: 'A direct, branded path from QR to the Casa Aurelia application.',
    hubType: 'hiring',
    title: 'Come Work With Us',
    subtitle: 'Bring your energy to Casa Aurelia.',
    theme: 'casa-aurelia-default',
    blocks: [action('text', 'Join the Team', { body: 'We’re always interested in good people who care about hospitality.' }), action('link', 'See Open Roles', { url: '/careers', style: 'featured' }), action('directions', 'Find Casa Aurelia')],
  },
  blank: {
    label: 'Blank',
    description: 'Start with the Casa Aurelia identity and add only what you need.',
    hubType: 'custom',
    title: 'Casa Aurelia',
    subtitle: '',
    theme: 'casa-aurelia-default',
    blocks: [],
  },
};
