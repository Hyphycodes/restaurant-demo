'use client';

import { useEffect } from 'react';


export function ThemeAttribute({ slug, motion }: { slug: string; motion: 'on' | 'off' }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = { theme: root.dataset.theme, motion: root.dataset.motion };
    root.dataset.theme = slug;
    root.dataset.motion = motion;
    return () => {
      if (previous.theme) root.dataset.theme = previous.theme;
      else delete root.dataset.theme;
      if (previous.motion) root.dataset.motion = previous.motion;
      else delete root.dataset.motion;
    };
  }, [slug, motion]);

  return null;
}
