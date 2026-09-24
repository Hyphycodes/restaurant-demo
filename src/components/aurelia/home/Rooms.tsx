import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import { MotionScope } from '../motion/MotionScope';

export function Rooms() {
  return (
    <MotionScope as="section" className="cn-night cn-rooms cn-section" aria-labelledby="rooms-title">
      <div className="cn-wrap cn-rooms-grid">
        <div className="cn-photo cn-rooms-photo" data-m="image">
          <div data-m="parallax" data-speed="0.2" className="cn-rooms-photo-inner">
            <Asset id="roomNightTall" rounded={false} sizes="(min-width: 900px) 42vw, 92vw" className="size-full" />
          </div>
          <span className="cn-candles" aria-hidden="true" style={{ ['--cx1' as string]: '46%', ['--cy1' as string]: '76%' }} />
        </div>
        <div className="cn-rooms-copy">
          <p className="cn-eyebrow" data-m="up">
            Private dining &amp; catering
          </p>
          <h2 id="rooms-title" className="cn-display cn-lg mt-5" data-m="title">
            The back room is <em>yours for the night.</em>
          </h2>
          <p className="cn-lede mt-6" data-m="up">
            Rehearsal dinners, birthdays that turn into stories, a team that deserves better than a conference room. One long
            table for up to thirty-six, a menu built with the kitchen, and a bartender who remembers the order.
          </p>
          <dl className="cn-rooms-facts" data-m="stagger">
            <div>
              <dt className="cn-eyebrow">The Back Room</dt>
              <dd>Seated dinner for 12–36</dd>
            </div>
            <div>
              <dt className="cn-eyebrow">The Whole House</dt>
              <dd>Receptions up to 120</dd>
            </div>
            <div>
              <dt className="cn-eyebrow">Catering</dt>
              <dd>Family-style trays, from 10</dd>
            </div>
          </dl>
          <div className="mt-10 flex flex-wrap gap-3" data-m="up">
            <Link href="/private-events" className="cn-btn">
              Plan a gathering <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/catering" className="cn-btn cn-btn-ghost">
              Catering
            </Link>
          </div>
        </div>
      </div>
    </MotionScope>
  );
}
