'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DoorSearch, type SearchMatch } from '@/components/admin/DoorSearch';
import { normalizeCode } from '@/lib/ticketing/codes';
import { tokenFromScan } from '@/lib/tickets/link';
import {
  dequeue,
  enqueue,
  loadManifest,
  queued,
  clearEvent,
  saveManifest,
  sha256Hex,
  type CachedManifest,
  type CachedTicket,
} from '@/lib/tickets/scan-cache';

/**
 * The door scanner.
 *
 * One phone, one staff member, bad wifi, a queue, dim light. So: the camera
 * starts on a tap, never on load; the verdict is the whole screen in one
 * colour, readable at arm's length, gone again after two seconds without a
 * tap; sound and a buzz say more than the screen does in a loud room; and if
 * the server is slow or gone, the ticket set cached on load answers instead
 * and the check-in is queued for later.
 */

type Verdict =
  | { kind: 'green'; title: string; detail: string; offline?: boolean }
  | { kind: 'amber'; title: string; detail: string; ticketId: string | null; offline?: boolean }
  | { kind: 'red'; title: string; detail: string; offline?: boolean };

interface ScanReply {
  ok: boolean;
  result: 'ok' | 'duplicate' | 'invalid' | 'wrong_event' | 'void' | 'refunded' | 'not_found' | 'override';
  reason: string;
  ticket: {
    id: string;
    code: string;
    tierName: string;
    seats: number;
    attendeeName: string | null;
    orderNumber: string;
    orderTickets: { id: string; status: string }[];
    checkedInAt: string | null;
    checkedInBy: string | null;
  } | null;
  counts: { checkedIn: number; total: number };
}

const TIMEOUT_MS = 2500;
const RESULT_MS = 2000;
const REPEAT_MS = 3000;

function timeOf(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)).toLowerCase();
}

