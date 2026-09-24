'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const TZ = 'America/Chicago';
const TIMES = ['5:00', '5:30', '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00'];
const SEATING = [
  { id: 'dining', label: 'Dining room', note: 'Candlelit tables, the full menu' },
  { id: 'bar', label: 'At the bar', note: 'Walk-in friendly, first come' },
  { id: 'booth', label: 'Back room booth', note: 'Parties of 4–6' },
];
const OCCASIONS = ['Just dinner', 'Birthday', 'Anniversary', 'Date night', 'Business', 'Celebration'];

/** Stable pseudo-availability, so the same night always looks the same. */
function availability(dayKey: string, size: number, time: string): 'open' | 'few' | 'full' {
  let hash = 7;
  for (const ch of `${dayKey}${size}${time}`) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const roll = Math.abs(hash) % 10;
  const prime = time === '7:00' || time === '7:30' || time === '8:00';
  if (roll < (prime ? 4 : 2)) return 'full';
  if (roll < (prime ? 6 : 3)) return 'few';
  return 'open';
}

function days(count: number) {
  const out: { key: string; weekday: string; day: string; month: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getTime() + i * 86400000);
    out.push({
      key: date.toLocaleDateString('en-CA', { timeZone: TZ }),
      weekday: i === 0 ? 'Tonight' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }),
      day: date.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ }),
      month: date.toLocaleDateString('en-US', { month: 'short', timeZone: TZ }),
    });
  }
  return out;
}

export function TableFinder() {
  const dates = useMemo(() => days(14), []);
  const [size, setSize] = useState(2);
  const [day, setDay] = useState(dates[0]!.key);
  const [time, setTime] = useState<string | null>(null);
  const [seating, setSeating] = useState('dining');
  const [step, setStep] = useState<'find' | 'details' | 'done'>('find');
  const [name, setName] = useState('Jamie Morgan');
  const [occasion, setOccasion] = useState('Just dinner');
  const chosenDay = dates.find((entry) => entry.key === day)!;
  const reference = useMemo(() => `CN-${day.replaceAll('-', '').slice(4)}-${(time ?? '').replace(':', '')}${size}`, [day, time, size]);

  if (step === 'done') {
    return (
      <div className="cn-finder cn-finder-done" role="status">
        <p className="cn-eyebrow">Demo confirmation · {reference}</p>
        <h2 className="cn-display cn-lg mt-4">
          Your table is <em>waiting.</em>
        </h2>
        <dl className="cn-finder-summary cn-num">
          <div>
            <dt className="cn-eyebrow">When</dt>
            <dd>
              {chosenDay.weekday} {chosenDay.month} {chosenDay.day} · {time} pm
            </dd>
          </div>
          <div>
            <dt className="cn-eyebrow">Party</dt>
            <dd>
              {size} {size === 1 ? 'guest' : 'guests'} · {SEATING.find((entry) => entry.id === seating)?.label}
            </dd>
          </div>
          <div>
            <dt className="cn-eyebrow">Name</dt>
            <dd>
              {name} · {occasion}
            </dd>
          </div>
        </dl>
        <p className="cn-body mt-6">
          Nothing was booked and nothing was sent — Casa Aurelia is a fictional supper club. In a live build this step hands off to
          the restaurant&apos;s reservation provider and the confirmation arrives by text and email.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="cn-btn cn-btn-ghost" onClick={() => setStep('find')}>
            Find another table
          </button>
          <Link href="/events" className="cn-btn">
            See what&apos;s on that night <span className="cn-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'details') {
    return (
      <form
        className="cn-finder"
        onSubmit={(event) => {
          event.preventDefault();
          setStep('done');
        }}
      >
        <button type="button" className="cn-link" onClick={() => setStep('find')}>
          ← {chosenDay.weekday} {chosenDay.month} {chosenDay.day} · {time} pm · {size} guests
        </button>
        <h2 className="cn-display cn-md mt-4">
          Who is the table <em>for?</em>
        </h2>
        <div className="cn-finder-fields">
          <label>
            <span className="cn-eyebrow">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoComplete="off" />
          </label>
          <label>
            <span className="cn-eyebrow">Phone</span>
            <input defaultValue="(312) 555-0142" required maxLength={20} inputMode="tel" autoComplete="off" />
          </label>
          <label>
            <span className="cn-eyebrow">Occasion</span>
            <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
              {OCCASIONS.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <label className="cn-finder-wide">
            <span className="cn-eyebrow">Anything we should know</span>
            <textarea rows={3} maxLength={300} placeholder="Allergies, a surprise, a favourite table…" />
          </label>
        </div>
        <p className="cn-finder-fine">Demo only — use sample details. No booking, message or payment is made.</p>
        <button className="cn-btn mt-6">
          Hold this table <span className="cn-arrow" aria-hidden="true">→</span>
        </button>
      </form>
    );
  }

  return (
    <div className="cn-finder">
      <fieldset>
        <legend className="cn-eyebrow">How many</legend>
        <div className="cn-finder-chips">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button key={n} type="button" aria-pressed={size === n} onClick={() => { setSize(n); setTime(null); }}>
              {n}
            </button>
          ))}
          <Link href="/private-events" className="cn-finder-more">
            9+ → private dining
          </Link>
        </div>
      </fieldset>

      <fieldset>
        <legend className="cn-eyebrow">Which night</legend>
        <div className="cn-finder-days">
          {dates.map((entry) => (
            <button key={entry.key} type="button" aria-pressed={day === entry.key} onClick={() => { setDay(entry.key); setTime(null); }}>
              <small>{entry.weekday}</small>
              <b className="cn-num">{entry.day}</b>
              <small>{entry.month}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="cn-eyebrow">What time</legend>
        <div className="cn-finder-times">
          {TIMES.map((slot) => {
            const state = availability(day, size, slot);
            return (
              <button
                key={slot}
                type="button"
                disabled={state === 'full'}
                aria-pressed={time === slot}
                data-state={state}
                onClick={() => setTime(slot)}
              >
                <span className="cn-num">{slot} pm</span>
                <small>{state === 'full' ? 'Booked' : state === 'few' ? 'Last tables' : 'Available'}</small>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="cn-eyebrow">Where</legend>
        <div className="cn-finder-seating">
          {SEATING.map((entry) => (
            <button key={entry.id} type="button" aria-pressed={seating === entry.id} onClick={() => setSeating(entry.id)}>
              <b>{entry.label}</b>
              <small>{entry.note}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="cn-finder-bar">
        <p className="cn-num">
          {size} {size === 1 ? 'guest' : 'guests'} · {chosenDay.weekday} {chosenDay.month} {chosenDay.day}
          {time ? ` · ${time} pm` : ' · choose a time'}
        </p>
        <button type="button" className="cn-btn" disabled={!time} onClick={() => setStep('details')}>
          Continue <span className="cn-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
