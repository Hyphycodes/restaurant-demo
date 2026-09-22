import Image from 'next/image';
import type { HubPageData } from '@/features/link-hubs/types';
import { HubAnalyticsTracker } from './HubAnalyticsTracker';
import styles from '@/app/go/[slug]/display/display.module.css';

export function HubDisplay({ page, preview = false }: { page: HubPageData; preview?: boolean }) {
  const event = page.events[0] ?? null;
  const backgroundId = page.hub.backgroundAssetId || page.hub.heroAssetId;
  const background = backgroundId ? page.media[backgroundId] : event?.artwork;
  return <main className={styles.display}>
    {!preview ? <HubAnalyticsTracker hubId={page.hub.id} display /> : null}
    {background?.kind === 'image' ? <Image src={background.path} alt="" fill priority sizes="100vw" className={styles.background} /> : null}
    <div className={styles.scrim} />
    <div className={styles.content}>
      <section className={styles.copy}>
        <p className={styles.eyebrow}>Cosa Nostra Kitchen & Bar</p>
        <h1>{page.mode?.titleOverride || page.hub.title || 'Scan to unlock Cosa Nostra tonight'}</h1>
        <p className={styles.subtitle}>{page.mode?.subtitleOverride || page.hub.subtitle || 'Everything you need for tonight, one scan away.'}</p>
        {event ? <div className={styles.event}><span>Up next</span><strong>{event.title}</strong><small>{event.date} · {event.time}</small></div> : null}
        <p className={styles.reasons}>Leave a review <b>•</b> See what’s next <b>•</b> Get tickets</p>
      </section>
      <section className={styles.qrPanel} aria-label={`QR code for ${page.hub.name}`}>
        <div className={styles.qr}><Image src={`/api/go/${page.hub.slug}/qr.svg`} alt={`Scan to open ${page.hub.name}`} width={1200} height={1200} priority unoptimized /></div>
        <p>Point your camera here</p>
        <small>/go/{page.hub.slug}</small>
      </section>
    </div>
    <div className={styles.orbit} aria-hidden="true" />
  </main>;
}
