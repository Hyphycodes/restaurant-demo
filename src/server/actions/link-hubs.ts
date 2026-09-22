'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Row } from '@/lib/db/types';
import { HUB_TEMPLATES } from '@/features/link-hubs/templates';
import { BLOCK_TYPES, HUB_TYPES } from '@/features/link-hubs/types';
import { staffCan } from '@/server/auth';
import { done, run, type ActionState } from './shared';

const slugSchema = z.string().trim().toLowerCase().min(2).max(64).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use lowercase letters, numbers and single hyphens.',
);

const templateSchema = z.enum(['main-links', 'live', 'vinyl-club', 'nightlife', 'artist', 'hiring', 'blank']);

const createSchema = z.object({
  name: z.string().trim().min(1, 'Give the hub a name.').max(100),
  slug: slugSchema,
  internalDescription: z.string().trim().max(400).optional(),
  template: templateSchema,
  locationId: z.string().trim().max(80).optional(),
});

export async function createLinkHub(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const parsed = createSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
    const value = parsed.data;
    const duplicate = (await db.list<Row>('link_hubs')).some((row) => String(row.slug).toLowerCase() === value.slug);
    if (duplicate) return { ok: false, message: 'That permanent URL is already in use.' };

    const template = HUB_TEMPLATES[value.template];
    const id = crypto.randomUUID();
    await db.insert('link_hubs', {
      id,
      location_id: value.locationId || null,
      name: value.name,
      slug: value.slug,
      internal_description: value.internalDescription ?? template.description,
      hub_type: template.hubType,
      theme: template.theme,
      status: 'draft',
      title: template.title,
      subtitle: template.subtitle || null,
      logo_asset_id: 'brandLogo',
      background_asset_id: null,
      hero_asset_id: null,
      custom_theme: {},
      start_at: null,
      end_at: null,
      mode_strategy: 'auto',
      manual_mode_id: null,
      search_visibility: 'noindex',
    });
    await Promise.all(template.blocks.map((block, sort) => db.insert('link_hub_blocks', {
      id: crypto.randomUUID(),
      hub_id: id,
      mode_id: null,
      block_type: block.type,
      label: block.label,
      config: block.config,
      sort,
      visible: true,
      start_at: null,
      end_at: null,
    })));
    revalidatePath('/admin/link-hubs');
    return { ok: true, message: `${value.name} created.`, affected: [`/admin/link-hubs/${id}`] };
  });
}

const nullableText = z.string().trim().max(500).nullable();
const modeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  titleOverride: z.string().trim().max(100).nullable(),
  subtitleOverride: z.string().trim().max(240).nullable(),
  enabled: z.boolean(),
  priority: z.number().int().min(-100).max(100),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  activeEventOnly: z.boolean(),
});
const blockSchema = z.object({
  id: z.string().uuid(),
  modeId: z.string().uuid().nullable(),
  blockType: z.enum(BLOCK_TYPES),
  label: z.string().trim().max(100),
  config: z.record(z.unknown()),
  sort: z.number().int().min(0).max(1000),
  visible: z.boolean(),
  startAt: nullableText,
  endAt: nullableText,
});
const saveSchema = z.object({
  hub: z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    internalDescription: z.string().trim().max(400),
    hubType: z.enum(HUB_TYPES),
    theme: z.enum(['cosa-nostra-default', 'evening', 'teal', 'plum', 'seasonal', 'custom']),
    status: z.enum(['draft', 'published']),
    title: z.string().trim().min(1).max(100),
    subtitle: z.string().trim().max(240).nullable(),
    locationId: z.string().trim().max(80).nullable(),
    logoAssetId: z.string().trim().max(100).nullable(),
    backgroundAssetId: z.string().trim().max(100).nullable(),
    heroAssetId: z.string().trim().max(100).nullable(),
    customTheme: z.record(z.string()),
    startAt: nullableText,
    endAt: nullableText,
    modeStrategy: z.enum(['auto', 'manual']),
    manualModeId: z.string().uuid().nullable(),
    searchVisibility: z.enum(['searchable', 'noindex']),
  }),
  modes: z.array(modeSchema).max(30),
  blocks: z.array(blockSchema).max(100),
});

