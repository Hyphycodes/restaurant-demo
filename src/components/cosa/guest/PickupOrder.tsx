'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatPrice } from '@/lib/format';

export interface PickupItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  course: string;
}

/**
 * Pickup, demonstrated. The dishes and prices are the live menu; the basket
 * and the confirmation are simulated — no payment is taken and no order is
 * placed. A real build hands the basket to the restaurant's POS or ordering
 * provider at the last step.
 */
export function PickupOrder({ items }: { items: PickupItem[] }) {
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const courses = useMemo(() => [...new Set(items.map((item) => item.course))], [items]);
  const lines = items.filter((item) => (basket[item.id] ?? 0) > 0);
  const subtotal = lines.reduce((sum, item) => sum + item.priceCents * basket[item.id]!, 0);
  const change = (id: string, delta: number) =>
    setBasket((current) => ({ ...current, [id]: Math.max(0, Math.min(9, (current[id] ?? 0) + delta)) }));

  if (done) {
    return (
      <div className="cn-finder" role="status">
        <p className="cn-eyebrow">Demo confirmation</p>
        <h2 className="cn-display cn-lg">
          Ready in <em>about 25 minutes.</em>
        </h2>
        <p className="cn-body">
          {lines.map((item) => `${basket[item.id]} × ${item.name}`).join(', ')} — {formatPrice(subtotal)}. Nothing was ordered or
          charged; Cosa Nostra is fictional.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="cn-btn cn-btn-ghost" onClick={() => { setBasket({}); setDone(false); }}>
            Start again
          </button>
          <Link href="/demo/admin" className="cn-btn">
            See the admin side <span className="cn-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cn-order">
      <div className="cn-order-menu">
        {courses.map((course) => (
          <section key={course} aria-label={course}>
            <h2 className="cn-display cn-sm">{course}</h2>
            <ul>
              {items
                .filter((item) => item.course === course)
                .map((item) => (
                  <li key={item.id}>
                    <div>
                      <p className="cn-order-name">{item.name}</p>
                      {item.description ? <p className="cn-order-desc">{item.description}</p> : null}
                    </div>
                    <span className="cn-num cn-order-price">{formatPrice(item.priceCents)}</span>
                    <div className="cn-qty" role="group" aria-label={`Quantity of ${item.name}`}>
                      <button type="button" onClick={() => change(item.id, -1)} disabled={!basket[item.id]} aria-label={`Remove one ${item.name}`}>
                        −
                      </button>
                      <span className="cn-num" aria-live="polite">{basket[item.id] ?? 0}</span>
                      <button type="button" onClick={() => change(item.id, 1)} aria-label={`Add one ${item.name}`}>
                        +
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <aside className="cn-order-bag">
        <p className="cn-eyebrow">Your bag</p>
        {lines.length === 0 ? (
          <p className="cn-body">Nothing yet. The rigatoni travels beautifully.</p>
        ) : (
          <ul>
            {lines.map((item) => (
              <li key={item.id}>
                <span>
                  {basket[item.id]} × {item.name}
                </span>
                <span className="cn-num">{formatPrice(item.priceCents * basket[item.id]!)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="cn-order-total cn-num">
          <span>Subtotal</span>
          <b>{formatPrice(subtotal)}</b>
        </p>
        <p className="cn-finder-fine">Pickup at the side door on the alley, from 4pm. Demo only — no payment is collected.</p>
        <button type="button" className="cn-btn" disabled={subtotal === 0} onClick={() => setDone(true)}>
          Place demo order <span className="cn-arrow" aria-hidden="true">→</span>
        </button>
      </aside>
    </div>
  );
}
