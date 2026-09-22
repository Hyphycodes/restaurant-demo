import { Text } from '@react-email/components';
import { FONTS, GUTTER, PALETTE } from '../theme';
import type { StaffEmailProps } from '../types';
import { firstNameOf } from '../utils/format';
import { footerLines, joinText } from '../utils/text';
import { Block } from './Block';
import { InfoRow, InfoTable } from './InfoRow';
import { NoticeBox } from './NoticeBox';
import { RestaurantEmailLayout } from './RestaurantEmailLayout';
import { RestaurantHeader } from './RestaurantHeader';
import { PrimaryButton } from './PrimaryButton';

/**
 * The staff operations email. The same ivory letter every account email
 * uses, with a small table of facts — when, where, what position — under
 * the sentence, because an employee reads this on a phone between two
 * other things and wants the time before the prose.
 */
export function StaffShell({ eyebrow, props }: { eyebrow: string; props: StaffEmailProps }) {
  const { brand, name, headline, intro, details, note, actionUrl, actionLabel, email, footerReason, test } = props;
  const surface = 'light';
  const palette = PALETTE.light;
  const body = { margin: 0, fontFamily: FONTS.sans, fontSize: 16, lineHeight: '24px', color: palette.text } as const;
  const first = firstNameOf(name);
  return (
    <RestaurantEmailLayout preview={`${headline} ${intro}`.slice(0, 140)} surface={surface} brand={brand} test={test} footerReason={footerReason ?? `Sent to ${email} because it is the email on your ${brand.shortName} staff profile.`}>
      <RestaurantHeader brand={brand} surface={surface} eyebrow={eyebrow} />
      <Block className="o-gutter" style={{ padding: `8px ${GUTTER}px 4px` }}>
        {first ? <Text style={{ ...body, color: palette.muted }}>Hi {first},</Text> : null}
        <Text style={{ margin: '8px 0 0', fontFamily: FONTS.sans, fontSize: 30, lineHeight: '34px', fontWeight: 800, color: palette.text }}>{headline}</Text>
      </Block>
      <Block className="o-gutter" style={{ padding: `14px ${GUTTER}px 4px` }}>
        <Text style={body}>{intro}</Text>
      </Block>
      {details.length > 0 ? (
        <Block className="o-gutter" style={{ padding: `10px ${GUTTER}px 4px` }}>
          <InfoTable>
            {details.map((row, index) => (
              <InfoRow key={`${row.label}-${index}`} label={row.label} surface={surface} last={index === details.length - 1}>
                {row.value}
              </InfoRow>
            ))}
          </InfoTable>
        </Block>
      ) : null}
      {note ? (
        <Block className="o-gutter" style={{ padding: `10px ${GUTTER}px 4px` }}>
          <NoticeBox tone="info" surface={surface}>
            {note}
          </NoticeBox>
        </Block>
      ) : null}
      <Block className="o-gutter" style={{ padding: `18px ${GUTTER}px 16px` }}>
        <PrimaryButton href={actionUrl} surface={surface} block>
          {actionLabel}
        </PrimaryButton>
        <Text style={{ ...body, marginTop: 14, fontSize: 13, lineHeight: '19px', color: palette.muted, wordBreak: 'break-all' }}>
          If the button does not work, open this link: {actionUrl}
        </Text>
      </Block>
    </RestaurantEmailLayout>
  );
}

/** The plain-text part every staff email shares. */
export function staffText(props: StaffEmailProps): string {
  const first = firstNameOf(props.name);
  return joinText(
    first ? `Hi ${first},` : null,
    props.headline,
    props.intro,
    props.details.map((row) => `${row.label}: ${row.value}`),
    props.note ? `Note: ${props.note}` : null,
    `${props.actionLabel}: ${props.actionUrl}`,
    footerLines(props.brand),
  );
}
