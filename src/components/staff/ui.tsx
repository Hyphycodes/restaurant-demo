import Link from 'next/link';
import type { ReactNode } from 'react';
import { StaffIcon, type StaffIconName } from './icons';

/**
 * The staff app's primitives. Written for a phone: a screen is a title and a
 * few sections; a section is a heading and a list; a list is rows a thumb
 * can hit. State is never colour alone — every pill carries a word.
 */

export function Screen({ title, eyebrow, lead, actions, children }: { title: string; eyebrow?: string; lead?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">{eyebrow}</p> : null}
          <h1 className="display text-[clamp(1.75rem,6vw,2.5rem)] leading-none text-brown">{title}</h1>
          {lead ? <div className="mt-2 text-[0.9375rem] leading-relaxed text-brown-soft">{lead}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-6 grid gap-7">{children}</div>
    </div>
  );
}

export function Section({ title, action, children, count }: { title?: string; action?: ReactNode; children: ReactNode; count?: number }) {
  return (
    <section>
      {title || action ? (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          {title ? (
            <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">
              {title}
              {count !== undefined && count > 0 ? <span className="ml-2 tabular text-brown-soft/70">{count}</span> : null}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Panel({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'accent' | 'warning'; className?: string }) {
  const style = { default: 'staff-panel', accent: 'staff-panel border-amber/40', warning: 'staff-panel border-warning/50' }[tone];
  return <div className={`${style} px-4 py-3.5 ${className}`}>{children}</div>;
}

/** A tappable row: primary line, secondary line, something on the right. */
export function Row({ href, title, detail, meta, trailing, icon, tone }: { href?: string; title: ReactNode; detail?: ReactNode; meta?: ReactNode; trailing?: ReactNode; icon?: StaffIconName; tone?: 'default' | 'muted' }) {
  const body = (
    <>
      {icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brown/10 text-brown">
          <StaffIcon name={icon} className="size-[18px]" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[0.9375rem] font-semibold ${tone === 'muted' ? 'text-brown-soft' : 'text-brown'}`}>{title}</span>
        {detail ? <span className="mt-0.5 block text-[0.8125rem] leading-snug text-brown-soft">{detail}</span> : null}
        {meta ? <span className="mt-0.5 block text-[0.75rem] leading-snug text-brown-soft/80">{meta}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      {href ? <StaffIcon name="chevron" className="size-[16px] shrink-0 text-brown-soft/60" /> : null}
    </>
  );
  return href ? (
    <Link href={href} className="staff-row -mx-1 px-1 transition-colors active:bg-brown/6">
      {body}
    </Link>
  ) : (
    <div className="staff-row">{body}</div>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <div className="staff-panel px-4">{children}</div>;
}

const PILL: Record<string, string> = {
  neutral: 'border-brown/25 bg-brown/6 text-brown-soft',
  good: 'border-success/50 bg-success/10 text-success',
  warn: 'border-warning/55 bg-warning/10 text-warning',
  bad: 'border-danger/55 bg-danger/10 text-danger',
  accent: 'border-amber/60 bg-amber/12 text-amber',
};

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-(--radius-sm) border px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] ${PILL[tone]}`}>{children}</span>;
}

/** An empty state that sounds like a person. */
export function Empty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="staff-panel px-5 py-7 text-center">
      <p className="text-[1rem] font-semibold text-brown">{title}</p>
      {detail ? <p className="mt-1 text-[0.875rem] text-brown-soft">{detail}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({ value, label, href, tone }: { value: ReactNode; label: string; href?: string; tone?: 'warn' | 'bad' }) {
  const body = (
    <>
      <span className={`staff-figure block text-[2rem] ${tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-brown'}`}>{value}</span>
      <span className="mt-1 block text-[0.8125rem] text-brown-soft">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="staff-panel block px-4 py-3 transition-colors active:bg-brown/6">
      {body}
    </Link>
  ) : (
    <div className="staff-panel px-4 py-3">{body}</div>
  );
}

export function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dimension = { sm: 'size-8 text-[0.75rem]', md: 'size-10 text-[0.875rem]', lg: 'size-16 text-[1.25rem]' }[size];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not an optimisable asset
    <img src={url} alt="" className={`${dimension} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-amber/20 font-semibold text-amber`}>{initials || '?'}</span>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const percent = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.8125rem]">
        <span className="font-semibold text-brown">{label ?? `${value} of ${max} complete`}</span>
        <span className="tabular text-brown-soft">{percent}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brown/12">
        <div className="h-full rounded-full bg-amber transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Label: value, in a compact grid. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-brown-soft">{item.label}</dt>
          <dd className="text-brown">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-(--radius-sm) border border-warning/50 bg-warning/8 px-3 py-2 text-[0.875rem] leading-snug text-warning">
      <StaffIcon name="warning" className="mt-0.5 size-[16px]" />
      <span>{children}</span>
    </p>
  );
}

export function Button({ href, children, variant = 'secondary', small = false }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet'; small?: boolean }) {
  const style = {
    primary: 'bg-coral text-on-orange hover:bg-coral-deep',
    secondary: 'border border-brown/30 text-brown hover:bg-brown/8',
    quiet: 'text-clay underline underline-offset-4',
  }[variant];
  return (
    <Link href={href} className={`inline-flex ${small ? 'min-h-9 px-3 text-[0.875rem]' : 'min-h-11 px-4 text-[0.9375rem]'} items-center justify-center gap-1.5 rounded-(--radius-sm) font-semibold transition-colors active:translate-y-px ${style}`}>
      {children}
    </Link>
  );
}

/** Tabs under a screen title: a row of pills that scrolls. */
export function Chips({ items }: { items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <div className="staff-strip -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[0.875rem] font-semibold ${item.active ? 'bg-night-text text-teal' : 'border border-brown/25 text-brown-soft'}`}
        >
          {item.label}
          {item.count ? <span className={`tabular text-[0.75rem] ${item.active ? 'text-teal/70' : 'text-brown-soft/70'}`}>{item.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-[0.875rem] font-semibold text-brown-soft hover:text-brown">
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