export function Scanner({
  eventId,
  eventTitle,
  deviceLabel: fallbackLabel,
  canOverride,
}: {
  eventId: string;
  eventTitle: string;
  deviceLabel: string;
  /** Managers only: overrides and checking somebody in from search. */
  canOverride: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const lastSeen = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const busy = useRef(false);

  const [phase, setPhase] = useState<'idle' | 'starting' | 'scanning' | 'failed'>('idle');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [counts, setCounts] = useState<{ checkedIn: number; total: number } | null>(null);
  const [manifest, setManifest] = useState<CachedManifest | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [muted, setMuted] = useState(false);
  const [manual, setManual] = useState('');
  const [searching, setSearching] = useState(false);
  const [torch, setTorch] = useState<'off' | 'on' | 'unsupported'>('unsupported');
  // "Main door — Carlos's phone". Set once per device, kept locally, attached to
  // every check-in so a disputed scan can be traced to a phone.
  const [device, setDevice] = useState(fallbackLabel);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('casa-aurelia-door-device');
      if (saved) setDevice(saved);
    } catch {
      // Private mode, or storage blocked. The staff name is a fine fallback.
    }
  }, []);

  const nameThisDevice = useCallback(() => {
    const answer = window.prompt('What should this phone be called at the door?', device);
    const next = answer?.trim();
    if (!next) return;
    setDevice(next);
    try {
      window.localStorage.setItem('casa-aurelia-door-device', next);
    } catch {
      // Not fatal: the label just will not survive a reload.
    }
  }, [device]);

  /* ------------------------------------------------------------ cache -- */

  const refreshManifest = useCallback(async () => {
    try {
      const response = await fetch(`/api/scan/manifest?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { manifest: CachedManifest; counts: { checkedIn: number; total: number } };
      await saveManifest(data.manifest);
      setManifest(data.manifest);
      setCounts(data.counts);
      setOnline(true);
    } catch {
      const cached = await loadManifest(eventId);
      if (!cached) setCounts((current) => current ?? { checkedIn: 0, total: 0 });
      if (cached) {
        setManifest(cached);
        setCounts({
          checkedIn: cached.tickets.filter((ticket) => ticket.status === 'checked_in').length,
          total: cached.tickets.filter((ticket) => ticket.status === 'valid' || ticket.status === 'checked_in').length,
        });
      }
      setOnline(false);
    }
  }, [eventId]);

  const flush = useCallback(async () => {
    const items = await queued();
    setPending(items.length);
    for (const item of items) {
      if (item.eventId !== eventId) continue;
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId, token: item.token, code: item.code, deviceLabel: item.deviceLabel, scannedAt: item.scannedAt }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok && response.status !== 400) throw new Error(String(response.status));
        // A duplicate found on flush is logged server-side; it is not an error here.
        await dequeue(item.key);
        setPending((n) => Math.max(0, n - 1));
      } catch {
        return; // still offline; try again on the next signal
      }
    }
    void refreshManifest();
  }, [eventId, refreshManifest]);

  useEffect(() => {
    void refreshManifest();
    void flush();
    const up = () => { setOnline(true); void flush(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const id = window.setInterval(() => { if (navigator.onLine) void flush(); }, 30_000);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.clearInterval(id);
    };
  }, [refreshManifest, flush]);

  /* ---------------------------------------------------------- feedback -- */

  const feedback = useCallback((kind: Verdict['kind']) => {
    if (navigator.vibrate) navigator.vibrate(kind === 'green' ? 60 : kind === 'amber' ? [40, 60, 40] : [120, 60, 120]);
    if (mutedRef.current) return;
    try {
      const context = new AudioContext();
      const tones = kind === 'green' ? [[880, 0], [1320, 0.12]] : kind === 'amber' ? [[660, 0], [660, 0.18]] : [[220, 0], [180, 0.2]];
      for (const [frequency, at] of tones) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency!;
        gain.gain.setValueAtTime(0.0001, context.currentTime + at!);
        gain.gain.exponentialRampToValueAtTime(0.4, context.currentTime + at! + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at! + 0.16);
        osc.connect(gain).connect(context.destination);
        osc.start(context.currentTime + at!);
        osc.stop(context.currentTime + at! + 0.2);
      }
      window.setTimeout(() => void context.close(), 600);
    } catch {
      // No audio, no problem.
    }
  }, []);

  const show = useCallback((next: Verdict) => {
    setVerdict(next);
    feedback(next.kind);
    window.setTimeout(() => setVerdict((current) => (current === next ? null : current)), next.kind === 'amber' ? RESULT_MS * 2 : RESULT_MS);
  }, [feedback]);

  /* ------------------------------------------------------------- scan -- */

  const decideOffline = useCallback(async (raw: string): Promise<Verdict> => {
    if (!manifest) return { kind: 'red', title: 'Not valid here', detail: 'No connection and no ticket list yet.' };
    const scanned = tokenFromScan(raw);
    const isToken = scanned !== null;
    const hash = await sha256Hex(isToken ? scanned : normalizeCode(raw));
    const ticket: CachedTicket | undefined = manifest.tickets.find((entry) => (isToken ? entry.tokenHash : entry.codeHash) === hash);
    if (!ticket) return { kind: 'red', title: 'Not valid here', detail: 'Unrecognised code.' };
    if (ticket.status === 'void' || ticket.status === 'refunded') return { kind: 'red', title: 'Not valid here', detail: 'This ticket was cancelled or refunded.' };
    if (ticket.status === 'checked_in') return { kind: 'amber', title: 'Already scanned', detail: `${ticket.tierName} · ${ticket.attendeeName ?? ticket.orderNumber}`, ticketId: ticket.id, offline: true };
    ticket.status = 'checked_in';
    await saveManifest(manifest);
    await enqueue({
      key: `${eventId}:${ticket.id}:${Date.now()}`,
      eventId,
      ...(isToken ? { token: scanned } : { code: normalizeCode(raw) }),
      ticketId: ticket.id,
      scannedAt: new Date().toISOString(),
      deviceLabel: device,
    });
    setPending((n) => n + 1);
    setCounts((current) => (current ? { ...current, checkedIn: current.checkedIn + 1 } : current));
    return { kind: 'green', title: 'Welcome in', detail: `${ticket.tierName}${ticket.seats > 1 ? ` · ${ticket.seats} seats` : ''} · ${ticket.orderSize > 1 ? `1 of ${ticket.orderSize} in this order` : ticket.attendeeName ?? ticket.orderNumber}`, offline: true };
  }, [manifest, eventId, device]);

  const handle = useCallback(async (raw: string, override = false, ticketId: string | null = null) => {
    const value = raw.trim();
    if (!value) return;
    const now = Date.now();
    if (!override && lastSeen.current.value === value && now - lastSeen.current.at < REPEAT_MS) return;
    lastSeen.current = { value, at: now };
    if (busy.current) return;
    busy.current = true;
    try {
      // A QR carries the ticket's URL; a hand-typed entry is the eight-character
      // code. Anything that yields a token is a token, however the camera app
      // decided to hand it back.
      const token = tokenFromScan(value);
      const body = override && ticketId
        ? { eventId, override: true, deviceLabel: device, ...(token ? { token } : { code: value }) }
        : { eventId, deviceLabel: device, ...(token ? { token } : { code: value }) };
      let reply: ScanReply | null = null;
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status === 401) {
          show({ kind: 'red', title: 'Signed out', detail: 'Sign in again to keep scanning.' });
          return;
        }
        reply = (await response.json()) as ScanReply;
        setOnline(true);
      } catch {
        setOnline(false);
        show(await decideOffline(value));
        return;
      }
      if (reply.counts) setCounts(reply.counts);
      const ticket = reply.ticket;
      const position = ticket ? `${ticket.orderTickets.findIndex((entry) => entry.id === ticket.id) + 1} of ${ticket.orderTickets.length}` : '';
      switch (reply.result) {
        case 'ok':
        case 'override':
          show({ kind: 'green', title: 'Welcome in', detail: `${ticket?.tierName ?? 'Ticket'}${ticket && ticket.seats > 1 ? ` · ${ticket.seats} seats` : ''}${ticket && ticket.orderTickets.length > 1 ? ` · ${position} in this order` : ticket?.attendeeName ? ` · ${ticket.attendeeName}` : ''}` });
          break;
        case 'duplicate':
          show({ kind: 'amber', title: `Already scanned${ticket?.checkedInAt ? ` at ${timeOf(ticket.checkedInAt)}` : ''}`, detail: `${ticket?.checkedInBy ? `by ${ticket.checkedInBy} · ` : ''}${ticket?.tierName ?? ''}${ticket?.attendeeName ? ` · ${ticket.attendeeName}` : ''}`, ticketId: ticket?.id ?? null });
          break;
        case 'wrong_event':
          // Amber, not red: this is a real ticket and a real guest, on the
          // wrong night. Nobody should be turned away like a forgery.
          show({ kind: 'amber', title: 'Wrong event', detail: 'A real ticket, for a different night.', ticketId: null });
          break;
        case 'void':
          show({ kind: 'red', title: 'Not valid here', detail: reply.reason });
          break;
        case 'refunded':
          show({ kind: 'red', title: 'Refunded', detail: 'This one was paid back. It cannot be used to come in.' });
          break;
        case 'not_found':
          show({ kind: 'red', title: 'No such ticket', detail: 'Nothing matches that code. Try Search if their phone is dead.' });
          break;
        default:
          show({ kind: 'red', title: 'Not valid here', detail: reply.reason || 'Unrecognised code.' });
      }
    } finally {
      busy.current = false;
    }
  }, [eventId, device, show, decideOffline]);

  const checkInById = useCallback(async (match: SearchMatch) => {
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, ticketId: match.ticketId, deviceLabel: device }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const reply = (await response.json()) as ScanReply;
      if (!response.ok) {
        show({ kind: 'red', title: 'Not allowed', detail: 'A manager has to let someone in by hand.' });
        return;
      }
      if (reply.counts) setCounts(reply.counts);
      setSearching(false);
      show(
        reply.result === 'ok'
          ? { kind: 'green', title: 'Welcome in', detail: `${match.name ?? match.orderNumber} · ${match.tierName}` }
          : reply.result === 'duplicate'
            ? { kind: 'amber', title: 'Already scanned', detail: match.name ?? match.orderNumber, ticketId: null }
            : { kind: 'red', title: 'Not valid here', detail: reply.reason },
      );
    } catch {
      show({ kind: 'red', title: 'No connection', detail: 'Checking someone in by hand needs signal. Scan their code instead.' });
    }
  }, [eventId, device, show]);

  const endShift = useCallback(async () => {
    if (!window.confirm('Clear this event\u2019s ticket list from this phone? Anything not yet synced is sent first.')) return;
    await flush();
    await clearEvent(eventId);
    window.location.href = '/admin/door';
  }, [eventId, flush]);

  /* ----------------------------------------------------------- camera -- */

  const holdWakeLock = useCallback(async () => {
    try {
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (!wakeLock || wakeRef.current) return;
      wakeRef.current = await wakeLock.request('screen');
    } catch {
      // Unsupported or refused. The scanner works; the screen just sleeps.
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = torch === 'on' ? false : true;
    try {
      // `torch` is real on Android Chrome and absent from the DOM types.
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorch(next ? 'on' : 'off');
    } catch {
      setTorch('unsupported');
    }
  }, [torch]);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    trackRef.current = null;
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
    const stream = video.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video.current) video.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const element = video.current!;
      // A doorway is dark and a phone sleeps in the middle of a queue.
      trackRef.current = stream.getVideoTracks()[0] ?? null;
      const capabilities = trackRef.current?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorch(capabilities?.torch ? 'off' : 'unsupported');
      void holdWakeLock();
      element.srcObject = stream;
      await element.play();

      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (Detector) {
        const detector = new Detector({ formats: ['qr_code'] });
        let active = true;
        const tick = async () => {
          if (!active) return;
          try {
            if (element.readyState >= 2) {
              const codes = await detector.detect(element);
              const first = codes[0]?.rawValue;
              if (first) void handle(first);
            }
          } catch {
            // A frame that could not be read is just the next frame's problem.
          }
          if (active) window.setTimeout(tick, 150);
        };
        void tick();
        stopRef.current = () => { active = false; };
      } else {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromStream(stream, element, (result) => {
          if (result) void handle(result.getText());
        });
        stopRef.current = () => controls.stop();
      }
      setPhase('scanning');
    } catch {
      stop();
      setPhase('failed');
    }
  }, [handle, stop, holdWakeLock]);

  useEffect(() => () => stop(), [stop]);

  const submitManual = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = manual.trim();
    if (!value) return;
    setManual('');
    void handle(value);
  };

  /* --------------------------------------------------------------- ui -- */

  const tone = verdict?.kind === 'green' ? 'bg-[#1f6b3a]' : verdict?.kind === 'amber' ? 'bg-[#b8741c]' : 'bg-[#9b2c1b]';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-obsidian text-night-text">
      {/* Persistent header: the event, the count, a way out. */}
      <header className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <a href="/admin/door" className="inline-flex min-h-11 items-center text-[0.9375rem] text-night-soft underline underline-offset-4">Door</a>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[0.9375rem] font-semibold">{eventTitle}</p>
          <p className="tabular text-[0.8125rem] text-night-soft">
            {counts ? `${counts.checkedIn} / ${counts.total} checked in` : 'Loading the list…'}
            {!online ? ' · offline' : ''}
            {pending > 0 ? ` · ${pending} to sync` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSearching(true)}
          className="inline-flex min-h-11 items-center rounded-full border border-night-text/25 px-3 text-[0.8125rem] font-semibold"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-night-text/25 text-[0.8125rem] font-semibold"
        >
          {muted ? 'Muted' : 'Sound'}
        </button>
      </header>

      {/* Camera, full bleed. */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
        {phase === 'scanning' ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-[min(70vw,320px)] rounded-2xl border-2 border-amber/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className="grid gap-4">
              <p className="text-[1.0625rem] leading-relaxed text-night-soft">
                {phase === 'failed'
                  ? // The usual cause is a permission tapped away once. Say where
                    // it lives rather than leaving a dead screen.
                    'The camera could not start. On an iPhone: Settings → Safari → Camera → Allow, then try again. You can also type codes below, or use Search.'
                  : 'Point the camera at a ticket.'}
              </p>
              <button
                type="button"
                onClick={start}
                disabled={phase === 'starting'}
                className="inline-flex min-h-14 items-center justify-center rounded-(--radius-md) bg-amber px-8 text-[1.125rem] font-semibold text-on-orange disabled:opacity-60"
              >
                {phase === 'starting' ? 'Starting…' : phase === 'failed' ? 'Try the camera again' : 'Start scanning'}
              </button>

              {/* Shift controls: only ever touched before or after a rush, so
                  they sit on the idle screen rather than over the camera. */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.875rem]">
                <button type="button" onClick={nameThisDevice} className="min-h-11 text-night-soft underline underline-offset-4">
                  This phone: {device}
                </button>
                <button type="button" onClick={() => void endShift()} className="min-h-11 text-night-soft underline underline-offset-4">
                  End shift
                </button>
              </div>
            </div>
          </div>
        )}

        {searching ? (
          <DoorSearch
            eventId={eventId}
            manifest={manifest}
            canCheckIn={canOverride}
            onCheckIn={checkInById}
            onClose={() => setSearching(false)}
          />
        ) : null}

        {/* Torch, where the phone has one: a doorway is darker than any test. */}
        {phase === 'scanning' && torch !== 'unsupported' ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torch === 'on'}
            className="absolute bottom-4 right-4 inline-flex min-h-12 items-center rounded-full border border-white/40 bg-black/50 px-4 text-[0.9375rem] font-semibold text-white"
          >
            {torch === 'on' ? 'Light on' : 'Light'}
          </button>
        ) : null}

        {/* The verdict is the whole screen. Nothing to dismiss. */}
        {verdict ? (
          <div role="status" aria-live="assertive" className={`absolute inset-0 grid place-items-center px-6 text-center text-white ${tone}`}>
            <div className="grid gap-3">
              <p className="display text-[clamp(2.5rem,12vw,4.5rem)] leading-none">{verdict.title}</p>
              <p className="text-[1.125rem] leading-snug">{verdict.detail}</p>
              {verdict.offline ? <p className="text-[0.875rem] opacity-80">offline · will sync</p> : null}
              {verdict.kind === 'amber' && verdict.ticketId && !verdict.offline && canOverride ? (
                <button
                  type="button"
                  onClick={() => void handle(lastSeen.current.value, true, verdict.ticketId)}
                  className="mx-auto mt-2 inline-flex min-h-12 items-center rounded-(--radius-md) border-2 border-white px-6 text-[1rem] font-semibold"
                >
                  Let them in anyway
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Manual entry, for when a camera fails or a screen is cracked. */}
      <form onSubmit={submitManual} className="flex gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <label htmlFor="scan-code" className="sr-only">Ticket code</label>
        <input
          id="scan-code"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="Type a code: H7K4-M2Q9"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className="min-h-12 flex-1 rounded-(--radius-md) border border-night-text/25 bg-espresso px-4 text-[1.0625rem] uppercase tracking-[0.08em] text-night-text placeholder:normal-case placeholder:tracking-normal placeholder:text-night-soft/60"
        />
        <button type="submit" className="inline-flex min-h-12 items-center rounded-(--radius-md) bg-amber px-5 text-[1rem] font-semibold text-on-orange">
          Check
        </button>
      </form>
    </div>
  );
}