export async function saveLinkHub(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db, staff }) => {
    let raw: unknown;
    try { raw = JSON.parse(String(formData.get('payload') ?? '')); }
    catch { return { ok: false, message: 'The editor data could not be read. Refresh and try again.' }; }
    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the hub settings.' };
    const { hub, modes, blocks } = parsed.data;
    const current = await db.get<Row>('link_hubs', hub.id);
    if (!current) return { ok: false, message: 'That hub no longer exists. Refresh the page.' };
    if (hub.status === 'published' && !staffCan(staff, 'content.publish')) {
      return { ok: false, message: 'A manager needs to publish this hub.' };
    }
    const modeIds = new Set(modes.map((mode) => mode.id));
    if (hub.manualModeId && !modeIds.has(hub.manualModeId)) {
      return { ok: false, message: 'Choose an existing mode for the manual override.' };
    }
    if (blocks.some((block) => block.modeId && !modeIds.has(block.modeId))) {
      return { ok: false, message: 'One block belongs to a mode that no longer exists.' };
    }

    for (const mode of modes) {
      await db.upsert('link_hub_modes', {
        id: mode.id,
        hub_id: hub.id,
        name: mode.name,
        title_override: mode.titleOverride || null,
        subtitle_override: mode.subtitleOverride || null,
        enabled: mode.enabled,
        priority: mode.priority,
        days_of_week: mode.daysOfWeek,
        start_time: mode.startTime || null,
        end_time: mode.endTime || null,
        starts_on: mode.startsOn || null,
        ends_on: mode.endsOn || null,
        active_event_only: mode.activeEventOnly,
      });
    }
    for (const block of blocks) {
      await db.upsert('link_hub_blocks', {
        id: block.id,
        hub_id: hub.id,
        mode_id: block.modeId,
        block_type: block.blockType,
        label: block.label,
        config: block.config,
        sort: block.sort,
        visible: block.visible,
        start_at: block.startAt || null,
        end_at: block.endAt || null,
      });
    }

    const existingBlocks = await db.list<Row>('link_hub_blocks', { where: { hub_id: hub.id } });
    const keptBlocks = new Set(blocks.map((block) => block.id));
    for (const block of existingBlocks) if (!keptBlocks.has(String(block.id))) await db.remove('link_hub_blocks', String(block.id));

    // Clear the FK before removing a mode that could currently be selected.
    await db.update('link_hubs', hub.id, { manual_mode_id: null });
    const existingModes = await db.list<Row>('link_hub_modes', { where: { hub_id: hub.id } });
    for (const mode of existingModes) if (!modeIds.has(String(mode.id))) await db.remove('link_hub_modes', String(mode.id));

    await db.update('link_hubs', hub.id, {
      location_id: hub.locationId,
      name: hub.name,
      internal_description: hub.internalDescription,
      hub_type: hub.hubType,
      theme: hub.theme,
      status: hub.status,
      title: hub.title,
      subtitle: hub.subtitle || null,
      logo_asset_id: hub.logoAssetId,
      background_asset_id: hub.backgroundAssetId,
      hero_asset_id: hub.heroAssetId,
      custom_theme: hub.customTheme,
      start_at: hub.startAt || null,
      end_at: hub.endAt || null,
      mode_strategy: hub.modeStrategy,
      manual_mode_id: hub.manualModeId,
      search_visibility: hub.searchVisibility,
    });
    return done(hub.status === 'published' ? 'Saved and live.' : 'Draft saved.', 'hubs');
  });
}

const idSchema = z.object({ id: z.string().uuid() });

