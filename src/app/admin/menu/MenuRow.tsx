'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, MoveButton } from '@/components/admin/ActionForm';
import { QuietSave, SaveMark } from '@/components/admin/QuietSave';
import { StateChip } from '@/components/admin/ui';
import { moveRow, setAvailability, setPrice } from '@/server/actions/menu';
import { AVAILABILITY_LABEL, PRICE_MODE_LABEL } from '@/content/labels';
import type { AdminMenuItem } from '@/content/admin-types';

/**
 * One dish, in the list.
 *
 * Price and availability are edited here, not behind an "edit" screen, because
 * they are what actually changes during service and every extra tap is a reason
 * to do it later — or on a paper menu instead. Everything longer-form is one
 * link away.
 *
 * Neither control has a Save button any more. Marking something sold out was
 * previously choose-then-press, and the press is the half that gets lost when a
 * server is doing this one-handed between tables — the list would look right and
 * the website would still be selling the dish. Now the choice is the save: the
 * dropdown saves the moment it changes, the price saves when you tap away, and
 * the row says so before you leave it.
 *
 * The row wraps rather than scrolls: at 390px the price control sits under the
 * name instead of pushing the row off the side of the screen.
 */
export function MenuRow({
  item,
  siblings,
  canPublish,
}: {
  item: AdminMenuItem;
  /** Ids in display order, so a move is unambiguous. */
  siblings: string[];
  canPublish: boolean;
}) {
  const dimmed = item.availability === 'hidden' ? 'opacity-60' : '';
  const [priceDirty, setPriceDirty] = useState(false);
  const [priceSaves, setPriceSaves] = useState(0);
  const [availabilitySaves, setAvailabilitySaves] = useState(0);

  return (
    <li
      className={`rounded-(--radius-sm) border-b border-brown/12 px-1 py-3 transition-colors last:border-b-0 hover:bg-brown/4 ${dimmed}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-52">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              href={`/admin/menu/${item.id}`}
              className="text-[0.9375rem] font-semibold text-brown underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
            >
              {item.name}
            </Link>
            {item.state !== 'published' ? <StateChip state={item.state} /> : null}
            {item.dietary.map((tag) => (
              <span
                key={tag}
                className="rounded-(--radius-sm) border border-brown/20 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.06em] text-brown-soft"
              >
                {tag}
              </span>
            ))}
          </div>
          {item.availability === 'unavailable' ? (
            <p className="mt-0.5 text-[0.8125rem] text-warning">
              Sold out — guests see it greyed out
            </p>
          ) : null}
          {item.availability === 'hidden' ? (
            <p className="mt-0.5 text-[0.8125rem] text-brown-soft">Hidden from guests</p>
          ) : null}
        </div>

        {/* Price. Saves when you tap away from it. */}
        <QuietSave action={setPrice} className="flex shrink-0 items-center gap-1.5">
          {({ save, state, pending }) => (
            <>
              <input type="hidden" name="id" value={item.id} />
              <label className="sr-only" htmlFor={`mode-${item.id}`}>
                Price type for {item.name}
              </label>
              <select
                id={`mode-${item.id}`}
                name="mode"
                defaultValue={item.priceMode}
                onChange={() => {
                  setPriceDirty(false);
                  setPriceSaves((count) => count + 1);
                  save();
                }}
                className="min-h-11 rounded-(--radius-sm) border border-brown/25 bg-linen px-2 text-[0.8125rem] text-brown transition-colors hover:border-brown/45"
              >
                {Object.entries(PRICE_MODE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`price-${item.id}`}>
                Price for {item.name}
              </label>
              <input
                id={`price-${item.id}`}
                name="amount"
                inputMode="decimal"
                defaultValue={item.priceCents != null ? String(item.priceCents / 100) : ''}
                placeholder="16"
                aria-describedby={`price-help-${item.id}`}
                onChange={() => setPriceDirty(true)}
                onBlur={() => {
                  if (!priceDirty) return;
                  setPriceDirty(false);
                  setPriceSaves((count) => count + 1);
                  save();
                }}
                className="tabular min-h-11 w-20 rounded-(--radius-sm) border border-brown/25 bg-linen px-2 text-[0.9375rem] text-brown transition-colors hover:border-brown/45"
              />
              <span id={`price-help-${item.id}`} className="sr-only">
                Numbers only, for example 16 or 16.50. It saves on its own when you leave the box.
              </span>
              <SaveMark
                pending={pending}
                saved={state.ok ? priceSaves : 0}
                unsaved={priceDirty && !pending}
                error={state.ok ? undefined : state.message}
              />
            </>
          )}
        </QuietSave>

        {/* Availability. The most-used control in the admin, and now one tap. */}
        <QuietSave action={setAvailability} className="flex shrink-0 items-center gap-1.5">
          {({ save, state, pending }) => (
            <>
              <input type="hidden" name="id" value={item.id} />
              <label className="sr-only" htmlFor={`avail-${item.id}`}>
                Availability for {item.name}
              </label>
              <select
                id={`avail-${item.id}`}
                name="availability"
                defaultValue={item.availability}
                onChange={() => {
                  setAvailabilitySaves((count) => count + 1);
                  save();
                }}
                className="min-h-11 min-w-40 rounded-(--radius-sm) border border-brown/25 bg-linen px-3 text-[0.8125rem] text-brown transition-colors hover:border-brown/45"
              >
                {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <SaveMark
                pending={pending}
                saved={state.ok ? availabilitySaves : 0}
                unsaved={false}
                error={state.ok ? undefined : state.message}
              />
            </>
          )}
        </QuietSave>

        {canPublish ? (
          <div className="flex shrink-0 items-center gap-1">
            <ActionForm action={moveRow} quiet>
              <input type="hidden" name="table" value="menu_items" />
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="direction" value="up" />
              <input type="hidden" name="siblings" value={siblings.join(',')} />
              <MoveButton direction="up" label={`Move ${item.name} up`} />
            </ActionForm>
            <ActionForm action={moveRow} quiet>
              <input type="hidden" name="table" value="menu_items" />
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="direction" value="down" />
              <input type="hidden" name="siblings" value={siblings.join(',')} />
              <MoveButton direction="down" label={`Move ${item.name} down`} />
            </ActionForm>
          </div>
        ) : null}
      </div>
    </li>
  );
}
