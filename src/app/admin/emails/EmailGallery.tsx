'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Label, Select } from '@/components/admin/ui';
import { switchFor, type EmailCategory, type EmailSwitch, type EmailSwitchId, type TemplateInfo } from '@/emails/registry';
import { setEmailSwitch } from '@/server/actions/communications';
import type { EventOption } from './sending/CommunicationsPanel';

/**
 * Every email, on one wall.
 *
 * The picker on Communications answers "show me this one". This answers
 * "show me all of them" — the same question the Link Hubs list answers for
 * hubs — so a change to the header, the footer or the palette can be seen
 * across eighteen templates without clicking eighteen times.
 *
 * Each tile is the real email: the same `/admin/emails/preview`
 * render the test send uses, fetched once and held in an iframe at email
 * width, scaled down. Nothing is rendered until it scrolls near the
 * viewport, and no more than three render at a time, because each tile is a
 * real server-side React Email render against a real event.
 */


const FRAME_WIDTH = 600;
/** How much of a tall email a tile shows before it is cut off. */
const TILE_HEIGHT = 300;
const MAX_CONCURRENT = 3;

interface Entry {
  key: string;
  template: TemplateInfo;
  variantId: string;
  variantLabel: string | null;
  /** The switch that governs this tile, where there is one. */
  toggle: EmailSwitch | null;
}

interface Rendered {
  html: string;
  subject: string;
  /** The sentence the preview route gave back instead of an email, if any. */
  error: string | null;
}

/** One tile per template, or per version where a template has versions. */
function galleryEntries(templates: TemplateInfo[]): Entry[] {
  return templates.flatMap((template) => {
    const variants = template.variants?.length ? template.variants : [{ id: '', label: '' }];
    return variants.map((variant) => ({
      key: `${template.id}:${variant.id}`,
      template,
      variantId: variant.id,
      variantLabel: variant.label || null,
      toggle: switchFor(template.id, variant.id),
    }));
  });
}

function previewUrl(entry: Entry, eventId: string, test: boolean): string {
  const params = new URLSearchParams({
    template: entry.template.id,
    variant: entry.variantId,
    event: entry.template.needsEvent ? eventId : '',
  });
  if (test) params.set('test', '1');
  return `/admin/emails/preview?${params.toString()}`;
}

/**
 * Renders are expensive and a wall of them arrives at once, so a tiny
 * semaphore keeps three in flight and a cache means scrolling back up, or
 * opening a tile large, never asks the server twice.
 *
 * Someone clicking a tile is waiting on that one email, so it goes first
 * rather than behind twenty tiles nobody is looking at yet.
 */
const cache = new Map<string, Rendered>();
let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(job: () => Promise<T>, first = false): Promise<T> {
  if (!first && active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await job();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

const pending = new Map<string, Promise<Rendered>>();

/** The rendered email for one preview URL, fetched at most once. */
function loadPreview(url: string, first = false): Promise<Rendered> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;
  const promise = fetchPreview(url, first).finally(() => pending.delete(url));
  pending.set(url, promise);
  return promise;
}

async function fetchPreview(url: string, first: boolean): Promise<Rendered> {
  const result = await withSlot(async (): Promise<Rendered> => {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html' } });
      const body = await response.text();
      if (!response.ok) return { html: '', subject: '', error: body.trim() || `The preview failed (${response.status}).` };
      const failure = response.headers.get('x-email-error');
      if (failure) return { html: '', subject: '', error: decodeURIComponent(failure) };
      return { html: body, subject: decodeURIComponent(response.headers.get('x-email-subject') ?? ''), error: null };
    } catch {
      return { html: '', subject: '', error: 'The preview could not be loaded.' };
    }
  }, first);
  cache.set(url, result);
  return result;
}

const CATEGORY_LABEL: Record<EmailCategory, string> = {
  transactional: 'Guests',
  account: 'Sign-in',
  staff: 'Staff',
};

const FILTERS: { id: 'all' | EmailCategory; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'transactional', label: 'Guests' },
  { id: 'account', label: 'Sign-in' },
  { id: 'staff', label: 'Staff' },
];

