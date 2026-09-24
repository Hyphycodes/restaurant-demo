import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import { BehindDirector } from './BehindDirector';
import { OperatingRoom } from './Panels';
import type { PlatformSnapshot } from './snapshot';

/** The public site in miniature — the thing that splits open. */
function SiteFace() {
  return (
    <div className="cn-bh-face">
      <div className="cn-bh-face-media">
        <Asset id="roomNight" rounded={false} sizes="80vw" className="size-full" alt="" />
      </div>
      <div className="cn-bh-face-nav">
        <span>Menu</span>
        <span>Events</span>
        <span>Private Dining</span>
        <b>Casa Aurelia</b>
        <span>Catering</span>
        <span>Visit</span>
        <i>Reserve</i>
      </div>
      <div className="cn-bh-face-title">
        <span>Stay for dinner.</span>
        <em>Leave much later.</em>
      </div>
    </div>
  );
}

/** Wires from the centre to each module, in the stage's 100×100 space. */
const HUB = { x: 54.8, y: 66.7 };
const ENDS = [
  [15, 30], [40, 16], [40, 48], [68, 30], [90, 34], [26, 86], [68, 86], [90, 86],
];
const WIRES = ENDS.map(([x, y]) => {
  const cx = (HUB.x + x!) / 2;
  return `M${HUB.x} ${HUB.y} C ${cx} ${HUB.y}, ${cx} ${y}, ${x} ${y}`;
});

export function Behind({ snapshot, id }: { snapshot: PlatformSnapshot; id?: string }) {
  return (
    <BehindDirector id={id}>
      <div className="cn-bh-stage cn-grain">
        <div className="cn-bh-intro cn-wrap">
          <p className="cn-eyebrow">Behind the hospitality</p>
          <h2 id="behind-title" className="cn-display cn-lg">
            Every good night <em>runs on something.</em>
          </h2>
        </div>

        <div className="cn-bh-os" aria-label="The Casa Aurelia operating system: admin and staff tools">
          <svg className="cn-bh-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {WIRES.map((d) => (
              <path key={d} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <span className="cn-bh-core" aria-hidden="true">
            <b>CN</b>
            <small>One system</small>
          </span>
          <OperatingRoom snapshot={snapshot} />
        </div>

        <div className="cn-bh-site" aria-hidden="true">
          <div className="cn-bh-half cn-bh-half-top">
            <SiteFace />
          </div>
          <div className="cn-bh-half cn-bh-half-bottom">
            <SiteFace />
          </div>
          <span className="cn-bh-seam" />
        </div>

        <p className="cn-bh-cap cn-bh-cap-1" aria-hidden="true">
          <span className="cn-eyebrow">What the guest sees</span>
          <span className="cn-italic">A table, a candle, a very good night.</span>
        </p>
        <p className="cn-bh-cap cn-bh-cap-2" aria-hidden="true">
          <span className="cn-eyebrow">What runs underneath</span>
          <span className="cn-italic">Events, rota, menus, training — all one house.</span>
        </p>

        <div className="cn-bh-finale cn-wrap">
          <p className="cn-eyebrow">The Casa Aurelia platform</p>
          <p className="cn-display cn-xl">
            One restaurant. <em>One connected system.</em>
          </p>
          <p className="cn-lede">
            The website guests fall for, the operating room management runs it from, and the workspace staff carry through
            a shift — built as one product, on one set of records.
          </p>
          <div className="cn-bh-actions">
            <Link href="/demo/admin" className="cn-btn">
              Open the operating room <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/demo/staff" className="cn-btn cn-btn-ghost">
              Work a shift
            </Link>
            <Link href="/behind" className="cn-link">
              How it fits together
            </Link>
          </div>
        </div>
      </div>
    </BehindDirector>
  );
}
