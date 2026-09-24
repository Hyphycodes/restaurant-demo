import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { EmptyState, HelpNote } from '@/components/admin/ui';
import { getMediaMap } from '@/content/media';
import { getSiteSettings } from '@/content/resolve';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getStaff, staffCan } from '@/server/auth';
import { getThemeRecord } from '@/server/content/theme';
import { canOpen } from '@/server/permissions';
import { THEME_CHOICES, THEMES } from '@/themes/registry';
import { resolveTheme } from '@/themes/resolve';
import { formatVenueMoment, themeStatusAt, venueLocalParts } from '@/themes/schedule';
import { THEME_ASSET_SLOTS, type SeasonalThemeSlug } from '@/themes/types';
import { ThemeManager, type ManagerAsset } from './ThemeManager';

export const dynamic = 'force-dynamic';

/** The one seasonal theme that exists today. The screen is written for many. */
const CURRENT: SeasonalThemeSlug = 'autumn-evening';

/**
 * Seasonal look.
 *
 * One screen, in the order a manager would actually do it: choose the look,
 * preview it, switch effects, set dates, publish. Artwork replacement sits at
 * the bottom because it is the thing most people will never need to touch.
 */
export default async function ThemePage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'website')) {
    return (
      <AdminShell staff={staff} local={local} title="Seasonal look">
        <NoAccess what="the website's seasonal look" />
      </AdminShell>
    );
  }

  const db = getReadDb();
  if (!db) {
    return (
      <AdminShell staff={staff} local={local} title="Seasonal look">
        <EmptyState>The seasonal look is not available right now. Please try again in a moment.</EmptyState>
      </AdminShell>
    );
  }

  const now = new Date();
  const [record, settings] = await Promise.all([getThemeRecord(db, CURRENT), getSiteSettings()]);
  const timeZone = settings.timeZone;
  const definition = THEMES[CURRENT];
  const resolved = await resolveTheme(CURRENT, record.config, 'preview');
  const status = themeStatusAt(record, now);
  const media = await getMediaMap();

  const assets: ManagerAsset[] = THEME_ASSET_SLOTS.map((slot) => {
    const spec = definition.assets[slot];
    const current = resolved.assets[slot];
    const overrideId = record.config.assets[slot] ?? null;
    return {
      slot,
      label: spec.label,
      hint: spec.hint,
      accepts: spec.accepts,
      defaultPath: spec.defaultPath,
      currentPath: current.path,
      currentKind: current.kind,
      overridden: current.overridden,
      // An override that points at a photo that has since been archived falls
      // back to the default silently on the website; say so here.
      staleOverride: Boolean(overrideId) && !current.overridden && !media[overrideId!]?.path,
    };
  });

  const canPublish = staffCan(staff, 'content.publish');

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Seasonal look"
      description="Dress the website for the season, preview it, and switch it on — or set the dates and let it switch itself."
    >
      {!canPublish ? (
        <div className="mb-5">
          <HelpNote>
            Your account can see these settings but only a manager or the owner can change the
            website&apos;s look.
          </HelpNote>
        </div>
      ) : null}

      <ThemeManager
        choices={THEME_CHOICES}
        theme={{
          slug: CURRENT,
          name: definition.name,
          shortName: definition.shortName,
          description: definition.description,
          record,
          status,
          statusDetail: describeStatus(status, record, timeZone),
          schedule: {
            start: venueLocalParts(record.startAt, timeZone),
            end: venueLocalParts(record.endAt, timeZone),
          },
          assets,
        }}
        canPublish={canPublish}
      />
    </AdminShell>
  );
}

function describeStatus(
  status: ReturnType<typeof themeStatusAt>,
  record: Awaited<ReturnType<typeof getThemeRecord>>,
  timeZone: string,
): string {
  const start = formatVenueMoment(record.startAt, timeZone);
  const end = formatVenueMoment(record.endAt, timeZone);
  switch (status) {
    case 'live':
      return record.scheduleEnabled && end
        ? `On the website now, until ${end}.`
        : 'On the website now.';
    case 'scheduled':
      return `Switches itself on ${start}${end ? ` and off ${end}` : ''}.`;
    case 'ended':
      return `Its dates ended ${end}. The website is showing Default Casa Aurelia.`;
    default:
      return 'Not on the website.';
  }
}
