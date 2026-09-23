import Link from 'next/link';
import type { ReactNode } from 'react';
import type { EditorialState } from '@/content/admin-types';
import { NavIcon, type NavIconName } from './icons';

/**
 * Admin primitives.
 *
 * The same tokens as the public site, arranged for density rather than drama.
 * Three rules run through all of them:
 *
 *   - state is never colour alone; every chip carries a word;
 *   - touch targets are 44px, because most of this is used on a phone
 *     mid-service;
 *   - nothing is a modal unless focus can be managed properly, so panels are
 *     ordinary page sections and disclosures.
 */

export function Card({
  title,
  action,
  children,
  tone = 'default',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'quiet';
}) {
  return (
    <section
      className={`admin-raised rounded-(--radius-md) border border-brown/12 ${
        tone === 'quiet' ? 'bg-ivory' : 'bg-linen'
      } p-4 sm:p-5`}
    >
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-[1.0625rem] font-semibold text-brown">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A link that looks and behaves like a button.
 *
 * It exists because the same forty-character class string was being retyped on
 * every "Back to the menu" and "View on the website" across a dozen screens,
 * and they had already drifted apart in height and weight. One control, so a
 * secondary action is the same size everywhere and the thumb learns where it is.
 */
export function LinkButton({
  href,
  children,
  variant = 'secondary',
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'quiet';
  /** Opens in a new tab and gets the ↗ mark: you are leaving the admin. */
  external?: boolean;
}) {
  const style = {
    primary:
      'bg-coral text-on-orange shadow-[0_6px_16px_rgba(225,85,58,0.22)] hover:bg-coral-deep hover:text-linen',
    secondary: 'border border-brown/25 bg-linen text-brown hover:border-brown/45 hover:bg-brown/6',
    quiet: 'text-clay underline underline-offset-4 hover:text-coral-deep',
  }[variant];

  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-sm) px-4 text-[0.9375rem] font-semibold transition-all duration-150 active:translate-y-px ${style}`}
    >
      {children}
      {external ? <span aria-hidden="true">↗</span> : null}
    </Link>
  );
}

/**
 * One row of tabs, used for every "which list am I looking at" on every screen.
 *
 * Tabs were previously drawn three different ways in three places — coral pills
 * on the menu, teal pills on events, a bordered group on the dashboard. Someone
 * who has learned one screen should not have to re-learn the control on the
 * next.
 */
export function Tabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; active: boolean; count?: number }[];
}) {
  return (
    // `min-w-0`: the list below scrolls sideways, but without this the
    // scroll container still reports its max-content width to a grid or flex
    // parent and takes the whole screen wider than the phone.
    <nav aria-label={label} className="-mx-1 min-w-0">
      <ul className="flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-semibold transition-colors duration-150 ${
                item.active
                  ? 'bg-brown text-ivory'
                  : 'text-brown-soft hover:bg-brown/8 hover:text-brown'
              }`}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 ? (
                <span
                  className={`tabular inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.75rem] ${
                    item.active ? 'bg-ivory/20 text-ivory' : 'bg-brown/10 text-brown-soft'
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Guidance, not a problem.
 *
 * `Notice` shouts — a coloured border and a coloured word — and it should, when
 * something is actually wrong. Most of what used to be a `Notice tone="info"`
 * was not wrong at all: it was a sentence explaining where else a thing can be
 * changed. Those read as alarms stacked three high down the side of a page, so
 * they get their own quiet treatment instead.
 */
export function HelpNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-(--radius-md) bg-brown/5 px-4 py-3 text-[0.875rem] leading-relaxed text-brown-soft">
      {children}
    </p>
  );
}

/**
 * A single quiet strip summarising things that want doing, with one way in.
 *
 * The alternative — and what several screens did — is one full-width coloured
 * banner per problem, so a library with two unrelated issues opened with two
 * alarms before any content. One line, one link.
 */
export function SummaryStrip({
  children,
  action,
  tone = 'info',
}: {
  children: ReactNode;
  action?: ReactNode;
  tone?: 'info' | 'warning';
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-(--radius-md) border px-4 py-2.5 text-[0.875rem] ${
        tone === 'warning'
          ? 'border-warning/35 bg-warning/6 text-brown'
          : 'border-brown/15 bg-brown/4 text-brown'
      }`}
    >
      <p className="min-w-0">{children}</p>
      {action}
    </div>
  );
}

