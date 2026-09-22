import { Text } from '@react-email/components';
import { COLORS, FONTS } from '../theme';
import { Block } from './Block';

/** Unmissable, and only ever rendered for a staff test send. */
export function TestBanner() {
  return (
    <Block style={{ backgroundColor: COLORS.amberBright, padding: '10px 24px' }}>
      <Text style={{ margin: 0, fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.onOrange, textAlign: 'center' }}>
        Test email — not a real ticket
      </Text>
    </Block>
  );
}
