import { HUB_TEMPLATES } from '@/features/link-hubs/templates';
import type { HubBlockConfig, HubBlockType } from '@/features/link-hubs/types';
import type { Row } from '@/lib/db/types';
import { stableUuid } from '@/lib/stable-uuid';

/**
 * The link pages a restaurant actually prints and posts: the Instagram bio,
 * the QR on the projector, the review card on the check presenter, the menu
 * QR on the table, a night's own page and the hiring poster.
 */
interface Seed {
  slug: string;
  name: string;
  description: string;
  template: keyof typeof HUB_TEMPLATES;
  title?: string;
  subtitle?: string;
  hero?: string;
  blocks?: { type: HubBlockType; label: string; config: HubBlockConfig }[];
}

const SEEDS: Seed[] = [
  { slug: 'links', name: 'Instagram bio', description: 'The link in @casaaurelia.chi’s bio.', template: 'main-links', hero: 'roomNight', subtitle: 'Stay for dinner. Leave much later.' },
  { slug: 'tonight', name: 'Projector QR — tonight', description: 'Shown on the back-room projector and the TV above the bar.', template: 'live', hero: 'barNight' },
  { slug: 'vinyl', name: 'Vinyl & Vermouth night', description: 'Printed on the listening-night table cards.', template: 'vinyl-club', hero: 'roomDetail' },
  {
    slug: 'review',
    name: 'Review card',
    description: 'The QR card that goes in the check presenter.',
    template: 'blank',
    title: 'Thank you for staying late.',
    subtitle: 'If the night was a good one, tell people.',
    hero: 'negroniPaper',
    blocks: [
      { type: 'review', label: 'Leave us a Google review', config: { title: 'Leave us a Google review', style: 'featured' } },
      { type: 'reservation', label: 'Book your next table', config: { title: 'Book your next table', style: 'standard' } },
      { type: 'social', label: 'Follow Casa Aurelia', config: { title: 'Follow Casa Aurelia', platform: 'instagram', style: 'standard' } },
    ],
  },
  {
    slug: 'menu',
    name: 'Table QR — menu',
    description: 'The small brass QR on every table.',
    template: 'blank',
    title: 'Tonight’s menu',
    subtitle: 'Pasta rolled this afternoon. Ask about the specials.',
    hero: 'pastaNight',
    blocks: [
      { type: 'menu', label: 'The dinner menu', config: { title: 'The dinner menu', style: 'featured' } },
      { type: 'link', label: 'The bar list', config: { title: 'The bar list', url: '/menu#cocktails', style: 'standard' } },
      { type: 'featured-event', label: 'What’s on after dinner', config: { title: 'What’s on after dinner', showArtwork: true, style: 'standard' } },
    ],
  },
  { slug: 'join', name: 'Hiring poster', description: 'The QR on the front window’s “we’re hiring” card.', template: 'hiring', hero: 'barNight' },
];

export function buildDemoLinkHubs(now = new Date()): { hubs: Row[]; blocks: Row[] } {
  const stamp = now.toISOString();
  const hubs: Row[] = [];
  const blocks: Row[] = [];
  for (const seed of SEEDS) {
    const template = HUB_TEMPLATES[seed.template];
    const id = stableUuid('link-hub', seed.slug);
    hubs.push({
      id,
      location_id: null,
      name: seed.name,
      slug: seed.slug,
      internal_description: seed.description,
      hub_type: template.hubType,
      theme: template.theme,
      status: 'published',
      title: seed.title ?? template.title,
      subtitle: seed.subtitle ?? (template.subtitle || null),
      logo_asset_id: null,
      background_asset_id: null,
      hero_asset_id: seed.hero ?? null,
      custom_theme: {},
      start_at: null,
      end_at: null,
      mode_strategy: 'auto',
      manual_mode_id: null,
      search_visibility: 'noindex',
      created_at: stamp,
      updated_at: stamp,
    });
    (seed.blocks ?? template.blocks).forEach((block, sort) => {
      blocks.push({
        id: stableUuid('link-hub-block', `${seed.slug}:${sort}`),
        hub_id: id,
        mode_id: null,
        block_type: block.type,
        label: block.label,
        config: block.config,
        sort,
        visible: true,
        start_at: null,
        end_at: null,
        created_at: stamp,
        updated_at: stamp,
      });
    });
  }
  return { hubs, blocks };
}
