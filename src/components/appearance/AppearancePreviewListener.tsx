'use client';

import { useEffect } from 'react';


export function AppearancePreviewListener() {
  useEffect(() => {
    // Hydration is done: inline variables set from here on will stick.
    document.documentElement.dataset.previewReady = '1';
    if (window.parent === window) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; vars?: Record<string, string> } | null;
      if (!data || data.type !== 'casa-aurelia:appearance' || !data.vars) return;
      const root = document.documentElement;
      for (const [key, value] of Object.entries(data.vars)) {
        if (!/^--[a-z0-9-]+$/.test(key) && key !== 'color-scheme') continue;
        if (typeof value !== 'string' || value.length > 80) continue;
        root.style.setProperty(key, value);
      }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'casa-aurelia:appearance-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return null;
}
