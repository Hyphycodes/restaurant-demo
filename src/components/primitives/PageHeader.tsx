import type { ReactNode } from 'react';
import { Band, Frame } from './Band';
import { Display, Eyebrow, Lead } from './Type';

/**
 * Route opener.
 *
 * `align` and `surface` exist so interior pages do not all begin with the same
 * block — /menu opens left on cream, /events opens on espresso, /visit opens on
 * sand. Same tokens, different compositions.
 */
export function PageHeader({
  eyebrow,
  heading,
  body,
  surface = 'cream',
  actions,
  aside,
}: {
  eyebrow?: string;
  heading: string;
  body?: string;
  surface?: 'cream' | 'linen' | 'sand' | 'espresso';
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  const dark = surface === 'espresso';

  return (
    <Band surface={surface} size="sm" topRule={dark}>
      <Frame wide>
        <div className={aside ? 'grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12' : ''}>
          <div className={aside ? 'lg:col-span-7' : ''}>
            {eyebrow ? <Eyebrow tone={dark ? 'night' : 'default'}>{eyebrow}</Eyebrow> : null}
            <Display
              as="h1"
              size="lg"
              className={`mt-4 max-w-[16ch] ${dark ? 'text-night-text' : 'text-brown'}`}
            >
              {heading}
            </Display>
            {body ? (
              <Lead tone={dark ? 'night' : 'default'} className="mt-5">
                {body}
              </Lead>
            ) : null}
            {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
          </div>
          {aside ? <div className="lg:col-span-4 lg:col-start-9">{aside}</div> : null}
        </div>
      </Frame>
    </Band>
  );
}
