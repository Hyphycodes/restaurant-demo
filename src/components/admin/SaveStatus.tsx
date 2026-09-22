'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * One place where the admin says "saved".
 *
 * Every form used to grow its own confirmation banner and keep it. Change six
 * prices and the screen filled with six green boxes that pushed the next row
 * further down the page — the layout moving under your thumb is worse than no
 * confirmation at all. So there is exactly one indicator for the whole screen:
 * it sits over the page rather than in it, says what was saved, and takes
 * itself away.
 *
 * Failures are deliberately NOT sent here. A message that disappears is no use
 * when something needs fixing, and the fix is at the form, not at the bottom of
 * the window — so a form that fails keeps its own message, next to the fields.
 */

export interface SaveNote {
  tone: 'busy' | 'ok';
  message: string;
  /** Public routes the change altered, so one of them can be offered as a link. */
  affected?: string[];
}

type Announce = (note: SaveNote | null) => void;

const SaveStatusContext = createContext<Announce | null>(null);

/**
 * Null outside the admin shell — the sign-in page has no shell, and a form there
 * falls back to showing its own message.
 */
export function useSaveStatus(): Announce | null {
  return useContext(SaveStatusContext);
}

/** How long a confirmation stays before it takes itself away. */
const LINGER_MS = 3200;

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<SaveNote | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((next) => {
    if (timer.current) clearTimeout(timer.current);
    setNote(next);
    // "Saving…" stays until the result replaces it; a result clears itself.
    if (next && next.tone === 'ok') {
      timer.current = setTimeout(() => setNote(null), LINGER_MS);
    }
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <SaveStatusContext.Provider value={announce}>
      {children}

      {/* The live region is always in the DOM. Mounting it with the message
          would leave a screen reader with nothing to announce. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
        <div role="status" aria-live="polite" className="max-w-full empty:hidden">
          {note ? <Pill note={note} /> : null}
        </div>
      </div>
    </SaveStatusContext.Provider>
  );
}

function Pill({ note }: { note: SaveNote }) {
  const route = preferredRoute(note.affected);

  return (
    <div className="admin-rise pointer-events-auto flex max-w-[min(34rem,100%)] items-center gap-2.5 rounded-full border border-linen/15 bg-teal py-2.5 pl-4 pr-4 text-linen shadow-[0_16px_40px_rgba(10,48,43,0.35)]">
      {note.tone === 'busy' ? (
        <span
          aria-hidden="true"
          className="admin-spin size-4 shrink-0 rounded-full border-2 border-linen/25 border-t-amber"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber text-[0.75rem] font-bold text-teal"
        >
          ✓
        </span>
      )}

      <p className="min-w-0 truncate text-[0.875rem] font-medium">{note.message}</p>

      {note.tone === 'ok' && route ? (
        <Link
          href={route}
          target="_blank"
          className="shrink-0 whitespace-nowrap border-l border-linen/20 pl-3 text-[0.8125rem] font-semibold text-amber underline underline-offset-4"
        >
          See it ↗
        </Link>
      ) : null}
    </div>
  );
}

/**
 * One link, not a list of six.
 *
 * A change to the phone number touches every page on the website; printing all
 * of them is a wall of routes nobody reads. The homepage is the one people mean
 * when they say "does it look right".
 */
function preferredRoute(affected: string[] | undefined): string | null {
  if (!affected?.length) return null;
  return affected.includes('/') ? '/' : (affected[0] ?? null);
}
