'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { HubEventCard, HubPageData, LinkHubBlock } from '@/features/link-hubs/types';
import { LeadCapture } from './LeadCapture';
import { HubAnalyticsTracker } from './HubAnalyticsTracker';
import styles from './LinkHub.module.css';

function destination(block: LinkHubBlock, page: HubPageData): { href: string; kind: string } | null {
  const location = page.location;
  switch (block.blockType) {
    case 'link': return block.config.url ? { href: block.config.url, kind: 'block_click' } : null;
    case 'review': return location?.reviewUrl ? { href: location.reviewUrl, kind: 'review_click' } : null;
    case 'reservation': return location?.reservationUrl ? { href: location.reservationUrl, kind: 'reservation_click' } : null;
    case 'directions': return location?.directionsUrl ? { href: location.directionsUrl, kind: 'block_click' } : null;
    case 'call': return location?.phone ? { href: `tel:${location.phone.replace(/[^+\d]/g, '')}`, kind: 'block_click' } : null;
    case 'menu': return { href: location?.menuUrl || '/menu', kind: 'block_click' };
    case 'private-event': return { href: '/private-events', kind: 'block_click' };
    case 'birthday': return { href: '/private-events?occasion=birthday', kind: 'block_click' };
    case 'contact': return location?.contactEmail ? { href: `mailto:${location.contactEmail}`, kind: 'block_click' } : null;
    case 'social': {
      const href = block.config.platform === 'tiktok' ? location?.tiktokUrl : block.config.platform === 'facebook' ? location?.facebookUrl : location?.instagramUrl;
      return href ? { href, kind: 'social_click' } : null;
    }
    case 'tickets': {
      const event = page.events.find((entry) => entry.ticketUrl);
      return { href: event?.ticketUrl || '/events', kind: 'ticket_click' };
    }
    default: return null;
  }
}