export function EmailGallery({
  templates,
  events,
  defaultTicketDirection,
  switches,
  canSwitch,
}: {
  templates: TemplateInfo[];
  events: EventOption[];
  defaultTicketDirection: string;
  /** Which optional emails are on, as the database has them right now. */
  switches: Record<EmailSwitchId, boolean>;
  /** Whether this person may change them. Everyone else sees the state, read-only. */
  canSwitch: boolean;
}) {
  const [category, setCategory] = useState<'all' | EmailCategory>('all');
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? '');
  const [test, setTest] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const entries = useMemo(() => galleryEntries(templates), [templates]);
  const shown = useMemo(
    () => entries.filter((entry) => category === 'all' || entry.template.category === category),
    [entries, category],
  );

  const openIndex = shown.findIndex((entry) => entry.key === openKey);
  const open = openIndex >= 0 ? shown[openIndex] : null;
  const step = useCallback(
    (delta: number) => {
      if (openIndex < 0 || shown.length === 0) return;
      setOpenKey(shown[(openIndex + delta + shown.length) % shown.length]!.key);
    },
    [openIndex, shown],
  );

  return (
    <div className="grid gap-5">
      <div className="admin-raised grid gap-4 rounded-(--radius-md) border border-brown/12 bg-linen p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Which emails">
            {FILTERS.map((filter) => {
              const count = filter.id === 'all' ? entries.length : entries.filter((entry) => entry.template.category === filter.id).length;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setCategory(filter.id)}
                  aria-pressed={category === filter.id}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors duration-150 ${
                    category === filter.id ? 'bg-teal text-linen' : 'text-brown-soft hover:bg-brown/8 hover:text-brown'
                  }`}
                >
                  {filter.label}
                  <span className={`tabular text-[0.75rem] ${category === filter.id ? 'text-linen/70' : 'text-brown-soft'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <label htmlFor="gallery-test" className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
            <input
              id="gallery-test"
              type="checkbox"
              checked={test}
              onChange={(event) => setTest(event.target.checked)}
              className="size-4 shrink-0 accent-[var(--color-coral)]"
            />
            <span>Show the test-send version</span>
          </label>
        </div>
        <div className="sm:max-w-md">
          <Label htmlFor="gallery-event" hint="Real artwork, name, date, time and venue. The guest and the order are stand-ins.">
            Preview ticket emails against
          </Label>
          <Select id="gallery-event" value={eventId} onChange={(event) => setEventId(event.target.value)}>
            {events.length === 0 ? <option value="">No events to choose from</option> : null}
            {events.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {eventLabel(entry)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
        {shown.map((entry) => {
          const url = previewUrl(entry, eventId, test);
          return (
            <GalleryTile
              key={`${entry.key}:${url}`}
              entry={entry}
              url={url}
              on={entry.toggle ? (switches[entry.toggle.id] ?? entry.toggle.defaultOn) : null}
              canSwitch={canSwitch}
              onOpen={() => setOpenKey(entry.key)}
            />
          );
        })}
      </div>

      {open ? (
        <PreviewDialog
          entry={open}
          url={previewUrl(open, eventId, test)}
          position={`${openIndex + 1} of ${shown.length}`}
          defaultTicketDirection={defaultTicketDirection}
          onClose={() => setOpenKey(null)}
          onStep={step}
        />
      ) : null}
    </div>
  );
}

function eventLabel(event: EventOption): string {
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(event.startsAt));
  return `${date} · ${event.title}${event.published ? '' : ' (draft)'}${event.ticketing ? '' : ' (no tickets)'}`;
}

/** The email itself, small, with its name and subject line underneath. */
function GalleryTile({ entry, url, on, canSwitch, onOpen }: { entry: Entry; url: string; on: boolean | null; canSwitch: boolean; onOpen: () => void }) {
  const [rendered, setRendered] = useState<Rendered | null>(() => cache.get(url) ?? null);
  const [near, setNear] = useState(() => cache.has(url));
  const [scale, setScale] = useState(TILE_HEIGHT / FRAME_WIDTH);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((item) => item.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || rendered) return;
    let cancelled = false;
    void loadPreview(url).then((result) => {
      if (!cancelled) setRendered(result);
    });
    return () => {
      cancelled = true;
    };
  }, [near, rendered, url]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setScale(width / FRAME_WIDTH);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const name = entry.template.name;
  return (
    <article className="admin-raised flex flex-col overflow-hidden rounded-(--radius-md) border border-brown/12 bg-linen">
      <div ref={frameRef} className="relative h-[300px] overflow-hidden border-b border-brown/12 bg-[#0d0805]">
        {rendered?.html ? (
          <iframe
            srcDoc={rendered.html}
            title={`${name} preview`}
            tabIndex={-1}
            aria-hidden="true"
            scrolling="no"
            sandbox=""
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
            style={{ width: FRAME_WIDTH, height: FRAME_WIDTH * 2.5, transform: `scale(${scale})` }}
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-[0.8125rem] leading-relaxed text-linen/70">
            {rendered?.error ?? (near ? 'Rendering…' : '')}
          </p>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 w-full cursor-zoom-in bg-transparent transition-colors duration-150 hover:bg-linen/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber"
        >
          <span className="sr-only">{`Open ${name}${entry.variantLabel ? ` — ${entry.variantLabel}` : ''} full size`}</span>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[0.9375rem] font-semibold leading-snug text-brown">{name}</h3>
          {entry.toggle ? null : <Wiring wiring={entry.template.wiring} />}
        </div>
        {entry.variantLabel ? <p className="text-[0.8125rem] font-semibold text-clay">{entry.variantLabel}</p> : null}
        <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-brown-soft">
          {rendered?.subject ? <span className="text-brown">{rendered.subject}</span> : entry.template.description}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-[0.75rem] uppercase tracking-[0.06em] text-brown-soft">{CATEGORY_LABEL[entry.template.category]}</p>
          {entry.toggle && on !== null ? <SwitchControl entry={entry.toggle} on={on} canSwitch={canSwitch} /> : <AlwaysOn wiring={entry.template.wiring} />}
        </div>
      </div>
    </article>
  );
}

/**
 * One email, large.
 *
 * A native `<dialog>`, so the browser owns the focus trap, the Escape key
 * and the inert background — the bar this admin sets for anything modal.
 */
function PreviewDialog({
  entry,
  url,
  position,
  defaultTicketDirection,
  onClose,
  onStep,
}: {
  entry: Entry;
  url: string;
  position: string;
  defaultTicketDirection: string;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rendered, setRendered] = useState<Rendered | null>(() => cache.get(url) ?? null);
  const [width, setWidth] = useState<'phone' | 'desktop'>('desktop');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRendered(cache.get(url) ?? null);
    void loadPreview(url, true).then((result) => {
      if (!cancelled) setRendered(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const isDefaultDirection = entry.template.id === 'ticket_confirmation' && entry.variantId === defaultTicketDirection;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click on the ::backdrop is dispatched to the dialog itself.
        if (event.target === ref.current) ref.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') onStep(1);
        if (event.key === 'ArrowLeft') onStep(-1);
        // Escape is the browser's job, but only while focus is in this
        // document — click into the email itself and it is the iframe's.
        if (event.key === 'Escape') {
          event.preventDefault();
          ref.current?.close();
        }
      }}
      className="h-[92dvh] w-[min(96vw,64rem)] overflow-hidden rounded-(--radius-md) border border-brown/15 bg-linen p-0 backdrop:bg-[#2a1a0d]/70"
      aria-label={`${entry.template.name} preview`}
    >
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-brown/12 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[1.0625rem] font-semibold text-brown">{entry.template.name}</h2>
              {entry.variantLabel ? <span className="text-[0.875rem] font-semibold text-clay">{entry.variantLabel}</span> : null}
              {isDefaultDirection ? <span className="rounded-full bg-brown/8 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-brown-soft">In use</span> : null}
              <Wiring wiring={entry.template.wiring} />
            </div>
            <p className="mt-1 truncate text-[0.875rem] text-brown-soft">
              <span className="font-semibold text-brown">Subject:</span> {rendered?.subject || (rendered?.error ? '—' : 'Rendering…')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onStep(-1)} aria-label="Previous email" className="inline-flex size-11 items-center justify-center rounded-full text-brown-soft hover:bg-brown/8 hover:text-brown">
              ←
            </button>
            <span className="tabular px-1 text-[0.8125rem] text-brown-soft">{position}</span>
            <button type="button" onClick={() => onStep(1)} aria-label="Next email" className="inline-flex size-11 items-center justify-center rounded-full text-brown-soft hover:bg-brown/8 hover:text-brown">
              →
            </button>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close preview" className="ml-1 inline-flex size-11 items-center justify-center rounded-full text-brown-soft hover:bg-brown/8 hover:text-brown">
              ✕
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-brown/12 px-4 py-2 text-[0.8125rem]">
          <button type="button" onClick={() => setWidth('phone')} className={`min-h-10 rounded-full px-3 font-semibold ${width === 'phone' ? 'bg-teal text-linen' : 'text-brown-soft hover:bg-brown/8'}`}>
            Phone
          </button>
          <button type="button" onClick={() => setWidth('desktop')} className={`min-h-10 rounded-full px-3 font-semibold ${width === 'desktop' ? 'bg-teal text-linen' : 'text-brown-soft hover:bg-brown/8'}`}>
            Desktop
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="ml-auto min-h-10 text-clay underline underline-offset-4">
            Open in a tab ↗
          </a>
          <a href={`${url}&format=text`} target="_blank" rel="noreferrer" className="min-h-10 text-clay underline underline-offset-4">
            Plain text ↗
          </a>
        </div>

        <div className="min-h-0 flex-1 bg-[#0d0805] p-3">
          {rendered?.html ? (
            <iframe
              key={url}
              srcDoc={rendered.html}
              title={`${entry.template.name} preview`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className={`mx-auto block h-full w-full border-0 bg-[#0d0805] ${width === 'phone' ? 'max-w-[390px]' : ''}`}
            />
          ) : (
            <p className="grid h-full place-items-center px-6 text-center text-[0.875rem] leading-relaxed text-linen/70">{rendered?.error ?? 'Rendering…'}</p>
          )}
        </div>

        <footer className="border-t border-brown/12 px-4 py-3">
          <p className="text-[0.8125rem] leading-relaxed text-brown-soft">
            <span className="font-semibold text-brown">What sends it:</span> {entry.template.trigger}
          </p>
        </footer>
      </div>
    </dialog>
  );
}

function Wiring({ wiring }: { wiring: TemplateInfo['wiring'] }) {
  const style = {
    live: ['border-success/40 bg-success/10 text-success', 'Wired'],
    manual: ['border-brown/30 bg-brown/8 text-brown', 'On request'],
    template: ['border-brown/30 bg-brown/8 text-brown-soft', 'Template only'],
    off: ['border-warning/50 bg-warning/10 text-warning', 'Built, off'],
  }[wiring];
  return <span className={`inline-flex shrink-0 items-center rounded-(--radius-sm) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${style[0]}`}>{style[1]}</span>;
}

/**
 * The on/off switch for one optional email.
 *
 * It flips immediately and puts itself back if the server refuses, because
 * the alternative — a spinner on a checkbox — reads as broken on a phone
 * behind the bar. The sentence underneath says what being on actually
 * causes, so nobody has to remember what "Schedule published" means.
 */
function SwitchControl({ entry, on, canSwitch }: { entry: EmailSwitch; on: boolean; canSwitch: boolean }) {
  const [state, setState] = useState(on);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canSwitch) {
    return (
      <span className={`inline-flex shrink-0 items-center rounded-(--radius-sm) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${state ? 'border-success/40 bg-success/10 text-success' : 'border-brown/30 bg-brown/8 text-brown-soft'}`}>
        {state ? 'On' : 'Off'}
      </span>
    );
  }

  function flip() {
    const next = !state;
    setState(next);
    setProblem(null);
    start(async () => {
      const data = new FormData();
      data.set('id', entry.id);
      data.set('on', String(next));
      const result = await setEmailSwitch({ ok: true, message: '' }, data);
      if (!result.ok) {
        setState(!next);
        setProblem(result.message);
      }
    });
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={state}
        aria-label={`${entry.label}: ${entry.detail}`}
        title={entry.detail}
        disabled={pending}
        onClick={flip}
        className="group inline-flex min-h-11 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-brown-soft"
      >
        <span className={state ? 'text-success' : 'text-brown-soft'}>{state ? 'On' : 'Off'}</span>
        <span className={`relative inline-block h-5 w-9 rounded-full transition-colors duration-150 ${state ? 'bg-success/70' : 'bg-brown/25'} ${pending ? 'opacity-60' : ''}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-linen shadow-sm transition-all duration-150 ${state ? 'left-[1.125rem]' : 'left-0.5'}`} />
        </span>
      </button>
      {problem ? <span className="max-w-[12rem] text-right text-[0.6875rem] leading-snug text-danger">{problem}</span> : null}
    </span>
  );
}

/** What the tiles without a switch say instead: this one is not optional. */
function AlwaysOn({ wiring }: { wiring: TemplateInfo['wiring'] }) {
  if (wiring === 'template') return <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-brown-soft">Not sent yet</span>;
  return (
    <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-brown-soft" title="Somebody is owed this one — a ticket, a refund, a change or a sign-in link — so it has no switch.">
      Always on
    </span>
  );
}
