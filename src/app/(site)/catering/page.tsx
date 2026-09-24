import type { Metadata } from 'next';
import { MotionScope } from '@/components/aurelia/motion/MotionScope';
import { EditorialTitle } from '@/components/aurelia/page/EditorialTitle';
import { PageHero } from '@/components/aurelia/page/PageHero';
import { CateringForm } from '@/components/forms/CateringForm';
import { Asset } from '@/components/media/Asset';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { pageCopy, seo } from '@/content/pages';
import { getCateringItems, getCateringPackages, getSiteSettings } from '@/content/resolve';
import { formatPrice, formatPriceRange } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.catering!, path: '/catering' });

/**
 * Catering: the supper club, packed to travel. Packages and trays come from
 * the admin; the enquiry lands in the same pipeline as private dining.
 */
export default async function CateringPage() {
  const [packages, items, site, copy] = await Promise.all([getCateringPackages(), getCateringItems(), getSiteSettings(), getPageCopy('catering')]);

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow ?? 'Catering'}
        title={<EditorialTitle text={copy.heading} />}
        lede={copy.body}
        asset="burrataNight"
        dim
        focus={{ x: '50%', y: '45%' }}
        aside={
          <a href="#inquiry" className="cn-btn">
            Start an order <span className="cn-arrow" aria-hidden="true">→</span>
          </a>
        }
      />

      <MotionScope as="section" className="cn-paper cn-grain cn-section" aria-labelledby="packages-title">
        <div className="cn-wrap">
          <div className="cn-split-head">
            <p className="cn-eyebrow" data-m="up">
              Party packages
            </p>
            <h2 id="packages-title" className="cn-display cn-lg" data-m="title">
              Dinner for a crowd, <em>no dishes after.</em>
            </h2>
          </div>
          <ol className="cn-packages" data-m="stagger">
            {packages.map((pkg, index) => (
              <li key={pkg.id} className="cn-package">
                <span className="cn-package-num cn-num">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="cn-display cn-sm">{pkg.name}</h3>
                {pkg.servesMin ? <p className="cn-eyebrow">Serves {formatPriceRange(pkg.servesMin, pkg.servesMax)}</p> : null}
                <ul>
                  {pkg.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="cn-package-price cn-num">{pkg.priceCents ? formatPrice(pkg.priceCents) : 'Ask us'}</p>
              </li>
            ))}
          </ol>
        </div>
      </MotionScope>

      <MotionScope as="section" className="cn-night cn-section" aria-labelledby="trays-title">
        <div className="cn-wrap cn-two-col">
          <div>
            <div className="cn-photo" style={{ aspectRatio: '4 / 5' }} data-m="image">
              <Asset id="pastaNight" rounded={false} sizes="(min-width: 900px) 40vw, 92vw" className="size-full" />
            </div>
          </div>
          <div>
            <p className="cn-eyebrow" data-m="up">
              By the tray
            </p>
            <h2 id="trays-title" className="cn-display cn-lg mt-4" data-m="title">
              Or build <em>your own table.</em>
            </h2>
            <ul className="cn-trays" data-m="stagger">
              {items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.name}
                    {item.note ? <small>{item.note}</small> : null}
                  </span>
                  <span className="cn-num">{item.priceCents ? formatPrice(item.priceCents) : ''}</span>
                </li>
              ))}
            </ul>
            <p className="cn-body mt-6">{pageCopy.catering.note}</p>
            <dl className="cn-lead-facts cn-num mt-8">
              <div>
                <dt className="cn-eyebrow">Notice</dt>
                <dd>48 hours</dd>
              </div>
              <div>
                <dt className="cn-eyebrow">Pickup</dt>
                <dd>From 11am</dd>
              </div>
              <div>
                <dt className="cn-eyebrow">Delivery</dt>
                <dd>West Loop &amp; the Loop</dd>
              </div>
            </dl>
          </div>
        </div>
      </MotionScope>

      <MotionScope as="section" className="cn-wine-room cn-grain cn-section" aria-labelledby="catering-inquiry-title">
        <div className="cn-wrap cn-form-layout" id="inquiry">
          <div>
            <p className="cn-eyebrow" data-m="up">
              Catering enquiry
            </p>
            <h2 id="catering-inquiry-title" className="cn-display cn-lg mt-4" data-m="title">
              Tell us <em>what you need.</em>
            </h2>
            <p className="cn-lede mt-6" data-m="up">
              The date, the headcount and roughly what you have in mind. Someone from the kitchen confirms the menu and the price
              — nothing is charged online.
            </p>
          </div>
          <div className="cn-card-paper" data-m="up" data-delay="0.2">
            <CateringForm phone={site.phone.value} packageNames={packages.map((pkg) => pkg.name)} />
          </div>
        </div>
      </MotionScope>
      <ThemeWorld scene="celebration" />
    </>
  );
}