function Glyph({ type }: { type: LinkHubBlock['blockType'] }) {
  const path = type === 'directions'
    ? 'M12 2 3 11l9 9 9-9-9-9Zm0 4.2 4.8 4.8-2.1 2.1V11h-4v4H9v-5.7h5.7L12 6.2Z'
    : type === 'call'
      ? 'M6.6 2.8 9 7.6 6.9 9c1.2 2.6 3.3 4.7 5.9 5.9l1.4-2.1 4.8 2.4-.5 3.4c-.1.8-.9 1.4-1.7 1.4C8.6 20 2 13.4 2 5.2c0-.8.6-1.6 1.4-1.7l3.2-.7Z'
      : type === 'review'
        ? 'm12 2 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2Z'
        : type === 'reservation'
          ? 'M5 3h2v2h10V3h2v2h2v16H3V5h2V3Zm14 8H5v8h14v-8ZM7 13h4v4H7v-4Z'
          : type === 'social'
            ? 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm5.5-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z'
            : 'M5 12h12m-4-4 4 4-4 4';
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.glyph}><path d={path} fill={type === 'link' || type === 'menu' || type === 'tickets' || type === 'private-event' || type === 'birthday' || type === 'contact' ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={type === 'link' || type === 'menu' || type === 'tickets' || type === 'private-event' || type === 'birthday' || type === 'contact' ? 1.8 : 0} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ActionBlock({ block, page }: { block: LinkHubBlock; page: HubPageData }) {
  const target = destination(block, page);
  if (!target) {
    return page.preview ? <div className={styles.configWarning}>{block.config.title || block.label || 'This action'} needs a destination in the hub’s location settings.</div> : null;
  }
  const external = /^https?:\/\//.test(target.href);
  const style = block.config.style ?? (block.config.emphasis === 'high' ? 'featured' : 'standard');
  const image = block.config.imageAssetId ? page.media[block.config.imageAssetId] : null;
  return (
    <a
      href={target.href}
      target={block.config.newTab || external ? '_blank' : undefined}
      rel={block.config.newTab || external ? 'noreferrer' : undefined}
      className={`${styles.action} ${styles[`action_${style}`]}`}
      data-hub-track={target.kind}
      data-block-id={block.id}
      data-track-target={target.href}
    >
      {image?.kind === 'image' ? <Image src={image.path} alt="" fill sizes="(max-width: 700px) 100vw, 640px" className={styles.actionImage} /> : null}
      <span className={styles.actionShade} />
      <span className={styles.actionIcon}><Glyph type={block.blockType} /></span>
      <span className={styles.actionCopy}>
        <strong>{block.config.title || block.label || 'Open'}</strong>
        {block.config.subtitle ? <small>{block.config.subtitle}</small> : null}
      </span>
      <span className={styles.arrow} aria-hidden="true">↗</span>
    </a>
  );
}

function EventCard({ event, block, showTicket }: { event: HubEventCard; block: LinkHubBlock; showTicket: boolean }) {
  const href = showTicket && event.ticketUrl ? event.ticketUrl : event.href;
  return (
    <a href={href} className={styles.eventCard} data-hub-track={showTicket && event.ticketUrl ? 'ticket_click' : 'event_click'} data-block-id={block.id} data-track-target={href}>
      {block.config.showArtwork && event.artwork ? (
        <span className={styles.eventArt}><Image src={event.artwork.path} alt={event.artwork.alt} fill sizes="(max-width: 700px) 40vw, 240px" style={{ objectPosition: event.artwork.focal }} /></span>
      ) : null}
      <span className={styles.eventCopy}>
        <small>{event.date} · {event.time}</small>
        <strong>{event.title}</strong>
        <span>{showTicket && event.ticketUrl ? 'Get tickets' : 'Event details'} <span aria-hidden="true">→</span></span>
      </span>
    </a>
  );
}

function EventsBlock({ block, page }: { block: LinkHubBlock; page: HubPageData }) {
  let events = [...page.events];
  if (block.config.eventCategory) events = events.filter((event) => event.category === block.config.eventCategory);
  if (block.config.featuredOnly || block.blockType === 'featured-event') events = events.filter((event) => event.featured || block.blockType === 'featured-event');
  events = events.slice(0, block.blockType === 'featured-event' ? 1 : block.config.eventCount ?? 3);
  if (events.length === 0) return page.preview ? <div className={styles.configWarning}>No matching upcoming events right now.</div> : null;
  return (
    <section className={styles.eventsBlock}>
      <div className={styles.sectionHeading}><span>{block.config.title || block.label || 'What’s next'}</span><Link href="/events">All events</Link></div>
      <div className={styles.eventList}>{events.map((event) => <EventCard key={event.id} event={event} block={block} showTicket={Boolean(block.config.showTicketCta)} />)}</div>
    </section>
  );
}

function ArtistBlock({ block, page }: { block: LinkHubBlock; page: HubPageData }) {
  const image = block.config.artistImageAssetId ? page.media[block.config.artistImageAssetId] : null;
  const links = [
    ['Instagram', block.config.instagramUrl],
    ['Website', block.config.websiteUrl],
    ['Portfolio', block.config.portfolioUrl],
    ['Booking', block.config.bookingUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <section className={styles.artist}>
      {image?.kind === 'image' ? <div className={styles.artistImage}><Image src={image.path} alt={image.alt} fill sizes="180px" style={{ objectPosition: image.focal }} /></div> : null}
      <div><p className={styles.blockEyebrow}>Artist spotlight</p><h2>{block.config.artistName || block.config.title || 'Featured artist'}</h2>{block.config.artistBio ? <p>{block.config.artistBio}</p> : null}<div className={styles.artistLinks}>{links.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" data-hub-track="social_click" data-block-id={block.id} data-track-target={href}>{label} ↗</a>)}</div></div>
    </section>
  );
}

function renderBlock(block: LinkHubBlock, page: HubPageData): ReactNode {
  if (block.blockType === 'events' || block.blockType === 'featured-event') return <EventsBlock block={block} page={page} />;
  if (block.blockType === 'lead') return <LeadCapture hubId={page.hub.id} block={block} preview={page.preview} />;
  if (block.blockType === 'artist') return <ArtistBlock block={block} page={page} />;
  if (block.blockType === 'text') return <section className={`${styles.textBlock} ${block.config.align === 'center' ? styles.center : ''}`}><h2>{block.config.title || block.label}</h2>{block.config.body ? <p>{block.config.body}</p> : null}</section>;
  if (block.blockType === 'image') {
    const image = block.config.imageAssetId ? page.media[block.config.imageAssetId] : null;
    return image?.kind === 'image' ? <figure className={styles.imageBlock}><Image src={image.path} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 700px) 100vw, 640px" /><figcaption>{block.config.subtitle}</figcaption></figure> : page.preview ? <div className={styles.configWarning}>Choose an image for this block.</div> : null;
  }
  if (block.blockType === 'divider') return <div className={`${styles.divider} ${styles[`divider_${block.config.height ?? 'sm'}`]}`} aria-hidden="true"><span /></div>;
  return <ActionBlock block={block} page={page} />;
}

export function HubRenderer({ page, embedded = false }: { page: HubPageData; embedded?: boolean }) {
  const { hub, mode } = page;
  const logo = hub.logoAssetId ? page.media[hub.logoAssetId] : null;
  const background = hub.backgroundAssetId ? page.media[hub.backgroundAssetId] : null;
  const hero = hub.heroAssetId ? page.media[hub.heroAssetId] : null;
  const title = mode?.titleOverride || hub.title;
  const subtitle = mode?.subtitleOverride || hub.subtitle;
  const custom = hub.theme === 'custom' ? ({ '--hub-accent': hub.customTheme.accent, '--hub-surface': hub.customTheme.surface } as CSSProperties) : undefined;
  return (
    <main className={`${styles.hub} ${styles[`theme_${hub.theme.replace('-', '_')}`]} ${embedded ? styles.embedded : ''}`} style={custom}>
      {!page.preview ? <HubAnalyticsTracker hubId={hub.id} /> : null}
      <div className={styles.atmosphere} aria-hidden="true"><i /><i /><i /></div>
      {background ? background.kind === 'video' ? <video className={styles.background} src={background.path} autoPlay muted loop playsInline /> : <Image className={styles.background} src={background.path} alt="" fill priority sizes="100vw" style={{ objectPosition: background.focal }} /> : null}
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.identity}>
          {/* The wordmark stands in for a logo, unless the page title already is the name. */}
          {logo?.kind === 'image' ? <Image src={logo.path} alt={logo.alt || 'Casa Aurelia'} width={180} height={72} priority className={styles.logo} /> : title !== 'Casa Aurelia' ? <span className={styles.wordmark}>Casa Aurelia</span> : null}
          {mode ? <span className={styles.modeBadge}>{mode.name}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
        {hero?.kind === 'image' ? <div className={styles.hero}><Image src={hero.path} alt={hero.alt} fill priority sizes="(max-width: 700px) 100vw, 640px" style={{ objectPosition: hero.focal }} /></div> : null}
        <div className={styles.blocks}>{page.blocks.map((block) => <div key={block.id} className={styles.block}>{renderBlock(block, page)}</div>)}</div>
        <footer className={styles.footer}><span>Casa Aurelia</span>{page.location?.address ? <span>{page.location.address}</span> : null}</footer>
      </div>
    </main>
  );
}