const STATE_STYLE: Record<EditorialState, { chip: string; label: string }> = {
  published: { chip: 'border-success/40 bg-success/10 text-success', label: 'Live' },
  changed: { chip: 'border-warning/50 bg-warning/10 text-warning', label: 'Draft waiting' },
  draft: { chip: 'border-brown/30 bg-brown/8 text-brown-soft', label: 'Draft' },
  archived: { chip: 'border-brown/25 bg-brown/5 text-brown-soft', label: 'Off the website' },
};

/** State, always as a word. Colour is the second signal, never the only one. */
export function StateChip({ state }: { state: EditorialState }) {
  const style = STATE_STYLE[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-(--radius-sm) border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${style.chip}`}
    >
      {style.label}
    </span>
  );
}

export function Notice({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: ReactNode;
  action?: ReactNode;
}) {
  const style = {
    info: 'border-brown/25 bg-brown/5 text-brown',
    warning: 'border-warning/60 bg-warning/8 text-warning',
    danger: 'border-danger/60 bg-danger/8 text-danger',
    success: 'border-success/60 bg-success/8 text-success',
  }[tone];

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-(--radius-md) border px-4 py-3 text-[0.9375rem] leading-relaxed ${style}`}
    >
      <p className="min-w-0">{children}</p>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-(--radius-md) border border-dashed border-brown/25 px-5 py-8 text-center text-[0.9375rem] text-brown-soft">
      {children}
    </p>
  );
}

/**
 * A big, obvious thing to do. The dashboard is made of these.
 *
 * They used to be numbered 1 to 4, which read as a sequence — as though the menu
 * could not be changed until an event had been added. They are four unrelated
 * errands, so each one carries its section's own picture instead, the same one
 * it has in the navigation.
 */
export function TaskLink({
  href,
  title,
  hint,
  icon,
}: {
  href: string;
  title: string;
  /** Optional. The label is usually enough. */
  hint?: string;
  icon: NavIconName;
}) {
  return (
    <Link
      href={href}
      className="admin-raised group flex min-h-14 items-center gap-3 rounded-(--radius-md) border border-brown/12 bg-linen px-4 py-3 transition-colors duration-150 hover:border-brown/30"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brown/8 text-brown">
        <NavIcon name={icon} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-brown">{title}</span>
        {hint ? <span className="mt-0.5 block text-[0.8125rem] leading-snug text-brown-soft">{hint}</span> : null}
      </span>
    </Link>
  );
}

export function Label({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode;
  hint?: string;
  htmlFor: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-[0.875rem] font-semibold text-brown">{children}</span>
      {hint ? <span className="mt-0.5 block text-[0.8125rem] text-brown-soft">{hint}</span> : null}
    </label>
  );
}

const FIELD =
  'mt-1.5 block min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-linen px-3 py-2 text-[0.9375rem] text-brown placeholder:text-brown-soft/60 focus:border-clay';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD} ${props.className ?? ''}`} />;
}

export function Checkbox({
  id,
  name,
  defaultChecked,
  children,
}: {
  id: string;
  name: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown">
      <input
        id={id}
        name={name}
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        className="size-4 shrink-0 accent-[var(--color-coral)]"
      />
      {children}
    </label>
  );
}

/** Field-level help and errors, associated with their control by id. */
export function FieldNote({ id, tone, children }: { id: string; tone?: 'error'; children: ReactNode }) {
  return (
    <p
      id={id}
      className={`mt-1.5 text-[0.8125rem] ${tone === 'error' ? 'font-medium text-danger' : 'text-brown-soft'}`}
    >
      {children}
    </p>
  );
}
