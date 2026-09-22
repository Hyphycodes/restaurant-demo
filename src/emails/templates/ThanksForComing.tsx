import { Link, Text } from '@react-email/components';
import { EventHero, RestaurantEmailLayout, RestaurantHeader, PrimaryButton } from '../components';
import { FONTS, GUTTER, PALETTE } from '../theme';
import type { EmailBrand, EmailCustomer, EmailEvent } from '../types';
import { footerLines, greetingFor, joinText } from '../utils/text';
import { Block } from '../components/Block';

/**
 * The morning after. No QR, nothing to scan; one thank you and one thing to
 * do next. Built and off: the cron stage that would send it is disabled.
 */
export interface ThanksForComingProps {
  brand: EmailBrand;
  customer: EmailCustomer;
  event: EmailEvent;
  reviewUrl: string | null;
  test?: boolean;
}

export function subject({ event }: ThanksForComingProps): string {
  return `Thanks for coming to ${event.title}`;
}

export function preheader({ event }: ThanksForComingProps): string {
  return `It was good to have you at ${event.title}. Here is what is on next.`;
}

export function text(props: ThanksForComingProps): string {
  const { brand, customer, event, reviewUrl } = props;
  return joinText(
    greetingFor(customer),
    `Thanks for coming to ${event.title}. It was good to have you in.`,
    `What's on next: ${brand.eventsUrl}`,
    reviewUrl ? `If you had a good night, a review genuinely helps a small restaurant: ${reviewUrl}` : null,
    footerLines(brand),
  );
}

export default function ThanksForComing(props: ThanksForComingProps) {
  const { brand, customer, event, reviewUrl, test } = props;
  const surface = 'dark';
  const palette = PALETTE.dark;
  return (
    <RestaurantEmailLayout preview={preheader(props)} surface={surface} brand={brand} test={test} footerReason={`Sent to ${customer.email} because you came to this event.`}>
      <RestaurantHeader brand={brand} surface={surface} compact />
      <EventHero event={event} headline="Thanks for coming." greeting={greetingFor(customer)} surface={surface} layout="side" />
      <Block className="o-gutter" style={{ padding: `18px ${GUTTER}px 8px` }}>
        <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: palette.text }}>
          It was good to have you in.{' '}
          {reviewUrl ? (
            <>
              If you had a good night, a{' '}
              <Link href={reviewUrl} style={{ color: palette.link, textDecoration: 'underline' }}>
                review
              </Link>{' '}
              genuinely helps a small restaurant.
            </>
          ) : null}
        </Text>
      </Block>
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 16px` }}>
        <PrimaryButton href={brand.eventsUrl} surface={surface}>
          What&rsquo;s on next
        </PrimaryButton>
      </Block>
    </RestaurantEmailLayout>
  );
}
