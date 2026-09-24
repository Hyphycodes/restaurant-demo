import { ImageResponse } from 'next/og';
import { site } from '@/content/site';

/**
 * Runs on the default Node.js runtime, not edge.
 *
 * `runtime = 'edge'` forced a separate edge bundle at build time and printed
 * "Using edge runtime on a page currently disables static generation". The card
 * is generated once and cached; there is nothing to gain from edge here, and the
 * extra bundling step is a build-time failure mode we do not need.
 */
export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social card, drawn from brand tokens rather than a photograph — the only
 * available photography is 720px-wide reel frames, which would look soft at
 * 1200×630. Type does the work, which is on-brand anyway.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#211a17',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: '#b99b69' }} />
          <div
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#f2ebdf',
              fontWeight: 600,
            }}
          >
            CASA AURELIA · ITALIAN SUPPER CLUB
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 92,
            lineHeight: 1.02,
            letterSpacing: -3,
            color: '#f2ebdf',
            fontWeight: 700,
          }}
        >
          <span>Stay for dinner.</span>
          <span>Leave much later.</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 26,
            color: '#f2ebdf',
            borderTop: '2px solid #b99b69',
            paddingTop: 24,
          }}
        >
          <span>
            {site.street}, {site.locality}, {site.region}
          </span>
          <span>{site.phone.value}</span>
        </div>
      </div>
    ),
    size,
  );
}
