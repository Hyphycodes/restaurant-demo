'use client';

import { useEffect } from 'react';

type EventKind = 'view' | 'display_view' | 'block_click' | 'event_click' | 'review_click' | 'reservation_click' | 'ticket_click' | 'social_click';

function sessionKey(): string {
  const key = 'cosa-nostra-hub-session-v1';
  try {
    const found = sessionStorage.getItem(key);
    if (found) return found;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return '';
  }
}
function source() {
  const params = new URLSearchParams(location.search);
  return {
    referrer: document.referrer || null,
    utm: Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
      .map((key) => [key, params.get(key)])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))),
  };
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify({ ...payload, sessionKey: sessionKey(), ...source() });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/link-hubs/analytics', new Blob([body], { type: 'application/json' }));
    return;
  }
  void fetch('/api/link-hubs/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
}

export function HubAnalyticsTracker({ hubId, display = false }: { hubId: string; display?: boolean }) {
  useEffect(() => {
    send({ hubId, eventKind: display ? 'display_view' : 'view' });
  }, [display, hubId]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hub-track]');
      if (!element) return;
      send({
        hubId,
        blockId: element.dataset.blockId || null,
        eventKind: (element.dataset.hubTrack || 'block_click') as EventKind,
        target: element.dataset.trackTarget || null,
      });
    };
    document.addEventListener('click', click, { capture: true });
    return () => document.removeEventListener('click', click, { capture: true });
  }, [hubId]);
  return null;
}