export async function duplicateLinkHub(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.edit', async ({ db }) => {
    const parsed = idSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not duplicate that hub.' };
    const source = await db.get<Row>('link_hubs', parsed.data.id);
    if (!source) return { ok: false, message: 'That hub no longer exists.' };
    const all = await db.list<Row>('link_hubs');
    const base = `${String(source.slug)}-copy`;
    let slug = base;
    let n = 2;
    while (all.some((row) => String(row.slug).toLowerCase() === slug.toLowerCase())) slug = `${base}-${n++}`;
    const id = crypto.randomUUID();
    await db.insert('link_hubs', {
      ...source,
      id,
      slug,
      name: `${String(source.name)} copy`,
      status: 'draft',
      manual_mode_id: null,
      created_at: undefined,
      updated_at: undefined,
    });
    const sourceModes = await db.list<Row>('link_hub_modes', { where: { hub_id: parsed.data.id } });
    const modeMap = new Map<string, string>();
    for (const mode of sourceModes) {
      const newModeId = crypto.randomUUID();
      modeMap.set(String(mode.id), newModeId);
      await db.insert('link_hub_modes', { ...mode, id: newModeId, hub_id: id, created_at: undefined, updated_at: undefined });
    }
    const sourceBlocks = await db.list<Row>('link_hub_blocks', { where: { hub_id: parsed.data.id } });
    for (const block of sourceBlocks) {
      await db.insert('link_hub_blocks', {
        ...block,
        id: crypto.randomUUID(),
        hub_id: id,
        mode_id: block.mode_id ? modeMap.get(String(block.mode_id)) ?? null : null,
        created_at: undefined,
        updated_at: undefined,
      });
    }
    revalidatePath('/admin/link-hubs');
    return { ok: true, message: 'Hub duplicated as a draft.', affected: [`/admin/link-hubs/${id}`] };
  });
}

export async function setLinkHubPublished(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = idSchema.extend({ publish: z.enum(['true', 'false']) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not change the hub status.' };
    const hub = await db.get<Row>('link_hubs', parsed.data.id);
    if (!hub) return { ok: false, message: 'That hub no longer exists.' };
    await db.update('link_hubs', parsed.data.id, { status: parsed.data.publish === 'true' ? 'published' : 'draft' });
    return done(parsed.data.publish === 'true' ? 'Hub published.' : 'Hub unpublished.', 'hubs');
  });
}

export async function archiveLinkHub(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.archive', async ({ db }) => {
    const parsed = idSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Could not archive that hub.' };
    await db.update('link_hubs', parsed.data.id, { status: 'archived', manual_mode_id: null });
    return done('Hub archived. Its permanent URL is now offline.', 'hubs');
  });
}

const locationSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240),
  phone: z.string().trim().max(40),
  reviewUrl: z.string().trim().url().or(z.literal('')),
  directionsUrl: z.string().trim().url().or(z.literal('')),
  reservationUrl: z.string().trim().url().or(z.literal('')),
  menuUrl: z.string().trim().max(500),
  instagramUrl: z.string().trim().url().or(z.literal('')),
  tiktokUrl: z.string().trim().url().or(z.literal('')),
  facebookUrl: z.string().trim().url().or(z.literal('')),
  contactEmail: z.string().trim().email().or(z.literal('')),
});

export async function saveLinkHubLocation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return run('settings.manage', async ({ db }) => {
    const parsed = locationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the location details.' };
    const value = parsed.data;
    await db.update('link_hub_locations', value.id, {
      name: value.name,
      address: value.address || null,
      phone: value.phone || null,
      review_url: value.reviewUrl || null,
      directions_url: value.directionsUrl || null,
      reservation_url: value.reservationUrl || null,
      menu_url: value.menuUrl || null,
      instagram_url: value.instagramUrl || null,
      tiktok_url: value.tiktokUrl || null,
      facebook_url: value.facebookUrl || null,
      contact_email: value.contactEmail || null,
    });
    return done('Location destinations saved.', 'hubs');
  });
}
