

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { assets, type AssetRecord } from '../src/content/assets';
import { eventSeries } from '../src/content/events';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MEDIA_DIR = path.join(PUBLIC_DIR, 'media');
const SRC_DIR = path.join(ROOT, 'src');

const errors: string[] = [];
const warnings: string[] = [];

const fail = (message: string) => errors.push(message);
const warn = (message: string) => warnings.push(message);

/** Aspect ratios are compared with a 1.5% tolerance for rounding on crops. */
function ratioMatches(ratio: string, width: number, height: number): boolean {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return false;
  return Math.abs(w / h - width / height) / (w / h) < 0.015;
}

async function exists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

async function main() {
  const entries = Object.entries(assets) as [string, AssetRecord][];
  const claimedPaths = new Set<string>();
  const altIndex = new Map<string, string[]>();

  // ---- per-entry checks -------------------------------------------------
  // Which IDs are actually referenced by rendering code — either as a literal
  // `id="x"` / `assetId: 'x'`, or dynamically through an event series' artwork.
  const componentSource = (await walk(SRC_DIR))
    .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(path.join('content', 'assets.ts')))
    .map((f) => readFile(f, 'utf8'));
  const allSource = (await Promise.all(componentSource)).join('\n');
  const dynamicIds = new Set(
    eventSeries.flatMap((s) => [s.artworkAssetId, s.flyerAssetId]).filter(Boolean) as string[],
  );
  // A poster is rendered by AssetVideo via `asset.poster`, never by its own ID.
  const posterPaths = new Set(entries.map(([, a]) => a.poster).filter(Boolean) as string[]);

  function isReferenced(id: string, asset: AssetRecord): boolean {
    if (dynamicIds.has(id)) return true;
    if (asset.path && posterPaths.has(asset.path)) return true;
    // CSS references assets by path (the paper grain), components by ID.
    if (asset.path && allSource.includes(asset.path)) return true;
    return new RegExp(`["'\`]${id}["'\`]`).test(allSource);
  }

  for (const [id, asset] of entries) {
    if (asset.usage.length === 0) {
      fail(`${id}: registry entry has no recorded usage — remove it or use it.`);
    }

    if (!isReferenced(id, asset)) {
      // A registered FILE that nothing renders is dead weight in the repo.
      // A registered placeholder that nothing renders yet is a reserved slot.
      if (asset.path) {
        fail(`${id}: file is registered but no component renders it — ${asset.path}`);
      } else {
        warn(`${id}: reserved slot, not yet placed in any page.`);
      }
    }

    if (asset.alt === null && asset.kind === 'image' && asset.status !== 'placeholder') {
      // Decorative is a valid choice, but it must be a choice, not an oversight.
      warn(`${id}: alt is null (decorative). Confirm this image carries no information.`);
    }

    if (asset.alt) {
      const list = altIndex.get(asset.alt) ?? [];
      list.push(id);
      altIndex.set(asset.alt, list);
    }

    if (!asset.path) {
      if (asset.status !== 'placeholder') {
        fail(`${id}: no path, but status is "${asset.status}" — should be "placeholder".`);
      }
      continue;
    }

    if (asset.status === 'placeholder') {
      fail(`${id}: status is "placeholder" but a path is set (${asset.path}).`);
    }

    claimedPaths.add(asset.path);
    const absolute = path.join(PUBLIC_DIR, asset.path);

    if (!(await exists(absolute))) {
      fail(`${id}: file not found — ${asset.path}`);
      continue;
    }

    const { size } = await stat(absolute);
    if (asset.maxBytes && size > asset.maxBytes) {
      fail(
        `${id}: ${(size / 1024).toFixed(0)}KB exceeds its ${(asset.maxBytes / 1024).toFixed(0)}KB budget — ${asset.path}`,
      );
    }

    if (asset.kind === 'video') {
      if (!asset.poster) {
        fail(`${id}: video has no poster. Every decorative video must paint a poster first.`);
      } else {
        claimedPaths.add(asset.poster);
        if (!(await exists(path.join(PUBLIC_DIR, asset.poster)))) {
          fail(`${id}: poster file not found — ${asset.poster}`);
        }
      }
      continue;
    }

    if (asset.kind === 'texture') continue;

    // Images: verify the registry against the actual pixels.
    try {
      const meta = await sharp(absolute).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;

      if (width !== asset.width || height !== asset.height) {
        fail(
          `${id}: registry says ${asset.width}×${asset.height}, file is ${width}×${height} — ${asset.path}`,
        );
      }
      if (!ratioMatches(asset.ratio, width, height)) {
        fail(`${id}: ratio "${asset.ratio}" does not match ${width}×${height} — ${asset.path}`);
      }
    } catch (error) {
      fail(`${id}: could not read image — ${(error as Error).message}`);
    }
  }

  // ---- duplicate alt text ------------------------------------------------
  for (const [alt, ids] of altIndex) {
    if (ids.length > 1) {
      fail(`Duplicate alt text across ${ids.join(', ')}: "${alt}"`);
    }
  }

  // ---- recurring artwork must never carry a date -------------------------
  for (const series of eventSeries) {
    // No artwork ID means the poster is composed from event data, which cannot
    // contain a baked-in date by construction. Nothing to check.
    if (!series.artworkAssetId) continue;

    const artwork = assets[series.artworkAssetId as keyof typeof assets] as AssetRecord | undefined;
    if (!artwork) {
      fail(`Event series "${series.slug}" points at unknown asset "${series.artworkAssetId}".`);
      continue;
    }
    if (artwork.containsText === 'date') {
      fail(
        `Event series "${series.slug}" uses artwork tagged containsText:'date'. ` +
          'Recurring artwork can never be the authoritative date source — request an undated export.',
      );
    }
  }

  // ---- a dated flyer must declare the date it prints ---------------------
  // The flyer slot exists precisely so the restaurant's real, dated artwork can
  // be published. The trade is that the printed date must be declared, so the UI
  // can caption it and no visitor is left reconciling two dates alone.
  for (const series of eventSeries) {
    if (!series.flyerAssetId) {
      if (series.flyerPrintedDate) {
        fail(`Event series "${series.slug}" declares a printed date but has no flyer.`);
      }
      continue;
    }

    const flyer = assets[series.flyerAssetId as keyof typeof assets] as AssetRecord | undefined;
    if (!flyer) {
      fail(`Event series "${series.slug}" points at unknown flyer asset "${series.flyerAssetId}".`);
      continue;
    }
    if (flyer.containsText === 'date' && !series.flyerPrintedDate) {
      fail(
        `Event series "${series.slug}" uses a flyer tagged containsText:'date' without ` +
          '`flyerPrintedDate`. The printed date must be declared so the artwork can be captioned.',
      );
    }
  }

  // ---- orphan files ------------------------------------------------------
  if (await exists(MEDIA_DIR)) {
    const files = await walk(MEDIA_DIR);
    for (const file of files) {
      if (path.basename(file).startsWith('.')) continue;
      const publicPath = `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`;
      // Photos uploaded through the admin live in the content database, not in
      // the typed registry, and the directory is git-ignored. They are runtime
      // content — checking them against a compile-time registry would fail by
      // design.
      if (publicPath.startsWith('/media/uploads/')) continue;
      if (!claimedPaths.has(publicPath)) {
        fail(`Unregistered media file: ${publicPath} — add a registry entry or delete it.`);
      }
    }
  }

  // ---- no Wix in production code -----------------------------------------
  const sourceFiles = (await walk(SRC_DIR)).filter((f) => /\.(tsx?|css)$/.test(f));
  for (const file of sourceFiles) {
    const text = await readFile(file, 'utf8');
    const relative = path.relative(ROOT, file);
    // assets.ts records source URLs as provenance in `source.url`; that is a
    // comment-grade record, not a runtime fetch. Everything else is a real hit.
    const isRegistry = relative.endsWith(path.join('content', 'assets.ts'));
    for (const host of ['wixstatic.com', 'parastorage.com']) {
      if (!text.includes(host)) continue;
      if (isRegistry) {
        const runtime = text
          .split('\n')
          .filter((line) => line.includes(host) && !line.trimStart().startsWith('url:'));
        if (runtime.length === 0) continue;
      }
      fail(`${relative} references ${host} — production must not depend on Wix.`);
    }
  }

  // ---- report -------------------------------------------------------------
  const placeholders = entries.filter(([, a]) => a.status === 'placeholder');
  const temp = entries.filter(([, a]) => a.status === 'temp-wix');

  console.log(`\nAssets: ${entries.length} registered`);
  console.log(`  final/brand : ${entries.length - placeholders.length - temp.length}`);
  console.log(`  temp-wix    : ${temp.length}`);
  console.log(`  placeholder : ${placeholders.length}`);

  if (placeholders.length > 0) {
    console.log('\nSlots still awaiting real photography (see docs/ASSET-HANDOFF.md):');
    for (const [id, asset] of placeholders) {
      console.log(`  · ${id} — ${asset.ratio}, min ${asset.width}×${asset.height}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const warning of warnings) console.log(`  ! ${warning}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }

  console.log('\n✓ Asset registry is consistent.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
