import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import type { ResolvedEvent } from '@/content/types';
import { getSiteSettings } from '@/content/resolve';

export async function Hero({ takeover: _takeover }: {takeover?: ResolvedEvent|null}) {
  void _takeover;
  const site=await getSiteSettings();
  return <section className="cn-hero" aria-labelledby="hero-heading">
    <div className="cn-hero-copy">
      <p className="cn-kicker">Italian supper club <span>·</span> West Loop, Chicago</p>
      <h1 id="hero-heading">Stay for dinner.<br/><em>Leave much later.</em></h1>
      <p className="cn-hero-description">Handmade pasta. Proper cocktails. A room that comes alive after dark.</p>
      <div className="cn-hero-actions"><Link className="cn-button" href={site.reservationUrl}>Find your table <span aria-hidden>↗</span></Link><Link className="cn-text-link" href="/menu">Explore the menu</Link></div>
      <div className="cn-hero-foot"><span>DINNER / DRINKS / GOOD COMPANY</span><span>EST. FOR THE EVENING</span></div>
    </div>
    <div className="cn-hero-photo"><Asset id="heroImage" priority rounded={false} className="size-full" sizes="(min-width: 900px) 54vw, 100vw"/><span className="cn-photo-note">The art of staying a little longer.</span><span className="cn-seal" aria-hidden>CN<br/><small>LA DOLCE NOTTE</small></span></div>
  </section>;
}
export function ActionRail({openLabel,isOpen}:{openLabel:string;isOpen:boolean}) {
  return <div className="cn-action-rail"><span><i data-open={isOpen}/>{openLabel}</span><span>West Loop · Chicago</span><Link href="/events">A good night, every week ↗</Link></div>;
}
